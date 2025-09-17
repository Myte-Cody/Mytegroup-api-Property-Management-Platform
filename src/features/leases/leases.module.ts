import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NestjsFormDataModule } from 'nestjs-form-data';
import { CaslModule } from '../../common/casl/casl.module';
import { CommonModule } from '../../common/common.module';
import { MediaModule } from '../media/media.module';
import { PropertiesModule } from '../properties/properties.module';
import { Property, PropertySchema } from '../properties/schemas/property.schema';
import { Unit, UnitSchema } from '../properties/schemas/unit.schema';
import { TenantsModule } from '../tenants/tenant.module';
import { Tenant, TenantSchema } from '../tenants/schema/tenant.schema';
import { UsersModule } from '../users/users.module';
import { User, UserSchema } from '../users/schemas/user.schema';
import { LeasesController } from './leases.controller';
import { PaymentsController } from './payments.controller';
import { Lease, LeaseSchema } from './schemas/lease.schema';
import { Payment, PaymentSchema } from './schemas/payment.schema';
import { RentalPeriod, RentalPeriodSchema } from './schemas/rental-period.schema';
import { LeasesService } from './services/leases.service';
import { PaymentsService } from './services/payments.service';
import { RentalPeriodsService } from './services/rental-periods.service';
import { RentalPeriodsController } from './rental-periods.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Lease.name, schema: LeaseSchema },
      { name: RentalPeriod.name, schema: RentalPeriodSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: Unit.name, schema: UnitSchema },
      { name: Property.name, schema: PropertySchema },
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
  controllers: [LeasesController, RentalPeriodsController, PaymentsController],
  providers: [LeasesService, RentalPeriodsService, PaymentsService],
  exports: [LeasesService, RentalPeriodsService, PaymentsService],
})
export class LeasesModule {}