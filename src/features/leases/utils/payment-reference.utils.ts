import { AppModel } from '../../../common/interfaces/app-model.interface';
import { Payment } from '../schemas/payment.schema';

export class PaymentReferenceUtils {
  /**
   * Generate a unique payment reference for a landlord
   * Format: PAY-{LANDLORD_PREFIX}-{SEQUENCE}
   * Example: PAY-ABC123-000001
   */
  static async generatePaymentReference(
    paymentModel: AppModel<Payment>,
    landlordId: any
  ): Promise<string> {
    const count = await paymentModel.byTenant(landlordId).countDocuments();
    
    const tenantPrefix = landlordId.toString().substring(0, 6).toUpperCase();
    const sequence = (count + 1).toString().padStart(6, '0');
    
    let reference = `PAY-${tenantPrefix}-${sequence}`;
    
    // Handle potential race conditions
    let attempts = 0;
    while (attempts < 2) {
      const existingPayment = await paymentModel
        .byTenant(landlordId)
        .findOne({ reference })
        .exec();
      
      if (!existingPayment) {
        return reference; 
      }
      
      const newSequence = (count + 1 + attempts + 1).toString().padStart(6, '0');
      reference = `PAY-${tenantPrefix}-${newSequence}`;
      attempts++;
    }

    const timestamp = Date.now().toString().slice(-4);
    return `PAY-${tenantPrefix}-${timestamp}`;
  }
}