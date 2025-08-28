import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Action } from '../../common/casl/casl-ability.factory';
import { CaslAuthorizationService } from '../../common/casl/services/casl-authorization.service';
import { AppModel } from '../../common/interfaces/app-model.interface';
import { createPaginatedResponse } from '../../common/utils/pagination.utils';
import { Organization } from '../organizations/schemas/organization.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { User } from './schemas/user.schema';
@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: AppModel<User>,
    @InjectModel(Organization.name)
    private organizationModel: AppModel<Organization>,
    private caslAuthorizationService: CaslAuthorizationService,
  ) {}

  async create(createUserDto: CreateUserDto) {
    const { username, email, password, organization } = createUserDto;

    const existingUsername = await this.userModel.findOne({ username }).exec();
    if (existingUsername) {
      throw new UnprocessableEntityException(`Username '${username}' is already taken`);
    }

    const existingEmail = await this.userModel.findOne({ email }).exec();
    if (existingEmail) {
      throw new UnprocessableEntityException(`Email '${email}' is already registered`);
    }

    if (organization) {
      const existingOrganization = await this.organizationModel.findById(organization).exec();
      if (!existingOrganization) {
        throw new UnprocessableEntityException(
          `Organization with ID ${organization} does not exist`,
        );
      }
    }

    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new this.userModel({
      ...createUserDto,
      password: hashedPassword,
    });

    return await newUser.save();
  }

  async findAllPaginated(queryDto: UserQueryDto, currentUser: User) {
    const { page, limit, sortBy, sortOrder, search, organizationId } = queryDto;

    const populatedUser = await this.userModel
      .findById(currentUser._id)
      .populate('organization')
      .exec();

    if (!populatedUser) {
      return createPaginatedResponse<User>([], 0, page, limit);
    }

    // Create ability for the current user with populated data
    const ability = this.caslAuthorizationService.createAbilityForUser(
      populatedUser as unknown as User & { organization: Organization; isAdmin?: boolean },
    );

    let baseQuery = (this.userModel.find() as any).accessibleBy(ability, Action.Read);

    // Apply search filtering
    if (search) {
      baseQuery = baseQuery.where({
        $or: [
          { username: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
        ],
      });
    }

    if (organizationId) {
      baseQuery = baseQuery.where({ organization: organizationId });
    }

    const skip = (page - 1) * limit;

    // Create separate queries for data and count to avoid interference
    const dataQuery = baseQuery
      .clone()
      .populate('organization')
      .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
      .skip(skip)
      .limit(limit);

    const countQuery = baseQuery.clone().countDocuments();

    const [users, totalCount] = await Promise.all([
      dataQuery.exec(),
      countQuery.exec(),
    ]);

    return createPaginatedResponse<User>(users, totalCount, page, limit);
  }

  async findOne(id: string) {
    const user = await this.userModel.findById(id).exec();
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto, currentUser?: User) {
    const user = await this.userModel.findById(id).populate('organization').exec();
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    if (updateUserDto.username && updateUserDto.username !== user.username) {
      const existingUsername = await this.userModel
        .findOne({
          username: updateUserDto.username,
          _id: { $ne: id },
        })
        .exec();

      if (existingUsername) {
        throw new UnprocessableEntityException(
          `Username '${updateUserDto.username}' is already taken`,
        );
      }
    }

    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingEmail = await this.userModel
        .findOne({
          email: updateUserDto.email,
          _id: { $ne: id },
        })
        .exec();

      if (existingEmail) {
        throw new UnprocessableEntityException(
          `Email '${updateUserDto.email}' is already registered`,
        );
      }
    }

    if (updateUserDto.password) {
      const salt = await bcrypt.genSalt();

      updateUserDto.password = await bcrypt.hash(updateUserDto.password, salt);
    }

    const updatedUser = await this.userModel
      .findByIdAndUpdate(id, updateUserDto, { new: true })
      .exec();

    return updatedUser;
  }

  async remove(id: string) {
    const user = await this.userModel.findById(id).exec();
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    await this.userModel.deleteById(id);

    return null;
  }
}
