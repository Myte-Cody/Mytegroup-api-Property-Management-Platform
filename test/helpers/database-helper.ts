import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';

export class DatabaseHelper {
  constructor(private readonly app: INestApplication) {}

  getModel<T>(modelName: string): Model<T> {
    return this.app.get<Model<T>>(getModelToken(modelName));
  }

  async clearCollection(modelName: string): Promise<void> {
    const model = this.getModel(modelName);
    await model.deleteMany({});
  }

  async seedCollection<T>(modelName: string, data: Partial<T>[]): Promise<any[]> {
    const model = this.getModel<T>(modelName);
    return model.insertMany(data);
  }
}
