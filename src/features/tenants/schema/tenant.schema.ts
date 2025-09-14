import { accessibleRecordsPlugin } from '@casl/mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import * as mongooseDelete from 'mongoose-delete';
import { SoftDelete } from 'src/common/interfaces/soft-delete.interface';
const mongoTenant = require('mongo-tenant');

@Schema({ timestamps: true })
export class Tenant extends Document implements SoftDelete {
  @Prop({ required: true })
  name: string;

  deleted: boolean;
  deletedAt?: Date;
}

// plugin
export const TenantSchema = SchemaFactory.createForClass(Tenant);

// Add compound unique index for multi-tenant uniqueness
TenantSchema.index({ name: 1, tenant_id: 1 }, { unique: true, name: 'tenant_name_tenant_unique' });

TenantSchema.plugin(mongooseDelete, { deletedAt: true, overrideMethods: 'all' });
TenantSchema.plugin(accessibleRecordsPlugin);
TenantSchema.plugin(mongoTenant);
