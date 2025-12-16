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
  DeleteUnitPolicyHandler,
  ReadUnitPolicyHandler,
  UpdateUnitPolicyHandler,
} from '../../common/casl/policies/unit.policies';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { MongoIdValidationPipe } from '../../common/pipes/mongo-id-validation.pipe';
import { MediaType } from '../media/schemas/media.schema';
import { MediaService } from '../media/services/media.service';
import { User } from '../users/schemas/user.schema';
import { MarketplaceQueryDto } from './dto/marketplace-query.dto';
import { UnitQueryDto } from './dto/unit-query.dto';
import { UnitsOverviewStatsResponseDto } from './dto/units-overview-stats.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { UploadMediaDto } from './dto/upload-media.dto';
import { UnitsService } from './units.service';

@ApiTags('Units')
@ApiBearerAuth()
@UseGuards(CaslGuard)
@Controller('units')
export class UnitsController {
  constructor(
    private readonly unitsService: UnitsService,
    private readonly mediaService: MediaService,
  ) {}

  @Get('marketplace')
  @Public()
  @ApiOperation({ summary: 'Get all marketplace units' })
  @ApiResponse({
    status: 200,
    description: 'Marketplace units retrieved successfully',
  })
  findMarketplaceUnits(@Query() queryDto: MarketplaceQueryDto, @CurrentUser() user?: User) {
    return this.unitsService.findMarketplaceUnits(queryDto, user?._id?.toString());
  }

  @Get()
  @CheckPolicies(new ReadUnitPolicyHandler())
  @ApiOperation({ summary: 'Get all units with pagination, filtering, and sorting' })
  findAll(@Query() queryDto: UnitQueryDto, @CurrentUser() user: User) {
    return this.unitsService.findAllPaginated(queryDto, user);
  }

  @Get('stats/overview')
  @CheckPolicies(new ReadUnitPolicyHandler())
  @ApiOperation({ summary: 'Get overview statistics for all units' })
  @ApiResponse({
    status: 200,
    description: 'Units overview statistics retrieved successfully',
    type: UnitsOverviewStatsResponseDto,
  })
  getUnitsOverviewStats(@CurrentUser() user: User) {
    return this.unitsService.getUnitsOverviewStats(user);
  }

  @Get(':id')
  @CheckPolicies(new ReadUnitPolicyHandler())
  @ApiOperation({ summary: 'Get unit by ID' })
  @ApiParam({ name: 'id', description: 'Unit ID', type: String })
  findOne(@Param('id', MongoIdValidationPipe) id: string, @CurrentUser() user: User) {
    return this.unitsService.findOne(id, user);
  }

  @Get(':id/stats')
  @CheckPolicies(new ReadUnitPolicyHandler())
  @ApiOperation({ summary: 'Get unit statistics and KPIs' })
  @ApiParam({ name: 'id', description: 'Unit ID', type: String })
  getUnitStats(@Param('id', MongoIdValidationPipe) id: string, @CurrentUser() user: User) {
    return this.unitsService.getUnitStats(id, user);
  }

  @Patch(':id')
  @CheckPolicies(new UpdateUnitPolicyHandler())
  @ApiOperation({ summary: 'Update unit details' })
  @ApiParam({ name: 'id', description: 'Unit ID', type: String })
  @ApiBody({ type: UpdateUnitDto })
  update(
    @Param('id', MongoIdValidationPipe) id: string,
    @Body() updateUnitDto: UpdateUnitDto,
    @CurrentUser() user: User,
  ) {
    return this.unitsService.update(id, updateUnitDto, user);
  }

  @Delete(':id')
  @CheckPolicies(new DeleteUnitPolicyHandler())
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a unit' })
  @ApiParam({ name: 'id', description: 'Unit ID', type: String })
  remove(@Param('id', MongoIdValidationPipe) id: string, @CurrentUser() user: User) {
    return this.unitsService.remove(id, user);
  }

  @Get(':id/media')
  @CheckPolicies(new ReadUnitPolicyHandler())
  @ApiOperation({ summary: 'Get all media for a unit' })
  @ApiParam({ name: 'id', description: 'Unit ID', type: String })
  async getUnitMedia(
    @Param('id', MongoIdValidationPipe) unitId: string,
    @CurrentUser() user: User,
    @Query('media_type') mediaType?: MediaType,
    @Query('collection_name') collectionName?: string,
  ) {
    // First verify the unit exists and user has access
    await this.unitsService.findOne(unitId, user);

    const media = await this.mediaService.getMediaForEntity('Unit', unitId, user, collectionName, {
      media_type: mediaType,
    });

    return {
      success: true,
      data: media,
    };
  }

  @Post(':id/media/upload')
  @CheckPolicies(new CreateMediaPolicyHandler())
  @FormDataRequest()
  @ApiOperation({ summary: 'Upload media to unit' })
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'id', description: 'Unit ID', type: String })
  @ApiBody({ type: UploadMediaDto })
  @ApiResponse({
    status: 201,
    description: 'Media uploaded successfully',
  })
  async uploadUnitMedia(
    @Param('id', MongoIdValidationPipe) unitId: string,
    @Body() uploadMediaDto: UploadMediaDto,
    @CurrentUser() user: User,
  ) {
    const unit = await this.unitsService.findOne(unitId, user);

    const media = await this.mediaService.upload(
      uploadMediaDto.file,
      unit,
      user,
      uploadMediaDto.collection_name || 'unit_photos',
      undefined,
      'Unit',
    );

    return {
      success: true,
      data: media,
      message: 'Media uploaded successfully',
    };
  }

  @Delete(':id/media/:mediaId')
  @CheckPolicies(new DeleteMediaPolicyHandler())
  @ApiOperation({ summary: 'Delete unit media' })
  @ApiParam({ name: 'id', description: 'Unit ID', type: String })
  @ApiParam({ name: 'mediaId', description: 'Media ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Media deleted successfully',
  })
  async deleteUnitMedia(
    @Param('id', MongoIdValidationPipe) unitId: string,
    @Param('mediaId', MongoIdValidationPipe) mediaId: string,
    @CurrentUser() user: User,
  ) {
    await this.unitsService.findOne(unitId, user);
    await this.mediaService.deleteMedia(mediaId, user);

    return {
      success: true,
      message: 'Media deleted successfully',
    };
  }

  @Get(':id/media/:mediaId/url')
  @CheckPolicies(new ReadUnitPolicyHandler())
  @ApiOperation({ summary: 'Get unit media URL' })
  @ApiParam({ name: 'id', description: 'Unit ID', type: String })
  @ApiParam({ name: 'mediaId', description: 'Media ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Media URL retrieved successfully',
  })
  async getUnitMediaUrl(
    @Param('id', MongoIdValidationPipe) unitId: string,
    @Param('mediaId', MongoIdValidationPipe) mediaId: string,
    @CurrentUser() user: User,
  ) {
    await this.unitsService.findOne(unitId, user);
    const media = await this.mediaService.findOne(mediaId, user);
    const url = await this.mediaService.getMediaUrl(media);

    return {
      success: true,
      data: { url },
    };
  }
}
