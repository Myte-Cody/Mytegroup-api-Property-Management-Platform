import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Organization,
  OrganizationSchema,
} from '../../features/organizations/schemas/organization.schema';
import { Property, PropertySchema } from '../../features/properties/schemas/property.schema';
import { User, UserSchema } from '../../features/users/schemas/user.schema';
import { OrganizationService } from './services/organization.service';
import { PropertyService } from './services/property.service';
import { UserService } from './services/user.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Organization.name, schema: OrganizationSchema },
      { name: Property.name, schema: PropertySchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  providers: [OrganizationService, PropertyService, UserService],
  exports: [OrganizationService, PropertyService, UserService],
})
export class AuthorizationModule {}
