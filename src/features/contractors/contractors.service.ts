import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Action } from '../../common/casl/casl-ability.factory';
import { CaslAuthorizationService } from '../../common/casl/services/casl-authorization.service';
import { AppModel } from '../../common/interfaces/app-model.interface';
import { createPaginatedResponse } from '../../common/utils/pagination.utils';
import { User, UserDocument } from '../users/schemas/user.schema';
import { CreateContractorDto } from './dto/create-contractor.dto';
import { PaginatedContractorsResponse, ContractorQueryDto } from './dto/contractor-query.dto';
import { UpdateContractorDto } from './dto/update-contractor.dto';
import { Contractor } from './schema/contractor.schema';

@Injectable()
export class ContractorsService {
  constructor(
    @InjectModel(Contractor.name)
    private readonly contractorModel: AppModel<Contractor>,
    @InjectModel(User.name)
    private readonly userModel: AppModel<User>,
    private caslAuthorizationService: CaslAuthorizationService,
  ) {}

  async findAllPaginated(
    queryDto: ContractorQueryDto,
    currentUser: UserDocument,
  ): Promise<PaginatedContractorsResponse<Contractor>> {
    // Contractor users should not be able to list other contractors - only access their own profile
    if (currentUser.user_type === 'Contractor') {
      throw new ForbiddenException('Contractor users cannot access the contractor list. Use /contractors/me to access your own profile.');
    }

    const {
      page = 1,
      limit = 10,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = queryDto;

    // STEP 1: CASL - Check if user can read contractors
    const ability = this.caslAuthorizationService.createAbilityForUser(currentUser);

    if (!ability.can(Action.Read, Contractor)) {
      throw new ForbiddenException('You do not have permission to view contractors');
    }

    // STEP 2: mongo-tenant - Apply tenant isolation (mandatory for all users)
    const landlordId = currentUser.tenantId && typeof currentUser.tenantId === 'object' 
      ? (currentUser.tenantId as any)._id 
      : currentUser.tenantId;

    if (!landlordId) {
      // Users without tenantId cannot access any contractors
      throw new ForbiddenException('Access denied: No tenant context');
    }

    // Build query
    const query: any = {};
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    // Apply sorting
    const sortOptions: any = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const skip = (page - 1) * limit;

    // Execute queries in parallel for better performance
    const [contractors, total] = await Promise.all([
      this.contractorModel
        .byTenant(landlordId)
        .find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .exec(),
      this.contractorModel
        .byTenant(landlordId)
        .countDocuments(query)
        .exec(),
    ]);

    return createPaginatedResponse<Contractor>(contractors, total, page, limit);
  }

  async findOne(id: string, currentUser: UserDocument) {
    // Contractor users should only access their own profile via /contractors/me
    if (currentUser.user_type === 'Contractor') {
      throw new ForbiddenException('Contractor users cannot access other contractor records. Use /contractors/me to access your own profile.');
    }

    // CASL: Check read permission
    const ability = this.caslAuthorizationService.createAbilityForUser(currentUser);

    if (!ability.can(Action.Read, Contractor)) {
      throw new ForbiddenException('You do not have permission to view contractors');
    }

    // mongo-tenant: Apply tenant filtering (mandatory)
    if (!currentUser.tenantId) {
      throw new ForbiddenException('Access denied: No tenant context');
    }

    const landlordId = currentUser.tenantId && typeof currentUser.tenantId === 'object' 
      ? (currentUser.tenantId as any)._id 
      : currentUser.tenantId;

    const contractor = await this.contractorModel
      .byTenant(landlordId)
      .findById(id)
      .exec();

    if (!contractor) {
      throw new NotFoundException(`Contractor with ID ${id} not found`);
    }

    // CASL: Final permission check on the specific record
    if (!ability.can(Action.Read, contractor)) {
      throw new ForbiddenException('You do not have permission to view this contractor');
    }

    return contractor;
  }

  async findMyProfile(currentUser: UserDocument) {
    // Only contractor users can access their own profile
    if (currentUser.user_type !== 'Contractor') {
      throw new ForbiddenException('Only contractor users can access this endpoint');
    }

    // CASL: Check read permission
    const ability = this.caslAuthorizationService.createAbilityForUser(currentUser);

    if (!ability.can(Action.Read, Contractor)) {
      throw new ForbiddenException('You do not have permission to view contractor profile');
    }

    // mongo-tenant: Apply tenant filtering (mandatory)
    if (!currentUser.tenantId) {
      throw new ForbiddenException('Access denied: No tenant context');
    }

    const landlordId = currentUser.tenantId && typeof currentUser.tenantId === 'object' 
      ? (currentUser.tenantId as any)._id 
      : currentUser.tenantId;

    const contractorId = currentUser.party_id;
    if (!contractorId) {
      throw new ForbiddenException('No contractor profile associated with this user');
    }

    const contractor = await this.contractorModel
      .byTenant(landlordId)
      .findById(contractorId)
      .exec();

    if (!contractor) {
      throw new NotFoundException('Contractor profile not found');
    }

    // CASL: Final permission check on the specific record
    if (!ability.can(Action.Read, contractor)) {
      throw new ForbiddenException('You do not have permission to view this contractor profile');
    }

    return contractor;
  }

  async create(createContractorDto: CreateContractorDto, currentUser: UserDocument) {
    // CASL: Check create permission
    const ability = this.caslAuthorizationService.createAbilityForUser(currentUser);

    if (!ability.can(Action.Create, Contractor)) {
      throw new ForbiddenException('You do not have permission to create contractors');
    }

    // Ensure user has tenant context
    if (!currentUser.tenantId) {
      throw new ForbiddenException('Cannot create contractor: No tenant context');
    }

    const landlordId = currentUser.tenantId && typeof currentUser.tenantId === 'object' 
      ? (currentUser.tenantId as any)._id 
      : currentUser.tenantId;

    // Extract user data from DTO
    const { email, password, name } = createContractorDto;

    // Check if contractor name already exists within this tenant
    const existingContractor = await this.contractorModel
      .byTenant(landlordId)
      .findOne({ name })
      .exec();
    
    if (existingContractor) {
      throw new UnprocessableEntityException(
        `Contractor name '${name}' already exists in this organization`
      );
    }

    // Hash the password for the user account
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create the contractor first
    const contractorData = {
      name,
      tenantId: landlordId, // Enforce tenant boundary
    };

    // mongo-tenant: Create within tenant context
    const ContractorWithTenant = this.contractorModel.byTenant(landlordId);
    const newContractor = new ContractorWithTenant(contractorData);
    const savedContractor = await newContractor.save();

    // Create the user account for the contractor
    const userData = {
      username: email, // Use email as username
      email,
      password: hashedPassword,
      user_type: 'Contractor',
      party_id: savedContractor._id, // Link to the contractor
      tenantId: landlordId, // Set tenant context
    };

    // mongo-tenant: Create user within tenant context
    const UserWithTenant = this.userModel.byTenant(landlordId);
    const newUser = new UserWithTenant(userData);
    await newUser.save();

    return savedContractor;
  }

  async update(id: string, updateContractorDto: UpdateContractorDto, currentUser: UserDocument) {
    // CASL: Check update permission
    const ability = this.caslAuthorizationService.createAbilityForUser(currentUser);

    // Ensure user has tenant context
    if (!currentUser.tenantId) {
      throw new ForbiddenException('Cannot update contractor: No tenant context');
    }

    const landlordId = currentUser.tenantId && typeof currentUser.tenantId === 'object' 
      ? (currentUser.tenantId as any)._id 
      : currentUser.tenantId;

    // First, get the contractor to check permissions
    const contractor = await this.contractorModel
      .byTenant(landlordId)
      .findById(id)
      .exec();

    if (!contractor) {
      throw new NotFoundException(`Contractor with ID ${id} not found`);
    }

    // CASL: Check if user can update this specific contractor
    if (!ability.can(Action.Update, contractor)) {
      throw new ForbiddenException('You do not have permission to update this contractor');
    }

    // Prevent modification of tenantId (tenant boundary)
    const { ...allowedUpdates } = updateContractorDto;

    // Check for name uniqueness if name is being updated
    if (allowedUpdates.name && allowedUpdates.name !== contractor.name) {
      const existingContractor = await this.contractorModel
        .byTenant(landlordId)
        .findOne({
          name: allowedUpdates.name,
          _id: { $ne: id } // Exclude current contractor
        })
        .exec();
      
      if (existingContractor) {
        throw new UnprocessableEntityException(
          `Contractor name '${allowedUpdates.name}' already exists in this organization`
        );
      }
    }

    // mongo-tenant: Update within tenant context
    const updatedContractor = await this.contractorModel
      .byTenant(landlordId)
      .findByIdAndUpdate(id, allowedUpdates, { new: true })
      .exec();

    if (!updatedContractor) {
      throw new NotFoundException(`Contractor with ID ${id} not found`);
    }

    return updatedContractor;
  }

  async remove(id: string, currentUser: UserDocument) {
    // CASL: Check delete permission
    const ability = this.caslAuthorizationService.createAbilityForUser(currentUser);

    // Ensure user has tenant context
    if (!currentUser.tenantId) {
      throw new ForbiddenException('Cannot delete contractor: No tenant context');
    }

    const landlordId = currentUser.tenantId && typeof currentUser.tenantId === 'object' 
      ? (currentUser.tenantId as any)._id 
      : currentUser.tenantId;

    // First, get the contractor to check permissions
    const contractor = await this.contractorModel
      .byTenant(landlordId)
      .findById(id)
      .exec();

    if (!contractor) {
      throw new NotFoundException(`Contractor with ID ${id} not found`);
    }

    // CASL: Check if user can delete this specific contractor
    if (!ability.can(Action.Delete, contractor)) {
      throw new ForbiddenException('You do not have permission to delete this contractor');
    }

    // mongo-tenant: Soft delete within tenant context
    await this.contractorModel
      .byTenant(landlordId)
      .findByIdAndUpdate(id, { deleted: true, deletedAt: new Date() })
      .exec();
  }
}
