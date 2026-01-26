import { accessibleRecordsPlugin } from '@casl/mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import * as mongooseDelete from 'mongoose-delete';
import { SoftDelete } from 'src/common/interfaces/soft-delete.interface';

@Schema({ _id: false })
export class PaymentSettings {
  @Prop({ default: true })
  acceptCardPayments: boolean;

  @Prop({ default: false })
  onlinePaymentsEnabled: boolean;
}

@Schema({ _id: false })
export class StripeConfig {
  @Prop()
  secretKey?: string;

  @Prop()
  publishableKey?: string;

  @Prop()
  webhookSecret?: string;

  @Prop()
  configuredAt?: Date;
}

@Schema({ timestamps: true })
export class Landlord extends Document implements SoftDelete {
  @Prop({ required: true, unique: true })
  name: string;

  // Stripe API keys (landlord's own Stripe account)
  @Prop({ type: StripeConfig })
  stripeConfig?: StripeConfig;

  @Prop({ type: PaymentSettings, default: () => ({}) })
  paymentSettings: PaymentSettings;

  deleted: boolean;
  deletedAt?: Date;
}

export const LandlordSchema = SchemaFactory.createForClass(Landlord);

LandlordSchema.plugin(mongooseDelete, { deletedAt: true, overrideMethods: 'all' });
LandlordSchema.plugin(accessibleRecordsPlugin);
