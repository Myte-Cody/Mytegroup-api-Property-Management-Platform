import { accessibleRecordsPlugin } from '@casl/mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import * as mongooseDelete from 'mongoose-delete';
import { SoftDelete } from '../../../common/interfaces/soft-delete.interface';
import { TenantAwareDocument } from 'mongo-tenant';
const mongoTenant = require('mongo-tenant');

export type UserDocument = User & Document & TenantAwareDocument & SoftDelete & {
  landlord_id?: Types.ObjectId;
}

@Schema({ timestamps: true })
export class User extends Document implements SoftDelete {
  @Prop({ required: true, trim: true, maxlength: 64, unique: true })
  username: string;

  @Prop({
    required: true,
    trim: true,
    lowercase: true,
    unique: true,
    match: /.+\@.+\..+/,
  })
  email: string;

  @Prop({ required: true, select: false })
  password: string;

  @Prop({ 
    type: String, 
    required: true,
    enum: ['Landlord', 'Tenant', 'Contractor', 'Admin']
  })
  user_type: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    refPath: 'user_type' // Dynamic reference based on user_type
  })
  party_id: Types.ObjectId;  // Points to Landlord/Tenant/Contractor

  // @Prop({
  //   type: MongooseSchema.Types.ObjectId,
  //   ref: 'Landlord'  // For tenants/contractors only
  // })
  // landlord_id?: Types.ObjectId;

  @Prop({ type: Boolean, default: false })
  isAdmin?: boolean;

  deleted: boolean;
  deletedAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.plugin(mongooseDelete, { deletedAt: true, overrideMethods: 'all' });
UserSchema.plugin(accessibleRecordsPlugin);
UserSchema.plugin(mongoTenant, {
  tenantIdKey: 'landlord_id',
  tenantIdType: MongooseSchema.Types.ObjectId, 
  tenantIdRequired: function() {
    return this.user_type !== 'Admin';
  },
  tenantIdIndex: true
});