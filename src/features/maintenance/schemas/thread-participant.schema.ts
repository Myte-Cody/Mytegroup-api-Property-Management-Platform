import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export enum ParticipantStatus {
  PENDING = 'PENDING', // Invitation sent, awaiting response
  ACCEPTED = 'ACCEPTED', // Participant accepted the thread
  DECLINED = 'DECLINED', // Participant declined the thread
  ACTIVE = 'ACTIVE', // Mandatory participant (landlord or auto-accepted)
}

export enum ParticipantType {
  LANDLORD = 'LANDLORD',
  TENANT = 'TENANT',
  CONTRACTOR = 'CONTRACTOR',
}

export type ThreadParticipantDocument = ThreadParticipant & Document;

@Schema({
  timestamps: true,
  toJSON: {
    virtuals: true,
  },
})
export class ThreadParticipant {
  @Prop({ required: true, type: MongooseSchema.Types.ObjectId, ref: 'Thread' })
  thread: MongooseSchema.Types.ObjectId;

  @Prop({
    required: true,
    enum: ParticipantType,
  })
  participantType: ParticipantType;

  @Prop({ required: true, type: MongooseSchema.Types.ObjectId })
  participantId: MongooseSchema.Types.ObjectId;

  @Prop({ required: true })
  participantModel: string;

  @Prop({
    required: true,
    enum: ParticipantStatus,
    default: ParticipantStatus.PENDING,
  })
  status: ParticipantStatus;

  @Prop({ type: Boolean, default: false })
  isMandatory: boolean; // True for landlords and landlord-tenant threads

  createdAt?: Date;
  updatedAt?: Date;
}

export const ThreadParticipantSchema = SchemaFactory.createForClass(ThreadParticipant);

// Indexes
ThreadParticipantSchema.index({ thread: 1, participantId: 1 }, { unique: true });
ThreadParticipantSchema.index({ participantId: 1, participantType: 1 });
ThreadParticipantSchema.index({ thread: 1, status: 1 });
