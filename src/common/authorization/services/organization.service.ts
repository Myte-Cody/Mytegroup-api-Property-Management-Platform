import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Organization } from '../../../features/organizations/schemas/organization.schema';
import { OrganizationType } from '../../enums/organization.enum';

@Injectable()
export class OrganizationService {
  constructor(
    @InjectModel(Organization.name) private readonly organizationModel: Model<Organization>,
  ) {}

  /**
   * Check if an organization is of type LANDLORD
   * @param organizationId The organization ID to check
   * @returns True if the organization is a landlord, false otherwise
   */
  async isLandlord(organizationId: string | Types.ObjectId): Promise<boolean> {
    if (!organizationId || !Types.ObjectId.isValid(organizationId)) {
      return false;
    }

    const organization = await this.organizationModel.findById(organizationId).exec();
    return organization?.type === OrganizationType.LANDLORD;
  }
}
