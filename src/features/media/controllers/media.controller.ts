import {
  Controller,
  Get,
  Param,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { CheckPolicies } from '../../../common/casl/decorators/check-policies.decorator';
import { CaslGuard } from '../../../common/casl/guards/casl.guard';
import {
  ReadMediaPolicyHandler,
} from '../../../common/casl/policies/media.policies';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { User } from '../../users/schemas/user.schema';
import { StorageDisk } from '../schemas/media.schema';
import { MediaService } from '../services/media.service';


@Controller('media')
@UseGuards(CaslGuard)
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}



  @Get(':id')
  @CheckPolicies(new ReadMediaPolicyHandler())
  async getMedia(@Param('id') id: string, @CurrentUser() user: User) {
    const media = await this.mediaService.findOne(id, user);
    return {
      success: true,
      data: media,
    };
  }


  @Get(':id/download')
  @CheckPolicies(new ReadMediaPolicyHandler())
  async downloadMedia(@Param('id') id: string, @CurrentUser() user: User, @Res() res: Response) {
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

}
