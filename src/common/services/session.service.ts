import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { ClientSession, Connection } from 'mongoose';

/**
 * Service for managing MongoDB transactions
 * This service provides methods to execute operations within a transaction
 * to ensure data consistency across multiple operations
 */
@Injectable()
export class SessionService {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  /**
   * Execute a function within a MongoDB transaction
   * @param callback Function to execute within the transaction
   * @returns Result of the callback function
   */
  async withSession<T>(callback: (session: ClientSession) => Promise<T>): Promise<T> {
    const session = await this.connection.startSession();
    let result: T;

    try {
      // Start the transaction
      session.startTransaction();

      // Execute the callback function with the session
      result = await callback(session);

      // Commit the transaction
      await session.commitTransaction();
    } catch (error) {
      // If an error occurs, abort the transaction
      await session.abortTransaction();
      throw error;
    } finally {
      // End the session
      session.endSession();
    }

    return result;
  }
}
