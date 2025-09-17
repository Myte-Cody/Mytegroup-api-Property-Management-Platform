import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NestjsFormDataModule } from 'nestjs-form-data';
import { CaslModule } from '../../common/casl/casl.module';
import { MediaModule } from '../media/media.module';
import { User, UserSchema } from '../users/schemas/user.schema';
import { PropertiesController } from './properties.controller';
import { PropertiesService } from './properties.service';
import { Property, PropertySchema } from './schemas/property.schema';
import { Unit, UnitSchema } from './schemas/unit.schema';
import { UnitsController } from './units.controller';
import { UnitsService } from './units.service';
import { UnitBusinessValidator } from './validators/unit-business-validator';

@Module({
  imports: [
    MongooseModule.forFeature([
      { schema: PropertySchema, name: Property.name },
      { schema: UnitSchema, name: Unit.name },
      { schema: UserSchema, name: User.name },
    ]),
    NestjsFormDataModule.config({ isGlobal: true }),
    CaslModule,
    MediaModule,
  ],
  controllers: [PropertiesController, UnitsController],
  providers: [PropertiesService, UnitsService, UnitBusinessValidator],
  exports: [PropertiesService, UnitsService, UnitBusinessValidator, MongooseModule],
})
export class PropertiesModule {}
