# CASL Quick Reference Guide

## Quick Start Checklist

### Adding Authorization to a New Resource

1. Add subject to `SUBJECTS` constant
2. Add to `SUBJECT_MODEL_MAPPING`
3. Create policy handlers file
4. Register policies in `casl.module.ts`
5. Define role permissions in `CaslAbilityFactory`
6. Add `accessibleRecordsPlugin` to schema
7. Apply decorators to controller
8. Use `accessibleBy` in service

---

## Common Patterns

### Controller Pattern

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

### Schema Pattern

```typescript
import { accessibleRecordsPlugin } from '@casl/mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Resource extends Document {
  @Prop({ required: true })
  name: string;
  
  // ... other fields
}

export const ResourceSchema = SchemaFactory.createForClass(Resource);
ResourceSchema.plugin(accessibleRecordsPlugin);  // ✅ Required
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

---

## Common Conditions

### By Owner

```typescript
can(Action.Read, Resource, { owner: user._id });
```

### By Related Entity

```typescript
can(Action.Read, Lease, { tenant: user.party_id });
can(Action.Read, Transaction, { lease: { tenant: user.party_id } });
```

### By User Type

```typescript
can(Action.Manage, User, { 
  party_id: user.party_id,
  user_type: UserType.TENANT 
});
```

### Field-Level Permissions

```typescript
can(Action.Update, Unit, ['maintenanceStatus', 'notes']);
```

---

## Testing Patterns

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

## Debugging Tips

### Enable CASL Debug Mode

```typescript
// In development, log ability checks
const ability = factory.createForUser(user);
console.log('Can read Property?', ability.can(Action.Read, Property));
console.log('Can create Property?', ability.can(Action.Create, Property));
```

### Check Ability Rules

```typescript
const ability = factory.createForUser(user);
console.log('All rules:', ability.rules);
```

### Verify Subject Detection

```typescript
const resource = await this.model.findById(id);
console.log('Subject type:', ability.detectSubjectType(resource));
```

### Test Conditions

```typescript
const lease = await this.leaseModel.findById(id).populate('tenant');
console.log('Lease tenant:', lease.tenant);
console.log('User party_id:', user.party_id);
console.log('Can read?', ability.can(Action.Read, lease));
```

---

## Common Errors and Solutions

### Error: "Access denied" but user should have access

**Check:**
1. Is the guard applied? `@UseGuards(JwtAuthGuard, CaslGuard)`
2. Is the policy handler registered in `casl.module.ts`?
3. Are permissions defined in `CaslAbilityFactory`?
4. Is the resource populated for nested conditions?

### Error: `accessibleBy` returns empty array

**Check:**
1. Is `accessibleRecordsPlugin` added to schema?
2. Are permissions defined for the action?
3. Is the ability created correctly?

### Error: Type error with subject

**Solution:**
```typescript
// ✅ Use class import
import { Property } from './schemas/property.schema';
ability.can(Action.Read, Property);

// ❌ Don't use string
ability.can(Action.Read, 'Property');
```

---

## Performance Tips

1. **Cache abilities**: Create ability once per request
2. **Use `accessibleBy`**: Let database filter instead of application
3. **Populate selectively**: Only populate fields needed for conditions
4. **Index conditions**: Add database indexes on fields used in conditions

```typescript
// ✅ Good: Database filters
const items = await this.model
  .accessibleBy(ability, Action.Read)
  .find();

// ❌ Bad: Application filters (slow)
const allItems = await this.model.find();
const filtered = allItems.filter(item => ability.can(Action.Read, item));
```

---

## Migration Checklist

When migrating existing endpoints to use CASL:

- [ ] Add `@UseGuards(JwtAuthGuard, CaslGuard)` to controller
- [ ] Add `@CheckPolicies(...)` to each method
- [ ] Replace manual permission checks with `ability.can()`
- [ ] Use `accessibleBy()` in service queries
- [ ] Remove old authorization logic
- [ ] Add tests for authorization
- [ ] Update API documentation

---

## Resources

- Main Documentation: `docs/CASL_AUTHORIZATION.md`
- CASL Official Docs: https://casl.js.org/v6/en/
- Source Code: `src/common/casl/`

---

**Quick Reference Version**: 1.0.0
**Last Updated**: 2025-10-02
