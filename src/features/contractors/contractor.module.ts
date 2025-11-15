import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CaslModule } from '../../common/casl/casl.module';
import {
  MaintenanceTicket,
  MaintenanceTicketSchema,
} from '../maintenance/schemas/maintenance-ticket.schema';
import { Property, PropertySchema } from '../properties/schemas/property.schema';
import { Unit, UnitSchema } from '../properties/schemas/unit.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { UsersModule } from '../users/users.module';
import { ContractorsController } from './contractors.controller';
import { ContractorsService } from './contractors.service';
import { Contractor, ContractorSchema } from './schema/contractor.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Contractor.name, schema: ContractorSchema },
      { name: Property.name, schema: PropertySchema },
      { name: Unit.name, schema: UnitSchema },
      { name: User.name, schema: UserSchema },
      { name: MaintenanceTicket.name, schema: MaintenanceTicketSchema },
    ]),
    CaslModule,
    UsersModule,
  ],
  controllers: [ContractorsController],
  providers: [ContractorsService],
  exports: [ContractorsService],
})
export class ContractorModule {}
