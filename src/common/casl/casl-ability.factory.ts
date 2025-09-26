import {
  AbilityBuilder,
  createMongoAbility,
  ExtractSubjectType,
  InferSubjects,
  MongoAbility,
  MongoQuery,
} from '@casl/ability';
import { Injectable } from '@nestjs/common';
import { Contractor } from '../../features/contractors/schema/contractor.schema';
import { Invitation } from '../../features/invitations/schemas/invitation.schema';
import { Lease } from '../../features/leases/schemas/lease.schema';
import { RentalPeriod } from '../../features/leases/schemas/rental-period.schema';
import { Transaction } from '../../features/leases/schemas/transaction.schema';
import { Media } from '../../features/media/schemas/media.schema';
import { Property } from '../../features/properties/schemas/property.schema';
import { Unit } from '../../features/properties/schemas/unit.schema';
import { Tenant } from '../../features/tenants/schema/tenant.schema';
import { User, UserDocument } from '../../features/users/schemas/user.schema';
import { UserType } from '../enums/user-type.enum';

// Centralized subject mapping
export const SUBJECTS = {
  USER: User,
  PROPERTY: Property,
  UNIT: Unit,
  TENANT: Tenant,
  CONTRACTOR: Contractor,
  INVITATION: Invitation,
  MEDIA: Media,
  LEASE: Lease,
  SUB_LEASE: RentalPeriod,
  TRANSACTION: Transaction,
} as const;

// Subject model name mapping for detectSubjectType
const SUBJECT_MODEL_MAPPING = {
  User: User,
  Property: Property,
  Unit: Unit,
  Tenant: Tenant,
  Contractor: Contractor,
  Invitation: Invitation,
  Media: Media,
  Lease: Lease,
  RentalPeriod: RentalPeriod,
  Transaction: Transaction,
} as const;

// Define actions that can be performed
export enum Action {
  Manage = 'manage',
  Create = 'create',
  Read = 'read',
  Update = 'update',
  Delete = 'delete',
}
// Define all possible subjects (resources) - built from SUBJECTS
export type Subjects = InferSubjects<(typeof SUBJECTS)[keyof typeof SUBJECTS]> | 'all';

// Define the Ability type
export type AppAbility = MongoAbility<[Action, Subjects], MongoQuery>;

@Injectable()
export class CaslAbilityFactory {
  createForUser(user: UserDocument): AppAbility {
    const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

    // Handle both populated and unpopulated tenantId
    const landlordId =
      user.tenantId && typeof user.tenantId === 'object'
        ? (user.tenantId as any)._id
        : user.tenantId;

    // All users must have a tenant context
    if (!landlordId) {
      // Users without tenant context get no permissions
      return build({
        detectSubjectType: (item) => {
          if (item && item.constructor && (item.constructor as any).modelName) {
            const modelName = (item.constructor as any)
              .modelName as keyof typeof SUBJECT_MODEL_MAPPING;
            return (
              SUBJECT_MODEL_MAPPING[modelName] || (item.constructor as ExtractSubjectType<Subjects>)
            );
          }
          return item.constructor as ExtractSubjectType<Subjects>;
        },
      });
    }

    switch (user.user_type) {
      case UserType.LANDLORD:
        this.defineLandlordPermissions(can, cannot, user);
        break;

      case UserType.TENANT:
        this.defineTenantPermissions(can, cannot, user);
        break;

      case UserType.CONTRACTOR:
        this.defineContractorPermissions(can, cannot, user);
        break;

      default:
        // Unknown user types get no permissions
        break;
    }

    return build({
      detectSubjectType: (item) => {
        if (item && item.constructor && (item.constructor as any).modelName) {
          const modelName = (item.constructor as any)
            .modelName as keyof typeof SUBJECT_MODEL_MAPPING;
          return (
            SUBJECT_MODEL_MAPPING[modelName] || (item.constructor as ExtractSubjectType<Subjects>)
          );
        }
        return item.constructor as ExtractSubjectType<Subjects>;
      },
    });
  }

  private defineLandlordPermissions(can: any, cannot: any, user: UserDocument) {
    // Get the tenantId for scoping permissions
    const landlordId =
      user.tenantId && typeof user.tenantId === 'object'
        ? (user.tenantId as any)._id
        : user.tenantId;

    // Landlords can manage all resources within their tenant context
    can(Action.Manage, Property);
    can(Action.Manage, Unit);
    can(Action.Manage, Tenant);
    can(Action.Manage, Contractor);
    can(Action.Manage, Invitation);
    can(Action.Manage, Media);
    can(Action.Manage, Lease);
    can(Action.Manage, RentalPeriod);
    can(Action.Manage, Transaction);

    // Landlords can manage all types of users within their context
    if (landlordId) {
      can(Action.Manage, User, { tenantId: landlordId });
    }
  }

