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
  CreatePropertyPolicyHandler,
  DeletePropertyPolicyHandler,
  ReadPropertyPolicyHandler,
  UpdatePropertyPolicyHandler,
} from '../../common/casl/policies/property.policies';
import { CreateUnitPolicyHandler } from '../../common/casl/policies/unit.policies';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { MongoIdValidationPipe } from '../../common/pipes/mongo-id-validation.pipe';

import { User } from '../users/schemas/user.schema';
import { CreatePropertyDto } from './dto/create-property.dto';
import { CreateUnitDto } from './dto/create-unit.dto';
import { PropertyQueryDto } from './dto/property-query.dto';
import { UnitQueryDto } from './dto/unit-query.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { PropertiesService } from './properties.service';
import { UnitsService } from './units.service';

@ApiTags('Properties')
@ApiBearerAuth()
@UseGuards(CaslGuard)
@Controller('properties')
export class PropertiesController {
  constructor(
    private readonly propertiesService: PropertiesService,
    private readonly unitsService: UnitsService,
  ) {}

  @Post()
  @CheckPolicies(new CreatePropertyPolicyHandler())
  @ApiOperation({ summary: 'Create a new property' })
  @ApiBody({ type: CreatePropertyDto, description: 'Property data to create' })
  create(@CurrentUser() user: User, @Body() createPropertyDto: CreatePropertyDto) {
    return this.propertiesService.create(createPropertyDto);
  }

  @Get()
  @CheckPolicies(new ReadPropertyPolicyHandler())
  @ApiOperation({ summary: 'Get all properties' })
  findAll(@Query() queryDto: PropertyQueryDto, @CurrentUser() user: User) {
    return this.propertiesService.findAllPaginated(queryDto, user);
  }

  @Get(':id/units')
  @CheckPolicies(new ReadPropertyPolicyHandler())
  @ApiOperation({ summary: 'Get all units for a property with pagination, filtering, and sorting' })
  @ApiParam({ name: 'id', description: 'Property ID', type: String })
  getUnitsByPropertyId(
    @Param('id', MongoIdValidationPipe) id: string,
    @Query() queryDto: UnitQueryDto,
    @CurrentUser() user: User,
  ) {
    queryDto.propertyId = id;
    return this.unitsService.findAllPaginated(queryDto, user);
  }

  @Get(':id')
  @CheckPolicies(new ReadPropertyPolicyHandler())
  @ApiOperation({ summary: 'Get property by ID' })
  @ApiParam({ name: 'id', description: 'Property ID', type: String })
  findOne(@Param('id', MongoIdValidationPipe) id: string) {
    return this.propertiesService.findOne(id);
  }

  @Patch(':id')
  @CheckPolicies(new UpdatePropertyPolicyHandler())
  @ApiOperation({ summary: 'Update property by ID (landlords only)' })
  @ApiParam({ name: 'id', description: 'Property ID', type: String })
  @ApiBody({
    type: UpdatePropertyDto,
    description: 'Fields to update on the property. All fields are optional.',
  })
  update(
    @Param('id', MongoIdValidationPipe) id: string,
    @Body() updatePropertyDto: UpdatePropertyDto,
  ) {
    return this.propertiesService.update(id, updatePropertyDto);
  }

  @Delete(':id')
  @CheckPolicies(new DeletePropertyPolicyHandler())
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete property by ID (soft delete)' })
  @ApiParam({ name: 'id', description: 'Property ID', type: String })
  remove(@Param('id', MongoIdValidationPipe) id: string) {
    return this.propertiesService.remove(id);
  }

  @Post(':id/units')
  @CheckPolicies(new CreateUnitPolicyHandler())
  @ApiOperation({ summary: 'Add a unit to a property' })
  @ApiParam({ name: 'id', description: 'Property ID', type: String })
  @ApiBody({ type: CreateUnitDto, description: 'Unit data to create' })
  addUnitToProperty(
    @Param('id', MongoIdValidationPipe) id: string,
    @Body() createUnitDto: CreateUnitDto,
    @CurrentUser() user: User,
  ) {
    return this.unitsService.create(createUnitDto, id, user);
  }
}
