import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { CreateOrganizationDto } from "./dto/create-organization.dto";
import { UpdateOrganizationDto } from "./dto/update-organization.dto";
import { Organization } from "./schemas/organization.schema";
import { SoftDeleteModel } from "../../common/interfaces/soft-delete-model.interface";

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectModel(Organization.name)
    private readonly organizationModel: SoftDeleteModel<Organization>,
  ) {}

  async create(createOrganizationDto: CreateOrganizationDto) {
    const existingOrganization = await this.organizationModel
      .findOne({
        name: createOrganizationDto.name,
      })
      .exec();

    if (existingOrganization) {
      throw new BadRequestException(
        `Organization with name '${createOrganizationDto.name}' already exists`,
      );
    }

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
    if (updateOrganizationDto.name) {
      const existingOrganization = await this.organizationModel
        .findOne({
          name: updateOrganizationDto.name,
          _id: { $ne: id }, // Exclude current organization from the check
        })
        .exec();

      if (existingOrganization) {
        throw new BadRequestException(
          `Organization with name '${updateOrganizationDto.name}' already exists`,
        );
      }
    }

    // Validate that the organization exists before updating
    const organization = await this.organizationModel.findById(id).exec();
    if (!organization) {
      throw new NotFoundException(`Organization with ID ${id} not found`);
    }

    const updatedOrganization = await this.organizationModel
      .findByIdAndUpdate(id, updateOrganizationDto, { new: true })
      .exec();

    return updatedOrganization;
  }

  async remove(id: string) {
    const organization = await this.organizationModel.findById(id).exec();
    if (!organization) {
      throw new NotFoundException(`Organization with ID ${id} not found`);
    }

    // Use soft delete instead of permanent deletion
    await this.organizationModel.deleteById(id);

    return null;
  }
}
