import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CaslGuard } from '../../../common/casl/guards/casl.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { UserType } from '../../../common/enums/user-type.enum';
import { MongoIdValidationPipe } from '../../../common/pipes/mongo-id-validation.pipe';
import { UserDocument } from '../../users/schemas/user.schema';
import { CreatePaymentIntentDto, PaymentIntentResponseDto } from '../dto';
import { PaymentIntentService } from '../services/payment-intent.service';
import { PaymentSettingsService } from '../services/payment-settings.service';

@ApiTags('Payments')
@ApiBearerAuth()
@UseGuards(CaslGuard)
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentIntentService: PaymentIntentService,
    private readonly paymentSettingsService: PaymentSettingsService,
  ) {}

  @Post('create-intent')
  @ApiOperation({ summary: 'Create a payment intent for a transaction' })
  @ApiResponse({
    status: 201,
    description: 'Payment intent created',
    type: PaymentIntentResponseDto,
  })
  async createPaymentIntent(
    @Body() dto: CreatePaymentIntentDto,
    @CurrentUser() user: UserDocument,
  ): Promise<PaymentIntentResponseDto> {
    return this.paymentIntentService.createPaymentIntent(dto.transactionId, user);
  }

  @Get(':id/client-secret')
  @ApiOperation({ summary: 'Get client secret for existing payment intent' })
  @ApiParam({ name: 'id', description: 'Transaction ID' })
  @ApiResponse({ status: 200, description: 'Client secret retrieved' })
  async getClientSecret(
    @Param('id', MongoIdValidationPipe) id: string,
    @CurrentUser() user: UserDocument,
  ): Promise<{ clientSecret: string }> {
    return this.paymentIntentService.getClientSecret(id, user);
  }

  @Get(':id/status')
  @ApiOperation({ summary: 'Get payment status for a transaction' })
  @ApiParam({ name: 'id', description: 'Transaction ID' })
  @ApiResponse({ status: 200, description: 'Payment status' })
  async getPaymentStatus(
    @Param('id', MongoIdValidationPipe) id: string,
    @CurrentUser() user: UserDocument,
  ): Promise<{
    status: string;
    stripeStatus?: string;
    amount: number;
    paidAt?: Date;
  }> {
    return this.paymentIntentService.getPaymentStatus(id, user);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cancel a pending payment' })
  @ApiParam({ name: 'id', description: 'Transaction ID' })
  @ApiResponse({ status: 204, description: 'Payment cancelled' })
  async cancelPayment(
    @Param('id', MongoIdValidationPipe) id: string,
    @CurrentUser() user: UserDocument,
  ): Promise<void> {
    await this.paymentIntentService.cancelPaymentIntent(id, user);
  }

  @Post(':id/confirm')
  @ApiOperation({ summary: 'Confirm payment after Stripe payment succeeds' })
  @ApiParam({ name: 'id', description: 'Transaction ID' })
  @ApiResponse({ status: 200, description: 'Payment confirmed' })
  async confirmPayment(
    @Param('id', MongoIdValidationPipe) id: string,
    @CurrentUser() user: UserDocument,
  ): Promise<{
    success: boolean;
    status: string;
    paidAt?: Date;
  }> {
    return this.paymentIntentService.confirmPayment(id, user);
  }

  @Get('online-payment-availability')
  @ApiOperation({ summary: 'Check if online payments are available for tenant' })
  @ApiResponse({ status: 200, description: 'Online payment availability status' })
  async getOnlinePaymentAvailability(
    @CurrentUser() user: UserDocument,
  ): Promise<{ onlinePaymentsEnabled: boolean }> {
    // Only tenants can check this
    if (user.user_type !== UserType.TENANT) {
      return { onlinePaymentsEnabled: false };
    }

    return this.paymentSettingsService.getOnlinePaymentAvailability(
      user.organization_id.toString(),
    );
  }
}
