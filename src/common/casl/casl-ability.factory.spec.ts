import { CaslAbilityFactory, Action } from './casl-ability.factory';
import { UserRole } from '../enums/user-role.enum';
import { UserType } from '../enums/user-type.enum';
import { Transaction } from '../../features/leases/schemas/transaction.schema';
import { Property } from '../../features/properties/schemas/property.schema';
import { User } from '../../features/users/schemas/user.schema';

describe('CaslAbilityFactory - landlord roles', () => {
  const factory = new CaslAbilityFactory();

  const baseUser = {
    _id: 'user-id',
    email: 'test@example.com',
    organization_id: 'org-id',
  } as any;

  it('grants landlord admins full management including billing and users', () => {
    const landlordAdmin = {
      ...baseUser,
      user_type: UserType.LANDLORD,
      isPrimary: true,
      role: UserRole.LANDLORD_ADMIN,
    } as any;

    const ability = factory.createForUser(landlordAdmin);

    expect(ability.can(Action.Manage, Property)).toBe(true);
    expect(ability.can(Action.Manage, Transaction)).toBe(true);
    expect(ability.can(Action.Manage, User)).toBe(true);
  });

  it('restricts landlord staff from modifying billing records and users', () => {
    const landlordStaff = {
      ...baseUser,
      user_type: UserType.LANDLORD,
      isPrimary: false,
      role: UserRole.LANDLORD_STAFF,
    } as any;

    const ability = factory.createForUser(landlordStaff);

    // Operational management allowed
    expect(ability.can(Action.Manage, Property)).toBe(true);

    // Billing: read-only
    expect(ability.can(Action.Read, Transaction)).toBe(true);
    expect(ability.can(Action.Create, Transaction)).toBe(false);
    expect(ability.can(Action.Update, Transaction)).toBe(false);
    expect(ability.can(Action.Delete, Transaction)).toBe(false);

    // User management not allowed
    expect(ability.can(Action.Manage, User)).toBe(false);
  });
});

