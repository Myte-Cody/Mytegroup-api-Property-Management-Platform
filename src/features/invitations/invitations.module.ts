import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CaslModule } from '../../common/casl/casl.module';
import { ContractorModule } from '../contractors/contractor.module';
import {
  MaintenanceTicket,
  MaintenanceTicketSchema,
} from '../maintenance/schemas/maintenance-ticket.schema';
import { Property, PropertySchema } from '../properties/schemas/property.schema';
import { Unit, UnitSchema } from '../properties/schemas/unit.schema';
import { TenantsModule } from '../tenants/tenant.module';
import { User, UserSchema } from '../users/schemas/user.schema';
import { UsersModule } from '../users/users.module';
import { InvitationsController } from './invitations.controller';
import { InvitationsService } from './invitations.service';
import { Invitation, InvitationSchema } from './schemas/invitation.schema';
import { ContractorInvitationStrategy } from './strategies/contractor-invitation.strategy';
import { InvitationStrategyFactory } from './strategies/invitation-strategy.factory';
import { LandlordStaffInvitationStrategy } from './strategies/landlord-staff-invitation.strategy';
import { TenantInvitationStrategy } from './strategies/tenant-invitation.strategy';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Invitation.name, schema: InvitationSchema },
      { name: User.name, schema: UserSchema },
      { name: Property.name, schema: PropertySchema },
      { name: Unit.name, schema: UnitSchema },
      { name: MaintenanceTicket.name, schema: MaintenanceTicketSchema },
    ]),
    CaslModule,
    UsersModule,
    TenantsModule,
    ContractorModule,
  ],
  controllers: [InvitationsController],
  providers: [
    InvitationsService,
    InvitationStrategyFactory,
    TenantInvitationStrategy,
    ContractorInvitationStrategy,
    LandlordStaffInvitationStrategy,
  ],
  exports: [InvitationsService, MongooseModule],
})
export class InvitationsModule {}
