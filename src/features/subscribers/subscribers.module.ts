import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Subscriber, SubscriberSchema } from './schemas/subscriber.schema';
import { SubscribersService } from './subscribers.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: Subscriber.name, schema: SubscriberSchema }])],
  providers: [SubscribersService],
  exports: [SubscribersService],
})
export class SubscribersModule {}
