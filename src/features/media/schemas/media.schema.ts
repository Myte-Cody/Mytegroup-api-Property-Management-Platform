import { accessibleRecordsPlugin } from '@casl/mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import * as mongooseDelete from 'mongoose-delete';
import { SoftDelete } from '../../../common/interfaces/soft-delete.interface';
const mongoTenant = require('mongo-tenant');

export enum MediaType {
  IMAGE = 'image',
  DOCUMENT = 'document',
  VIDEO = 'video',
  AUDIO = 'audio',
  OTHER = 'other',
}

export enum StorageDisk {
  LOCAL = 'local',
  S3 = 's3',
}

@Schema()
export class MediaMetadata {
  @Prop()
  width?: number;

  @Prop()
  height?: number;

  @Prop()
  alt_text?: string;

  @Prop()
  caption?: string;
}

@Schema({ timestamps: true })
export class Media extends Document implements SoftDelete {
  @Prop({ required: true, index: true })
  model_type: string; // 'Property', 'Unit', 'Tenant', etc.

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    required: true,
    index: true,
  })
  model_id: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true })
  file_name: string; // Stored filename (with UUID)

  @Prop({ required: true })
  mime_type: string; // image/jpeg, application/pdf, etc.

  @Prop({ required: true, min: 0 })
  size: number; // File size in bytes

  @Prop({
    type: String,
    enum: MediaType,
    required: true,
  })
  type: MediaType; // Media type classification

  // Storage configuration
  @Prop({
    type: String,
    enum: StorageDisk,
    required: true,
    default: StorageDisk.LOCAL,
  })
  disk: StorageDisk; // Storage driver

  @Prop({ required: true })
  path: string; // Storage path

  @Prop()
  url?: string; // Public URL (stored for S3/CDN, calculated for local)

  // Collection/category for organization
  @Prop({ default: 'default', trim: true })
  collection_name: string; // 'gallery', 'documents', 'thumbnails', etc.

  // Metadata for images and other files
  @Prop({ type: MediaMetadata })
  metadata?: MediaMetadata;

  // Soft delete
  deleted: boolean;
  deletedAt?: Date;
}

export const MediaSchema = SchemaFactory.createForClass(Media);

MediaSchema.plugin(mongooseDelete, { deletedAt: true, overrideMethods: 'all' });
MediaSchema.plugin(accessibleRecordsPlugin);
MediaSchema.plugin(mongoTenant);

