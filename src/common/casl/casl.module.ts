import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CaslAbilityFactory } from './casl-ability.factory';
import { CaslGuard } from './guards/casl.guard';
import { CaslAuthorizationService } from './services/casl-authorization.service';

// Import schemas
import {
  Organization,
  OrganizationSchema,
} from '../../features/organizations/schemas/organization.schema';
import { Property, PropertySchema } from '../../features/properties/schemas/property.schema';
import { Unit, UnitSchema } from '../../features/properties/schemas/unit.schema';
import { User, UserSchema } from '../../features/users/schemas/user.schema';

// Import policy handlers
import {
  CreateOrganizationPolicyHandler,
  DeleteOrganizationPolicyHandler,
  ManageOrganizationPolicyHandler,
  ReadOrganizationPolicyHandler,
  UpdateOrganizationPolicyHandler,
} from './policies/organization.policies';

import {
  CreatePropertyPolicyHandler,
  DeletePropertyPolicyHandler,
  ManagePropertyPolicyHandler,
  ReadPropertyPolicyHandler,
  UpdatePropertyPolicyHandler,
} from './policies/property.policies';

import {
  CreateUnitPolicyHandler,
  DeleteUnitPolicyHandler,
  ManageUnitPolicyHandler,
  ReadUnitPolicyHandler,
  UpdateUnitPolicyHandler,
} from './policies/unit.policies';

import {
  CreateUserPolicyHandler,
  DeleteUserPolicyHandler,
  ManageUserPolicyHandler,
  ReadUserPolicyHandler,
  UpdateUserPolicyHandler,
} from './policies/user.policies';

const policyHandlers = [
  // Organization policies
  ReadOrganizationPolicyHandler,
  ManageOrganizationPolicyHandler,
  UpdateOrganizationPolicyHandler,
  DeleteOrganizationPolicyHandler,
  CreateOrganizationPolicyHandler,

  // Property policies
  ReadPropertyPolicyHandler,
  ManagePropertyPolicyHandler,
  CreatePropertyPolicyHandler,
  UpdatePropertyPolicyHandler,
  DeletePropertyPolicyHandler,

  // Unit policies
  ReadUnitPolicyHandler,
  ManageUnitPolicyHandler,
  CreateUnitPolicyHandler,
  UpdateUnitPolicyHandler,
  DeleteUnitPolicyHandler,

  // User policies
  ReadUserPolicyHandler,
  ManageUserPolicyHandler,
  CreateUserPolicyHandler,
  UpdateUserPolicyHandler,
  DeleteUserPolicyHandler,
];

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Organization.name, schema: OrganizationSchema },
      { name: Property.name, schema: PropertySchema },
      { name: Unit.name, schema: UnitSchema },
    ]),
  ],
  providers: [CaslAbilityFactory, CaslGuard, CaslAuthorizationService, ...policyHandlers],
  exports: [CaslAbilityFactory, CaslGuard, CaslAuthorizationService, ...policyHandlers],
})
export class CaslModule {}
