import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import { SoftDelete } from "src/common/interfaces/soft-delete.interface";
import * as mongooseDelete from 'mongoose-delete';
const mongoTenant = require('mongo-tenant');
import { accessibleRecordsPlugin } from '@casl/mongoose';


@Schema({ timestamps: true })
export class Tenant extends Document implements SoftDelete {
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
export const TenantSchema = SchemaFactory.createForClass(Tenant);

TenantSchema.plugin(mongooseDelete, { deletedAt: true, overrideMethods: 'all' });
TenantSchema.plugin(accessibleRecordsPlugin);
TenantSchema.plugin(mongoTenant)

