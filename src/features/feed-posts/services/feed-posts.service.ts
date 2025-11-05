import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { AppModel } from '../../../common/interfaces/app-model.interface';
import { SessionService } from '../../../common/services/session.service';
import { createPaginatedResponse, PaginatedResponse } from '../../../common/utils/pagination.utils';
import { Landlord } from '../../landlords/schema/landlord.schema';
import { Lease } from '../../leases/schemas/lease.schema';
import { MediaService } from '../../media/services/media.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { Property } from '../../properties/schemas/property.schema';
import { User, UserDocument } from '../../users/schemas/user.schema';
import { CreateFeedPostDto } from '../dto/create-feed-post.dto';
import { FeedPostQueryDto } from '../dto/feed-post-query.dto';
import { UpdateFeedPostDto } from '../dto/update-feed-post.dto';
import { VotePollDto } from '../dto/vote-poll.dto';
import { VotePostDto, VoteType } from '../dto/vote-post.dto';
import { FeedPost, FeedPostDocument } from '../schemas/feed-post.schema';

@Injectable()
export class FeedPostsService {
  constructor(
    @InjectModel(FeedPost.name)
    private readonly feedPostModel: AppModel<FeedPost>,
    @InjectModel(Property.name)
    private readonly propertyModel: AppModel<Property>,
    @InjectModel(Landlord.name)
    private readonly landlordModel: AppModel<Landlord>,
    @InjectModel(User.name)
    private readonly userModel: AppModel<User>,
    @InjectModel(Lease.name)
    private readonly leaseModel: AppModel<Lease>,
    private readonly sessionService: SessionService,
    private readonly mediaService: MediaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Create a new feed post
   */
  async create(
    createFeedPostDto: CreateFeedPostDto,
    user: UserDocument,
  ): Promise<FeedPostDocument> {
    return this.sessionService.withSession(async (session) => {
      // Verify property exists
      const property = await this.propertyModel.findById(createFeedPostDto.property);
      if (!property) {
        throw new NotFoundException('Property not found');
      }

      // Get landlord from user
      const landlordId =
        user.organization_id && typeof user.organization_id === 'object'
          ? (user.organization_id as any)._id
          : user.organization_id;

      if (!landlordId) {
        throw new BadRequestException('User is not associated with a landlord');
      }

      // Create the feed post
      const feedPostData: any = {
        property: createFeedPostDto.property,
        landlord: landlordId,
        title: createFeedPostDto.title,
        description: createFeedPostDto.description,
      };

      // Add poll if provided
      if (createFeedPostDto.poll) {
        feedPostData.poll = {
          options: createFeedPostDto.poll.options.map((optionText) => ({
            text: optionText,
            votes: 0,
            voters: [],
          })),
          allowMultipleVotes: createFeedPostDto.poll.allowMultipleVotes || false,
        };
      }

      const feedPost = new this.feedPostModel(feedPostData);
      const savedFeedPost = await feedPost.save({ session });

      // Handle media file if provided
      if (createFeedPostDto.media_file) {
        await this.mediaService.upload(
          createFeedPostDto.media_file,
          savedFeedPost,
          user,
          'default',
          undefined,
          'FeedPost',
          session,
        );
      }

      // Notify tenants of the property about new feed post
      await this.notifyTenantsOfNewFeedPost(savedFeedPost, property);

      return savedFeedPost;
    });
  }

  /**
   * Get all feed posts with pagination and filtering
   */
  async findAll(queryDto: FeedPostQueryDto, user: UserDocument): Promise<PaginatedResponse<any>> {
    const query: any = {};

    // Filter by property if provided
    if (queryDto.property) {
      query.property = queryDto.property;
    }

    // Filter by multiple properties if provided
    if (queryDto.properties && queryDto.properties.length > 0) {
      query.property = { $in: queryDto.properties };
    }

    // Search in title and description
    if (queryDto.search) {
      query.$or = [
        { title: { $regex: queryDto.search, $options: 'i' } },
        { description: { $regex: queryDto.search, $options: 'i' } },
      ];
    }

    const skip = (queryDto.page - 1) * queryDto.limit;
    const sortField = queryDto.sortBy || 'createdAt';
    const sortOrder = queryDto.sortOrder === 'asc' ? 1 : -1;

    const [feedPosts, total] = await Promise.all([
      this.feedPostModel
        .find(query)
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(queryDto.limit)
        .populate('property', 'name address')
        .populate('landlord', 'companyName')
        .exec(),
      this.feedPostModel.countDocuments(query).exec(),
    ]);

    // Enrich feed posts with media
    const enrichedFeedPosts = await Promise.all(
      feedPosts.map(async (post) => {
        const media = await this.mediaService.getMediaForEntity(
          'FeedPost',
          post._id.toString(),
          user,
        );
        return {
          ...post.toObject(),
          media: media.length > 0 ? media[0] : undefined,
        };
      }),
    );

    return createPaginatedResponse(enrichedFeedPosts, total, queryDto.page, queryDto.limit);
  }

  /**
   * Get a single feed post by ID
   */
  async findOne(id: string, user: UserDocument): Promise<any> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid feed post ID');
    }

