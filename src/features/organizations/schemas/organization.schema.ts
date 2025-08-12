import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Schema as MongooseSchema } from "mongoose";
import { Types } from "mongoose";
import { OrganizationType } from "../../../common/enums/organization.enum";

@Schema({timestamps: true})
export class Organization extends Document {
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

  @Prop([{ type: MongooseSchema.Types.ObjectId, ref: "User" }])
  users: Types.ObjectId[];
}

export const OrganizationSchema = SchemaFactory.createForClass(Organization);
