import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { CreateOrganizationDto } from "./dto/create-organization.dto";
import { UpdateOrganizationDto } from "./dto/update-organization.dto";
import { Organization } from "./schemas/organization.schema";

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectModel(Organization.name)
    private readonly organizationModel: Model<Organization>
  ) {}

  async create(createOrganizationDto: CreateOrganizationDto) {
    const newOrganization = new this.organizationModel(createOrganizationDto);
    return await newOrganization.save();
  }

  async findAll() {
    return await this.organizationModel.find().exec();
  }

  async findOne(id: string) {
    return await this.organizationModel.findById(id).exec();
  }

  async update(id: string, updateOrganizationDto: UpdateOrganizationDto) {
    const updatedOrganization = await this.organizationModel
      .findByIdAndUpdate(id, updateOrganizationDto, { new: true })
      .exec();

    if (!updatedOrganization) {
      throw new NotFoundException(`Organization with ID ${id} not found`);
    }

    return updatedOrganization;
  }

  async remove(id: string) {
    const result = await this.organizationModel.findByIdAndDelete(id).exec();

    if (!result) {
      throw new NotFoundException(`Organization with ID ${id} not found`);
    }

    return null;
  }
}
