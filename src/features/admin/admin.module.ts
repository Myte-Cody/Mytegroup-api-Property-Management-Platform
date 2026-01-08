import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditLog, AuditLogSchema } from '../../common/schemas/audit-log.schema';
import { Contractor, ContractorSchema } from '../contractors/schema/contractor.schema';
import { Landlord, LandlordSchema } from '../landlords/schema/landlord.schema';
import { Lease, LeaseSchema } from '../leases/schemas/lease.schema';
import { Transaction, TransactionSchema } from '../leases/schemas/transaction.schema';
import {
  MaintenanceTicket,
  MaintenanceTicketSchema,
} from '../maintenance/schemas/maintenance-ticket.schema';
import { ScopeOfWork, ScopeOfWorkSchema } from '../maintenance/schemas/scope-of-work.schema';
import { ThreadMessage, ThreadMessageSchema } from '../maintenance/schemas/thread-message.schema';
import { Thread, ThreadSchema } from '../maintenance/schemas/thread.schema';
import { VisitRequest, VisitRequestSchema } from '../maintenance/schemas/visit-request.schema';
import { Notification, NotificationSchema } from '../notifications/schemas/notification.schema';
import { Property, PropertySchema } from '../properties/schemas/property.schema';
import { Unit, UnitSchema } from '../properties/schemas/unit.schema';
import { Task, TaskSchema } from '../tasks/schemas/task.schema';
import { Tenant, TenantSchema } from '../tenants/schema/tenant.schema';
import { User, UserSchema } from '../users/schemas/user.schema';

// Controllers
import { AdminAuditLogsController } from './controllers/admin-audit-logs.controller';
import { AdminChatController } from './controllers/admin-chat.controller';
import { AdminLeasesController } from './controllers/admin-leases.controller';
import { AdminMaintenanceController } from './controllers/admin-maintenance.controller';
import { AdminOverviewController } from './controllers/admin-overview.controller';
import { AdminPropertiesController } from './controllers/admin-properties.controller';
import { AdminTasksController } from './controllers/admin-tasks.controller';
import { AdminUsersController } from './controllers/admin-users.controller';

// Services
import { AdminAuditLogsService } from './services/admin-audit-logs.service';
import { AdminChatService } from './services/admin-chat.service';
import { AdminLeasesService } from './services/admin-leases.service';
import { AdminMaintenanceService } from './services/admin-maintenance.service';
import { AdminOverviewService } from './services/admin-overview.service';
import { AdminPropertiesService } from './services/admin-properties.service';
import { AdminTasksService } from './services/admin-tasks.service';
import { AdminUsersService } from './services/admin-users.service';

// Guards
import { AdminOnlyGuard } from './guards/admin-only.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AuditLog.name, schema: AuditLogSchema },
      { name: Landlord.name, schema: LandlordSchema },
      { name: User.name, schema: UserSchema },
      { name: Tenant.name, schema: TenantSchema },
      { name: Contractor.name, schema: ContractorSchema },
      { name: Property.name, schema: PropertySchema },
      { name: Unit.name, schema: UnitSchema },
      { name: Lease.name, schema: LeaseSchema },
      { name: Transaction.name, schema: TransactionSchema },
      { name: MaintenanceTicket.name, schema: MaintenanceTicketSchema },
      { name: ScopeOfWork.name, schema: ScopeOfWorkSchema },
      { name: VisitRequest.name, schema: VisitRequestSchema },
      { name: Thread.name, schema: ThreadSchema },
      { name: ThreadMessage.name, schema: ThreadMessageSchema },
      { name: Notification.name, schema: NotificationSchema },
      { name: Task.name, schema: TaskSchema },
    ]),
  ],
  controllers: [
    AdminOverviewController,
    AdminUsersController,
    AdminPropertiesController,
    AdminMaintenanceController,
    AdminLeasesController,
    AdminChatController,
    AdminTasksController,
    AdminAuditLogsController,
  ],
  providers: [
    AdminOnlyGuard,
    AdminOverviewService,
    AdminUsersService,
    AdminPropertiesService,
    AdminMaintenanceService,
    AdminLeasesService,
    AdminChatService,
    AdminTasksService,
    AdminAuditLogsService,
  ],
})
export class AdminModule {}
