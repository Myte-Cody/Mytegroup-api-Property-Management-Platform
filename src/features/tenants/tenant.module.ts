import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CaslModule } from '../../common/casl/casl.module';
import { Lease, LeaseSchema } from '../leases/schemas/lease.schema';
import { Transaction, TransactionSchema } from '../leases/schemas/transaction.schema';
import {
  MaintenanceTicket,
  MaintenanceTicketSchema,
} from '../maintenance/schemas/maintenance-ticket.schema';
import { Property, PropertySchema } from '../properties/schemas/property.schema';
import { Unit, UnitSchema } from '../properties/schemas/unit.schema';
import { User, UserSchema } from '../users/schemas/user.schema';

import { UsersModule } from '../users/users.module';
import { Tenant, TenantSchema } from './schema/tenant.schema';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Tenant.name, schema: TenantSchema },
      { name: Property.name, schema: PropertySchema },
      { name: Unit.name, schema: UnitSchema },
      { name: User.name, schema: UserSchema },
      { name: Lease.name, schema: LeaseSchema },
      { name: Transaction.name, schema: TransactionSchema },
      { name: MaintenanceTicket.name, schema: MaintenanceTicketSchema },
    ]),
    CaslModule,
    UsersModule,
  ],
  controllers: [TenantsController],
  providers: [TenantsService],
  exports: [TenantsService, MongooseModule],
})
export class TenantsModule {}
