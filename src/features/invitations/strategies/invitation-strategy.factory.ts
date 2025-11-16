import { Injectable } from '@nestjs/common';
import { EntityType } from '../schemas/invitation.schema';
import { ContractorInvitationStrategy } from './contractor-invitation.strategy';
import { IInvitationStrategy } from './invitation-strategy.interface';
import { LandlordStaffInvitationStrategy } from './landlord-staff-invitation.strategy';
import { TenantInvitationStrategy } from './tenant-invitation.strategy';

@Injectable()
export class InvitationStrategyFactory {
  constructor(
    private readonly tenantInvitationStrategy: TenantInvitationStrategy,
    private readonly contractorInvitationStrategy: ContractorInvitationStrategy,
    private readonly landlordStaffInvitationStrategy: LandlordStaffInvitationStrategy,
  ) {}

  getStrategy(entityType: EntityType): IInvitationStrategy {
    switch (entityType) {
      case EntityType.TENANT:
        return this.tenantInvitationStrategy;
      case EntityType.CONTRACTOR:
        return this.contractorInvitationStrategy;
      case EntityType.LANDLORD_STAFF:
        return this.landlordStaffInvitationStrategy;
      default:
        throw new Error(`No strategy found for entity type: ${entityType}`);
    }
  }
}
