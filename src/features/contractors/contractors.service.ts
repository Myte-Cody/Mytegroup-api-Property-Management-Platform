import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import mongoose, { ClientSession } from 'mongoose';
import { Action } from '../../common/casl/casl-ability.factory';
import { CaslAuthorizationService } from '../../common/casl/services/casl-authorization.service';
import { TicketStatus } from '../../common/enums/maintenance.enum';
import { UserType } from '../../common/enums/user-type.enum';
import { AppModel } from '../../common/interfaces/app-model.interface';
import { SessionService } from '../../common/services/session.service';
import { createPaginatedResponse, PaginatedResponse } from '../../common/utils/pagination.utils';
import { MaintenanceTicket } from '../maintenance/schemas/maintenance-ticket.schema';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { UpdateUserDto } from '../users/dto/update-user.dto';
import { UserQueryDto } from '../users/dto/user-query.dto';
import { User, UserDocument } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';
import { ContractorQueryDto, PaginatedContractorsResponse } from './dto/contractor-query.dto';
import { ContractorResponseDto } from './dto/contractor-response.dto';
import { CreateContractorUserDto } from './dto/create-contractor-user.dto';
import { CreateContractorDto } from './dto/create-contractor.dto';
import { UpdateContractorDto } from './dto/update-contractor.dto';
import { Contractor } from './schema/contractor.schema';

@Injectable()
export class ContractorsService {
  constructor(
    @InjectModel(Contractor.name)
    private readonly contractorModel: AppModel<Contractor>,
    @InjectModel(User.name)
    private readonly userModel: AppModel<User>,
    @InjectModel(MaintenanceTicket.name)
    private readonly maintenanceTicketModel: AppModel<MaintenanceTicket>,
    private caslAuthorizationService: CaslAuthorizationService,
    private readonly usersService: UsersService,
    private readonly sessionService: SessionService,
  ) {}

  /**
   * Transform contractor document with associated user data to match CreateContractorDto structure
   */
  private async transformContractorToResponse(contractor: any): Promise<ContractorResponseDto> {
    // Find the user associated with this contractor
    const user = await this.userModel
      .findOne({
        organization_id: contractor._id,
        user_type: UserType.CONTRACTOR,
      })
      .exec();

    if (!user) {
      throw new NotFoundException(
        `User account not found for contractor ${contractor.name} (ID: ${contractor._id})`,
      );
    }

    // Calculate active tickets count (all statuses except CLOSED)
    const activeTicketsCount = await this.maintenanceTicketModel
      .countDocuments({
        assignedContractor: contractor._id,
        status: { $ne: TicketStatus.CLOSED },
      })
      .exec();

    // Calculate completed tickets count (DONE and CLOSED statuses)
    const completedTicketsCount = await this.maintenanceTicketModel
      .countDocuments({
        assignedContractor: contractor._id,
        status: { $in: [TicketStatus.DONE, TicketStatus.CLOSED] },
      })
      .exec();

    return {
      _id: contractor._id.toString(),
      name: contractor.name,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      userId: user._id.toString(),
      category: contractor.category,
      createdAt: contractor.createdAt,
      updatedAt: contractor.updatedAt,
      activeTicketsCount,
      completedTicketsCount,
    };
  }

  async findAllPaginated(
    queryDto: ContractorQueryDto,
    currentUser: UserDocument,
  ): Promise<PaginatedContractorsResponse<ContractorResponseDto>> {
    // Contractor users should not be able to list other contractors - only access their own profile
    if (currentUser.user_type === 'Contractor') {
      throw new ForbiddenException(
        'Contractor users cannot access the contractor list. Use /contractors/me to access your own profile.',
      );
    }

    const { page = 1, limit = 10, search, sortBy = 'createdAt', sortOrder = 'desc' } = queryDto;

    // STEP 1: CASL - Check if user can read contractors
    const ability = this.caslAuthorizationService.createAbilityForUser(currentUser);

    if (!ability.can(Action.Read, Contractor)) {
      throw new ForbiddenException('You do not have permission to view contractors');
    }

    // Build query
    const query: any = {};
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    // Apply landlord filter if user is a landlord
    if (currentUser.user_type === 'Landlord' && currentUser.organization_id) {
      query.landlords = currentUser.organization_id;
    }

    // Apply sorting
    const sortOptions: any = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const skip = (page - 1) * limit;

    // Execute queries in parallel for better performance
    const [contractors, total] = await Promise.all([
      this.contractorModel.find(query).sort(sortOptions).skip(skip).limit(limit).exec(),
      this.contractorModel.countDocuments(query).exec(),
    ]);

    // Transform contractors to include user data
    const transformedContractors = await Promise.all(
      contractors.map((contractor) => this.transformContractorToResponse(contractor)),
    );

    return createPaginatedResponse<ContractorResponseDto>(
      transformedContractors,
      total,
      page,
      limit,
    );
  }

