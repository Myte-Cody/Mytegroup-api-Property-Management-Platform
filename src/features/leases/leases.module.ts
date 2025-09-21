import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NestjsFormDataModule } from 'nestjs-form-data';
import { CaslModule } from '../../common/casl/casl.module';
import { CommonModule } from '../../common/common.module';
import { MediaModule } from '../media/media.module';
import { PropertiesModule } from '../properties/properties.module';
import { Unit, UnitSchema } from '../properties/schemas/unit.schema';
import { Tenant, TenantSchema } from '../tenants/schema/tenant.schema';
import { TenantsModule } from '../tenants/tenant.module';
import { User, UserSchema } from '../users/schemas/user.schema';
import { UsersModule } from '../users/users.module';
import { LeasesController } from './leases.controller';
import { TransactionsController } from './transactions.controller';
import { RentalPeriodsController } from './rental-periods.controller';
import { Lease, LeaseSchema } from './schemas/lease.schema';
import { Transaction, TransactionSchema } from './schemas/transaction.schema';
import { RentalPeriod, RentalPeriodSchema } from './schemas/rental-period.schema';
import { AutoRenewalService } from './services/auto-renewal.service';
import { LeasesService } from './services/leases.service';
import { TransactionsService } from './services/transactions.service';
import { RentalPeriodsService } from './services/rental-periods.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Lease.name, schema: LeaseSchema },
      { name: RentalPeriod.name, schema: RentalPeriodSchema },
      { name: Transaction.name, schema: TransactionSchema },
      { name: Unit.name, schema: UnitSchema },
      { name: Tenant.name, schema: TenantSchema },
      { name: User.name, schema: UserSchema },
    ]),
    NestjsFormDataModule,
    CaslModule,
    CommonModule,
    MediaModule,
    PropertiesModule,
    TenantsModule,
    UsersModule,
  ],
  controllers: [LeasesController, RentalPeriodsController, TransactionsController],
  providers: [LeasesService, RentalPeriodsService, TransactionsService, AutoRenewalService],
  exports: [LeasesService, RentalPeriodsService, TransactionsService, AutoRenewalService],
})
export class LeasesModule {}
