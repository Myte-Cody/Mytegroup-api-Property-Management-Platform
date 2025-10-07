# CASL Authorization Documentation

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Architecture](#architecture)
4. [Core Concepts](#core-concepts)
5. [Implementation Details](#implementation-details)
6. [Common Patterns](#common-patterns)
7. [Usage Guidelines](#usage-guidelines)
8. [Permission Definitions](#permission-definitions)
9. [Best Practices](#best-practices)
10. [Examples](#examples)
11. [Testing](#testing)
12. [Performance Tips](#performance-tips)
13. [Troubleshooting](#troubleshooting)
14. [Migration Guide](#migration-guide)

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

## Quick Start

### Adding Authorization to a New Resource

Follow this 8-step checklist:

1. ✅ Add subject to `SUBJECTS` constant
2. ✅ Add to `SUBJECT_MODEL_MAPPING`
3. ✅ Create policy handlers file
4. ✅ Register policies in `casl.module.ts`
5. ✅ Define role permissions in `CaslAbilityFactory`
6. ✅ Add `accessibleRecordsPlugin` to schema
7. ✅ Apply decorators to controller
8. ✅ Use `accessibleBy` in service

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

## Common Patterns

### Service Pattern

```typescript
@Injectable()
export class ResourceService {
  constructor(
    @InjectModel(Resource.name) private model: AccessibleRecordModel<Resource>,
    private caslService: CaslAuthorizationService,
  ) {}

  async findAll(user: User): Promise<Resource[]> {
    const ability = this.caslService.createAbilityForUser(user);
    return this.model.accessibleBy(ability, Action.Read).find().exec();
  }

  async findOne(id: string, user: User): Promise<Resource> {
    const ability = this.caslService.createAbilityForUser(user);
    const resource = await this.model.findById(id).exec();

    if (!resource) {
      throw new NotFoundException('Resource not found');
    }

    if (!ability.can(Action.Read, resource)) {
      throw new ForbiddenException('Access denied');
    }

    return resource;
  }

  async update(id: string, dto: UpdateDto, user: User): Promise<Resource> {
    const ability = this.caslService.createAbilityForUser(user);
    const resource = await this.model.findById(id).exec();

    if (!resource) {
      throw new NotFoundException('Resource not found');
    }

    if (!ability.can(Action.Update, resource)) {
      throw new ForbiddenException('Access denied');
    }

    Object.assign(resource, dto);
    return resource.save();
  }
}
```

### Policy Handler Pattern

```typescript
// policies/resource.policies.ts
import { Injectable } from '@nestjs/common';
import { Resource } from '../schemas/resource.schema';
import { User } from '../schemas/user.schema';
import { Action, AppAbility } from '../casl-ability.factory';
import { IPolicyHandler } from '../guards/casl.guard';

@Injectable()
export class ReadResourcePolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User, resource?: Resource): boolean {
    if (resource) {
      return ability.can(Action.Read, resource);
    }
    return ability.can(Action.Read, Resource);
  }
}

@Injectable()
export class CreateResourcePolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User): boolean {
    return ability.can(Action.Create, Resource);
  }
}

@Injectable()
export class UpdateResourcePolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User, resource?: Resource): boolean {
    if (resource) {
      return ability.can(Action.Update, resource);
    }
    return ability.can(Action.Update, Resource);
  }
}

@Injectable()
export class DeleteResourcePolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User, resource?: Resource): boolean {
    if (resource) {
      return ability.can(Action.Delete, resource);
    }
    return ability.can(Action.Delete, Resource);
  }
}
```

#### Using Policy Handlers in Controllers

Policy handlers are applied to controller methods using the `@CheckPolicies()` decorator along with the `CaslGuard`:

```typescript
@Controller('resource')
@UseGuards(JwtAuthGuard, CaslGuard)
@ApiBearerAuth()
export class ResourceController {
  @Get()
  @CheckPolicies(new ReadResourcePolicyHandler())
  findAll(@CurrentUser() user: User) {
    return this.service.findAll(user);
  }

  @Post()
  @CheckPolicies(new CreateResourcePolicyHandler())
  create(@Body() dto: CreateDto, @CurrentUser() user: User) {
    return this.service.create(dto, user);
  }

  @Patch(':id')
  @CheckPolicies(new UpdateResourcePolicyHandler())
  update(@Param('id') id: string, @Body() dto: UpdateDto, @CurrentUser() user: User) {
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  @CheckPolicies(new DeleteResourcePolicyHandler())
  remove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.service.remove(id, user);
  }
}
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

## Permission Definitions

### Adding Permissions in CaslAbilityFactory

```typescript
// For Landlords (full access)
private defineLandlordPermissions(can: any, cannot: any, user: UserDocument) {
  can(Action.Manage, Resource);  // Manage = all actions
}

// For Tenants (limited access)
private defineTenantPermissions(can: any, cannot: any, user: UserDocument) {
  // Read-only
  can(Action.Read, Resource);

  // Conditional access
  can(Action.Read, Resource, { owner: user.party_id });

  // Explicit denials
  cannot(Action.Create, Resource);
  cannot(Action.Update, Resource);
  cannot(Action.Delete, Resource);
}

// For Contractors (specialized access)
private defineContractorPermissions(can: any, cannot: any, user: UserDocument) {
  // Read access
  can(Action.Read, Resource);

  // Field-level permissions
  can(Action.Update, Resource, ['status', 'notes']);

  // Denials
  cannot(Action.Delete, Resource);
}
```

### Common Conditions

#### By Owner

```typescript
can(Action.Read, Resource, { owner: user._id });
```

#### By Related Entity

```typescript
can(Action.Read, Lease, { tenant: user.party_id });
can(Action.Read, Transaction, { lease: { tenant: user.party_id } });
```

#### By User Type

```typescript
can(Action.Manage, User, {
  party_id: user.party_id,
  user_type: UserType.TENANT,
});
```

#### Field-Level Permissions

```typescript
can(Action.Update, Unit, ['maintenanceStatus', 'notes']);
```

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

## Testing

### Unit Test for Abilities

```typescript
describe('CaslAbilityFactory', () => {
  let factory: CaslAbilityFactory;

  beforeEach(() => {
    factory = new CaslAbilityFactory();
  });

  describe('Landlord Permissions', () => {
    it('should allow landlords to manage all resources', () => {
      const user = createMockUser(UserType.LANDLORD);
      const ability = factory.createForUser(user);

      expect(ability.can(Action.Manage, Property)).toBe(true);
      expect(ability.can(Action.Manage, Unit)).toBe(true);
      expect(ability.can(Action.Manage, Lease)).toBe(true);
    });
  });

  describe('Tenant Permissions', () => {
    it('should allow tenants to read properties', () => {
      const user = createMockUser(UserType.TENANT);
      const ability = factory.createForUser(user);

      expect(ability.can(Action.Read, Property)).toBe(true);
    });

    it('should prevent tenants from creating properties', () => {
      const user = createMockUser(UserType.TENANT);
      const ability = factory.createForUser(user);

      expect(ability.can(Action.Create, Property)).toBe(false);
    });

    it('should allow tenants to read their own leases', () => {
      const user = createMockUser(UserType.TENANT, 'tenant-123');
      const ability = factory.createForUser(user);
      const lease = { tenant: 'tenant-123' } as Lease;

      expect(ability.can(Action.Read, lease)).toBe(true);
    });

    it('should prevent tenants from reading other leases', () => {
      const user = createMockUser(UserType.TENANT, 'tenant-123');
      const ability = factory.createForUser(user);
      const lease = { tenant: 'tenant-456' } as Lease;

      expect(ability.can(Action.Read, lease)).toBe(false);
    });
  });
});
```

### E2E Test with Authorization

```typescript
describe('Properties (e2e)', () => {
  it('should allow landlords to create properties', async () => {
    const landlordToken = await getAuthToken(landlordUser);

    return request(app.getHttpServer())
      .post('/properties')
      .set('Authorization', `Bearer ${landlordToken}`)
      .send(createPropertyDto)
      .expect(201);
  });

  it('should prevent tenants from creating properties', async () => {
    const tenantToken = await getAuthToken(tenantUser);

    return request(app.getHttpServer())
      .post('/properties')
      .set('Authorization', `Bearer ${tenantToken}`)
      .send(createPropertyDto)
      .expect(403);
  });

  it('should allow tenants to read properties', async () => {
    const tenantToken = await getAuthToken(tenantUser);

    return request(app.getHttpServer())
      .get('/properties')
      .set('Authorization', `Bearer ${tenantToken}`)
      .expect(200);
  });
});
```

---

## Performance Tips

### 1. Cache Abilities

Create ability once per request:

```typescript
// ✅ Good: Create once
const ability = this.caslService.createAbilityForUser(user);
const items = await this.model.accessibleBy(ability, Action.Read).find();

// ❌ Bad: Create multiple times
const items = await this.model.find();
items.forEach((item) => {
  const ability = this.caslService.createAbilityForUser(user); // Wasteful!
  if (ability.can(Action.Read, item)) {
    // ...
  }
});
```

### 2. Use Database Filtering

Let the database filter instead of the application:

```typescript
// ✅ Good: Database filters
const items = await this.model.accessibleBy(ability, Action.Read).find();

// ❌ Bad: Application filters (slow)
const allItems = await this.model.find();
const filtered = allItems.filter((item) => ability.can(Action.Read, item));
```

### 3. Populate Selectively

Only populate fields needed for conditions:

```typescript
// ✅ Good: Only populate what's needed
const lease = await this.leaseModel.findById(id).populate('tenant').exec();

// ❌ Bad: Over-populating
const lease = await this.leaseModel
  .findById(id)
  .populate('tenant')
  .populate('unit')
  .populate('property')
  .populate('transactions')
  .exec();
```

### 4. Index Conditions

Add database indexes on fields used in conditions:

```typescript
@Schema({ timestamps: true })
export class Lease extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Tenant', index: true }) // ✅ Indexed
  tenant: Types.ObjectId;
}
```

---

## Troubleshooting

### Common Errors and Solutions

#### Error: "Access denied" but user should have access

**Check:**

1. Is the guard applied? `@UseGuards(JwtAuthGuard, CaslGuard)`
2. Is the policy handler registered in `casl.module.ts`?
3. Are permissions defined in `CaslAbilityFactory`?
4. Is the resource populated for nested conditions?

**Solution**:

1. Verify the policy handler is in `casl.module.ts` providers
2. Check ability definition in `CaslAbilityFactory`
3. Ensure the guard is applied: `@UseGuards(JwtAuthGuard, CaslGuard)`

#### Error: `accessibleBy` returns empty array

**Check:**

1. Is `accessibleRecordsPlugin` added to schema?
2. Are permissions defined for the action?
3. Is the ability created correctly?

**Solution**:

```typescript
import { accessibleRecordsPlugin } from '@casl/mongoose';

export const YourSchema = SchemaFactory.createForClass(YourClass);
YourSchema.plugin(accessibleRecordsPlugin); // ✅ Add this
```

#### Error: Type error with subject

**Solution**:

```typescript
// ✅ Use class import
import { Property } from './schemas/property.schema';
ability.can(Action.Read, Property);

// ❌ Don't use string
ability.can(Action.Read, 'Property');
```

#### Error: Nested conditions not working

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

---

## Migration Guide

### Migrating Existing Endpoints to CASL

When migrating existing endpoints to use CASL authorization:

- [ ] Add `@UseGuards(JwtAuthGuard, CaslGuard)` to controller
- [ ] Add `@CheckPolicies(...)` to each method
- [ ] Replace manual permission checks with `ability.can()`
- [ ] Use `accessibleBy()` in service queries
- [ ] Remove old authorization logic
- [ ] Add tests for authorization
- [ ] Update API documentation

### Example Migration

**Before:**

```typescript
@Controller('properties')
export class PropertiesController {
  @Get()
  async findAll(@CurrentUser() user: User) {
    // Manual permission check
    if (user.user_type !== UserType.LANDLORD) {
      throw new ForbiddenException();
    }
    return this.service.findAll();
  }
}
```

**After:**

```typescript
@Controller('properties')
@UseGuards(JwtAuthGuard, CaslGuard)
@ApiBearerAuth()
export class PropertiesController {
  @Get()
  @CheckPolicies(new ReadPropertyPolicyHandler())
  async findAll(@CurrentUser() user: User) {
    return this.service.findAll(user);
  }
}
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

**Version**: 2.0.0 (Merged with Quick Reference)  
**Last Updated**: 2025-10-06  
**Last Reviewed**: 2025-10-06
