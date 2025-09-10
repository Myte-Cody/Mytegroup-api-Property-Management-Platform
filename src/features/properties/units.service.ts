import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Action } from '../../common/casl/casl-ability.factory';
import { CaslAuthorizationService } from '../../common/casl/services/casl-authorization.service';
import { AppModel } from '../../common/interfaces/app-model.interface';
import {
  createEmptyPaginatedResponse,
  createPaginatedResponse,
} from '../../common/utils/pagination.utils';
import { User } from '../users/schemas/user.schema';
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
    private readonly userModel: AppModel<User>,
    private readonly unitBusinessValidator: UnitBusinessValidator,
    private caslAuthorizationService: CaslAuthorizationService,
  ) {}

  async create(createUnitDto: CreateUnitDto, propertyId: string, currentUser: User) {
    // CASL: Check create permission
    const ability = this.caslAuthorizationService.createAbilityForUser(currentUser);

    if (!ability.can(Action.Create, Unit)) {
      throw new ForbiddenException('You do not have permission to create units');
    }

    // Ensure user has tenant context
    if (!currentUser.landlord_id) {
      throw new ForbiddenException('Cannot create unit: No tenant context');
    }

    // Extract landlord ID for tenant filtering
    const landlordId = currentUser.landlord_id && typeof currentUser.landlord_id === 'object' 
      ? (currentUser.landlord_id as any)._id 
      : currentUser.landlord_id;

    // mongo-tenant: Validate property exists within tenant context
    const property = await this.propertyModel
      .byTenant(landlordId)
      .findById(propertyId)
      .exec();

    if (!property) {
      throw new UnprocessableEntityException(`Property with ID ${propertyId} not found`);
    }

    await this.unitBusinessValidator.validateCreate({
      createDto: createUnitDto,
      propertyId,
    });

    // mongo-tenant: Create unit within tenant context
    const UnitWithTenant = this.unitModel.byTenant(landlordId);
    const newUnit = new UnitWithTenant({
      ...createUnitDto,
      property: propertyId,
    });

    const savedUnit = await newUnit.save();
    return savedUnit;
  }

  async findAllPaginated(
    queryDto: UnitQueryDto,
    currentUser: User,
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

    // STEP 1: CASL - Check if user can read units
    const ability = this.caslAuthorizationService.createAbilityForUser(currentUser);

    if (!ability.can(Action.Read, Unit)) {
      throw new ForbiddenException('You do not have permission to view units');
    }

    // STEP 2: mongo-tenant - Apply tenant isolation (mandatory for all users)
    const landlordId = currentUser.landlord_id && typeof currentUser.landlord_id === 'object' 
      ? (currentUser.landlord_id as any)._id 
      : currentUser.landlord_id;

    if (!landlordId) {
      // Users without landlord_id cannot access any units
      return createEmptyPaginatedResponse<Unit>(page, limit);
    }

    let baseQuery = this.unitModel.byTenant(landlordId).find();

    // STEP 3: Apply CASL field-level filtering
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

    const [units, total] = await Promise.all([
      dataQuery.exec(),
      countQuery.exec(),
    ]);

    return createPaginatedResponse<Unit>(units, total, page, limit);
  }

  async findOne(id: string, currentUser: User) {
    // CASL: Check read permission
    const ability = this.caslAuthorizationService.createAbilityForUser(currentUser);

    if (!ability.can(Action.Read, Unit)) {
      throw new ForbiddenException('You do not have permission to view units');
    }

    // mongo-tenant: Apply tenant filtering (mandatory)
    if (!currentUser.landlord_id) {
      throw new ForbiddenException('Access denied: No tenant context');
    }

    const landlordId = currentUser.landlord_id && typeof currentUser.landlord_id === 'object' 
      ? (currentUser.landlord_id as any)._id 
      : currentUser.landlord_id;

    const unit = await this.unitModel
      .byTenant(landlordId)
      .findById(id)
      .populate('property')
      .exec();

    if (!unit) {
      throw new NotFoundException(`Unit with ID ${id} not found`);
    }

    // CASL: Final permission check on the specific record
    if (!ability.can(Action.Read, unit)) {
      throw new ForbiddenException('You do not have permission to view this unit');
    }

    return unit;
  }

  async update(id: string, updateUnitDto: UpdateUnitDto, currentUser: User) {
    if (!updateUnitDto || Object.keys(updateUnitDto).length === 0) {
      throw new BadRequestException('Update data cannot be empty');
    }

    // CASL: Check update permission
    const ability = this.caslAuthorizationService.createAbilityForUser(currentUser);

    // Ensure user has tenant context
    if (!currentUser.landlord_id) {
      throw new ForbiddenException('Access denied: No tenant context');
    }

    const landlordId = currentUser.landlord_id && typeof currentUser.landlord_id === 'object' 
      ? (currentUser.landlord_id as any)._id 
      : currentUser.landlord_id;

    // mongo-tenant: Find within tenant context
    const existingUnit = await this.unitModel
      .byTenant(landlordId)
      .findById(id)
      .populate('property')
      .exec();

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
    });

    // Perform the update
    const updatedUnit = await this.unitModel
      .findByIdAndUpdate(id, updateUnitDto, { new: true })
      .exec();

    return updatedUnit;
  }

  async remove(id: string, currentUser: User) {
    // CASL: Check delete permission
    const ability = this.caslAuthorizationService.createAbilityForUser(currentUser);

    // Ensure user has tenant context
    if (!currentUser.landlord_id) {
      throw new ForbiddenException('Access denied: No tenant context');
    }

    const landlordId = currentUser.landlord_id && typeof currentUser.landlord_id === 'object' 
      ? (currentUser.landlord_id as any)._id 
      : currentUser.landlord_id;

    // mongo-tenant: Find within tenant context
    const unit = await this.unitModel
      .byTenant(landlordId)
      .findById(id)
      .populate('property')
      .exec();

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
