import { accessibleRecordsPlugin } from '@casl/mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Favorite extends Document {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
  })
  user: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Unit',
    required: true,
  })
  unit: Types.ObjectId;
}

export const FavoriteSchema = SchemaFactory.createForClass(Favorite);

// Compound unique index to prevent duplicate favorites
FavoriteSchema.index({ user: 1, unit: 1 }, { unique: true });

FavoriteSchema.plugin(accessibleRecordsPlugin);
