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
import { Unit } from '../properties/schemas/unit.schema';
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
    @InjectModel(Unit.name)
    private readonly unitModel: AppModel<Unit>,
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
      propertyId,
      unitId,
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

    // Filter by property and/or unit - find tenants with active leases
    if (propertyId || unitId) {
      const leaseQuery: any = {
        status: LeaseStatus.ACTIVE,
      };

      if (unitId) {
        // If unit is specified, filter directly by unit
        leaseQuery.unit = new mongoose.Types.ObjectId(unitId);
      } else if (propertyId) {
        // If only property is specified, find all units of that property first
        const propertyUnits = await this.unitModel
          .find({ property: new mongoose.Types.ObjectId(propertyId) })
          .select('_id')
          .lean();
        const unitIds = propertyUnits.map((unit) => unit._id);
        leaseQuery.unit = { $in: unitIds };
      }

      const activeLeases = await this.leaseModel.find(leaseQuery).select('tenant').lean();
      const tenantIds = activeLeases.map((lease) => lease.tenant).filter(Boolean);

      baseQuery = baseQuery.where({ _id: { $in: tenantIds } });
    }

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

    // Stage 1: Match accessible tenants (CASL filter) and ensure not deleted
    // For landlords, filter by landlords array containing their organization ID
    const matchStage: any = {
      deleted: false,
    };

    // Apply landlord filter if user is a landlord
    if (currentUser.user_type === 'Landlord' && currentUser.organization_id) {
      matchStage.landlords = currentUser.organization_id;
    }

    pipeline.push({
      $match: matchStage,
    });

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
                  { $eq: ['$organization_id', '$$tenantId'] },
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
              profilePicture: 1,
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
              deleted: false,
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
              deleted: false,
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
                    deleted: false,
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
        profilePicture: { $arrayElemAt: ['$primaryUser.profilePicture', 0] },
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

    // For landlords, verify they have access to this specific tenant
    if (currentUser.user_type === 'Landlord' && currentUser.organization_id) {
      const landlordId = currentUser.organization_id.toString();
      const hasAccess = tenant.landlords?.some((id) => id.toString() === landlordId);
      if (!hasAccess) {
        throw new ForbiddenException('You do not have permission to view this tenant');
      }
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

    const tenantId = currentUser.organization_id;
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

  async findMyNeighbors(currentUser: UserDocument) {
    // Only tenant users can access neighbors
    if (currentUser.user_type !== 'Tenant') {
      throw new ForbiddenException('Only tenant users can access this endpoint');
    }

    const tenantId = currentUser.organization_id;
    if (!tenantId) {
      throw new ForbiddenException('No tenant profile associated with this user');
    }

    // Step 1: Find all active leases for the current tenant
    const myLeases = await this.leaseModel
      .find({
        tenant: tenantId,
        status: LeaseStatus.ACTIVE,
        deleted: false,
      })
      .populate('unit')
      .exec();

    if (!myLeases || myLeases.length === 0) {
      return [];
    }

    // Step 2: Extract property IDs from the units
    const propertyIds = myLeases
      .map((lease) => {
        const unit = lease.unit as any;
        return unit?.property;
      })
      .filter((propertyId) => propertyId);

    if (propertyIds.length === 0) {
      return [];
    }

    // Step 3: Find all units in the same properties
    const unitsInSameProperties = await this.unitModel
      .find({
        property: { $in: propertyIds },
        deleted: false,
      })
      .populate('property')
      .exec();

    if (!unitsInSameProperties || unitsInSameProperties.length === 0) {
      return [];
    }

    const unitIds = unitsInSameProperties.map((unit) => unit._id);

    // Step 4: Find all active leases for those units (excluding current tenant's leases)
    const neighborLeases = await this.leaseModel.aggregate([
      {
        $match: {
          unit: { $in: unitIds },
          tenant: { $ne: new mongoose.Types.ObjectId(tenantId) }, // Exclude current tenant
          status: LeaseStatus.ACTIVE,
          deleted: false,
        },
      },
      {
        $lookup: {
          from: 'units',
          localField: 'unit',
          foreignField: '_id',
          as: 'unitDetails',
        },
      },
      {
        $unwind: '$unitDetails',
      },
      {
        $lookup: {
          from: 'properties',
          localField: 'unitDetails.property',
          foreignField: '_id',
          as: 'propertyDetails',
        },
      },
      {
        $unwind: '$propertyDetails',
      },
      {
        $lookup: {
          from: 'tenants',
          localField: 'tenant',
          foreignField: '_id',
          as: 'tenantDetails',
        },
      },
      {
        $unwind: '$tenantDetails',
      },
      {
        $lookup: {
          from: 'media',
          let: { unitId: '$unitDetails._id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$model_id', '$$unitId'] },
                    { $eq: ['$model_type', 'Unit'] },
                    { $eq: ['$collection_name', 'unit_photos'] },
                  ],
                },
              },
            },
            { $limit: 1 },
          ],
          as: 'unitMedia',
        },
      },
      {
        $project: {
          _id: '$unitDetails._id',
          unitNumber: '$unitDetails.unitNumber',
          size: '$unitDetails.size',
          type: '$unitDetails.type',
          property: {
            _id: '$propertyDetails._id',
            name: '$propertyDetails.name',
            address: '$propertyDetails.address',
          },
          activeLease: {
            _id: '$_id',
            rentAmount: '$rentAmount',
            startDate: '$startDate',
            endDate: '$endDate',
            status: '$status',
            tenant: {
              _id: '$tenantDetails._id',
              name: '$tenantDetails.name',
            },
          },
          media: '$unitMedia',
        },
      },
    ]);

    return neighborLeases;
  }

  async findMyProperties(currentUser: UserDocument) {
    // Only tenant users can access their properties
    if (currentUser.user_type !== 'Tenant') {
      throw new ForbiddenException('Only tenant users can access this endpoint');
    }

    const tenantId = currentUser.organization_id;
    if (!tenantId) {
      throw new ForbiddenException('No tenant profile associated with this user');
    }

    // Find all active leases for the current tenant with unit and property populated
    const myLeases = await this.leaseModel
      .find({
        tenant: tenantId,
        status: LeaseStatus.ACTIVE,
        deleted: false,
      })
      .populate({
        path: 'unit',
        populate: {
          path: 'property',
        },
      })
      .exec();

    if (!myLeases || myLeases.length === 0) {
      return [];
    }

    // Group units by property
    const propertiesMap = new Map<
      string,
      {
        _id: string;
        name: string;
        address: any;
        description?: string;
        units: Array<{
          _id: string;
          unitNumber: string;
          size: number;
          type: string;
        }>;
      }
    >();

    for (const lease of myLeases) {
      const unit = lease.unit as any;
      if (!unit || !unit.property) continue;

      const property = unit.property;
      const propertyId = property._id.toString();

      if (!propertiesMap.has(propertyId)) {
        propertiesMap.set(propertyId, {
          _id: propertyId,
          name: property.name,
          address: property.address,
          description: property.description,
          units: [],
        });
      }

      const propertyData = propertiesMap.get(propertyId)!;
      // Add unit if not already added
      const unitExists = propertyData.units.some((u) => u._id === unit._id.toString());
      if (!unitExists) {
        propertyData.units.push({
          _id: unit._id.toString(),
          unitNumber: unit.unitNumber,
          size: unit.size,
          type: unit.type,
        });
      }
    }

    return Array.from(propertiesMap.values());
  }

  async create(createTenantDto: CreateTenantDto, currentUser: UserDocument) {
    // CASL: Check create permission

    const ability = this.caslAuthorizationService.createAbilityForUser(currentUser);

    if (!ability.can(Action.Create, Tenant)) {
      throw new ForbiddenException('You do not have permission to create tenants');
    }

    // Extract user data from DTO
    const {
      email,
      password,
      name,
      username,
      firstName,
      lastName,
      phone,
      invitationContext,
      profilePicture,
    } = createTenantDto;

    // Validate tenant creation data
    await this.validateTenantCreationData(name, email, username);

    // Create tenant
    return await this.sessionService.withSession(async (session: ClientSession | null) => {
      const tenantData: any = {
        name,
      };

      if (invitationContext) {
        tenantData.invitationContext = invitationContext;
      }

      const newTenant = new this.tenantModel(tenantData);
      const savedTenant = await newTenant.save({ session });

      // Create user account
      const userData: any = {
        username,
        firstName,
        lastName,
        email,
        phone,
        password,
        user_type: UserType.TENANT,
        organization_id: savedTenant._id.toString(),
      };

      if (profilePicture) {
        userData.profilePicture = profilePicture;
      }

      await this.usersService.create(userData, session);

      return savedTenant;
    });
  }

  async createFromInvitation(
    createTenantDto: CreateTenantDto,
    landlordId?: string,
    session?: ClientSession,
  ) {
    // Extract user data from DTO
    const {
      email,
      password,
      name,
      username,
      firstName,
      lastName,
      phone,
      invitationContext,
      profilePicture,
    } = createTenantDto;

    // Validate tenant creation data (no CASL authorization needed for invitations)
    await this.validateTenantCreationData(name, email, username);

    // Create tenant
    const tenantData: any = {
      name,
      landlords: landlordId ? [new mongoose.Types.ObjectId(landlordId)] : [],
    };

    if (invitationContext) {
      tenantData.invitationContext = invitationContext;
    }

    const newTenant = new this.tenantModel(tenantData);
    const savedTenant = await newTenant.save({ session: session ?? null });

    // Create user account (without current user context for invitations)
    const userData: any = {
      username,
      email,
      phone,
      password,
      firstName,
      lastName,
      user_type: UserType.TENANT,
      organization_id: savedTenant._id.toString(),
    };

    if (profilePicture) {
      userData.profilePicture = profilePicture;
    }

    await this.usersService.createFromInvitation(userData, session);

    return savedTenant;
  }

  async addLandlordToTenant(tenantId: string, landlordId: string, session?: ClientSession) {
    const tenant = await this.tenantModel.findById(tenantId).exec();

    if (!tenant) {
      throw new NotFoundException(`Tenant with ID ${tenantId} not found`);
    }

    // Add landlord ID if not already present
    const landlordObjectId = new mongoose.Types.ObjectId(landlordId);
    const landlordExists = tenant.landlords?.some((id) => id.equals(landlordObjectId));

    if (!landlordExists) {
      await this.tenantModel
        .findByIdAndUpdate(
          tenantId,
          { $addToSet: { landlords: landlordObjectId } },
          { session: session ?? null },
        )
        .exec();
    }

    return tenant;
  }

  async removeLandlordFromTenant(tenantId: string, landlordId: string, currentUser: UserDocument) {
    // CASL: Check permission
    const ability = this.caslAuthorizationService.createAbilityForUser(currentUser);

    const tenant = await this.tenantModel.findById(tenantId).exec();

    if (!tenant) {
      throw new NotFoundException(`Tenant with ID ${tenantId} not found`);
    }

    // Only landlords can remove themselves from tenant
    if (currentUser.user_type !== 'Landlord') {
      throw new ForbiddenException('Only landlords can remove tenants from their organization');
    }

    // Verify the landlord is removing their own ID
    const currentLandlordId = currentUser.organization_id?.toString();
    if (currentLandlordId !== landlordId) {
      throw new ForbiddenException('You can only remove yourself from tenant associations');
    }

    // Remove landlord ID from tenant's landlords array
    const landlordObjectId = new mongoose.Types.ObjectId(landlordId);
    await this.tenantModel
      .findByIdAndUpdate(tenantId, { $pull: { landlords: landlordObjectId } })
      .exec();

    return { message: 'Tenant removed from your organization successfully' };
  }

  async findTenantByUserEmail(email: string): Promise<Tenant | null> {
    const user = await this.userModel
      .findOne({
        email: email.toLowerCase(),
        user_type: UserType.TENANT,
      })
      .exec();

    if (!user || !user.organization_id) {
      return null;
    }

    return this.tenantModel.findById(user.organization_id).exec();
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
      organization_id: tenantId, // Add organization_id to the query
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
      organization_id: tenantId,
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

    // For tenant users, validate access based on action
    if (currentUser.user_type === 'Tenant') {
      const currentTenantId = currentUser.organization_id?.toString();

      // For read actions, allow access to own tenant or neighbor tenants
      if (action === Action.Read) {
        if (currentTenantId === tenantId) {
          // Accessing own tenant - allowed
          return tenant;
        }

        // Check if the target tenant is a neighbor
        const isNeighbor = await this.isNeighborTenant(currentTenantId, tenantId);
        if (!isNeighbor) {
          throw new ForbiddenException(
            'You can only view users within your own tenant or neighbor tenants',
          );
        }
      } else {
        // For non-read actions (create, update, delete), only allow own tenant
        if (currentTenantId !== tenantId) {
          throw new ForbiddenException('You can only manage users within your own tenant');
        }
      }
    }

    return tenant;
  }

  // Helper method to check if a tenant is a neighbor
  private async isNeighborTenant(
    currentTenantId: string | undefined,
    targetTenantId: string,
  ): Promise<boolean> {
    if (!currentTenantId) {
      return false;
    }

    // Step 1: Find all active leases for the current tenant
    const myLeases = await this.leaseModel
      .find({
        tenant: currentTenantId,
        status: LeaseStatus.ACTIVE,
        deleted: false,
      })
      .populate('unit')
      .exec();

    if (!myLeases || myLeases.length === 0) {
      return false;
    }

    // Step 2: Extract property IDs from the units
    const propertyIds = myLeases
      .map((lease) => {
        const unit = lease.unit as any;
        return unit?.property;
      })
      .filter((propertyId) => propertyId);

    if (propertyIds.length === 0) {
      return false;
    }

    // Step 3: Find all units in the same properties
    const unitsInSameProperties = await this.unitModel
      .find({
        property: { $in: propertyIds },
        deleted: false,
      })
      .exec();

    if (!unitsInSameProperties || unitsInSameProperties.length === 0) {
      return false;
    }

    const unitIds = unitsInSameProperties.map((unit) => unit._id);

    // Step 4: Check if the target tenant has an active lease in any of these units
    const neighborLease = await this.leaseModel
      .findOne({
        unit: { $in: unitIds },
        tenant: new mongoose.Types.ObjectId(targetTenantId),
        status: LeaseStatus.ACTIVE,
        deleted: false,
      })
      .exec();

    return !!neighborLease;
  }

  // Helper method to validate that a user belongs to a specific tenant
  private async validateUserBelongsToTenant(
    userId: string,
    tenantId: string,
    _currentUser: UserDocument,
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
        organization_id: tenantId,
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
          deleted: false,
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
