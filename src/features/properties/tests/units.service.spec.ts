import { BadRequestException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { UnitAvailabilityStatus, UnitType } from '../../../common/enums/unit.enum';
import { SoftDeleteModel } from '../../../common/interfaces/soft-delete-model.interface';
import { CreateUnitDto } from '../dto/create-unit.dto';
import { Property } from '../schemas/property.schema';
import { Unit } from '../schemas/unit.schema';
import { UnitsService } from '../units.service';

describe('UnitsService', () => {
  let service: UnitsService;
  let unitModel: any;
  let propertyModel: jest.Mocked<SoftDeleteModel<Property>>;

  const mockProperty: Partial<Property> = {
    _id: new Types.ObjectId('507f1f77bcf86cd799439011'),
    name: 'Test Property',
    address: {
      street: '123 Test St',
      city: 'Test City',
      state: 'Test State',
      postalCode: '12345',
      country: 'Test Country',
    },
    units: [],
  };

  const mockUnit: Partial<Unit> = {
    _id: new Types.ObjectId('507f1f77bcf86cd799439022'),
    unitNumber: '101',
    floor: '1',
    sizeSqFt: 800,
    type: UnitType.APARTMENT,
    bedrooms: 2,
    bathrooms: 1,
    availabilityStatus: UnitAvailabilityStatus.VACANT,
    property: mockProperty._id as Types.ObjectId,
  };

  beforeEach(async () => {
    // Create a mock instance with save method
    const mockUnitInstance = {
      save: jest.fn(),
      _id: mockUnit._id,
    };

    const UnitModelMock = jest.fn().mockImplementation(() => mockUnitInstance);

    const mockUnitModelWithMethods = UnitModelMock as jest.Mock & {
      findById: jest.Mock;
      find: jest.Mock;
    };

    mockUnitModelWithMethods.findById = jest.fn().mockReturnValue({
      exec: jest.fn(),
    });
    mockUnitModelWithMethods.find = jest.fn().mockReturnValue({
      exec: jest.fn(),
    });

    // Assign the mock to unitModel
    unitModel = mockUnitModelWithMethods;

    propertyModel = {
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
    } as unknown as jest.Mocked<SoftDeleteModel<Property>>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UnitsService,
        { provide: getModelToken('Unit'), useValue: unitModel },
        { provide: getModelToken('Property'), useValue: propertyModel },
      ],
    }).compile();

    service = module.get<UnitsService>(UnitsService);
  });

  describe('create', () => {
    const propertyId = '507f1f77bcf86cd799439011';
    const validDto: CreateUnitDto = {
      unitNumber: '101',
      floor: '1',
      sizeSqFt: 800,
      type: UnitType.APARTMENT,
      bedrooms: 2,
      bathrooms: 1,
    };

    it('should create a unit when property exists', async () => {
      // Mock property exists
      propertyModel.findById.mockReturnValue({
        exec: () => Promise.resolve(mockProperty as Property),
      } as any);

      // Mock property update
      propertyModel.findByIdAndUpdate.mockReturnValue({
        exec: () => Promise.resolve({ ...mockProperty, units: [mockUnit._id] } as Property),
      } as any);

      const savedUnit = { ...mockUnit };

      const mockInstance = {
        save: jest.fn().mockResolvedValue(savedUnit),
        _id: mockUnit._id,
      };
      unitModel.mockImplementationOnce(() => mockInstance);

      const result = await service.create(validDto, propertyId);

      expect(propertyModel.findById).toHaveBeenCalledWith(propertyId);
      expect(mockInstance.save).toHaveBeenCalled();
      expect(propertyModel.findByIdAndUpdate).toHaveBeenCalledWith(
        propertyId,
        { $push: { units: mockUnit._id } },
        { new: true },
      );
      expect(result).toEqual(savedUnit);
    });

    it('should throw BadRequestException if property does not exist', async () => {
      // Mock property doesn't exist
      propertyModel.findById.mockReturnValue({
        exec: () => Promise.resolve(null),
      } as any);

      await expect(service.create(validDto, propertyId)).rejects.toThrow(BadRequestException);
      await expect(service.create(validDto, propertyId)).rejects.toThrow(
        `Property with ID ${propertyId} not found`,
      );
    });

    it('should handle repository save errors', async () => {
      // Mock property exists
      propertyModel.findById.mockReturnValue({
        exec: () => Promise.resolve(mockProperty as Property),
      } as any);

      // Mock the constructor to return an instance with save method that throws
      const mockInstance = {
        save: jest.fn().mockRejectedValue(new Error('DB error')),
      };
      unitModel.mockImplementationOnce(() => mockInstance);

      await expect(service.create(validDto, propertyId)).rejects.toThrow('DB error');
    });
  });
});
