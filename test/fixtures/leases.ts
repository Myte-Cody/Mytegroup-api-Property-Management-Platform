export const createTestLease = (timestamp: number, unitId: string, tenantId: string) => ({
  unit: unitId,
  tenant: tenantId,
  startDate: new Date(Date.now()).toISOString(),
  endDate: new Date(Date.now() + 31536000000).toISOString(), // 1 year later
  rentAmount: 1200,
  isSecurityDeposit: true,
  securityDepositAmount: 1200,
  paymentCycle: 'MONTHLY',
  status: 'ACTIVE',
  terms: `Standard lease terms created at ${timestamp}`,
});

export const createDraftLease = (timestamp: number, unitId: string, tenantId: string) => ({
  unit: unitId,
  tenant: tenantId,
  startDate: new Date(Date.now()).toISOString(),
  endDate: new Date(Date.now() + 31536000000).toISOString(), // 1 year later
  rentAmount: 1000,
  isSecurityDeposit: true,
  securityDepositAmount: 1000,
  paymentCycle: 'MONTHLY',
  status: 'DRAFT',
  terms: `Draft lease terms created at ${timestamp}`,
});

export const updateLeaseData = {
  securityDepositRefundedAt: new Date(Date.now()).toISOString(),
  securityDepositRefundReason: 'Tenant requested early termination',
  autoRenewal: true,
};

export const terminateLeaseData = {
  terminationDate: new Date(Date.now() + 2592000000).toISOString(), // 30 days later
  terminationReason: 'Tenant requested early termination',
};

export const renewLeaseData = {
  desiredEndDate: new Date(Date.now() + 63072000000).toISOString(), // 2 years later
  notes: 'Lease renewal for another term',
};

export const depositAssessmentData = {
  refundAmount: 1000,
  deductions: [
    {
      reason: 'cleaning',
      amount: 100,
      notes: 'Professional cleaning required',
    },
    {
      reason: 'damages',
      amount: 100,
      notes: 'Wall repair',
    },
  ],
  notes: 'Security deposit assessment',
};
