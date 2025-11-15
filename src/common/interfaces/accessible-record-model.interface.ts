import { Model, Query } from 'mongoose';
import { AppAbility } from '../casl/casl-ability.factory';

/**
 * Interface for Mongoose models with CASL accessibility support
 * Extends the standard Mongoose Model with methods added by @casl/mongoose accessibleRecordsPlugin
 */
export interface AccessibleRecordModel<T> extends Model<T> {
  /**
   * Returns records accessible by the given ability
   * Added by @casl/mongoose accessibleRecordsPlugin
   */
  accessibleBy: (ability: AppAbility, action?: string) => Query<T[], T>;
}
