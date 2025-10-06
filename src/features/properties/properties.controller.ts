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
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FormDataRequest } from 'nestjs-form-data';
import { CheckPolicies } from '../../common/casl/decorators/check-policies.decorator';
import { CaslGuard } from '../../common/casl/guards/casl.guard';
import {
  CreateMediaPolicyHandler,
  DeleteMediaPolicyHandler,
} from '../../common/casl/policies/media.policies';
import {
  CreatePropertyPolicyHandler,
  DeletePropertyPolicyHandler,
  ReadPropertyPolicyHandler,
  UpdatePropertyPolicyHandler,
} from '../../common/casl/policies/property.policies';
import { CreateUnitPolicyHandler } from '../../common/casl/policies/unit.policies';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { MongoIdValidationPipe } from '../../common/pipes/mongo-id-validation.pipe';

import { MediaType } from '../media/schemas/media.schema';
import { MediaService } from '../media/services/media.service';
import { User } from '../users/schemas/user.schema';
import { CreatePropertyDto } from './dto/create-property.dto';
import { CreateUnitDto } from './dto/create-unit.dto';
import { PropertyQueryDto } from './dto/property-query.dto';
import { PropertyStatisticsDto } from './dto/property-statistics.dto';
import { UnitQueryDto } from './dto/unit-query.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { UploadMediaDto } from './dto/upload-media.dto';
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
    private readonly mediaService: MediaService,
  ) {}

  @Post()
  @CheckPolicies(new CreatePropertyPolicyHandler())
  @FormDataRequest()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Create a new property with optional media files' })
  async create(@CurrentUser() user: User, @Body() createPropertyDto: CreatePropertyDto) {
    return this.propertiesService.create(createPropertyDto, user);
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

  @Get(':id/statistics')
  @CheckPolicies(new ReadPropertyPolicyHandler())
  @ApiOperation({ summary: 'Get comprehensive statistics for a property' })
  @ApiParam({ name: 'id', description: 'Property ID', type: String })
  @ApiResponse({ status: 200, type: PropertyStatisticsDto })
  async getPropertyStatistics(
    @Param('id', MongoIdValidationPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.unitsService.getPropertyStatistics(id, user);
  }

  @Get(':id')
  @CheckPolicies(new ReadPropertyPolicyHandler())
  @ApiOperation({ summary: 'Get property by ID' })
  @ApiParam({ name: 'id', description: 'Property ID', type: String })
  findOne(@Param('id', MongoIdValidationPipe) id: string, @CurrentUser() user: User) {
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
  remove(@Param('id', MongoIdValidationPipe) id: string, @CurrentUser() user: User) {
    return this.propertiesService.remove(id, user);
  }

  @Post(':id/units')
  @CheckPolicies(new CreateUnitPolicyHandler())
  @FormDataRequest()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Add a unit to a property with optional media files' })
  @ApiParam({ name: 'id', description: 'Property ID', type: String })
  addUnitToProperty(
    @Param('id', MongoIdValidationPipe) id: string,
    @Body() createUnitDto: CreateUnitDto,
    @CurrentUser() user: User,
  ) {
    return this.unitsService.create(createUnitDto, id, user);
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

  @Post(':id/media/upload')
  @CheckPolicies(new CreateMediaPolicyHandler())
  @FormDataRequest()
  @ApiOperation({ summary: 'Upload media to property' })
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'id', description: 'Property ID', type: String })
  @ApiBody({ type: UploadMediaDto })
  @ApiResponse({
    status: 201,
    description: 'Media uploaded successfully',
  })
  async uploadPropertyMedia(
    @Param('id', MongoIdValidationPipe) propertyId: string,
    @Body() uploadMediaDto: UploadMediaDto,
    @CurrentUser() user: User,
  ) {
    const property = await this.propertiesService.findOne(propertyId, user);

    const media = await this.mediaService.upload(
      uploadMediaDto.file,
      property,
      user,
      uploadMediaDto.collection_name || 'property_photos',
      undefined,
      'Property',
    );

    return {
      success: true,
      data: media,
      message: 'Media uploaded successfully',
    };
  }

  @Delete(':id/media/:mediaId')
  @CheckPolicies(new DeleteMediaPolicyHandler())
  @ApiOperation({ summary: 'Delete property media' })
  @ApiParam({ name: 'id', description: 'Property ID', type: String })
  @ApiParam({ name: 'mediaId', description: 'Media ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Media deleted successfully',
  })
  async deletePropertyMedia(
    @Param('id', MongoIdValidationPipe) propertyId: string,
    @Param('mediaId', MongoIdValidationPipe) mediaId: string,
    @CurrentUser() user: User,
  ) {
    await this.propertiesService.findOne(propertyId, user);
    await this.mediaService.deleteMedia(mediaId, user);

    return {
      success: true,
      message: 'Media deleted successfully',
    };
  }

  @Get(':id/media/:mediaId/url')
  @CheckPolicies(new ReadPropertyPolicyHandler())
  @ApiOperation({ summary: 'Get property media URL' })
  @ApiParam({ name: 'id', description: 'Property ID', type: String })
  @ApiParam({ name: 'mediaId', description: 'Media ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Media URL retrieved successfully',
  })
  async getPropertyMediaUrl(
    @Param('id', MongoIdValidationPipe) propertyId: string,
    @Param('mediaId', MongoIdValidationPipe) mediaId: string,
    @CurrentUser() user: User,
  ) {
    await this.propertiesService.findOne(propertyId, user);
    const media = await this.mediaService.findOne(mediaId, user);
    const url = await this.mediaService.getMediaUrl(media);

    return {
      success: true,
      data: { url },
    };
  }
}
