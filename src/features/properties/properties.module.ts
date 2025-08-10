import { Module } from "@nestjs/common";
import { PropertiesService } from "./properties.service";
import { PropertiesController } from "./properties.controller";
import { MongooseModule } from "@nestjs/mongoose";
import { PropertySchema } from "./schemas/property.schema";

@Module({
  imports: [
    MongooseModule.forFeature([{ schema: PropertySchema, name: "Property" }]),
  ],
  controllers: [PropertiesController],
  providers: [PropertiesService],
})
export class PropertiesModule {}
