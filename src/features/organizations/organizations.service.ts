import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Action } from '../../common/casl/casl-ability.factory';
import { CaslAuthorizationService } from '../../common/casl/services/casl-authorization.service';
import { AppModel } from '../../common/interfaces/app-model.interface';
import { createPaginatedResponse } from '../../common/utils/pagination.utils';
import { Property } from '../properties/schemas/property.schema';
import { User } from '../users/schemas/user.schema';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { OrganizationQueryDto } from './dto/organization-query.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { Organization } from './schemas/organization.schema';

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectModel(Organization.name)
    private readonly organizationModel: AppModel<Organization>,
    @InjectModel(User.name)
    private readonly userModel: AppModel<User>,
    @InjectModel(Property.name)
    private readonly propertyModel: AppModel<Property>,
    private caslAuthorizationService: CaslAuthorizationService,
  ) {}

  async create(createOrganizationDto: CreateOrganizationDto) {
    const existingOrganization = await this.organizationModel
      .findOne({
        name: createOrganizationDto.name,
      })
      .exec();

    if (existingOrganization) {
      throw new UnprocessableEntityException(
        `Organization with name '${createOrganizationDto.name}' already exists`,
      );
    }

    const newOrganization = new this.organizationModel(createOrganizationDto);
    return await newOrganization.save();
  }

  async findAllPaginated(queryDto: OrganizationQueryDto, currentUser: User) {
    const { page, limit, sortBy, sortOrder, search, type } = queryDto;

    const populatedUser = await this.userModel
      .findById(currentUser._id)
      .populate('organization')
      .exec();

    if (!populatedUser) {
      return createPaginatedResponse<Organization>([], 0, page, limit);
    }

    const ability = this.caslAuthorizationService.createAbilityForUser(
      populatedUser as unknown as User & { organization: Organization; isAdmin?: boolean },
    );

    let baseQuery = (this.organizationModel.find() as any).accessibleBy(ability, Action.Read);

    if (search) {
      baseQuery = baseQuery.where({ name: { $regex: search, $options: 'i' } });
    }

    if (type) {
      baseQuery = baseQuery.where({ type });
    }

    const skip = (page - 1) * limit;

    // Create separate queries for data and count to avoid interference
    const dataQuery = baseQuery
      .clone()
      .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
      .skip(skip)
      .limit(limit);

    const countQuery = baseQuery.clone().countDocuments();

    const [organizations, totalCount] = await Promise.all([
      dataQuery.exec(),
      countQuery.exec(),
    ]);

    return createPaginatedResponse<Organization>(organizations, totalCount, page, limit);
  }

  async findOne(id: string) {
    return await this.organizationModel.findById(id).exec();
  }

  async update(id: string, updateOrganizationDto: UpdateOrganizationDto) {
    if (updateOrganizationDto.name) {
      const existingOrganization = await this.organizationModel
        .findOne({
          name: updateOrganizationDto.name,
          _id: { $ne: id },
        })
        .exec();

      if (existingOrganization) {
        throw new UnprocessableEntityException(
          `Organization with name '${updateOrganizationDto.name}' already exists`,
        );
      }
    }

    const organization = await this.organizationModel.findById(id).exec();
    if (!organization) {
      throw new NotFoundException(`Organization with ID ${id} not found`);
    }

    const updatedOrganization = await this.organizationModel
      .findByIdAndUpdate(id, updateOrganizationDto, { new: true })
      .exec();

    return updatedOrganization;
  }

  async remove(id: string) {
    const organization = await this.organizationModel.findById(id).exec();
    if (!organization) {
      throw new NotFoundException(`Organization with ID ${id} not found`);
    }

    // Check if organization has users
    const usersInOrganization = await this.userModel.find({ organization: id }).exec();

    if (usersInOrganization.length > 0) {
      throw new UnprocessableEntityException(
        `Cannot delete organization. It has ${usersInOrganization.length} user(s). Please remove or reassign all users first.`,
      );
    }

    // Check if organization has properties
    const propertiesOwnedByOrganization = await this.propertyModel.find({ owner: id }).exec();

    if (propertiesOwnedByOrganization.length > 0) {
      throw new UnprocessableEntityException(
        `Cannot delete organization. It owns ${propertiesOwnedByOrganization.length} property(ies). Please transfer or delete all properties first.`,
      );
    }

    await this.organizationModel.deleteById(id);

    return null;
  }
}
