import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CheckPolicies } from '../../common/casl/decorators/check-policies.decorator';
import { CaslGuard } from '../../common/casl/guards/casl.guard';
import { ReadLeasePolicyHandler } from '../../common/casl/policies/lease.policies';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { MongoIdValidationPipe } from '../../common/pipes/mongo-id-validation.pipe';
import { User } from '../users/schemas/user.schema';
import { DepositQueryDto } from './dto';
import { DepositsService } from './services/deposits.service';

@ApiTags('Deposits')
@ApiBearerAuth()
@UseGuards(CaslGuard)
@Controller('deposits')
export class DepositsController {
  constructor(private readonly depositsService: DepositsService) {}

  @Get()
  @CheckPolicies(new ReadLeasePolicyHandler())
  @ApiOperation({ summary: 'Get all deposits with pagination and filtering' })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of deposits',
  })
  findAll(@Query() queryDto: DepositQueryDto, @CurrentUser() user: User) {
    return this.depositsService.findAllPaginated(queryDto, user);
  }

  @Get('summary')
  @CheckPolicies(new ReadLeasePolicyHandler())
  @ApiOperation({ summary: 'Get deposit summary statistics' })
  @ApiResponse({
    status: 200,
    description: 'Deposit summary',
  })
  getSummary(@CurrentUser() user: User) {
    return this.depositsService.getSummary(user);
  }

  @Get(':id')
  @CheckPolicies(new ReadLeasePolicyHandler())
  @ApiOperation({ summary: 'Get deposit by lease ID' })
  @ApiParam({ name: 'id', description: 'Lease ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Deposit details',
  })
  findOne(@Param('id', MongoIdValidationPipe) id: string, @CurrentUser() user: User) {
    return this.depositsService.findOne(id, user);
  }
}
