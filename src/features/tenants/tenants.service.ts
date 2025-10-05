import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { ClientSession } from 'mongoose';
import { Action } from '../../common/casl/casl-ability.factory';
import { CaslAuthorizationService } from '../../common/casl/services/casl-authorization.service';
import { LeaseStatus, PaymentStatus } from '../../common/enums/lease.enum';
import { UserType } from '../../common/enums/user-type.enum';
import { AppModel } from '../../common/interfaces/app-model.interface';
import { SessionService } from '../../common/services/session.service';
import { createPaginatedResponse, PaginatedResponse } from '../../common/utils/pagination.utils';
import { Lease } from '../leases/schemas/lease.schema';
import { Transaction } from '../leases/schemas/transaction.schema';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { UpdateUserDto } from '../users/dto/update-user.dto';
import { UserQueryDto } from '../users/dto/user-query.dto';
import { User, UserDocument } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';
import { CreateTenantUserDto } from './dto/create-tenant-user.dto';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { PaginatedTenantsResponse, TenantQueryDto } from './dto/tenant-query.dto';
import { TenantStatsDto } from './dto/tenant-stats.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { Tenant } from './schema/tenant.schema';

@Injectable()
export class TenantsService {
  constructor(
    @InjectModel(Tenant.name)
    private readonly tenantModel: AppModel<Tenant>,
    @InjectModel(User.name)
    private readonly userModel: AppModel<User>,
    @InjectModel(Lease.name)
    private readonly leaseModel: AppModel<Lease>,
    @InjectModel(Transaction.name)
    private readonly transactionModel: AppModel<Transaction>,
    private caslAuthorizationService: CaslAuthorizationService,
    private usersService: UsersService,
    private readonly sessionService: SessionService,
  ) {}

  async findAllPaginated(
    queryDto: TenantQueryDto,
    currentUser: UserDocument,
  ): Promise<PaginatedTenantsResponse<Tenant>> {
    // Tenant users should not be able to list other tenants - only access their own profile
    if (currentUser.user_type === 'Tenant') {
      throw new ForbiddenException(
        'Tenant users cannot access the tenant list. Use /tenants/me to access your own profile.',
      );
    }

    const {
      page = 1,
      limit = 10,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      includeStats = false,
      hasActiveLeases,
    } = queryDto;

    const ability = this.caslAuthorizationService.createAbilityForUser(currentUser);

    if (!ability.can(Action.Read, Tenant)) {
      throw new ForbiddenException('You do not have permission to view tenants');
    }

    // If includeStats is true, use aggregation pipeline
    if (includeStats) {
      return this.findAllPaginatedWithStats(queryDto, currentUser, ability);
    }

    let baseQuery = this.tenantModel.find();

    baseQuery = (baseQuery as any).accessibleBy(ability, Action.Read);

    // Add search functionality
    if (search) {
      baseQuery = baseQuery.where({
        name: { $regex: search, $options: 'i' },
      });
    }

    // Build sort object
    const sortObj: any = {};
    sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Execute queries
    const [tenants, total] = await Promise.all([
      baseQuery.clone().sort(sortObj).skip(skip).limit(limit).exec(),
      baseQuery.clone().countDocuments().exec(),
    ]);

    return createPaginatedResponse<Tenant>(tenants, total, page, limit);
  }

  private async findAllPaginatedWithStats(
    queryDto: TenantQueryDto,
    currentUser: UserDocument,
    ability: any,
  ): Promise<PaginatedTenantsResponse<any>> {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      hasActiveLeases,
    } = queryDto;

    const skip = (page - 1) * limit;

    // Build aggregation pipeline
    const pipeline: any[] = [];

    // Stage 1: Match accessible tenants (CASL filter)
    const accessibleConditions = (ability as any).rulesFor(Action.Read, Tenant);

