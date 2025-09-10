import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import { SoftDelete } from "src/common/interfaces/soft-delete.interface";
const mongoTenant = require('mongo-tenant');
import { accessibleRecordsPlugin } from '@casl/mongoose';
import * as mongooseDelete from 'mongoose-delete';



@Schema({ timestamps: true })
export class Contractor extends Document implements SoftDelete {
    @Prop({
        type: MongooseSchema.Types.ObjectId,
        ref: 'Landlord',
        required: true
    })
    landlord_id: Types.ObjectId; 

    @Prop({ required: true})
    name: string;

    deleted: boolean;
    deletedAt?: Date;
}

// plugin
export const ContractorSchema = SchemaFactory.createForClass(Contractor);

ContractorSchema.plugin(mongooseDelete, { deletedAt: true, overrideMethods: 'all' });
ContractorSchema.plugin(accessibleRecordsPlugin);
ContractorSchema.plugin(mongoTenant)
