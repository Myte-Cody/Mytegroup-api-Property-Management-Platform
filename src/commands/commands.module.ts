import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from '../features/users/users.module';
import { BackfillEmailTemplatesCommand } from './backfill-email-templates.command';
import { BackfillUserRolesCommand } from './backfill-user-roles.command';
import { SeedAllCommand } from './seed-all.command';
import { SeedDevDataCommand } from './seed-dev-data.command';
import { SeedersService } from './seeders.service';

import { Contractor, ContractorSchema } from '../features/contractors/schema/contractor.schema';
import {
  EmailTemplate,
  EmailTemplateSchema,
} from '../features/email/schemas/email-template.schema';
import { Landlord, LandlordSchema } from '../features/landlords/schema/landlord.schema';
import { Lease, LeaseSchema } from '../features/leases/schemas/lease.schema';
import { RentalPeriod, RentalPeriodSchema } from '../features/leases/schemas/rental-period.schema';
import { Transaction, TransactionSchema } from '../features/leases/schemas/transaction.schema';
import {
  MaintenanceTicket,
  MaintenanceTicketSchema,
} from '../features/maintenance/schemas/maintenance-ticket.schema';
import {
  ScopeOfWork,
  ScopeOfWorkSchema,
} from '../features/maintenance/schemas/scope-of-work.schema';
import { Property, PropertySchema } from '../features/properties/schemas/property.schema';
import { Unit, UnitSchema } from '../features/properties/schemas/unit.schema';
import { Tenant, TenantSchema } from '../features/tenants/schema/tenant.schema';
import { User, UserSchema } from '../features/users/schemas/user.schema';

@Module({
  imports: [
    UsersModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Landlord.name, schema: LandlordSchema },
      { name: Tenant.name, schema: TenantSchema },
      { name: Contractor.name, schema: ContractorSchema },
      { name: Property.name, schema: PropertySchema },
      { name: Unit.name, schema: UnitSchema },
      { name: Lease.name, schema: LeaseSchema },
      { name: RentalPeriod.name, schema: RentalPeriodSchema },
      { name: Transaction.name, schema: TransactionSchema },
      { name: MaintenanceTicket.name, schema: MaintenanceTicketSchema },
      { name: ScopeOfWork.name, schema: ScopeOfWorkSchema },
      { name: EmailTemplate.name, schema: EmailTemplateSchema },
    ]),
  ],
  providers: [
    SeedAllCommand,
    SeedDevDataCommand,
    SeedersService,
    BackfillUserRolesCommand,
    BackfillEmailTemplatesCommand,
  ],
})
export class CommandsModule {}
