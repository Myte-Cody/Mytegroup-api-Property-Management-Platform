export const createRentTransactionData = (timestamp: number, leaseId: string) => ({
  lease: leaseId,
  type: 'RENT',
  amount: 1200,
  dueDate: new Date(Date.now() + 604800000).toISOString(), // 7 days later
  notes: `Rent transaction created at ${timestamp}`,
});

export const createSecurityDepositTransactionData = (timestamp: number, leaseId: string) => ({
  lease: leaseId,
  type: 'security_deposit',
  amount: 1200,
  description: 'Security deposit',
  dueDate: new Date(Date.now()).toISOString(),
  notes: `Security deposit transaction created at ${timestamp}`,
});

export const createFeeTransactionData = (timestamp: number, leaseId: string) => ({
  lease: leaseId,
  type: 'fee',
  amount: 50,
  description: 'Late payment fee',
  dueDate: new Date(Date.now()).toISOString(),
  notes: `Fee transaction created at ${timestamp}`,
});

export const updateTransactionData = {
  amount: 1250,
  notes: 'Updated transaction notes',
};

export const markTransactionAsPaidData = {
  paymentMethod: 'BANK_TRANSFER',
  notes: 'Payment received via bank transfer',
};
