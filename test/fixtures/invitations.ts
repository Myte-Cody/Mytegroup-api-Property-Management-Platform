import { EntityType } from '../../src/features/invitations/schemas/invitation.schema';

export const createTestInvitation = (timestamp: number) => ({
  entityType: EntityType.TENANT,
  email: `test-invitation-${timestamp}@example.com`,
  entityData: {
    notes: 'Test invitation',
  },
});

export const createTestContractorInvitation = (timestamp: number) => ({
  entityType: EntityType.CONTRACTOR,
  email: `test-contractor-invitation-${timestamp}@example.com`,
  entityData: {
    specialty: 'Plumbing',
    notes: 'Test contractor invitation',
  },
});

export const createAcceptInvitationData = (timestamp: number) => ({
  name: `Test Tenant ${timestamp}`,
  username: `test_tenant_${timestamp}`,
  password: 'Password123!',
  phoneNumber: '123-456-7890',
});