    // Stage 2: Lookup primary user to get email and phone
    pipeline.push({
      $lookup: {
        from: 'users',
        let: { tenantId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$party_id', '$$tenantId'] },
                  { $eq: ['$user_type', 'Tenant'] },
                  { $eq: ['$isPrimary', true] },
                ],
              },
            },
          },
          {
            $project: {
              email: 1,
              phone: 1,
            },
          },
          {
            $limit: 1,
          },
        ],
        as: 'primaryUser',
      },
    });

    // Stage 3: Lookup active leases
    pipeline.push({
      $lookup: {
        from: 'leases',
        let: { tenantId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ['$tenant', '$$tenantId'] },
              status: { $in: ['ACTIVE'] },
            },
          },
        ],
        as: 'activeLeases',
      },
    });

    // Stage 3: Lookup outstanding transactions (via leases)
    pipeline.push({
      $lookup: {
        from: 'leases',
        let: { tenantId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ['$tenant', '$$tenantId'] },
            },
          },
          {
            $lookup: {
              from: 'transactions',
              let: { leaseId: '$_id' },
              pipeline: [
                {
                  $match: {
                    $expr: { $eq: ['$lease', '$$leaseId'] },
                    status: 'OVERDUE',
                  },
                },
              ],
              as: 'overdueTransactions',
            },
          },
          {
            $unwind: {
              path: '$overdueTransactions',
              preserveNullAndEmptyArrays: false,
            },
          },
          {
            $replaceRoot: { newRoot: '$overdueTransactions' },
          },
        ],
        as: 'allOverdueTransactions',
      },
    });

    // Stage 5: Project fields with calculated stats
    pipeline.push({
      $addFields: {
        email: { $arrayElemAt: ['$primaryUser.email', 0] },
        phone: { $arrayElemAt: ['$primaryUser.phone', 0] },
        activeLeasesCount: { $size: '$activeLeases' },
        hasActiveLeases: { $gt: [{ $size: '$activeLeases' }, 0] },
        outstandingBalance: {
          $cond: {
            if: { $gt: [{ $size: '$allOverdueTransactions' }, 0] },
            then: { $sum: '$allOverdueTransactions.amount' },
            else: 0,
          },
        },
      },
    });

    // Stage 6: Remove temporary lookup fields
    pipeline.push({
      $project: {
        primaryUser: 0,
        activeLeases: 0,
        allOverdueTransactions: 0,
      },
    });

    // Stage 7: Apply search filter (after email/phone are added)
    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { name: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } },
          ],
        },
      });
    }

    // Stage 8: Apply hasActiveLeases filter
    if (hasActiveLeases !== undefined) {
      pipeline.push({
        $match: { hasActiveLeases },
      });
    }

    // Count total before pagination
    const countPipeline = [...pipeline, { $count: 'total' }];
    const countResult = await this.tenantModel.aggregate(countPipeline).exec();
    const total = countResult[0]?.total || 0;

    // Stage 9: Sort
    const sortObj: any = {};
    sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;
    pipeline.push({ $sort: sortObj });

    // Stage 10: Pagination
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: limit });

    // Execute aggregation
    const tenants = await this.tenantModel.aggregate(pipeline).exec();

    return createPaginatedResponse<any>(tenants, total, page, limit);
  }

  async findOne(id: string, currentUser: UserDocument) {
    // Tenant users should only access their own profile via /tenants/me
    if (currentUser.user_type === 'Tenant') {
      throw new ForbiddenException(
        'Tenant users cannot access other tenant records. Use /tenants/me to access your own profile.',
      );
    }

    // CASL: Check read permission
    const ability = this.caslAuthorizationService.createAbilityForUser(currentUser);

    if (!ability.can(Action.Read, Tenant)) {
      throw new ForbiddenException('You do not have permission to view tenants');
    }

    const tenant = await this.tenantModel.findById(id).exec();

    if (!tenant) {
      throw new NotFoundException(`Tenant with ID ${id} not found`);
    }

    // CASL: Final permission check on the specific record
    if (!ability.can(Action.Read, tenant)) {
      throw new ForbiddenException('You do not have permission to view this tenant');
    }

    return tenant;
  }

  async findMyProfile(currentUser: UserDocument) {
    // Only tenant users can access their own profile
    if (currentUser.user_type !== 'Tenant') {
      throw new ForbiddenException('Only tenant users can access this endpoint');
    }

    // CASL: Check read permission
    const ability = this.caslAuthorizationService.createAbilityForUser(currentUser);

    if (!ability.can(Action.Read, Tenant)) {
      throw new ForbiddenException('You do not have permission to view tenant profile');
    }

    const tenantId = currentUser.party_id;
    if (!tenantId) {
      throw new ForbiddenException('No tenant profile associated with this user');
    }

    const tenant = await this.tenantModel.findById(tenantId).exec();

    if (!tenant) {
      throw new NotFoundException('Tenant profile not found');
    }

    // CASL: Final permission check on the specific record
    if (!ability.can(Action.Read, tenant)) {
      throw new ForbiddenException('You do not have permission to view this tenant profile');
    }

    return tenant;
  }

  async create(createTenantDto: CreateTenantDto, currentUser: UserDocument) {
    // CASL: Check create permission

    const ability = this.caslAuthorizationService.createAbilityForUser(currentUser);

    if (!ability.can(Action.Create, Tenant)) {
      throw new ForbiddenException('You do not have permission to create tenants');
    }

    // Extract user data from DTO
    const { email, password, name, username, firstName, lastName, phone } = createTenantDto;

    // Validate tenant creation data
    await this.validateTenantCreationData(name, email, username);

    // Create tenant
    return await this.sessionService.withSession(async (session: ClientSession | null) => {
      const tenantData = {
        name,
      };

      const newTenant = new this.tenantModel(tenantData);
      const savedTenant = await newTenant.save({ session });

      // Create user account
      const userData = {
        username,
        firstName,
        lastName,
        email,
        phone,
        password,
        user_type: UserType.TENANT,
        party_id: savedTenant._id.toString(),
      };

      await this.usersService.create(userData, session);

      return savedTenant;
    });
  }

  async createFromInvitation(createTenantDto: CreateTenantDto, session?: ClientSession) {
    // Extract user data from DTO
    const { email, password, name, username, firstName, lastName, phone } = createTenantDto;

    // Validate tenant creation data (no CASL authorization needed for invitations)
    await this.validateTenantCreationData(name, email, username);

    // Create tenant
    const tenantData = {
      name,
    };

    const newTenant = new this.tenantModel(tenantData);
    const savedTenant = await newTenant.save({ session: session ?? null });

    // Create user account (without current user context for invitations)
    const userData = {
      username,
      email,
      phone,
      password,
      firstName,
      lastName,
      user_type: UserType.TENANT,
      party_id: savedTenant._id.toString(),
    };

    await this.usersService.createFromInvitation(userData, session);

    return savedTenant;
  }

  async update(id: string, updateTenantDto: UpdateTenantDto, currentUser: UserDocument) {
    // CASL: Check update permission
    const ability = this.caslAuthorizationService.createAbilityForUser(currentUser);
    const tenant = await this.tenantModel.findById(id).exec();

    if (!tenant) {
      throw new NotFoundException(`Tenant with ID ${id} not found`);
    }

    // CASL: Check if user can update this specific tenant
    if (!ability.can(Action.Update, tenant)) {
      throw new ForbiddenException('You do not have permission to update this tenant');
    }

    // Filter allowed fields based on user role
    const filteredUpdateDto = this.filterUpdateFields(updateTenantDto, currentUser);

    // Validate tenant name uniqueness if name is being updated
    if (filteredUpdateDto.name && filteredUpdateDto.name !== tenant.name) {
      await this.validateTenantNameUniqueness(filteredUpdateDto.name, id);
    }

    const updatedTenant = await this.tenantModel
      .findByIdAndUpdate(id, filteredUpdateDto, { new: true })
      .exec();

    return updatedTenant;
  }

  async remove(id: string, currentUser: UserDocument) {
    // CASL: Check delete permission
    const ability = this.caslAuthorizationService.createAbilityForUser(currentUser);

    const tenant = await this.tenantModel.findById(id).exec();

    if (!tenant) {
      throw new NotFoundException(`Tenant with ID ${id} not found`);
    }

    // CASL: Check if user can delete this tenant
    if (!ability.can(Action.Delete, tenant)) {
      throw new ForbiddenException('You do not have permission to delete this tenant');
    }

    await this.tenantModel.deleteById(id);
    return { message: 'Tenant deleted successfully' };
  }

  async findTenantUsers(
    tenantId: string,
    queryDto: UserQueryDto,
    currentUser: UserDocument,
  ): Promise<PaginatedResponse<User>> {
    // Validate tenant exists and user has access
    await this.validateTenantAccess(tenantId, currentUser, Action.Read);

    // Create a modified query that filters for this tenant's users
    const tenantUserQuery: UserQueryDto = {
      ...queryDto,
      user_type: UserType.TENANT,
      party_id: tenantId, // Add party_id to the query
    };

    // Use UserService for consistent business logic and CASL authorization
    return await this.usersService.findAllPaginated(tenantUserQuery, currentUser);
  }

  async createTenantUser(
    tenantId: string,
    createTenantUserDto: CreateTenantUserDto,
    currentUser: UserDocument,
  ) {
    // Validate tenant exists and user has access
    await this.validateTenantAccess(tenantId, currentUser, Action.Create);

    // Create user using UsersService with tenant-specific data
    const userData: CreateUserDto = {
      username: createTenantUserDto.username,
      firstName: createTenantUserDto.firstName,
      lastName: createTenantUserDto.lastName,
      email: createTenantUserDto.email,
      phone: createTenantUserDto.phone,
      password: createTenantUserDto.password,
      user_type: UserType.TENANT,
      party_id: tenantId,
      isPrimary: createTenantUserDto.isPrimary,
    };

    return await this.usersService.create(userData);
  }

  async updateTenantUser(
    tenantId: string,
    userId: string,
    updateUserDto: UpdateUserDto,
    currentUser: UserDocument,
  ) {
    // Validate tenant exists and user has access
    await this.validateTenantAccess(tenantId, currentUser, Action.Update);

    await this.validateUserBelongsToTenant(userId, tenantId, currentUser);

    return await this.usersService.update(userId, updateUserDto);
  }

  async removeTenantUser(tenantId: string, userId: string, currentUser: UserDocument) {
    await this.validateTenantAccess(tenantId, currentUser, Action.Delete);

    await this.validateUserBelongsToTenant(userId, tenantId, currentUser);

    return await this.usersService.remove(userId);
  }

  // Helper method to validate tenant access
  private async validateTenantAccess(tenantId: string, currentUser: UserDocument, action: Action) {
    // Check CASL permissions
    const ability = this.caslAuthorizationService.createAbilityForUser(currentUser);

    if (!ability.can(action, Tenant)) {
      throw new ForbiddenException(
        `You do not have permission to ${action.toLowerCase()} tenant users`,
      );
    }

    // Verify the tenant exists and user has access
    const tenant = await this.tenantModel.findById(tenantId).exec();

    if (!tenant) {
      throw new NotFoundException(`Tenant with ID ${tenantId} not found`);
    }

    // For tenant users, ensure they can only access their own tenant's users
    if (currentUser.user_type === 'Tenant') {
      if (currentUser.party_id?.toString() !== tenantId) {
        throw new ForbiddenException('You can only manage users within your own tenant');
      }
    }

    return tenant;
  }

  // Helper method to validate that a user belongs to a specific tenant
  private async validateUserBelongsToTenant(
    userId: string,
    tenantId: string,
    currentUser: UserDocument,
  ) {
    // Validation: Ensure userId is a valid ObjectId format
    if (!userId.match(/^[0-9a-fA-F]{24}$/)) {
      throw new UnprocessableEntityException('Invalid user ID format');
    }

    // Find and verify the user belongs to the tenant
    const user = await this.userModel
      .findOne({
        _id: userId,
        user_type: 'Tenant',
        party_id: tenantId,
      })
      .exec();

    if (!user) {
      throw new NotFoundException('User not found or does not belong to this tenant');
    }

    return user;
  }

  // Helper method to filter update fields based on user role
  private filterUpdateFields(
    updateTenantDto: UpdateTenantDto,
    currentUser: UserDocument,
  ): UpdateTenantDto {
    const allowedFields = this.getAllowedUpdateFields(currentUser);
    const filteredDto: any = {};

    for (const field of allowedFields) {
      if (updateTenantDto[field] !== undefined) {
        filteredDto[field] = updateTenantDto[field];
      }
    }

    return filteredDto;
  }

  async getTenantStats(id: string, currentUser: UserDocument): Promise<TenantStatsDto> {
    // Check if tenant exists and user has access
    await this.findOne(id, currentUser);

    const now = new Date();

    // Use a single aggregation pipeline to get all stats efficiently
    const pipeline = await this.leaseModel.aggregate([
      {
        $match: {
          tenant: new mongoose.Types.ObjectId(id),
          status: LeaseStatus.ACTIVE,
        },
      },
      {
        $lookup: {
          from: 'transactions',
          let: { leaseId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$lease', '$$leaseId'] },
                    { $lt: ['$dueDate', now] },
                    { $ne: ['$status', PaymentStatus.PAID] },
                  ],
                },
              },
            },
            {
              $group: {
                _id: null,
                totalOverdue: { $sum: '$amount' },
              },
            },
          ],
          as: 'overdueTransactions',
        },
      },
      {
        $group: {
          _id: null,
          activeLeases: { $sum: 1 },
          totalMonthlyRent: { $sum: '$rentAmount' },
          nextExpiry: { $min: '$endDate' },
          outstanding: {
            $sum: {
              $ifNull: [{ $arrayElemAt: ['$overdueTransactions.totalOverdue', 0] }, 0],
            },
          },
        },
      },
    ]);
    console.log(pipeline);

    const stats = pipeline[0] || {
      activeLeases: 0,
      totalMonthlyRent: 0,
      outstanding: 0,
      nextExpiry: null,
    };

    return {
      activeLeases: stats.activeLeases,
      totalMonthlyRent: stats.totalMonthlyRent,
      outstanding: stats.outstanding,
      nextExpiry: stats.nextExpiry,
    };
  }

  private getAllowedUpdateFields(currentUser: UserDocument): string[] {
    switch (currentUser.user_type) {
      case 'Landlord':
        return ['name']; // Landlords can update tenant details
      case 'Tenant':
        return []; // Tenants cannot update tenant records
      case 'Contractor':
        return []; // Contractors cannot update tenant records
      default:
        return [];
    }
  }

  // Validation helper for tenant creation
  private async validateTenantCreationData(name: string, email: string, username: string) {
    // Check if tenant name already exists
    const existingTenant = await this.tenantModel
      .findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } })
      .exec();

    if (existingTenant) {
      throw new UnprocessableEntityException(
        `A tenant with the name '${name}' already exists in your organization`,
      );
    }

    // Check if email is already registered
    const existingUserWithEmail = await this.userModel
      .findOne({ email: email.toLowerCase() })
      .exec();

    if (existingUserWithEmail) {
      throw new UnprocessableEntityException(
        `The email '${email}' is already registered in your organization`,
      );
    }

    // Check if username is already taken
    const existingUserWithUsername = await this.userModel
      .findOne({ username: username.toLowerCase() })
      .exec();

    if (existingUserWithUsername) {
      throw new UnprocessableEntityException(
        `The username '${username}' is already taken in your organization`,
      );
    }
  }

  // Validation helper for tenant name uniqueness during updates
  private async validateTenantNameUniqueness(name: string, excludeId: string) {
    const existingTenant = await this.tenantModel
      .findOne({
        name: { $regex: new RegExp(`^${name}$`, 'i') },
        _id: { $ne: excludeId },
      })
      .exec();

    if (existingTenant) {
      throw new UnprocessableEntityException(
        `A tenant with the name '${name}' already exists in your organization`,
      );
    }
  }
}
