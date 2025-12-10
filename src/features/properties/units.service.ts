import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, PipelineStage, Types } from 'mongoose';
import { Action } from '../../common/casl/casl-ability.factory';
import { CaslAuthorizationService } from '../../common/casl/services/casl-authorization.service';
import { LeaseStatus } from '../../common/enums/lease.enum';
import { UserType } from '../../common/enums/user-type.enum';
import { AppModel } from '../../common/interfaces/app-model.interface';
import { GeocodingService } from '../../common/services/geocoding.service';
import { SessionService } from '../../common/services/session.service';
import { TenancyContextService } from '../../common/services/tenancy-context.service';
import { createPaginatedResponse } from '../../common/utils/pagination.utils';
import { Lease } from '../leases/schemas/lease.schema';
import { MediaService } from '../media/services/media.service';
import { User, UserDocument } from '../users/schemas/user.schema';
import { CreateUnitDto } from './dto/create-unit.dto';
import { MarketplaceQueryDto } from './dto/marketplace-query.dto';
import { PaginatedUnitsResponse, UnitQueryDto } from './dto/unit-query.dto';
import { UnitStatsDto } from './dto/unit-stats.dto';
import { UnitsOverviewStatsResponseDto } from './dto/units-overview-stats.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { Property } from './schemas/property.schema';
import { Unit } from './schemas/unit.schema';
import { UnitBusinessValidator } from './validators/unit-business-validator';

@Injectable()
export class UnitsService {
  private readonly logger = new Logger(UnitsService.name);

  constructor(
    @InjectModel(Unit.name) private readonly unitModel: AppModel<Unit>,
    @InjectModel(Property.name)
    private readonly propertyModel: AppModel<Property>,
    @InjectModel(Lease.name)
    private readonly leaseModel: AppModel<Lease>,
    @InjectModel(User.name)
    private readonly userModel: AppModel<UserDocument>,
    private readonly unitBusinessValidator: UnitBusinessValidator,
    private caslAuthorizationService: CaslAuthorizationService,
    private readonly mediaService: MediaService,
    private readonly sessionService: SessionService,
    private readonly geocodingService: GeocodingService,
    private readonly tenancyContextService: TenancyContextService,
  ) {}

  async create(createUnitDto: CreateUnitDto, propertyId: string, currentUser: UserDocument) {
    // Create the unit first
    const ability = this.caslAuthorizationService.createAbilityForUser(currentUser);

    if (!ability.can(Action.Create, Unit)) {
      throw new ForbiddenException('You do not have permission to create units');
    }

    return await this.sessionService.withSession(async (session: ClientSession | null) => {
      // Get landlord context
      const landlordId = this.tenancyContextService.getLandlordContext(currentUser);

      // Verify property belongs to this landlord
      const property = await this.propertyModel
        .findOne(
          {
            _id: propertyId,
            landlord: landlordId,
          },
          null,
          { session },
        )
        .exec();

      if (!property) {
        throw new UnprocessableEntityException(
          `Property with ID ${propertyId} not found in your organization`,
        );
      }

      await this.unitBusinessValidator.validateCreate({
        createDto: createUnitDto,
        propertyId,
        currentUser,
      });

      // Process address based on usePropertyAddress flag
      let address = undefined;

      if (createUnitDto.usePropertyAddress) {
        // Use property's address coordinates
        if (property.address?.latitude && property.address?.longitude) {
          address = {
            latitude: property.address.latitude,
            longitude: property.address.longitude,
            city: property.address.city,
            state: property.address.state,
            country: property.address.country,
            postalCode: property.address.postalCode,
          };
        } else {
          this.logger.warn(
            `Property ${propertyId} does not have coordinates. Unit will be created without address.`,
          );
        }
      } else if (createUnitDto.googleMapsLink) {
        // Extract address from Google Maps link
        try {
          address = await this.geocodingService.extractLocationFromMapsLink(
            createUnitDto.googleMapsLink,
          );
        } catch (error) {
          // Log as warning but don't fail the unit creation
          const message = (error as any)?.message || String(error);
          this.logger.warn(
            `Failed to extract location from Google Maps link during unit creation: ${message}`,
          );
        }
      }

      // Create unit data without googleMapsLink and usePropertyAddress but with address and landlord
      const { googleMapsLink, usePropertyAddress, ...unitData } = createUnitDto;
      const newUnit = new this.unitModel({
        ...unitData,
        property: propertyId,
        landlord: landlordId,
        ...(address && { address }),
      });

      const unit = await newUnit.save({ session });

      // If media files are provided, upload them
      if (createUnitDto.media_files && createUnitDto.media_files.length > 0) {
        const uploadPromises = createUnitDto.media_files.map(async (file) => {
          return this.mediaService.upload(
            file,
            unit,
            currentUser,
            'unit_photos',
            undefined,
            undefined,
            session,
          );
        });

        const uploadedMedia = await Promise.all(uploadPromises);

        return {
          success: true,
          data: {
            unit,
            media: uploadedMedia,
          },
          message: `Unit created successfully with ${uploadedMedia.length} media file(s)`,
        };
      }

      return {
        success: true,
        data: { unit },
        message: 'Unit created successfully',
      };
    });
  }

