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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/authorization/decorators/roles.decorator';
import { RolesGuard } from '../../common/authorization/guards/roles.guard';
import { OrganizationType } from '../../common/enums/organization.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { MongoIdValidationPipe } from '../../common/pipes/mongo-id-validation.pipe';
import { CreatePropertyDto } from './dto/create-property.dto';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { PropertiesService } from './properties.service';
import { UnitsService } from './units.service';

@ApiTags('Properties')
@ApiBearerAuth()
@Controller('properties')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PropertiesController {
  constructor(
    private readonly propertiesService: PropertiesService,
    private readonly unitsService: UnitsService,
  ) {}

  @Post()
  @Roles(OrganizationType.LANDLORD)
  @ApiOperation({ summary: 'Create a new property' })
  @ApiBody({ type: CreatePropertyDto, description: 'Property data to create' })
  create(@Body() createPropertyDto: CreatePropertyDto) {
    return this.propertiesService.create(createPropertyDto);
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
  @ApiOperation({ summary: 'Update property by ID' })
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
