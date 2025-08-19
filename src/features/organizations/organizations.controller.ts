import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { CheckPolicies } from '../../common/casl/decorators/check-policies.decorator';
import { CaslGuard } from '../../common/casl/guards/casl.guard';
import {
  CreateOrganizationPolicyHandler,
  DeleteOrganizationPolicyHandler,
  ReadOrganizationPolicyHandler,
  UpdateOrganizationPolicyHandler,
} from '../../common/casl/policies/organization.policies';
import { ReadUserPolicyHandler } from '../../common/casl/policies/user.policies';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { MongoIdValidationPipe } from '../../common/pipes/mongo-id-validation.pipe';
import { UserQueryDto } from '../users/dto/user-query.dto';
import { User } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { OrganizationQueryDto } from './dto/organization-query.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { OrganizationsService } from './organizations.service';

@ApiTags('Organizations')
@ApiBearerAuth('JWT-auth')
@UseGuards(CaslGuard)
@Controller('organizations')
export class OrganizationsController {
  constructor(
    private readonly organizationsService: OrganizationsService,
    private readonly usersService: UsersService,
  ) {}

  @Post()
  @CheckPolicies(new CreateOrganizationPolicyHandler())
  @ApiOperation({ summary: 'Create a new organization' })
  @ApiBody({ type: CreateOrganizationDto })
  async create(@Body() createOrganizationDto: CreateOrganizationDto) {
    return await this.organizationsService.create(createOrganizationDto);
  }

  @Get()
  @CheckPolicies(new ReadOrganizationPolicyHandler())
  @ApiOperation({ summary: 'Get all organizations with pagination, sorting and filtering' })
  async findAll(@CurrentUser() currentUser: User, @Query() queryDto: OrganizationQueryDto) {
    return await this.organizationsService.findAllPaginated(queryDto, currentUser);
  }

  @Get(':id')
  @CheckPolicies(new ReadOrganizationPolicyHandler())
  @ApiOperation({ summary: 'Get organization by ID' })
  @ApiParam({ name: 'id', description: 'Organization ID', type: String })
  async findOne(@Param('id', MongoIdValidationPipe) id: string) {
    const organization = await this.organizationsService.findOne(id);
    if (!organization) {
      throw new NotFoundException(`Organization with ID ${id} not found`);
    }
    return organization;
  }

  @Get(':id/users')
  @CheckPolicies(new ReadUserPolicyHandler())
  @ApiOperation({ summary: 'Get all users in an organization with pagination' })
  @ApiParam({ name: 'id', description: 'Organization ID', type: String })
  async getOrganizationUsers(
    @Param('id', MongoIdValidationPipe) id: string,
    @Query() queryDto: UserQueryDto,
    @CurrentUser() currentUser: User,
  ) {
    queryDto.organizationId = id;
    return await this.usersService.findAllPaginated(queryDto, currentUser);
  }

  @Patch(':id')
  @CheckPolicies(new UpdateOrganizationPolicyHandler())
  @ApiOperation({ summary: 'Update organization by ID' })
  @ApiParam({ name: 'id', description: 'Organization ID', type: String })
  @ApiBody({ type: UpdateOrganizationDto })
  async update(
    @Param('id', MongoIdValidationPipe) id: string,
    @Body() updateOrganizationDto: UpdateOrganizationDto,
  ) {
    return await this.organizationsService.update(id, updateOrganizationDto);
  }

  @Delete(':id')
  @CheckPolicies(new DeleteOrganizationPolicyHandler())
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete organization by ID' })
  @ApiParam({ name: 'id', description: 'Organization ID', type: String })
  async remove(@Param('id', MongoIdValidationPipe) id: string) {
    return await this.organizationsService.remove(id);
  }
}
