import { AccessibleRecordModel } from './accessible-record-model.interface';
import { MongoTenantModel } from './mongo-tenant-model.interface';
import { SoftDeleteModel } from './soft-delete-model.interface';

/**
 * Composed interface that combines SoftDelete and CASL AccessibleRecord functionality
 * This is the main model interface used throughout the application
 */
export interface AppModel<T>
  extends SoftDeleteModel<T>,
    AccessibleRecordModel<T>,
    MongoTenantModel<T> {}
