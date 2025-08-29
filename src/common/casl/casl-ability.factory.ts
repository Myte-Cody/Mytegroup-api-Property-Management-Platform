import {
  AbilityBuilder,
  createMongoAbility,
  ExtractSubjectType,
  InferSubjects,
  MongoAbility,
  MongoQuery,
} from '@casl/ability';
import { Injectable } from '@nestjs/common';
import { Organization } from '../../features/organizations/schemas/organization.schema';
import { Property } from '../../features/properties/schemas/property.schema';
import { Unit } from '../../features/properties/schemas/unit.schema';
import { User } from '../../features/users/schemas/user.schema';
import { OrganizationType } from '../enums/organization.enum';

// Centralized subject mapping
export const SUBJECTS = {
  USER: User,
  ORGANIZATION: Organization,
  PROPERTY: Property,
  UNIT: Unit,
} as const;

// Subject model name mapping for detectSubjectType
const SUBJECT_MODEL_MAPPING = {
  User: User,
  Organization: Organization,
  Property: Property,
  Unit: Unit,
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
  createForUser(user: User & { organization?: Organization; isAdmin?: boolean }): AppAbility {
    const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

    // System admins have full access to everything
    if (user.isAdmin) {
      can(Action.Manage, 'all');
      return build({
        detectSubjectType: (item) => item.constructor as ExtractSubjectType<Subjects>,
      });
    }

    // All authenticated users can read their own profile
    const userId = user._id.toString();
    can(Action.Read, User, { _id: userId });
    can(Action.Update, User, { _id: userId });

    // Organization-specific permissions (only for non-admin users with organizations)
    if (user.organization) {
      switch (user.organization.type) {
        case OrganizationType.LANDLORD:
          this.defineLandlordPermissions(
            can,
            cannot,
            user as User & { organization: Organization },
          );
          break;

        case OrganizationType.PROPERTY_MANAGER:
          this.definePropertyManagerPermissions(
            can,
            cannot,
            user as User & { organization: Organization },
          );
          break;

        case OrganizationType.TENANT:
          this.defineTenantPermissions(can, cannot, user as User & { organization: Organization });
          break;

        case OrganizationType.CONTRACTOR:
          this.defineContractorPermissions(
            can,
            cannot,
            user as User & { organization: Organization },
          );
          break;
      }
    }

    const builtAbility = build({
      detectSubjectType: (item) => {
        if (item && item.constructor && (item.constructor as any).modelName) {
          const modelName = (item.constructor as any)
            .modelName as keyof typeof SUBJECT_MODEL_MAPPING;
          return (
            SUBJECT_MODEL_MAPPING[modelName] || (item.constructor as ExtractSubjectType<Subjects>)
          );
        }

        // Fallback to constructor for non-Mongoose objects
        return item.constructor as ExtractSubjectType<Subjects>;
      },
    });

    return builtAbility;
  }

  private defineLandlordPermissions(
    can: any,
    cannot: any,
    user: User & { organization: Organization },
  ) {
    const organizationId = user.organization._id.toString();

    // Landlords can manage their own organization
    can(Action.Read, Organization, { _id: organizationId });
    can(Action.Update, Organization, { _id: organizationId });

    // Landlords can manage users in their organization
    can(Action.Manage, User, { organization: organizationId });

    // Landlords can manage their own properties
    can(Action.Manage, Property, { owner: organizationId });

    // Landlords can manage units in their properties
    can(Action.Manage, Unit);
    // Also explicitly grant read access to ensure query works
    can(Action.Read, Unit);
  }

  private definePropertyManagerPermissions(
    can: any,
    cannot: any,
    user: User & { organization: Organization },
  ) {
    const organizationId = user.organization._id.toString();

    // Property managers can read their own organization
    can(Action.Read, Organization, { _id: organizationId });
    can(Action.Update, Organization, { _id: organizationId });

    // Property managers can manage users in their organization
    can(Action.Manage, User, { organization: organizationId });

    // TODO Property managers can read and update properties they manage

    // Property managers can manage units in properties they manage
    can(Action.Manage, Unit);
    // Also explicitly grant read access to ensure query works
    can(Action.Read, Unit);
  }

  private defineTenantPermissions(
    can: any,
    cannot: any,
    user: User & { organization: Organization },
  ) {
    const organizationId = user.organization._id.toString();

    // Tenants can read their own organization
    can(Action.Read, Organization, { _id: organizationId });

    // Tenants can read other users in their organization
    can(Action.Read, User, { organization: organizationId });

    // Tenants can read properties and units (but not modify them)
    can(Action.Read, Property);
    can(Action.Read, Unit);

    // Tenants cannot create, update, or delete properties or units
    cannot(Action.Create, Property);
    cannot(Action.Update, Property);
    cannot(Action.Delete, Property);
    cannot(Action.Create, Unit);
    cannot(Action.Update, Unit);
    cannot(Action.Delete, Unit);
  }

  private defineContractorPermissions(
    can: any,
    cannot: any,
    user: User & { organization: Organization },
  ) {
    const organizationId = user.organization._id.toString();

    // Contractors can read their own organization
    can(Action.Read, Organization, { _id: organizationId });

    // Contractors can read properties and units for work purposes
    can(Action.Read, Property);
    can(Action.Read, Unit);

    // Contractors cannot create or delete properties or units
    cannot(Action.Create, Property);
    cannot(Action.Update, Property);
    cannot(Action.Delete, Property);
    cannot(Action.Create, Unit);
    cannot(Action.Delete, Unit);
  }
}
