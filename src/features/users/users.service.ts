import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as argon2 from 'argon2';
import { ClientSession } from 'mongoose';
import { Action } from '../../common/casl/casl-ability.factory';
import { CaslAuthorizationService } from '../../common/casl/services/casl-authorization.service';
import { UserRole } from '../../common/enums/user-role.enum';
import { UserType } from '../../common/enums/user-type.enum';
import { AppModel } from '../../common/interfaces/app-model.interface';
import { SessionService } from '../../common/services/session.service';
import { createPaginatedResponse } from '../../common/utils/pagination.utils';
import { WelcomeEmailService } from '../email/services/welcome-email.service';
import { MediaService } from '../media/services/media.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdatePrivacySettingsDto } from './dto/update-privacy-settings.dto';
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
    private readonly mediaService: MediaService,
  ) {}

  async create(createUserDto: CreateUserDto, session?: ClientSession | null, currentUser?: User) {
    const {
      username,
      firstName,
      lastName,
      email,
      phone,
      password,
      user_type,
      organization_id,
      isPrimary,
      role,
    } = createUserDto;

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

    // Check if this is the first user for this organization
    let shouldBePrimary = isPrimary || false;
    if (organization_id) {
      const existingUsersCount = await this.userModel
        .countDocuments({
          organization_id,
          user_type,
          deleted: { $ne: true }, // Exclude soft-deleted users
        })
        .exec();

      // If this is the first user for this organization, make them primary
      if (existingUsersCount === 0) {
        shouldBePrimary = true;
      }
    }

    await this.validatePrimaryUserConstraint(
      shouldBePrimary,
      organization_id,
      user_type,
      undefined,
      session,
    );

    const hashedPassword = await argon2.hash(password, { type: argon2.argon2id });
    const effectiveRequestedRole =
      currentUser && currentUser.role === UserRole.SUPER_ADMIN ? role : undefined;
    const resolvedRole = this.resolveRole(
      user_type as UserType,
      shouldBePrimary,
      effectiveRequestedRole,
    );

    const newUser = new this.userModel({
      username,
      firstName,
      lastName,
      email,
      phone,
      password: hashedPassword,
      user_type,
      organization_id: organization_id ?? currentUser?.organization_id,
      isPrimary: shouldBePrimary,
      role: resolvedRole,
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
    const {
      username,
      firstName,
      lastName,
      email,
      phone,
      password,
      user_type,
      organization_id,
      isPrimary,
      role,
    } = createUserDto;

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

    // Check if this is the first user for this organization
    let shouldBePrimary = isPrimary || false;
    if (organization_id) {
      const existingUsersCount = await this.userModel
        .countDocuments({
          organization_id,
          user_type,
          deleted: { $ne: true }, // Exclude soft-deleted users
        })
        .exec();

      // If this is the first user for this organization, make them primary
      if (existingUsersCount === 0) {
        shouldBePrimary = true;
      }
    }

    await this.validatePrimaryUserConstraint(
      shouldBePrimary,
      organization_id,
      user_type,
      undefined,
      session,
    );

    const hashedPassword = await argon2.hash(password, { type: argon2.argon2id });
    const resolvedRole = this.resolveRole(user_type as UserType, shouldBePrimary, role);

    const newUser = new this.userModel({
      username,
      firstName,
      lastName,
      email,
      phone,
      password: hashedPassword,
      user_type,
      organization_id,
      isPrimary: shouldBePrimary,
      role: resolvedRole,
      // Invitation flows already proved ownership of the email, so mark verified to avoid extra steps.
      emailVerifiedAt: new Date(),
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
    const { page, limit, sortBy, sortOrder, search, user_type, organization_id, isPrimary } =
      queryDto;
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

    // Filter by organization_id if provided
    if (organization_id) {
      baseQuery = baseQuery.where({ organization_id });
    } else {
      baseQuery = baseQuery.where({ organization_id: populatedUser.organization_id });
    }

    if (queryDto.role) {
      baseQuery = baseQuery.where({ role: queryDto.role });
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
    return await this.sessionService.withSession(async (session: ClientSession | null) => {
      const user = await this.userModel.findById(id, null, { session }).exec();
      if (!user) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }

      const currentUserRole = currentUser?.role as UserRole | undefined;

      if (updateUserDto.role !== undefined && currentUserRole !== UserRole.SUPER_ADMIN) {
        throw new ForbiddenException('You are not allowed to change user roles');
      }

      if (updateUserDto.isPrimary !== undefined && currentUserRole === UserRole.LANDLORD_STAFF) {
        throw new ForbiddenException('Landlord staff cannot change primary user status');
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
      if (updateUserDto.isPrimary !== undefined && user.organization_id) {
        if (updateUserDto.isPrimary === true) {
          // If setting this user as primary, remove primary status from other users
          await this.userModel
            .updateMany(
              {
                organization_id: user.organization_id,
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
            user.organization_id.toString(),
            user.user_type,
            id,
            session,
          );
        }
      }

      const evaluatedIsPrimary =
        updateUserDto.isPrimary !== undefined ? updateUserDto.isPrimary : user.isPrimary;

      if (!updateUserDto.role) {
        const resolvedRole = this.resolveRole(
          user.user_type as UserType,
          evaluatedIsPrimary ?? false,
          undefined,
        );
        if (resolvedRole) {
          updateUserDto.role = resolvedRole;
        }
      }

      if (updateUserDto.password) {
        updateUserDto.password = await argon2.hash(updateUserDto.password, {
          type: argon2.argon2id,
        });
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
    organization_id: string,
    user_type: string,
    excludeUserId?: string,
    session?: ClientSession,
  ) {
    if (!isPrimary || !organization_id) {
      return; // No validation needed if not setting as primary or no organization_id
    }

    // Check if there's already a primary user for this organization
    const query: any = {
      organization_id,
      user_type,
      isPrimary: true,
    };

    // Exclude current user when updating
    if (excludeUserId) {
      query._id = { $ne: excludeUserId };
    }

    const existingPrimaryUser = await this.userModel.findOne(query, null, { session }).exec();

    if (existingPrimaryUser) {
      throw new UnprocessableEntityException(
        `A primary user already exists for this ${user_type.toLowerCase()}. Only one primary user is allowed per organization.`,
      );
    }
  }

  async uploadProfilePicture(userId: string, file: any, currentUser: User): Promise<User> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const ability = this.caslAuthorizationService.createAbilityForUser(currentUser);
    if (!ability.can(Action.Update, user)) {
      throw new ForbiddenException('You do not have permission to update this user');
    }

    const media = await this.mediaService.upload(
      file,
      user,
      currentUser,
      'profile-pictures',
      undefined,
      'User',
    );

    const mediaUrl = await this.mediaService.getMediaUrl(media);
    user.profilePicture = mediaUrl;
    await user.save();

    return user;
  }

  async getProfilePicture(userId: string): Promise<string | null> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }
    return user.profilePicture || null;
  }

  async updatePrivacySettings(
    userId: string,
    updatePrivacySettingsDto: UpdatePrivacySettingsDto,
    currentUser: User,
  ): Promise<User> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Check if user has permission to update privacy settings
    const ability = this.caslAuthorizationService.createAbilityForUser(currentUser);
    if (!ability.can(Action.Update, user)) {
      throw new ForbiddenException('You do not have permission to update this user');
    }

    // Update only the privacy settings fields
    if (updatePrivacySettingsDto.allowNeighborsToMessage !== undefined) {
      user.allowNeighborsToMessage = updatePrivacySettingsDto.allowNeighborsToMessage;
    }
    if (updatePrivacySettingsDto.allowGroupChatInvites !== undefined) {
      user.allowGroupChatInvites = updatePrivacySettingsDto.allowGroupChatInvites;
    }

    await user.save();
    return user;
  }

  async getPrivacySettings(userId: string): Promise<{
    allowNeighborsToMessage: boolean;
    allowGroupChatInvites: boolean;
  }> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    return {
      allowNeighborsToMessage: user.allowNeighborsToMessage,
      allowGroupChatInvites: user.allowGroupChatInvites,
    };
  }

  private resolveRole(
    userType: UserType,
    isPrimary: boolean,
    requestedRole?: UserRole,
  ): UserRole | undefined {
    if (requestedRole) {
      return requestedRole;
    }

    switch (userType) {
      case UserType.LANDLORD:
        return isPrimary ? UserRole.LANDLORD_ADMIN : UserRole.LANDLORD_STAFF;
      case UserType.TENANT:
        return UserRole.TENANT;
      case UserType.CONTRACTOR:
        return UserRole.CONTRACTOR;
      case UserType.ADMIN:
        return UserRole.SUPER_ADMIN;
      default:
        return undefined;
    }
  }
}
