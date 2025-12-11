import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose from 'mongoose';
import { Action } from '../../common/casl/casl-ability.factory';
import { CaslAuthorizationService } from '../../common/casl/services/casl-authorization.service';
import { AvailabilityType } from '../../common/enums/availability.enum';
import { LeaseStatus } from '../../common/enums/lease.enum';
import { UserType } from '../../common/enums/user-type.enum';
import { AppModel } from '../../common/interfaces/app-model.interface';
import { createPaginatedResponse, PaginatedResponse } from '../../common/utils/pagination.utils';
import { Lease } from '../leases';
import {
  VisitRequest,
  VisitRequestStatus,
} from '../maintenance/schemas/visit-request.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { Unit } from '../properties/schemas/unit.schema';
import { UserDocument } from '../users/schemas/user.schema';
import { AvailabilityQueryDto, CreateAvailabilityDto, UpdateAvailabilityDto } from './dto';
import {
  Availability,
  AvailabilityCreatedBy,
  AvailabilityDocument,
} from './schemas/availability.schema';

@Injectable()
export class AvailabilityService {
  constructor(
    @InjectModel(Availability.name)
    private readonly availabilityModel: AppModel<Availability>,
    @InjectModel(Unit.name)
    private readonly unitModel: AppModel<Unit>,
    @InjectModel(Lease.name)
    private readonly leaseModel: AppModel<Lease>,
    @InjectModel(VisitRequest.name)
    private readonly visitRequestModel: AppModel<VisitRequest>,
    private readonly caslAuthorizationService: CaslAuthorizationService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(
    createDto: CreateAvailabilityDto,
    currentUser: UserDocument,
  ): Promise<AvailabilityDocument> {
    if (currentUser.user_type !== UserType.TENANT && currentUser.user_type !== UserType.LANDLORD) {
      throw new ForbiddenException('Only tenants and landlords can manage availability');
    }

    const ability = this.caslAuthorizationService.createAbilityForUser(currentUser);
    if (!ability.can(Action.Create, Availability)) {
      throw new ForbiddenException('You do not have permission to create availability slots');
    }

    // Validate time range
    this.validateTimeRange(createDto.startTime, createDto.endTime);

    // Validate based on availability type
    if (createDto.availabilityType === AvailabilityType.ONE_TIME && !createDto.date) {
      throw new BadRequestException('Date is required for one-time availability slots');
    }

    if (createDto.availabilityType === AvailabilityType.RECURRING && !createDto.dayOfWeek) {
      throw new BadRequestException('Day of week is required for recurring availability slots');
    }

    let tenantId: mongoose.Types.ObjectId | undefined;
    let landlordId: mongoose.Types.ObjectId;
    let createdBy: AvailabilityCreatedBy;

    if (currentUser.user_type === UserType.TENANT) {
      // Tenant creating availability for their unit
      tenantId = currentUser.organization_id;
      if (!tenantId) {
        throw new ForbiddenException('No tenant profile associated with this user');
      }

      // Validate that the tenant has a lease for this unit
      if (!createDto.unitId) {
        throw new BadRequestException('Unit ID is required for tenant availability');
      }

      const hasAccess = await this.validateTenantUnitAccess(tenantId.toString(), createDto.unitId);
      if (!hasAccess) {
        throw new ForbiddenException('You do not have access to this unit');
      }

      // Get landlord from the unit's property
      const unit = await this.unitModel.findById(createDto.unitId).populate('property').exec();
      if (!unit || !unit.property) {
        throw new NotFoundException('Unit not found');
      }
      landlordId = (unit.property as any).landlord;
      createdBy = AvailabilityCreatedBy.TENANT;
    } else {
      // Landlord creating availability
      landlordId = currentUser.organization_id;
      if (!landlordId) {
        throw new ForbiddenException('No landlord profile associated with this user');
      }

      // Validate landlord owns this property
      const hasPropertyAccess = await this.validateLandlordPropertyAccess(
        landlordId.toString(),
        createDto.propertyId,
      );
      if (!hasPropertyAccess) {
        throw new ForbiddenException('You do not have access to this property');
      }

      // If unit is specified, validate it's vacant or belongs to landlord's property
      if (createDto.unitId) {
        const hasUnitAccess = await this.validateLandlordUnitAccess(
          landlordId.toString(),
          createDto.unitId,
        );
        if (!hasUnitAccess) {
          throw new ForbiddenException('You can only create availability for vacant units');
        }
      }

      createdBy = AvailabilityCreatedBy.LANDLORD;
    }

    // Check for duplicate availability
    await this.checkDuplicateAvailability(createDto, tenantId, landlordId, createdBy);

    const availability = new this.availabilityModel({
      ...createDto,
      property: new mongoose.Types.ObjectId(createDto.propertyId),
      unit: createDto.unitId ? new mongoose.Types.ObjectId(createDto.unitId) : undefined,
      tenant: tenantId,
      landlord: landlordId,
      createdBy,
    });

    return availability.save();
  }

  private async checkDuplicateAvailability(
    createDto: CreateAvailabilityDto,
    tenantId: mongoose.Types.ObjectId | undefined,
    landlordId: mongoose.Types.ObjectId,
    createdBy: AvailabilityCreatedBy,
  ): Promise<void> {
    const query: any = {
      property: new mongoose.Types.ObjectId(createDto.propertyId),
      startTime: createDto.startTime,
      endTime: createDto.endTime,
      availabilityType: createDto.availabilityType,
      createdBy,
      deleted: false,
    };

    // Add unit filter if specified
    if (createDto.unitId) {
      query.unit = new mongoose.Types.ObjectId(createDto.unitId);
    } else {
      query.unit = { $exists: false };
    }

    // Add creator filter
    if (createdBy === AvailabilityCreatedBy.TENANT) {
      query.tenant = tenantId;
    } else {
      query.landlord = landlordId;
    }

    // Add date/dayOfWeek filter based on availability type
    if (createDto.availabilityType === AvailabilityType.ONE_TIME) {
      query.date = createDto.date;
    } else {
      query.dayOfWeek = createDto.dayOfWeek;
    }

    const existingSlot = await this.availabilityModel.findOne(query).exec();

    if (existingSlot) {
      throw new BadRequestException(
        'An availability slot with the same time and date/day already exists',
      );
    }
  }

  async findAll(
    queryDto: AvailabilityQueryDto,
    currentUser: UserDocument,
  ): Promise<PaginatedResponse<Availability>> {
    const {
      page = 1,
      limit = 10,
      propertyId,
      unitId,
      tenantId,
      createdBy,
      availabilityType,
      dayOfWeek,
      date,
      startDate,
      endDate,
      isActive,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = queryDto;

    const skip = (page - 1) * limit;
    const query: any = { deleted: false };

    if (currentUser.user_type === UserType.TENANT) {
      const userTenantId = currentUser.organization_id;
      if (!userTenantId) {
        throw new ForbiddenException('No tenant profile associated with this user');
      }
      // Tenants can only see their own availability
      query.tenant = userTenantId;
    } else {
      // Landlord can see all availability for their properties
      const landlordId = currentUser.organization_id;
      if (!landlordId) {
        throw new ForbiddenException('No landlord profile associated with this user');
      }
      query.landlord = landlordId;

      // Optional filters for landlords
      if (tenantId) {
        query.tenant = new mongoose.Types.ObjectId(tenantId);
      }
      if (createdBy) {
        query.createdBy = createdBy;
      }
    }

    // Common filters
    if (propertyId) {
      query.property = new mongoose.Types.ObjectId(propertyId);
    }
    if (unitId) {
      query.unit = new mongoose.Types.ObjectId(unitId);
    }
    if (availabilityType) {
      query.availabilityType = availabilityType;
    }
    if (dayOfWeek) {
      query.dayOfWeek = dayOfWeek;
    }
    if (date) {
      query.date = date;
    }
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = startDate;
      if (endDate) query.date.$lte = endDate;
    }
    if (isActive !== undefined) {
      query.isActive = isActive;
    }

    const sortObj: any = {};
    sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const [data, total] = await Promise.all([
      this.availabilityModel
        .find(query)
        .populate('tenant', 'name')
        .populate('property', 'name address')
        .populate('unit', 'name unitNumber')
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .exec(),
      this.availabilityModel.countDocuments(query).exec(),
    ]);

    return createPaginatedResponse(data, total, page, limit);
  }

  async findOne(id: string, currentUser: UserDocument): Promise<AvailabilityDocument> {
    const query: any = { _id: id, deleted: false };

    if (currentUser.user_type === UserType.TENANT) {
      const tenantId = currentUser.organization_id;
      if (!tenantId) {
        throw new ForbiddenException('No tenant profile associated with this user');
      }
      query.tenant = tenantId;
    } else {
      const landlordId = currentUser.organization_id;
      if (!landlordId) {
        throw new ForbiddenException('No landlord profile associated with this user');
      }
      query.landlord = landlordId;
    }

    const availability = await this.availabilityModel
      .findOne(query)
      .populate('tenant', 'name')
      .populate('property', 'name address')
      .populate('unit', 'name unitNumber')
      .exec();

    if (!availability) {
      throw new NotFoundException(`Availability slot with ID ${id} not found`);
    }

    return availability;
  }

  async update(
    id: string,
    updateDto: UpdateAvailabilityDto,
    currentUser: UserDocument,
  ): Promise<AvailabilityDocument> {
    if (currentUser.user_type !== UserType.TENANT && currentUser.user_type !== UserType.LANDLORD) {
      throw new ForbiddenException('Only tenants and landlords can manage availability');
    }

    const query: any = { _id: id, deleted: false };

    if (currentUser.user_type === UserType.TENANT) {
      const tenantId = currentUser.organization_id;
      if (!tenantId) {
        throw new ForbiddenException('No tenant profile associated with this user');
      }
      // Tenants can only edit their own availability
      query.tenant = tenantId;
      query.createdBy = AvailabilityCreatedBy.TENANT;
    } else {
      const landlordId = currentUser.organization_id;
      if (!landlordId) {
        throw new ForbiddenException('No landlord profile associated with this user');
      }
      query.landlord = landlordId;
      // Landlords can only edit availability they created
      query.createdBy = AvailabilityCreatedBy.LANDLORD;
    }

    const availability = await this.availabilityModel.findOne(query).exec();

    if (!availability) {
      throw new NotFoundException(
        `Availability slot with ID ${id} not found or you don't have permission to edit it`,
      );
    }

    // Validate time range if updating times
    if (updateDto.startTime || updateDto.endTime) {
      const startTime = updateDto.startTime || availability.startTime;
      const endTime = updateDto.endTime || availability.endTime;
      this.validateTimeRange(startTime, endTime);
    }

    Object.assign(availability, updateDto);
    return availability.save();
  }

  async remove(id: string, currentUser: UserDocument): Promise<void> {
    if (currentUser.user_type !== UserType.TENANT && currentUser.user_type !== UserType.LANDLORD) {
      throw new ForbiddenException('Only tenants and landlords can manage availability');
    }

    const query: any = { _id: id, deleted: false };

    if (currentUser.user_type === UserType.TENANT) {
      const tenantId = currentUser.organization_id;
      if (!tenantId) {
        throw new ForbiddenException('No tenant profile associated with this user');
      }
      // Tenants can only delete their own availability
      query.tenant = tenantId;
      query.createdBy = AvailabilityCreatedBy.TENANT;
    } else {
      const landlordId = currentUser.organization_id;
      if (!landlordId) {
        throw new ForbiddenException('No landlord profile associated with this user');
      }
      query.landlord = landlordId;
      // Landlords can only delete availability they created
      query.createdBy = AvailabilityCreatedBy.LANDLORD;
    }

    const availability = await this.availabilityModel.findOne(query).exec();

    if (!availability) {
      throw new NotFoundException(
        `Availability slot with ID ${id} not found or you don't have permission to delete it`,
      );
    }

    // Cancel any pending visit requests for this availability slot and notify contractors
    await this.cancelPendingVisitRequestsForSlot(id, currentUser);

    await this.availabilityModel.deleteById(id);
  }

  /**
   * Cancel pending visit requests when an availability slot is deleted
   * and notify the contractors
   */
  private async cancelPendingVisitRequestsForSlot(
    availabilitySlotId: string,
    deletedBy: UserDocument,
  ): Promise<void> {
    // Find all pending or rescheduled visit requests for this slot
    const pendingRequests = await this.visitRequestModel
      .find({
        availabilitySlot: new mongoose.Types.ObjectId(availabilitySlotId),
        status: { $in: [VisitRequestStatus.PENDING, VisitRequestStatus.RESCHEDULED] },
        deleted: false,
      })
      .populate('contractor', 'name')
      .exec();

    if (pendingRequests.length === 0) {
      return;
    }

    const deletedByName = `${deletedBy.firstName} ${deletedBy.lastName}`;
    const deletedByRole = deletedBy.user_type === UserType.TENANT ? 'tenant' : 'landlord';

    // Cancel each request and notify the contractor
    for (const request of pendingRequests) {
      // Update status to cancelled
      request.status = VisitRequestStatus.CANCELLED;
      request.responseMessage = `The availability slot was deleted by the ${deletedByRole}`;
      request.respondedBy = deletedBy._id as mongoose.Types.ObjectId;
      request.respondedAt = new Date();
      await request.save();

      // Find contractor user and send notification
      const User = this.visitRequestModel.db.model('User');
      const contractorUser = await User.findOne({ organization_id: request.contractor }).exec();

      if (contractorUser) {
        const visitDateStr = request.visitDate.toLocaleDateString();
        await this.notificationsService.createNotification(
          contractorUser._id.toString(),
          'Visit Request Cancelled',
          `${deletedByName} has deleted the availability slot. Your visit request for ${visitDateStr} (${request.startTime} - ${request.endTime}) has been cancelled.`,
          '/dashboard/contractor/visit-requests',
        );
      }
    }
  }

  // Get availability for a specific date
  async getAvailabilityForDate(
    date: Date,
    currentUser: UserDocument,
    propertyId?: string,
    unitId?: string,
  ): Promise<{ slots: Availability[] }> {
    const dayOfWeek = this.getDayOfWeek(date);
    const query: any = { isActive: true, deleted: false };

    if (currentUser.user_type === UserType.TENANT) {
      const tenantId = currentUser.organization_id;
      if (!tenantId) {
        throw new ForbiddenException('No tenant profile associated with this user');
      }
      query.tenant = tenantId;
    } else {
      const landlordId = currentUser.organization_id;
      if (!landlordId) {
        throw new ForbiddenException('No landlord profile associated with this user');
      }
      query.landlord = landlordId;
    }

    if (propertyId) {
      query.property = new mongoose.Types.ObjectId(propertyId);
    }
    if (unitId) {
      query.unit = new mongoose.Types.ObjectId(unitId);
    }

    // Get one-time slots for this date
    const oneTimeSlots = await this.availabilityModel
      .find({ ...query, availabilityType: AvailabilityType.ONE_TIME, date })
      .populate('tenant', 'name')
      .populate('property', 'name address')
      .populate('unit', 'name unitNumber')
      .exec();

    // Get recurring slots for this day of week
    const recurringSlots = await this.availabilityModel
      .find({
        ...query,
        availabilityType: AvailabilityType.RECURRING,
        dayOfWeek,
        $and: [
          {
            $or: [
              { effectiveFrom: { $exists: false } },
              { effectiveFrom: null },
              { effectiveFrom: { $lte: date } },
            ],
          },
          {
            $or: [
              { effectiveUntil: { $exists: false } },
              { effectiveUntil: null },
              { effectiveUntil: { $gte: date } },
            ],
          },
        ],
      })
      .populate('tenant', 'name')
      .populate('property', 'name address')
      .populate('unit', 'name unitNumber')
      .exec();

    return { slots: [...oneTimeSlots, ...recurringSlots] };
  }

  // Get weekly schedule
  async getWeeklySchedule(
    currentUser: UserDocument,
    propertyId?: string,
    unitId?: string,
  ): Promise<{ slots: Availability[] }> {
    const query: any = {
      availabilityType: AvailabilityType.RECURRING,
      isActive: true,
      deleted: false,
    };

    if (currentUser.user_type === UserType.TENANT) {
      const tenantId = currentUser.organization_id;
      if (!tenantId) {
        throw new ForbiddenException('No tenant profile associated with this user');
      }
      query.tenant = tenantId;
    } else {
      const landlordId = currentUser.organization_id;
      if (!landlordId) {
        throw new ForbiddenException('No landlord profile associated with this user');
      }
      query.landlord = landlordId;
    }

    if (propertyId) {
      query.property = new mongoose.Types.ObjectId(propertyId);
    }
    if (unitId) {
      query.unit = new mongoose.Types.ObjectId(unitId);
    }

    const slots = await this.availabilityModel
      .find(query)
      .populate('tenant', 'name')
      .populate('property', 'name address')
      .populate('unit', 'name unitNumber')
      .sort({ dayOfWeek: 1, startTime: 1 })
      .exec();

    return { slots };
  }

  // Get availability by unit (for landlords to see tenant availability)
  async getByUnit(unitId: string, currentUser: UserDocument): Promise<Availability[]> {
    if (currentUser.user_type !== UserType.LANDLORD) {
      throw new ForbiddenException('Only landlords can view unit availability');
    }

    const landlordId = currentUser.organization_id;
    if (!landlordId) {
      throw new ForbiddenException('No landlord profile associated with this user');
    }

    return this.availabilityModel
      .find({
        landlord: landlordId,
        unit: new mongoose.Types.ObjectId(unitId),
        isActive: true,
        deleted: false,
      })
      .populate('tenant', 'name')
      .populate('property', 'name address')
      .populate('unit', 'name unitNumber')
      .sort({ createdBy: 1, dayOfWeek: 1, startTime: 1 })
      .exec();
  }

  // Get availability by property (for landlords)
  async getByProperty(propertyId: string, currentUser: UserDocument): Promise<Availability[]> {
    if (currentUser.user_type !== UserType.LANDLORD) {
      throw new ForbiddenException('Only landlords can view property availability');
    }

    const landlordId = currentUser.organization_id;
    if (!landlordId) {
      throw new ForbiddenException('No landlord profile associated with this user');
    }

    return this.availabilityModel
      .find({
        landlord: landlordId,
        property: new mongoose.Types.ObjectId(propertyId),
        isActive: true,
        deleted: false,
      })
      .populate('tenant', 'name')
      .populate('property', 'name address')
      .populate('unit', 'name unitNumber')
      .sort({ createdBy: 1, dayOfWeek: 1, startTime: 1 })
      .exec();
  }

  /**
   * Get availability slots for visit requests (for contractors)
   * Logic:
   * - If unit is occupied (has active lease) → load tenant's slots
   * - If unit is vacant (no active lease) → load landlord's slots
   * - If property-level (no unit) → load landlord's slots
   */
  async getAvailabilityForVisitRequest(
    date: Date,
    propertyId: string,
    unitId?: string,
  ): Promise<{ slots: Availability[]; slotOwner: 'tenant' | 'landlord' }> {
    const dayOfWeek = this.getDayOfWeek(date);
    const query: any = { isActive: true, deleted: false };

    // Add property filter
    query.property = new mongoose.Types.ObjectId(propertyId);

    let slotOwner: 'tenant' | 'landlord' = 'landlord';

    if (unitId) {
      // Check if unit has an active lease (occupied)
      const activeLease = await this.leaseModel
        .findOne({
          unit: new mongoose.Types.ObjectId(unitId),
          status: LeaseStatus.ACTIVE,
        })
        .exec();

      if (activeLease && activeLease.tenant) {
        // Occupied unit - load tenant's slots
        query.unit = new mongoose.Types.ObjectId(unitId);
        query.tenant = activeLease.tenant;
        query.createdBy = AvailabilityCreatedBy.TENANT;
        slotOwner = 'tenant';
      } else {
        // Vacant unit - load landlord's slots for this unit
        query.unit = new mongoose.Types.ObjectId(unitId);
        query.createdBy = AvailabilityCreatedBy.LANDLORD;
        slotOwner = 'landlord';
      }
    } else {
      // Property-level - load landlord's slots (without unit filter)
      query.unit = { $exists: false };
      query.createdBy = AvailabilityCreatedBy.LANDLORD;
      slotOwner = 'landlord';
    }

    // Get one-time slots for this date
    const oneTimeSlots = await this.availabilityModel
      .find({ ...query, availabilityType: AvailabilityType.ONE_TIME, date })
      .populate('tenant', 'name')
      .populate('property', 'name address')
      .populate('unit', 'name unitNumber')
      .exec();

    // Get recurring slots for this day of week
    const recurringSlots = await this.availabilityModel
      .find({
        ...query,
        availabilityType: AvailabilityType.RECURRING,
        dayOfWeek,
        $and: [
          {
            $or: [
              { effectiveFrom: { $exists: false } },
              { effectiveFrom: null },
              { effectiveFrom: { $lte: date } },
            ],
          },
          {
            $or: [
              { effectiveUntil: { $exists: false } },
              { effectiveUntil: null },
              { effectiveUntil: { $gte: date } },
            ],
          },
        ],
      })
      .populate('tenant', 'name')
      .populate('property', 'name address')
      .populate('unit', 'name unitNumber')
      .exec();

    return { slots: [...oneTimeSlots, ...recurringSlots], slotOwner };
  }

  // Helper methods
  private validateTimeRange(startTime: string, endTime: string): void {
    const [startHours, startMinutes] = startTime.split(':').map(Number);
    const [endHours, endMinutes] = endTime.split(':').map(Number);
    const startTotal = startHours * 60 + startMinutes;
    const endTotal = endHours * 60 + endMinutes;

    if (startTotal >= endTotal) {
      throw new BadRequestException('Start time must be before end time');
    }
  }

  private getDayOfWeek(date: Date): string {
    const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    return days[date.getDay()];
  }

  private async validateTenantUnitAccess(tenantId: string, unitId: string): Promise<boolean> {
    console.log(tenantId, unitId);
    const lease = await this.leaseModel
      .findOne({
        tenant: new mongoose.Types.ObjectId(tenantId),
        unit: new mongoose.Types.ObjectId(unitId),
        status: LeaseStatus.ACTIVE,
      })
      .exec();
    return !!lease;
  }

  private async validateLandlordPropertyAccess(
    landlordId: string,
    propertyId: string,
  ): Promise<boolean> {
    const Property = this.availabilityModel.db.model('Property');
    const property = await Property.findOne({
      _id: new mongoose.Types.ObjectId(propertyId),
      landlord: new mongoose.Types.ObjectId(landlordId),
    }).exec();
    return !!property;
  }

  private async validateLandlordUnitAccess(landlordId: string, unitId: string): Promise<boolean> {
    // Check if the unit belongs to a property owned by this landlord
    const unit = await this.unitModel.findById(unitId).populate('property').exec();

    if (!unit || !unit.property) {
      return false;
    }

    const property = unit.property as any;
    if (property.landlord?.toString() !== landlordId) {
      return false;
    }

    // Check if the unit is vacant (no active lease)
    const Lease = this.availabilityModel.db.model('Lease');
    const activeLease = await Lease.findOne({
      unit: new mongoose.Types.ObjectId(unitId),
      status: LeaseStatus.ACTIVE,
    }).exec();

    // Landlord can create availability for vacant units only
    return !activeLease;
  }
}
