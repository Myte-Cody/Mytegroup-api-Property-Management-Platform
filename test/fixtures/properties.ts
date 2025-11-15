export const testProperty = {
  name: 'Test Property',
  street: '123 Test St',
  city: 'Test City',
  state: 'TS',
  postalCode: '12345',
  country: 'Test Country',
  description: 'A test property for E2E testing',
};

export const testPropertyWithoutDescription = {
  name: 'Test Property 2',
  street: '456 Test Ave',
  city: 'Test City',
  state: 'TS',
  postalCode: '67890',
  country: 'Test Country',
};

export const createTestProperty = (timestamp: number) => ({
  name: `Test Property ${timestamp}`,
  street: '123 Test St',
  city: 'Test City',
  state: 'TS',
  postalCode: '12345',
  country: 'Test Country',
  description: `A test property created at ${timestamp}`,
});

export const createScriptTestProperty = (timestamp: number) => ({
  name: `Test Property ${timestamp}`,
  address: {
    street: '123 Test St',
    city: 'Test City',
    state: 'TS',
    postalCode: '12345',
    country: 'Test Country',
  },
  description: `A test property created at ${timestamp}`,
});
