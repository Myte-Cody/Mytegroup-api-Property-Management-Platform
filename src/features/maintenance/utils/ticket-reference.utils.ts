import { AppModel } from '../../../common/interfaces/app-model.interface';
import { MaintenanceTicket } from '../schemas/maintenance-ticket.schema';
import { ScopeOfWork } from '../schemas/scope-of-work.schema';

export class TicketReferenceUtils {
  static async generateTicketNumber(ticketModel: AppModel<MaintenanceTicket>): Promise<string> {
    const currentYear = new Date().getFullYear();
    const prefix = `MT${currentYear}`;

    // Get the count of tickets for this tenant in the current year
    const startOfYear = new Date(currentYear, 0, 1);
    const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59);

    const count = await ticketModel
      .countDocuments({
        createdAt: {
          $gte: startOfYear,
          $lte: endOfYear,
        },
      })
      .exec();

    // Generate ticket number with zero-padded sequential number
    const sequentialNumber = (count + 1).toString().padStart(6, '0');
    return `${prefix}-${sequentialNumber}`;
  }

  static async generateUniqueTicketNumber(
    ticketModel: AppModel<MaintenanceTicket>,
    maxRetries: number = 5,
  ): Promise<string> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const ticketNumber = await this.generateTicketNumber(ticketModel);

      const existingTicket = await ticketModel.findOne({ ticketNumber }).exec();

      if (!existingTicket) {
        return ticketNumber;
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    const timestamp = Date.now().toString().slice(-6);
    const currentYear = new Date().getFullYear();
    return `MT${currentYear}-${timestamp}`;
  }

  static async generateSowNumber(sowModel: AppModel<ScopeOfWork>): Promise<string> {
    const currentYear = new Date().getFullYear();
    const prefix = `SOW${currentYear}`;

    // Get the count of SOWs for the current year
    const startOfYear = new Date(currentYear, 0, 1);
    const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59);

    const count = await sowModel
      .countDocuments({
        createdAt: {
          $gte: startOfYear,
          $lte: endOfYear,
        },
      })
      .exec();

    // Generate SOW number with zero-padded sequential number
    const sequentialNumber = (count + 1).toString().padStart(6, '0');
    return `${prefix}-${sequentialNumber}`;
  }

  static async generateUniqueSowNumber(
    sowModel: AppModel<ScopeOfWork>,
    isSubSow: boolean = false,
    maxRetries: number = 5,
  ): Promise<string> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const sowNumber = await this.generateSowNumber(sowModel);

      const existingSow = await sowModel.findOne({ sowNumber }).exec();

      if (!existingSow) {
        return sowNumber;
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    const timestamp = Date.now().toString().slice(-6);
    const currentYear = new Date().getFullYear();
    return `${isSubSow ? 'SUB-SOW' : 'SOW'}${currentYear}-${timestamp}`;
  }
}
