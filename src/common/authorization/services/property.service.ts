import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Property } from '../../../features/properties/schemas/property.schema';

@Injectable()
export class PropertyService {
  constructor(@InjectModel(Property.name) private readonly propertyModel: Model<Property>) {}

  /**
   * Check if a property belongs to a specific organization
   * @param propertyId The property ID to check
   * @param organizationId The organization ID that should own the property
   * @returns True if the property belongs to the organization, false otherwise
   */
  async isPropertyOwnedByOrganization(
    propertyId: string | Types.ObjectId,
    organizationId: string | Types.ObjectId,
  ): Promise<boolean> {
    if (
      !propertyId ||
      !organizationId ||
      !Types.ObjectId.isValid(propertyId) ||
      !Types.ObjectId.isValid(organizationId)
    ) {
      return false;
    }

    const property = await this.propertyModel.findById(propertyId).exec();
    return property?.owner?.toString() === organizationId.toString();
  }
}
