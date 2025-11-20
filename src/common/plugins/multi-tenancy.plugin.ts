import * as mongoose from 'mongoose';
import { Schema } from 'mongoose';

/**
 * Multi-tenancy plugin that adds byLandlord query helper to schemas
 * This allows filtering queries by landlord ID for tenant isolation
 *
 * Usage:
 * SchemaName.plugin(multiTenancyPlugin);
 */
export function multiTenancyPlugin(schema: Schema) {
  // Add the byLandlord query helper
  (schema.query as any).byLandlord = function (landlordId: mongoose.Types.ObjectId | string) {
    return this.where({ landlord: landlordId });
  };
}
