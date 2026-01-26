import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PaymentMethod, PaymentStatus } from '../../../common/enums/lease.enum';
import { UserType } from '../../../common/enums/user-type.enum';
import { Landlord } from '../../landlords/schema/landlord.schema';
import { Lease } from '../../leases/schemas/lease.schema';
import { Transaction } from '../../leases/schemas/transaction.schema';
import { UserDocument } from '../../users/schemas/user.schema';
import { PaymentIntentResponseDto } from '../dto';
import { StripeConnectService } from './stripe-connect.service';

@Injectable()
export class PaymentIntentService {
  private readonly logger = new Logger(PaymentIntentService.name);

  constructor(
    @InjectModel(Transaction.name) private readonly transactionModel: Model<Transaction>,
    @InjectModel(Lease.name) private readonly leaseModel: Model<Lease>,
    @InjectModel(Landlord.name) private readonly landlordModel: Model<Landlord>,
    private readonly stripeConnectService: StripeConnectService,
  ) {}

  /**
   * Create a payment intent for a transaction
   */
  async createPaymentIntent(
    transactionId: string,
    currentUser: UserDocument,
  ): Promise<PaymentIntentResponseDto> {
    // Get transaction with lease populated
    const transaction = await this.transactionModel
      .findById(transactionId)
      .populate('lease')
      .populate('landlord');

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    // Verify user is associated with this transaction (tenant check)
    if (currentUser.user_type === UserType.TENANT) {
      const lease = transaction.lease as any;
      if (!lease || String(lease.tenant) !== String(currentUser.organization_id)) {
        throw new ForbiddenException('You do not have access to this transaction');
      }
    }

    // Check transaction status
    if (transaction.status === PaymentStatus.PAID) {
      throw new BadRequestException('Transaction is already paid');
    }

    // Get landlord's Stripe client and publishable key
    const landlordId = String(transaction.landlord._id || transaction.landlord);
    const stripe = await this.stripeConnectService.getStripeClient(landlordId);
    const publishableKey = await this.stripeConnectService.getPublishableKey(landlordId);

    // Check if there's already an active payment intent
    if (transaction.stripePaymentIntentId) {
      try {
        const existingIntent = await stripe.paymentIntents.retrieve(
          transaction.stripePaymentIntentId,
        );

        // If intent is still valid, return it
        if (
          existingIntent.status === 'requires_payment_method' ||
          existingIntent.status === 'requires_confirmation' ||
          existingIntent.status === 'requires_action'
        ) {
          return {
            clientSecret: existingIntent.client_secret!,
            paymentIntentId: existingIntent.id,
            amount: existingIntent.amount,
            currency: existingIntent.currency,
            publishableKey,
          };
        }
      } catch (error) {
        this.logger.warn(`Failed to retrieve existing payment intent: ${error.message}`);
      }
    }

    // Convert amount to cents (Stripe uses smallest currency unit)
    const amountInCents = Math.round(transaction.amount * 100);

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      metadata: {
        transactionId: String(transaction._id),
        landlordId,
        type: transaction.type,
      },
    });

    // Store payment intent ID on transaction
    await this.transactionModel.findByIdAndUpdate(transactionId, {
      stripePaymentIntentId: paymentIntent.id,
      stripePaymentMethodType: 'card',
      'stripeMetadata.attemptCount': (transaction.stripeMetadata?.attemptCount || 0) + 1,
    });

    this.logger.log(`Created payment intent ${paymentIntent.id} for transaction ${transactionId}`);

    return {
      clientSecret: paymentIntent.client_secret!,
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      publishableKey,
    };
  }

  /**
   * Get payment status for a transaction
   */
  async getPaymentStatus(
    transactionId: string,
    currentUser: UserDocument,
  ): Promise<{
    status: string;
    stripeStatus?: string;
    amount: number;
    paidAt?: Date;
  }> {
    const transaction = await this.transactionModel
      .findById(transactionId)
      .populate('lease')
      .populate('landlord');

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    // Verify access
    if (currentUser.user_type === UserType.TENANT) {
      const lease = transaction.lease as any;
      if (!lease || String(lease.tenant) !== String(currentUser.organization_id)) {
        throw new ForbiddenException('You do not have access to this transaction');
      }
    } else if (currentUser.user_type === UserType.LANDLORD) {
      if (
        String(transaction.landlord._id || transaction.landlord) !==
        String(currentUser.organization_id)
      ) {
        throw new ForbiddenException('You do not have access to this transaction');
      }
    }

    let stripeStatus: string | undefined;

    if (transaction.stripePaymentIntentId) {
      const landlordId = String(transaction.landlord._id || transaction.landlord);
      try {
        const stripe = await this.stripeConnectService.getStripeClient(landlordId);
        const paymentIntent = await stripe.paymentIntents.retrieve(
          transaction.stripePaymentIntentId,
        );
        stripeStatus = paymentIntent.status;
      } catch (error) {
        this.logger.warn(`Failed to get payment intent status: ${error.message}`);
      }
    }

    return {
      status: transaction.status,
      stripeStatus,
      amount: transaction.amount,
      paidAt: transaction.paidAt,
    };
  }

  /**
   * Cancel a pending payment intent
   */
  async cancelPaymentIntent(transactionId: string, currentUser: UserDocument): Promise<void> {
    const transaction = await this.transactionModel
      .findById(transactionId)
      .populate('lease')
      .populate('landlord');

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    // Verify access (only tenant can cancel their own payment)
    if (currentUser.user_type === UserType.TENANT) {
      const lease = transaction.lease as any;
      if (!lease || String(lease.tenant) !== String(currentUser.organization_id)) {
        throw new ForbiddenException('You do not have access to this transaction');
      }
    }

    if (!transaction.stripePaymentIntentId) {
      throw new BadRequestException('No payment intent to cancel');
    }

    if (transaction.status === PaymentStatus.PAID) {
      throw new BadRequestException('Cannot cancel a completed payment');
    }

    const landlordId = String(transaction.landlord._id || transaction.landlord);
    const stripe = await this.stripeConnectService.getStripeClient(landlordId);

    await stripe.paymentIntents.cancel(transaction.stripePaymentIntentId);

    // Clear the payment intent ID from transaction
    await this.transactionModel.findByIdAndUpdate(transactionId, {
      $unset: { stripePaymentIntentId: 1 },
    });

    this.logger.log(`Cancelled payment intent for transaction ${transactionId}`);
  }

  /**
   * Get client secret for existing payment intent
   */
  async getClientSecret(
    transactionId: string,
    currentUser: UserDocument,
  ): Promise<{ clientSecret: string }> {
    const transaction = await this.transactionModel
      .findById(transactionId)
      .populate('lease')
      .populate('landlord');

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    // Verify access
    if (currentUser.user_type === UserType.TENANT) {
      const lease = transaction.lease as any;
      if (!lease || String(lease.tenant) !== String(currentUser.organization_id)) {
        throw new ForbiddenException('You do not have access to this transaction');
      }
    }

    if (!transaction.stripePaymentIntentId) {
      throw new BadRequestException('No payment intent exists. Create one first.');
    }

    const landlordId = String(transaction.landlord._id || transaction.landlord);
    const stripe = await this.stripeConnectService.getStripeClient(landlordId);

    const paymentIntent = await stripe.paymentIntents.retrieve(transaction.stripePaymentIntentId);

    if (!paymentIntent.client_secret) {
      throw new BadRequestException('Payment intent has no client secret');
    }

    return { clientSecret: paymentIntent.client_secret };
  }

  /**
   * Get publishable key for a transaction's landlord
   */
  async getPublishableKey(
    transactionId: string,
    currentUser: UserDocument,
  ): Promise<{ publishableKey: string }> {
    const transaction = await this.transactionModel.findById(transactionId).populate('landlord');

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    const landlordId = String(transaction.landlord._id || transaction.landlord);
    const publishableKey = await this.stripeConnectService.getPublishableKey(landlordId);

    return { publishableKey };
  }

  /**
   * Confirm payment by verifying with Stripe and updating transaction status
   * Called by frontend after successful payment
   */
  async confirmPayment(
    transactionId: string,
    currentUser: UserDocument,
  ): Promise<{
    success: boolean;
    status: string;
    paidAt?: Date;
  }> {
    const transaction = await this.transactionModel
      .findById(transactionId)
      .populate('lease')
      .populate('landlord');

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    // Verify user access
    if (currentUser.user_type === UserType.TENANT) {
      const lease = transaction.lease as any;
      if (!lease || String(lease.tenant) !== String(currentUser.organization_id)) {
        throw new ForbiddenException('You do not have access to this transaction');
      }
    }

    // Already paid
    if (transaction.status === PaymentStatus.PAID) {
      return {
        success: true,
        status: PaymentStatus.PAID,
        paidAt: transaction.paidAt,
      };
    }

    // No payment intent to verify
    if (!transaction.stripePaymentIntentId) {
      throw new BadRequestException('No payment intent found for this transaction');
    }

    // Get landlord's Stripe client and verify payment status
    const landlordId = String(transaction.landlord._id || transaction.landlord);
    const stripe = await this.stripeConnectService.getStripeClient(landlordId);

    const paymentIntent = await stripe.paymentIntents.retrieve(transaction.stripePaymentIntentId);

    if (paymentIntent.status === 'succeeded') {
      // Get charge details
      let chargeId: string | undefined;
      let receiptUrl: string | undefined;

      if (paymentIntent.latest_charge) {
        chargeId =
          typeof paymentIntent.latest_charge === 'string'
            ? paymentIntent.latest_charge
            : paymentIntent.latest_charge.id;

        if (typeof paymentIntent.latest_charge !== 'string') {
          receiptUrl = paymentIntent.latest_charge.receipt_url || undefined;
        }
      }

      const paidAt = new Date();

      // Update transaction as paid
      await this.transactionModel.findByIdAndUpdate(transactionId, {
        status: PaymentStatus.PAID,
        paidAt,
        paymentMethod: PaymentMethod.CREDIT_CARD,
        stripeChargeId: chargeId,
        stripeReceiptUrl: receiptUrl,
      });

      this.logger.log(`Transaction ${transactionId} confirmed as paid`);

      return {
        success: true,
        status: PaymentStatus.PAID,
        paidAt,
      };
    }

    // Payment not successful
    this.logger.warn(
      `Payment confirmation failed for transaction ${transactionId}: Stripe status is ${paymentIntent.status}`,
    );

    return {
      success: false,
      status: paymentIntent.status,
    };
  }
}
