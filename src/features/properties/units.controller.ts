import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { CheckPolicies } from '../../common/casl/decorators/check-policies.decorator';
import { CaslGuard } from '../../common/casl/guards/casl.guard';
import {
  DeleteUnitPolicyHandler,
  ReadUnitPolicyHandler,
  UpdateUnitPolicyHandler,
} from '../../common/casl/policies/unit.policies';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { MongoIdValidationPipe } from '../../common/pipes/mongo-id-validation.pipe';
import { MediaType } from '../media/schemas/media.schema';
import { MediaService } from '../media/services/media.service';
import { User } from '../users/schemas/user.schema';
import { UnitQueryDto } from './dto/unit-query.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
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

  @Get()
  @CheckPolicies(new ReadUnitPolicyHandler())
  @ApiOperation({ summary: 'Get all units with pagination, filtering, and sorting' })
  findAll(@Query() queryDto: UnitQueryDto, @CurrentUser() user: User) {
    return this.unitsService.findAllPaginated(queryDto, user);
  }

  @Get(':id')
  @CheckPolicies(new ReadUnitPolicyHandler())
  @ApiOperation({ summary: 'Get unit by ID' })
  @ApiParam({ name: 'id', description: 'Unit ID', type: String })
  findOne(@Param('id', MongoIdValidationPipe) id: string, @CurrentUser() user: User) {
    return this.unitsService.findOne(id, user);
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
}
