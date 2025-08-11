import { Module } from "@nestjs/common";
import { PropertiesService } from "./properties.service";
import { PropertiesController } from "./properties.controller";
import { UnitsService } from "./units.service";
import { UnitsController } from "./units.controller";
import { MongooseModule } from "@nestjs/mongoose";
import { Property, PropertySchema } from "./schemas/property.schema";
import { Unit, UnitSchema } from "./schemas/unit.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { schema: PropertySchema, name: Property.name },
      { schema: UnitSchema, name: Unit.name },
    ]),
  ],
  controllers: [PropertiesController, UnitsController],
  providers: [PropertiesService, UnitsService],
})
export class PropertiesModule {}
