/**
 * Formats a given amount of money into a string with a currency symbol (USD).
 * @param {number} amount - Amount of money to format
 * @returns {string} Formatted string with a currency symbol
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}
