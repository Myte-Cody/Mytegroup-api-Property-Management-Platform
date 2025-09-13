import { accessibleRecordsPlugin } from '@casl/mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import * as mongooseDelete from 'mongoose-delete';
import { SoftDelete } from 'src/common/interfaces/soft-delete.interface';

@Schema({ timestamps: true })
export class Landlord extends Document implements SoftDelete {
  @Prop({ required: true, unique: true })
  name: string;

  deleted: boolean;
  deletedAt?: Date;
}

export const LandlordSchema = SchemaFactory.createForClass(Landlord);

LandlordSchema.plugin(mongooseDelete, { deletedAt: true, overrideMethods: 'all' });
LandlordSchema.plugin(accessibleRecordsPlugin);
