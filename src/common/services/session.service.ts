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
  private transactionsSupported: boolean | null = null;
  private checkPromise: Promise<void> | null = null;

  constructor(@InjectConnection() private readonly connection: Connection) {}

  /**
   * Check if the MongoDB deployment supports transactions
   * This is important for test environments using MongoDB Memory Server
   */
  private async checkTransactionSupport(): Promise<void> {
    if (this.transactionsSupported !== null) {
      return;
    }

    // Ensure we only check once even if called multiple times
    if (this.checkPromise) {
      return this.checkPromise;
    }

    this.checkPromise = (async () => {
      const admin = this.connection.db.admin();
      const serverStatus = await admin.serverStatus();

      // MongoDB Memory Server doesn't support replica sets by default
      if (!serverStatus.repl) {
        this.transactionsSupported = false;
        return;
      }
      try {
        const session = await this.connection.startSession();
        await session.startTransaction();
        await session.commitTransaction();
        await session.endSession();
        this.transactionsSupported = true;
      } catch (error) {
        this.transactionsSupported = false;
      }
    })();

    return this.checkPromise;
  }

  /**
   * Execute a function within a MongoDB transaction if supported
   * If transactions are not supported, execute the function without a transaction
   * @param callback Function to execute within the transaction
   * @returns Result of the callback function
   */
  async withSession<T>(callback: (session: ClientSession) => Promise<T>): Promise<T> {
    // Check transaction support before proceeding
    await this.checkTransactionSupport();

    // If transactions are not supported
    if (this.transactionsSupported === false) {
      const session = await this.connection.startSession();
      try {
        return await callback(null);
      } finally {
        await session.endSession();
      }
    }

    // If transactions are supported, use them
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