  private defineTenantPermissions(can: any, cannot: any, user: UserDocument) {
    // Get the tenantId for scoping permissions
    const landlordId =
      user.tenantId && typeof user.tenantId === 'object'
        ? (user.tenantId as any)._id
        : user.tenantId;

    // Tenants can only read properties and units
    can(Action.Read, Property);
    can(Action.Read, Unit);
    can(Action.Read, Media);

    // Tenants can read leases they are associated with
    const tenantPartyId =
      user.party_id && typeof user.party_id === 'object'
        ? (user.party_id as any)._id
        : user.party_id;

    if (tenantPartyId) {
      can(Action.Read, Lease, { tenant: tenantPartyId });
      can(Action.Read, RentalPeriod, { lease: { tenant: tenantPartyId } });
      can(Action.Read, Transaction, { lease: { tenant: tenantPartyId } });
    }

    // Tenants can read their own tenant record
    const tenantId =
      user.party_id && typeof user.party_id === 'object'
        ? (user.party_id as any)._id
        : user.party_id;

    if (tenantId) {
      can(Action.Read, Tenant, { _id: tenantId });
    }

    // Tenants can manage tenant users with the same party_id (same tenant entity)
    if (tenantPartyId) {
      can(Action.Manage, User, {
        party_id: tenantPartyId,
        user_type: UserType.TENANT,
      });

      // Explicitly add read permission to ensure accessibleBy works correctly
      can(Action.Read, User, {
        party_id: tenantPartyId,
        user_type: UserType.TENANT,
      });
    }

    // Cannot create, update, or delete properties, units, and other entities
    cannot(Action.Create, Property);
    cannot(Action.Update, Property);
    cannot(Action.Delete, Property);
    cannot(Action.Create, Unit);
    cannot(Action.Update, Unit);
    cannot(Action.Delete, Unit);
    cannot(Action.Create, Tenant);
    cannot(Action.Update, Tenant);
    cannot(Action.Delete, Tenant);
    cannot(Action.Create, Media);
    cannot(Action.Update, Media);
    cannot(Action.Delete, Media);
    cannot(Action.Create, Lease);
    cannot(Action.Update, Lease);
    cannot(Action.Delete, Lease);
    cannot(Action.Create, RentalPeriod);
    cannot(Action.Update, RentalPeriod);
    cannot(Action.Delete, RentalPeriod);
    cannot(Action.Create, Transaction);
    cannot(Action.Update, Transaction);
    cannot(Action.Delete, Transaction);

    // Tenants cannot manage non-tenant users
    cannot(Action.Manage, User, { user_type: UserType.LANDLORD });
    cannot(Action.Manage, User, { user_type: UserType.CONTRACTOR });
    cannot(Action.Manage, User, { user_type: UserType.ADMIN });
  }

  private defineContractorPermissions(can: any, cannot: any, user: UserDocument) {
    // Contractors can read properties and units for work purposes
    can(Action.Read, Property);
    can(Action.Read, Unit);
    can(Action.Read, Media);
    can(Action.Read, Lease); // Contractors may need to see lease info for maintenance
    can(Action.Read, RentalPeriod);

    // Can update certain unit fields (e.g., maintenance status)
    can(Action.Update, Unit, ['maintenanceStatus', 'notes']);

    // Contractors can create media for documentation (before/after photos)
    can(Action.Create, Media);
    can(Action.Update, Media);

    // Contractors can read their own contractor record
    const contractorId =
      user.party_id && typeof user.party_id === 'object'
        ? (user.party_id as any)._id
        : user.party_id;

    if (contractorId) {
      can(Action.Read, Contractor, { _id: contractorId });
    }

    // Cannot create or delete
    cannot(Action.Create, Property);
    cannot(Action.Delete, Property);
    cannot(Action.Create, Unit);
    cannot(Action.Delete, Unit);
    cannot(Action.Create, Contractor);
    cannot(Action.Update, Contractor);
    cannot(Action.Delete, Contractor);
    cannot(Action.Delete, Media); // Contractors can't delete media
    cannot(Action.Create, Lease);
    cannot(Action.Update, Lease);
    cannot(Action.Delete, Lease);
    cannot(Action.Create, RentalPeriod);
    cannot(Action.Update, RentalPeriod);
    cannot(Action.Delete, RentalPeriod);
    cannot(Action.Create, Transaction);
    cannot(Action.Update, Transaction);
    cannot(Action.Delete, Transaction);
    cannot(Action.Read, Transaction); // Contractors don't need payment access
  }
}