  async findOne(id: string, currentUser: UserDocument): Promise<ContractorResponseDto> {
    // Contractor users should only access their own profile via /contractors/me
    if (currentUser.user_type === 'Contractor') {
      throw new ForbiddenException(
        'Contractor users cannot access other contractor records. Use /contractors/me to access your own profile.',
      );
    }

    // CASL: Check read permission
    const ability = this.caslAuthorizationService.createAbilityForUser(currentUser);

    if (!ability.can(Action.Read, Contractor)) {
      throw new ForbiddenException('You do not have permission to view contractors');
    }

    const contractor = await this.contractorModel.findById(id).exec();

    if (!contractor) {
      throw new NotFoundException(`Contractor with ID ${id} not found`);
    }

    // For landlords, verify they have access to this specific contractor
    if (currentUser.user_type === 'Landlord' && currentUser.organization_id) {
      const landlordId = currentUser.organization_id.toString();
      const hasAccess = contractor.landlords?.some((id) => id.toString() === landlordId);
      if (!hasAccess) {
        throw new ForbiddenException('You do not have permission to view this contractor');
      }
    }

    // CASL: Final permission check on the specific record
    if (!ability.can(Action.Read, contractor)) {
      throw new ForbiddenException('You do not have permission to view this contractor');
    }

    return this.transformContractorToResponse(contractor);
  }

  async findMyProfile(currentUser: UserDocument): Promise<ContractorResponseDto> {
    // Only contractor users can access their own profile
    if (currentUser.user_type !== 'Contractor') {
      throw new ForbiddenException('Only contractor users can access this endpoint');
    }

    // CASL: Check read permission
    const ability = this.caslAuthorizationService.createAbilityForUser(currentUser);

    if (!ability.can(Action.Read, Contractor)) {
      throw new ForbiddenException('You do not have permission to view contractor profile');
    }

    const contractorId = currentUser.organization_id;
    if (!contractorId) {
      throw new ForbiddenException('No contractor profile associated with this user');
    }

    const contractor = await this.contractorModel.findById(contractorId).exec();

    if (!contractor) {
      throw new NotFoundException('Contractor profile not found');
    }

    // CASL: Final permission check on the specific record
    if (!ability.can(Action.Read, contractor)) {
      throw new ForbiddenException('You do not have permission to view this contractor profile');
    }

    return this.transformContractorToResponse(contractor);
  }

  async create(createContractorDto: CreateContractorDto, currentUser: UserDocument) {
    // CASL: Check create permission
    const ability = this.caslAuthorizationService.createAbilityForUser(currentUser);

    if (!ability.can(Action.Create, Contractor)) {
      throw new ForbiddenException('You do not have permission to create contractors');
    }

    // Extract user data from DTO
    const { email, password, name, username, firstName, lastName, phone, profilePicture } =
      createContractorDto;

    // Check if contractor name already exists within this tenant
    const existingContractor = await this.contractorModel.findOne({ name }).exec();

    if (existingContractor) {
      throw new UnprocessableEntityException(
        `Contractor name '${name}' already exists in this organization`,
      );
    }

    // Hash the password for the user account
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    return await this.sessionService.withSession(async (session: ClientSession | null) => {
      // Create the contractor first
      const contractorData = {
        name,
      };

      const newContractor = new this.contractorModel(contractorData);
      const savedContractor = await newContractor.save({ session });

      // Create the user account for the contractor
      const userData: any = {
        username,
        firstName,
        lastName,
        email,
        phone,
        password: hashedPassword,
        user_type: UserType.CONTRACTOR,
        organization_id: savedContractor._id, // Link to the contractor
      };

      if (profilePicture) {
        userData.profilePicture = profilePicture;
      }

      const newUser = new this.userModel(userData);
      await newUser.save({ session });

      return savedContractor;
    });
  }

