import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NestjsFormDataModule } from 'nestjs-form-data';
import { CaslModule } from '../../common/casl/casl.module';
import { CommonModule } from '../../common/common.module';
import {
  MaintenanceTicket,
  MaintenanceTicketSchema,
} from '../maintenance/schemas/maintenance-ticket.schema';
import { MaintenanceModule } from '../maintenance/maintenance.module';
import { MediaModule } from '../media/media.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PropertiesModule } from '../properties/properties.module';
import { Property, PropertySchema } from '../properties/schemas/property.schema';
import { Unit, UnitSchema } from '../properties/schemas/unit.schema';
import { Tenant, TenantSchema } from '../tenants/schema/tenant.schema';
import { TenantsModule } from '../tenants/tenant.module';
import { User, UserSchema } from '../users/schemas/user.schema';
import { UsersModule } from '../users/users.module';
import { LeasesController } from './leases.controller';
import { RentalPeriodsController } from './rental-periods.controller';
import { Lease, LeaseSchema } from './schemas/lease.schema';
import { RentalPeriod, RentalPeriodSchema } from './schemas/rental-period.schema';
import { Transaction, TransactionSchema } from './schemas/transaction.schema';
import { AutoRenewalService } from './services/auto-renewal.service';
import { LeasesService } from './services/leases.service';
import { RentalPeriodsService } from './services/rental-periods.service';
import { TransactionsService } from './services/transactions.service';
import { TransactionsController } from './transactions.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Lease.name, schema: LeaseSchema },
      { name: RentalPeriod.name, schema: RentalPeriodSchema },
      { name: Transaction.name, schema: TransactionSchema },
      { name: Unit.name, schema: UnitSchema },
      { name: Tenant.name, schema: TenantSchema },
      { name: User.name, schema: UserSchema },
      { name: Property.name, schema: PropertySchema },
      { name: MaintenanceTicket.name, schema: MaintenanceTicketSchema },
    ]),
    NestjsFormDataModule,
    CaslModule,
    CommonModule,
    forwardRef(() => MaintenanceModule),
    MediaModule,
    NotificationsModule,
    PropertiesModule,
    TenantsModule,
    UsersModule,
  ],
  controllers: [LeasesController, RentalPeriodsController, TransactionsController],
  providers: [LeasesService, RentalPeriodsService, TransactionsService, AutoRenewalService],
  exports: [LeasesService, RentalPeriodsService, TransactionsService, AutoRenewalService],
})
export class LeasesModule {}
