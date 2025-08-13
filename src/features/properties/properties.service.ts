import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { CreatePropertyDto } from "./dto/create-property.dto";
import { UpdatePropertyDto } from "./dto/update-property.dto";
import { Property } from "./schemas/property.schema";
import { SoftDeleteModel } from "../../common/interfaces/soft-delete-model.interface";
import { Organization } from "../organizations/schemas/organization.schema";

@Injectable()
export class PropertiesService {
  constructor(
    @InjectModel(Property.name)
    private readonly propertyModel: SoftDeleteModel<Property>,
    @InjectModel(Organization.name)
    private readonly organizationModel: Model<Organization>,
  ) {}
  async create(createPropertyDto: CreatePropertyDto) {
    const organization = await this.organizationModel
      .findById(createPropertyDto.owner)
      .exec();
    if (!organization) {
      throw new BadRequestException(
        `Organization with ID ${createPropertyDto.owner} does not exist`,
      );
    }

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
    // Check if the property exists
    const property = await this.propertyModel.findById(id).exec();
    if (!property) {
      throw new NotFoundException(`Property with ID ${id} not found`);
    }

    // Validate that the owner organization exists if provided
    if (updatePropertyDto.owner) {
      const organization = await this.organizationModel
        .findById(updatePropertyDto.owner)
        .exec();
      if (!organization) {
        throw new BadRequestException(
          `Organization with ID ${updatePropertyDto.owner} does not exist`,
        );
      }
    }

    const updatedProperty = await this.propertyModel
      .findByIdAndUpdate(id, updatePropertyDto, { new: true })
      .exec();

    return updatedProperty;
  }

  async remove(id: string) {
    // First check if the property exists
    const property = await this.propertyModel.findById(id).exec();
    if (!property) {
      throw new NotFoundException(`Property with ID ${id} not found`);
    }

    // Use soft delete instead of permanent deletion
    await this.propertyModel.deleteById(id);

    return property;
  }
}
