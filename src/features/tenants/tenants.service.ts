import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Action } from '../../common/casl/casl-ability.factory';
import { CaslAuthorizationService } from '../../common/casl/services/casl-authorization.service';
import { AppModel } from '../../common/interfaces/app-model.interface';
import { createPaginatedResponse } from '../../common/utils/pagination.utils';
import { User, UserDocument } from '../users/schemas/user.schema';
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
  ) {}

  async findAllPaginated(
    queryDto: TenantQueryDto,
    currentUser: UserDocument,
  ): Promise<PaginatedTenantsResponse<Tenant>> {
    // Tenant users should not be able to list other tenants - only access their own profile
    if (currentUser.user_type === 'Tenant') {
      throw new ForbiddenException('Tenant users cannot access the tenant list. Use /tenants/me to access your own profile.');
    }

    const {
      page = 1,
      limit = 10,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = queryDto;

    // STEP 1: CASL - Check if user can read tenants
    const ability = this.caslAuthorizationService.createAbilityForUser(currentUser);

    if (!ability.can(Action.Read, Tenant)) {
      throw new ForbiddenException('You do not have permission to view tenants');
    }

    // STEP 2: mongo-tenant - Apply tenant isolation (mandatory for all users)
    const landlordId = currentUser.landlord_id && typeof currentUser.landlord_id === 'object' 
      ? (currentUser.landlord_id as any)._id 
      : currentUser.landlord_id;

    if (!landlordId) {
      // Users without landlord_id cannot access any tenants
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
      throw new ForbiddenException('Tenant users cannot access other tenant records. Use /tenants/me to access your own profile.');
    }

    // CASL: Check read permission
    const ability = this.caslAuthorizationService.createAbilityForUser(currentUser);

    if (!ability.can(Action.Read, Tenant)) {
      throw new ForbiddenException('You do not have permission to view tenants');
    }

    // mongo-tenant: Apply tenant filtering (mandatory)
    if (!currentUser.landlord_id) {
      throw new ForbiddenException('Access denied: No tenant context');
    }

    const landlordId = currentUser.landlord_id && typeof currentUser.landlord_id === 'object' 
      ? (currentUser.landlord_id as any)._id 
      : currentUser.landlord_id;

    const tenant = await this.tenantModel
      .byTenant(landlordId)
      .findById(id)
      .exec();

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
    if (!currentUser.landlord_id) {
      throw new ForbiddenException('Access denied: No tenant context');
    }

    const landlordId = currentUser.landlord_id && typeof currentUser.landlord_id === 'object' 
      ? (currentUser.landlord_id as any)._id 
      : currentUser.landlord_id;

    const tenantId = currentUser.party_id;
    if (!tenantId) {
      throw new ForbiddenException('No tenant profile associated with this user');
    }

    const tenant = await this.tenantModel
      .byTenant(landlordId)
      .findById(tenantId)
      .exec();

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
    if (!currentUser.landlord_id) {
      throw new ForbiddenException('Cannot create tenant: No tenant context');
    }

    const landlordId = currentUser.landlord_id && typeof currentUser.landlord_id === 'object' 
      ? (currentUser.landlord_id as any)._id 
      : currentUser.landlord_id;

    // Extract user data from DTO
    const { email, password, name } = createTenantDto;

    // Hash the password for the user account
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create the tenant first
    const tenantData = {
      name,
      landlord_id: landlordId, // Enforce tenant boundary
    };

    // mongo-tenant: Create within tenant context
    const TenantWithTenant = this.tenantModel.byTenant(landlordId);
    const newTenant = new TenantWithTenant(tenantData);
    const savedTenant = await newTenant.save();

    // Create the user account for the tenant
    const userData = {
      username: email, // Use email as username
      email,
      password: hashedPassword,
      user_type: 'Tenant',
      party_id: savedTenant._id, // Link to the tenant
      landlord_id: landlordId, // Set tenant context
    };

    // mongo-tenant: Create user within tenant context
    const UserWithTenant = this.userModel.byTenant(landlordId);
    const newUser = new UserWithTenant(userData);
    await newUser.save();

    return savedTenant;
  }

  async update(id: string, updateTenantDto: UpdateTenantDto, currentUser: UserDocument) {
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
    const tenant = await this.tenantModel
      .byTenant(landlordId)
      .findById(id)
      .exec();

    if (!tenant) {
      throw new NotFoundException(`Tenant with ID ${id} not found`);
    }

    // CASL: Check if user can update this specific tenant
    if (!ability.can(Action.Update, tenant)) {
      throw new ForbiddenException('You do not have permission to update this tenant');
    }

    // Filter allowed fields based on user role
    const filteredUpdateDto = this.filterUpdateFields(updateTenantDto, currentUser);

    const updatedTenant = await this.tenantModel
      .findByIdAndUpdate(id, filteredUpdateDto, { new: true })
      .exec();

    return updatedTenant;
  }

  async remove(id: string, currentUser: UserDocument) {
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
    const tenant = await this.tenantModel
      .byTenant(landlordId)
      .findById(id)
      .exec();

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

  // Helper method to filter update fields based on user role
  private filterUpdateFields(updateTenantDto: UpdateTenantDto, currentUser: UserDocument): UpdateTenantDto {
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
}