  /**
   * Get all units published to marketplace (public endpoint)
   * No authentication required, returns units with publishToMarketplace = true and no active lease
   */
  async findMarketplaceUnits(queryDto?: MarketplaceQueryDto) {
    const pipeline: any[] = [];

    // Step 1: Match only units published to marketplace
    const matchConditions: any = {
      deleted: false,
      publishToMarketplace: true,
    };

    // Add landlord filter - convert string to ObjectId
    if (queryDto?.landlord) {
      matchConditions.landlord = new Types.ObjectId(queryDto.landlord);
    }

    // Add type filter
    if (queryDto?.type) {
      matchConditions.type = queryDto.type;
    }

    // Add rent range filtering (using marketRent field)
    if (queryDto?.minRent !== undefined || queryDto?.maxRent !== undefined) {
      const rentQuery: any = {};
      if (queryDto.minRent !== undefined) {
        rentQuery.$gte = queryDto.minRent;
      }
      if (queryDto.maxRent !== undefined) {
        rentQuery.$lte = queryDto.maxRent;
      }
      matchConditions.marketRent = rentQuery;
    }

    pipeline.push({ $match: matchConditions });

    // Step 2: Lookup property
    pipeline.push({
      $lookup: {
        from: 'properties',
        localField: 'property',
        foreignField: '_id',
        as: 'property',
      },
    });

    pipeline.push({
      $unwind: {
        path: '$property',
        preserveNullAndEmptyArrays: true,
      },
    });

    // Step 3: Lookup active lease to filter out units with active leases
    pipeline.push({
      $lookup: {
        from: 'leases',
        let: { unitId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [{ $eq: ['$unit', '$$unitId'] }, { $eq: ['$status', 'ACTIVE'] }],
              },
            },
          },
        ],
        as: 'activeLease',
      },
    });

    // Step 4: Filter out units with active leases
    pipeline.push({
      $match: {
        activeLease: { $eq: [] },
      },
    });

    // Step 5: Add search filter (after property lookup to search property name)
    if (queryDto?.search) {
      pipeline.push({
        $match: {
          $or: [
            { unitNumber: { $regex: queryDto.search, $options: 'i' } },
            { 'property.name': { $regex: queryDto.search, $options: 'i' } },
          ],
        },
      });
    }

    // Step 6: Sort by createdAt descending
    pipeline.push({ $sort: { createdAt: -1 } });

    // Execute query
    const units = await this.unitModel.aggregate(pipeline).exec();

    // Fetch media for each unit (without user context for public endpoint)
    const unitsWithMedia = await Promise.all(
      units.map(async (unit) => {
        // For public endpoint, get media without user authorization
        const media = await this.mediaService.getMediaForEntity(
          'Unit',
          unit._id.toString(),
          null, // No user context for public endpoint
          undefined, // collection_name (get all collections)
          {}, // filters (get all media)
        );
        return {
          ...unit,
          media,
        };
      }),
    );

    return {
      success: true,
      data: unitsWithMedia,
      total: unitsWithMedia.length,
    };
  }

  async findAllPaginated(
    queryDto: UnitQueryDto,
    currentUser: UserDocument,
  ): Promise<PaginatedUnitsResponse<Unit>> {
    // If user is a tenant, use special tenant units logic
    if (currentUser.user_type === UserType.TENANT) {
      return this.getTenantUnits(currentUser, queryDto);
    }

    const {
      page = 1,
      limit = 10,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      propertyId,
      minSize,
      maxSize,
      publishToMarketplace,
    } = queryDto;

    const ability = this.caslAuthorizationService.createAbilityForUser(currentUser);

    if (!ability.can(Action.Read, Unit)) {
      throw new ForbiddenException('You do not have permission to view units');
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
    const caslConditions = (this.unitModel as any).accessibleBy(ability, Action.Read).getQuery();
    Object.assign(matchConditions, caslConditions);

    // Filter by specific property if provided
    if (propertyId) {
      // Convert string property ID to ObjectId for proper matching
      const propertyObjectId = new Types.ObjectId(propertyId);
      matchConditions.property = propertyObjectId;
    }

    if (search) {
      matchConditions.unitNumber = { $regex: search, $options: 'i' };
    }

    const type = queryDto.type;
    const status = queryDto.availabilityStatus;

    if (type) matchConditions.type = type;
    if (status) matchConditions.availabilityStatus = status;

    // Add size range filtering
    if (minSize !== undefined || maxSize !== undefined) {
      const sizeQuery: any = {};
      if (minSize !== undefined) {
        sizeQuery.$gte = minSize;
      }
      if (maxSize !== undefined) {
        sizeQuery.$lte = maxSize;
      }
      matchConditions.size = sizeQuery;
    }

    // Filter by marketplace publication status
    if (publishToMarketplace !== undefined) {
      matchConditions.publishToMarketplace = publishToMarketplace;
    }

    pipeline.push({ $match: matchConditions });

    // Step 2: Lookup property
    pipeline.push({
      $lookup: {
        from: 'properties',
        localField: 'property',
        foreignField: '_id',
        as: 'property',
      },
    });

    pipeline.push({
      $unwind: {
        path: '$property',
        preserveNullAndEmptyArrays: true,
      },
    });

    // Step 3: Lookup active lease with tenant
    pipeline.push({
      $lookup: {
        from: 'leases',
        let: { unitId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [{ $eq: ['$unit', '$$unitId'] }, { $eq: ['$status', 'ACTIVE'] }],
              },
            },
          },
          {
            $lookup: {
              from: 'tenants',
              localField: 'tenant',
              foreignField: '_id',
              as: 'tenant',
            },
          },
          {
            $unwind: {
              path: '$tenant',
              preserveNullAndEmptyArrays: true,
            },
          },
        ],
        as: 'activeLease',
      },
    });

    // Step 4: Unwind activeLease (since there can only be one active lease per unit)
    pipeline.push({
      $unwind: {
        path: '$activeLease',
        preserveNullAndEmptyArrays: true,
      },
    });

    // Step 5: Add sorting
    const sortObj: any = {};
    sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;
    pipeline.push({ $sort: sortObj });

    // Step 6: Create separate pipeline for counting
    const countPipeline = [...pipeline, { $count: 'total' }];

    // Step 7: Add pagination to main pipeline
    const skip = (page - 1) * limit;
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: limit });

    // Execute queries
    const [unitsResult, countResult] = await Promise.all([
      this.unitModel.aggregate(pipeline).exec(),
      this.unitModel.aggregate(countPipeline).exec(),
    ]);

    const units = unitsResult;
    const total = countResult.length > 0 ? countResult[0].total : 0;

    // Fetch media for each unit
    const unitsWithMedia = await Promise.all(
      units.map(async (unit) => {
        const media = await this.mediaService.getMediaForEntity(
          'Unit',
          unit._id.toString(),
          currentUser,
          undefined, // collection_name (get all collections)
          {}, // filters (get all media)
        );
        return {
          ...unit,
          media,
        };
      }),
    );

    return createPaginatedResponse<any>(unitsWithMedia, total, page, limit);
  }

  /**
   * Get units for a tenant based on their leases (no pagination)
   * This is called internally when a tenant user accesses /units endpoint
   */
  private async getTenantUnits(
    currentUser: UserDocument,
    queryDto: UnitQueryDto,
  ): Promise<PaginatedUnitsResponse<Unit>> {
    // Get tenant ID - handle both string and ObjectId formats
    let tenantId: string | Types.ObjectId;
    if (currentUser.organization_id) {
      if (
        typeof currentUser.organization_id === 'object' &&
        (currentUser.organization_id as any)._id
      ) {
        tenantId = (currentUser.organization_id as any)._id;
      } else {
        tenantId = currentUser.organization_id;
      }
    }

    if (!tenantId) {
      throw new ForbiddenException('No tenant profile associated with this user');
    }

    // Convert to ObjectId if it's a string
    const tenantObjectId =
      typeof tenantId === 'string' ? new Types.ObjectId(tenantId) : tenantId;

    // Build lease match conditions
    const leaseMatchConditions: any = {
      tenant: tenantObjectId,
      deleted: false,
    };

    // Get all units for this tenant based on their leases
    const pipeline = [
      // Match leases for this tenant
      {
        $match: leaseMatchConditions,
      },
      // Group by unit to get unique units
      {
        $group: {
          _id: '$unit',
        },
      },
      // Lookup unit details
      {
        $lookup: {
          from: 'units',
          let: { unitId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$_id', '$$unitId'] },
                deleted: false,
              },
            },
          ],
          as: 'unit',
        },
      },
      {
        $unwind: '$unit',
      },
      // Lookup property details
      {
        $lookup: {
          from: 'properties',
          let: { propertyId: '$unit.property' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$_id', '$$propertyId'] },
                deleted: false,
              },
            },
          ],
          as: 'unit.property',
        },
      },
      {
        $unwind: {
          path: '$unit.property',
          preserveNullAndEmptyArrays: true,
        },
      },
      // Lookup active lease for this unit
      {
        $lookup: {
          from: 'leases',
          let: { unitId: '$unit._id', tenantId: tenantObjectId },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$unit', '$$unitId'] },
                    { $eq: ['$tenant', '$$tenantId'] },
                    { $eq: ['$status', 'ACTIVE'] },
                  ],
                },
              },
            },
            {
              $lookup: {
                from: 'tenants',
                localField: 'tenant',
                foreignField: '_id',
                as: 'tenant',
              },
            },
            {
              $unwind: {
                path: '$tenant',
                preserveNullAndEmptyArrays: true,
              },
            },
          ],
          as: 'unit.activeLease',
        },
      },
      {
        $unwind: {
          path: '$unit.activeLease',
          preserveNullAndEmptyArrays: true,
        },
      },
      // Replace root with unit
      {
        $replaceRoot: {
          newRoot: '$unit',
        },
      },
    ];

    const units = await this.leaseModel.aggregate(pipeline).exec();

    // Fetch media for each unit
    const unitsWithMedia = await Promise.all(
      units.map(async (unit) => {
        const media = await this.mediaService.getMediaForEntity(
          'Unit',
          unit._id.toString(),
          currentUser,
          undefined,
          {},
        );
        return {
          ...unit,
          media,
        };
      }),
    );

    return {
      data: unitsWithMedia,
      total: unitsWithMedia.length,
      page: 1,
      limit: unitsWithMedia.length,
      totalPages: 1,
      hasNextPage: false,
      hasPrevPage: false,
    };
  }

  async findOne(id: string, currentUser: UserDocument) {
    // CASL: Check read permission
    const ability = this.caslAuthorizationService.createAbilityForUser(currentUser);

    if (!ability.can(Action.Read, Unit)) {
      throw new ForbiddenException('You do not have permission to view units');
    }

    const unitObjectId = new Types.ObjectId(id);

    // Use aggregation pipeline to include active lease with tenant
    const pipeline: any[] = [
      { $match: { _id: unitObjectId } },
      // Lookup property
      {
        $lookup: {
          from: 'properties',
          localField: 'property',
          foreignField: '_id',
          as: 'property',
        },
      },
      {
        $unwind: {
          path: '$property',
          preserveNullAndEmptyArrays: true,
        },
      },
      // Lookup active lease with tenant
      {
        $lookup: {
          from: 'leases',
          let: { unitId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [{ $eq: ['$unit', '$$unitId'] }, { $eq: ['$status', 'ACTIVE'] }],
                },
              },
            },
            {
              $lookup: {
                from: 'tenants',
                localField: 'tenant',
                foreignField: '_id',
                as: 'tenant',
              },
            },
            {
              $unwind: {
                path: '$tenant',
                preserveNullAndEmptyArrays: true,
              },
            },
          ],
          as: 'activeLease',
        },
      },
      // Unwind activeLease (since there can only be one active lease per unit)
      {
        $unwind: {
          path: '$activeLease',
          preserveNullAndEmptyArrays: true,
        },
      },
    ];

    const result = await this.unitModel.aggregate(pipeline).exec();

    if (!result || result.length === 0) {
      throw new NotFoundException(`Unit with ID ${id} not found`);
    }

    const unit = result[0];

    // Fetch media for the unit
    const media = await this.mediaService.getMediaForEntity(
      'Unit',
      unit._id.toString(),
      currentUser,
      undefined, // collection_name (get all collections)
      {}, // filters (get all media)
    );

    return {
      ...unit,
      media,
    };
  }

  async update(id: string, updateUnitDto: UpdateUnitDto, currentUser: UserDocument) {
    if (!updateUnitDto || Object.keys(updateUnitDto).length === 0) {
      throw new BadRequestException('Update data cannot be empty');
    }

    // CASL: Check update permission
    const ability = this.caslAuthorizationService.createAbilityForUser(currentUser);

    const existingUnit = await this.unitModel.findById(id).populate('property').exec();

    if (!existingUnit) {
      throw new NotFoundException(`Unit with ID ${id} not found`);
    }

    // CASL: Check if user can update this specific unit
    if (!ability.can(Action.Update, existingUnit)) {
      throw new ForbiddenException('You do not have permission to update this unit');
    }

    // Prevent changing landlord field
    const { landlord: _landlord, ...safeUpdate } = updateUnitDto as any;
    if (_landlord) {
      throw new ForbiddenException('Cannot change unit landlord');
    }

    // Business logic validation
    await this.unitBusinessValidator.validateUpdate({
      existingUnit,
      updateDto: updateUnitDto,
      userId: currentUser._id?.toString(),
      currentUser,
    });

    // Validate availableFrom date if unit has an active lease
    if (updateUnitDto.availableFrom) {
      const activeLease = await this.leaseModel
        .findOne({
          unit: id,
          status: LeaseStatus.ACTIVE,
        })
        .exec();

      if (activeLease) {
        const requestedDate = new Date(updateUnitDto.availableFrom);
        const leaseEndDate = new Date(activeLease.endDate);

        if (requestedDate < leaseEndDate) {
          throw new BadRequestException(
            `Cannot set availableFrom date to ${requestedDate.toISOString().split('T')[0]} because the unit has an active lease that ends on ${leaseEndDate.toISOString().split('T')[0]}. The availableFrom date must be on or after the lease end date.`,
          );
        }
      }
    }

    // Process address based on usePropertyAddress flag
    let address = undefined;

    if (updateUnitDto.usePropertyAddress) {
      // Use property's address coordinates
      const property = existingUnit.property as any;
      if (property.address?.latitude && property.address?.longitude) {
        address = {
          latitude: property.address.latitude,
          longitude: property.address.longitude,
          city: property.address.city,
          state: property.address.state,
          country: property.address.country,
          postalCode: property.address.postalCode,
        };
      } else {
        // If property doesn't have coordinates, clear the unit's custom address
        address = undefined;
      }
    } else if (updateUnitDto.googleMapsLink) {
      // Extract address from Google Maps link
      try {
        address = await this.geocodingService.extractLocationFromMapsLink(
          updateUnitDto.googleMapsLink,
        );
      } catch (error) {
        // Log as warning but don't fail the unit update
        const message = (error as any)?.message || String(error);
        this.logger.warn(
          `Failed to extract location from Google Maps link during unit update: ${message}`,
        );
      }
    }

    // Create update data without googleMapsLink and usePropertyAddress but with address
    const { googleMapsLink, usePropertyAddress, ...updateData } = updateUnitDto;
    const finalUpdateData = {
      ...updateData,
      ...(address !== undefined && { address }),
    };

    // Perform the update
    const updatedUnit = await this.unitModel
      .findByIdAndUpdate(id, finalUpdateData, { new: true })
      .exec();

    return updatedUnit;
  }

  async remove(id: string, currentUser: UserDocument) {
    // CASL: Check delete permission
    const ability = this.caslAuthorizationService.createAbilityForUser(currentUser);

    const unit = await this.unitModel.findById(id).populate('property').exec();

    if (!unit) {
      throw new NotFoundException(`Unit with ID ${id} not found`);
    }

    // CASL: Check if user can delete this unit
    if (!ability.can(Action.Delete, unit)) {
      throw new ForbiddenException('You do not have permission to delete this unit');
    }

    await this.unitBusinessValidator.validateDelete({
      unit,
    });
    await this.unitModel.deleteById(id);
    return { message: 'Unit deleted successfully' };
  }

  /**
   * Get overview statistics for all units across properties
   * This method calculates the following statistics:
   * - Total units count
   * - Occupied units count
   * - Available units count
   * - Occupancy rate
   * - Total monthly revenue from active leases
   */
  async getUnitsOverviewStats(currentUser: UserDocument): Promise<UnitsOverviewStatsResponseDto> {
    // CASL: Check read permission
    const ability = this.caslAuthorizationService.createAbilityForUser(currentUser);

    if (!ability.can(Action.Read, Unit)) {
      throw new ForbiddenException('You do not have permission to view units');
    }

    // Use MongoDB aggregation pipeline for all calculations
    const pipeline = [
      // Match units accessible to the user
      {
        $match: {
          ...(this.unitModel as any).accessibleBy(ability, Action.Read).getQuery(),
        },
      },
      // Lookup active lease with rent amount
      {
        $lookup: {
          from: 'leases',
          let: { unitId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [{ $eq: ['$unit', '$$unitId'] }, { $eq: ['$status', 'ACTIVE'] }],
                },
              },
            },
          ],
          as: 'activeLease',
        },
      },
      // Unwind activeLease (since there can only be one active lease per unit)
      {
        $unwind: {
          path: '$activeLease',
          preserveNullAndEmptyArrays: true,
        },
      },
      // Add calculated fields
      {
        $addFields: {
          isOccupied: { $eq: ['$availabilityStatus', 'OCCUPIED'] },
          isAvailable: { $eq: ['$availabilityStatus', 'VACANT'] },
          effectiveRent: {
            $cond: [
              {
                $and: [
                  { $eq: ['$availabilityStatus', 'OCCUPIED'] },
                  { $ne: [{ $ifNull: ['$activeLease.rentAmount', null] }, null] },
                ],
              },
              '$activeLease.rentAmount',
              {
                $cond: [
                  { $eq: ['$availabilityStatus', 'OCCUPIED'] },
                  { $ifNull: ['$monthlyRent', 0] },
                  0,
                ],
              },
            ],
          },
        },
      },
      // Group and calculate statistics
      {
        $group: {
          _id: null,
          totalUnits: { $sum: 1 },
          occupiedUnits: { $sum: { $cond: ['$isOccupied', 1, 0] } },
          availableUnits: { $sum: { $cond: ['$isAvailable', 1, 0] } },
          totalMonthlyRevenue: { $sum: '$effectiveRent' },
        },
      },
      // Calculate derived statistics
      {
        $project: {
          _id: 0,
          totalUnits: 1,
          occupiedUnits: 1,
          availableUnits: 1,
          totalMonthlyRevenue: 1,
          occupancyRate: {
            $cond: [
              { $gt: ['$totalUnits', 0] },
              { $round: [{ $multiply: [{ $divide: ['$occupiedUnits', '$totalUnits'] }, 100] }, 1] },
              0,
            ],
          },
        },
      },
    ];

    const result = await this.unitModel.aggregate(pipeline).exec();

    // If no units found, return default values
    if (!result || result.length === 0) {
      return {
        success: true,
        data: {
          totalUnits: 0,
          occupiedUnits: 0,
          availableUnits: 0,
          occupancyRate: 0,
          totalMonthlyRevenue: 0,
        },
      };
    }

    return {
      success: true,
      data: result[0],
    };
  }

  /**
   * Get key statistics for a property
   * This method calculates the following statistics:
   * - Total units count
   * - Occupancy rate
   * - Monthly revenue
   */
  async getPropertyStatistics(propertyId: string, currentUser: UserDocument) {
    // CASL: Check read permission
    const ability = this.caslAuthorizationService.createAbilityForUser(currentUser);

    if (!ability.can(Action.Read, Unit)) {
      throw new ForbiddenException('You do not have permission to view units');
    }

    // First verify the property exists
    const property = await this.propertyModel.findById(propertyId).exec();
    if (!property) {
      throw new NotFoundException(`Property with ID ${propertyId} not found`);
    }

    // Check if user has access to this property
    if (!ability.can(Action.Read, property)) {
      throw new ForbiddenException('You do not have permission to view this property');
    }

    const propertyObjectId = new Types.ObjectId(propertyId);

    // Use MongoDB aggregation pipeline for all calculations
    const pipeline = [
      // Match units for this property
      {
        $match: {
          property: propertyObjectId,
          deleted: false,
          // Add CASL conditions
          ...(this.unitModel as any).accessibleBy(ability, Action.Read).getQuery(),
        },
      },
      // Lookup active lease with rent amount
      {
        $lookup: {
          from: 'leases',
          let: { unitId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [{ $eq: ['$unit', '$$unitId'] }, { $eq: ['$status', 'ACTIVE'] }],
                },
              },
            },
          ],
          as: 'activeLease',
        },
      },
      // Unwind activeLease (since there can only be one active lease per unit)
      {
        $unwind: {
          path: '$activeLease',
          preserveNullAndEmptyArrays: true,
        },
      },
      // Add calculated fields
      {
        $addFields: {
          isOccupied: { $eq: ['$availabilityStatus', 'OCCUPIED'] },
          effectiveRent: {
            $cond: [
              {
                $and: [
                  { $eq: ['$availabilityStatus', 'OCCUPIED'] },
                  { $ne: [{ $ifNull: ['$activeLease.rentAmount', null] }, null] },
                ],
              },
              '$activeLease.rentAmount',
              {
                $cond: [
                  { $eq: ['$availabilityStatus', 'OCCUPIED'] },
                  { $ifNull: ['$monthlyRent', 0] },
                  0,
                ],
              },
            ],
          },
        },
      },
      // Group and calculate statistics
      {
        $group: {
          _id: null,
          totalUnits: { $sum: 1 },
          occupiedUnits: { $sum: { $cond: ['$isOccupied', 1, 0] } },
          totalMonthlyRevenue: { $sum: '$effectiveRent' },
        },
      },
      // Calculate derived statistics
      {
        $project: {
          _id: 0,
          totalUnits: 1,
          occupiedUnits: 1,
          totalMonthlyRevenue: 1,
          occupancyRate: {
            $cond: [
              { $gt: ['$totalUnits', 0] },
              { $round: [{ $multiply: [{ $divide: ['$occupiedUnits', '$totalUnits'] }, 100] }, 0] },
              0,
            ],
          },
        },
      },
    ];

    const result = await this.unitModel.aggregate(pipeline).exec();

    // If no units found, return default values
    if (!result || result.length === 0) {
      return {
        success: true,
        data: {
          propertyId,
          totalUnits: 0,
          occupiedUnits: 0,
          occupancyRate: 0,
          totalMonthlyRevenue: 0,
        },
      };
    }

    return {
      success: true,
      data: {
        propertyId,
        ...result[0],
      },
    };
  }

  async getUnitStats(
    unitId: string,
    currentUser: UserDocument,
  ): Promise<{ success: boolean; data: UnitStatsDto }> {
    const ability = this.caslAuthorizationService.createAbilityForUser(currentUser);

    if (!ability.can(Action.Read, Unit)) {
      throw new ForbiddenException('You do not have permission to view units');
    }

    const unitObjectId = new Types.ObjectId(unitId);

    // Build aggregation pipeline to calculate unit stats
    const pipeline: PipelineStage[] = [
      { $match: { _id: unitObjectId } },

      // Lookup property
      {
        $lookup: {
          from: 'properties',
          localField: 'property',
          foreignField: '_id',
          as: 'property',
        },
      },
      {
        $unwind: {
          path: '$property',
          preserveNullAndEmptyArrays: true,
        },
      },

      // Lookup active lease
      {
        $lookup: {
          from: 'leases',
          let: { unitId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [{ $eq: ['$unit', '$$unitId'] }, { $eq: ['$status', 'ACTIVE'] }],
                },
              },
            },
          ],
          as: 'activeLease',
        },
      },
      {
        $unwind: {
          path: '$activeLease',
          preserveNullAndEmptyArrays: true,
        },
      },

      // Calculate YTD revenue from transactions via active lease
      {
        $lookup: {
          from: 'transactions',
          let: { leaseId: '$activeLease._id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$lease', '$$leaseId'] },
                    { $gte: ['$paidAt', new Date(new Date().getFullYear(), 0, 1)] },
                    { $eq: ['$status', 'PAID'] },
                  ],
                },
              },
            },
            {
              $group: {
                _id: null,
                totalRevenue: { $sum: '$amount' },
                lastPaymentDate: { $max: '$paidAt' },
              },
            },
          ],
          as: 'ytdTransactions',
        },
      },

      // Get outstanding balance from pending/overdue transactions
      {
        $lookup: {
          from: 'transactions',
          let: { leaseId: '$activeLease._id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [{ $eq: ['$lease', '$$leaseId'] }, { $in: ['$status', ['OVERDUE']] }],
                },
              },
            },
            {
              $group: {
                _id: null,
                totalOwed: { $sum: '$amount' },
              },
            },
          ],
          as: 'outstandingTransactions',
        },
      },

      // Get next payment due (future transactions with smallest due date)
      {
        $lookup: {
          from: 'transactions',
          let: { leaseId: '$activeLease._id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$lease', '$$leaseId'] },
                    { $gt: ['$dueDate', new Date()] },
                    { $ne: [{ $ifNull: ['$dueDate', null] }, null] },
                  ],
                },
              },
            },
            {
              $sort: { dueDate: 1 },
            },
            {
              $limit: 1,
            },
            {
              $project: {
                nextDueDate: '$dueDate',
              },
            },
          ],
          as: 'nextPayment',
        },
      },

      // Count maintenance requests (we'll use a mock count for now since maintenance module doesn't exist)
      {
        $addFields: {
          maintenanceRequestsCount: 5, // Mock value - todo replace when maintenance module exists
        },
      },

      // Calculate final fields
      {
        $project: {
          _id: 1,
          ytdRevenue: {
            $cond: [
              { $gt: [{ $size: '$ytdTransactions' }, 0] },
              { $arrayElemAt: ['$ytdTransactions.totalRevenue', 0] },
              0,
            ],
          },
          maintenanceRequestsCount: '$maintenanceRequestsCount',
          currentBalance: {
            $cond: [
              { $gt: [{ $size: '$outstandingTransactions' }, 0] },
              { $arrayElemAt: ['$outstandingTransactions.totalOwed', 0] },
              0,
            ],
          },
          lastPaymentDate: {
            $cond: [
              { $gt: [{ $size: '$ytdTransactions' }, 0] },
              { $arrayElemAt: ['$ytdTransactions.lastPaymentDate', 0] },
              null,
            ],
          },
          nextPaymentDue: {
            $cond: [
              { $gt: [{ $size: '$nextPayment' }, 0] },
              { $arrayElemAt: ['$nextPayment.nextDueDate', 0] },
              null,
            ],
          },
        },
      },
    ];

    const result = await this.unitModel.aggregate(pipeline).exec();

    if (!result || result.length === 0) {
      throw new NotFoundException(`Unit with ID ${unitId} not found`);
    }

    const stats = result[0];

    // Check CASL permission on the found unit
    const unit = await this.unitModel.findById(unitId).populate('property').exec();
    if (!ability.can(Action.Read, unit)) {
      throw new ForbiddenException('You do not have permission to view this unit');
    }

    return {
      success: true,
      data: {
        unitId: stats._id.toString(),
        ytdRevenue: stats.ytdRevenue || 0,
        maintenanceRequestsCount: stats.maintenanceRequestsCount || 0,
        currentBalance: stats.currentBalance || 0,
        lastPaymentDate: stats.lastPaymentDate
          ? stats.lastPaymentDate.toISOString().split('T')[0]
          : null,
        nextPaymentDue: stats.nextPaymentDue
          ? stats.nextPaymentDue.toISOString().split('T')[0]
          : null,
      },
    };
  }
}
