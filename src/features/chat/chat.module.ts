import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ThreadMessage, ThreadMessageSchema } from '../maintenance/schemas/thread-message.schema';
import {
  ThreadParticipant,
  ThreadParticipantSchema,
} from '../maintenance/schemas/thread-participant.schema';
import { Thread, ThreadSchema } from '../maintenance/schemas/thread.schema';
import { MediaModule } from '../media/media.module';
import { Media, MediaSchema } from '../media/schemas/media.schema';
import { NotificationsModule } from '../notifications/notifications.module';
import { Tenant, TenantSchema } from '../tenants/schema/tenant.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { ChatGateway } from './chat.gateway';
import { ChatController } from './controllers/chat.controller';
import { ChatService } from './services/chat.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Thread.name, schema: ThreadSchema },
      { name: ThreadMessage.name, schema: ThreadMessageSchema },
      { name: ThreadParticipant.name, schema: ThreadParticipantSchema },
      { name: User.name, schema: UserSchema },
      { name: Tenant.name, schema: TenantSchema },
      { name: Media.name, schema: MediaSchema },
    ]),
    MediaModule,
    NotificationsModule,
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway],
  exports: [ChatService, ChatGateway],
})
export class ChatModule {}
