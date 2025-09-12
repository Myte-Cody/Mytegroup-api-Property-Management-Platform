import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Action } from '../../common/casl/casl-ability.factory';
import { CaslAuthorizationService } from '../../common/casl/services/casl-authorization.service';
import { AppModel } from '../../common/interfaces/app-model.interface';
import { createPaginatedResponse } from '../../common/utils/pagination.utils';
import { User, UserDocument } from '../users/schemas/user.schema';
import { CreatePropertyDto } from './dto/create-property.dto';
import { PaginatedPropertiesResponse, PropertyQueryDto } from './dto/property-query.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { Property } from './schemas/property.schema';
import { Unit } from './schemas/unit.schema';
import { MediaService } from '../media/services/media.service';

@Injectable()
export class PropertiesService {
  constructor(
    @InjectModel(Property.name)
    private readonly propertyModel: AppModel<Property>,
    @InjectModel(Unit.name)
    private readonly unitModel: AppModel<Unit>,
    @InjectModel(User.name)
    private readonly userModel: AppModel<UserDocument>,
    private caslAuthorizationService: CaslAuthorizationService,
    private readonly mediaService: MediaService,
  ) {}

  async findAllPaginated(
    queryDto: PropertyQueryDto,
    currentUser: UserDocument,
  ): Promise<PaginatedPropertiesResponse<Property>> {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = queryDto;

    // STEP 1: CASL - Check if user can read properties
    const ability = this.caslAuthorizationService.createAbilityForUser(currentUser);

    if (!ability.can(Action.Read, Property)) {
      throw new ForbiddenException('You do not have permission to view properties');
    }

    // STEP 2: mongo-tenant - Apply tenant isolation (mandatory for all users)
    const landlordId = currentUser.tenantId && typeof currentUser.tenantId === 'object' 
      ? (currentUser.tenantId as any)._id 
      : currentUser.tenantId;

    if (!landlordId) {
      // Users without tenantId cannot access any properties
      return createPaginatedResponse<Property>([], 0, page, limit);
    }

    let baseQuery = this.propertyModel.byTenant(landlordId).find();    // STEP 3: Apply CASL field-level filtering
    baseQuery = (baseQuery as any).accessibleBy(ability, Action.Read);

    // Add search functionality
    if (search) {
      baseQuery = baseQuery.where({
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
      baseQuery = baseQuery.where({ 'address.city': { $in: cityFilters } });
    }

    if (stateFilters && stateFilters.length > 0) {
      baseQuery = baseQuery.where({ 'address.state': { $in: stateFilters } });
    }

    // Build sort object
    const sortObj: any = {};
    sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Execute queries
    const [properties, total] = await Promise.all([
      baseQuery.clone().sort(sortObj).skip(skip).limit(limit).exec(),
      baseQuery.clone().countDocuments().exec(),
    ]);

    // Fetch media for each property
    const propertiesWithMedia = await Promise.all(
      properties.map(async (property) => {
        const media = await this.mediaService.getMediaForEntity(
          'Property',
          property._id.toString(),
          currentUser,
          undefined, // collection_name (get all collections)
          {} // filters (get all media)
        );
        return {
          ...property.toObject(),
          media,
        };
      })
    );

    return createPaginatedResponse<any>(propertiesWithMedia, total, page, limit);
  }

  async findOne(id: string, currentUser: UserDocument) {
    // CASL: Check read permission
    const ability = this.caslAuthorizationService.createAbilityForUser(currentUser);

    if (!ability.can(Action.Read, Property)) {
      throw new ForbiddenException('You do not have permission to view properties');
    }

    // mongo-tenant: Apply tenant filtering (mandatory)
    if (!currentUser.tenantId) {
      throw new ForbiddenException('Access denied: No tenant context');
    }

    const property = await this.propertyModel
      .byTenant(currentUser.tenantId)
      .findById(id)
      .exec();

    if (!property) {
      throw new NotFoundException(`Property with ID ${id} not found`);
    }

    // CASL: Final permission check on the specific record
    if (!ability.can(Action.Read, property)) {
      throw new ForbiddenException('You do not have permission to view this property');
    }

    // Fetch media for the property
    const media = await this.mediaService.getMediaForEntity(
      'Property',
      property._id.toString(),
      currentUser,
      undefined, // collection_name (get all collections)
      {} // filters (get all media)
    );

    return {
      ...property.toObject(),
      media,
    };
  }


  async create(createPropertyDto: CreatePropertyDto, currentUser: UserDocument) {
    // Create the property first
    const ability = this.caslAuthorizationService.createAbilityForUser(currentUser);

    if (!ability.can(Action.Create, Property)) {
      throw new ForbiddenException('You do not have permission to create properties');
    }

    // Ensure user has tenant context
    if (!currentUser.tenantId) {
      throw new ForbiddenException('Cannot create property: No tenant context');
    }

    const landlordId = currentUser.tenantId && typeof currentUser.tenantId === 'object' 
      ? (currentUser.tenantId as any)._id 
      : currentUser.tenantId;

    // Check property name uniqueness within the same landlord
    const existingProperty = await this.propertyModel
      .byTenant(landlordId)
      .findOne({ name: createPropertyDto.name })
      .exec();
    
    if (existingProperty) {
      throw new UnprocessableEntityException(
        `Property name '${createPropertyDto.name}' already exists in this organization`
      );
    }

    // Ensure the property is created within the user's tenant context
    const propertyData = {
      ...createPropertyDto,
      address: createPropertyDto.address,
      tenantId: currentUser.tenantId, // Enforce tenant boundary
    };

    // mongo-tenant: Create within tenant context
    const PropertyWithTenant = this.propertyModel.byTenant(currentUser.tenantId);
    const newProperty = new PropertyWithTenant(propertyData);

    const property = await newProperty.save();

    // If media files are provided, upload them
    if (createPropertyDto.media_files && createPropertyDto.media_files.length > 0) {
      const uploadPromises = createPropertyDto.media_files.map(async (file) => {
        return this.mediaService.upload(
          file,
          property,
          currentUser,
          'property_photos'
        );
      });

      const uploadedMedia = await Promise.all(uploadPromises);

      return {
        success: true,
        data: {
          property,
          media: uploadedMedia,
        },
        message: `Property created successfully with ${uploadedMedia.length} media file(s)`,
      };
    }

    return {
      success: true,
      data: { property },
      message: 'Property created successfully',
    };
  }

  async update(id: string, updatePropertyDto: UpdatePropertyDto, currentUser: UserDocument) {
    // CASL: Check update permission
    const ability = this.caslAuthorizationService.createAbilityForUser(currentUser);

    // Ensure user has tenant context
    if (!currentUser.tenantId) {
      throw new ForbiddenException('Access denied: No tenant context');
    }

    const landlordId = currentUser.tenantId && typeof currentUser.tenantId === 'object' 
      ? (currentUser.tenantId as any)._id 
      : currentUser.tenantId;

    // mongo-tenant: Find within tenant context
    const property = await this.propertyModel
      .byTenant(landlordId)
      .findById(id)
      .exec();

    if (!property) {
      throw new NotFoundException(`Property with ID ${id} not found`);
    }

    // CASL: Check if user can update this specific property
    if (!ability.can(Action.Update, property)) {
      throw new ForbiddenException('You do not have permission to update this property');
    }

    // Check for name uniqueness if name is being updated
    if (updatePropertyDto.name && updatePropertyDto.name !== property.name) {
      const existingProperty = await this.propertyModel
        .byTenant(landlordId)
        .findOne({ 
          name: updatePropertyDto.name,
          _id: { $ne: id } // Exclude current property from the check
        })
        .exec();
      
      if (existingProperty) {
        throw new UnprocessableEntityException(
          `Property name '${updatePropertyDto.name}' already exists in this organization`
        );
      }
    }

    // Filter allowed fields based on user role
    const filteredUpdateDto = this.filterUpdateFields(updatePropertyDto, currentUser);

    const updatedProperty = await this.propertyModel
      .findByIdAndUpdate(id, filteredUpdateDto, { new: true })
      .exec();

    return updatedProperty;
  }

  async remove(id: string, currentUser: UserDocument) {
    // CASL: Check delete permission
    const ability = this.caslAuthorizationService.createAbilityForUser(currentUser);

    // Ensure user has tenant context
    if (!currentUser.tenantId) {
      throw new ForbiddenException('Access denied: No tenant context');
    }

    // mongo-tenant: Find within tenant context
    const property = await this.propertyModel
      .byTenant(currentUser.tenantId)
      .findById(id)
      .exec();

    if (!property) {
      throw new NotFoundException(`Property with ID ${id} not found`);
    }

    // CASL: Check if user can delete this property
    if (!ability.can(Action.Delete, property)) {
      throw new ForbiddenException('You do not have permission to delete this property');
    }

    // Check for active units using tenant-aware query
    const activeUnits = await (this.unitModel as any)
      .byTenant(currentUser.tenantId)
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

  // Helper method to filter update fields based on user role
  private filterUpdateFields(updatePropertyDto: UpdatePropertyDto, currentUser: UserDocument): UpdatePropertyDto {
    const allowedFields = this.getAllowedUpdateFields(currentUser);
    const filteredDto: any = {};

    for (const field of allowedFields) {
      if (updatePropertyDto[field] !== undefined) {
        filteredDto[field] = updatePropertyDto[field];
      }
    }

    return filteredDto;
  }

  private getAllowedUpdateFields(currentUser: UserDocument): string[] {
    switch (currentUser.user_type) {
      case 'Landlord':
        return ['name', 'description', 'street', 'city', 'state', 'postalCode', 'country'];
      case 'Tenant':
        return []; // Tenants cannot update properties
      case 'Contractor':
        return []; // Contractors cannot update properties
      default:
        return [];
    }
  }
}
