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
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CheckPolicies } from '../../common/casl/decorators/check-policies.decorator';
import { CaslGuard } from '../../common/casl/guards/casl.guard';
import {
  CreateTransactionPolicyHandler,
  DeleteTransactionPolicyHandler,
  ReadTransactionPolicyHandler,
  UpdateTransactionPolicyHandler,
} from '../../common/casl/policies/transaction.policies';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { MongoIdValidationPipe } from '../../common/pipes/mongo-id-validation.pipe';
import { User } from '../users/schemas/user.schema';
import {
  CreateRevenueDto,
  PaginatedRevenuesResponseDto,
  RevenueQueryDto,
  RevenueResponseDto,
  RevenueSummaryDto,
  UpdateRevenueDto,
} from './dto';
import { RevenuesService } from './services/revenues.service';

@ApiTags('Revenues')
@ApiBearerAuth()
@UseGuards(CaslGuard)
@Controller('revenues')
export class RevenuesController {
  constructor(private readonly revenuesService: RevenuesService) {}

  @Get()
  @CheckPolicies(new ReadTransactionPolicyHandler())
  @ApiOperation({ summary: 'Get all revenues with pagination, filtering, and sorting' })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of revenues',
    type: PaginatedRevenuesResponseDto,
  })
  findAll(@Query() queryDto: RevenueQueryDto, @CurrentUser() user: User) {
    return this.revenuesService.findAllPaginated(queryDto, user);
  }

  @Get('summary')
  @CheckPolicies(new ReadTransactionPolicyHandler())
  @ApiOperation({ summary: 'Get revenue summary statistics' })
  @ApiResponse({
    status: 200,
    description: 'Revenue summary',
    type: RevenueSummaryDto,
  })
  getRevenueSummary(@CurrentUser() user: User) {
    return this.revenuesService.getRevenueSummary(user);
  }

  @Get(':id')
  @CheckPolicies(new ReadTransactionPolicyHandler())
  @ApiOperation({ summary: 'Get revenue by ID' })
  @ApiParam({ name: 'id', description: 'Revenue ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Revenue details',
    type: RevenueResponseDto,
  })
  findOne(@Param('id', MongoIdValidationPipe) id: string, @CurrentUser() user: User) {
    return this.revenuesService.findOne(id, user);
  }

  @Post()
  @CheckPolicies(new CreateTransactionPolicyHandler())
  @ApiOperation({ summary: 'Create a new revenue transaction' })
  @ApiBody({ type: CreateRevenueDto })
  @ApiResponse({
    status: 201,
    description: 'Revenue created successfully',
    type: RevenueResponseDto,
  })
  create(@Body() createRevenueDto: CreateRevenueDto, @CurrentUser() user: User) {
    return this.revenuesService.create(createRevenueDto, user);
  }

  @Patch(':id')
  @CheckPolicies(new UpdateTransactionPolicyHandler())
  @ApiOperation({ summary: 'Update revenue details' })
  @ApiParam({ name: 'id', description: 'Revenue ID', type: String })
  @ApiBody({ type: UpdateRevenueDto })
  @ApiResponse({
    status: 200,
    description: 'Revenue updated successfully',
    type: RevenueResponseDto,
  })
  update(
    @Param('id', MongoIdValidationPipe) id: string,
    @Body() updateRevenueDto: UpdateRevenueDto,
    @CurrentUser() user: User,
  ) {
    return this.revenuesService.update(id, updateRevenueDto, user);
  }

  @Delete(':id')
  @CheckPolicies(new DeleteTransactionPolicyHandler())
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a revenue (only pending transactions)' })
  @ApiParam({ name: 'id', description: 'Revenue ID', type: String })
  @ApiResponse({
    status: 204,
    description: 'Revenue deleted successfully',
  })
  remove(@Param('id', MongoIdValidationPipe) id: string, @CurrentUser() user: User) {
    return this.revenuesService.remove(id, user);
  }
}
