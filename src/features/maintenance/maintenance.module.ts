import { HttpModule } from '@nestjs/axios';
import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NestjsFormDataModule } from 'nestjs-form-data';
import { CaslModule } from '../../common/casl/casl.module';
import { AiModule } from '../ai/ai.module';
import { Availability, AvailabilitySchema } from '../availability/schemas/availability.schema';
import { ContractorModule } from '../contractors/contractor.module';
import { Contractor, ContractorSchema } from '../contractors/schema/contractor.schema';
import { LeasesModule } from '../leases/leases.module';
import { Lease, LeaseSchema } from '../leases/schemas/lease.schema';
import { MediaModule } from '../media/media.module';
import { Media, MediaSchema } from '../media/schemas/media.schema';
import { NotificationsModule } from '../notifications/notifications.module';
import { PropertiesModule } from '../properties/properties.module';
import { Property, PropertySchema } from '../properties/schemas/property.schema';
import { Unit, UnitSchema } from '../properties/schemas/unit.schema';
import { Tenant, TenantSchema } from '../tenants/schema/tenant.schema';
import { TenantsModule } from '../tenants/tenant.module';
import { User, UserSchema } from '../users/schemas/user.schema';
import { MaintenanceTicketsController } from './controllers/maintenance-tickets.controller';
import { ScopeOfWorkController } from './controllers/scope-of-work.controller';
import { TicketCommentsController } from './controllers/ticket-comments.controller';
import { VisitRequestController } from './controllers/visit-request.controller';
import { Invoice, InvoiceSchema } from './schemas/invoice.schema';
import { MaintenanceTicket, MaintenanceTicketSchema } from './schemas/maintenance-ticket.schema';
import { ScopeOfWork, ScopeOfWorkSchema } from './schemas/scope-of-work.schema';
import { ThreadMessage, ThreadMessageSchema } from './schemas/thread-message.schema';
import { ThreadParticipant, ThreadParticipantSchema } from './schemas/thread-participant.schema';
import { Thread, ThreadSchema } from './schemas/thread.schema';
import { TicketComment, TicketCommentSchema } from './schemas/ticket-comment.schema';
import { VisitRequest, VisitRequestSchema } from './schemas/visit-request.schema';
import { InvoicesService } from './services/invoices.service';
import { MaintenanceTicketsService } from './services/maintenance-tickets.service';
import { ScopeOfWorkService } from './services/scope-of-work.service';
import { ThreadsService } from './services/threads.service';
import { TicketCommentsService } from './services/ticket-comments.service';
import { VisitRequestService } from './services/visit-request.service';
import { VoiceTicketService } from './services/voice-ticket.service';

@Module({
  imports: [
    HttpModule,
    MongooseModule.forFeature([
      { name: MaintenanceTicket.name, schema: MaintenanceTicketSchema },
      { name: TicketComment.name, schema: TicketCommentSchema },
      { name: Contractor.name, schema: ContractorSchema },
      { name: Tenant.name, schema: TenantSchema },
      { name: User.name, schema: UserSchema },
      { name: Lease.name, schema: LeaseSchema },
      { name: Property.name, schema: PropertySchema },
      { name: Unit.name, schema: UnitSchema },
      { name: ScopeOfWork.name, schema: ScopeOfWorkSchema },
      { name: Invoice.name, schema: InvoiceSchema },
      { name: Thread.name, schema: ThreadSchema },
      { name: ThreadMessage.name, schema: ThreadMessageSchema },
      { name: ThreadParticipant.name, schema: ThreadParticipantSchema },
      { name: Media.name, schema: MediaSchema },
      { name: VisitRequest.name, schema: VisitRequestSchema },
      { name: Availability.name, schema: AvailabilitySchema },
    ]),
    CaslModule,
    PropertiesModule,
    TenantsModule,
    ContractorModule,
    forwardRef(() => LeasesModule),
    MediaModule,
    NestjsFormDataModule,
    AiModule,
    NotificationsModule,
  ],
  controllers: [
    MaintenanceTicketsController,
    TicketCommentsController,
    ScopeOfWorkController,
    VisitRequestController,
  ],
  providers: [
    MaintenanceTicketsService,
    TicketCommentsService,
    ScopeOfWorkService,
    InvoicesService,
    ThreadsService,
    VoiceTicketService,
    VisitRequestService,
  ],
  exports: [
    MaintenanceTicketsService,
    TicketCommentsService,
    ScopeOfWorkService,
    InvoicesService,
    ThreadsService,
    VisitRequestService,
  ],
})
export class MaintenanceModule {}
