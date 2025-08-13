import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthorizationModule } from '../../common/authorization/authorization.module';
import { Organization, OrganizationSchema } from '../organizations/schemas/organization.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { PropertiesController } from './properties.controller';
import { PropertiesService } from './properties.service';
import { Property, PropertySchema } from './schemas/property.schema';
import { Unit, UnitSchema } from './schemas/unit.schema';
import { UnitsService } from './units.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { schema: PropertySchema, name: Property.name },
      { schema: UnitSchema, name: Unit.name },
      { schema: OrganizationSchema, name: Organization.name },
      { schema: UserSchema, name: User.name },
    ]),
    AuthorizationModule,
  ],
  controllers: [PropertiesController],
  providers: [PropertiesService, UnitsService],
})
export class PropertiesModule {}
