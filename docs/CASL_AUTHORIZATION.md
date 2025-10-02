# CASL Authorization Documentation

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Core Concepts](#core-concepts)
4. [Implementation Details](#implementation-details)
5. [Usage Guidelines](#usage-guidelines)
6. [Role-Based Permissions](#role-based-permissions)
7. [Best Practices](#best-practices)
8. [Examples](#examples)
9. [Troubleshooting](#troubleshooting)

---

## Overview

This application uses **CASL (Code Access Security Layer)** for implementing fine-grained, attribute-based access control (ABAC). CASL provides a powerful and flexible way to manage permissions and authorization throughout the application.

### Why CASL?

- **Type-safe**: Full TypeScript support with compile-time type checking
- **Flexible**: Supports both role-based (RBAC) and attribute-based (ABAC) access control
- **Database Integration**: Seamless integration with Mongoose via `@casl/mongoose`
- **Declarative**: Define permissions in a clear, readable way
- **Testable**: Easy to test authorization logic in isolation

---

## Architecture

### Directory Structure

```
src/common/casl/
├── casl-ability.factory.ts       # Core ability definitions
├── casl.module.ts                 # Module configuration
├── decorators/
│   ├── check-policies.decorator.ts
│   └── check-ability.decorator.ts
├── guards/
│   └── casl.guard.ts              # Authorization guard
├── policies/
│   ├── property.policies.ts
│   ├── unit.policies.ts
│   ├── lease.policies.ts
│   ├── tenant.policies.ts
│   ├── user.policies.ts
│   └── ...                        # Other resource policies
└── services/
    └── casl-authorization.service.ts
```

### Key Components

1. **CaslAbilityFactory**: Creates user-specific ability instances
2. **CaslGuard**: Route guard that enforces policies
3. **Policy Handlers**: Reusable authorization logic for each resource
4. **Decorators**: Apply authorization checks to controller methods
5. **Mongoose Plugin**: Filter database queries based on permissions

---

## Core Concepts

### Actions

The application defines five core actions:

```typescript
export enum Action {
  Manage = 'manage', // Full control (includes all other actions)
  Create = 'create', // Create new resources
  Read = 'read', // View/read resources
  Update = 'update', // Modify existing resources
  Delete = 'delete', // Remove resources
}
```

### Subjects

Subjects are the resources being protected:

- **User**: User accounts
- **Property**: Real estate properties
- **Unit**: Individual rental units
- **Tenant**: Tenant profiles
- **Contractor**: Contractor profiles
- **Lease**: Rental agreements
- **RentalPeriod**: Lease rental periods
- **Transaction**: Payment transactions
- **Media**: Files and documents
- **Invitation**: User invitations

### Abilities

An **ability** is a combination of:

- **Action**: What the user wants to do
- **Subject**: The resource type or instance
- **Conditions**: Optional attribute-based conditions

Example:

```typescript
// Can read any property
ability.can(Action.Read, Property);

// Can read leases where tenant matches user's party_id
ability.can(Action.Read, Lease, { tenant: user.party_id });
```

---

## Implementation Details

### 1. Ability Factory

The `CaslAbilityFactory` creates user-specific abilities based on their role:

```typescript
@Injectable()
export class CaslAbilityFactory {
  createForUser(user: UserDocument): AppAbility {
    const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

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
    }

    return build({
      detectSubjectType: (item) => {
        // Auto-detect subject type from Mongoose model
        if (item && item.constructor && (item.constructor as any).modelName) {
          const modelName = (item.constructor as any).modelName;
          return SUBJECT_MODEL_MAPPING[modelName] || item.constructor;
        }
        return item.constructor;
      },
    });
  }
}
```

### 2. Policy Handlers

Policy handlers encapsulate authorization logic for specific actions:

```typescript
@Injectable()
export class ReadPropertyPolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User, property?: Property): boolean {
    if (property) {
      // Check permission on specific instance
      return ability.can(Action.Read, property);
    }
    // Check permission on resource type
    return ability.can(Action.Read, Property);
  }
}
```

### 3. CASL Guard

The guard enforces policies on controller routes:

```typescript
@Injectable()
export class CaslGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const policyHandlers =
      this.reflector.get<PolicyHandler[]>(CHECK_POLICIES_KEY, context.getHandler()) || [];

    if (policyHandlers.length === 0) {
      return true; // No policies = allow access
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const ability = this.caslAbilityFactory.createForUser(user);
    const resource = await this.getResource(request, context);

    for (const handler of policyHandlers) {
      const allowed = this.execPolicyHandler(handler, ability, user, resource);
      if (!allowed) {
        throw new ForbiddenException('Access denied');
      }
    }

    return true;
  }
}
```

### 4. Mongoose Integration

All schemas use the `accessibleRecordsPlugin` for query filtering:

```typescript
import { accessibleRecordsPlugin } from '@casl/mongoose';

@Schema({ timestamps: true })
export class Property extends Document {
  @Prop({ required: true })
  name: string;
  // ... other fields
}

export const PropertySchema = SchemaFactory.createForClass(Property);
PropertySchema.plugin(accessibleRecordsPlugin);
```

This enables filtering queries based on user abilities:

```typescript
// Only returns properties the user can read
const properties = await this.propertyModel.accessibleBy(ability, Action.Read).find();
```

---

## Usage Guidelines

### In Controllers

Apply the `@CheckPolicies` decorator to protect routes:

```typescript
@Controller('properties')
@UseGuards(JwtAuthGuard, CaslGuard)
@ApiBearerAuth()
export class PropertiesController {
  @Get()
  @CheckPolicies(new ReadPropertyPolicyHandler())
  async findAll(@CurrentUser() user: User) {
    return this.propertiesService.findAll(user);
  }

  @Post()
  @CheckPolicies(new CreatePropertyPolicyHandler())
  async create(@Body() dto: CreatePropertyDto, @CurrentUser() user: User) {
    return this.propertiesService.create(dto, user);
  }

  @Patch(':id')
  @CheckPolicies(new UpdatePropertyPolicyHandler())
  async update(@Param('id') id: string, @Body() dto: UpdatePropertyDto, @CurrentUser() user: User) {
    return this.propertiesService.update(id, dto, user);
  }

  @Delete(':id')
  @CheckPolicies(new DeletePropertyPolicyHandler())
  async remove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.propertiesService.remove(id, user);
  }
}
```

### In Services

Use `accessibleBy` to filter queries:

```typescript
@Injectable()
export class PropertiesService {
  constructor(
    @InjectModel(Property.name) private propertyModel: AccessibleRecordModel<Property>,
    private caslAuthorizationService: CaslAuthorizationService,
  ) {}

  async findAll(user: User): Promise<Property[]> {
    const ability = this.caslAuthorizationService.createAbilityForUser(user);

    // Only returns properties the user can read
    return this.propertyModel.accessibleBy(ability, Action.Read).find().exec();
  }

  async findOne(id: string, user: User): Promise<Property> {
    const ability = this.caslAuthorizationService.createAbilityForUser(user);

    const property = await this.propertyModel.findById(id).exec();

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    // Check if user can read this specific property
    if (!ability.can(Action.Read, property)) {
      throw new ForbiddenException('Access denied');
    }

    return property;
  }
}
```

### Custom Policy Handlers

For complex authorization logic, create custom handlers:

```typescript
@Injectable()
export class CanManageLeaseForPropertyPolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User, lease?: Lease): boolean {
    // Custom logic: Check if user owns the property associated with the lease
    if (lease && lease.unit && lease.unit.property) {
      return ability.can(Action.Manage, lease.unit.property);
    }
    return false;
  }
}
```

---

## Role-Based Permissions

### Landlord Permissions

Landlords have **full control** over all resources:

```typescript
private defineLandlordPermissions(can: any, cannot: any, user: UserDocument) {
  can(Action.Manage, Property);
  can(Action.Manage, Unit);
  can(Action.Manage, Tenant);
  can(Action.Manage, Contractor);
  can(Action.Manage, Invitation);
  can(Action.Manage, Media);
  can(Action.Manage, Lease);
  can(Action.Manage, RentalPeriod);
  can(Action.Manage, Transaction);
  can(Action.Manage, User);
}
```

**Can do:**

- ✅ Create, read, update, delete all properties and units
- ✅ Manage all tenants and contractors
- ✅ Create and manage leases
- ✅ View and process transactions
- ✅ Upload and manage media
- ✅ Invite and manage users

### Tenant Permissions

Tenants have **limited read access** to their own data:

```typescript
private defineTenantPermissions(can: any, cannot: any, user: UserDocument) {
  // Read-only access to properties and units
  can(Action.Read, Property);
  can(Action.Read, Unit);
  can(Action.Read, Media);

  // Can read their own leases
  can(Action.Read, Lease, { tenant: user.party_id });
  can(Action.Read, RentalPeriod, { lease: { tenant: user.party_id } });
  can(Action.Read, Transaction, { lease: { tenant: user.party_id } });

  // Can read their own tenant record
  can(Action.Read, Tenant, { _id: user.party_id });

  // Can manage other tenant users with same party_id
  can(Action.Manage, User, {
    party_id: user.party_id,
    user_type: UserType.TENANT,
  });

  // Explicit denials
  cannot(Action.Create, Property);
  cannot(Action.Update, Property);
  cannot(Action.Delete, Property);
  // ... (see full implementation)
}
```

**Can do:**

- ✅ View properties and units
- ✅ View their own leases and rental periods
- ✅ View their own payment transactions
- ✅ View their tenant profile
- ✅ Manage other users under the same tenant account
- ❌ Cannot create, update, or delete most resources

### Contractor Permissions

Contractors have **specialized access** for maintenance work:

```typescript
private defineContractorPermissions(can: any, cannot: any, user: UserDocument) {
  // Read access for work purposes
  can(Action.Read, Property);
  can(Action.Read, Unit);
  can(Action.Read, Media);
  can(Action.Read, Lease);
  can(Action.Read, RentalPeriod);

  // Can update specific unit fields
  can(Action.Update, Unit, ['maintenanceStatus', 'notes']);

  // Can create/update media for documentation
  can(Action.Create, Media);
  can(Action.Update, Media);

  // Can read their own contractor record
  can(Action.Read, Contractor, { _id: user.party_id });

  // Cannot access financial data
  cannot(Action.Read, Transaction);
  // ... (see full implementation)
}
```

**Can do:**

- ✅ View properties, units, and leases
- ✅ Update unit maintenance status
- ✅ Upload work documentation (photos, reports)
- ✅ View their contractor profile
- ❌ Cannot access financial/payment information
- ❌ Cannot create or delete resources

---

## Best Practices

### 1. Always Use Guards

Protect all routes with both authentication and authorization:

```typescript
@Controller('resource')
@UseGuards(JwtAuthGuard, CaslGuard) // ✅ Both guards
@ApiBearerAuth()
export class ResourceController {
  // ...
}
```

### 2. Check Policies at Controller Level

Apply `@CheckPolicies` to every protected endpoint:

```typescript
@Get(':id')
@CheckPolicies(new ReadResourcePolicyHandler())  // ✅ Explicit policy
async findOne(@Param('id') id: string) {
  // ...
}
```

### 3. Filter Queries in Services

Always use `accessibleBy` when querying collections:

```typescript
// ✅ Good: Filtered by user abilities
const items = await this.model.accessibleBy(ability, Action.Read).find();

// ❌ Bad: Returns all items regardless of permissions
const items = await this.model.find();
```

### 4. Check Individual Resources

Verify permissions on specific instances:

```typescript
const resource = await this.model.findById(id);

if (!ability.can(Action.Update, resource)) {
  // ✅ Check specific instance
  throw new ForbiddenException('Access denied');
}
```

### 5. Use Type-Safe Subjects

Always use the imported class, not strings:

```typescript
// ✅ Good: Type-safe
ability.can(Action.Read, Property);

// ❌ Bad: String-based, error-prone
ability.can(Action.Read, 'Property');
```

### 6. Test Authorization Logic

Write unit tests for ability definitions:

```typescript
describe('CaslAbilityFactory', () => {
  it('should allow landlords to manage properties', () => {
    const user = createLandlordUser();
    const ability = factory.createForUser(user);

    expect(ability.can(Action.Manage, Property)).toBe(true);
  });

  it('should prevent tenants from creating properties', () => {
    const user = createTenantUser();
    const ability = factory.createForUser(user);

    expect(ability.can(Action.Create, Property)).toBe(false);
  });
});
```

### 7. Document Custom Policies

Add clear comments for complex authorization logic:

```typescript
@Injectable()
export class CustomPolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User, resource?: Resource): boolean {
    // Allow if user is the owner OR has admin role
    // This is needed because contractors can view but not modify
    return resource.owner === user._id || user.role === 'admin';
  }
}
```

### 8. Handle Nested Resources

For nested resources, check parent permissions:

```typescript
async createUnit(propertyId: string, dto: CreateUnitDto, user: User) {
  const property = await this.propertyModel.findById(propertyId);

  // Check if user can manage the parent property
  if (!ability.can(Action.Manage, property)) {
    throw new ForbiddenException('Cannot create unit in this property');
  }

  // Proceed with creation
}
```

---

## Examples

### Example 1: Basic CRUD with Authorization

```typescript
@Controller('tenants')
@UseGuards(JwtAuthGuard, CaslGuard)
@ApiBearerAuth()
export class TenantsController {
  constructor(
    private readonly tenantsService: TenantsService,
    private readonly caslAuthorizationService: CaslAuthorizationService,
  ) {}

  @Get()
  @CheckPolicies(new ReadTenantPolicyHandler())
  async findAll(@CurrentUser() user: User) {
    const ability = this.caslAuthorizationService.createAbilityForUser(user);

    return this.tenantModel.accessibleBy(ability, Action.Read).find().exec();
  }

  @Post()
  @CheckPolicies(new CreateTenantPolicyHandler())
  async create(@Body() dto: CreateTenantDto, @CurrentUser() user: User) {
    return this.tenantsService.create(dto, user);
  }
}
```

### Example 2: Conditional Field Access

```typescript
@Injectable()
export class UpdateUnitPolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User, unit?: Unit): boolean {
    if (user.user_type === UserType.CONTRACTOR) {
      // Contractors can only update specific fields
      return ability.can(Action.Update, Unit, ['maintenanceStatus', 'notes']);
    }

    // Landlords can update any field
    return ability.can(Action.Update, Unit);
  }
}
```

### Example 3: Multi-Tenant Data Isolation

```typescript
private defineTenantPermissions(can: any, cannot: any, user: UserDocument) {
  const tenantId = user.party_id;

  // Tenant can only read leases associated with their tenant record
  can(Action.Read, Lease, { tenant: tenantId });

  // Tenant can only read transactions for their leases
  can(Action.Read, Transaction, {
    lease: { tenant: tenantId }
  });
}
```

### Example 4: Custom Authorization in Service

```typescript
@Injectable()
export class LeasesService {
  async renewLease(leaseId: string, dto: RenewLeaseDto, user: User) {
    const ability = this.caslAuthorizationService.createAbilityForUser(user);
    const lease = await this.leaseModel.findById(leaseId).populate('unit');

    // Check if user can update this lease
    if (!ability.can(Action.Update, lease)) {
      throw new ForbiddenException('Cannot renew this lease');
    }

    // Additional business logic check
    if (lease.status !== LeaseStatus.ACTIVE) {
      throw new BadRequestException('Only active leases can be renewed');
    }

    // Proceed with renewal
    return this.performRenewal(lease, dto);
  }
}
```

---

## Troubleshooting

### Issue: "Access denied" for valid operations

**Cause**: Policy handler not registered or incorrect ability definition

**Solution**:

1. Verify the policy handler is in `casl.module.ts` providers
2. Check ability definition in `CaslAbilityFactory`
3. Ensure the guard is applied: `@UseGuards(JwtAuthGuard, CaslGuard)`

### Issue: `accessibleBy` returns empty results

**Cause**: Schema missing `accessibleRecordsPlugin`

**Solution**:

```typescript
import { accessibleRecordsPlugin } from '@casl/mongoose';

export const YourSchema = SchemaFactory.createForClass(YourClass);
YourSchema.plugin(accessibleRecordsPlugin); // ✅ Add this
```

### Issue: Nested conditions not working

**Cause**: Mongoose population required for nested checks

**Solution**:

```typescript
// ✅ Populate nested fields
const lease = await this.leaseModel
  .findById(id)
  .populate('tenant')
  .populate({ path: 'unit', populate: 'property' })
  .exec();

// Now nested conditions work
ability.can(Action.Read, lease);
```

### Issue: Type errors with ability checks

**Cause**: Incorrect subject type

**Solution**:

```typescript
// ✅ Use imported class
import { Property } from './schemas/property.schema';
ability.can(Action.Read, Property);

// ❌ Don't use strings
ability.can(Action.Read, 'Property');
```

---

## Additional Resources

- [CASL Documentation](https://casl.js.org/v6/en/)
- [CASL Mongoose Integration](https://casl.js.org/v6/en/package/casl-mongoose)
- [NestJS Guards](https://docs.nestjs.com/guards)

---

## Maintenance Notes

When adding new resources:

1. Add subject to `SUBJECTS` in `casl-ability.factory.ts`
2. Add to `SUBJECT_MODEL_MAPPING`
3. Create policy handlers in `policies/`
4. Register policies in `casl.module.ts`
5. Define permissions for each role
6. Add `accessibleRecordsPlugin` to schema
7. Apply `@CheckPolicies` decorator to controllers
8. Update this documentation

---

**Last Updated**: 2025-10-02
**Version**: 1.0.0
