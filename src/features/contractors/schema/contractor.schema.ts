import { accessibleRecordsPlugin } from '@casl/mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import * as mongooseDelete from 'mongoose-delete';
import { SoftDelete } from 'src/common/interfaces/soft-delete.interface';

@Schema({ timestamps: true })
export class Contractor extends Document implements SoftDelete {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  category: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Landlord' }], default: [] })
  landlords: Types.ObjectId[];

  deleted: boolean;
  deletedAt?: Date;
}

// plugin
export const ContractorSchema = SchemaFactory.createForClass(Contractor);

ContractorSchema.index({ name: 1 }, { unique: true, name: 'contractor_name_tenant_unique' });

ContractorSchema.plugin(mongooseDelete, { deletedAt: true, overrideMethods: 'all' });
ContractorSchema.plugin(accessibleRecordsPlugin);
