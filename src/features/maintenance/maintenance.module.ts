import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NestjsFormDataModule } from 'nestjs-form-data';
import { ContractorModule } from '../contractors/contractor.module';
import { Contractor, ContractorSchema } from '../contractors/schema/contractor.schema';
import { Lease, LeaseSchema, LeasesModule } from '../leases';
import { MediaModule } from '../media/media.module';
import { PropertiesModule } from '../properties/properties.module';
import { TenantsModule } from '../tenants/tenant.module';
import { MaintenanceTicketsController } from './controllers/maintenance-tickets.controller';
import { TicketCommentsController } from './controllers/ticket-comments.controller';
import { MaintenanceTicket, MaintenanceTicketSchema } from './schemas/maintenance-ticket.schema';
import { TicketComment, TicketCommentSchema } from './schemas/ticket-comment.schema';
import { MaintenanceTicketsService } from './services/maintenance-tickets.service';
import { TicketCommentsService } from './services/ticket-comments.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MaintenanceTicket.name, schema: MaintenanceTicketSchema },
      { name: TicketComment.name, schema: TicketCommentSchema },
      { name: Contractor.name, schema: ContractorSchema },
      { name: Lease.name, schema: LeaseSchema },
    ]),
    PropertiesModule,
    TenantsModule,
    ContractorModule,
    LeasesModule,
    MediaModule,
    NestjsFormDataModule,
  ],
  controllers: [MaintenanceTicketsController, TicketCommentsController],
  providers: [MaintenanceTicketsService, TicketCommentsService],
  exports: [MaintenanceTicketsService, TicketCommentsService],
})
export class MaintenanceModule {}
