import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CaslModule } from '../../common/casl/casl.module';
import { Lease, LeaseSchema } from '../leases';
import {
  MaintenanceTicket,
  MaintenanceTicketSchema,
} from '../maintenance/schemas/maintenance-ticket.schema';
import { VisitRequest, VisitRequestSchema } from '../maintenance/schemas/visit-request.schema';
import { NotificationsModule } from '../notifications/notifications.module';
import { Property, PropertySchema } from '../properties/schemas/property.schema';
import { Unit, UnitSchema } from '../properties/schemas/unit.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { AvailabilityController } from './availability.controller';
import { AvailabilityService } from './availability.service';
import { Availability, AvailabilitySchema } from './schemas/availability.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Availability.name, schema: AvailabilitySchema },
      // Required by CaslGuard
      { name: User.name, schema: UserSchema },
      { name: Property.name, schema: PropertySchema },
      { name: Unit.name, schema: UnitSchema },
      { name: Lease.name, schema: LeaseSchema },
      { name: MaintenanceTicket.name, schema: MaintenanceTicketSchema },
      { name: VisitRequest.name, schema: VisitRequestSchema },
    ]),
    CaslModule,
    NotificationsModule,
  ],
  controllers: [AvailabilityController],
  providers: [AvailabilityService],
  exports: [AvailabilityService],
})
export class AvailabilityModule {}
