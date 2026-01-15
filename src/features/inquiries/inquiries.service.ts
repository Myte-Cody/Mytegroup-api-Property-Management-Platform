import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { NotificationType } from '@shared/notification-types';
import * as crypto from 'crypto';
import { ClientSession, Types } from 'mongoose';
import { InquiryStatus, InquiryType } from '../../common/enums/inquiry.enum';
import { AppModel } from '../../common/interfaces/app-model.interface';
import { SessionService } from '../../common/services/session.service';
import { createPaginatedResponse } from '../../common/utils/pagination.utils';
import { InquiryEmailService } from '../email/services/inquiry-email.service';
import { NotificationDispatcherService } from '../notifications/notification-dispatcher.service';
import { Property } from '../properties/schemas/property.schema';
import { Unit } from '../properties/schemas/unit.schema';
import { User } from '../users/schemas/user.schema';
import {
  CreateContactInquiryDto,
  CreateInquiryDto,
  ReplyToInquiryDto,
  VerifyContactInquiryDto,
} from './dto/create-inquiry.dto';
import { InquiryQueryDto, PaginatedInquiriesResponse } from './dto/inquiry-query.dto';
import { UpdateInquiryDto } from './dto/update-inquiry.dto';
import { Inquiry } from './schemas/inquiry.schema';

const VERIFICATION_CODE_EXPIRY_MINUTES = 15;

@Injectable()
export class InquiriesService {
  constructor(
    @InjectModel(Inquiry.name)
    private readonly inquiryModel: AppModel<Inquiry>,
    @InjectModel(Property.name)
    private readonly propertyModel: AppModel<Property>,
    @InjectModel(Unit.name)
    private readonly unitModel: AppModel<Unit>,
    @InjectModel(User.name)
    private readonly userModel: AppModel<User>,
    private readonly sessionService: SessionService,
    private readonly notificationDispatcher: NotificationDispatcherService,
    private readonly inquiryEmailService: InquiryEmailService,
  ) {}

  async create(createInquiryDto: CreateInquiryDto) {
    return await this.sessionService.withSession(async (session: ClientSession | null) => {
      // Validate property exists if provided
      if (createInquiryDto.propertyId) {
        const property = await this.propertyModel.findById(createInquiryDto.propertyId, null, {
          session,
        });
        if (!property) {
          throw new UnprocessableEntityException(
            `Property with ID ${createInquiryDto.propertyId} not found`,
          );
        }
      }

      // Validate unit exists if provided
      if (createInquiryDto.unitId) {
        const unit = await this.unitModel.findById(createInquiryDto.unitId, null, { session });
        if (!unit) {
          throw new UnprocessableEntityException(
            `Unit with ID ${createInquiryDto.unitId} not found`,
          );
        }
      }

      // Create inquiry data
      const inquiryData: any = {
        inquiryType: createInquiryDto.inquiryType,
        name: createInquiryDto.name,
        email: createInquiryDto.email,
        phone: createInquiryDto.phone,
        message: createInquiryDto.message,
      };

      if (createInquiryDto.preferredDate) {
        inquiryData.preferredDate = new Date(createInquiryDto.preferredDate);
      }

      if (createInquiryDto.propertyId) {
        inquiryData.property = new Types.ObjectId(createInquiryDto.propertyId);
      }

      if (createInquiryDto.unitId) {
        inquiryData.unit = new Types.ObjectId(createInquiryDto.unitId);
      }

      const newInquiry = new this.inquiryModel(inquiryData);
      const inquiry = await newInquiry.save({ session });

      // Send notification to landlord based on inquiry type
      await this.notifyLandlordOfNewInquiry(inquiry, session);

      return {
        success: true,
        data: { inquiry },
        message: 'Inquiry created successfully',
      };
    });
  }

