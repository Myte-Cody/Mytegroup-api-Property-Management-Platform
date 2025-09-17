import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { 
  ApiBearerAuth, 
  ApiOperation, 
  ApiParam, 
  ApiResponse,
  ApiTags 
} from '@nestjs/swagger';
import { CheckPolicies } from '../../common/casl/decorators/check-policies.decorator';
import { CaslGuard } from '../../common/casl/guards/casl.guard';
import { ReadRentalPeriodPolicyHandler } from '../../common/casl/policies/rental-period.policies';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { MongoIdValidationPipe } from '../../common/pipes/mongo-id-validation.pipe';
import { User } from '../users/schemas/user.schema';
import { 
  PaginatedRentalPeriodsResponseDto,
  RentHistoryResponseDto,
  RentalPeriodQueryDto,
  RentalPeriodResponseDto,
} from './dto';
import { RentalPeriodsService } from './services/rental-periods.service';

@ApiTags('RentalPeriods')
@ApiBearerAuth()
@UseGuards(CaslGuard)
@Controller('rental-periods')
export class RentalPeriodsController {
  constructor(
    private readonly rentalPeriodsService: RentalPeriodsService,
  ) {}

  @Get()
  @CheckPolicies(new ReadRentalPeriodPolicyHandler())
  @ApiOperation({ summary: 'Get all rental periods with pagination, filtering, and sorting' })
  @ApiResponse({ 
    status: 200, 
    description: 'Paginated list of rental periods',
    type: PaginatedRentalPeriodsResponseDto,
  })
  findAll(@Query() queryDto: RentalPeriodQueryDto, @CurrentUser() user: User) {
    return this.rentalPeriodsService.findAllPaginated(queryDto, user);
  }

  @Get(':id')
  @CheckPolicies(new ReadRentalPeriodPolicyHandler())
  @ApiOperation({ summary: 'Get rental period by ID' })
  @ApiParam({ name: 'id', description: 'RentalPeriod ID', type: String })
  @ApiResponse({ 
    status: 200, 
    description: 'RentalPeriod details',
    type: RentalPeriodResponseDto,
  })
  findOne(@Param('id', MongoIdValidationPipe) id: string, @CurrentUser() user: User) {
    return this.rentalPeriodsService.findOne(id, user);
  }

  @Get('lease/:leaseId')
  @CheckPolicies(new ReadRentalPeriodPolicyHandler())
  @ApiOperation({ summary: 'Get all rental periods for a specific lease' })
  @ApiParam({ name: 'leaseId', description: 'Lease ID', type: String })
  @ApiResponse({ 
    status: 200, 
    description: 'List of rental periods for the lease',
    type: [RentalPeriodResponseDto],
  })
  findByLease(
    @Param('leaseId', MongoIdValidationPipe) leaseId: string, 
    @CurrentUser() user: User
  ) {
    return this.rentalPeriodsService.findByLease(leaseId, user);
  }

  @Get('lease/:leaseId/current')
  @CheckPolicies(new ReadRentalPeriodPolicyHandler())
  @ApiOperation({ summary: 'Get current active rental period for a lease' })
  @ApiParam({ name: 'leaseId', description: 'Lease ID', type: String })
  @ApiResponse({ 
    status: 200, 
    description: 'Current active rental period',
    type: RentalPeriodResponseDto,
  })
  getCurrentRentalPeriod(
    @Param('leaseId', MongoIdValidationPipe) leaseId: string, 
    @CurrentUser() user: User
  ) {
    return this.rentalPeriodsService.getCurrentRentalPeriod(leaseId, user);
  }

  @Get('lease/:leaseId/rent-history')
  @CheckPolicies(new ReadRentalPeriodPolicyHandler())
  @ApiOperation({ summary: 'Get rent history analytics for a lease' })
  @ApiParam({ name: 'leaseId', description: 'Lease ID', type: String })
  @ApiResponse({ 
    status: 200, 
    description: 'Rent history with analytics',
    type: RentHistoryResponseDto,
  })
  getRentHistory(
    @Param('leaseId', MongoIdValidationPipe) leaseId: string, 
    @CurrentUser() user: User
  ) {
    return this.rentalPeriodsService.getRentHistory(leaseId, user);
  }

  @Get(':id/renewal-chain')
  @CheckPolicies(new ReadRentalPeriodPolicyHandler())
  @ApiOperation({ summary: 'Get complete renewal chain for a rental period' })
  @ApiParam({ name: 'id', description: 'RentalPeriod ID', type: String })
  @ApiResponse({ 
    status: 200, 
    description: 'Complete renewal chain from root to current',
    type: [RentalPeriodResponseDto],
  })
  getRenewalChain(
    @Param('id', MongoIdValidationPipe) id: string, 
    @CurrentUser() user: User
  ) {
    return this.rentalPeriodsService.findRenewalChain(id, user);
  }
}