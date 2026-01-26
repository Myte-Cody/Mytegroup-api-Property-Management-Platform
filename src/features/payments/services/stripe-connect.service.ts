import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import Stripe from 'stripe';
import { Landlord } from '../../landlords/schema/landlord.schema';
import { StripeConnectStatusDto, UpdateStripeConfigDto } from '../dto';

@Injectable()
export class StripeConnectService {
  private readonly logger = new Logger(StripeConnectService.name);

  constructor(@InjectModel(Landlord.name) private readonly landlordModel: Model<Landlord>) {}

  /**
   * Save Stripe API keys for a landlord
   */
  async saveStripeConfig(
    landlordId: string,
    config: UpdateStripeConfigDto,
  ): Promise<StripeConnectStatusDto> {
    const landlord = await this.landlordModel.findById(landlordId);
    if (!landlord) {
      throw new NotFoundException('Landlord not found');
    }

    // Validate the keys by making a test API call
    try {
      const stripe = new Stripe(config.secretKey, {
        apiVersion: '2025-12-15.clover',
      });

      // Test the key by retrieving account info
      await stripe.balance.retrieve();
    } catch (error) {
      this.logger.error(`Invalid Stripe API key: ${error.message}`);
      throw new BadRequestException('Invalid Stripe API key. Please check your credentials.');
    }

    // Save the keys
    await this.landlordModel.findByIdAndUpdate(landlordId, {
      stripeConfig: {
        secretKey: config.secretKey,
        publishableKey: config.publishableKey,
        webhookSecret: config.webhookSecret,
        configuredAt: new Date(),
      },
    });

    this.logger.log(`Stripe config saved for landlord ${landlordId}`);

    return this.getAccountStatus(landlordId);
  }

  /**
   * Get current Stripe configuration status for a landlord
   */
  async getAccountStatus(landlordId: string): Promise<StripeConnectStatusDto> {
    const landlord = await this.landlordModel.findById(landlordId);
    if (!landlord) {
      throw new NotFoundException('Landlord not found');
    }

    if (!landlord.stripeConfig?.secretKey) {
      return {
        isConnected: false,
        status: 'not_configured',
      };
    }

    // Verify the keys are still valid
    try {
      const stripe = new Stripe(landlord.stripeConfig.secretKey, {
        apiVersion: '2025-12-15.clover',
      });

      const balance = await stripe.balance.retrieve();

      return {
        isConnected: true,
        status: 'active',
        chargesEnabled: true,
        payoutsEnabled: true,
        // Mask the keys for display
        publishableKey: landlord.stripeConfig.publishableKey
          ? `${landlord.stripeConfig.publishableKey.slice(0, 12)}...`
          : undefined,
        configuredAt: landlord.stripeConfig.configuredAt,
      };
    } catch (error) {
      this.logger.error(`Stripe API key validation failed: ${error.message}`);
      return {
        isConnected: true,
        status: 'invalid',
        chargesEnabled: false,
        payoutsEnabled: false,
      };
    }
  }

  /**
   * Remove Stripe configuration from landlord
   */
  async disconnectAccount(landlordId: string): Promise<void> {
    const landlord = await this.landlordModel.findById(landlordId);
    if (!landlord) {
      throw new NotFoundException('Landlord not found');
    }

    if (!landlord.stripeConfig?.secretKey) {
      throw new BadRequestException('No Stripe configuration found');
    }

    // Clear Stripe config and disable online payments
    await this.landlordModel.findByIdAndUpdate(landlordId, {
      $unset: { stripeConfig: 1 },
      'paymentSettings.onlinePaymentsEnabled': false,
    });

    this.logger.log(`Stripe config removed for landlord ${landlordId}`);
  }

  /**
   * Check if landlord can accept payments
   */
  async canAcceptPayments(landlordId: string): Promise<boolean> {
    const landlord = await this.landlordModel.findById(landlordId);
    if (!landlord) {
      return false;
    }

    return (
      landlord.stripeConfig?.secretKey != null &&
      landlord.paymentSettings?.onlinePaymentsEnabled === true
    );
  }

  /**
   * Get Stripe client for a landlord
   */
  async getStripeClient(landlordId: string): Promise<Stripe> {
    const landlord = await this.landlordModel.findById(landlordId);
    if (!landlord) {
      throw new NotFoundException('Landlord not found');
    }

    if (!landlord.stripeConfig?.secretKey) {
      throw new ForbiddenException('Landlord has not configured Stripe');
    }

    if (!landlord.paymentSettings?.onlinePaymentsEnabled) {
      throw new ForbiddenException('Online payments are not enabled');
    }

    return new Stripe(landlord.stripeConfig.secretKey, {
      apiVersion: '2025-12-15.clover',
    });
  }

  /**
   * Get publishable key for frontend
   */
  async getPublishableKey(landlordId: string): Promise<string> {
    const landlord = await this.landlordModel.findById(landlordId);
    if (!landlord) {
      throw new NotFoundException('Landlord not found');
    }

    if (!landlord.stripeConfig?.publishableKey) {
      throw new ForbiddenException('Stripe is not configured');
    }

    return landlord.stripeConfig.publishableKey;
  }
}
