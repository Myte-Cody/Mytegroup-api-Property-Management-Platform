import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CheckPolicies } from '../../common/casl/decorators/check-policies.decorator';
import { CaslGuard } from '../../common/casl/guards/casl.guard';
import {
  CreateAvailabilityPolicyHandler,
  DeleteAvailabilityPolicyHandler,
  ReadAvailabilityPolicyHandler,
  UpdateAvailabilityPolicyHandler,
} from '../../common/casl/policies/availability.policies';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { MongoIdValidationPipe } from '../../common/pipes/mongo-id-validation.pipe';
import { User } from '../users/schemas/user.schema';
import { AvailabilityQueryDto, CreateAvailabilityDto, UpdateAvailabilityDto } from './dto';
import { AvailabilityService } from './availability.service';

@ApiTags('Availability')
@ApiBearerAuth()
@UseGuards(CaslGuard)
@Controller('availability')
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @Post()
  @CheckPolicies(new CreateAvailabilityPolicyHandler())
  @ApiOperation({ summary: 'Create a new availability slot' })
  @ApiBody({ type: CreateAvailabilityDto })
  create(@CurrentUser() user: User, @Body() createDto: CreateAvailabilityDto) {
    return this.availabilityService.create(createDto, user);
  }

  @Get()
  @CheckPolicies(new ReadAvailabilityPolicyHandler())
  @ApiOperation({ summary: 'Get all availability slots' })
  findAll(@Query() queryDto: AvailabilityQueryDto, @CurrentUser() user: User) {
    return this.availabilityService.findAll(queryDto, user);
  }

  @Get('weekly-schedule')
  @CheckPolicies(new ReadAvailabilityPolicyHandler())
  @ApiOperation({ summary: 'Get weekly recurring schedule' })
  @ApiQuery({ name: 'propertyId', required: false, description: 'Filter by property ID' })
  @ApiQuery({ name: 'unitId', required: false, description: 'Filter by unit ID' })
  getWeeklySchedule(
    @Query('propertyId') propertyId: string,
    @Query('unitId') unitId: string,
    @CurrentUser() user: User,
  ) {
    return this.availabilityService.getWeeklySchedule(user, propertyId, unitId);
  }

  @Get('date/:date')
  @CheckPolicies(new ReadAvailabilityPolicyHandler())
  @ApiOperation({ summary: 'Get availability for a specific date' })
  @ApiParam({ name: 'date', description: 'Date in YYYY-MM-DD format', example: '2024-03-15' })
  @ApiQuery({ name: 'propertyId', required: false, description: 'Filter by property ID' })
  @ApiQuery({ name: 'unitId', required: false, description: 'Filter by unit ID' })
  getAvailabilityForDate(
    @Param('date') dateStr: string,
    @Query('propertyId') propertyId: string,
    @Query('unitId') unitId: string,
    @CurrentUser() user: User,
  ) {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      throw new Error('Invalid date format. Use YYYY-MM-DD.');
    }
    return this.availabilityService.getAvailabilityForDate(date, user, propertyId, unitId);
  }

  @Get('visit-request/:date')
  @CheckPolicies(new ReadAvailabilityPolicyHandler())
  @ApiOperation({
    summary: 'Get availability slots for visit request (contractors)',
    description:
      'Returns availability slots based on unit occupancy: tenant slots for occupied units, landlord slots for vacant units or property-level',
  })
  @ApiParam({ name: 'date', description: 'Date in YYYY-MM-DD format', example: '2024-03-15' })
  @ApiQuery({ name: 'propertyId', required: true, description: 'Property ID (required)' })
  @ApiQuery({ name: 'unitId', required: false, description: 'Unit ID (optional)' })
  getAvailabilityForVisitRequest(
    @Param('date') dateStr: string,
    @Query('propertyId') propertyId: string,
    @Query('unitId') unitId: string,
  ) {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      throw new Error('Invalid date format. Use YYYY-MM-DD.');
    }
    if (!propertyId) {
      throw new Error('Property ID is required');
    }
    return this.availabilityService.getAvailabilityForVisitRequest(date, propertyId, unitId);
  }

  @Get('unit/:unitId')
  @CheckPolicies(new ReadAvailabilityPolicyHandler())
  @ApiOperation({ summary: 'Get all availability for a specific unit (landlords only)' })
  @ApiParam({ name: 'unitId', description: 'Unit ID' })
  getByUnit(
    @Param('unitId', MongoIdValidationPipe) unitId: string,
    @CurrentUser() user: User,
  ) {
    return this.availabilityService.getByUnit(unitId, user);
  }

  @Get('property/:propertyId')
  @CheckPolicies(new ReadAvailabilityPolicyHandler())
  @ApiOperation({ summary: 'Get all availability for a specific property (landlords only)' })
  @ApiParam({ name: 'propertyId', description: 'Property ID' })
  getByProperty(
    @Param('propertyId', MongoIdValidationPipe) propertyId: string,
    @CurrentUser() user: User,
  ) {
    return this.availabilityService.getByProperty(propertyId, user);
  }

  @Get(':id')
  @CheckPolicies(new ReadAvailabilityPolicyHandler())
  @ApiOperation({ summary: 'Get availability slot by ID' })
  @ApiParam({ name: 'id', description: 'Availability slot ID' })
  findOne(@Param('id', MongoIdValidationPipe) id: string, @CurrentUser() user: User) {
    return this.availabilityService.findOne(id, user);
  }

  @Patch(':id')
  @CheckPolicies(new UpdateAvailabilityPolicyHandler())
  @ApiOperation({ summary: 'Update availability slot (can only edit own availability)' })
  @ApiParam({ name: 'id', description: 'Availability slot ID' })
  @ApiBody({ type: UpdateAvailabilityDto })
  update(
    @Param('id', MongoIdValidationPipe) id: string,
    @CurrentUser() user: User,
    @Body() updateDto: UpdateAvailabilityDto,
  ) {
    return this.availabilityService.update(id, updateDto, user);
  }

  @Delete(':id')
  @CheckPolicies(new DeleteAvailabilityPolicyHandler())
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete availability slot (can only delete own availability)' })
  @ApiParam({ name: 'id', description: 'Availability slot ID' })
  remove(@Param('id', MongoIdValidationPipe) id: string, @CurrentUser() user: User) {
    return this.availabilityService.remove(id, user);
  }
}
