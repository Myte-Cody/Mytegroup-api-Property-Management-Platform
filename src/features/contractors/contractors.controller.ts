import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CheckPolicies } from '../../common/casl/decorators/check-policies.decorator';
import { CaslGuard } from '../../common/casl/guards/casl.guard';
import {
  CreateContractorPolicyHandler,
  DeleteContractorPolicyHandler,
  ReadContractorPolicyHandler,
  UpdateContractorPolicyHandler,
} from '../../common/casl/policies/contractor.policies';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { MongoIdValidationPipe } from '../../common/pipes/mongo-id-validation.pipe';
import { UpdateUserDto } from '../users/dto/update-user.dto';
import { UserQueryDto } from '../users/dto/user-query.dto';
import { User } from '../users/schemas/user.schema';
import { ContractorsService } from './contractors.service';
import { ContractorQueryDto } from './dto/contractor-query.dto';
import { ContractorResponseDto } from './dto/contractor-response.dto';
import { CreateContractorUserDto } from './dto/create-contractor-user.dto';
import { CreateContractorDto } from './dto/create-contractor.dto';
import { UpdateContractorDto } from './dto/update-contractor.dto';

@ApiTags('Contractors')
@ApiBearerAuth()
@UseGuards(CaslGuard)
@Controller('contractors')
export class ContractorsController {
  constructor(private readonly contractorsService: ContractorsService) {}

  @Post()
  @CheckPolicies(new CreateContractorPolicyHandler())
  @ApiOperation({ summary: 'Create a new contractor' })
  @ApiBody({ type: CreateContractorDto, description: 'Contractor data to create' })
  create(@CurrentUser() user: User, @Body() createContractorDto: CreateContractorDto) {
    return this.contractorsService.create(createContractorDto, user);
  }

  @Get()
  @CheckPolicies(new ReadContractorPolicyHandler())
  @ApiOperation({ summary: 'Get all contractors' })
  @ApiOkResponse({
    description: 'Paginated list of contractors with user data',
    type: ContractorResponseDto,
    isArray: true,
  })
  findAll(@Query() queryDto: ContractorQueryDto, @CurrentUser() user: User) {
    return this.contractorsService.findAllPaginated(queryDto, user);
  }

  @Get('me')
  @CheckPolicies(new ReadContractorPolicyHandler())
  @ApiOperation({ summary: 'Get my contractor profile (contractors only)' })
  @ApiOkResponse({
    description: 'Contractor profile with user data',
    type: ContractorResponseDto,
  })
  findMyProfile(@CurrentUser() user: User) {
    return this.contractorsService.findMyProfile(user);
  }

  @Get(':id')
  @CheckPolicies(new ReadContractorPolicyHandler())
  @ApiOperation({ summary: 'Get contractor by ID' })
  @ApiParam({ name: 'id', description: 'Contractor ID', type: String })
  @ApiOkResponse({
    description: 'Contractor details with user data',
    type: ContractorResponseDto,
  })
  findOne(@Param('id', MongoIdValidationPipe) id: string, @CurrentUser() user: User) {
    return this.contractorsService.findOne(id, user);
  }

  @Patch(':id')
  @CheckPolicies(new UpdateContractorPolicyHandler())
  @ApiOperation({ summary: 'Update contractor by ID (landlords only)' })
  @ApiParam({ name: 'id', description: 'Contractor ID', type: String })
  @ApiBody({
    type: UpdateContractorDto,
    description: 'Fields to update on the contractor. All fields are optional.',
  })
  update(
    @Param('id', MongoIdValidationPipe) id: string,
    @CurrentUser() user: User,
    @Body() updateContractorDto: UpdateContractorDto,
  ) {
    return this.contractorsService.update(id, updateContractorDto, user);
  }

  @Delete(':id')
  @CheckPolicies(new DeleteContractorPolicyHandler())
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete contractor by ID (soft delete)' })
  @ApiParam({ name: 'id', description: 'Contractor ID', type: String })
  remove(@Param('id', MongoIdValidationPipe) id: string, @CurrentUser() user: User) {
    return this.contractorsService.remove(id, user);
  }

  @Delete(':id/remove-from-organization')
  @CheckPolicies(new DeleteContractorPolicyHandler())
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Remove contractor from landlord organization (removes landlord ID from contractor landlords array)',
  })
  @ApiParam({ name: 'id', description: 'Contractor ID', type: String })
  removeFromOrganization(
    @Param('id', MongoIdValidationPipe) id: string,
    @CurrentUser() user: User,
  ) {
    const landlordId = user.organization_id?.toString();
    if (!landlordId) {
      throw new Error('User does not have an organization');
    }
    return this.contractorsService.removeLandlordFromContractor(id, landlordId, user);
  }

  // Contractor Users Management Endpoints
  @Get(':id/users')
  @CheckPolicies(new ReadContractorPolicyHandler())
  @ApiOperation({ summary: 'Get all users belonging to a contractor' })
  @ApiParam({ name: 'id', description: 'Contractor ID', type: String })
  findContractorUsers(
    @Param('id', MongoIdValidationPipe) id: string,
    @Query() queryDto: UserQueryDto,
    @CurrentUser() user: User,
  ) {
    return this.contractorsService.findContractorUsers(id, queryDto, user);
  }

  @Post(':id/users')
  @CheckPolicies(new CreateContractorPolicyHandler())
  @ApiOperation({ summary: 'Create a new user for a contractor' })
  @ApiParam({ name: 'id', description: 'Contractor ID', type: String })
  @ApiBody({ type: CreateContractorUserDto, description: 'Contractor user data to create' })
  createContractorUser(
    @Param('id', MongoIdValidationPipe) id: string,
    @CurrentUser() user: User,
    @Body() createContractorUserDto: CreateContractorUserDto,
  ) {
    return this.contractorsService.createContractorUser(id, createContractorUserDto, user);
  }

  @Patch(':id/users/:userId')
  @CheckPolicies(new UpdateContractorPolicyHandler())
  @ApiOperation({ summary: 'Update a contractor user' })
  @ApiParam({ name: 'id', description: 'Contractor ID', type: String })
  @ApiParam({ name: 'userId', description: 'User ID', type: String })
  @ApiBody({ type: UpdateUserDto, description: 'User data to update' })
  updateContractorUser(
    @Param('id', MongoIdValidationPipe) id: string,
    @Param('userId', MongoIdValidationPipe) userId: string,
    @CurrentUser() user: User,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.contractorsService.updateContractorUser(id, userId, updateUserDto, user);
  }

  @Delete(':id/users/:userId')
  @CheckPolicies(new DeleteContractorPolicyHandler())
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a contractor user (soft delete)' })
  @ApiParam({ name: 'id', description: 'Contractor ID', type: String })
  @ApiParam({ name: 'userId', description: 'User ID', type: String })
  removeContractorUser(
    @Param('id', MongoIdValidationPipe) id: string,
    @Param('userId', MongoIdValidationPipe) userId: string,
    @CurrentUser() user: User,
  ) {
    return this.contractorsService.removeContractorUser(id, userId, user);
  }
}
