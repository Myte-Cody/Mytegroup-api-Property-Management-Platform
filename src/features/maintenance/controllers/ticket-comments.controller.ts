import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiConsumes, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FormDataRequest } from 'nestjs-form-data';
import { MediaType } from '../../media/schemas/media.schema';
import { MediaService } from '../../media/services/media.service';
import { UserDocument } from '../../users/schemas/user.schema';
import { CreateCommentDto } from '../dto';
import { TicketCommentsService } from '../services/ticket-comments.service';

@ApiTags('Maintenance Ticket Comments')
@Controller('maintenance/tickets/:ticketId/comments')
export class TicketCommentsController {
  constructor(
    private readonly commentsService: TicketCommentsService,
    private readonly mediaService: MediaService,
  ) {}

  @Post()
  @FormDataRequest()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Add a comment to a maintenance ticket' })
  @ApiResponse({ status: 201, description: 'Comment created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  async create(
    @Param('ticketId') ticketId: string,
    @Body() createCommentDto: CreateCommentDto,
    @Req() req: { user: UserDocument },
  ) {
    return this.commentsService.create(ticketId, createCommentDto, req.user);
  }

  @Get()
  @ApiOperation({ summary: 'Get all comments for a maintenance ticket' })
  @ApiResponse({ status: 200, description: 'Comments retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  async findAll(@Param('ticketId') ticketId: string, @Req() req: { user: UserDocument }) {
    return this.commentsService.findAllForTicket(ticketId, req.user);
  }

  @Patch(':commentId')
  @ApiOperation({ summary: 'Update a comment' })
  @ApiResponse({ status: 200, description: 'Comment updated successfully' })
  @ApiResponse({ status: 403, description: 'You can only update your own comments' })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  async update(
    @Param('commentId') commentId: string,
    @Body() updateData: Partial<CreateCommentDto>,
    @Req() req: { user: UserDocument },
  ) {
    return this.commentsService.update(commentId, updateData, req.user);
  }

  @Delete(':commentId')
  @ApiOperation({ summary: 'Delete a comment' })
  @ApiResponse({ status: 200, description: 'Comment deleted successfully' })
  @ApiResponse({ status: 403, description: 'You can only delete your own comments' })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  async remove(@Param('commentId') commentId: string, @Req() req: { user: UserDocument }) {
    return this.commentsService.remove(commentId, req.user);
  }

  @Get(':commentId/media')
  @ApiOperation({ summary: 'Get all media for a comment' })
  @ApiParam({ name: 'commentId', description: 'Comment ID', type: String })
  async getCommentMedia(
    @Param('commentId') commentId: string,
    @Req() req: { user: UserDocument },
    @Query('media_type') mediaType?: MediaType,
    @Query('collection_name') collectionName?: string,
  ) {
    const media = await this.mediaService.getMediaForEntity(
      'TicketComment',
      commentId,
      req.user,
      collectionName,
      {
        media_type: mediaType,
      },
    );

    return {
      success: true,
      data: media,
    };
  }
}
