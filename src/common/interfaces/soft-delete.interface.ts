import { Document } from 'mongoose';

export interface SoftDelete extends Document {
  deleted: boolean;
  deletedAt?: Date;
}
