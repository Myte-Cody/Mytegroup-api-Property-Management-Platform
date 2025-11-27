import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Types } from 'mongoose';
import { InquiryType } from '../../common/enums/inquiry.enum';
import { AppModel } from '../../common/interfaces/app-model.interface';
import { SessionService } from '../../common/services/session.service';
import { createPaginatedResponse } from '../../common/utils/pagination.utils';
import { InquiryEmailService } from '../email/services/inquiry-email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Property } from '../properties/schemas/property.schema';
import { Unit } from '../properties/schemas/unit.schema';
import { User } from '../users/schemas/user.schema';
import { CreateInquiryDto } from './dto/create-inquiry.dto';
import { InquiryQueryDto, PaginatedInquiriesResponse } from './dto/inquiry-query.dto';
import { UpdateInquiryDto } from './dto/update-inquiry.dto';
import { Inquiry } from './schemas/inquiry.schema';

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
    private readonly notificationsService: NotificationsService,
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

    // Execute queries with populate
    const [inquiries, total] = await Promise.all([
      baseQuery
        .clone()
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .populate('property', 'name address')
        .populate('unit', 'unitNumber')
        .exec(),
      baseQuery.clone().countDocuments().exec(),
    ]);

    return createPaginatedResponse<Inquiry>(inquiries, total, page, limit);
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
        const landlordDashboard = landlordUser.user_type === 'Contractor' ? 'contractor' : 'landlord';
        await this.notificationsService.createNotification(
          landlordUser._id.toString(),
          'New Contact Request',
          `New contact request for ${entityName} from ${leadName}. Check details.`,
          `/dashboard/${landlordDashboard}`,
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
        const landlordDashboard = landlordUser.user_type === 'Contractor' ? 'contractor' : 'landlord';
        await this.notificationsService.createNotification(
          landlordUser._id.toString(),
          'New Visit Booking',
          `New visit booking request for ${entityName} on ${dateTimeStr}.`,
          `/dashboard/${landlordDashboard}`,
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
