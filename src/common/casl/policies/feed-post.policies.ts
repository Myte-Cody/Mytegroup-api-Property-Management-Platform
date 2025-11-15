import { Injectable } from '@nestjs/common';
import { FeedPost } from '../../../features/feed-posts/schemas/feed-post.schema';
import { User } from '../../../features/users/schemas/user.schema';
import { Action, AppAbility } from '../casl-ability.factory';
import { IPolicyHandler } from '../guards/casl.guard';

@Injectable()
export class ReadFeedPostPolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User, feedPost?: FeedPost): boolean {
    if (feedPost) return ability.can(Action.Read, feedPost);
    return ability.can(Action.Read, FeedPost);
  }
}

@Injectable()
export class CreateFeedPostPolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User): boolean {
    return ability.can(Action.Create, FeedPost);
  }
}

@Injectable()
export class UpdateFeedPostPolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User, feedPost?: FeedPost): boolean {
    if (feedPost) return ability.can(Action.Update, feedPost);
    return ability.can(Action.Update, FeedPost);
  }
}

@Injectable()
export class DeleteFeedPostPolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User, feedPost?: FeedPost): boolean {
    if (feedPost) return ability.can(Action.Delete, feedPost);
    return ability.can(Action.Delete, FeedPost);
  }
}

@Injectable()
export class ManageFeedPostPolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User, feedPost?: FeedPost): boolean {
    if (feedPost) return ability.can(Action.Manage, feedPost);
    return ability.can(Action.Manage, FeedPost);
  }
}
