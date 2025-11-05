import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NestjsFormDataModule } from 'nestjs-form-data';
import { CaslModule } from '../../common/casl/casl.module';
import { SessionService } from '../../common/services/session.service';
import { Landlord, LandlordSchema } from '../landlords/schema/landlord.schema';
import { Lease, LeaseSchema } from '../leases/schemas/lease.schema';
import {
  MaintenanceTicket,
  MaintenanceTicketSchema,
} from '../maintenance/schemas/maintenance-ticket.schema';
import { MediaModule } from '../media/media.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { Property, PropertySchema } from '../properties/schemas/property.schema';
import { Unit, UnitSchema } from '../properties/schemas/unit.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { FeedPostsController } from './controllers/feed-posts.controller';
import { FeedPost, FeedPostSchema } from './schemas/feed-post.schema';
import { FeedPostsService } from './services/feed-posts.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: FeedPost.name, schema: FeedPostSchema },
      { name: Property.name, schema: PropertySchema },
      { name: Landlord.name, schema: LandlordSchema },
      { name: Unit.name, schema: UnitSchema },
      { name: MaintenanceTicket.name, schema: MaintenanceTicketSchema },
      { name: User.name, schema: UserSchema },
      { name: Lease.name, schema: LeaseSchema },
    ]),
    CaslModule,
    MediaModule,
    NotificationsModule,
    NestjsFormDataModule,
  ],
  controllers: [FeedPostsController],
  providers: [FeedPostsService, SessionService],
  exports: [FeedPostsService],
})
export class FeedPostsModule {}
