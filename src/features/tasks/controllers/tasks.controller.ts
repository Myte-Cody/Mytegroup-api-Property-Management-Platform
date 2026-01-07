import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CheckPolicies } from '../../../common/casl/decorators/check-policies.decorator';
import { CaslGuard } from '../../../common/casl/guards/casl.guard';
import {
  CreateTaskPolicyHandler,
  DeleteTaskPolicyHandler,
  ReadTaskPolicyHandler,
  UpdateTaskPolicyHandler,
} from '../../../common/casl/policies/task.policies';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { User } from '../../users/schemas/user.schema';
import { CreateTaskDto, TaskQueryDto, UpdateTaskDto } from '../dto';
import { TasksService } from '../services/tasks.service';

@ApiTags('Tasks')
@ApiBearerAuth()
@UseGuards(CaslGuard)
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @CheckPolicies(new CreateTaskPolicyHandler())
  @ApiOperation({ summary: 'Create a new task' })
  @ApiResponse({ status: 201, description: 'Task created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden - Only landlords can create tasks' })
  async create(@Body() createTaskDto: CreateTaskDto, @CurrentUser() user: User) {
    return this.tasksService.create(createTaskDto, user);
  }

  @Get()
  @CheckPolicies(new ReadTaskPolicyHandler())
  @ApiOperation({ summary: 'Get all tasks with pagination and filtering' })
  @ApiResponse({ status: 200, description: 'Tasks retrieved successfully' })
  async findAll(@Query() query: TaskQueryDto, @CurrentUser() user: User) {
    return this.tasksService.findAllPaginated(query, user);
  }

  @Get(':id')
  @CheckPolicies(new ReadTaskPolicyHandler())
  @ApiOperation({ summary: 'Get a specific task by ID' })
  @ApiResponse({ status: 200, description: 'Task found' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async findOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.tasksService.findOne(id, user);
  }

  @Patch(':id')
  @CheckPolicies(new UpdateTaskPolicyHandler())
  @ApiOperation({ summary: 'Update a task' })
  @ApiResponse({ status: 200, description: 'Task updated successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden - Only landlords can update tasks' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async update(
    @Param('id') id: string,
    @Body() updateTaskDto: UpdateTaskDto,
    @CurrentUser() user: User,
  ) {
    return this.tasksService.update(id, updateTaskDto, user);
  }

  @Delete(':id')
  @CheckPolicies(new DeleteTaskPolicyHandler())
  @ApiOperation({ summary: 'Delete a task' })
  @ApiResponse({ status: 200, description: 'Task deleted successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Only landlords can delete tasks' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async remove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.tasksService.remove(id, user);
  }

  @Post(':id/escalate')
  @CheckPolicies(new UpdateTaskPolicyHandler())
  @ApiOperation({ summary: 'Toggle task escalation flag' })
  @ApiResponse({ status: 200, description: 'Escalation toggled successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Only landlords can toggle escalation' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async toggleEscalation(@Param('id') id: string, @CurrentUser() user: User) {
    return this.tasksService.toggleEscalation(id, user);
  }

  @Post(':id/complete')
  @CheckPolicies(new UpdateTaskPolicyHandler())
  @ApiOperation({ summary: 'Mark a task as completed' })
  @ApiResponse({ status: 200, description: 'Task marked as completed' })
  @ApiResponse({ status: 400, description: 'Invalid status transition' })
  @ApiResponse({ status: 403, description: 'Forbidden - Only landlords can complete tasks' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async complete(@Param('id') id: string, @CurrentUser() user: User) {
    return this.tasksService.completeTask(id, user);
  }

  @Post(':id/cancel')
  @CheckPolicies(new UpdateTaskPolicyHandler())
  @ApiOperation({ summary: 'Cancel a task' })
  @ApiResponse({ status: 200, description: 'Task canceled successfully' })
  @ApiResponse({ status: 400, description: 'Invalid status transition' })
  @ApiResponse({ status: 403, description: 'Forbidden - Only landlords can cancel tasks' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async cancel(@Param('id') id: string, @CurrentUser() user: User) {
    return this.tasksService.cancelTask(id, user);
  }
}
