import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { NotificationType } from '@shared/notification-types';
import { ClientSession } from 'mongoose';
import { LeaseStatus } from '../../../common/enums/lease.enum';
import { TaskPriority, TaskStatus } from '../../../common/enums/task.enum';
import { AppModel } from '../../../common/interfaces/app-model.interface';
import { TenancyContextService } from '../../../common/services/tenancy-context.service';
import { createPaginatedResponse } from '../../../common/utils/pagination.utils';
import { Lease } from '../../leases/schemas/lease.schema';
import { NotificationDispatcherService } from '../../notifications/notification-dispatcher.service';
import { Property } from '../../properties/schemas/property.schema';
import { Unit } from '../../properties/schemas/unit.schema';
import { Tenant } from '../../tenants/schema/tenant.schema';
import { User, UserDocument } from '../../users/schemas/user.schema';
import { CreateTaskDto, TaskQueryDto, UpdateTaskDto } from '../dto';
import { Task, TaskDocument } from '../schemas/task.schema';
import { SessionService } from './../../../common/services/session.service';

@Injectable()
export class TasksService {
  constructor(
    @InjectModel(Task.name)
    private readonly taskModel: AppModel<Task>,
    @InjectModel(Property.name)
    private readonly propertyModel: AppModel<Property>,
    @InjectModel(Unit.name)
    private readonly unitModel: AppModel<Unit>,
    @InjectModel(Tenant.name)
    private readonly tenantModel: AppModel<Tenant>,
    @InjectModel(Lease.name)
    private readonly leaseModel: AppModel<Lease>,
    @InjectModel(User.name)
    private readonly userModel: AppModel<User>,
    private readonly sessionService: SessionService,
    private readonly notificationDispatcher: NotificationDispatcherService,
    private readonly tenancyContextService: TenancyContextService,
  ) {}

  async findAllPaginated(queryDto: TaskQueryDto, currentUser: UserDocument) {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      status,
      priority,
      isEscalated,
      propertyId,
      unitId,
      tenantId,
      startDate,
      endDate,
    } = queryDto;

    let baseQuery = this.taskModel.find();

    // Apply landlord scope for landlord users
    if (this.tenancyContextService.isLandlord(currentUser)) {
      const landlordId = this.tenancyContextService.getLandlordContext(currentUser);
      baseQuery = baseQuery.where({ landlord: landlordId });
    }

    // Handle tenant filtering - tenants can only see tasks linked to them or their units
    if (currentUser.user_type === 'Tenant') {
      const activeLeases = await this.leaseModel
        .find({
          tenant: currentUser.organization_id,
          status: LeaseStatus.ACTIVE,
        })
        .exec();

      const unitIds = activeLeases.map((lease) => lease.unit);
      const filterConditions: any[] = [];

      // Tasks linked directly to tenant
      filterConditions.push({ tenant: currentUser.organization_id });

      // Tasks linked to their active lease units
      if (unitIds.length > 0) {
        filterConditions.push({ unit: { $in: unitIds } });
      }

      if (filterConditions.length > 0) {
        baseQuery = baseQuery.where({ $or: filterConditions });
      } else {
        baseQuery = baseQuery.where({ _id: null });
      }
    }

    // Apply filters
    if (search) {
      baseQuery = baseQuery.where({
        $or: [
          { title: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
        ],
      });
    }

    if (status) {
      baseQuery = baseQuery.where({ status });
    }

    if (priority) {
      baseQuery = baseQuery.where({ priority });
    }

    if (isEscalated !== undefined) {
      baseQuery = baseQuery.where({ isEscalated });
    }

    if (propertyId) {
      baseQuery = baseQuery.where({ property: propertyId });
    }

    if (unitId) {
      baseQuery = baseQuery.where({ unit: unitId });
    }

    if (tenantId) {
      baseQuery = baseQuery.where({ tenant: tenantId });
    }

    if (startDate || endDate) {
      const dateFilter: any = {};
      if (startDate) dateFilter.$gte = startDate;
      if (endDate) dateFilter.$lte = endDate;
      baseQuery = baseQuery.where({ createdAt: dateFilter });
    }

    const sortObj: Record<string, 1 | -1> = {};
    sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const skip = (page - 1) * limit;

    const [tasks, total] = await Promise.all([
      baseQuery
        .clone()
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .populate('property', 'name address')
        .populate('unit', 'unitNumber type')
        .populate('tenant', 'name')
        .populate('createdBy', 'username email firstName lastName')
        .populate('assignedParty', 'username email firstName lastName')
        .exec(),
      baseQuery.clone().countDocuments().exec(),
    ]);

    return createPaginatedResponse(tasks, total, page, limit);
  }

