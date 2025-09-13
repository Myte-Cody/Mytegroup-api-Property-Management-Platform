import { accessibleRecordsPlugin } from '@casl/mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { TenantAwareDocument } from 'mongo-tenant';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import * as mongooseDelete from 'mongoose-delete';
import { SoftDelete } from '../../../common/interfaces/soft-delete.interface';
const mongoTenant = require('mongo-tenant');

export type UserDocument = User &
  Document &
  TenantAwareDocument &
  SoftDelete & {
    tenantId?: Types.ObjectId;
  };

@Schema({ timestamps: true })
export class User extends Document implements SoftDelete {
  @Prop({ required: true, trim: true, maxlength: 64 })
  username: string;

  @Prop({
    required: true,
    trim: true,
    lowercase: true,
    match: /.+\@.+\..+/,
  })
  email: string;

  @Prop({ required: true, select: false })
  password: string;

  @Prop({
    type: String,
    required: true,
    enum: ['Landlord', 'Tenant', 'Contractor', 'Admin'],
  })
  user_type: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    refPath: 'user_type', // Dynamic reference based on user_type
  })
  party_id: Types.ObjectId; // Points to Landlord/Tenant/Contractor

  deleted: boolean;
  deletedAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Add compound unique indexes for multi-tenant uniqueness
UserSchema.index({ username: 1, tenantId: 1 }, { unique: true, name: 'username_tenant_unique' });
UserSchema.index({ email: 1, tenantId: 1 }, { unique: true, name: 'email_tenant_unique' });

UserSchema.plugin(mongooseDelete, { deletedAt: true, overrideMethods: 'all' });
UserSchema.plugin(accessibleRecordsPlugin);
UserSchema.plugin(mongoTenant, {
  tenantIdRequired: function () {
    return this.user_type !== 'Admin';
  },
  tenantIdIndex: true,
});