  /**
   * Create a contact inquiry
   * - For authenticated tenants: Links to tenant, no verification needed
   * - For unauthenticated users with existing account: No verification needed
   * - For unauthenticated new users: Sends verification code to email
   */
  async createContactInquiry(dto: CreateContactInquiryDto, authenticatedUserId?: string) {
    return await this.sessionService.withSession(async (session: ClientSession | null) => {
      // Validate unit exists
      const unit = await this.unitModel
        .findById(dto.unitId, null, { session })
        .populate('property')
        .exec();

      if (!unit) {
        throw new UnprocessableEntityException(`Unit with ID ${dto.unitId} not found`);
      }

      const property = unit.property as any;

      // Case 1: Authenticated tenant
      if (authenticatedUserId) {
        const authenticatedUser = await this.userModel.findById(authenticatedUserId, null, {
          session,
        });

        if (!authenticatedUser) {
          throw new UnprocessableEntityException('Authenticated user not found');
        }

        const inquiryData: any = {
          inquiryType: InquiryType.CONTACT,
          status: InquiryStatus.SUBMITTED,
          tenant: new Types.ObjectId(authenticatedUserId),
          message: dto.message,
          unit: new Types.ObjectId(dto.unitId),
          property: property._id,
          emailVerified: true,
        };

        const newInquiry = new this.inquiryModel(inquiryData);
        const inquiry = await newInquiry.save({ session });

        // Notify landlord
        await this.notifyLandlordOfNewInquiry(inquiry, session);

        return {
          success: true,
          data: { inquiry, requiresVerification: false },
          message: 'Inquiry submitted successfully',
        };
      }

      // Case 2: Unauthenticated - require name and email
      if (!dto.name || !dto.email) {
        throw new BadRequestException('Name and email are required for unauthenticated inquiries');
      }

      // Check if user has existing account with this email
      const existingUser = await this.userModel.findOne({ email: dto.email.toLowerCase() }, null, {
        session,
      });

      // If has existing account, create inquiry directly (they should log in, but allow it)
      if (existingUser) {
        const inquiryData: any = {
          inquiryType: InquiryType.CONTACT,
          status: InquiryStatus.SUBMITTED,
          name: dto.name,
          email: dto.email.toLowerCase(),
          message: dto.message,
          unit: new Types.ObjectId(dto.unitId),
          property: property._id,
          emailVerified: true,
        };

        const newInquiry = new this.inquiryModel(inquiryData);
        const inquiry = await newInquiry.save({ session });

        // Notify landlord
        await this.notifyLandlordOfNewInquiry(inquiry, session);

        return {
          success: true,
          data: { inquiry, requiresVerification: false },
          message: 'Inquiry submitted successfully',
        };
      }

      // Case 3: New unauthenticated user - require email verification
      const verificationCode = this.generateVerificationCode();
      const verificationCodeExpiry = new Date();
      verificationCodeExpiry.setMinutes(
        verificationCodeExpiry.getMinutes() + VERIFICATION_CODE_EXPIRY_MINUTES,
      );

      const inquiryData: any = {
        inquiryType: InquiryType.CONTACT,
        status: InquiryStatus.PENDING_VERIFICATION,
        name: dto.name,
        email: dto.email.toLowerCase(),
        message: dto.message,
        unit: new Types.ObjectId(dto.unitId),
        property: property._id,
        emailVerified: false,
        verificationCode,
        verificationCodeExpiry,
      };

      const newInquiry = new this.inquiryModel(inquiryData);
      const inquiry = await newInquiry.save({ session });

      // Send verification email
      await this.inquiryEmailService.sendInquiryVerificationEmail({
        recipientName: dto.name,
        recipientEmail: dto.email,
        verificationCode,
        propertyName: property.name,
        unitIdentifier: unit.unitNumber,
        expiresInMinutes: VERIFICATION_CODE_EXPIRY_MINUTES,
      });

      return {
        success: true,
        data: {
          inquiryId: inquiry._id,
          requiresVerification: true,
          email: dto.email,
        },
        message: 'Verification code sent to your email',
      };
    });
  }

  /**
   * Verify email and submit the contact inquiry
   */
  async verifyContactInquiry(dto: VerifyContactInquiryDto) {
    return await this.sessionService.withSession(async (session: ClientSession | null) => {
      const inquiry = await this.inquiryModel.findById(dto.inquiryId, null, { session }).exec();

      if (!inquiry) {
        throw new NotFoundException(`Inquiry not found`);
      }

      if (inquiry.status !== InquiryStatus.PENDING_VERIFICATION) {
        throw new BadRequestException('This inquiry has already been verified');
      }

      if (!inquiry.verificationCode || !inquiry.verificationCodeExpiry) {
        throw new BadRequestException('No verification code found for this inquiry');
      }

      // Check if code has expired
      if (new Date() > inquiry.verificationCodeExpiry) {
        throw new BadRequestException(
          'Verification code has expired. Please submit a new inquiry.',
        );
      }

      // Verify code
      if (inquiry.verificationCode !== dto.code) {
        throw new BadRequestException('Invalid verification code');
      }

      // Update inquiry status
      inquiry.status = InquiryStatus.SUBMITTED;
      inquiry.emailVerified = true;
      inquiry.verificationCode = undefined;
      inquiry.verificationCodeExpiry = undefined;
      await inquiry.save({ session });

      // Notify landlord
      await this.notifyLandlordOfNewInquiry(inquiry, session);

      return {
        success: true,
        data: { inquiry },
        message: 'Email verified successfully. Your inquiry has been submitted.',
      };
    });
  }

