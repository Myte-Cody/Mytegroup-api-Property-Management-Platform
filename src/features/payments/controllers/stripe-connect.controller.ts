import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CheckPolicies } from '../../../common/casl/decorators/check-policies.decorator';
import { CaslGuard } from '../../../common/casl/guards/casl.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { TenancyContextService } from '../../../common/services/tenancy-context.service';
import { UserDocument } from '../../users/schemas/user.schema';
import { PublishableKeyResponseDto, StripeConnectStatusDto, UpdateStripeConfigDto } from '../dto';
import { ManageStripeConnectPolicyHandler } from '../policies/stripe-connect.policies';
import { StripeConnectService } from '../services/stripe-connect.service';

@ApiTags('Stripe Configuration')
@Controller('stripe/config')
export class StripeConnectController {
  constructor(
    private readonly stripeConnectService: StripeConnectService,
    private readonly tenancyContextService: TenancyContextService,
  ) {}

  @Get('status')
  @ApiBearerAuth()
  @UseGuards(CaslGuard)
  @ApiOperation({ summary: 'Get current Stripe configuration status' })
  @ApiResponse({ status: 200, description: 'Configuration status', type: StripeConnectStatusDto })
  async getStatus(@CurrentUser() user: UserDocument): Promise<StripeConnectStatusDto> {
    const landlordId = String(this.tenancyContextService.getLandlordContext(user));
    return this.stripeConnectService.getAccountStatus(landlordId);
  }

  @Post('save')
  @ApiBearerAuth()
  @UseGuards(CaslGuard)
  @CheckPolicies(new ManageStripeConnectPolicyHandler())
  @ApiOperation({ summary: 'Save Stripe API keys' })
  @ApiResponse({ status: 200, description: 'Configuration saved', type: StripeConnectStatusDto })
  async saveConfig(
    @Body() dto: UpdateStripeConfigDto,
    @CurrentUser() user: UserDocument,
  ): Promise<StripeConnectStatusDto> {
    const landlordId = String(this.tenancyContextService.getLandlordContext(user));
    return this.stripeConnectService.saveStripeConfig(landlordId, dto);
  }

  @Post('disconnect')
  @ApiBearerAuth()
  @UseGuards(CaslGuard)
  @CheckPolicies(new ManageStripeConnectPolicyHandler())
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove Stripe configuration' })
  @ApiResponse({ status: 204, description: 'Configuration removed' })
  async disconnect(@CurrentUser() user: UserDocument): Promise<void> {
    const landlordId = String(this.tenancyContextService.getLandlordContext(user));
    await this.stripeConnectService.disconnectAccount(landlordId);
  }

  @Get('publishable-key')
  @ApiBearerAuth()
  @UseGuards(CaslGuard)
  @ApiOperation({ summary: 'Get publishable key for frontend payment forms' })
  @ApiResponse({ status: 200, description: 'Publishable key', type: PublishableKeyResponseDto })
  async getPublishableKey(@CurrentUser() user: UserDocument): Promise<PublishableKeyResponseDto> {
    const landlordId = String(this.tenancyContextService.getLandlordContext(user));
    const publishableKey = await this.stripeConnectService.getPublishableKey(landlordId);
    return { publishableKey };
  }
}
