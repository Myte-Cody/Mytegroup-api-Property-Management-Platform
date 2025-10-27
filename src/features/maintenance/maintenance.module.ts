import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NestjsFormDataModule } from 'nestjs-form-data';
import { CaslModule } from '../../common/casl/casl.module';
import { ContractorModule } from '../contractors/contractor.module';
import { Contractor, ContractorSchema } from '../contractors/schema/contractor.schema';
import { Lease, LeaseSchema, LeasesModule } from '../leases';
import { MediaModule } from '../media/media.module';
import { PropertiesModule } from '../properties/properties.module';
import { TenantsModule } from '../tenants/tenant.module';
import { MaintenanceTicketsController } from './controllers/maintenance-tickets.controller';
import { ScopeOfWorkController } from './controllers/scope-of-work.controller';
import { TicketCommentsController } from './controllers/ticket-comments.controller';
import { Invoice, InvoiceSchema } from './schemas/invoice.schema';
import { MaintenanceTicket, MaintenanceTicketSchema } from './schemas/maintenance-ticket.schema';
import { ScopeOfWork, ScopeOfWorkSchema } from './schemas/scope-of-work.schema';
import { TicketComment, TicketCommentSchema } from './schemas/ticket-comment.schema';
import { InvoicesService } from './services/invoices.service';
import { MaintenanceTicketsService } from './services/maintenance-tickets.service';
import { ScopeOfWorkService } from './services/scope-of-work.service';
import { TicketCommentsService } from './services/ticket-comments.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MaintenanceTicket.name, schema: MaintenanceTicketSchema },
      { name: TicketComment.name, schema: TicketCommentSchema },
      { name: Contractor.name, schema: ContractorSchema },
      { name: Lease.name, schema: LeaseSchema },
      { name: ScopeOfWork.name, schema: ScopeOfWorkSchema },
      { name: Invoice.name, schema: InvoiceSchema },
    ]),
    CaslModule,
    PropertiesModule,
    TenantsModule,
    ContractorModule,
    LeasesModule,
    MediaModule,
    NestjsFormDataModule,
  ],
  controllers: [MaintenanceTicketsController, TicketCommentsController, ScopeOfWorkController],
  providers: [
    MaintenanceTicketsService,
    TicketCommentsService,
    ScopeOfWorkService,
    InvoicesService,
  ],
  exports: [MaintenanceTicketsService, TicketCommentsService, ScopeOfWorkService, InvoicesService],
})
export class MaintenanceModule {}
