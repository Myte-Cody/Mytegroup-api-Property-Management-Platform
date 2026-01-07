import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UserType } from '../../../common/enums/user-type.enum';
import { TenancyContextService } from '../../../common/services/tenancy-context.service';
import { Lease, LeaseDocument } from '../../leases/schemas/lease.schema';
import { Property, PropertyDocument } from '../../properties/schemas/property.schema';
import { Unit, UnitDocument } from '../../properties/schemas/unit.schema';
import { User } from '../../users/schemas/user.schema';
import { CreateScheduleDto } from '../dto/create-schedule.dto';
import { ScheduleQueryDto } from '../dto/schedule-query.dto';
import { UpdateScheduleDto } from '../dto/update-schedule.dto';
import { RecurrenceFrequency, Schedule, ScheduleDocument } from '../schemas/schedule.schema';

@Injectable()
export class SchedulesService {
  constructor(
    @InjectModel(Schedule.name)
    private scheduleModel: Model<ScheduleDocument>,
    @InjectModel(Property.name)
    private propertyModel: Model<PropertyDocument>,
    @InjectModel(Unit.name)
    private unitModel: Model<UnitDocument>,
    @InjectModel(Lease.name)
    private leaseModel: Model<LeaseDocument>,
    private readonly tenancyContextService: TenancyContextService,
  ) {}

  /**
   * Calculate the next occurrence date for a recurring schedule
   */
  private calculateNextOccurrence(
    scheduledDate: Date,
    recurrence?: { frequency: RecurrenceFrequency; endDate?: Date },
  ): Date | undefined {
    if (!recurrence || recurrence.frequency === RecurrenceFrequency.NONE) {
      return undefined;
    }

    const now = new Date();
    let nextDate = new Date(scheduledDate);

    // Keep advancing until we find a future date
    while (nextDate <= now) {
      switch (recurrence.frequency) {
        case RecurrenceFrequency.WEEKLY:
          nextDate.setDate(nextDate.getDate() + 7);
          break;
        case RecurrenceFrequency.BIWEEKLY:
          nextDate.setDate(nextDate.getDate() + 14);
          break;
        case RecurrenceFrequency.MONTHLY:
          nextDate.setMonth(nextDate.getMonth() + 1);
          break;
      }
    }

    // Check if we've passed the end date
    if (recurrence.endDate && nextDate > new Date(recurrence.endDate)) {
      return undefined;
    }

    return nextDate;
  }

  async create(createScheduleDto: CreateScheduleDto, currentUser: User): Promise<ScheduleDocument> {
    // Get landlord context
    const landlordId = this.tenancyContextService.getLandlordContext(currentUser);

    // Validate property ID
    if (!Types.ObjectId.isValid(createScheduleDto.property)) {
      throw new BadRequestException('Invalid property ID');
    }

    // Verify property belongs to this landlord
    const property = await this.propertyModel
      .findOne({
        _id: createScheduleDto.property,
        landlord: landlordId,
      })
      .exec();

    if (!property) {
      throw new NotFoundException('Property not found in your organization');
    }

    // Validate unit ID if provided
    if (createScheduleDto.unit) {
      if (!Types.ObjectId.isValid(createScheduleDto.unit)) {
        throw new BadRequestException('Invalid unit ID');
      }

      // Verify unit belongs to this landlord and property
      const unit = await this.unitModel
        .findOne({
          _id: createScheduleDto.unit,
          landlord: landlordId,
          property: createScheduleDto.property,
        })
        .exec();

      if (!unit) {
        throw new NotFoundException(
          'Unit not found in your organization or does not belong to this property',
        );
      }
    }

    const scheduledDate = new Date(createScheduleDto.scheduledDate);
    const recurrence = createScheduleDto.recurrence
      ? {
          ...createScheduleDto.recurrence,
          endDate: createScheduleDto.recurrence.endDate
            ? new Date(createScheduleDto.recurrence.endDate)
            : undefined,
        }
      : undefined;

    // Calculate next occurrence for recurring schedules
    const nextOccurrence = this.calculateNextOccurrence(scheduledDate, recurrence);

    const schedule = new this.scheduleModel({
      landlord: landlordId,
      property: new Types.ObjectId(createScheduleDto.property),
      unit: createScheduleDto.unit ? new Types.ObjectId(createScheduleDto.unit) : undefined,
      type: createScheduleDto.type,
      scheduledDate,
      scheduledTime: createScheduleDto.scheduledTime,
      recurrence,
      description: createScheduleDto.description,
      reminderDaysBefore: createScheduleDto.reminderDaysBefore ?? 1,
      createdBy: currentUser._id,
      nextOccurrence,
    });

    const savedSchedule = await schedule.save();

    // Return with populated fields
    return this.findOne(savedSchedule._id.toString(), currentUser);
  }

