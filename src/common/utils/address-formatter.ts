/**
 * Format property address object into a readable string
 * @param address Property address object or string
 * @returns Formatted address string
 */
export function formatAddress(address: any): string {
  // If address is already a string, return it
  if (typeof address === 'string') {
    return address;
  }

  // If address is an object, format it properly
  if (address && typeof address === 'object') {
    const parts = [];

    if (address.street) parts.push(address.street);

    const cityStateZip = [];
    if (address.city) cityStateZip.push(address.city);
    if (address.state) cityStateZip.push(address.state);
    if (address.postalCode) cityStateZip.push(address.postalCode);

    if (cityStateZip.length > 0) {
      parts.push(cityStateZip.join(', '));
    }

    if (address.country) parts.push(address.country);

    return parts.join('\n');
  }

  // Fallback
  return 'Address not available';
}
