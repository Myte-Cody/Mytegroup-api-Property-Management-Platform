import { Model } from 'mongoose';

/**
 * Interface for Mongoose models with soft delete functionality
 * Extends the standard Mongoose Model with methods added by mongoose-delete plugin
 */
export interface SoftDeleteModel<T> extends Model<T> {
  /**
   * Soft deletes documents matching the given conditions
   */
  delete: (conditions: any) => Promise<any>;

  /**
   * Soft deletes a document by its ID
   */
  deleteById: (id: string) => Promise<any>;

  /**
   * Restores (undeletes) documents matching the given conditions
   */
  restore: (conditions: any) => Promise<any>;

  /**
   * Finds documents that have been soft deleted
   */
  findDeleted: (conditions: any) => Promise<any>;
}
