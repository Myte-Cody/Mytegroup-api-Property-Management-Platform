import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

// Schemas
import { Landlord, LandlordSchema } from '../landlords/schema/landlord.schema';
import { Lease, LeaseSchema } from '../leases/schemas/lease.schema';
import { Transaction, TransactionSchema } from '../leases/schemas/transaction.schema';
import {
  MaintenanceTicket,
  MaintenanceTicketSchema,
} from '../maintenance/schemas/maintenance-ticket.schema';
import { Property, PropertySchema } from '../properties/schemas/property.schema';
import { Unit, UnitSchema } from '../properties/schemas/unit.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { StripeEvent, StripeEventSchema } from './schemas/stripe-event.schema';

// Services
import { PaymentIntentService } from './services/payment-intent.service';
import { PaymentSettingsService } from './services/payment-settings.service';
import { StripeConnectService } from './services/stripe-connect.service';
import { StripeService } from './services/stripe.service';

// Controllers
import { PaymentSettingsController } from './controllers/payment-settings.controller';
import { PaymentsController } from './controllers/payments.controller';
import { StripeConnectController } from './controllers/stripe-connect.controller';

// Common
import { CaslModule } from '../../common/casl/casl.module';
import { CommonModule } from '../../common/common.module';
import { EmailModule } from '../email/email.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: StripeEvent.name, schema: StripeEventSchema },
      { name: Transaction.name, schema: TransactionSchema },
      { name: Lease.name, schema: LeaseSchema },
      { name: Landlord.name, schema: LandlordSchema },
      // Required by CaslGuard
      { name: User.name, schema: UserSchema },
      { name: Property.name, schema: PropertySchema },
      { name: Unit.name, schema: UnitSchema },
      { name: MaintenanceTicket.name, schema: MaintenanceTicketSchema },
    ]),
    CaslModule,
    CommonModule,
    EmailModule,
    UsersModule,
  ],
  controllers: [StripeConnectController, PaymentsController, PaymentSettingsController],
  providers: [StripeService, StripeConnectService, PaymentIntentService, PaymentSettingsService],
  exports: [StripeConnectService, PaymentIntentService],
})
export class PaymentsModule {}
