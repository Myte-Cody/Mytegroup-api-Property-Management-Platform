import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { CreateUnitDto } from "./dto/create-unit.dto";
import { UpdateUnitDto } from "./dto/update-unit.dto";
import { Unit } from "./schemas/unit.schema";
import { Property } from "./schemas/property.schema";

@Injectable()
export class UnitsService {
  constructor(
    @InjectModel("Unit") private readonly unitModel: Model<Unit>,
    @InjectModel("Property") private readonly propertyModel: Model<Property>
  ) {}

  async create(createUnitDto: CreateUnitDto) {
    // Verify that the property exists
    const property = await this.propertyModel
      .findById(createUnitDto.property)
      .exec();
    if (!property) {
      throw new BadRequestException(
        `Property with ID ${createUnitDto.property} not found`
      );
    }

    // Create the new unit
    const newUnit = new this.unitModel(createUnitDto);
    const savedUnit = await newUnit.save();

    // Update the property to include this unit
    await this.propertyModel
      .findByIdAndUpdate(
        createUnitDto.property,
        { $push: { units: savedUnit._id } },
        { new: true }
      )
      .exec();

    return savedUnit;
  }
}
