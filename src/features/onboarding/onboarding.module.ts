import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Landlord, LandlordSchema } from '../landlords/schema/landlord.schema';
import { PropertiesModule } from '../properties/properties.module';
import { PropertiesService } from '../properties/properties.service';
import { UnitsService } from '../properties/units.service';
import { UnitsController } from '../properties/units.controller';
import { OnboardingController } from './onboarding.controller';
import { InvitationsModule } from '../invitations/invitations.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Landlord.name, schema: LandlordSchema }]),
    PropertiesModule,
    InvitationsModule,
  ],
  controllers: [OnboardingController],
})
export class OnboardingModule {}
