import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Schema as MongooseSchema } from "mongoose";
import { Types } from "mongoose";
import * as mongooseDelete from "mongoose-delete";
import { SoftDelete } from "../../../common/interfaces/soft-delete.interface";

@Schema()
export class Address {
  @Prop({ required: true, trim: true })
  street: string;

  @Prop({ required: true, trim: true })
  city: string;

  @Prop({ required: true, trim: true })
  state: string;

  @Prop({ required: true, trim: true })
  postalCode: string;

  @Prop({ required: true, trim: true })
  country: string;
}

@Schema({ timestamps: true })
export class Property extends Document implements SoftDelete {
  @Prop({ required: true, trim: true, maxlength: 128 })
  name: string;

  @Prop({ type: Address, required: true })
  address: Address;

  @Prop({ maxlength: 1024, default: "" })
  description: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: "Organization",
    required: true,
  })
  owner: Types.ObjectId;

  // Properties added by mongoose-delete plugin
  deleted: boolean;
  deletedAt?: Date;
}

export const PropertySchema = SchemaFactory.createForClass(Property);

// Add mongoose-delete plugin with options
PropertySchema.plugin(mongooseDelete, { deletedAt: true });
