export const createRentalPeriodData = (timestamp: number, leaseId: string) => ({
  lease: leaseId,
  startDate: new Date(Date.now()).toISOString(),
  endDate: new Date(Date.now() + 2592000000).toISOString(), // 30 days later
  dueDate: new Date(Date.now() + 604800000).toISOString(), // 7 days later
  amount: 1200,
  isPaid: false,
  notes: `Rental period created at ${timestamp}`,
});

export const updateRentalPeriodData = {
  amount: 1250,
  dueDate: new Date(Date.now() + 1209600000).toISOString(), // 14 days later
  notes: 'Updated rental period notes',
};

export const markRentalPeriodAsPaidData = {
  paymentMethod: 'BANK_TRANSFER',
  paymentDate: new Date(Date.now()).toISOString(),
  transactionReference: 'TXN-12345',
  notes: 'Payment received via bank transfer',
};
