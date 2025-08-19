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
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PropertyOwner } from '../../common/authorization/decorators/property-owner.decorator';
import { Roles } from '../../common/authorization/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { OrganizationType } from '../../common/enums/organization.enum';
import { MongoIdValidationPipe } from '../../common/pipes/mongo-id-validation.pipe';
import { OptionalMongoIdValidationPipe } from '../../common/pipes/optional-mongo-id-validation.pipe';

import { User } from '../users/schemas/user.schema';
import { CreatePropertyDto } from './dto/create-property.dto';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { PropertiesService } from './properties.service';
import { UnitsService } from './units.service';

@ApiTags('Properties')
@ApiBearerAuth()
@Controller('properties')
export class PropertiesController {
  constructor(
    private readonly propertiesService: PropertiesService,
    private readonly unitsService: UnitsService,
  ) {}

  @Post()
  @Roles(OrganizationType.LANDLORD)
  @ApiOperation({ summary: 'Create a new property' })
  @ApiBody({ type: CreatePropertyDto, description: 'Property data to create' })
  create(@CurrentUser() user: User, @Body() createPropertyDto: CreatePropertyDto) {
    return this.propertiesService.create(createPropertyDto, user.organization._id);
  }

  @Get('by-landlord')
  @Roles(OrganizationType.LANDLORD)
  @ApiOperation({ summary: 'Get properties by landlord' })
  @ApiQuery({
    name: 'landlordId',
    required: false,
    description: 'Filter properties by landlord/owner ID',
    type: String,
  })
  findByLandlord(
    @CurrentUser() user: User,
    @Query('landlordId', OptionalMongoIdValidationPipe) landlordId?: string,
  ) {
    return this.propertiesService.findByLandlord(landlordId || user.organization._id.toString());
  }

  @Get()
  @ApiOperation({ summary: 'Get all properties' })
  findAll() {
    return this.propertiesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get property by ID' })
  @ApiParam({ name: 'id', description: 'Property ID', type: String })
  findOne(@Param('id', MongoIdValidationPipe) id: string) {
    return this.propertiesService.findOne(id);
  }

  @Patch(':id')
  @Roles(OrganizationType.LANDLORD)
  @PropertyOwner()
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
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete property by ID (soft delete)' })
  @ApiParam({ name: 'id', description: 'Property ID', type: String })
  remove(@Param('id', MongoIdValidationPipe) id: string) {
    return this.propertiesService.remove(id);
  }

  @Post(':id/units')
  @Roles(OrganizationType.LANDLORD)
  @PropertyOwner()
  @ApiOperation({ summary: 'Add a unit to a property' })
  @ApiParam({ name: 'id', description: 'Property ID', type: String })
  @ApiBody({ type: CreateUnitDto, description: 'Unit data to create' })
  addUnitToProperty(
    @Param('id', MongoIdValidationPipe) id: string,
    @Body() createUnitDto: CreateUnitDto,
  ) {
    return this.unitsService.create(createUnitDto, id);
  }
}