  async findAll(
    query: ScheduleQueryDto,
    currentUser: User,
  ): Promise<{
    data: ScheduleDocument[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const {
      page = 1,
      limit = 10,
      property,
      unit,
      type,
      recurrenceFrequency,
      startDate,
      endDate,
      search,
      upcomingOnly,
      sortBy = 'scheduledDate',
      sortOrder = 'asc',
    } = query;
    const skip = (page - 1) * limit;

    // Build filter
    const filter: any = {};

    // Apply landlord scope based on user type
    if (this.tenancyContextService.isLandlord(currentUser)) {
      const landlordId = this.tenancyContextService.getLandlordContext(currentUser);
      filter.landlord = landlordId;
    } else if (currentUser.user_type === UserType.TENANT) {
      // Tenant can only see schedules for properties/units they have a lease for
      const tenantSchedules = await this.getSchedulesForTenant(currentUser);
      filter._id = { $in: tenantSchedules };
    } else {
      // Other user types cannot access schedules
      return {
        data: [],
        total: 0,
        page,
        limit,
        totalPages: 0,
      };
    }

    if (property) filter.property = new Types.ObjectId(property);
    if (unit) filter.unit = new Types.ObjectId(unit);
    if (type) filter.type = type;
    if (recurrenceFrequency) filter['recurrence.frequency'] = recurrenceFrequency;

    // Date range filter
    if (startDate || endDate || upcomingOnly) {
      filter.scheduledDate = {};
      if (startDate) filter.scheduledDate.$gte = new Date(startDate);
      if (endDate) filter.scheduledDate.$lte = new Date(endDate);
      if (upcomingOnly) {
        filter.scheduledDate.$gte = new Date();
      }
    }

    // Search filter
    if (search) {
      filter.description = { $regex: search, $options: 'i' };
    }

    // Build sort
    const sort: any = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const [schedules, total] = await Promise.all([
      this.scheduleModel
        .find(filter)
        .populate('property', 'name address')
        .populate('unit', 'unitNumber')
        .populate('createdBy', 'firstName lastName email')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .exec(),
      this.scheduleModel.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: schedules,
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Get schedule IDs that a tenant can access based on their leases
   */
  private async getSchedulesForTenant(user: User): Promise<Types.ObjectId[]> {
    const tenantOrgId =
      user.organization_id && typeof user.organization_id === 'object'
        ? (user.organization_id as any)._id
        : user.organization_id;

    if (!tenantOrgId) {
      return [];
    }

    // Find active leases for this tenant and populate unit to get property
    const leases = await this.leaseModel
      .find({
        tenant: tenantOrgId,
        status: { $in: ['active', 'pending'] },
      })
      .populate('unit', 'property')
      .exec();

    if (leases.length === 0) {
      return [];
    }

    // Build a filter for schedules the tenant can see
    // Get property IDs from the units in leases
    const propertyIds: Types.ObjectId[] = [];
    const unitIds: Types.ObjectId[] = [];

    for (const lease of leases) {
      if (lease.unit) {
        unitIds.push(lease.unit as any);
        // Get property from populated unit
        const unit = lease.unit as any;
        if (unit && unit.property) {
          propertyIds.push(unit.property);
        }
      }
    }

    if (propertyIds.length === 0 && unitIds.length === 0) {
      return [];
    }

    // Find schedules that match the tenant's leased properties/units
    const schedules = await this.scheduleModel
      .find({
        $or: [
          // Property-level schedules for leased properties
          ...(propertyIds.length > 0
            ? [{ property: { $in: propertyIds }, unit: { $exists: false } }]
            : []),
          // Unit-specific schedules for leased units
          ...(unitIds.length > 0 ? [{ unit: { $in: unitIds } }] : []),
        ],
      })
      .select('_id')
      .exec();

    return schedules.map((s) => s._id);
  }

  async findOne(id: string, currentUser?: User): Promise<ScheduleDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid schedule ID');
    }

    const schedule = await this.scheduleModel
      .findById(id)
      .populate('property', 'name address')
      .populate('unit', 'unitNumber')
      .populate('createdBy', 'firstName lastName email')
      .exec();

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    // Verify access if user is provided
    if (currentUser) {
      if (this.tenancyContextService.isLandlord(currentUser)) {
        const landlordId = this.tenancyContextService.getLandlordContext(currentUser);
        if (schedule.landlord.toString() !== landlordId.toString()) {
          throw new ForbiddenException('You do not have access to this schedule');
        }
      } else if (currentUser.user_type === UserType.TENANT) {
        const accessibleIds = await this.getSchedulesForTenant(currentUser);
        const hasAccess = accessibleIds.some((aid) => aid.toString() === id);
        if (!hasAccess) {
          throw new ForbiddenException('You do not have access to this schedule');
        }
      } else {
        throw new ForbiddenException('You do not have access to this schedule');
      }
    }

    return schedule;
  }

  async update(
    id: string,
    updateScheduleDto: UpdateScheduleDto,
    currentUser: User,
  ): Promise<ScheduleDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid schedule ID');
    }

    const schedule = await this.scheduleModel.findById(id);
    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    // Verify landlord ownership
    const landlordId = this.tenancyContextService.getLandlordContext(currentUser);
    if (schedule.landlord.toString() !== landlordId.toString()) {
      throw new ForbiddenException('You do not have access to this schedule');
    }

    // Validate property if being updated
    if (updateScheduleDto.property) {
      if (!Types.ObjectId.isValid(updateScheduleDto.property)) {
        throw new BadRequestException('Invalid property ID');
      }

      const property = await this.propertyModel
        .findOne({
          _id: updateScheduleDto.property,
          landlord: landlordId,
        })
        .exec();

      if (!property) {
        throw new NotFoundException('Property not found in your organization');
      }

      schedule.property = new Types.ObjectId(updateScheduleDto.property);
    }

    // Handle unit update
    if (updateScheduleDto.clearUnit) {
      schedule.unit = undefined;
    } else if (updateScheduleDto.unit) {
      if (!Types.ObjectId.isValid(updateScheduleDto.unit)) {
        throw new BadRequestException('Invalid unit ID');
      }

      const propertyId = updateScheduleDto.property || schedule.property.toString();
      const unit = await this.unitModel
        .findOne({
          _id: updateScheduleDto.unit,
          landlord: landlordId,
          property: propertyId,
        })
        .exec();

      if (!unit) {
        throw new NotFoundException(
          'Unit not found in your organization or does not belong to this property',
        );
      }

      schedule.unit = new Types.ObjectId(updateScheduleDto.unit);
    }

    // Update other fields
    if (updateScheduleDto.type) schedule.type = updateScheduleDto.type;
    if (updateScheduleDto.scheduledDate) {
      schedule.scheduledDate = new Date(updateScheduleDto.scheduledDate);
    }
    if (updateScheduleDto.scheduledTime !== undefined) {
      schedule.scheduledTime = updateScheduleDto.scheduledTime;
    }
    if (updateScheduleDto.description !== undefined) {
      schedule.description = updateScheduleDto.description;
    }
    if (updateScheduleDto.reminderDaysBefore !== undefined) {
      schedule.reminderDaysBefore = updateScheduleDto.reminderDaysBefore;
    }

    // Handle recurrence update
    if (updateScheduleDto.recurrence) {
      schedule.recurrence = {
        ...updateScheduleDto.recurrence,
        endDate: updateScheduleDto.recurrence.endDate
          ? new Date(updateScheduleDto.recurrence.endDate)
          : undefined,
      };
    }

    // Recalculate next occurrence
    schedule.nextOccurrence = this.calculateNextOccurrence(
      schedule.scheduledDate,
      schedule.recurrence,
    );

    await schedule.save();

    return this.findOne(id, currentUser);
  }