  async createFromInvitation(
    createContractorDto: CreateContractorDto,
    landlordId?: string,
    session?: ClientSession,
  ) {
    // Extract user data from DTO
    const { email, password, name, category, username, firstName, lastName, phone } =
      createContractorDto;

    // Check if contractor name already exists within this tenant
    const existingContractor = await this.contractorModel.findOne({ name }).exec();

    if (existingContractor) {
      throw new UnprocessableEntityException(
        `Contractor name '${name}' already exists in this organization`,
      );
    }

    // Create contractor
    const contractorData: any = {
      name,
      category,
      landlords: landlordId ? [new mongoose.Types.ObjectId(landlordId)] : [],
    };

    const newContractor = new this.contractorModel(contractorData);
    const savedContractor = await newContractor.save({ session: session ?? null });

    // Create user account (without current user context for invitations)
    const userData = {
      username,
      email,
      phone,
      password,
      firstName,
      lastName,
      user_type: UserType.CONTRACTOR,
      organization_id: savedContractor._id.toString(),
    };

    await this.usersService.createFromInvitation(userData, session);

    return savedContractor;
  }

  async addLandlordToContractor(contractorId: string, landlordId: string, session?: ClientSession) {
    const contractor = await this.contractorModel.findById(contractorId).exec();

    if (!contractor) {
      throw new NotFoundException(`Contractor with ID ${contractorId} not found`);
    }

    // Add landlord ID if not already present
    const landlordObjectId = new mongoose.Types.ObjectId(landlordId);
    const landlordExists = contractor.landlords?.some((id) => id.equals(landlordObjectId));

    if (!landlordExists) {
      await this.contractorModel
        .findByIdAndUpdate(
          contractorId,
          { $addToSet: { landlords: landlordObjectId } },
          { session: session ?? null },
        )
        .exec();
    }

    return contractor;
  }

  async removeLandlordFromContractor(
    contractorId: string,
    landlordId: string,
    currentUser: UserDocument,
  ) {
    const contractor = await this.contractorModel.findById(contractorId).exec();

    if (!contractor) {
      throw new NotFoundException(`Contractor with ID ${contractorId} not found`);
    }

    // Only landlords can remove themselves from contractor
    if (currentUser.user_type !== 'Landlord') {
      throw new ForbiddenException('Only landlords can remove contractors from their organization');
    }

    // Verify the landlord is removing their own ID
    const currentLandlordId = currentUser.organization_id?.toString();
    if (currentLandlordId !== landlordId) {
      throw new ForbiddenException('You can only remove yourself from contractor associations');
    }

    // Remove landlord ID from contractor's landlords array
    const landlordObjectId = new mongoose.Types.ObjectId(landlordId);
    await this.contractorModel
      .findByIdAndUpdate(contractorId, { $pull: { landlords: landlordObjectId } })
      .exec();

    return { message: 'Contractor removed from your organization successfully' };
  }

  async findContractorByUserEmail(email: string): Promise<Contractor | null> {
    const user = await this.userModel
      .findOne({
        email: email.toLowerCase(),
        user_type: UserType.CONTRACTOR,
      })
      .exec();

    if (!user || !user.organization_id) {
      return null;
    }

    return this.contractorModel.findById(user.organization_id).exec();
  }

  async update(id: string, updateContractorDto: UpdateContractorDto, currentUser: UserDocument) {
    // CASL: Check update permission
    const ability = this.caslAuthorizationService.createAbilityForUser(currentUser);

    // First, get the contractor to check permissions
    const contractor = await this.contractorModel.findById(id).exec();

    if (!contractor) {
      throw new NotFoundException(`Contractor with ID ${id} not found`);
    }

    // CASL: Check if user can update this specific contractor
    if (!ability.can(Action.Update, contractor)) {
      throw new ForbiddenException('You do not have permission to update this contractor');
    }

    const allowedUpdates = updateContractorDto;

    // Check for name uniqueness if name is being updated
    if (allowedUpdates.name && allowedUpdates.name !== contractor.name) {
      const existingContractor = await this.contractorModel
        .findOne({
          name: allowedUpdates.name,
          _id: { $ne: id }, // Exclude current contractor
        })
        .exec();

      if (existingContractor) {
        throw new UnprocessableEntityException(
          `Contractor name '${allowedUpdates.name}' already exists in this organization`,
        );
      }
    }

    const updatedContractor = await this.contractorModel
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

    // First, get the contractor to check permissions
    const contractor = await this.contractorModel.findById(id).exec();

    if (!contractor) {
      throw new NotFoundException(`Contractor with ID ${id} not found`);
    }

    // CASL: Check if user can delete this specific contractor
    if (!ability.can(Action.Delete, contractor)) {
      throw new ForbiddenException('You do not have permission to delete this contractor');
    }

    await this.contractorModel
      .findByIdAndUpdate(id, { deleted: true, deletedAt: new Date() })
      .exec();
  }

