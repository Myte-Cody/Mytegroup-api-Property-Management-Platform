import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CaslAbilityFactory } from './casl-ability.factory';
import { CaslGuard } from './guards/casl.guard';
import { CaslAuthorizationService } from './services/casl-authorization.service';

// Import schemas
import { Contractor, ContractorSchema } from '../../features/contractors/schema/contractor.schema';
import { Lease, LeaseSchema } from '../../features/leases/schemas/lease.schema';
import { Payment, PaymentSchema } from '../../features/leases/schemas/payment.schema';
import {
  RentalPeriod,
  RentalPeriodSchema,
} from '../../features/leases/schemas/rental-period.schema';
import { Property, PropertySchema } from '../../features/properties/schemas/property.schema';
import { Unit, UnitSchema } from '../../features/properties/schemas/unit.schema';
import { Tenant, TenantSchema } from '../../features/tenants/schema/tenant.schema';
import { User, UserSchema } from '../../features/users/schemas/user.schema';

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
} from './policies/tenant.policies';

import {
  CreateContractorPolicyHandler,
  DeleteContractorPolicyHandler,
  ReadContractorPolicyHandler,
  UpdateContractorPolicyHandler,
} from './policies/contractor.policies';

import {
  CreateLeasePolicyHandler,
  DeleteLeasePolicyHandler,
  ManageLeasePolicyHandler,
  ReadLeasePolicyHandler,
  UpdateLeasePolicyHandler,
} from './policies/lease.policies';

import {
  CreateRentalPeriodPolicyHandler,
  DeleteRentalPeriodPolicyHandler,
  ManageRentalPeriodPolicyHandler,
  ReadRentalPeriodPolicyHandler,
  UpdateRentalPeriodPolicyHandler,
} from './policies/rental-period.policies';

import {
  CreatePaymentPolicyHandler,
  DeletePaymentPolicyHandler,
  ManagePaymentPolicyHandler,
  ReadPaymentPolicyHandler,
  UpdatePaymentPolicyHandler,
} from './policies/payment.policies';

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

  // Lease policies
  ReadLeasePolicyHandler,
  ManageLeasePolicyHandler,
  CreateLeasePolicyHandler,
  UpdateLeasePolicyHandler,
  DeleteLeasePolicyHandler,

  // RentalPeriod policies
  ReadRentalPeriodPolicyHandler,
  ManageRentalPeriodPolicyHandler,
  CreateRentalPeriodPolicyHandler,
  UpdateRentalPeriodPolicyHandler,
  DeleteRentalPeriodPolicyHandler,

  // Payment policies
  ReadPaymentPolicyHandler,
  ManagePaymentPolicyHandler,
  CreatePaymentPolicyHandler,
  UpdatePaymentPolicyHandler,
  DeletePaymentPolicyHandler,
];

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Tenant.name, schema: TenantSchema },
      { name: Contractor.name, schema: ContractorSchema },
      { name: Property.name, schema: PropertySchema },
      { name: Unit.name, schema: UnitSchema },
      { name: Lease.name, schema: LeaseSchema },
      { name: RentalPeriod.name, schema: RentalPeriodSchema },
      { name: Payment.name, schema: PaymentSchema },
    ]),
  ],
  providers: [CaslAbilityFactory, CaslGuard, CaslAuthorizationService, ...policyHandlers],
  exports: [CaslAbilityFactory, CaslGuard, CaslAuthorizationService, ...policyHandlers],
})
export class CaslModule {}
