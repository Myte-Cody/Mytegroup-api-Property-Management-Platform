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
  CreateSchedulePolicyHandler,
  DeleteSchedulePolicyHandler,
  ReadSchedulePolicyHandler,
  UpdateSchedulePolicyHandler,
} from '../../../common/casl/policies/schedule.policies';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { MongoIdValidationPipe } from '../../../common/pipes/mongo-id-validation.pipe';
import { User } from '../../users/schemas/user.schema';
import { CreateScheduleDto } from '../dto/create-schedule.dto';
import { ScheduleQueryDto } from '../dto/schedule-query.dto';
import { UpdateScheduleDto } from '../dto/update-schedule.dto';
import { SchedulesService } from '../services/schedules.service';

@ApiTags('schedules')
@ApiBearerAuth()
@Controller('schedules')
@UseGuards(CaslGuard)
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Post()
  @CheckPolicies(new CreateSchedulePolicyHandler())
  @ApiOperation({ summary: 'Create a new garbage/recycling schedule' })
  @ApiResponse({ status: 201, description: 'Schedule created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden - Only landlords can create schedules' })
  async create(@Body() createScheduleDto: CreateScheduleDto, @CurrentUser() user: User) {
    const schedule = await this.schedulesService.create(createScheduleDto, user);
    return {
      success: true,
      data: schedule,
    };
  }

  @Get()
  @CheckPolicies(new ReadSchedulePolicyHandler())
  @ApiOperation({ summary: 'Get all schedules with pagination and filters' })
  @ApiResponse({ status: 200, description: 'Schedules retrieved successfully' })
  async findAll(@Query() query: ScheduleQueryDto, @CurrentUser() user: User) {
    const result = await this.schedulesService.findAll(query, user);
    return {
      success: true,
      ...result,
    };
  }

  @Get(':id')
  @CheckPolicies(new ReadSchedulePolicyHandler())
  @ApiOperation({ summary: 'Get a specific schedule by ID' })
  @ApiResponse({ status: 200, description: 'Schedule retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Schedule not found' })
  async findOne(@Param('id', MongoIdValidationPipe) id: string, @CurrentUser() user: User) {
    const schedule = await this.schedulesService.findOne(id, user);
    return {
      success: true,
      data: schedule,
    };
  }

  @Patch(':id')
  @CheckPolicies(new UpdateSchedulePolicyHandler())
  @ApiOperation({ summary: 'Update a schedule' })
  @ApiResponse({ status: 200, description: 'Schedule updated successfully' })
  @ApiResponse({ status: 404, description: 'Schedule not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - Only landlords can update schedules' })
  async update(
    @Param('id', MongoIdValidationPipe) id: string,
    @Body() updateScheduleDto: UpdateScheduleDto,
    @CurrentUser() user: User,
  ) {
    const schedule = await this.schedulesService.update(id, updateScheduleDto, user);
    return {
      success: true,
      data: schedule,
    };
  }

  @Delete(':id')
  @CheckPolicies(new DeleteSchedulePolicyHandler())
  @ApiOperation({ summary: 'Delete a schedule' })
  @ApiResponse({ status: 200, description: 'Schedule deleted successfully' })
  @ApiResponse({ status: 404, description: 'Schedule not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - Only landlords can delete schedules' })
  async remove(@Param('id', MongoIdValidationPipe) id: string, @CurrentUser() user: User) {
    await this.schedulesService.remove(id, user);
    return {
      success: true,
      message: 'Schedule deleted successfully',
    };
  }
}
