import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AuditLogDocument = AuditLog & Document;

@Schema({ timestamps: true })
export class AuditLog extends Document {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  action: string;

  @Prop({ type: Object })
  details: Record<string, any>;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);
