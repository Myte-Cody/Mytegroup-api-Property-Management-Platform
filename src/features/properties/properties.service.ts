import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Action } from '../../common/casl/casl-ability.factory';
import { CaslAuthorizationService } from '../../common/casl/services/casl-authorization.service';
import { AppModel } from '../../common/interfaces/app-model.interface';
import { createPaginatedResponse } from '../../common/utils/pagination.utils';
import { Organization } from '../organizations/schemas/organization.schema';
import { User } from '../users/schemas/user.schema';
import { CreatePropertyDto } from './dto/create-property.dto';
import { PaginatedPropertiesResponse, PropertyQueryDto } from './dto/property-query.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { Property } from './schemas/property.schema';
import { Unit } from './schemas/unit.schema';

@Injectable()
export class PropertiesService {
  constructor(
    @InjectModel(Property.name)
    private readonly propertyModel: AppModel<Property>,
    @InjectModel(Unit.name)
    private readonly unitModel: AppModel<Unit>,
    @InjectModel(Organization.name)
    private readonly organizationModel: AppModel<Organization>,
    @InjectModel(User.name)
    private readonly userModel: AppModel<User>,
    private caslAuthorizationService: CaslAuthorizationService,
  ) {}
  async create(createPropertyDto: CreatePropertyDto) {
    if (createPropertyDto.owner) {
      const existingOwner = await this.organizationModel.findById(createPropertyDto.owner).exec();
      if (!existingOwner) {
        throw new UnprocessableEntityException(
          `Organization with ID ${createPropertyDto.owner} does not exist`,
        );
      }
    }

    const newProperty = new this.propertyModel({
      ...createPropertyDto,
    });
    return await newProperty.save();
  }

  async findAllPaginated(
    queryDto: PropertyQueryDto,
    currentUser: User,
  ): Promise<PaginatedPropertiesResponse<Property>> {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      landlordId,
    } = queryDto;

    // Ensure currentUser has populated organization data
    const populatedUser = await this.userModel
      .findById(currentUser._id)
      .populate('organization')
      .exec();

    if (!populatedUser) {
      return createPaginatedResponse<Property>([], 0, page, limit);
    }

    // Create ability for the current user
    const ability = this.caslAuthorizationService.createAbilityForUser(
      populatedUser as unknown as User & { organization: Organization; isAdmin?: boolean },
    );

    // Build the base query using CASL accessibleBy
    let query = this.propertyModel.accessibleBy(ability, Action.Read);

    // Add landlord filter if specified
    if (landlordId) {
      query = query.where({ owner: landlordId });
    }

    // Add search functionality
    if (search) {
      query = query.where({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { 'address.street': { $regex: search, $options: 'i' } },
          { 'address.city': { $regex: search, $options: 'i' } },
          { 'address.state': { $regex: search, $options: 'i' } },
          { 'address.postalCode': { $regex: search, $options: 'i' } },
        ],
      });
    }

    // Add filters
    const cityFilters = queryDto['filters[city]'];
    const stateFilters = queryDto['filters[state]'];

    if (cityFilters && cityFilters.length > 0) {
      query = query.where({ 'address.city': { $in: cityFilters } });
    }

    if (stateFilters && stateFilters.length > 0) {
      query = query.where({ 'address.state': { $in: stateFilters } });
    }

    // Build sort object
    const sortObj: any = {};
    sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Execute queries
    const [properties, total] = await Promise.all([
      query.sort(sortObj).skip(skip).limit(limit).exec(),
      query.clone().countDocuments().exec(),
    ]);

    return createPaginatedResponse<Property>(properties, total, page, limit);
  }

  async findOne(id: string) {
    const property = await this.propertyModel.findById(id).exec();
    if (!property) {
      throw new NotFoundException(`Property with ID ${id} not found`);
    }
    return property;
  }

  async update(id: string, updatePropertyDto: UpdatePropertyDto) {
    const property = await this.propertyModel.findById(id).exec();
    if (!property) {
      throw new NotFoundException(`Property with ID ${id} not found`);
    }

    if (updatePropertyDto.owner) {
      const existingOwner = await this.organizationModel.findById(updatePropertyDto.owner).exec();
      if (!existingOwner) {
        throw new UnprocessableEntityException(
          `Organization with ID ${updatePropertyDto.owner} does not exist`,
        );
      }
    }

    const updatedProperty = await this.propertyModel
      .findByIdAndUpdate(id, updatePropertyDto, { new: true })
      .exec();

    return updatedProperty;
  }

  async remove(id: string) {
    const property = await this.propertyModel.findById(id).exec();
    if (!property) {
      throw new NotFoundException(`Property with ID ${id} not found`);
    }

    const activeUnits = await this.unitModel
      .find({
        property: id,
        deleted: { $ne: true },
      })
      .exec();

    if (activeUnits.length > 0) {
      throw new ConflictException(
        `Cannot delete property. It has ${activeUnits.length} active unit(s). Please delete all units first.`,
      );
    }

    await this.propertyModel.deleteById(id);

    return { message: 'Property deleted successfully' };
  }
}
