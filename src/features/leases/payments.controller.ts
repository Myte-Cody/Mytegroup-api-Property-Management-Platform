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
  CreatePaymentPolicyHandler,
  DeletePaymentPolicyHandler,
  ReadPaymentPolicyHandler,
  UpdatePaymentPolicyHandler,
} from '../../common/casl/policies/payment.policies';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { MongoIdValidationPipe } from '../../common/pipes/mongo-id-validation.pipe';
import { MediaType } from '../media/schemas/media.schema';
import { MediaService } from '../media/services/media.service';
import { User } from '../users/schemas/user.schema';
import {
  CreatePaymentDto,
  PaginatedPaymentsResponseDto,
  PaymentQueryDto,
  PaymentResponseDto,
  PaymentSummaryDto,
  UpdatePaymentDto,
} from './dto';
import { MarkPaymentAsPaidDto } from './dto/mark-payment-as-paid.dto';
import { PaymentsService } from './services/payments.service';

@ApiTags('Payments')
@ApiBearerAuth()
@UseGuards(CaslGuard)
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly mediaService: MediaService,
  ) {}

  @Get()
  @CheckPolicies(new ReadPaymentPolicyHandler())
  @ApiOperation({ summary: 'Get all payments with pagination, filtering, and sorting' })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of payments',
    type: PaginatedPaymentsResponseDto,
  })
  findAll(@Query() queryDto: PaymentQueryDto, @CurrentUser() user: User) {
    return this.paymentsService.findAllPaginated(queryDto, user);
  }

  @Get(':id')
  @CheckPolicies(new ReadPaymentPolicyHandler())
  @ApiOperation({ summary: 'Get payment by ID' })
  @ApiParam({ name: 'id', description: 'Payment ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Payment details',
    type: PaymentResponseDto,
  })
  findOne(@Param('id', MongoIdValidationPipe) id: string, @CurrentUser() user: User) {
    return this.paymentsService.findOne(id, user);
  }

  @Post()
  @CheckPolicies(new CreatePaymentPolicyHandler())
  @ApiOperation({ summary: 'Create a new payment' })
  @ApiBody({ type: CreatePaymentDto })
  @ApiResponse({
    status: 201,
    description: 'Payment created successfully',
    type: PaymentResponseDto,
  })
  create(@Body() createPaymentDto: CreatePaymentDto, @CurrentUser() user: User) {
    return this.paymentsService.create(createPaymentDto, user);
  }

  @Patch(':id')
  @CheckPolicies(new UpdatePaymentPolicyHandler())
  @ApiOperation({ summary: 'Update payment details' })
  @ApiParam({ name: 'id', description: 'Payment ID', type: String })
  @ApiBody({ type: UpdatePaymentDto })
  @ApiResponse({
    status: 200,
    description: 'Payment updated successfully',
    type: PaymentResponseDto,
  })
  update(
    @Param('id', MongoIdValidationPipe) id: string,
    @Body() updatePaymentDto: UpdatePaymentDto,
    @CurrentUser() user: User,
  ) {
    return this.paymentsService.update(id, updatePaymentDto, user);
  }

  @Post(':id/process')
  @CheckPolicies(new UpdatePaymentPolicyHandler())
  @ApiOperation({ summary: 'Process a pending payment' })
  @ApiParam({ name: 'id', description: 'Payment ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Payment processed successfully',
    type: PaymentResponseDto,
  })
  process(@Param('id', MongoIdValidationPipe) id: string, @CurrentUser() user: User) {
    return this.paymentsService.processPayment(id, user);
  }

  @Delete(':id')
  @CheckPolicies(new DeletePaymentPolicyHandler())
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a payment (only pending payments)' })
  @ApiParam({ name: 'id', description: 'Payment ID', type: String })
  @ApiResponse({
    status: 204,
    description: 'Payment deleted successfully',
  })
  remove(@Param('id', MongoIdValidationPipe) id: string, @CurrentUser() user: User) {
    return this.paymentsService.remove(id, user);
  }

  @Get('lease/:leaseId')
  @CheckPolicies(new ReadPaymentPolicyHandler())
  @ApiOperation({ summary: 'Get all payments for a specific lease' })
  @ApiParam({ name: 'leaseId', description: 'Lease ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'List of payments for the lease',
    type: [PaymentResponseDto],
  })
  getPaymentsByLease(
    @Param('leaseId', MongoIdValidationPipe) leaseId: string,
    @CurrentUser() user: User,
  ) {
    return this.paymentsService.getPaymentsByLease(leaseId, user);
  }

  @Get('lease/:leaseId/summary')
  @CheckPolicies(new ReadPaymentPolicyHandler())
  @ApiOperation({ summary: 'Get payment summary analytics for a lease' })
  @ApiParam({ name: 'leaseId', description: 'Lease ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Payment summary with analytics',
    type: PaymentSummaryDto,
  })
  getPaymentSummary(
    @Param('leaseId', MongoIdValidationPipe) leaseId: string,
    @CurrentUser() user: User,
  ) {
    return this.paymentsService.getPaymentSummary(leaseId, user);
  }

  @Get(':id/receipts')
  @CheckPolicies(new ReadPaymentPolicyHandler())
  @ApiOperation({ summary: 'Get payment receipts' })
  @ApiParam({ name: 'id', description: 'Payment ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Payment receipts',
  })
  async getPaymentReceipts(
    @Param('id', MongoIdValidationPipe) paymentId: string,
    @CurrentUser() user: User,
  ) {
    await this.paymentsService.findOne(paymentId, user);

    const receipts = await this.mediaService.getMediaForEntity(
      'Payment',
      paymentId,
      user,
      'receipts',
    );

    return {
      success: true,
      data: receipts,
    };
  }

  @Get(':id/documents')
  @CheckPolicies(new ReadPaymentPolicyHandler())
  @ApiOperation({ summary: 'Get payment documents' })
  @ApiParam({ name: 'id', description: 'Payment ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Payment documents',
  })
  async getPaymentDocuments(
    @Param('id', MongoIdValidationPipe) paymentId: string,
    @CurrentUser() user: User,
  ) {
    await this.paymentsService.findOne(paymentId, user);

    const documents = await this.mediaService.getMediaForEntity(
      'Payment',
      paymentId,
      user,
      'documents',
    );

    return {
      success: true,
      data: documents,
    };
  }

  @Get(':id/media')
  @CheckPolicies(new ReadPaymentPolicyHandler())
  @ApiOperation({ summary: 'Get all media for a payment' })
  @ApiParam({ name: 'id', description: 'Payment ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Payment media files',
  })
  async getPaymentMedia(
    @Param('id', MongoIdValidationPipe) paymentId: string,
    @CurrentUser() user: User,
    @Query('media_type') mediaType?: MediaType,
    @Query('collection_name') collectionName?: string,
  ) {
    await this.paymentsService.findOne(paymentId, user);

    const media = await this.mediaService.getMediaForEntity(
      'Payment',
      paymentId,
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
  @CheckPolicies(new UpdatePaymentPolicyHandler())
  @ApiOperation({ summary: 'Mark a payment as paid' })
  @ApiParam({ name: 'id', description: 'Payment ID', type: String })
  @ApiBody({ type: MarkPaymentAsPaidDto })
  @ApiResponse({
    status: 200,
    description: 'Payment marked as paid successfully',
    type: PaymentResponseDto,
  })
  markAsPaid(
    @Param('id', MongoIdValidationPipe) id: string,
    @Body() markAsPaidDto: MarkPaymentAsPaidDto,
    @CurrentUser() user: User
  ) {
    return this.paymentsService.markAsPaid(id, markAsPaidDto, user);
  }

  @Post(':id/mark-as-not-paid')
  @CheckPolicies(new UpdatePaymentPolicyHandler())
  @ApiOperation({ summary: 'Mark a payment as not paid (reset to pending)' })
  @ApiParam({ name: 'id', description: 'Payment ID', type: String })
  markAsNotPaid(
    @Param('id', MongoIdValidationPipe) id: string,
    @CurrentUser() user: User
  ) {
    return this.paymentsService.markAsNotPaid(id, user);
  }
}