  /**
   * Resend verification code for a pending inquiry
   */
  async resendVerificationCode(inquiryId: string) {
    return await this.sessionService.withSession(async (session: ClientSession | null) => {
      const inquiry = await this.inquiryModel
        .findById(inquiryId, null, { session })
        .populate('unit')
        .populate('property')
        .exec();

      if (!inquiry) {
        throw new NotFoundException('Inquiry not found');
      }

      if (inquiry.status !== InquiryStatus.PENDING_VERIFICATION) {
        throw new BadRequestException('This inquiry has already been verified');
      }

      // Generate new code
      const verificationCode = this.generateVerificationCode();
      const verificationCodeExpiry = new Date();
      verificationCodeExpiry.setMinutes(
        verificationCodeExpiry.getMinutes() + VERIFICATION_CODE_EXPIRY_MINUTES,
      );

      inquiry.verificationCode = verificationCode;
      inquiry.verificationCodeExpiry = verificationCodeExpiry;
      await inquiry.save({ session });

      const unit = inquiry.unit as any;
      const property = inquiry.property as any;

      // Send verification email
      await this.inquiryEmailService.sendInquiryVerificationEmail({
        recipientName: inquiry.name,
        recipientEmail: inquiry.email,
        verificationCode,
        propertyName: property?.name || 'Property',
        unitIdentifier: unit?.unitNumber,
        expiresInMinutes: VERIFICATION_CODE_EXPIRY_MINUTES,
      });

      return {
        success: true,
        message: 'Verification code resent successfully',
      };
    });
  }

  /**
   * Generate a 6-digit verification code
   */
  private generateVerificationCode(): string {
    return crypto.randomInt(100000, 999999).toString();
  }

  /**
   * Landlord replies to an inquiry - sends email to inquirer
   */
  async replyToInquiry(inquiryId: string, dto: ReplyToInquiryDto) {
    return await this.sessionService.withSession(async (session: ClientSession | null) => {
      const inquiry = await this.inquiryModel
        .findById(inquiryId, null, { session })
        .populate('tenant', 'firstName lastName email phone')
        .populate('property', 'name')
        .populate('unit', 'unitNumber')
        .exec();

      if (!inquiry) {
        throw new NotFoundException('Inquiry not found');
      }

      if (inquiry.status === InquiryStatus.PENDING_VERIFICATION) {
        throw new BadRequestException('Cannot reply to an unverified inquiry');
      }

      // Get inquirer's contact info
      const tenant = inquiry.tenant as any;
      const recipientEmail = tenant?.email || inquiry.email;
      const recipientName = tenant
        ? `${tenant.firstName || ''} ${tenant.lastName || ''}`.trim() || 'Tenant'
        : inquiry.name || 'Inquirer';

      if (!recipientEmail) {
        throw new BadRequestException('No email address found for this inquiry');
      }

      // Update inquiry with reply
      inquiry.reply = dto.reply;
      inquiry.repliedAt = new Date();
      inquiry.status = InquiryStatus.RESPONDED;
      await inquiry.save({ session });

      // Send email to inquirer
      const property = inquiry.property as any;
      const unit = inquiry.unit as any;

      await this.inquiryEmailService.sendInquiryReplyEmail(
        {
          recipientName,
          recipientEmail,
          propertyName: property?.name || 'Property',
          unitIdentifier: unit?.unitNumber,
          originalMessage: inquiry.message,
          replyMessage: dto.reply,
        },
        { queue: true },
      );

      return {
        success: true,
        data: { inquiry },
        message: 'Reply sent successfully',
      };
    });
  }