    const feedPost = await this.feedPostModel
      .findById(id)
      .populate('property', 'name address')
      .populate('landlord', 'companyName')
      .exec();

    if (!feedPost) {
      throw new NotFoundException('Feed post not found');
    }

    // Get media
    const media = await this.mediaService.getMediaForEntity(
      'FeedPost',
      feedPost._id.toString(),
      user,
    );

    return {
      ...feedPost.toObject(),
      media: media.length > 0 ? media[0] : undefined,
    };
  }

  /**
   * Update a feed post
   */
  async update(
    id: string,
    updateFeedPostDto: UpdateFeedPostDto,
    user: UserDocument,
  ): Promise<FeedPostDocument> {
    return this.sessionService.withSession(async (session) => {
      if (!Types.ObjectId.isValid(id)) {
        throw new BadRequestException('Invalid feed post ID');
      }

      const feedPost = await this.feedPostModel.findById(id);
      if (!feedPost) {
        throw new NotFoundException('Feed post not found');
      }

      // Update fields
      if (updateFeedPostDto.title !== undefined) {
        feedPost.title = updateFeedPostDto.title;
      }
      if (updateFeedPostDto.description !== undefined) {
        feedPost.description = updateFeedPostDto.description;
      }

      // Update poll if provided
      if (updateFeedPostDto.poll) {
        feedPost.poll = {
          options: updateFeedPostDto.poll.options.map((optionText) => ({
            text: optionText,
            votes: 0,
            voters: [],
            _id: new Types.ObjectId(),
          })) as any,
          allowMultipleVotes: updateFeedPostDto.poll.allowMultipleVotes || false,
        };
      }

      const updatedFeedPost = await feedPost.save({ session });

      // Handle media file if provided
      if (updateFeedPostDto.media_file) {
        // Delete old media
        const existingMedia = await this.mediaService.getMediaForEntity(
          'FeedPost',
          feedPost._id.toString(),
          user,
        );
        for (const media of existingMedia) {
          await this.mediaService.deleteMedia(media._id.toString(), user);
        }

        // Upload new media
        await this.mediaService.upload(
          updateFeedPostDto.media_file,
          feedPost,
          user,
          'default',
          undefined,
          'FeedPost',
          session,
        );
      }

      // Notify tenants of the property about feed post update
      const property = await this.propertyModel.findById(feedPost.property);
      if (property) {
        await this.notifyTenantsOfFeedPostUpdate(feedPost, property);
      }

      return updatedFeedPost;
    });
  }

  /**
   * Delete a feed post (soft delete)
   */
  async remove(id: string, user: UserDocument): Promise<void> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid feed post ID');
    }

    const feedPost = await this.feedPostModel.findById(id);
    if (!feedPost) {
      throw new NotFoundException('Feed post not found');
    }

    await (feedPost as any).delete();
  }

  /**
   * Vote on a feed post (upvote/downvote)
   */
  async votePost(
    id: string,
    votePostDto: VotePostDto,
    user: UserDocument,
  ): Promise<FeedPostDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid feed post ID');
    }

    const feedPost = await this.feedPostModel.findById(id);
    if (!feedPost) {
      throw new NotFoundException('Feed post not found');
    }

    const userId = user._id as Types.ObjectId;

    // Remove existing votes
    const upvoteIndex = feedPost.upvotedBy.findIndex((id) => (id as Types.ObjectId).equals(userId));
    const downvoteIndex = feedPost.downvotedBy.findIndex((id) =>
      (id as Types.ObjectId).equals(userId),
    );

    if (upvoteIndex !== -1) {
      feedPost.upvotedBy.splice(upvoteIndex, 1);
      feedPost.upvotes = Math.max(0, feedPost.upvotes - 1);
    }
    if (downvoteIndex !== -1) {
      feedPost.downvotedBy.splice(downvoteIndex, 1);
      feedPost.downvotes = Math.max(0, feedPost.downvotes - 1);
    }

    // Apply new vote
    if (votePostDto.voteType === VoteType.UPVOTE) {
      feedPost.upvotedBy.push(userId);
      feedPost.upvotes += 1;
    } else if (votePostDto.voteType === VoteType.DOWNVOTE) {
      feedPost.downvotedBy.push(userId);
      feedPost.downvotes += 1;
    }
    // If REMOVE, we just removed the votes above

    return await feedPost.save();
  }

  /**
   * Vote on a poll option
   */
  async votePoll(
    id: string,
    votePollDto: VotePollDto,
    user: UserDocument,
  ): Promise<FeedPostDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid feed post ID');
    }

    const feedPost = await this.feedPostModel.findById(id);
    if (!feedPost) {
      throw new NotFoundException('Feed post not found');
    }

    if (!feedPost.poll) {
      throw new BadRequestException('This feed post does not have a poll');
    }

    const userId = user._id as Types.ObjectId;

    // Check if user has already voted
    const hasVoted = feedPost.poll.options.some((option) =>
      option.voters.some((voterId) => (voterId as Types.ObjectId).equals(userId)),
    );

    if (hasVoted && !feedPost.poll.allowMultipleVotes) {
      // Remove previous votes
      feedPost.poll.options.forEach((option) => {
        const voterIndex = option.voters.findIndex((voterId) =>
          (voterId as Types.ObjectId).equals(userId),
        );
        if (voterIndex !== -1) {
          option.voters.splice(voterIndex, 1);
          option.votes = Math.max(0, option.votes - 1);
        }
      });
    }

    // Add new votes

    const option = feedPost.poll.options.find(
      (opt) =>
        opt._id && (opt._id as Types.ObjectId).equals(new Types.ObjectId(votePollDto.optionId)),
    );
    if (!option) {
      throw new BadRequestException(`Poll option ${votePollDto.optionId} not found`);
    }

    // Check if user already voted for this option
    const alreadyVoted = option.voters.some((voterId) =>
      (voterId as Types.ObjectId).equals(userId),
    );
    if (!alreadyVoted) {
      option.voters.push(userId);
      option.votes += 1;
    }

    return await feedPost.save();
  }

  /**
   * Get tenant users for a property
   */
  private async getTenantUsersForProperty(propertyId: Types.ObjectId): Promise<UserDocument[]> {
    try {
      // Get all active leases for the property
      const leases = await this.leaseModel
        .find({
          status: 'ACTIVE',
        })
        .populate('unit')
        .exec();

      // Filter leases for this property
      const propertyLeases = leases.filter((lease) => {
        const unit = lease.unit as any;
        return unit && unit.property && unit.property.toString() === propertyId.toString();
      });

      // Get unique tenant IDs
      const tenantIds = [...new Set(propertyLeases.map((lease) => lease.tenant.toString()))];

      // Get tenant users
      const tenantUsers = await this.userModel
        .find({
          user_type: 'Tenant',
          organization_id: { $in: tenantIds },
        })
        .exec();

      return tenantUsers;
    } catch (error) {
      console.error('Failed to get tenant users for property:', error);
      return [];
    }
  }

  /**
   * Notify tenants of new feed post
   */
  private async notifyTenantsOfNewFeedPost(
    feedPost: FeedPostDocument,
    property: any,
  ): Promise<void> {
    try {
      const tenantUsers = await this.getTenantUsersForProperty(feedPost.property as Types.ObjectId);

      const notificationPromises = tenantUsers.map((user) =>
        this.notificationsService.createNotification(
          user._id.toString(),
          'New Announcement',
          `📢 New announcement posted for ${property.name}: "${feedPost.title}"`,
        ),
      );

      await Promise.all(notificationPromises);
    } catch (error) {
      console.error('Failed to notify tenants of new feed post:', error);
    }
  }

  /**
   * Notify tenants of feed post update
   */
  private async notifyTenantsOfFeedPostUpdate(
    feedPost: FeedPostDocument,
    property: any,
  ): Promise<void> {
    try {
      const tenantUsers = await this.getTenantUsersForProperty(feedPost.property as Types.ObjectId);

      const notificationPromises = tenantUsers.map((user) =>
        this.notificationsService.createNotification(
          user._id.toString(),
          'Announcement Updated',
          `📝 An announcement for ${property.name} has been updated: "${feedPost.title}"`,
        ),
      );

      await Promise.all(notificationPromises);
    } catch (error) {
      console.error('Failed to notify tenants of feed post update:', error);
    }
  }
}
