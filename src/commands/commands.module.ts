import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from '../features/users/users.module';
import { SeedAllCommand } from './seed-all.command';
import { SeedDevDataCommand } from './seed-dev-data.command';
import { SeedersService } from './seeders.service';

import { Contractor, ContractorSchema } from '../features/contractors/schema/contractor.schema';
import { Landlord, LandlordSchema } from '../features/landlords/schema/landlord.schema';
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
    ]),
  ],
  providers: [SeedAllCommand, SeedDevDataCommand, SeedersService],
})
export class CommandsModule {}
