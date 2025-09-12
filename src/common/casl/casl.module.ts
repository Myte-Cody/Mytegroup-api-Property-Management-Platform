import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CaslAbilityFactory } from './casl-ability.factory';
import { CaslGuard } from './guards/casl.guard';
import { CaslAuthorizationService } from './services/casl-authorization.service';

// Import schemas
import { Property, PropertySchema } from '../../features/properties/schemas/property.schema';
import { Unit, UnitSchema } from '../../features/properties/schemas/unit.schema';
import { User, UserSchema } from '../../features/users/schemas/user.schema';
import { Tenant, TenantSchema } from '../../features/tenants/schema/tenant.schema';
import { Contractor, ContractorSchema } from '../../features/contractors/schema/contractor.schema';


// Import policy handlers
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

import {
  CreateTenantPolicyHandler,
  DeleteTenantPolicyHandler,
  ReadTenantPolicyHandler,
  UpdateTenantPolicyHandler,
} from './policies/tenant.policies'

import {
  CreateContractorPolicyHandler,
  DeleteContractorPolicyHandler,
  ReadContractorPolicyHandler,
  UpdateContractorPolicyHandler,
} from './policies/contractor.policies';

const policyHandlers = [

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

  // Tenant policies
  ReadTenantPolicyHandler,
  CreateTenantPolicyHandler,
  UpdateTenantPolicyHandler,
  DeleteTenantPolicyHandler,

  // Contractor policies
  ReadContractorPolicyHandler,
  CreateContractorPolicyHandler,
  UpdateContractorPolicyHandler,
  DeleteContractorPolicyHandler,
];

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Tenant.name, schema: TenantSchema },
      { name: Contractor.name, schema: ContractorSchema },
      { name: Property.name, schema: PropertySchema },
      { name: Unit.name, schema: UnitSchema },
    ]),
  ],
  providers: [CaslAbilityFactory, CaslGuard, CaslAuthorizationService, ...policyHandlers],
  exports: [CaslAbilityFactory, CaslGuard, CaslAuthorizationService, ...policyHandlers],
})
export class CaslModule {}
