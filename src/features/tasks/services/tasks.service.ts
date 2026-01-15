import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { NotificationType } from '@shared/notification-types';
import { ClientSession } from 'mongoose';
import { TaskPriority, TaskStatus } from '../../../common/enums/task.enum';
import { AppModel } from '../../../common/interfaces/app-model.interface';
import { TenancyContextService } from '../../../common/services/tenancy-context.service';
import { createPaginatedResponse } from '../../../common/utils/pagination.utils';
import { NotificationDispatcherService } from '../../notifications/notification-dispatcher.service';
import { Property } from '../../properties/schemas/property.schema';
import { Unit } from '../../properties/schemas/unit.schema';
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
      startDate,
      endDate,
    } = queryDto;

    let baseQuery = this.taskModel.find();

    // Each user sees only tasks they created
    baseQuery = baseQuery.where({ createdBy: currentUser._id });

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
      .populate('createdBy', 'username email firstName lastName')
      .populate('assignedParty', 'username email firstName lastName')
      .populate('statusLogs.changedBy', 'username email firstName lastName')
      .exec();

    if (!task) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }

    // Verify access - users can only view their own tasks
    if (task.createdBy.toString() !== currentUser._id.toString()) {
      const createdByUser = task.createdBy as any;
      if (createdByUser?._id?.toString() !== currentUser._id.toString()) {
        throw new ForbiddenException('You do not have access to this task');
      }
    }

    return task;
  }

  async create(createTaskDto: CreateTaskDto, currentUser: UserDocument): Promise<TaskDocument> {
    return this.sessionService.withSession(async (session: ClientSession | null) => {
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

      // Get landlord context based on user type
      let landlordId;
      if (this.tenancyContextService.isLandlord(currentUser)) {
        landlordId = this.tenancyContextService.getLandlordContext(currentUser);
      } else {
        // For tenants and contractors, use the property's landlord
        landlordId = property.landlord;
      }

      const newTask = new this.taskModel({
        ...createTaskDto,
        landlord: landlordId,
        createdBy: currentUser._id,
        status: TaskStatus.OPEN,
        priority: createTaskDto.priority || TaskPriority.MEDIUM,
        isEscalated: false,
      });

      const task = await newTask.save({ session });

      // Send notification to the user who created the task
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
      if (!updateTaskDto || Object.keys(updateTaskDto).length === 0) {
        throw new BadRequestException('Update data cannot be empty');
      }

      const existingTask = await this.taskModel.findById(id, null, { session }).exec();

      if (!existingTask) {
        throw new NotFoundException(`Task with ID ${id} not found`);
      }

      // Users can only update their own tasks
      if (existingTask.createdBy.toString() !== currentUser._id.toString()) {
        throw new ForbiddenException('You can only update your own tasks');
      }

      const oldStatus = existingTask.status;
      const oldEscalation = existingTask.isEscalated;

      // Log status change if status is being updated
      if (updateTaskDto.status && updateTaskDto.status !== existingTask.status) {
        existingTask.statusLogs.push({
          fromStatus: existingTask.status,
          toStatus: updateTaskDto.status,
          changedBy: currentUser._id,
          changedAt: new Date(),
        });
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
    const task = await this.taskModel.findById(id).exec();

    if (!task) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }

    // Users can only delete their own tasks
    if (task.createdBy.toString() !== currentUser._id.toString()) {
      throw new ForbiddenException('You can only delete your own tasks');
    }

    await this.taskModel.findByIdAndDelete(id);
    return { message: 'Task deleted successfully' };
  }

  async toggleEscalation(id: string, currentUser: UserDocument): Promise<TaskDocument> {
    const task = await this.taskModel.findById(id).exec();

    if (!task) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }

    // Users can only toggle escalation on their own tasks
    if (task.createdBy.toString() !== currentUser._id.toString()) {
      throw new ForbiddenException('You can only modify your own tasks');
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

  private async notifyOnTaskCreate(task: TaskDocument, currentUser: UserDocument): Promise<void> {
    try {
      // Determine the dashboard path based on user type
      const dashboardPath = this.getDashboardPath(currentUser);

      // Notify the user who created the task (confirmation)
      await this.notificationDispatcher.sendInAppNotification(
        currentUser._id.toString(),
        NotificationType.TASK_CREATED,
        'Task Created',
        `Your task "${task.title}" has been created.`,
        `${dashboardPath}/tasks/${task._id}`,
      );
    } catch (error) {
      console.error('Failed to send task create notification:', error);
    }
  }

  private async notifyOnStatusChange(
    task: TaskDocument,
    _oldStatus: TaskStatus,
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

      const dashboardPath = this.getDashboardPath(currentUser);

      await this.notificationDispatcher.sendInAppNotification(
        currentUser._id.toString(),
        notificationType,
        `Task ${statusLabel}`,
        `Task "${task.title}" status changed to ${statusLabel}.`,
        `${dashboardPath}/tasks/${task._id}`,
      );
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

      const dashboardPath = this.getDashboardPath(currentUser);

      await this.notificationDispatcher.sendInAppNotification(
        currentUser._id.toString(),
        NotificationType.TASK_ESCALATED,
        title,
        message,
        `${dashboardPath}/tasks/${task._id}`,
      );
    } catch (error) {
      console.error('Failed to send task escalation notification:', error);
    }
  }

  private getDashboardPath(user: UserDocument): string {
    switch (user.user_type) {
      case 'Landlord':
        return '/dashboard/landlord';
      case 'Tenant':
        return '/dashboard/tenant';
      case 'Contractor':
        return '/dashboard/contractor';
      default:
        return '/dashboard';
    }
  }
}
