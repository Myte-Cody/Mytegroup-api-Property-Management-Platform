import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CaslModule } from '../../common/casl/casl.module';
import { ContractorModule } from '../contractors/contractor.module';
import { TenantsModule } from '../tenants/tenant.module';
import { User, UserSchema } from '../users/schemas/user.schema';
import { UsersModule } from '../users/users.module';
import { InvitationsController } from './invitations.controller';
import { InvitationsService } from './invitations.service';
import { Invitation, InvitationSchema } from './schemas/invitation.schema';
import { ContractorInvitationStrategy } from './strategies/contractor-invitation.strategy';
import { InvitationStrategyFactory } from './strategies/invitation-strategy.factory';
import { TenantInvitationStrategy } from './strategies/tenant-invitation.strategy';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Invitation.name, schema: InvitationSchema },
      { name: User.name, schema: UserSchema },
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
  ],
  exports: [InvitationsService, MongooseModule],
})
export class InvitationsModule {}
