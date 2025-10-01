import {
  BadRequestException,
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
import { SessionService } from '../../common/services/session.service';
import { createPaginatedResponse } from '../../common/utils/pagination.utils';
import { MediaService } from '../media/services/media.service';
import { User, UserDocument } from '../users/schemas/user.schema';
import { CreateUnitDto } from './dto/create-unit.dto';
import { PaginatedUnitsResponse, UnitQueryDto } from './dto/unit-query.dto';
import { PropertyStatisticsDto, UnitStatusCount, UnitTypeCount } from './dto/property-statistics.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { Property } from './schemas/property.schema';
import { Unit } from './schemas/unit.schema';
import { UnitBusinessValidator } from './validators/unit-business-validator';

@Injectable()
export class UnitsService {
  constructor(
    @InjectModel(Unit.name) private readonly unitModel: AppModel<Unit>,
    @InjectModel(Property.name)
    private readonly propertyModel: AppModel<Property>,
    @InjectModel(User.name)
    private readonly userModel: AppModel<UserDocument>,
    private readonly unitBusinessValidator: UnitBusinessValidator,
    private caslAuthorizationService: CaslAuthorizationService,
    private readonly mediaService: MediaService,
    private readonly sessionService: SessionService,
  ) {}

  async create(createUnitDto: CreateUnitDto, propertyId: string, currentUser: UserDocument) {
    // Create the unit first
    const ability = this.caslAuthorizationService.createAbilityForUser(currentUser);

    if (!ability.can(Action.Create, Unit)) {
      throw new ForbiddenException('You do not have permission to create units');
    }

    return await this.sessionService.withSession(async (session: ClientSession) => {
      const property = await this.propertyModel.findById(propertyId, null, { session }).exec();

      if (!property) {
        throw new UnprocessableEntityException(`Property with ID ${propertyId} not found`);
      }

      await this.unitBusinessValidator.validateCreate({
        createDto: createUnitDto,
        propertyId,
        currentUser,
      });

      const newUnit = new this.unitModel({
        ...createUnitDto,
        property: propertyId,
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

  async findAllPaginated(
    queryDto: UnitQueryDto,
    currentUser: UserDocument,
  ): Promise<PaginatedUnitsResponse<Unit>> {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      propertyId,
      minSize,
      maxSize,
    } = queryDto;


    const ability = this.caslAuthorizationService.createAbilityForUser(currentUser);

    if (!ability.can(Action.Read, Unit)) {
      throw new ForbiddenException('You do not have permission to view units');
    }

    const pipeline: any[] = [];

    // Step 1: Build initial match conditions
    const matchConditions: any = {};

    // Add CASL conditions
    // todo verify below
    const caslConditions = (this.unitModel as any).accessibleBy(ability, Action.Read).getQuery();
    Object.assign(matchConditions, caslConditions);

    // Filter by specific property if provided
    if (propertyId) {
      // Convert string property ID to ObjectId for proper matching
      const mongoose = require('mongoose');
      const propertyObjectId = new mongoose.Types.ObjectId(propertyId);
      matchConditions.property = propertyObjectId;
    }

    if (search) {
      matchConditions.unitNumber = { $regex: search, $options: 'i' };
    }


    const type = queryDto.type;
    const status = queryDto.availabilityStatus;

    if(type) matchConditions.type = type;
    if(status) matchConditions.availabilityStatus = status;


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

    pipeline.push({ $match: matchConditions });

    // Step 2: Lookup property
    pipeline.push({
      $lookup: {
        from: 'properties',
        localField: 'property',
        foreignField: '_id',
        as: 'property'
      }
    });

    pipeline.push({
      $unwind: {
        path: '$property',
        preserveNullAndEmptyArrays: true
      }
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
                $and: [
                  { $eq: ['$unit', '$$unitId'] },
                  { $eq: ['$status', 'ACTIVE'] }
                ]
              }
            }
          },
          {
            $lookup: {
              from: 'tenants',
              localField: 'tenant',
              foreignField: '_id',
              as: 'tenant'
            }
          },
          {
            $unwind: {
              path: '$tenant',
              preserveNullAndEmptyArrays: true
            }
          }
        ],
        as: 'activeLease'
      }
    });

    // Step 4: Unwind activeLease (since there can only be one active lease per unit)
    pipeline.push({
      $unwind: {
        path: '$activeLease',
        preserveNullAndEmptyArrays: true
      }
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

  async findOne(id: string, currentUser: UserDocument) {
    // CASL: Check read permission
    const ability = this.caslAuthorizationService.createAbilityForUser(currentUser);

    if (!ability.can(Action.Read, Unit)) {
      throw new ForbiddenException('You do not have permission to view units');
    }

    const unit = await this.unitModel.findById(id).populate('property').exec();

    if (!unit) {
      throw new NotFoundException(`Unit with ID ${id} not found`);
    }

    // CASL: Final permission check on the specific record
    if (!ability.can(Action.Read, unit)) {
      throw new ForbiddenException('You do not have permission to view this unit');
    }

    // Fetch media for the unit
    const media = await this.mediaService.getMediaForEntity(
      'Unit',
      unit._id.toString(),
      currentUser,
      undefined, // collection_name (get all collections)
      {}, // filters (get all media)
    );

    return {
      ...unit.toObject(),
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

    // Business logic validation
    await this.unitBusinessValidator.validateUpdate({
      existingUnit,
      updateDto: updateUnitDto,
      userId: currentUser._id?.toString(),
      currentUser,
    });

    // Perform the update
    const updatedUnit = await this.unitModel
      .findByIdAndUpdate(id, updateUnitDto, { new: true })
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

    const mongoose = require('mongoose');
    const propertyObjectId = new mongoose.Types.ObjectId(propertyId);

    // Use MongoDB aggregation pipeline for all calculations
    const pipeline = [
      // Match units for this property
      { 
        $match: { 
          property: propertyObjectId,
          // Add CASL conditions
          ...((this.unitModel as any).accessibleBy(ability, Action.Read).getQuery())
        } 
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
                  $and: [
                    { $eq: ['$unit', '$$unitId'] },
                    { $eq: ['$status', 'ACTIVE'] }
                  ]
                }
              }
            }
          ],
          as: 'activeLease'
        }
      },
      // Unwind activeLease (since there can only be one active lease per unit)
      {
        $unwind: {
          path: '$activeLease',
          preserveNullAndEmptyArrays: true
        }
      },
      // Add calculated fields
      {
        $addFields: {
          isOccupied: { $eq: ['$availabilityStatus', 'OCCUPIED'] },
          effectiveRent: {
            $cond: [
              { $and: [
                { $eq: ['$availabilityStatus', 'OCCUPIED'] },
                { $ne: [{ $ifNull: ['$activeLease.rentAmount', null] }, null] }
              ]},
              '$activeLease.rentAmount',
              { $cond: [
                { $eq: ['$availabilityStatus', 'OCCUPIED'] },
                { $ifNull: ['$monthlyRent', 0] },
                0
              ]}
            ]
          }
        }
      },
      // Group and calculate statistics
      {
        $group: {
          _id: null,
          totalUnits: { $sum: 1 },
          occupiedUnits: { $sum: { $cond: ['$isOccupied', 1, 0] } },
          totalMonthlyRevenue: { $sum: '$effectiveRent' }
        }
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
              0
            ]
          }
        }
      }
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
          totalMonthlyRevenue: 0
        }
      };
    }

    return {
      success: true,
      data: {
        propertyId,
        ...result[0]
      }
    };
  }
}