  async remove(id: string, currentUser: User): Promise<void> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid schedule ID');
    }

    const schedule = await this.scheduleModel.findById(id);
    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    // Verify landlord ownership
    const landlordId = this.tenancyContextService.getLandlordContext(currentUser);
    if (schedule.landlord.toString() !== landlordId.toString()) {
      throw new ForbiddenException('You do not have access to this schedule');
    }

    await this.scheduleModel.findByIdAndDelete(id);
  }

  /**
   * Find schedules that need reminders sent
   * Called by the scheduler service
   */
  async findSchedulesNeedingReminders(): Promise<ScheduleDocument[]> {
    const now = new Date();
    const maxDaysBefore = 7; // Max reminder window

    // Calculate the date range for reminders
    const reminderWindowStart = new Date(now);
    const reminderWindowEnd = new Date(now);
    reminderWindowEnd.setDate(reminderWindowEnd.getDate() + maxDaysBefore);

    return this.scheduleModel
      .find({
        $or: [
          // One-time schedules
          {
            scheduledDate: { $gte: reminderWindowStart, $lte: reminderWindowEnd },
            'recurrence.frequency': { $in: [RecurrenceFrequency.NONE, undefined, null] },
          },
          // Recurring schedules
          {
            nextOccurrence: { $gte: reminderWindowStart, $lte: reminderWindowEnd },
            'recurrence.frequency': { $nin: [RecurrenceFrequency.NONE, undefined, null] },
          },
        ],
      })
      .populate('property', 'name')
      .populate('unit', 'unitNumber')
      .exec();
  }

  /**
   * Update last reminder sent timestamp and recalculate next occurrence
   */
  async markReminderSent(scheduleId: string): Promise<void> {
    const schedule = await this.scheduleModel.findById(scheduleId);
    if (!schedule) return;

    schedule.lastReminderSentAt = new Date();

    // For recurring schedules, advance to next occurrence
    if (schedule.recurrence && schedule.recurrence.frequency !== RecurrenceFrequency.NONE) {
      const currentDate = schedule.nextOccurrence || schedule.scheduledDate;
      let nextDate = new Date(currentDate);

      switch (schedule.recurrence.frequency) {
        case RecurrenceFrequency.WEEKLY:
          nextDate.setDate(nextDate.getDate() + 7);
          break;
        case RecurrenceFrequency.BIWEEKLY:
          nextDate.setDate(nextDate.getDate() + 14);
          break;
        case RecurrenceFrequency.MONTHLY:
          nextDate.setMonth(nextDate.getMonth() + 1);
          break;
      }

      // Check if we've passed the end date
      if (schedule.recurrence.endDate && nextDate > schedule.recurrence.endDate) {
        schedule.nextOccurrence = undefined;
      } else {
        schedule.nextOccurrence = nextDate;
      }
    }

    await schedule.save();
  }

  /**
   * Get tenants who should receive reminders for a schedule
   */
  async getTenantsForSchedule(schedule: ScheduleDocument): Promise<string[]> {
    // Find active leases for this property/unit
    const leaseFilter: any = {
      property: schedule.property,
      status: { $in: ['active', 'pending'] },
    };

    if (schedule.unit) {
      leaseFilter.unit = schedule.unit;
    }

    const leases = await this.leaseModel
      .find(leaseFilter)
      .populate({
        path: 'tenant',
        select: '_id',
      })
      .exec();

    // Get unique tenant organization IDs
    const tenantOrgIds = [...new Set(leases.map((l) => l.tenant?._id?.toString()).filter(Boolean))];

    return tenantOrgIds;
  }
}
