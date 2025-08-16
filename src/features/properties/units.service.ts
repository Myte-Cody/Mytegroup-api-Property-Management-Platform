import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { SoftDeleteModel } from '../../common/interfaces/soft-delete-model.interface';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { Property } from './schemas/property.schema';
import { Unit } from './schemas/unit.schema';

@Injectable()
export class UnitsService {
  constructor(
    @InjectModel(Unit.name) private readonly unitModel: SoftDeleteModel<Unit>,
    @InjectModel(Property.name)
    private readonly propertyModel: SoftDeleteModel<Property>,
  ) {}

  async create(createUnitDto: CreateUnitDto, propertyId: string) {
    const property = await this.propertyModel.findById(propertyId).exec();
    if (!property) {
      throw new UnprocessableEntityException(`Property with ID ${propertyId} not found`);
    }

    const newUnit = new this.unitModel({
      ...createUnitDto,
      property: propertyId,
    });
    return await newUnit.save();
  }

  async findAll() {
    return await this.unitModel.find().exec();
  }

  async findOne(id: string) {
    const unit = await this.unitModel.findById(id).exec();
    if (!unit) {
      throw new NotFoundException(`Unit with ID ${id} not found`);
    }
    return unit;
  }

  async update(id: string, updateUnitDto: UpdateUnitDto) {
    const unit = await this.unitModel.findById(id).exec();
    if (!unit) {
      throw new NotFoundException(`Unit with ID ${id} not found`);
    }
    const updatedUnit = await this.unitModel
      .findByIdAndUpdate(id, updateUnitDto, { new: true })
      .exec();

    return updatedUnit;
  }

  async remove(id: string) {
    const unit = await this.unitModel.findById(id).exec();
    if (!unit) {
      throw new NotFoundException(`Unit with ID ${id} not found`);
    }
    return await this.unitModel.deleteById(id);
  }
}
