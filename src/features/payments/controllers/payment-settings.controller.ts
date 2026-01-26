import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CheckPolicies } from '../../../common/casl/decorators/check-policies.decorator';
import { CaslGuard } from '../../../common/casl/guards/casl.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { TenancyContextService } from '../../../common/services/tenancy-context.service';
import { UserDocument } from '../../users/schemas/user.schema';
import { PaymentSettingsDto, UpdatePaymentSettingsDto } from '../dto';
import {
  ManageStripeConnectPolicyHandler,
  ReadStripeConnectPolicyHandler,
} from '../policies/stripe-connect.policies';
import { PaymentSettingsService } from '../services/payment-settings.service';

@ApiTags('Landlords')
@ApiBearerAuth()
@UseGuards(CaslGuard)
@Controller('landlords')
export class PaymentSettingsController {
  constructor(
    private readonly paymentSettingsService: PaymentSettingsService,
    private readonly tenancyContextService: TenancyContextService,
  ) {}

  @Get('payment-settings')
  @CheckPolicies(new ReadStripeConnectPolicyHandler())
  @ApiOperation({ summary: 'Get landlord payment settings' })
  @ApiResponse({ status: 200, description: 'Payment settings', type: PaymentSettingsDto })
  async getPaymentSettings(@CurrentUser() user: UserDocument): Promise<PaymentSettingsDto> {
    const landlordId = this.tenancyContextService.getLandlordContext(user);
    return this.paymentSettingsService.getPaymentSettings(landlordId.toString());
  }

  @Patch('payment-settings')
  @CheckPolicies(new ManageStripeConnectPolicyHandler())
  @ApiOperation({ summary: 'Update landlord payment settings' })
  @ApiResponse({ status: 200, description: 'Updated payment settings', type: PaymentSettingsDto })
  async updatePaymentSettings(
    @Body() dto: UpdatePaymentSettingsDto,
    @CurrentUser() user: UserDocument,
  ): Promise<PaymentSettingsDto> {
    const landlordId = this.tenancyContextService.getLandlordContext(user);
    return this.paymentSettingsService.updatePaymentSettings(landlordId.toString(), dto);
  }
}
