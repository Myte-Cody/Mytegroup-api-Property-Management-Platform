import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import { SoftDelete } from "src/common/interfaces/soft-delete.interface";
import * as mongooseDelete from 'mongoose-delete';
import { accessibleRecordsPlugin } from '@casl/mongoose';

@Schema({ timestamps: true })
export class Landlord extends Document implements SoftDelete {

    @Prop({ required: true})
    company_name: string;

    @Prop()
    business_number?: string;

    deleted: boolean;
    deletedAt?: Date;
}

export const LandlordSchema = SchemaFactory.createForClass(Landlord);

LandlordSchema.plugin(mongooseDelete, { deletedAt: true, overrideMethods: 'all' });
LandlordSchema.plugin(accessibleRecordsPlugin);