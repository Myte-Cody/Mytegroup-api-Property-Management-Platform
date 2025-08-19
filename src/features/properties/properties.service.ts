import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { SoftDeleteModel } from '../../common/interfaces/soft-delete-model.interface';
import { Organization } from '../organizations/schemas/organization.schema';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { Property } from './schemas/property.schema';

@Injectable()
export class PropertiesService {
  constructor(
    @InjectModel(Property.name)
    private readonly propertyModel: SoftDeleteModel<Property>,
    @InjectModel(Organization.name)
    private readonly organizationModel: Model<Organization>,
  ) {}
  async create(createPropertyDto: CreatePropertyDto, owner: string | Types.ObjectId) {
    const newProperty = new this.propertyModel({
      ...createPropertyDto,
      owner,
    });
    return await newProperty.save();
  }

  async findByLandlord(landlordId: string) {
    const query = { owner: landlordId };
    return await this.propertyModel.find(query).exec();
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
    const property = await this.propertyModel.findById(id).exec();
    if (!property) {
      throw new NotFoundException(`Property with ID ${id} not found`);
    }

    const updatedProperty = await this.propertyModel
      .findByIdAndUpdate(id, updatePropertyDto, { new: true })
      .exec();

    return updatedProperty;
  }

  async remove(id: string) {
    const property = await this.propertyModel.findById(id).exec();
    if (!property) {
      throw new NotFoundException(`Property with ID ${id} not found`);
    }

    await this.propertyModel.deleteById(id);

    return property;
  }
}
