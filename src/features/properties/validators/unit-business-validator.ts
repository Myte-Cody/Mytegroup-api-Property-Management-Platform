import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { UnitAvailabilityStatus } from '../../../common/enums/unit.enum';
import { AppModel } from '../../../common/interfaces/app-model.interface';
import { CreateUnitDto } from '../dto/create-unit.dto';
import { UpdateUnitDto } from '../dto/update-unit.dto';
import { Unit } from '../schemas/unit.schema';
import { UserDocument } from '../../users/schemas/user.schema';

export interface UnitUpdateValidationContext {
  existingUnit: Unit;
  updateDto: UpdateUnitDto;
  userId?: string;
  currentUser: UserDocument;
}

export interface UnitCreateValidationContext {
  createDto: CreateUnitDto;
  propertyId: string;
  currentUser: UserDocument;
}

export interface UnitDeleteValidationContext {
  unit: Unit;
}

@Injectable()
export class UnitBusinessValidator {
  constructor(@InjectModel(Unit.name) private readonly unitModel: AppModel<Unit>) {}

  async validateCreate(context: UnitCreateValidationContext): Promise<void> {
    const { createDto, propertyId, currentUser } = context;
    
    // Extract landlord ID for tenant filtering
    const landlordId = currentUser.tenantId && typeof currentUser.tenantId === 'object' 
      ? (currentUser.tenantId as any)._id 
      : currentUser.tenantId;
    
    if (!landlordId) {
      throw new ForbiddenException('Cannot validate unit: No tenant context');
    }

    const duplicateUnit = await this.unitModel
      .byTenant(landlordId)
      .findOne({
        property: propertyId,
        unitNumber: createDto.unitNumber,
      })
      .exec();

    if (duplicateUnit) {
      throw new BadRequestException(
        `Unit number '${createDto.unitNumber}' already exists in this property`,
      );
    }
  }

  async validateUpdate(context: UnitUpdateValidationContext): Promise<void> {
    const { existingUnit, updateDto } = context;

    await this.validateUnitNumberUniquenessForUpdate(existingUnit, updateDto, context);

    this.validateStatusTransition(existingUnit, updateDto);
  }

  async validateDelete(context: UnitDeleteValidationContext): Promise<void> {
    const { unit } = context;

    // Check if unit is currently occupied
    if (unit.availabilityStatus === UnitAvailabilityStatus.OCCUPIED) {
      throw new ConflictException(
        'Cannot delete unit. Unit is currently occupied. Please ensure the unit is vacant before deletion.',
      );
    }

    // Additional business rules can be added here, such as:
    // - TODO Check for active lease agreements
    // - TODO Check for pending maintenance requests
    // - TODO Check for upcoming reservations
  }

  // Update-specific validation methods (renamed for clarity)
  private async validateUnitNumberUniquenessForUpdate(
    existingUnit: Unit,
    updateDto: UpdateUnitDto,
    context: UnitUpdateValidationContext,
  ): Promise<void> {
    if (!updateDto.unitNumber || updateDto.unitNumber === existingUnit.unitNumber) {
      return; // No change in unit number
    }
    
    // Extract landlord ID for tenant filtering
    const landlordId = context.currentUser.tenantId && typeof context.currentUser.tenantId === 'object' 
      ? (context.currentUser.tenantId as any)._id 
      : context.currentUser.tenantId;
    
    if (!landlordId) {
      throw new ForbiddenException('Cannot validate unit: No tenant context');
    }

    const duplicateUnit = await this.unitModel
      .byTenant(landlordId)
      .findOne({
        property: existingUnit.property,
        unitNumber: updateDto.unitNumber,
        _id: { $ne: existingUnit._id },
      })
      .exec();

    if (duplicateUnit) {
      throw new BadRequestException(
        `Unit number '${updateDto.unitNumber}' already exists in this property`,
      );
    }
  }

  private validateStatusTransition(existingUnit: Unit, updateDto: UpdateUnitDto): void {
    if (
      !updateDto.availabilityStatus ||
      updateDto.availabilityStatus === existingUnit.availabilityStatus
    ) {
      return; // No status change
    }

    const validTransitions = this.getValidStatusTransitions();
    const currentStatus = existingUnit.availabilityStatus;
    const newStatus = updateDto.availabilityStatus;

    const allowedTransitions = validTransitions[currentStatus] || [];
    if (!allowedTransitions.includes(newStatus)) {
      throw new BadRequestException(
        `Invalid status transition from '${currentStatus}' to '${newStatus}'. ` +
          `Valid transitions from '${currentStatus}': ${allowedTransitions.join(', ')}`,
      );
    }
  }

  private getValidStatusTransitions(): Record<string, UnitAvailabilityStatus[]> {
    return {
      [UnitAvailabilityStatus.VACANT]: [
        UnitAvailabilityStatus.AVAILABLE_FOR_RENT,
        UnitAvailabilityStatus.OCCUPIED,
      ],
      [UnitAvailabilityStatus.AVAILABLE_FOR_RENT]: [
        UnitAvailabilityStatus.VACANT,
        UnitAvailabilityStatus.OCCUPIED,
      ],
      [UnitAvailabilityStatus.OCCUPIED]: [
        UnitAvailabilityStatus.VACANT,
        UnitAvailabilityStatus.AVAILABLE_FOR_RENT,
      ],
    };
  }
}
