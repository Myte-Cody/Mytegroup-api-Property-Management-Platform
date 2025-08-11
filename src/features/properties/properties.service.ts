import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { CreatePropertyDto } from "./dto/create-property.dto";
import { UpdatePropertyDto } from "./dto/update-property.dto";
import { Property } from "./schemas/property.schema";

@Injectable()
export class PropertiesService {
  constructor(
    @InjectModel(Property.name) private readonly propertyModel: Model<Property>,
  ) {}
  async create(createPropertyDto: CreatePropertyDto) {
    const newProperty = new this.propertyModel(createPropertyDto);
    return await newProperty.save();
  }

  async findAll() {
    return await this.propertyModel.find().exec();
  }

  async findOne(id: string) {
    const property = await this.propertyModel.findById(id).exec();
    if (!property) {
      throw new NotFoundException(`Property with ID ${id} not found`);
    }
    return property;
  }

  async update(id: string, updatePropertyDto: UpdatePropertyDto) {
    const updatedProperty = await this.propertyModel
      .findByIdAndUpdate(id, updatePropertyDto, { new: true })
      .exec();

    if (!updatedProperty) {
      throw new NotFoundException(`Property with ID ${id} not found`);
    }

    return updatedProperty;
  }

  async remove(id: string) {
    const deletedProperty = await this.propertyModel
      .findByIdAndDelete(id)
      .exec();

    if (!deletedProperty) {
      throw new NotFoundException(`Property with ID ${id} not found`);
    }

    return deletedProperty;
  }
}
