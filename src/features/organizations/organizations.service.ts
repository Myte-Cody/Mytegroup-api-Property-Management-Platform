import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { CreateOrganizationDto } from "./dto/create-organization.dto";

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectModel("Organization") private readonly organizationModel: Model<any>
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
}
