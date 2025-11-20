import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession } from 'mongoose';
import { Action } from '../../common/casl/casl-ability.factory';
import { CaslAuthorizationService } from '../../common/casl/services/casl-authorization.service';
import { AppModel } from '../../common/interfaces/app-model.interface';
import { GeocodingService } from '../../common/services/geocoding.service';
import { SessionService } from '../../common/services/session.service';
import { TenancyContextService } from '../../common/services/tenancy-context.service';
import { createPaginatedResponse } from '../../common/utils/pagination.utils';
import { MediaService } from '../media/services/media.service';
import { User, UserDocument } from '../users/schemas/user.schema';
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
    @InjectModel(User.name)
    private readonly userModel: AppModel<UserDocument>,
    private caslAuthorizationService: CaslAuthorizationService,
    private readonly mediaService: MediaService,
    private readonly sessionService: SessionService,
    private readonly geocodingService: GeocodingService,
    private readonly tenancyContextService: TenancyContextService,
  ) {}

  async countByLandlord(landlordId: any) {
    const [properties, units] = await Promise.all([
      this.propertyModel.countDocuments({ landlord: landlordId }).exec(),
      this.unitModel.countDocuments({ landlord: landlordId }).exec(),
    ]);

    return {
      totalProperties: properties,
      totalUnits: units,
    };
  }

  async findAllPaginated(
    queryDto: PropertyQueryDto,
    currentUser: UserDocument,
  ): Promise<PaginatedPropertiesResponse<Property>> {
    const { page = 1, limit = 10, search, sortBy = 'createdAt', sortOrder = 'desc' } = queryDto;

    // STEP 1: CASL - Check if user can read properties
    const ability = this.caslAuthorizationService.createAbilityForUser(currentUser);

    if (!ability.can(Action.Read, Property)) {
      throw new ForbiddenException('You do not have permission to view properties');
    }

    const pipeline: any[] = [];

    // Step 1: Build initial match conditions
    const matchConditions: any = { deleted: false };

    // Add landlord scope for landlord users
    if (this.tenancyContextService.isLandlord(currentUser)) {
      const landlordId = this.tenancyContextService.getLandlordContext(currentUser);
      matchConditions.landlord = landlordId;
    }

    // Add CASL conditions
    const caslConditions = (this.propertyModel as any)
      .accessibleBy(ability, Action.Read)
      .getQuery();
    Object.assign(matchConditions, caslConditions);

    // Add search functionality
    if (search) {
      matchConditions.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { 'address.street': { $regex: search, $options: 'i' } },
        { 'address.city': { $regex: search, $options: 'i' } },
        { 'address.state': { $regex: search, $options: 'i' } },
        { 'address.postalCode': { $regex: search, $options: 'i' } },
      ];
    }

    pipeline.push({ $match: matchConditions });

    // Step 2: Lookup units and calculate unit count and occupancy
    pipeline.push({
      $lookup: {
        from: 'units',
        let: { propertyId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ['$property', '$$propertyId'] },
              deleted: false,
            },
          },
        ],
        as: 'units',
      },
    });

    // Step 3: Calculate unit statistics
    pipeline.push({
      $addFields: {
        unitCount: { $size: '$units' },
        occupiedUnits: {
          $size: {
            $filter: {
              input: '$units',
              cond: { $eq: ['$$this.availabilityStatus', 'OCCUPIED'] },
            },
          },
        },
      },
    });

    // Step 4: Calculate occupancy rate
    pipeline.push({
      $addFields: {
        occupancyRate: {
          $cond: {
            if: { $gt: ['$unitCount', 0] },
            then: {
              $multiply: [{ $divide: ['$occupiedUnits', '$unitCount'] }, 100],
            },
            else: 0,
          },
        },
      },
    });

    // Step 5: Remove the units array as we don't need it in the response
    pipeline.push({
      $project: {
        units: 0,
        occupiedUnits: 0,
      },
    });

    // Step 6: Add sorting
    const sortObj: any = {};
    sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;
    pipeline.push({ $sort: sortObj });

    // Step 7: Create separate pipeline for counting
    const countPipeline = [...pipeline, { $count: 'total' }];

    // Step 8: Add pagination to main pipeline
    const skip = (page - 1) * limit;
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: limit });

    // Execute queries
    const [propertiesResult, countResult] = await Promise.all([
      this.propertyModel.aggregate(pipeline).exec(),
      this.propertyModel.aggregate(countPipeline).exec(),
    ]);

    const properties = propertiesResult;
    const total = countResult.length > 0 ? countResult[0].total : 0;

    // Fetch media for each property
    const propertiesWithMedia = await Promise.all(
      properties.map(async (property) => {
        const media = await this.mediaService.getMediaForEntity(
          'Property',
          property._id.toString(),
          currentUser,
          undefined, // collection_name (get all collections)
          {}, // filters (get all media)
        );
        return {
          ...property,
          media,
        };
      }),
    );

    return createPaginatedResponse<any>(propertiesWithMedia, total, page, limit);
  }

  async findOne(id: string, currentUser: UserDocument) {
    // CASL: Check read permission
    const ability = this.caslAuthorizationService.createAbilityForUser(currentUser);

    if (!ability.can(Action.Read, Property)) {
      throw new ForbiddenException('You do not have permission to view properties');
    }

    const property = await this.propertyModel.findById(id).exec();

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
      {}, // filters (get all media)
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

    return await this.sessionService.withSession(async (session: ClientSession | null) => {
      // Get landlord context
      const landlordId = this.tenancyContextService.getLandlordContext(currentUser);

      // Check property name uniqueness within the same landlord
      const existingProperty = await this.propertyModel
        .findOne({ name: createPropertyDto.name, landlord: landlordId })
        .exec();

      if (existingProperty) {
        throw new UnprocessableEntityException(
          `Property name '${createPropertyDto.name}' already exists in this organization`,
        );
      }

      // Ensure the property is created within the user's landlord context
      const propertyData = {
        ...createPropertyDto,
        landlord: landlordId,
        address: createPropertyDto.address,
      };

      const newProperty = new this.propertyModel(propertyData);

      const property = await newProperty.save();

      // If media files are provided, upload them
      if (createPropertyDto.media_files && createPropertyDto.media_files.length > 0) {
        const uploadPromises = createPropertyDto.media_files.map(async (file) => {
          return this.mediaService.upload(
            file,
            property,
            currentUser,
            'property_photos',
            undefined,
            undefined,
            session,
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
    });
  }

  async update(id: string, updatePropertyDto: UpdatePropertyDto, currentUser: UserDocument) {
    // CASL: Check update permission
    const ability = this.caslAuthorizationService.createAbilityForUser(currentUser);

    const property = await this.propertyModel.findById(id).exec();

    if (!property) {
      throw new NotFoundException(`Property with ID ${id} not found`);
    }

    // CASL: Check if user can update this specific property
    if (!ability.can(Action.Update, property)) {
      throw new ForbiddenException('You do not have permission to update this property');
    }

    // Prevent changing landlord field
    const { landlord: _landlord, ...safeUpdate } = updatePropertyDto as any;
    if (_landlord) {
      throw new ForbiddenException('Cannot change property landlord');
    }

    // Check for name uniqueness if name is being updated (within the same landlord)
    if (updatePropertyDto.name && updatePropertyDto.name !== property.name) {
      const existingProperty = await this.propertyModel
        .findOne({
          name: updatePropertyDto.name,
          landlord: property.landlord,
          _id: { $ne: id }, // Exclude current property from the check
        })
        .exec();

      if (existingProperty) {
        throw new UnprocessableEntityException(
          `Property name '${updatePropertyDto.name}' already exists in this organization`,
        );
      }
    }

    // If googleMapsLink is provided, extract address from it
    let addressUpdate = {};
    if (updatePropertyDto.googleMapsLink) {
      const extractedLocation = await this.geocodingService.extractLocationFromMapsLink(
        updatePropertyDto.googleMapsLink,
      );

      // Use extracted location data to populate address fields including coordinates
      addressUpdate = {
        street: extractedLocation.city || '',
        city: extractedLocation.city || '',
        state: extractedLocation.state || '',
        postalCode: extractedLocation.postalCode || '',
        country: extractedLocation.country || '',
        latitude: extractedLocation.latitude,
        longitude: extractedLocation.longitude,
      };
    } else if (updatePropertyDto.latitude && updatePropertyDto.longitude) {
      // If coordinates are provided directly, update them
      addressUpdate = {
        latitude: updatePropertyDto.latitude,
        longitude: updatePropertyDto.longitude,
      };
    }

    // Filter allowed fields based on user role
    const filteredUpdateDto = this.filterUpdateFields(
      { ...updatePropertyDto, ...addressUpdate },
      currentUser,
    );

    const updatedProperty = await this.propertyModel
      .findByIdAndUpdate(id, filteredUpdateDto, { new: true })
      .exec();

    return updatedProperty;
  }

  async remove(id: string, currentUser: UserDocument) {
    // CASL: Check delete permission
    const ability = this.caslAuthorizationService.createAbilityForUser(currentUser);

    const property = await this.propertyModel.findById(id).exec();

    if (!property) {
      throw new NotFoundException(`Property with ID ${id} not found`);
    }

    // CASL: Check if user can delete this property
    if (!ability.can(Action.Delete, property)) {
      throw new ForbiddenException('You do not have permission to delete this property');
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

  // Helper method to filter update fields based on user role
  private filterUpdateFields(
    updatePropertyDto: UpdatePropertyDto,
    currentUser: UserDocument,
  ): UpdatePropertyDto {
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
