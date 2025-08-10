import { Module } from "@nestjs/common";
import { PropertiesService } from "./properties.service";
import { PropertiesController } from "./properties.controller";
import { UnitsService } from "./units.service";
import { UnitsController } from "./units.controller";
import { MongooseModule } from "@nestjs/mongoose";
import { PropertySchema } from "./schemas/property.schema";
import { UnitSchema } from "./schemas/unit.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { schema: PropertySchema, name: "Property" },
      { schema: UnitSchema, name: "Unit" },
    ]),
  ],
  controllers: [PropertiesController, UnitsController],
  providers: [PropertiesService, UnitsService],
})
export class PropertiesModule {}
