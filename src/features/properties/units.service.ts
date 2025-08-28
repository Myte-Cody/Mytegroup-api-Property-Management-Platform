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
import { OrganizationType } from '../../common/enums/organization.enum';
import { AppModel } from '../../common/interfaces/app-model.interface';
import {
  createEmptyPaginatedResponse,
  createPaginatedResponse,
} from '../../common/utils/pagination.utils';
import { Organization } from '../organizations/schemas/organization.schema';
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
    // Validate property exists
    const property = await this.propertyModel.findById(propertyId).exec();
    if (!property) {
      throw new UnprocessableEntityException(`Property with ID ${propertyId} not found`);
    }

    this.validateUnitCreateAccess(property, currentUser);

    await this.unitBusinessValidator.validateCreate({
      createDto: createUnitDto,
      propertyId,
    });

    const newUnit = new this.unitModel({
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

    // Apply role-based filtering logic
    this.applyRoleBasedFiltering(queryDto, currentUser);

    const ability = this.caslAuthorizationService.createAbilityForUser(
      currentUser as User & { organization: Organization; isAdmin?: boolean },
    );

    let baseQuery = (this.unitModel.find() as any).accessibleBy(ability, Action.Read);

    if (queryDto.landlordId) {
      const landlordPropertyIds = await this.getLandlordPropertyIds(queryDto.landlordId);
      if (landlordPropertyIds.length === 0) {
        return createEmptyPaginatedResponse<Unit>(page, limit);
      }
      baseQuery = baseQuery.where({ property: { $in: landlordPropertyIds } });
    }
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
    const unit = await this.unitModel.findById(id).populate('property').exec();
    if (!unit) {
      throw new NotFoundException(`Unit with ID ${id} not found`);
    }

    this.validateUnitAccess(unit, currentUser);

    return unit;
  }

  async update(id: string, updateUnitDto: UpdateUnitDto, currentUser: User) {
    if (!updateUnitDto || Object.keys(updateUnitDto).length === 0) {
      throw new BadRequestException('Update data cannot be empty');
    }

    const existingUnit = await this.unitModel.findById(id).populate('property').exec();
    if (!existingUnit) {
      throw new NotFoundException(`Unit with ID ${id} not found`);
    }

    this.validateUnitUpdateAccess(existingUnit, currentUser, updateUnitDto);

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
    const unit = await this.unitModel.findById(id).populate('property').exec();
    if (!unit) {
      throw new NotFoundException(`Unit with ID ${id} not found`);
    }

    this.validateUnitDeleteAccess(unit, currentUser);

    await this.unitBusinessValidator.validateDelete({
      unit,
    });
    await this.unitModel.deleteById(id);
    return { message: 'Unit deleted successfully' };
  }

  /**
   * Validate if the current user has access to create a unit in the specified property
   */
  private validateUnitCreateAccess(property: Property, currentUser: User): void {
    const ability = this.caslAuthorizationService.createAbilityForUser(
      currentUser as User & { organization: Organization; isAdmin?: boolean },
    );

    if (!ability.can(Action.Create, Unit)) {
      throw new ForbiddenException(`Forbidden resources`);
    }

    // Apply additional role-based access control for creation
    if (currentUser.organization) {
      switch ((currentUser.organization as unknown as Organization).type) {
        case OrganizationType.LANDLORD:
          // Landlords can only create units in properties they own
          if (property.owner?.toString() !== (currentUser.organization as unknown as Organization)._id.toString()) {
            throw new ForbiddenException(`You can only create units in properties you own`);
          }
          break;

        case OrganizationType.PROPERTY_MANAGER:
          // TODO: Implement property manager access validation
          break;

        default:
          break;
      }
    }
  }

  /**
   * Validate if the current user has access to view the specific unit
   */
  private validateUnitAccess(unit: Unit & { property: any }, currentUser: User): void {
    const ability = this.caslAuthorizationService.createAbilityForUser(
      currentUser as User & { organization: Organization; isAdmin?: boolean },
    );

    if (!ability.can(Action.Read, unit)) {
      throw new ForbiddenException(`Forbidden resources`);
    }

    if (currentUser.organization) {
      switch ((currentUser.organization as unknown as Organization).type) {
        case OrganizationType.LANDLORD:
          if (unit.property?.owner?.toString() !== (currentUser.organization as unknown as Organization)._id.toString()) {
            throw new ForbiddenException(`Forbidden resources`);
          }
          break;

        case OrganizationType.PROPERTY_MANAGER:
          // TODO: Implement property manager access validation
          // Should check if they manage the property this unit belongs to
          break;

        case OrganizationType.TENANT:
          // TODO: Implement tenant access validation
          // Should check if they have tenancy/access rights to this unit
          break;

        case OrganizationType.CONTRACTOR:
          // TODO: Implement contractor access validation
          // Should check if they have active work orders for this unit
          break;

        default:
          break;
      }
    }
  }

  /**
   * Validate if the current user has access to update the specific unit and filter allowed fields
   */
  private validateUnitUpdateAccess(
    unit: Unit & { property: any },
    currentUser: User,
    updateDto: UpdateUnitDto,
  ): void {
    const ability = this.caslAuthorizationService.createAbilityForUser(
      currentUser as User & { organization: Organization; isAdmin?: boolean },
    );

    if (!ability.can(Action.Update, unit)) {
      throw new ForbiddenException(`Forbidden resources`);
    }

    if (currentUser.organization) {
      switch ((currentUser.organization as unknown as Organization).type) {
        case OrganizationType.LANDLORD:
          if (unit.property?.owner?.toString() !== (currentUser.organization as unknown as Organization)._id.toString()) {
            throw new ForbiddenException(`Forbidden resources`);
          }
          break;

        case OrganizationType.PROPERTY_MANAGER:
          // TODO: Implement property manager access validation
          // Should check if they manage the property this unit belongs to
          break;

        default:
          // No field restrictions for unknown organization types
          break;
      }
    }
  }

  /**
   * Validate that only allowed fields are being updated for the current user's role
   */
  private validateAllowedFields(updateDto: UpdateUnitDto, allowedFields: string[]): void {
    const updateFields = Object.keys(updateDto);
    const disallowedFields = updateFields.filter((field) => !allowedFields.includes(field));

    if (disallowedFields.length > 0) {
      throw new ForbiddenException(
        `You are not allowed to update the following fields: ${disallowedFields.join(', ')}`,
      );
    }
  }

  /**
   * Validate if the current user has access to delete the specific unit
   */
  private validateUnitDeleteAccess(unit: Unit & { property: any }, currentUser: User): void {
    const ability = this.caslAuthorizationService.createAbilityForUser(
      currentUser as User & { organization: Organization; isAdmin?: boolean },
    );

    if (!ability.can(Action.Delete, unit)) {
      throw new ForbiddenException(`Forbidden resources`);
    }

    if (currentUser.organization) {
      switch ((currentUser.organization as unknown as Organization).type) {
        case OrganizationType.LANDLORD:
          if (unit.property?.owner?.toString() !== (currentUser.organization as unknown as Organization)._id.toString()) {
            throw new ForbiddenException(`Forbidden resources`);
          }
          break;

        case OrganizationType.PROPERTY_MANAGER:
          // TODO: Implement property manager access validation
          throw new ForbiddenException(`Property managers are not allowed to delete units`);

        default:
          break;
      }
    }
  }

  /**
   * Apply role-based filtering to the query DTO based on the current user's organization type
   */
  private applyRoleBasedFiltering(queryDto: UnitQueryDto, currentUser: User): void {
    if (!currentUser.organization) {
      return;
    }

    switch ((currentUser.organization as unknown as Organization).type) {
      case OrganizationType.LANDLORD:
        // Landlords can only see units in their own properties
        queryDto.landlordId = (currentUser.organization as unknown as Organization)._id.toString();
        break;

      case OrganizationType.PROPERTY_MANAGER:
        // TODO: Implement property manager filtering
        // Should filter by properties they manage (requires management relationship data)
        break;

      case OrganizationType.TENANT:
        // TODO: Implement tenant filtering
        // Should filter by units they rent or have access to (requires tenancy data)
        break;

      case OrganizationType.CONTRACTOR:
        // TODO: Implement contractor filtering
        // Should filter by units they have work orders for (requires work order data)
        break;

      default:
        break;
    }
  }

  async getLandlordPropertyIds(landlordId: string): Promise<string[]> {
    const landlordProperties = await this.propertyModel
      .find({ owner: landlordId })
      .select('_id')
      .exec();
    return landlordProperties.map((prop) => prop._id.toString());
  }
}
