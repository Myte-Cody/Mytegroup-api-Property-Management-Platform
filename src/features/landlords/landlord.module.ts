import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CaslModule } from '../../common/casl/casl.module';
import { Property, PropertySchema } from '../properties/schemas/property.schema';
import { Unit, UnitSchema } from '../properties/schemas/unit.schema';
import { Landlord, LandlordSchema } from './schema/landlord.schema';


@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Landlord.name, schema: LandlordSchema },
      { name: Property.name, schema: PropertySchema },
      { name: Unit.name, schema: UnitSchema },
    ]),
    CaslModule,
  ],
  controllers: [],
  providers: [],
  exports: [],
})
export class LandlordModule {}
