import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NestjsFormDataModule } from 'nestjs-form-data';
import { CaslModule } from '../../common/casl/casl.module';
import { CommonModule } from '../../common/common.module';
import { Availability, AvailabilitySchema } from '../availability/schemas/availability.schema';
import { EmailModule } from '../email/email.module';
import { MaintenanceModule } from '../maintenance/maintenance.module';
import {
  MaintenanceTicket,
  MaintenanceTicketSchema,
} from '../maintenance/schemas/maintenance-ticket.schema';
import { VisitRequest, VisitRequestSchema } from '../maintenance/schemas/visit-request.schema';
import { MediaModule } from '../media/media.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PropertiesModule } from '../properties/properties.module';
import { Property, PropertySchema } from '../properties/schemas/property.schema';
import { Unit, UnitSchema } from '../properties/schemas/unit.schema';
import { Tenant, TenantSchema } from '../tenants/schema/tenant.schema';
import { TenantsModule } from '../tenants/tenant.module';
import { User, UserSchema } from '../users/schemas/user.schema';
import { UsersModule } from '../users/users.module';
import { LeaseSignatureController } from './lease-signature.controller';
import { LeasesController } from './leases.controller';
import { RentalPeriodsController } from './rental-periods.controller';
import {
  LeaseSignatureToken,
  LeaseSignatureTokenSchema,
} from './schemas/lease-signature-token.schema';
import { Lease, LeaseSchema } from './schemas/lease.schema';
import { RentalPeriod, RentalPeriodSchema } from './schemas/rental-period.schema';
import { Transaction, TransactionSchema } from './schemas/transaction.schema';
import { AutoRenewalService } from './services/auto-renewal.service';
import { LeasePdfService } from './services/lease-pdf.service';
import { LeaseSignatureService } from './services/lease-signature.service';
import { LeasesService } from './services/leases.service';
import { RentalPeriodsService } from './services/rental-periods.service';
import { TransactionsService } from './services/transactions.service';
import { TransactionsController } from './transactions.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Lease.name, schema: LeaseSchema },
      { name: LeaseSignatureToken.name, schema: LeaseSignatureTokenSchema },
      { name: RentalPeriod.name, schema: RentalPeriodSchema },
      { name: Transaction.name, schema: TransactionSchema },
      { name: Unit.name, schema: UnitSchema },
      { name: Tenant.name, schema: TenantSchema },
      { name: User.name, schema: UserSchema },
      { name: Property.name, schema: PropertySchema },
      { name: MaintenanceTicket.name, schema: MaintenanceTicketSchema },
      { name: Availability.name, schema: AvailabilitySchema },
      { name: VisitRequest.name, schema: VisitRequestSchema },
    ]),
    NestjsFormDataModule,
    CaslModule,
    CommonModule,
    EmailModule,
    forwardRef(() => MaintenanceModule),
    MediaModule,
    NotificationsModule,
    PropertiesModule,
    TenantsModule,
    UsersModule,
  ],
  controllers: [
    LeasesController,
    LeaseSignatureController,
    RentalPeriodsController,
    TransactionsController,
  ],
  providers: [
    LeasesService,
    LeasePdfService,
    LeaseSignatureService,
    RentalPeriodsService,
    TransactionsService,
    AutoRenewalService,
  ],
  exports: [
    LeasesService,
    LeasePdfService,
    LeaseSignatureService,
    RentalPeriodsService,
    TransactionsService,
    AutoRenewalService,
  ],
})
export class LeasesModule {}
