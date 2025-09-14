import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Action } from '../../common/casl/casl-ability.factory';
import { CaslAuthorizationService } from '../../common/casl/services/casl-authorization.service';
import { UserType } from '../../common/enums/user-type.enum';
import { AppModel } from '../../common/interfaces/app-model.interface';
import { createPaginatedResponse, PaginatedResponse } from '../../common/utils/pagination.utils';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { UpdateUserDto } from '../users/dto/update-user.dto';
import { UserQueryDto } from '../users/dto/user-query.dto';
import { User, UserDocument } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';
import { CreateTenantUserDto } from './dto/create-tenant-user.dto';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { PaginatedTenantsResponse, TenantQueryDto } from './dto/tenant-query.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { Tenant } from './schema/tenant.schema';

@Injectable()
export class TenantsService {
  constructor(
    @InjectModel(Tenant.name)
    private readonly tenantModel: AppModel<Tenant>,
    @InjectModel(User.name)
    private readonly userModel: AppModel<User>,
    private caslAuthorizationService: CaslAuthorizationService,
    private usersService: UsersService,
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

    const { page = 1, limit = 10, search, sortBy = 'createdAt', sortOrder = 'desc' } = queryDto;

    // STEP 1: CASL - Check if user can read tenants
    const ability = this.caslAuthorizationService.createAbilityForUser(currentUser);

    if (!ability.can(Action.Read, Tenant)) {
      throw new ForbiddenException('You do not have permission to view tenants');
    }

    // STEP 2: mongo-tenant - Apply tenant isolation (mandatory for all users)
    const landlordId =
      currentUser.tenantId && typeof currentUser.tenantId === 'object'
        ? (currentUser.tenantId as any)._id
        : currentUser.tenantId;

    if (!landlordId) {
      // Users without tenantId cannot access any tenants
      return createPaginatedResponse<Tenant>([], 0, page, limit);
    }

    let baseQuery = this.tenantModel.byTenant(landlordId).find();

    // STEP 3: Apply CASL field-level filtering
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

    // mongo-tenant: Apply tenant filtering (mandatory)
    if (!currentUser.tenantId) {
      throw new ForbiddenException('Access denied: No tenant context');
    }

    const landlordId =
      currentUser.tenantId && typeof currentUser.tenantId === 'object'
        ? (currentUser.tenantId as any)._id
        : currentUser.tenantId;

    const tenant = await this.tenantModel.byTenant(landlordId).findById(id).exec();

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

    // mongo-tenant: Apply tenant filtering (mandatory)
    if (!currentUser.tenantId) {
      throw new ForbiddenException('Access denied: No tenant context');
    }

    const landlordId =
      currentUser.tenantId && typeof currentUser.tenantId === 'object'
        ? (currentUser.tenantId as any)._id
        : currentUser.tenantId;

    const tenantId = currentUser.party_id;
    if (!tenantId) {
      throw new ForbiddenException('No tenant profile associated with this user');
    }

    const tenant = await this.tenantModel.byTenant(landlordId).findById(tenantId).exec();

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

    // Ensure user has tenant context
    if (!currentUser.tenantId) {
      throw new ForbiddenException('Cannot create tenant: No tenant context');
    }

    const landlordId =
      currentUser.tenantId && typeof currentUser.tenantId === 'object'
        ? (currentUser.tenantId as any)._id
        : currentUser.tenantId;

    // Extract user data from DTO
    const { email, password, name, username } = createTenantDto;

    // Validate tenant creation data
    await this.validateTenantCreationData(name, email, username, landlordId);

    // Create tenant
    // todo start transaction
    const tenantData = {
      name,
      tenantId: landlordId,
    };

    const TenantWithTenant = this.tenantModel.byTenant(landlordId);
    const newTenant = new TenantWithTenant(tenantData);
    const savedTenant = await newTenant.save();

    // Create user account
    const userData = {
      username,
      email,
      password,
      user_type: UserType.TENANT,
      party_id: savedTenant._id.toString(),
    };

    await this.usersService.create(userData, currentUser);

    return savedTenant;
  }

