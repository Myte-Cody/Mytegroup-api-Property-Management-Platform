import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export enum ThreadLinkedEntityType {
  TICKET = 'TICKET',
  SCOPE_OF_WORK = 'SCOPE_OF_WORK',
  TENANT_CHAT = 'TENANT_CHAT',
  LEASE = 'LEASE',
  PROPERTY = 'PROPERTY',
}

export enum ThreadType {
  // For Tickets
  LANDLORD_TENANT = 'LANDLORD_TENANT', // Landlord ↔ Tenant (always active, contractor added when assigned)

  // For Scope of Work
  LANDLORD_TENANT_SOW = 'LANDLORD_TENANT_SOW', // Landlord ↔ Tenant (always active)
  LANDLORD_CONTRACTOR = 'LANDLORD_CONTRACTOR', // Landlord ↔ Contractor (optional for contractor)
  CONTRACTOR_TENANT = 'CONTRACTOR_TENANT', // Contractor ↔ Tenant (optional for both)
  SOW_GROUP = 'SOW_GROUP', // Group thread (optional for contractors/tenants, mandatory for landlord)

  // For Tenant-to-Tenant Chat
  TENANT_TENANT = 'TENANT_TENANT', // Tenant ↔ Tenant direct chat
  TENANT_TENANT_GROUP = 'TENANT_TENANT_GROUP', // Tenant group chat (multiple tenants)
}

export type ThreadDocument = Thread & Document;

@Schema({
  timestamps: true,
  toJSON: {
    virtuals: true,
  },
})
export class Thread {
  @Prop({ required: true, maxlength: 200 })
  title: string;

  @Prop({
    required: true,
    enum: ThreadLinkedEntityType,
  })
  linkedEntityType: ThreadLinkedEntityType;

  @Prop({ required: true, type: MongooseSchema.Types.ObjectId })
  linkedEntityId: MongooseSchema.Types.ObjectId;

  @Prop({ required: true })
  linkedEntityModel: string;

  @Prop({
    required: true,
    enum: ThreadType,
  })
  threadType: ThreadType;

  // Group chat admin features
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: false })
  createdBy?: MongooseSchema.Types.ObjectId; // Group creator/owner

  @Prop({ type: [MongooseSchema.Types.ObjectId], ref: 'User', default: [] })
  admins: MongooseSchema.Types.ObjectId[]; // Group admins (includes creator)

  @Prop({ type: String, required: false })
  avatarUrl?: string; // Group avatar/picture

  createdAt?: Date;
  updatedAt?: Date;
}

export const ThreadSchema = SchemaFactory.createForClass(Thread);

// Indexes
ThreadSchema.index({ linkedEntityId: 1, linkedEntityType: 1, threadType: 1 });

// Virtual populate for messages
ThreadSchema.virtual('messages', {
  ref: 'ThreadMessage',
  localField: '_id',
  foreignField: 'thread',
});

// Virtual populate for participants
ThreadSchema.virtual('participants', {
  ref: 'ThreadParticipant',
  localField: '_id',
  foreignField: 'thread',
});