  async findOne(id: string, currentUser: UserDocument): Promise<TaskDocument> {
    const task = await this.taskModel
      .findById(id)
      .populate('property', 'name address')
      .populate('unit', 'unitNumber type')
      .populate('tenant', 'name')
      .populate('createdBy', 'username email firstName lastName')
      .populate('assignedParty', 'username email firstName lastName')
      .exec();

    if (!task) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }

    // Verify access for tenants
    if (currentUser.user_type === 'Tenant') {
      const hasAccess = await this.tenantHasAccessToTask(task, currentUser);
      if (!hasAccess) {
        throw new ForbiddenException('You do not have access to this task');
      }
    }

    return task;
  }

  async create(createTaskDto: CreateTaskDto, currentUser: UserDocument): Promise<TaskDocument> {
    return this.sessionService.withSession(async (session: ClientSession | null) => {
      // Only landlords can create tasks
      if (currentUser.user_type !== 'Landlord') {
        throw new ForbiddenException('Only landlords can create tasks');
      }

      // Validate property exists
      const property = await this.propertyModel
        .findById(createTaskDto.property, null, { session })
        .exec();
      if (!property) {
        throw new NotFoundException('Property not found');
      }

      // Validate unit if provided
      if (createTaskDto.unit) {
        const unit = await this.unitModel.findById(createTaskDto.unit, null, { session }).exec();
        if (!unit) {
          throw new NotFoundException('Unit not found');
        }
        if (unit.property.toString() !== createTaskDto.property) {
          throw new BadRequestException('Unit does not belong to the specified property');
        }
      }

      // Validate tenant if provided
      if (createTaskDto.tenant) {
        const tenant = await this.tenantModel
          .findById(createTaskDto.tenant, null, { session })
          .exec();
        if (!tenant) {
          throw new NotFoundException('Tenant not found');
        }
      }

      const landlordId = this.tenancyContextService.getLandlordContext(currentUser);

      const newTask = new this.taskModel({
        ...createTaskDto,
        landlord: landlordId,
        createdBy: currentUser._id,
        status: TaskStatus.OPEN,
        priority: createTaskDto.priority || TaskPriority.MEDIUM,
        isEscalated: false,
      });

      const task = await newTask.save({ session });

      // Send notifications
      await this.notifyOnTaskCreate(task, currentUser);

      return task;
    });
  }

  async update(
    id: string,
    updateTaskDto: UpdateTaskDto,
    currentUser: UserDocument,
  ): Promise<TaskDocument> {
    return this.sessionService.withSession(async (session: ClientSession) => {
      // Only landlords can update tasks
      if (currentUser.user_type !== 'Landlord') {
        throw new ForbiddenException('Only landlords can update tasks');
      }

      if (!updateTaskDto || Object.keys(updateTaskDto).length === 0) {
        throw new BadRequestException('Update data cannot be empty');
      }

      const existingTask = await this.taskModel.findById(id, null, { session }).exec();

      if (!existingTask) {
        throw new NotFoundException(`Task with ID ${id} not found`);
      }

      const oldStatus = existingTask.status;
      const oldEscalation = existingTask.isEscalated;

      // Validate status transition if status is being changed
      if (updateTaskDto.status && updateTaskDto.status !== existingTask.status) {
        this.validateStatusTransition(existingTask.status, updateTaskDto.status);
      }

      Object.assign(existingTask, updateTaskDto);
      const savedTask = await existingTask.save({ session });

      // Notify on status change
      if (updateTaskDto.status && updateTaskDto.status !== oldStatus) {
        await this.notifyOnStatusChange(savedTask, oldStatus, currentUser);
      }

      // Notify on escalation change
      if (updateTaskDto.isEscalated !== undefined && updateTaskDto.isEscalated !== oldEscalation) {
        await this.notifyOnEscalationChange(savedTask, currentUser);
      }

      return savedTask;
    });
  }

  async remove(id: string, currentUser: UserDocument): Promise<{ message: string }> {
    // Only landlords can delete tasks
    if (currentUser.user_type !== 'Landlord') {
      throw new ForbiddenException('Only landlords can delete tasks');
    }

    const task = await this.taskModel.findById(id).exec();

    if (!task) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }

    await this.taskModel.findByIdAndDelete(id);
    return { message: 'Task deleted successfully' };
  }

  async toggleEscalation(id: string, currentUser: UserDocument): Promise<TaskDocument> {
    // Only landlords can toggle escalation
    if (currentUser.user_type !== 'Landlord') {
      throw new ForbiddenException('Only landlords can toggle escalation');
    }

    const task = await this.taskModel.findById(id).exec();

    if (!task) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }

    task.isEscalated = !task.isEscalated;
    const savedTask = await task.save();

    await this.notifyOnEscalationChange(savedTask, currentUser);

    return savedTask;
  }

  async completeTask(id: string, currentUser: UserDocument): Promise<TaskDocument> {
    return this.update(id, { status: TaskStatus.COMPLETED }, currentUser);
  }

  async cancelTask(id: string, currentUser: UserDocument): Promise<TaskDocument> {
    return this.update(id, { status: TaskStatus.CANCELED }, currentUser);
  }

  // Private helper methods

  private validateStatusTransition(currentStatus: TaskStatus, newStatus: TaskStatus): void {
    const validTransitions: Record<TaskStatus, TaskStatus[]> = {
      [TaskStatus.OPEN]: [TaskStatus.IN_PROGRESS, TaskStatus.COMPLETED, TaskStatus.CANCELED],
      [TaskStatus.IN_PROGRESS]: [TaskStatus.COMPLETED, TaskStatus.CANCELED],
      [TaskStatus.COMPLETED]: [TaskStatus.OPEN], // Can reopen
      [TaskStatus.CANCELED]: [], // Terminal state
    };

    if (!validTransitions[currentStatus].includes(newStatus)) {
      throw new BadRequestException(
        `Invalid status transition from ${currentStatus} to ${newStatus}`,
      );
    }
  }

  private async tenantHasAccessToTask(
    task: TaskDocument,
    currentUser: UserDocument,
  ): Promise<boolean> {
    // Tenant linked directly
    if (task.tenant && task.tenant.toString() === currentUser.organization_id.toString()) {
      return true;
    }

    // Check if tenant has active lease for the unit
    if (task.unit) {
      const activeLease = await this.leaseModel
        .findOne({
          tenant: currentUser.organization_id,
          unit: task.unit,
          status: LeaseStatus.ACTIVE,
        })
        .exec();

      if (activeLease) {
        return true;
      }
    }

    return false;
  }

  private async notifyOnTaskCreate(task: TaskDocument, currentUser: UserDocument): Promise<void> {
    try {
      // Notify landlord users (in case there are multiple)
      const landlordUsers = await this.userModel
        .find({
          organization_id: task.landlord,
          user_type: 'Landlord',
        })
        .exec();

      for (const landlordUser of landlordUsers) {
        if (landlordUser._id.toString() !== currentUser._id.toString()) {
          await this.notificationDispatcher.sendInAppNotification(
            landlordUser._id.toString(),
            NotificationType.TASK_CREATED,
            'New Task Created',
            `New task "${task.title}" has been created.`,
            `/dashboard/landlord/tasks/${task._id}`,
          );
        }
      }

      // Notify linked tenant if exists
      if (task.tenant) {
        const tenantUsers = await this.userModel
          .find({
            organization_id: task.tenant,
            user_type: 'Tenant',
          })
          .exec();

        for (const tenantUser of tenantUsers) {
          await this.notificationDispatcher.sendInAppNotification(
            tenantUser._id.toString(),
            NotificationType.TASK_CREATED,
            'New Task',
            `A new task "${task.title}" has been created for your attention.`,
            `/dashboard/tenant/tasks/${task._id}`,
          );
        }
      }
    } catch (error) {
      console.error('Failed to send task create notification:', error);
    }
  }

  private async notifyOnStatusChange(
    task: TaskDocument,
    oldStatus: TaskStatus,
    currentUser: UserDocument,
  ): Promise<void> {
    try {
      const notificationType =
        task.status === TaskStatus.COMPLETED
          ? NotificationType.TASK_COMPLETED
          : task.status === TaskStatus.CANCELED
            ? NotificationType.TASK_CANCELED
            : NotificationType.TASK_STATUS_CHANGED;

      const statusLabel =
        task.status === TaskStatus.COMPLETED
          ? 'Completed'
          : task.status === TaskStatus.CANCELED
            ? 'Canceled'
            : task.status === TaskStatus.IN_PROGRESS
              ? 'In Progress'
              : 'Open';

      // Notify landlord users
      const landlordUsers = await this.userModel
        .find({
          organization_id: task.landlord,
          user_type: 'Landlord',
        })
        .exec();

      for (const landlordUser of landlordUsers) {
        if (landlordUser._id.toString() !== currentUser._id.toString()) {
          await this.notificationDispatcher.sendInAppNotification(
            landlordUser._id.toString(),
            notificationType,
            `Task ${statusLabel}`,
            `Task "${task.title}" status changed to ${statusLabel}.`,
            `/dashboard/landlord/tasks/${task._id}`,
          );
        }
      }

      // Notify linked tenant if exists
      if (task.tenant) {
        const tenantUsers = await this.userModel
          .find({
            organization_id: task.tenant,
            user_type: 'Tenant',
          })
          .exec();

        for (const tenantUser of tenantUsers) {
          await this.notificationDispatcher.sendInAppNotification(
            tenantUser._id.toString(),
            notificationType,
            `Task ${statusLabel}`,
            `Task "${task.title}" status changed to ${statusLabel}.`,
            `/dashboard/tenant/tasks/${task._id}`,
          );
        }
      }
    } catch (error) {
      console.error('Failed to send task status change notification:', error);
    }
  }

  private async notifyOnEscalationChange(
    task: TaskDocument,
    currentUser: UserDocument,
  ): Promise<void> {
    try {
      const title = task.isEscalated ? 'Task Escalated' : 'Task De-escalated';
      const message = task.isEscalated
        ? `Task "${task.title}" has been escalated and requires urgent attention.`
        : `Task "${task.title}" escalation has been removed.`;

      // Notify landlord users
      const landlordUsers = await this.userModel
        .find({
          organization_id: task.landlord,
          user_type: 'Landlord',
        })
        .exec();

      for (const landlordUser of landlordUsers) {
        if (landlordUser._id.toString() !== currentUser._id.toString()) {
          await this.notificationDispatcher.sendInAppNotification(
            landlordUser._id.toString(),
            NotificationType.TASK_ESCALATED,
            title,
            message,
            `/dashboard/landlord/tasks/${task._id}`,
          );
        }
      }

      // Notify linked tenant if task is escalated
      if (task.isEscalated && task.tenant) {
        const tenantUsers = await this.userModel
          .find({
            organization_id: task.tenant,
            user_type: 'Tenant',
          })
          .exec();

        for (const tenantUser of tenantUsers) {
          await this.notificationDispatcher.sendInAppNotification(
            tenantUser._id.toString(),
            NotificationType.TASK_ESCALATED,
            title,
            `Task "${task.title}" has been marked as urgent.`,
            `/dashboard/tenant/tasks/${task._id}`,
          );
        }
      }
    } catch (error) {
      console.error('Failed to send task escalation notification:', error);
    }
  }
}
