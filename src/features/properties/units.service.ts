import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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

  async create(createUnitDto: CreateUnitDto) {
    // Verify that the property exists
    const property = await this.propertyModel.findById(createUnitDto.property).exec();
    if (!property) {
      throw new BadRequestException(`Property with ID ${createUnitDto.property} not found`);
    }

    // Create the new unit
    const newUnit = new this.unitModel(createUnitDto);
    const savedUnit = await newUnit.save();

    // Update the property to include this unit
    await this.propertyModel
      .findByIdAndUpdate(createUnitDto.property, { $push: { units: savedUnit._id } }, { new: true })
      .exec();

    return savedUnit;
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
    // Check if unit exists
    const unit = await this.unitModel.findById(id).exec();
    if (!unit) {
      throw new NotFoundException(`Unit with ID ${id} not found`);
    }

    // If property is being changed, verify the new property exists
    if (updateUnitDto.property) {
      const property = await this.propertyModel.findById(updateUnitDto.property).exec();
      if (!property) {
        throw new BadRequestException(`Property with ID ${updateUnitDto.property} not found`);
      }

      // If property is changing, update the old and new property's units arrays
      if (unit.property.toString() !== updateUnitDto.property.toString()) {
        // Remove unit from old property
        await this.propertyModel
          .findByIdAndUpdate(unit.property, { $pull: { units: unit._id } }, { new: true })
          .exec();

        // Add unit to new property
        await this.propertyModel
          .findByIdAndUpdate(updateUnitDto.property, { $push: { units: unit._id } }, { new: true })
          .exec();
      }
    }

    // Update the unit
    const updatedUnit = await this.unitModel
      .findByIdAndUpdate(id, updateUnitDto, { new: true })
      .exec();

    return updatedUnit;
  }

  async remove(id: string) {
    // Check if unit exists
    const unit = await this.unitModel.findById(id).exec();
    if (!unit) {
      throw new NotFoundException(`Unit with ID ${id} not found`);
    }

    // Remove unit from property's units array
    await this.propertyModel
      .findByIdAndUpdate(unit.property, { $pull: { units: unit._id } }, { new: true })
      .exec();

    // Use soft delete instead of permanent deletion
    await this.unitModel.deleteById(id);

    return null;
  }
}
