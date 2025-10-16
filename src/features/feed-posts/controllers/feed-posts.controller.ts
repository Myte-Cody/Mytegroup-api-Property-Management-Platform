import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FormDataRequest } from 'nestjs-form-data';
import { CheckPolicies } from '../../../common/casl/decorators/check-policies.decorator';
import { CaslGuard } from '../../../common/casl/guards/casl.guard';
import {
  CreateFeedPostPolicyHandler,
  DeleteFeedPostPolicyHandler,
  ReadFeedPostPolicyHandler,
  UpdateFeedPostPolicyHandler,
} from '../../../common/casl/policies/feed-post.policies';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { UserDocument } from '../../users/schemas/user.schema';
import { CreateFeedPostDto } from '../dto/create-feed-post.dto';
import { FeedPostQueryDto } from '../dto/feed-post-query.dto';
import { UpdateFeedPostDto } from '../dto/update-feed-post.dto';
import { VotePollDto } from '../dto/vote-poll.dto';
import { VotePostDto } from '../dto/vote-post.dto';
import { FeedPostsService } from '../services/feed-posts.service';

@ApiTags('Feed Posts')
@ApiBearerAuth()
@UseGuards(CaslGuard)
@Controller('feed-posts')
export class FeedPostsController {
  constructor(private readonly feedPostsService: FeedPostsService) {}

  @Post()
  @CheckPolicies(new CreateFeedPostPolicyHandler())
  @FormDataRequest()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Create a new feed post',
    description: 'Landlords can create feed posts for their properties',
  })
  create(@Body() createFeedPostDto: CreateFeedPostDto, @CurrentUser() user: UserDocument) {
    return this.feedPostsService.create(createFeedPostDto, user);
  }

  @Get()
  @CheckPolicies(new ReadFeedPostPolicyHandler())
  @ApiOperation({
    summary: 'Get all feed posts',
    description: 'Get all feed posts with optional filtering by property',
  })
  findAll(@Query() queryDto: FeedPostQueryDto, @CurrentUser() user: UserDocument) {
    return this.feedPostsService.findAll(queryDto, user);
  }

  @Get(':id')
  @CheckPolicies(new ReadFeedPostPolicyHandler())
  @ApiOperation({
    summary: 'Get a feed post by ID',
    description: 'Get a single feed post with all details',
  })
  findOne(@Param('id') id: string, @CurrentUser() user: UserDocument) {
    return this.feedPostsService.findOne(id, user);
  }

  @Patch(':id')
  @CheckPolicies(new UpdateFeedPostPolicyHandler())
  @FormDataRequest()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Update a feed post',
    description: 'Landlords can update their feed posts',
  })
  update(
    @Param('id') id: string,
    @Body() updateFeedPostDto: UpdateFeedPostDto,
    @CurrentUser() user: UserDocument,
  ) {
    return this.feedPostsService.update(id, updateFeedPostDto, user);
  }

  @Delete(':id')
  @CheckPolicies(new DeleteFeedPostPolicyHandler())
  @ApiOperation({
    summary: 'Delete a feed post',
    description: 'Landlords can delete their feed posts (soft delete)',
  })
  remove(@Param('id') id: string, @CurrentUser() user: UserDocument) {
    return this.feedPostsService.remove(id, user);
  }

  @Post(':id/vote')
  @CheckPolicies(new UpdateFeedPostPolicyHandler())
  @ApiOperation({
    summary: 'Vote on a feed post',
    description: 'Users can upvote or downvote feed posts',
  })
  votePost(
    @Param('id') id: string,
    @Body() votePostDto: VotePostDto,
    @CurrentUser() user: UserDocument,
  ) {
    return this.feedPostsService.votePost(id, votePostDto, user);
  }

  @Post(':id/poll/vote')
  @CheckPolicies(new UpdateFeedPostPolicyHandler())
  @ApiOperation({
    summary: 'Vote on a poll',
    description: 'Users can vote on poll options in feed posts',
  })
  votePoll(
    @Param('id') id: string,
    @Body() votePollDto: VotePollDto,
    @CurrentUser() user: UserDocument,
  ) {
    return this.feedPostsService.votePoll(id, votePollDto, user);
  }
}
