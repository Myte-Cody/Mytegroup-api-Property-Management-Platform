import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UseInterceptors,
  UploadedFile,
  Body,
  UseGuards,
  Query,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { MediaService } from '../services/media.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CaslGuard } from '../../../common/casl/guards/casl.guard';
import { CheckPolicies } from '../../../common/casl/decorators/check-policies.decorator';
import {
  CreateMediaPolicyHandler,
  ReadMediaPolicyHandler,
  DeleteMediaPolicyHandler,
} from '../../../common/casl/policies/media.policies';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { User } from '../../users/schemas/user.schema';
import { MediaType, StorageDisk } from '../schemas/media.schema';

interface UploadMediaDto {
  model_type: string;
  model_id: string;
  media_type: MediaType;
  name?: string;
  collection_name?: string;
  disk?: StorageDisk;
}

@Controller('media')
@UseGuards(JwtAuthGuard, CaslGuard)
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('upload')
  @CheckPolicies(new CreateMediaPolicyHandler())
  @UseInterceptors(FileInterceptor('file'))
  async uploadMedia(
    @UploadedFile() file: any,
    @Body() uploadDto: UploadMediaDto,
    @CurrentUser() user: User,
  ) {
    const media = await this.mediaService.upload(file, uploadDto, user);
    return {
      success: true,
      data: media,
      message: 'Media uploaded successfully',
    };
  }

  @Get('entity/:model_type/:model_id')
  @CheckPolicies(new ReadMediaPolicyHandler())
  async getMediaForEntity(
    @Param('model_type') model_type: string,
    @Param('model_id') model_id: string,
    @CurrentUser() user: User,
    @Query('media_type') media_type?: MediaType,
    @Query('collection_name') collection_name?: string,
  ) {
    const media = await this.mediaService.getMediaForEntity(
      model_type,
      model_id,
      user,
      collection_name,
      { media_type },
    );
    return {
      success: true,
      data: media,
    };
  }

  @Get(':id')
  @CheckPolicies(new ReadMediaPolicyHandler())
  async getMedia(@Param('id') id: string, @CurrentUser() user: User) {
    const media = await this.mediaService.findOne(id, user);
    return {
      success: true,
      data: media,
    };
  }

  @Get(':id/url')
  @CheckPolicies(new ReadMediaPolicyHandler())
  async getMediaUrl(@Param('id') id: string, @CurrentUser() user: User) {
    const media = await this.mediaService.findOne(id, user);
    const url = await this.mediaService.getMediaUrl(media);
    return {
      success: true,
      data: { url },
    };
  }

  @Get(':id/download')
  @CheckPolicies(new ReadMediaPolicyHandler())
  async downloadMedia(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Res() res: Response,
  ) {
    const media = await this.mediaService.findOne(id, user);
    const url = await this.mediaService.getMediaUrl(media);
    
    // For local storage, serve the file directly
    if (media.disk === StorageDisk.LOCAL) {
      res.sendFile(media.path, { root: '' });
    } else {
      // For remote storage, redirect to the URL
      res.redirect(url);
    }
  }

  @Delete(':id')
  @CheckPolicies(new DeleteMediaPolicyHandler())
  async deleteMedia(@Param('id') id: string, @CurrentUser() user: User) {
    await this.mediaService.deleteMedia(id, user);
    return {
      success: true,
      message: 'Media deleted successfully',
    };
  }
}
