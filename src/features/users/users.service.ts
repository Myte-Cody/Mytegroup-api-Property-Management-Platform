import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { ClientSession } from 'mongoose';
import { Action } from '../../common/casl/casl-ability.factory';
import { CaslAuthorizationService } from '../../common/casl/services/casl-authorization.service';
import { AppModel } from '../../common/interfaces/app-model.interface';
import { SessionService } from '../../common/services/session.service';
import { createPaginatedResponse } from '../../common/utils/pagination.utils';
import { WelcomeEmailService } from '../email/services/welcome-email.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { User, UserDocument } from './schemas/user.schema';
@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: AppModel<UserDocument>,
    private caslAuthorizationService: CaslAuthorizationService,
    private welcomeEmailService: WelcomeEmailService,
    private readonly sessionService: SessionService,
  ) {}

  async create(createUserDto: CreateUserDto, session?: ClientSession) {
    const { username, firstName, lastName, email, phone, password, user_type, party_id, isPrimary } = createUserDto;

    // Check username uniqueness within the same landlord
    const existingUsername = await this.userModel
      .findOne({
        username,
      })
      .exec();
    if (existingUsername) {
      throw new UnprocessableEntityException(
        `Username '${username}' is already taken within this organization`,
      );
    }

    // Check email uniqueness within the same landlord
    const existingEmail = await this.userModel
      .findOne({
        email,
      })
      .exec();
    if (existingEmail) {
      throw new UnprocessableEntityException(
        `Email '${email}' is already registered within this organization`,
      );
    }

    // Check if this is the first user for this party
    let shouldBePrimary = isPrimary || false;
    if (party_id) {
      const existingUsersCount = await this.userModel
        .countDocuments({
          party_id,
          user_type,
          deleted: { $ne: true }, // Exclude soft-deleted users
        })
        .exec();
      
      // If this is the first user for this party, make them primary
      if (existingUsersCount === 0) {
        shouldBePrimary = true;
      }
    }

    await this.validatePrimaryUserConstraint(
        shouldBePrimary,
        party_id,
        user_type,
        undefined,
        session,
    );

    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new this.userModel({
      username,
      firstName,
      lastName,
      email,
      phone,
      password: hashedPassword,
      user_type,
      party_id,
      isPrimary: shouldBePrimary,
    });

    // Save the user first to ensure it exists in the database
    const savedUser = session ? await newUser.save({ session }) : await newUser.save();

    // Send welcome email using the WelcomeEmailService
    try {
      await this.welcomeEmailService.sendWelcomeEmail(
        email,
        username,
        undefined, // dashboardUrl can be added later if needed
        { queue: true }, // Use queue for background processing
      );
    } catch (error) {
      // Log error but don't fail the user creation if email sending fails
      console.error('Failed to send welcome email:', error);
    }

    return savedUser;
  }

  async createFromInvitation(createUserDto: CreateUserDto, session?: ClientSession) {
    const { username, firstName, lastName, email, phone, password, user_type, party_id, isPrimary } = createUserDto;

    // Check username uniqueness within the same landlord
    const existingUsername = await this.userModel
      .findOne({
        username,
      })
      .exec();
    if (existingUsername) {
      throw new UnprocessableEntityException(
        `Username '${username}' is already taken within this organization`,
      );
    }

    // Check email uniqueness within the same landlord
    const existingEmail = await this.userModel
      .findOne({
        email,
      })
      .exec();
    if (existingEmail) {
      throw new UnprocessableEntityException(
        `Email '${email}' is already registered within this organization`,
      );
    }

    // Check if this is the first user for this party
    let shouldBePrimary = isPrimary || false;
    if (party_id) {
      const existingUsersCount = await this.userModel
        .countDocuments({
          party_id,
          user_type,
          deleted: { $ne: true }, // Exclude soft-deleted users
        })
        .exec();
      
      // If this is the first user for this party, make them primary
      if (existingUsersCount === 0) {
        shouldBePrimary = true;
      }
    }

    await this.validatePrimaryUserConstraint(
        shouldBePrimary,
        party_id,
        user_type,
        undefined,
        session,
      );

    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new this.userModel({
      username,
      firstName,
      lastName,
      email,
      phone,
      password: hashedPassword,
      user_type,
      party_id,
      isPrimary: isPrimary || false,
    });

    // Save the user first to ensure it exists in the database
    const savedUser = session ? await newUser.save({ session }) : await newUser.save();

    // Send welcome email using the WelcomeEmailService
    try {
      await this.welcomeEmailService.sendWelcomeEmail(
        email,
        username,
        undefined, // dashboardUrl can be added later if needed
        { queue: true }, // Use queue for background processing
      );
    } catch (error) {
      // Log error but don't fail the user creation if email sending fails
      console.error('Failed to send welcome email:', error);
    }

    return savedUser;
  }

  async findAllPaginated(queryDto: UserQueryDto, currentUser: User) {
    const { page, limit, sortBy, sortOrder, search, user_type, party_id, isPrimary } = queryDto;

    const populatedUser = await this.userModel.findById(currentUser._id).exec();

    if (!populatedUser) {
      return createPaginatedResponse<User>([], 0, page, limit);
    }

    // Create ability for the current user with populated data
    const ability = this.caslAuthorizationService.createAbilityForUser(populatedUser);

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
    
    // Filter by party_id if provided
    if (party_id) {
      baseQuery = baseQuery.where({ party_id });
    }
    
    // Filter by isPrimary if provided
    if (isPrimary !== undefined) {
      baseQuery = baseQuery.where({ isPrimary });
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
    return await this.sessionService.withSession(async (session: ClientSession) => {
      const user = await this.userModel.findById(id, null, { session }).exec();
      if (!user) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }

      if (updateUserDto.username && updateUserDto.username !== user.username) {
        const existingUsername = await this.userModel
          .findOne(
            {
              username: updateUserDto.username,
              _id: { $ne: id },
            },
            null,
            { session },
          )
          .exec();

        if (existingUsername) {
          throw new UnprocessableEntityException(
            `Username '${updateUserDto.username}' is already taken within this organization`,
          );
        }
      }

      if (updateUserDto.email && updateUserDto.email !== user.email) {
        const existingEmail = await this.userModel
          .findOne(
            {
              email: updateUserDto.email,
              _id: { $ne: id },
            },
            null,
            { session },
          )
          .exec();

        if (existingEmail) {
          throw new UnprocessableEntityException(
            `Email '${updateUserDto.email}' is already registered within this organization`,
          );
        }
      }

      // Handle primary user logic
      if (updateUserDto.isPrimary !== undefined && user.party_id) {
        if (updateUserDto.isPrimary === true) {
          // If setting this user as primary, remove primary status from other users
          await this.userModel
            .updateMany(
              {
                party_id: user.party_id,
                user_type: user.user_type,
                _id: { $ne: id },
                isPrimary: true,
              },
              { $set: { isPrimary: false } },
              { session },
            )
            .exec();
        } else {
          // If removing primary status, validate that there's at least one primary user
          await this.validatePrimaryUserConstraint(
            updateUserDto.isPrimary,
            user.party_id.toString(),
            user.user_type,
            id,
            session,
          );
        }
      }

      if (updateUserDto.password) {
        const salt = await bcrypt.genSalt();

        updateUserDto.password = await bcrypt.hash(updateUserDto.password, salt);
      }

      return await this.userModel
        .findByIdAndUpdate(id, updateUserDto, { new: true, session })
        .exec();
    });
  }

  async remove(id: string) {
    const user = await this.userModel.findById(id).exec();
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    await this.userModel.deleteById(id);

    return null;
  }

  private async validatePrimaryUserConstraint(
    isPrimary: boolean,
    party_id: string,
    user_type: string,
    excludeUserId?: string,
    session?: ClientSession,
  ) {
    if (!isPrimary || !party_id) {
      return; // No validation needed if not setting as primary or no party_id
    }

    // Check if there's already a primary user for this party
    const query: any = {
      party_id,
      user_type,
      isPrimary: true,
    };

    // Exclude current user when updating
    if (excludeUserId) {
      query._id = { $ne: excludeUserId };
    }

    const existingPrimaryUser = await this.userModel
      .findOne(query, null, { session })
      .exec();

    if (existingPrimaryUser) {
      throw new UnprocessableEntityException(
        `A primary user already exists for this ${user_type.toLowerCase()}. Only one primary user is allowed per party.`,
      );
    }
  }
}