  async findAllPaginated(queryDto: InquiryQueryDto): Promise<PaginatedInquiriesResponse<Inquiry>> {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      inquiryType,
      propertyId,
      unitId,
    } = queryDto;

    let baseQuery = this.inquiryModel.find();

    // Add search functionality (searches name, email, phone)
    if (search) {
      baseQuery = baseQuery.where({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } },
        ],
      });
    }

    // Filter by inquiry type
    if (inquiryType) {
      baseQuery = baseQuery.where({ inquiryType });
    }

    // Filter by property
    if (propertyId) {
      baseQuery = baseQuery.where({ property: new Types.ObjectId(propertyId) });
    }

    // Filter by unit
    if (unitId) {
      baseQuery = baseQuery.where({ unit: new Types.ObjectId(unitId) });
    }

    // Build sort object
    const sortObj: any = {};
    sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Execute queries with populate (include tenant for linked inquiries)
    const [inquiries, total] = await Promise.all([
      baseQuery
        .clone()
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .populate('property', 'name address')
        .populate('unit', 'unitNumber')
        .populate('tenant', 'firstName lastName email phone')
        .exec(),
      baseQuery.clone().countDocuments().exec(),
    ]);

    // Transform inquiries to include tenant info in name/email/phone fields
    const transformedInquiries = inquiries.map((inquiry) => {
      const inquiryObj = inquiry.toObject();
      const tenant = inquiryObj.tenant as any;

      if (tenant) {
        // Use tenant info if inquiry is linked to a tenant
        inquiryObj.name =
          inquiryObj.name ||
          `${tenant.firstName || ''} ${tenant.lastName || ''}`.trim() ||
          'Tenant';
        inquiryObj.email = inquiryObj.email || tenant.email;
        inquiryObj.phone = inquiryObj.phone || tenant.phone;
      }

      return inquiryObj;
    });

    return createPaginatedResponse<any>(transformedInquiries, total, page, limit);
  }

  async findOne(id: string) {
    const inquiry = await this.inquiryModel
      .findById(id)
      .populate('property', 'name address')
      .populate('unit', 'unitNumber')
      .exec();

    if (!inquiry) {
      throw new NotFoundException(`Inquiry with ID ${id} not found`);
    }

    return {
      success: true,
      data: { inquiry },
    };
  }

  async update(id: string, updateInquiryDto: UpdateInquiryDto) {
    return await this.sessionService.withSession(async (session: ClientSession | null) => {
      const inquiry = await this.inquiryModel.findById(id, null, { session }).exec();

      if (!inquiry) {
        throw new NotFoundException(`Inquiry with ID ${id} not found`);
      }

      // Validate property exists if being updated
      if (updateInquiryDto.propertyId) {
        const property = await this.propertyModel.findById(updateInquiryDto.propertyId, null, {
          session,
        });
        if (!property) {
          throw new UnprocessableEntityException(
            `Property with ID ${updateInquiryDto.propertyId} not found`,
          );
        }
      }

      // Validate unit exists if being updated
      if (updateInquiryDto.unitId) {
        const unit = await this.unitModel.findById(updateInquiryDto.unitId, null, { session });
        if (!unit) {
          throw new UnprocessableEntityException(
            `Unit with ID ${updateInquiryDto.unitId} not found`,
          );
        }
      }

      // Update inquiry data
      const updateData: any = {};

      if (updateInquiryDto.inquiryType !== undefined) {
        updateData.inquiryType = updateInquiryDto.inquiryType;
      }
      if (updateInquiryDto.name !== undefined) {
        updateData.name = updateInquiryDto.name;
      }
      if (updateInquiryDto.email !== undefined) {
        updateData.email = updateInquiryDto.email;
      }
      if (updateInquiryDto.phone !== undefined) {
        updateData.phone = updateInquiryDto.phone;
      }
      if (updateInquiryDto.message !== undefined) {
        updateData.message = updateInquiryDto.message;
      }
      if (updateInquiryDto.preferredDate !== undefined) {
        updateData.preferredDate = new Date(updateInquiryDto.preferredDate);
      }
      if (updateInquiryDto.propertyId !== undefined) {
        updateData.property = new Types.ObjectId(updateInquiryDto.propertyId);
      }
      if (updateInquiryDto.unitId !== undefined) {
        updateData.unit = new Types.ObjectId(updateInquiryDto.unitId);
      }

      const updatedInquiry = await this.inquiryModel
        .findByIdAndUpdate(id, updateData, { new: true, session })
        .populate('property', 'name address')
        .populate('unit', 'unitNumber')
        .exec();

      return {
        success: true,
        data: { inquiry: updatedInquiry },
        message: 'Inquiry updated successfully',
      };
    });
  }

  async remove(id: string) {
    const inquiry = await this.inquiryModel.findById(id).exec();

    if (!inquiry) {
      throw new NotFoundException(`Inquiry with ID ${id} not found`);
    }

    // Soft delete
    await (inquiry as any).delete();

    return {
      success: true,
      message: 'Inquiry deleted successfully',
    };
  }

  /**
   * Notify landlord of new inquiry (contact request or visit booking)
   */
  private async notifyLandlordOfNewInquiry(
    inquiry: Inquiry,
    session: ClientSession | null,
  ): Promise<void> {
    try {
      // Find the landlord user
      const landlordUser = await this.userModel
        .findOne({ user_type: 'Landlord' }, null, { session })
        .exec();

      if (!landlordUser) {
        return;
      }

      const leadName = inquiry.name;

      // Get property/unit information
      let entityName = 'Property';
      let propertyName = 'Unknown Property';
      let unitIdentifier: string | undefined;

      if (inquiry.property) {
        const property = await this.propertyModel.findById(inquiry.property, null, { session });
        if (property) {
          propertyName = property.name;
          entityName = property.name;

          // If unit is specified, add unit number
          if (inquiry.unit) {
            const unit = await this.unitModel.findById(inquiry.unit, null, { session });
            if (unit) {
              unitIdentifier = unit.unitNumber;
              entityName = `${property.name} - Unit ${unit.unitNumber}`;
            }
          }
        }
      }

      const landlordName =
        landlordUser.firstName && landlordUser.lastName
          ? `${landlordUser.firstName} ${landlordUser.lastName}`
          : landlordUser.username;

      // Send appropriate notification based on inquiry type
      if (inquiry.inquiryType === InquiryType.CONTACT) {
        // Send in-app notification
        const landlordDashboard =
          landlordUser.user_type === 'Contractor' ? 'contractor' : 'landlord';
        await this.notificationDispatcher.sendInAppNotification(
          landlordUser._id.toString(),
          NotificationType.MESSAGE_NEW_DIRECT,
          'New Contact Request',
          `New contact request for ${entityName} from ${leadName}. Check details.`,
          `/dashboard/${landlordDashboard}/marketplace/inquiries`,
        );

        // Send email notification
        await this.inquiryEmailService.sendContactRequestEmail(
          {
            recipientName: landlordName,
            recipientEmail: landlordUser.email,
            leadName,
            leadEmail: inquiry.email,
            leadPhone: inquiry.phone,
            propertyName,
            unitIdentifier,
            message: inquiry.message,
            submittedAt: (inquiry as any).createdAt || new Date(),
          },
          { queue: true },
        );
      } else if (inquiry.inquiryType === InquiryType.VISIT) {
        // Format the preferred date if available
        let dateTimeStr = 'soon';
        if (inquiry.preferredDate) {
          const date = new Date(inquiry.preferredDate);
          dateTimeStr = date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });
        }

        // Send in-app notification
        const landlordDashboard =
          landlordUser.user_type === 'Contractor' ? 'contractor' : 'landlord';
        await this.notificationDispatcher.sendInAppNotification(
          landlordUser._id.toString(),
          NotificationType.MESSAGE_NEW_DIRECT,
          'New Visit Booking',
          `New visit booking request for ${entityName} on ${dateTimeStr}.`,
          `/dashboard/${landlordDashboard}/marketplace/inquiries`,
        );

        // Send email notification
        await this.inquiryEmailService.sendVisitRequestEmail(
          {
            recipientName: landlordName,
            recipientEmail: landlordUser.email,
            leadName,
            leadEmail: inquiry.email,
            leadPhone: inquiry.phone,
            propertyName,
            unitIdentifier,
            preferredDate: inquiry.preferredDate,
            message: inquiry.message,
            submittedAt: (inquiry as any).createdAt || new Date(),
          },
          { queue: true },
        );
      }
    } catch (error) {
      console.error('Failed to notify landlord of new inquiry:', error);
    }
  }
}
