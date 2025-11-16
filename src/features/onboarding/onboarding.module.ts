import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { InvitationsModule } from '../invitations/invitations.module';
import { Landlord, LandlordSchema } from '../landlords/schema/landlord.schema';
import { PropertiesModule } from '../properties/properties.module';
import { OnboardingController } from './onboarding.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Landlord.name, schema: LandlordSchema }]),
    PropertiesModule,
    InvitationsModule,
  ],
  controllers: [OnboardingController],
})
export class OnboardingModule {}