  async update(id: string, updateTenantDto: UpdateTenantDto, currentUser: UserDocument) {
    // CASL: Check update permission
    const ability = this.caslAuthorizationService.createAbilityForUser(currentUser);

    // Ensure user has tenant context
    if (!currentUser.tenantId) {
      throw new ForbiddenException('Access denied: No tenant context');
    }

    const landlordId =
      currentUser.tenantId && typeof currentUser.tenantId === 'object'
        ? (currentUser.tenantId as any)._id
        : currentUser.tenantId;

    // mongo-tenant: Find within tenant context
    const tenant = await this.tenantModel.byTenant(landlordId).findById(id).exec();

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
      await this.validateTenantNameUniqueness(filteredUpdateDto.name, landlordId, id);
    }

    const updatedTenant = await this.tenantModel
      .findByIdAndUpdate(id, filteredUpdateDto, { new: true })
      .exec();

    return updatedTenant;
  }

  async remove(id: string, currentUser: UserDocument) {
    // CASL: Check delete permission
    const ability = this.caslAuthorizationService.createAbilityForUser(currentUser);

    // todo do we need this verification each time
    // Ensure user has tenant context
    if (!currentUser.tenantId) {
      throw new ForbiddenException('Access denied: No tenant context');
    }

    const landlordId =
      currentUser.tenantId && typeof currentUser.tenantId === 'object'
        ? (currentUser.tenantId as any)._id
        : currentUser.tenantId;

    // mongo-tenant: Find within tenant context
    const tenant = await this.tenantModel.byTenant(landlordId).findById(id).exec();

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
      email: createTenantUserDto.email,
      password: createTenantUserDto.password,
      user_type: UserType.TENANT,
      party_id: tenantId,
    };

    return await this.usersService.create(userData, currentUser);
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

    return await this.usersService.update(userId, updateUserDto, currentUser);
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

    // Ensure user has tenant context
    if (!currentUser.tenantId) {
      throw new ForbiddenException('Access denied: No tenant context');
    }

    const landlordId = this.getLandlordId(currentUser);

    // Verify the tenant exists and user has access
    const tenant = await this.tenantModel.byTenant(landlordId).findById(tenantId).exec();

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

  // Helper method to get landlord ID from user
  private getLandlordId(currentUser: UserDocument) {
    return currentUser.tenantId && typeof currentUser.tenantId === 'object'
      ? (currentUser.tenantId as any)._id
      : currentUser.tenantId;
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

    const landlordId = this.getLandlordId(currentUser);

    // Find and verify the user belongs to the tenant
    const user = await this.userModel
      .byTenant(landlordId)
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
  private async validateTenantCreationData(
    name: string,
    email: string,
    username: string,
    landlordId: any,
  ) {
    // Check if tenant name already exists
    const existingTenant = await this.tenantModel
      .byTenant(landlordId)
      .findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } })
      .exec();

    if (existingTenant) {
      throw new UnprocessableEntityException(
        `A tenant with the name '${name}' already exists in your organization`,
      );
    }

    // Check if email is already registered
    const existingUserWithEmail = await this.userModel
      .byTenant(landlordId)
      .findOne({ email: email.toLowerCase() })
      .exec();

    if (existingUserWithEmail) {
      throw new UnprocessableEntityException(
        `The email '${email}' is already registered in your organization`,
      );
    }

    // Check if username is already taken
    const existingUserWithUsername = await this.userModel
      .byTenant(landlordId)
      .findOne({ username: username.toLowerCase() })
      .exec();

    if (existingUserWithUsername) {
      throw new UnprocessableEntityException(
        `The username '${username}' is already taken in your organization`,
      );
    }
  }

  // Validation helper for tenant name uniqueness during updates
  private async validateTenantNameUniqueness(name: string, landlordId: any, excludeId: string) {
    const existingTenant = await this.tenantModel
      .byTenant(landlordId)
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
