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
  findOne(
    @Param('id', MongoIdValidationPipe) id: string,
    @CurrentUser() user: User,
  ) {
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
  remove(
    @Param('id', MongoIdValidationPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.tenantsService.remove(id, user);
  }
}
