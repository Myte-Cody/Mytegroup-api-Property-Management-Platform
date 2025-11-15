import { accessibleRecordsPlugin } from '@casl/mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import * as mongooseDelete from 'mongoose-delete';
import { SoftDelete } from 'src/common/interfaces/soft-delete.interface';

@Schema({ timestamps: true })
export class Tenant extends Document implements SoftDelete {
  @Prop({ required: true })
  name: string;

  @Prop({ type: Object, required: false })
  invitationContext?: {
    propertyId?: string;
    unitId?: string;
    propertyName?: string;
    unitLabel?: string;
    source?: string;
    [key: string]: any;
  };

  deleted: boolean;
  deletedAt?: Date;
}

export const TenantSchema = SchemaFactory.createForClass(Tenant);

TenantSchema.index(
  { name: 1 },
  {
    unique: true,
    name: 'tenant_name_tenant_unique',
  },
);

TenantSchema.plugin(mongooseDelete, { deletedAt: true, overrideMethods: 'all' });
TenantSchema.plugin(accessibleRecordsPlugin);
