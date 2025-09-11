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
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
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
import { MediaService } from '../media/services/media.service';
import { MediaType } from '../media/schemas/media.schema';

@ApiTags('Properties')
@ApiBearerAuth()
@UseGuards(CaslGuard)
@Controller('properties')
export class PropertiesController {
  constructor(
    private readonly propertiesService: PropertiesService,
    private readonly unitsService: UnitsService,
    private readonly mediaService: MediaService,
  ) {}

  @Post()
  @CheckPolicies(new CreatePropertyPolicyHandler())
  @UseInterceptors(FilesInterceptor('media_files', 10)) // Allow up to 10 files
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Create a new property with optional media files' })
  @ApiBody({ type: CreatePropertyDto })
  async create(
    @CurrentUser() user: User,
    @Body() formData: any, // Raw form data
    @UploadedFiles() mediaFiles?: any[],
  ) {
    return this.propertiesService.create(formData, mediaFiles || [], user);
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
  findOne(
    @Param('id', MongoIdValidationPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.propertiesService.findOne(id, user);
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
    @CurrentUser() user: User,
    @Body() updatePropertyDto: UpdatePropertyDto,
  ) {
    return this.propertiesService.update(id, updatePropertyDto, user);
  }

  @Delete(':id')
  @CheckPolicies(new DeletePropertyPolicyHandler())
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete property by ID (soft delete)' })
  @ApiParam({ name: 'id', description: 'Property ID', type: String })
  remove(
    @Param('id', MongoIdValidationPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.propertiesService.remove(id, user);
  }

  @Post(':id/units')
  @CheckPolicies(new CreateUnitPolicyHandler())
  @UseInterceptors(FilesInterceptor('media_files', 10)) // Allow up to 10 files
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Add a unit to a property with optional media files' })
  @ApiParam({ name: 'id', description: 'Property ID', type: String })
  @ApiBody({ type: CreateUnitDto, description: 'Unit data to create' })
  addUnitToProperty(
    @Param('id', MongoIdValidationPipe) id: string,
    @Body() formData: any, 
    @UploadedFiles() mediaFiles: any[],
    @CurrentUser() user: User,
  ) {
    return this.unitsService.create(formData, mediaFiles || [], id, user);
  }

  @Get(':id/media')
  @CheckPolicies(new ReadPropertyPolicyHandler())
  @ApiOperation({ summary: 'Get all media for a property' })
  @ApiParam({ name: 'id', description: 'Property ID', type: String })
  async getPropertyMedia(
    @Param('id', MongoIdValidationPipe) propertyId: string,
    @CurrentUser() user: User,
    @Query('media_type') mediaType?: MediaType,
    @Query('collection_name') collectionName?: string,
  ) {
    // First verify the property exists and user has access
    await this.propertiesService.findOne(propertyId, user);
    
    const media = await this.mediaService.getMediaForEntity(
      'Property',
      propertyId,
      user,
      collectionName,
      { media_type: mediaType },
    );

    return {
      success: true,
      data: media,
    };
  }
}
