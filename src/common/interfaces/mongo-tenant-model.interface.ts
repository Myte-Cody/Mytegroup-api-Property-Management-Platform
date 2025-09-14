import { ObjectId } from 'mongodb';
import { Model } from 'mongoose';

export interface MongoTenantModel<T> extends Model<T> {
  byTenant: (landlordId: ObjectId) => Model<T>;
}
