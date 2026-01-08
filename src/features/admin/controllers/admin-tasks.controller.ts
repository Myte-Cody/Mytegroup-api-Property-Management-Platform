import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { MongoIdValidationPipe } from '../../../common/pipes/mongo-id-validation.pipe';
import { AdminMaintenanceQueryDto } from '../dto/admin-query.dto';
import { AdminOnlyGuard } from '../guards/admin-only.guard';
import { AdminTasksService } from '../services/admin-tasks.service';

@ApiTags('Admin - Tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminOnlyGuard)
@Controller('admin')
export class AdminTasksController {
  constructor(private readonly adminTasksService: AdminTasksService) {}

  @Get('tasks')
  @ApiOperation({ summary: 'Get all tasks across all landlords' })
  @ApiResponse({
    status: 200,
    description: 'Tasks retrieved successfully',
  })
  async getTasks(@Query() queryDto: AdminMaintenanceQueryDto) {
    return this.adminTasksService.findAllTasks(queryDto);
  }

  @Get('tasks/:id')
  @ApiOperation({ summary: 'Get task by ID' })
  @ApiParam({ name: 'id', description: 'Task ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Task retrieved successfully',
  })
  async getTaskById(@Param('id', MongoIdValidationPipe) id: string) {
    return this.adminTasksService.findTaskById(id);
  }
}
