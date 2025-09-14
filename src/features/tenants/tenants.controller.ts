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
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { CheckPolicies } from '../../common/casl/decorators/check-policies.decorator';
import { CaslGuard } from '../../common/casl/guards/casl.guard';
import {
  CreateTenantPolicyHandler,
  DeleteTenantPolicyHandler,
  ReadTenantPolicyHandler,
  UpdateTenantPolicyHandler,
} from '../../common/casl/policies/tenant.policies';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { MongoIdValidationPipe } from '../../common/pipes/mongo-id-validation.pipe';
import { User } from '../users/schemas/user.schema';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { UpdateUserDto } from '../users/dto/update-user.dto';
import { UserQueryDto } from '../users/dto/user-query.dto';
import { CreateTenantUserDto } from './dto/create-tenant-user.dto';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { TenantQueryDto } from './dto/tenant-query.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { TenantsService } from './tenants.service';

@ApiTags('Tenants')
@ApiBearerAuth()
@UseGuards(CaslGuard)
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  @CheckPolicies(new CreateTenantPolicyHandler())
  @ApiOperation({ summary: 'Create a new tenant' })
  @ApiBody({ type: CreateTenantDto, description: 'Tenant data to create' })
  create(@CurrentUser() user: User, @Body() createTenantDto: CreateTenantDto) {
    return this.tenantsService.create(createTenantDto, user);
  }

  @Get()
  @CheckPolicies(new ReadTenantPolicyHandler())
  @ApiOperation({ summary: 'Get all tenants' })
  findAll(@Query() queryDto: TenantQueryDto, @CurrentUser() user: User) {
    return this.tenantsService.findAllPaginated(queryDto, user);
  }

  @Get('me')
  @CheckPolicies(new ReadTenantPolicyHandler())
  @ApiOperation({ summary: 'Get my tenant profile (tenants only)' })
  findMyProfile(@CurrentUser() user: User) {
    return this.tenantsService.findMyProfile(user);
  }

  @Get(':id')
  @CheckPolicies(new ReadTenantPolicyHandler())
  @ApiOperation({ summary: 'Get tenant by ID' })
  @ApiParam({ name: 'id', description: 'Tenant ID', type: String })
  findOne(@Param('id', MongoIdValidationPipe) id: string, @CurrentUser() user: User) {
    return this.tenantsService.findOne(id, user);
  }

  @Patch(':id')
  @CheckPolicies(new UpdateTenantPolicyHandler())
  @ApiOperation({ summary: 'Update tenant by ID (landlords only)' })
  @ApiParam({ name: 'id', description: 'Tenant ID', type: String })
  @ApiBody({
    type: UpdateTenantDto,
    description: 'Fields to update on the tenant. All fields are optional.',
  })
  update(
    @Param('id', MongoIdValidationPipe) id: string,
    @CurrentUser() user: User,
    @Body() updateTenantDto: UpdateTenantDto,
  ) {
    return this.tenantsService.update(id, updateTenantDto, user);
  }

  @Delete(':id')
  @CheckPolicies(new DeleteTenantPolicyHandler())
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete tenant by ID (soft delete)' })
  @ApiParam({ name: 'id', description: 'Tenant ID', type: String })
  remove(@Param('id', MongoIdValidationPipe) id: string, @CurrentUser() user: User) {
    return this.tenantsService.remove(id, user);
  }

  // Tenant Users Management Endpoints
  @Get(':id/users')
  @CheckPolicies(new ReadTenantPolicyHandler())
  @ApiOperation({ summary: 'Get all users belonging to a tenant' })
  @ApiParam({ name: 'id', description: 'Tenant ID', type: String })
  findTenantUsers(
    @Param('id', MongoIdValidationPipe) id: string,
    @Query() queryDto: UserQueryDto,
    @CurrentUser() user: User,
  ) {
    return this.tenantsService.findTenantUsers(id, queryDto, user);
  }

  @Post(':id/users')
  @CheckPolicies(new CreateTenantPolicyHandler())
  @ApiOperation({ summary: 'Create a new user for a tenant' })
  @ApiParam({ name: 'id', description: 'Tenant ID', type: String })
  @ApiBody({ type: CreateTenantUserDto, description: 'Tenant user data to create' })
  createTenantUser(
    @Param('id', MongoIdValidationPipe) id: string,
    @CurrentUser() user: User,
    @Body() createTenantUserDto: CreateTenantUserDto,
  ) {
    return this.tenantsService.createTenantUser(id, createTenantUserDto, user);
  }

  @Patch(':id/users/:userId')
  @CheckPolicies(new UpdateTenantPolicyHandler())
  @ApiOperation({ summary: 'Update a tenant user' })
  @ApiParam({ name: 'id', description: 'Tenant ID', type: String })
  @ApiParam({ name: 'userId', description: 'User ID', type: String })
  @ApiBody({ type: UpdateUserDto, description: 'User data to update' })
  updateTenantUser(
    @Param('id', MongoIdValidationPipe) id: string,
    @Param('userId', MongoIdValidationPipe) userId: string,
    @CurrentUser() user: User,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.tenantsService.updateTenantUser(id, userId, updateUserDto, user);
  }

  @Delete(':id/users/:userId')
  @CheckPolicies(new DeleteTenantPolicyHandler())
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a tenant user (soft delete)' })
  @ApiParam({ name: 'id', description: 'Tenant ID', type: String })
  @ApiParam({ name: 'userId', description: 'User ID', type: String })
  removeTenantUser(
    @Param('id', MongoIdValidationPipe) id: string,
    @Param('userId', MongoIdValidationPipe) userId: string,
    @CurrentUser() user: User,
  ) {
    return this.tenantsService.removeTenantUser(id, userId, user);
  }
}
