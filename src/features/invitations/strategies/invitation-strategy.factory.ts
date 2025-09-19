import { Injectable } from '@nestjs/common';
import { EntityType } from '../schemas/invitation.schema';
import { ContractorInvitationStrategy } from './contractor-invitation.strategy';
import { IInvitationStrategy } from './invitation-strategy.interface';
import { TenantInvitationStrategy } from './tenant-invitation.strategy';

@Injectable()
export class InvitationStrategyFactory {
  constructor(
    private readonly tenantInvitationStrategy: TenantInvitationStrategy,
    private readonly contractorInvitationStrategy: ContractorInvitationStrategy,
  ) {}

  getStrategy(entityType: EntityType): IInvitationStrategy {
    switch (entityType) {
      case EntityType.TENANT:
        return this.tenantInvitationStrategy;
      case EntityType.CONTRACTOR:
        return this.contractorInvitationStrategy;
      default:
        throw new Error(`No strategy found for entity type: ${entityType}`);
    }
  }
}