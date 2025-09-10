import {
  AbilityBuilder,
  createMongoAbility,
  ExtractSubjectType,
  InferSubjects,
  MongoAbility,
  MongoQuery,
} from '@casl/ability';
import { Injectable } from '@nestjs/common';
import { Property } from '../../features/properties/schemas/property.schema';
import { Unit } from '../../features/properties/schemas/unit.schema';
import { User } from '../../features/users/schemas/user.schema';
import { Tenant } from '../../features/tenants/schema/tenant.schema';
import { Contractor } from '../../features/contractors/schema/contractor.schema';
import { UserType } from '../enums/user-type.enum';

// Centralized subject mapping
export const SUBJECTS = {
  USER: User,
  PROPERTY: Property,
  UNIT: Unit,
  TENANT: Tenant,
  CONTRACTOR: Contractor,
} as const;

// Subject model name mapping for detectSubjectType
const SUBJECT_MODEL_MAPPING = {
  User: User,
  Property: Property,
  Unit: Unit,
  Tenant: Tenant,
  Contractor: Contractor,
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
  
  createForUser(user: User): AppAbility {
    const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

    // Handle both populated and unpopulated landlord_id
    const landlordId = user.landlord_id && typeof user.landlord_id === 'object' 
      ? (user.landlord_id as any)._id 
      : user.landlord_id;

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

    console.log('✅ CASL Debug - User type:', user.user_type);

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

  private defineLandlordPermissions(can: any, cannot: any, user: User) {
    // Landlords can manage all resources within their tenant
    can(Action.Manage, Property);
    can(Action.Manage, Unit);
    can(Action.Manage, Tenant);
    can(Action.Manage, Contractor);

    // But they cannot change landlord_id (tenant boundary)
    cannot(Action.Update, Property, ['landlord_id']);
  }

  private defineTenantPermissions(can: any, cannot: any, user: User) {
    // Tenants can only read properties and units
    can(Action.Read, Property);
    can(Action.Read, Unit);

    // Tenants can read their own tenant record
    const tenantId = user.party_id && typeof user.party_id === 'object' 
      ? (user.party_id as any)._id 
      : user.party_id;
    
    if (tenantId) {
      can(Action.Read, Tenant, { _id: tenantId });
    }

    // Cannot create, update, or delete
    cannot(Action.Create, Property);
    cannot(Action.Update, Property);
    cannot(Action.Delete, Property);
    cannot(Action.Create, Unit);
    cannot(Action.Update, Unit);
    cannot(Action.Delete, Unit);
    cannot(Action.Create, Tenant);
    cannot(Action.Update, Tenant);
    cannot(Action.Delete, Tenant);
  }

  private defineContractorPermissions(can: any, cannot: any, user: User) {
    // Contractors can read properties and units for work purposes
    can(Action.Read, Property);
    can(Action.Read, Unit);

    // Can update certain unit fields (e.g., maintenance status)
    can(Action.Update, Unit, ['maintenanceStatus', 'notes']);

    // Contractors can read their own contractor record
    const contractorId = user.party_id && typeof user.party_id === 'object' 
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
  }
}
