import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { SoftDeleteModel } from '../../common/interfaces/soft-delete-model.interface';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { Organization } from './schemas/organization.schema';

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
      throw new UnprocessableEntityException(
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
          _id: { $ne: id },
        })
        .exec();

      if (existingOrganization) {
        throw new UnprocessableEntityException(
          `Organization with name '${updateOrganizationDto.name}' already exists`,
        );
      }
    }

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

    await this.organizationModel.deleteById(id);

    return null;
  }
}
