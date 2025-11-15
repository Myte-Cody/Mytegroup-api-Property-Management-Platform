import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationsModule } from '../notifications/notifications.module';
import { Property, PropertySchema } from '../properties/schemas/property.schema';
import { Unit, UnitSchema } from '../properties/schemas/unit.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { InquiriesController } from './inquiries.controller';
import { InquiriesService } from './inquiries.service';
import { Inquiry, InquirySchema } from './schemas/inquiry.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Inquiry.name, schema: InquirySchema },
      { name: Property.name, schema: PropertySchema },
      { name: Unit.name, schema: UnitSchema },
      { name: User.name, schema: UserSchema },
    ]),
    NotificationsModule,
  ],
  controllers: [InquiriesController],
  providers: [InquiriesService],
  exports: [InquiriesService, MongooseModule],
})
export class InquiriesModule {}
