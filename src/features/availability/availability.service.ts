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
import { UserType } from '../../common/enums/user-type.enum';
import { AppModel } from '../../common/interfaces/app-model.interface';
import { createPaginatedResponse, PaginatedResponse } from '../../common/utils/pagination.utils';
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
    private readonly caslAuthorizationService: CaslAuthorizationService,
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

  async findAll(
    queryDto: AvailabilityQueryDto,
    currentUser: UserDocument,
  ): Promise<PaginatedResponse<Availability>> {
    if (currentUser.user_type !== UserType.TENANT && currentUser.user_type !== UserType.LANDLORD) {
      throw new ForbiddenException('Only tenants and landlords can access availability management');
    }

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
    if (currentUser.user_type !== UserType.TENANT && currentUser.user_type !== UserType.LANDLORD) {
      throw new ForbiddenException('Only tenants and landlords can access availability management');
    }

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

    await this.availabilityModel.deleteById(id);
  }

  // Get availability for a specific date
  async getAvailabilityForDate(
    date: Date,
    currentUser: UserDocument,
    propertyId?: string,
    unitId?: string,
  ): Promise<{ slots: Availability[] }> {
    if (currentUser.user_type !== UserType.TENANT && currentUser.user_type !== UserType.LANDLORD) {
      throw new ForbiddenException('Only tenants and landlords can access availability management');
    }

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
    if (currentUser.user_type !== UserType.TENANT && currentUser.user_type !== UserType.LANDLORD) {
      throw new ForbiddenException('Only tenants and landlords can access availability management');
    }

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
    const Lease = this.availabilityModel.db.model('Lease');
    const lease = await Lease.findOne({
      tenant: new mongoose.Types.ObjectId(tenantId),
      unit: new mongoose.Types.ObjectId(unitId),
      status: 'active',
    }).exec();
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
      status: 'active',
    }).exec();

    // Landlord can create availability for vacant units only
    return !activeLease;
  }
}