  // Contractor Users Management Methods
  async findContractorUsers(
    contractorId: string,
    queryDto: UserQueryDto,
    currentUser: UserDocument,
  ): Promise<PaginatedResponse<User>> {
    // Validate contractor exists and user has access
    await this.validateContractorAccess(contractorId, currentUser, Action.Read);

    // Create a modified query that filters for this contractor's users
    const contractorUserQuery: UserQueryDto = {
      ...queryDto,
      user_type: UserType.CONTRACTOR,
      organization_id: contractorId, // Add organization_id to the query
    };

    // Use UserService for consistent business logic and CASL authorization
    return await this.usersService.findAllPaginated(contractorUserQuery, currentUser);
  }

  async createContractorUser(
    contractorId: string,
    createContractorUserDto: CreateContractorUserDto,
    currentUser: UserDocument,
  ) {
    // Validate contractor exists and user has access
    await this.validateContractorAccess(contractorId, currentUser, Action.Create);

    // Create user using UsersService with contractor-specific data
    const userData: CreateUserDto = {
      username: createContractorUserDto.username,
      firstName: createContractorUserDto.firstName,
      lastName: createContractorUserDto.lastName,
      email: createContractorUserDto.email,
      phone: createContractorUserDto.phone,
      password: createContractorUserDto.password,
      user_type: UserType.CONTRACTOR,
      organization_id: contractorId,
      isPrimary: createContractorUserDto.isPrimary,
    };

    return await this.usersService.create(userData);
  }

  async updateContractorUser(
    contractorId: string,
    userId: string,
    updateUserDto: UpdateUserDto,
    currentUser: UserDocument,
  ) {
    // Validate contractor exists and user has access
    await this.validateContractorAccess(contractorId, currentUser, Action.Update);

    await this.validateUserBelongsToContractor(userId, contractorId, currentUser);

    return await this.usersService.update(userId, updateUserDto);
  }

  async removeContractorUser(contractorId: string, userId: string, currentUser: UserDocument) {
    await this.validateContractorAccess(contractorId, currentUser, Action.Delete);

    await this.validateUserBelongsToContractor(userId, contractorId, currentUser);

    return await this.usersService.remove(userId);
  }

  // Helper method to validate contractor access
  private async validateContractorAccess(
    contractorId: string,
    currentUser: UserDocument,
    action: Action,
  ) {
    // Check CASL permissions
    const ability = this.caslAuthorizationService.createAbilityForUser(currentUser);

    if (!ability.can(action, Contractor)) {
      throw new ForbiddenException(
        `You do not have permission to ${action.toLowerCase()} contractor users`,
      );
    }

    // Verify the contractor exists and user has access
    const contractor = await this.contractorModel.findById(contractorId).exec();

    if (!contractor) {
      throw new NotFoundException(`Contractor with ID ${contractorId} not found`);
    }

    // For contractor users, ensure they can only access their own contractor's users
    if (currentUser.user_type === 'Contractor') {
      if (currentUser.organization_id?.toString() !== contractorId) {
        throw new ForbiddenException('You can only manage users within your own contractor');
      }
    }

    return contractor;
  }

  // Helper method to validate that a user belongs to a specific contractor
  private async validateUserBelongsToContractor(
    userId: string,
    contractorId: string,
    currentUser: UserDocument,
  ) {
    // Validation: Ensure userId is a valid ObjectId format
    if (!userId.match(/^[0-9a-fA-F]{24}$/)) {
      throw new UnprocessableEntityException('Invalid user ID format');
    }

    // Find and verify the user belongs to the contractor
    const user = await this.userModel
      .findOne({
        _id: userId,
        user_type: 'Contractor',
        organization_id: contractorId,
      })
      .exec();

    if (!user) {
      throw new NotFoundException('User not found or does not belong to this contractor');
    }

    return user;
  }
}
