import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import * as mongooseDelete from 'mongoose-delete';
import { OrganizationType } from '../../../common/enums/organization.enum';
import { SoftDelete } from '../../../common/interfaces/soft-delete.interface';

@Schema({ timestamps: true })
export class Organization extends Document implements SoftDelete {
  @Prop({
    required: true,
    trim: true,
    maxlength: 128,
    unique: true,
    lowercase: true, // Ensure name is always stored in lowercase
  })
  name: string;

  @Prop({
    type: String,
    enum: OrganizationType,
    required: true,
  })
  type: OrganizationType;

  @Prop([{ type: MongooseSchema.Types.ObjectId, ref: 'User' }])
  users: Types.ObjectId[];
  deleted: boolean;
  deletedAt?: Date;
}

export const OrganizationSchema = SchemaFactory.createForClass(Organization);

OrganizationSchema.plugin(mongooseDelete, { deletedAt: true });
