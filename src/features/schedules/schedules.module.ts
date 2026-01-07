import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CaslModule } from '../../common/casl/casl.module';
import { Lease, LeaseSchema } from '../leases/schemas/lease.schema';
import {
  MaintenanceTicket,
  MaintenanceTicketSchema,
} from '../maintenance/schemas/maintenance-ticket.schema';
import { NotificationsModule } from '../notifications/notifications.module';
import { Property, PropertySchema } from '../properties/schemas/property.schema';
import { Unit, UnitSchema } from '../properties/schemas/unit.schema';
import { Tenant, TenantSchema } from '../tenants/schema/tenant.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { SchedulesController } from './controllers/schedules.controller';
import { Schedule, ScheduleSchema } from './schemas/schedule.schema';
import { ScheduleReminderService } from './services/schedule-reminder.service';
import { SchedulesService } from './services/schedules.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Schedule.name, schema: ScheduleSchema },
      { name: Property.name, schema: PropertySchema },
      { name: Unit.name, schema: UnitSchema },
      { name: Lease.name, schema: LeaseSchema },
      { name: User.name, schema: UserSchema },
      { name: Tenant.name, schema: TenantSchema },
      { name: MaintenanceTicket.name, schema: MaintenanceTicketSchema },
    ]),
    CaslModule,
    forwardRef(() => NotificationsModule),
  ],
  controllers: [SchedulesController],
  providers: [SchedulesService, ScheduleReminderService],
  exports: [SchedulesService, ScheduleReminderService],
})
export class SchedulesModule {}
