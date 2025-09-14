import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Action } from '../../common/casl/casl-ability.factory';
import { CaslAuthorizationService } from '../../common/casl/services/casl-authorization.service';
import { AppModel } from '../../common/interfaces/app-model.interface';
import { createPaginatedResponse } from '../../common/utils/pagination.utils';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { User, UserDocument } from './schemas/user.schema';
@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: AppModel<UserDocument>,
    private caslAuthorizationService: CaslAuthorizationService,
  ) {}

  async create(createUserDto: CreateUserDto, currentUser: UserDocument) {
    const { username, email, password, user_type, party_id } = createUserDto;

    // Get tenantId from current user
    const landlordId =
      currentUser.tenantId && typeof currentUser.tenantId === 'object'
        ? (currentUser.tenantId as any)._id
        : currentUser.tenantId;

    if (!landlordId) {
      throw new UnprocessableEntityException('Current user must have a tenantId to create users');
    }

    // Check username uniqueness within the same landlord
    const existingUsername = await this.userModel.findOne({
      username,
      tenantId: landlordId,
    }).exec();
    if (existingUsername) {
      throw new UnprocessableEntityException(
        `Username '${username}' is already taken within this organization`,
      );
    }

    // Check email uniqueness within the same landlord
    const existingEmail = await this.userModel.findOne({
      email,
      tenantId: landlordId,
    }).exec();
    if (existingEmail) {
      throw new UnprocessableEntityException(
        `Email '${email}' is already registered within this organization`,
      );
    }

    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new this.userModel({
      username,
      email,
      password: hashedPassword,
      user_type,
      party_id, // Optional, can be set during creation
      tenantId: landlordId, // Set from current user
    });

    return await newUser.save();
  }

  async findAllPaginated(queryDto: UserQueryDto, currentUser: User) {
    const { page, limit, sortBy, sortOrder, search, user_type } = queryDto;

    const populatedUser = await this.userModel.findById(currentUser._id).exec();

    if (!populatedUser) {
      return createPaginatedResponse<User>([], 0, page, limit);
    }

    // Create ability for the current user with populated data
    const ability = this.caslAuthorizationService.createAbilityForUser(
      populatedUser as unknown as User & { isAdmin?: boolean },
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

    if (user_type) {
      baseQuery = baseQuery.where({ user_type });
    }

    const skip = (page - 1) * limit;

    // Create separate queries for data and count to avoid interference
    const dataQuery = baseQuery
      .clone()
      .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
      .skip(skip)
      .limit(limit);

    const countQuery = baseQuery.clone().countDocuments();

    const [users, totalCount] = await Promise.all([dataQuery.exec(), countQuery.exec()]);

    return createPaginatedResponse<User>(users, totalCount, page, limit);
  }

  async findOne(id: string) {
    const user = await this.userModel.findById(id).exec();
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async findByEmail(email: string) {
    return await this.userModel.findOne({ email }).exec();
  }

  async update(id: string, updateUserDto: UpdateUserDto, currentUser?: User) {
    const user = await this.userModel.findById(id).exec();
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    if (updateUserDto.username && updateUserDto.username !== user.username) {
      const existingUsername = await this.userModel
        .findOne({
          username: updateUserDto.username,
          tenantId: user.tenantId,
          _id: { $ne: id },
        })
        .exec();

      if (existingUsername) {
        throw new UnprocessableEntityException(
          `Username '${updateUserDto.username}' is already taken within this organization`,
        );
      }
    }

    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingEmail = await this.userModel
        .findOne({
          email: updateUserDto.email,
          tenantId: user.tenantId,
          _id: { $ne: id },
        })
        .exec();

      if (existingEmail) {
        throw new UnprocessableEntityException(
          `Email '${updateUserDto.email}' is already registered within this organization`,
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
