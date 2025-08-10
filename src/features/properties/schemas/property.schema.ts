import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Schema as MongooseSchema } from "mongoose";
import { Types } from "mongoose";

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

@Schema()
export class Property extends Document {
  // Unique identifier (MongoDB will auto-generate _id)
  @Prop({ required: true, trim: true, maxlength: 128 })
  name: string;

  @Prop({ type: Address, required: true })
  address: Address;

  @Prop({ maxlength: 1024, default: "" })
  description: string;

  // Reference to the landlord/user who owns the property
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "User", required: true })
  owner: Types.ObjectId;

  @Prop({ enum: ["Active", "Inactive", "Archived"], default: "Active" })
  status: string;

  @Prop({ default: Date.now, immutable: true })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;

  // Optional: Array of unit references (for fast lookup)
  @Prop({ type: [{ type: MongooseSchema.Types.ObjectId, ref: "Unit" }] })
  units: Types.ObjectId[];
}

export const PropertySchema = SchemaFactory.createForClass(Property);
