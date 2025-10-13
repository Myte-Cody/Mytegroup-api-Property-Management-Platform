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
import { User } from '../users/schemas/user.schema';
import { ContractorsService } from './contractors.service';
import { ContractorQueryDto } from './dto/contractor-query.dto';
import { ContractorResponseDto } from './dto/contractor-response.dto';
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
}
