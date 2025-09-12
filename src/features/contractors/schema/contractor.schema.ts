import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import { SoftDelete } from "src/common/interfaces/soft-delete.interface";
const mongoTenant = require('mongo-tenant');
import { accessibleRecordsPlugin } from '@casl/mongoose';
import * as mongooseDelete from 'mongoose-delete';



@Schema({ timestamps: true })
export class Contractor extends Document implements SoftDelete {

    @Prop({ required: true})
    name: string;

    deleted: boolean;
    deletedAt?: Date;
}

// plugin
export const ContractorSchema = SchemaFactory.createForClass(Contractor);

// Add compound unique index for multi-tenant uniqueness
ContractorSchema.index({ name: 1, tenant_id: 1 }, { unique: true, name: 'contractor_name_tenant_unique' });

ContractorSchema.plugin(mongooseDelete, { deletedAt: true, overrideMethods: 'all' });
ContractorSchema.plugin(accessibleRecordsPlugin);
ContractorSchema.plugin(mongoTenant)
