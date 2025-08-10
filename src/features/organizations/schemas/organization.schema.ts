import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Schema as MongooseSchema } from "mongoose";
import { Types } from "mongoose";

@Schema()
export class Address {
  @Prop({ trim: true })
  street: string;

  @Prop({ trim: true })
  city: string;

  @Prop({ trim: true })
  state: string;

  @Prop({ trim: true })
  postalCode: string;

  @Prop({ trim: true })
  country: string;
}

@Schema()
export class Organization extends Document {
  @Prop({
    required: true,
    trim: true,
    maxlength: 128,
    unique: true,
  })
  name: string;

  @Prop({ type: Address })
  address: Address;

  @Prop({
    trim: true,
    lowercase: true,
    match: /.+\@.+\..+/,
  })
  contactEmail: string;

  @Prop({ trim: true })
  phone: string;

  @Prop({ trim: true })
  logoUrl: string;

  @Prop({
    default: Date.now,
    immutable: true,
  })
  createdAt: Date;

  @Prop({
    default: Date.now,
  })
  updatedAt: Date;

  @Prop([{ type: MongooseSchema.Types.ObjectId, ref: "User" }])
  users: Types.ObjectId[];
}

export const OrganizationSchema = SchemaFactory.createForClass(Organization);
