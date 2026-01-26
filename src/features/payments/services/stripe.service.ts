import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

/**
 * StripeService is used only for webhook signature verification.
 * Payment processing uses landlord-specific Stripe clients via StripeConnectService.
 */
@Injectable()
export class StripeService {
  private readonly stripe: Stripe | null;
  private readonly logger = new Logger(StripeService.name);
  private readonly isConfigured: boolean;

  constructor(private readonly configService: ConfigService) {
    const secretKey = this.configService.get<string>('stripe.secretKey');
    if (!secretKey) {
      this.logger.warn('Stripe secret key not configured - Stripe features will be disabled');
      this.stripe = null;
      this.isConfigured = false;
    } else {
      this.stripe = new Stripe(secretKey, {
        apiVersion: '2025-12-15.clover',
        typescript: true,
      });
      this.isConfigured = true;
    }
  }

  private ensureConfigured(): Stripe {
    if (!this.stripe) {
      throw new InternalServerErrorException('Stripe is not configured');
    }
    return this.stripe;
  }

  get webhookSecret(): string {
    return this.configService.get<string>('stripe.webhookSecret') || '';
  }

  /**
   * Verify webhook signature and construct event
   */
  constructWebhookEvent(payload: Buffer, signature: string): Stripe.Event {
    try {
      const stripe = this.ensureConfigured();
      return stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);
    } catch (err) {
      this.logger.error(`Webhook signature verification failed: ${err.message}`);
      throw new BadRequestException('Invalid webhook signature');
    }
  }
}
