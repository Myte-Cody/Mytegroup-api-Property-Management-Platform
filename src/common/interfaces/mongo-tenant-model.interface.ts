import { Model } from "mongoose";
import { ObjectId } from "mongodb";


export interface MongoTenantModel<T> extends Model<T> {
    byTenant: (landlordId: ObjectId) => Model<T>;
}