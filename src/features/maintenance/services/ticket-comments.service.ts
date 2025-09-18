import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { AppModel } from '../../../common/interfaces/app-model.interface';
import { MediaService } from '../../media/services/media.service';
import { UserDocument } from '../../users/schemas/user.schema';
import { CreateCommentDto } from '../dto';
import { MaintenanceTicket } from '../schemas/maintenance-ticket.schema';
import { TicketComment } from '../schemas/ticket-comment.schema';

@Injectable()
export class TicketCommentsService {
  constructor(
    @InjectModel(TicketComment.name)
    private readonly commentModel: AppModel<TicketComment>,
    @InjectModel(MaintenanceTicket.name)
    private readonly ticketModel: AppModel<MaintenanceTicket>,
    private readonly mediaService: MediaService,
  ) {}

  async create(
    ticketId: string,
    createCommentDto: CreateCommentDto,
    currentUser: UserDocument,
  ): Promise<any> {
    const tenantId = this.getTenantId(currentUser);

    if (!tenantId) {
      throw new ForbiddenException('Access denied: No tenant context');
    }

    const ticket = await this.validateTicketAccess(ticketId, currentUser, tenantId);

    const CommentWithTenant = this.commentModel.byTenant(tenantId);
    const newComment = new CommentWithTenant({
      ...createCommentDto,
      ticket: new Types.ObjectId(ticketId),
      author: currentUser._id,
    });

    const savedComment = await newComment.save();

    if (createCommentDto.media_files && createCommentDto.media_files.length > 0) {
      const uploadPromises = createCommentDto.media_files.map(async (file) => {
        return this.mediaService.upload(
          file,
          savedComment,
          currentUser,
          'comment_attachments',
          undefined,
          'TicketComment',
        );
      });

      const uploadedMedia = await Promise.all(uploadPromises);

      const media = await this.mediaService.getMediaForEntity(
        'TicketComment',
        savedComment._id.toString(),
        currentUser,
        undefined,
        {},
      );

      const populatedComment = await this.commentModel
        .byTenant(tenantId)
        .findById(savedComment._id)
        .populate('author', 'username email user_type')
        .exec();

      return {
        success: true,
        data: {
          comment: populatedComment,
          media: uploadedMedia,
        },
        message: `Comment created successfully with ${uploadedMedia.length} media file(s)`,
      };
    }

    const populatedComment = await this.commentModel
      .byTenant(tenantId)
      .findById(savedComment._id)
      .populate('author', 'username email user_type')
      .exec();

    return {
      success: true,
      data: { comment: populatedComment },
      message: 'Comment created successfully',
    };
  }

  async findAllForTicket(ticketId: string, currentUser: UserDocument): Promise<any[]> {
    const tenantId = this.getTenantId(currentUser);

    if (!tenantId) {
      throw new ForbiddenException('Access denied: No tenant context');
    }

    await this.validateTicketAccess(ticketId, currentUser, tenantId);

    const comments = await this.commentModel
      .byTenant(tenantId)
      .find({ ticket: ticketId })
      .sort({ createdAt: 1 })
      .populate('author', 'username email user_type')
      .exec();

    const commentsWithMedia = await Promise.all(
      comments.map(async (comment) => {
        const media = await this.mediaService.getMediaForEntity(
          'TicketComment',
          comment._id.toString(),
          currentUser,
          undefined,
          {},
        );
        return {
          ...comment.toObject(),
          media,
        };
      }),
    );

    return commentsWithMedia;
  }

  async update(
    commentId: string,
    updateData: Partial<CreateCommentDto>,
    currentUser: UserDocument,
  ): Promise<TicketComment> {
    const tenantId = this.getTenantId(currentUser);

    if (!tenantId) {
      throw new ForbiddenException('Access denied: No tenant context');
    }

    const comment = await this.commentModel.byTenant(tenantId).findById(commentId).exec();

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.author.toString() !== currentUser._id.toString()) {
      throw new ForbiddenException('You can only update your own comments');
    }

    Object.assign(comment, updateData);
    return await comment.save();
  }

  async remove(commentId: string, currentUser: UserDocument): Promise<{ message: string }> {
    const tenantId = this.getTenantId(currentUser);

    if (!tenantId) {
      throw new ForbiddenException('Access denied: No tenant context');
    }

    const comment = await this.commentModel.byTenant(tenantId).findById(commentId).exec();

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (
      comment.author.toString() !== currentUser._id.toString() &&
      currentUser.user_type !== 'Landlord'
    ) {
      throw new ForbiddenException('You can only delete your own comments');
    }

    await this.commentModel.byTenant(tenantId).findByIdAndDelete(commentId);
    return { message: 'Comment deleted successfully' };
  }

  // Helper Methods

  private async validateTicketAccess(
    ticketId: string,
    currentUser: UserDocument,
    tenantId: Types.ObjectId,
  ): Promise<MaintenanceTicket> {
    let query = this.ticketModel.byTenant(tenantId).findById(ticketId);

    // Apply access control based on user type
    if (currentUser.user_type === 'Tenant') {
      query = query.where({ tenant: currentUser.party_id });
    } else if (currentUser.user_type === 'Contractor') {
      query = query.where({ assignedContractor: currentUser.party_id });
    }

    const ticket = await query.exec();

    if (!ticket) {
      throw new NotFoundException('Ticket not found or access denied');
    }

    return ticket;
  }

  private getTenantId(currentUser: UserDocument): Types.ObjectId | null {
    if (!currentUser.tenantId) {
      return null;
    }

    if (typeof currentUser.tenantId === 'object') {
      return currentUser.tenantId as Types.ObjectId;
    }

    // Convert string to ObjectId
    return currentUser.tenantId;
  }
}
