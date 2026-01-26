import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Landlord } from '../../landlords/schema/landlord.schema';
import { Lease } from '../../leases/schemas/lease.schema';
import { PaymentSettingsDto, UpdatePaymentSettingsDto } from '../dto';

@Injectable()
export class PaymentSettingsService {
  constructor(
    @InjectModel(Landlord.name) private readonly landlordModel: Model<Landlord>,
    @InjectModel(Lease.name) private readonly leaseModel: Model<Lease>,
  ) {}

  /**
   * Get payment settings for a landlord
   */
  async getPaymentSettings(landlordId: string): Promise<PaymentSettingsDto> {
    const landlord = await this.landlordModel.findById(landlordId);
    if (!landlord) {
      throw new NotFoundException('Landlord not found');
    }

    return {
      onlinePaymentsEnabled: landlord.paymentSettings?.onlinePaymentsEnabled ?? false,
      acceptCardPayments: landlord.paymentSettings?.acceptCardPayments ?? true,
    };
  }

  /**
   * Update payment settings for a landlord
   */
  async updatePaymentSettings(
    landlordId: string,
    dto: UpdatePaymentSettingsDto,
  ): Promise<PaymentSettingsDto> {
    const landlord = await this.landlordModel.findById(landlordId);
    if (!landlord) {
      throw new NotFoundException('Landlord not found');
    }

    // Validate: Cannot enable online payments without configured Stripe
    if (dto.onlinePaymentsEnabled === true) {
      if (!landlord.stripeConfig?.secretKey || !landlord.stripeConfig?.publishableKey) {
        throw new BadRequestException(
          'Cannot enable online payments without configuring Stripe API keys',
        );
      }
    }

    // Build update object
    const updateFields: Record<string, boolean> = {};
    if (dto.onlinePaymentsEnabled !== undefined) {
      updateFields['paymentSettings.onlinePaymentsEnabled'] = dto.onlinePaymentsEnabled;
    }
    if (dto.acceptCardPayments !== undefined) {
      updateFields['paymentSettings.acceptCardPayments'] = dto.acceptCardPayments;
    }

    const updated = await this.landlordModel.findByIdAndUpdate(
      landlordId,
      { $set: updateFields },
      { new: true },
    );

    return {
      onlinePaymentsEnabled: updated?.paymentSettings?.onlinePaymentsEnabled ?? false,
      acceptCardPayments: updated?.paymentSettings?.acceptCardPayments ?? true,
    };
  }

  /**
   * Check if online payments are available for a tenant
   * Returns true if at least one of the tenant's landlords has online payments enabled
   */
  async getOnlinePaymentAvailability(
    tenantId: string,
  ): Promise<{ onlinePaymentsEnabled: boolean }> {
    // Find all active leases for this tenant
    const leases = await this.leaseModel
      .find({
        tenant: tenantId,
        status: { $in: ['ACTIVE', 'PENDING'] },
      })
      .populate('landlord')
      .lean();

    if (leases.length === 0) {
      return { onlinePaymentsEnabled: false };
    }

    // Check if any landlord has online payments enabled
    const hasOnlinePayments = leases.some((lease) => {
      const landlord = lease.landlord as any;
      return landlord?.paymentSettings?.onlinePaymentsEnabled === true;
    });

    return { onlinePaymentsEnabled: hasOnlinePayments };
  }
}
