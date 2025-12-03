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
import { Expense } from '../../features/expenses/schemas/expense.schema';
import { FeedPost } from '../../features/feed-posts/schemas/feed-post.schema';
import { Invitation } from '../../features/invitations/schemas/invitation.schema';
import { Lease } from '../../features/leases/schemas/lease.schema';
import { RentalPeriod } from '../../features/leases/schemas/rental-period.schema';
import { Transaction } from '../../features/leases/schemas/transaction.schema';
import { Invoice } from '../../features/maintenance/schemas/invoice.schema';
import { MaintenanceTicket } from '../../features/maintenance/schemas/maintenance-ticket.schema';
import { ScopeOfWork } from '../../features/maintenance/schemas/scope-of-work.schema';
import { ThreadMessage } from '../../features/maintenance/schemas/thread-message.schema';
import { ThreadParticipant } from '../../features/maintenance/schemas/thread-participant.schema';
import { Thread } from '../../features/maintenance/schemas/thread.schema';
import { Media } from '../../features/media/schemas/media.schema';
import { Property } from '../../features/properties/schemas/property.schema';
import { Unit } from '../../features/properties/schemas/unit.schema';
import { Tenant } from '../../features/tenants/schema/tenant.schema';
import { User, UserDocument } from '../../features/users/schemas/user.schema';
import { UserRole } from '../enums/user-role.enum';
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
  MAINTENANCE_TICKET: MaintenanceTicket,
  SCOPE_OF_WORK: ScopeOfWork,
  INVOICE: Invoice,
  EXPENSE: Expense,
  THREAD: Thread,
  THREAD_MESSAGE: ThreadMessage,
  THREAD_PARTICIPANT: ThreadParticipant,
  FEED_POST: FeedPost,
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
  MaintenanceTicket: MaintenanceTicket,
  ScopeOfWork: ScopeOfWork,
  Invoice: Invoice,
  Expense: Expense,
  Thread: Thread,
  ThreadMessage: ThreadMessage,
  ThreadParticipant: ThreadParticipant,
  FeedPost: FeedPost,
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
    const resolvedRole = this.getRoleForUser(user);

    switch (resolvedRole) {
      case UserRole.SUPER_ADMIN:
      case UserRole.LANDLORD_ADMIN:
        this.defineLandlordAdminPermissions(can, cannot, user);
        break;
      case UserRole.LANDLORD_STAFF:
        this.defineLandlordStaffPermissions(can, cannot, user);
        break;
      case UserRole.TENANT:
        this.defineTenantPermissions(can, cannot, user);
        break;
      case UserRole.CONTRACTOR:
        this.defineContractorPermissions(can, cannot, user);
        break;
      default:
        switch (user.user_type) {
          case UserType.LANDLORD:
            this.defineLandlordAdminPermissions(can, cannot, user);
            break;
          case UserType.TENANT:
            this.defineTenantPermissions(can, cannot, user);
            break;
          case UserType.CONTRACTOR:
            this.defineContractorPermissions(can, cannot, user);
            break;
          default:
            break;
        }
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

  private defineLandlordAdminPermissions(can: any, cannot: any, user: UserDocument) {
    const landlordId = user.user_type === UserType.LANDLORD ? user.organization_id : null;

    // SuperAdmins can manage all without restrictions
    if (user.role === UserRole.SUPER_ADMIN) {
      can(Action.Manage, 'all');
      return;
    }

    // Landlord-scoped resources (isolated per landlord)
    can(Action.Manage, Property, { landlord: landlordId });
    can(Action.Manage, Unit, { landlord: landlordId });
    can(Action.Manage, Lease, { landlord: landlordId });
    can(Action.Manage, RentalPeriod, { landlord: landlordId });
    can(Action.Manage, Transaction, { landlord: landlordId });
    can(Action.Manage, MaintenanceTicket, { landlord: landlordId });
    can(Action.Manage, ScopeOfWork, { landlord: landlordId });
    can(Action.Manage, Invoice, { landlord: landlordId });
    can(Action.Manage, Expense, { landlord: landlordId });

    // Shared resources - landlords can only see tenants/contractors that have their ID in landlords array
    // They can also invite (create invitations for) new tenants/contractors
    can(Action.Read, Tenant, { landlords: landlordId });
    can(Action.Update, Tenant, { landlords: landlordId });
    can(Action.Delete, Tenant, { landlords: landlordId });
    can(Action.Read, Contractor, { landlords: landlordId });
    can(Action.Update, Contractor, { landlords: landlordId });
    can(Action.Delete, Contractor, { landlords: landlordId });

    // Other resources
    can(Action.Manage, Invitation);
    can(Action.Manage, Media);
    can(Action.Manage, User);
    can(Action.Manage, Thread);
    can(Action.Manage, ThreadMessage);
    can(Action.Manage, ThreadParticipant);
    can(Action.Manage, FeedPost);
  }

  private getRoleForUser(user: UserDocument): UserRole | null {
    if (user.role) {
      return user.role as UserRole;
    }

    switch (user.user_type) {
      case UserType.LANDLORD:
        return user.isPrimary ? UserRole.LANDLORD_ADMIN : UserRole.LANDLORD_STAFF;
      case UserType.TENANT:
        return UserRole.TENANT;
      case UserType.CONTRACTOR:
        return UserRole.CONTRACTOR;
      case UserType.ADMIN:
        return UserRole.SUPER_ADMIN;
      default:
        return null;
    }
  }

  private defineLandlordStaffPermissions(can: any, cannot: any, user: UserDocument) {
    const landlordId = user.user_type === UserType.LANDLORD ? user.organization_id : null;

    // Landlord-scoped resources (isolated per landlord)
    can(Action.Manage, Property, { landlord: landlordId });
    can(Action.Manage, Unit, { landlord: landlordId });
    can(Action.Manage, MaintenanceTicket, { landlord: landlordId });
    can(Action.Manage, ScopeOfWork, { landlord: landlordId });
    can(Action.Manage, Lease, { landlord: landlordId });
    can(Action.Manage, RentalPeriod, { landlord: landlordId });

    // Staff can read financial data but limited update permissions
    can(Action.Read, Transaction, { landlord: landlordId });
    can(Action.Read, Expense, { landlord: landlordId });
    can(Action.Read, Invoice, { landlord: landlordId });

    // Shared resources - staff can only see tenants/contractors that have their landlord ID in landlords array
    can(Action.Read, Tenant, { landlords: landlordId });
    can(Action.Read, Contractor, { landlords: landlordId });

    // Other resources
    can(Action.Manage, Invitation);
    can(Action.Manage, Media);
    can(Action.Manage, Thread);
    can(Action.Manage, ThreadMessage);
    can(Action.Manage, ThreadParticipant);
    can(Action.Manage, FeedPost);

    // Staff cannot manage other user accounts or elevate permissions
    cannot(Action.Manage, User);
  }

  private defineTenantPermissions(can: any, cannot: any, user: UserDocument) {
    // Tenants can only read properties and units
    can(Action.Read, Property);
    can(Action.Read, Unit);
    can(Action.Read, Media);

    // Tenants can read leases they are associated with
    const tenantOrganizationId =
      user.organization_id && typeof user.organization_id === 'object'
        ? (user.organization_id as any)._id
        : user.organization_id;

    if (tenantOrganizationId) {
      can(Action.Read, Lease, { tenant: tenantOrganizationId });
      can(Action.Read, RentalPeriod, { lease: { tenant: tenantOrganizationId } });
      can(Action.Read, Transaction, { lease: { tenant: tenantOrganizationId } });
    }

    // Tenants can read their own tenant record
    const tenantId =
      user.organization_id && typeof user.organization_id === 'object'
        ? (user.organization_id as any)._id
        : user.organization_id;

    if (tenantId) {
      can(Action.Read, Tenant, { _id: tenantId });
    }

    // Tenants can manage tenant users with the same organization_id (same tenant entity)
    if (tenantOrganizationId) {
      can(Action.Manage, User, {
        organization_id: tenantOrganizationId,
        user_type: UserType.TENANT,
      });

      // Explicitly add read permission to ensure accessibleBy works correctly
      can(Action.Read, User, {
        organization_id: tenantOrganizationId,
        user_type: UserType.TENANT,
      });

      // Tenants can also read other tenant users (neighbors)
      // The actual neighbor validation is done in the service layer
      can(Action.Read, User, {
        user_type: UserType.TENANT,
      });
    }

    // Tenants can create and read maintenance tickets they requested
    can(Action.Create, MaintenanceTicket);
    can(Action.Read, MaintenanceTicket);
    if (user._id) {
      can(Action.Update, MaintenanceTicket, { requestedBy: user._id });
    }

    // Tenants can only read scope of work (cannot create)
    can(Action.Read, ScopeOfWork);

    // Tenants can read threads and create messages in threads
    can(Action.Read, Thread);
    can(Action.Create, ThreadMessage);
    can(Action.Read, ThreadMessage);
    can(Action.Read, ThreadParticipant);
    can(Action.Update, ThreadParticipant); // For accepting/declining threads

    // Tenants can read all feed posts and react (upvote/downvote)
    can(Action.Read, FeedPost);
    can(Action.Update, FeedPost); // For voting actions

    // Tenants can create media (for chat messages and other uploads)
    can(Action.Create, Media);

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
    cannot(Action.Delete, MaintenanceTicket);
    cannot(Action.Create, ScopeOfWork);
    cannot(Action.Update, ScopeOfWork);
    cannot(Action.Delete, ScopeOfWork);
    cannot(Action.Read, Invoice);
    cannot(Action.Create, Invoice);
    cannot(Action.Update, Invoice);
    cannot(Action.Delete, Invoice);

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
    const contractorOrganizationId =
      user.organization_id && typeof user.organization_id === 'object'
        ? (user.organization_id as any)._id
        : user.organization_id;

    if (contractorOrganizationId) {
      can(Action.Read, Contractor, { _id: contractorOrganizationId });

      // Contractors can manage users with the same organization_id (same contractor entity)
      can(Action.Manage, User, {
        organization_id: contractorOrganizationId,
        user_type: UserType.CONTRACTOR,
      });

      // Explicitly add read permission to ensure accessibleBy works correctly
      can(Action.Read, User, {
        organization_id: contractorOrganizationId,
        user_type: UserType.CONTRACTOR,
      });

      // Contractors can read all maintenance tickets and update tickets assigned to them
      can(Action.Read, MaintenanceTicket);
      can(Action.Update, MaintenanceTicket, { assignedContractor: contractorOrganizationId });

      // Contractors can read all scope of work and update scopes assigned to them
      can(Action.Read, ScopeOfWork);
      can(Action.Update, ScopeOfWork, { assignedContractor: contractorOrganizationId });

      // Contractors can read threads and create messages in threads
      can(Action.Read, Thread);
      can(Action.Create, ThreadMessage);
      can(Action.Read, ThreadMessage);
      can(Action.Read, ThreadParticipant);
      can(Action.Update, ThreadParticipant); // For accepting/declining threads
    }
    can(Action.Create, Invoice);
    can(Action.Read, Invoice);
    can(Action.Delete, Invoice);

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
    cannot(Action.Create, MaintenanceTicket); // Only landlords and tenants can create tickets
    cannot(Action.Delete, MaintenanceTicket);
    cannot(Action.Create, ScopeOfWork); // Only landlords can create scope of work
    cannot(Action.Delete, ScopeOfWork);

    // Contractors cannot manage non-contractor users
    cannot(Action.Manage, User, { user_type: UserType.LANDLORD });
    cannot(Action.Manage, User, { user_type: UserType.TENANT });
    cannot(Action.Manage, User, { user_type: UserType.ADMIN });
  }
}
