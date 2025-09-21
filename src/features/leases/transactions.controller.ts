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
import { MediaType } from '../media/schemas/media.schema';
import { MediaService } from '../media/services/media.service';
import { User } from '../users/schemas/user.schema';
import {
  CreateTransactionDto,
  PaginatedTransactionsResponseDto,
  TransactionQueryDto,
  TransactionResponseDto,
  TransactionSummaryDto,
  UpdateTransactionDto,
} from './dto';
import { MarkTransactionAsPaidDto } from './dto/mark-transaction-as-paid.dto';
import { TransactionsService } from './services/transactions.service';

@ApiTags('Transactions')
@ApiBearerAuth()
@UseGuards(CaslGuard)
@Controller('transactions')
export class TransactionsController {
  constructor(
    private readonly transactionsService: TransactionsService,
    private readonly mediaService: MediaService,
  ) {}

  @Get()
  @CheckPolicies(new ReadTransactionPolicyHandler())
  @ApiOperation({ summary: 'Get all transactions with pagination, filtering, and sorting' })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of transactions',
    type: PaginatedTransactionsResponseDto,
  })
  findAll(@Query() queryDto: TransactionQueryDto, @CurrentUser() user: User) {
    return this.transactionsService.findAllPaginated(queryDto, user);
  }

  @Get(':id')
  @CheckPolicies(new ReadTransactionPolicyHandler())
  @ApiOperation({ summary: 'Get transaction by ID' })
  @ApiParam({ name: 'id', description: 'Transaction ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Transaction details',
    type: TransactionResponseDto,
  })
  findOne(@Param('id', MongoIdValidationPipe) id: string, @CurrentUser() user: User) {
    return this.transactionsService.findOne(id, user);
  }

  @Post()
  @CheckPolicies(new CreateTransactionPolicyHandler())
  @ApiOperation({ summary: 'Create a new transaction' })
  @ApiBody({ type: CreateTransactionDto })
  @ApiResponse({
    status: 201,
    description: 'Transaction created successfully',
    type: TransactionResponseDto,
  })
  create(@Body() createTransactionDto: CreateTransactionDto, @CurrentUser() user: User) {
    return this.transactionsService.create(createTransactionDto, user);
  }

  @Patch(':id')
  @CheckPolicies(new UpdateTransactionPolicyHandler())
  @ApiOperation({ summary: 'Update transaction details' })
  @ApiParam({ name: 'id', description: 'Transaction ID', type: String })
  @ApiBody({ type: UpdateTransactionDto })
  @ApiResponse({
    status: 200,
    description: 'Transaction updated successfully',
    type: TransactionResponseDto,
  })
  update(
    @Param('id', MongoIdValidationPipe) id: string,
    @Body() updateTransactionDto: UpdateTransactionDto,
    @CurrentUser() user: User,
  ) {
    return this.transactionsService.update(id, updateTransactionDto, user);
  }

  @Post(':id/process')
  @CheckPolicies(new UpdateTransactionPolicyHandler())
  @ApiOperation({ summary: 'Process a pending transaction' })
  @ApiParam({ name: 'id', description: 'Transaction ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Transaction processed successfully',
    type: TransactionResponseDto,
  })
  process(@Param('id', MongoIdValidationPipe) id: string, @CurrentUser() user: User) {
    return this.transactionsService.processTransaction(id, user);
  }

  @Delete(':id')
  @CheckPolicies(new DeleteTransactionPolicyHandler())
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a transaction (only pending transactions)' })
  @ApiParam({ name: 'id', description: 'Transaction ID', type: String })
  @ApiResponse({
    status: 204,
    description: 'Transaction deleted successfully',
  })
  remove(@Param('id', MongoIdValidationPipe) id: string, @CurrentUser() user: User) {
    return this.transactionsService.remove(id, user);
  }

  @Get('lease/:leaseId')
  @CheckPolicies(new ReadTransactionPolicyHandler())
  @ApiOperation({ summary: 'Get all transactions for a specific lease' })
  @ApiParam({ name: 'leaseId', description: 'Lease ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'List of transactions for the lease',
    type: [TransactionResponseDto],
  })
  getTransactionsByLease(
    @Param('leaseId', MongoIdValidationPipe) leaseId: string,
    @CurrentUser() user: User,
  ) {
    return this.transactionsService.getTransactionsByLease(leaseId, user);
  }

  @Get('lease/:leaseId/summary')
  @CheckPolicies(new ReadTransactionPolicyHandler())
  @ApiOperation({ summary: 'Get transaction summary analytics for a lease' })
  @ApiParam({ name: 'leaseId', description: 'Lease ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Transaction summary with analytics',
    type: TransactionSummaryDto,
  })
  getTransactionSummary(
    @Param('leaseId', MongoIdValidationPipe) leaseId: string,
    @CurrentUser() user: User,
  ) {
    return this.transactionsService.getTransactionSummary(leaseId, user);
  }

  @Get(':id/receipts')
  @CheckPolicies(new ReadTransactionPolicyHandler())
  @ApiOperation({ summary: 'Get transaction receipts' })
  @ApiParam({ name: 'id', description: 'Transaction ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Transaction receipts',
  })
  async getTransactionReceipts(
    @Param('id', MongoIdValidationPipe) transactionId: string,
    @CurrentUser() user: User,
  ) {
    await this.transactionsService.findOne(transactionId, user);

    const receipts = await this.mediaService.getMediaForEntity(
      'Transaction',
      transactionId,
      user,
      'receipts',
    );

    return {
      success: true,
      data: receipts,
    };
  }

  @Get(':id/documents')
  @CheckPolicies(new ReadTransactionPolicyHandler())
  @ApiOperation({ summary: 'Get transaction documents' })
  @ApiParam({ name: 'id', description: 'Transaction ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Transaction documents',
  })
  async getTransactionDocuments(
    @Param('id', MongoIdValidationPipe) transactionId: string,
    @CurrentUser() user: User,
  ) {
    await this.transactionsService.findOne(transactionId, user);

    const documents = await this.mediaService.getMediaForEntity(
      'Transaction',
      transactionId,
      user,
      'documents',
    );

    return {
      success: true,
      data: documents,
    };
  }

  @Get(':id/media')
  @CheckPolicies(new ReadTransactionPolicyHandler())
  @ApiOperation({ summary: 'Get all media for a transaction' })
  @ApiParam({ name: 'id', description: 'Transaction ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Transaction media files',
  })
  async getTransactionMedia(
    @Param('id', MongoIdValidationPipe) transactionId: string,
    @CurrentUser() user: User,
    @Query('media_type') mediaType?: MediaType,
    @Query('collection_name') collectionName?: string,
  ) {
    await this.transactionsService.findOne(transactionId, user);

    const media = await this.mediaService.getMediaForEntity(
      'Transaction',
      transactionId,
      user,
      collectionName,
      {
        media_type: mediaType,
      },
    );

    return {
      success: true,
      data: media,
    };
  }

  @Post(':id/mark-as-paid')
  @CheckPolicies(new UpdateTransactionPolicyHandler())
  @ApiOperation({ summary: 'Mark a transaction as paid' })
  @ApiParam({ name: 'id', description: 'Transaction ID', type: String })
  @ApiBody({ type: MarkTransactionAsPaidDto })
  @ApiResponse({
    status: 200,
    description: 'Transaction marked as paid successfully',
    type: TransactionResponseDto,
  })
  markAsPaid(
    @Param('id', MongoIdValidationPipe) id: string,
    @Body() markAsPaidDto: MarkTransactionAsPaidDto,
    @CurrentUser() user: User
  ) {
    return this.transactionsService.markAsPaid(id, markAsPaidDto, user);
  }

  @Post(':id/mark-as-not-paid')
  @CheckPolicies(new UpdateTransactionPolicyHandler())
  @ApiOperation({ summary: 'Mark a transaction as not paid (reset to pending)' })
  @ApiParam({ name: 'id', description: 'Transaction ID', type: String })
  markAsNotPaid(
    @Param('id', MongoIdValidationPipe) id: string,
    @CurrentUser() user: User
  ) {
    return this.transactionsService.markAsNotPaid(id, user);
  }
}
