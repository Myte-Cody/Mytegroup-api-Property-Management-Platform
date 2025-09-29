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

    let baseQuery = this.unitModel.find();

    baseQuery = (baseQuery as any).accessibleBy(ability, Action.Read);

    // Filter by specific property if provided
    if (propertyId) {
      baseQuery = baseQuery.where({ property: propertyId });
    }

    if (search) {
      baseQuery = baseQuery.where({ unitNumber: { $regex: search, $options: 'i' } });
    }

    // Add filters
    const typeFilters = queryDto['filters[type]'];
    const statusFilters = queryDto['filters[availabilityStatus]'];

    if (typeFilters && typeFilters.length > 0) {
      baseQuery = baseQuery.where({ type: { $in: typeFilters } });
    }

    if (statusFilters && statusFilters.length > 0) {
      baseQuery = baseQuery.where({ availabilityStatus: { $in: statusFilters } });
    }

    // Add size range filtering
    if (minSize !== undefined || maxSize !== undefined) {
      const sizeQuery: any = {};
      if (minSize !== undefined) {
        sizeQuery.$gte = minSize;
      }
      if (maxSize !== undefined) {
        sizeQuery.$lte = maxSize;
      }
      baseQuery = baseQuery.where({ size: sizeQuery });
    }

    // Build sort object
    const sortObj: any = {};
    sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const skip = (page - 1) * limit;

    // Create separate queries for data and count to avoid interference
    const dataQuery = baseQuery.clone().sort(sortObj).skip(skip).limit(limit).populate('property');
    const countQuery = baseQuery.clone().countDocuments();

    const [units, total] = await Promise.all([dataQuery.exec(), countQuery.exec()]);

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
          ...unit.toObject(),
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
}
