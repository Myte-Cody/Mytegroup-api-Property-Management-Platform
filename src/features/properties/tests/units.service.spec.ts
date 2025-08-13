import { Test, TestingModule } from '@nestjs/testing';
import { UnitsService } from '../units.service';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateUnitDto } from '../dto/create-unit.dto';
import { BadRequestException } from '@nestjs/common';
import { Unit } from '../schemas/unit.schema';
import { Property } from '../schemas/property.schema';

describe('UnitsService', () => {
  let service: UnitsService;
  let unitModel: Model<Unit>;
  let propertyModel: Model<Property>;

  const mockUnit = {
    _id: 'unit-mock-id',
    property: new Types.ObjectId('507f1f77bcf86cd799439011'),
    unitNumber: '101',
    floor: '1',
    sizeSqFt: 750,
    type: 'Apartment',
    bedrooms: 2,
    bathrooms: 1,
    rentAmount: 1200,
    availabilityStatus: 'Vacant',
    description: 'Test unit description',
    tenants: [],
    leases: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockProperty = {
    _id: '507f1f77bcf86cd799439011',
    name: 'Test Property',
    address: {
      street: '123 Test St',
      city: 'Test City',
      state: 'Test State',
      postalCode: '12345',
      country: 'Test Country',
    },
    owner: new Types.ObjectId('507f1f77bcf86cd799439012'),
    status: 'Active',
    units: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Create a proper mock for the Unit Mongoose model
  const mockUnitModel = function () {
    return {
      save: jest.fn().mockResolvedValue(mockUnit),
    };
  } as any;

  // Create a proper mock for the Property Mongoose model
  const mockPropertyModel = function () {
    return {};
  } as any;

  // Add static methods to the mock models
  mockPropertyModel.findById = jest.fn().mockReturnValue({
    exec: jest.fn().mockResolvedValue(mockProperty),
  });

  mockPropertyModel.findByIdAndUpdate = jest.fn().mockReturnValue({
    exec: jest.fn().mockResolvedValue({
      ...mockProperty,
      units: [mockUnit._id],
    }),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UnitsService,
        {
          provide: getModelToken('Unit'),
          useValue: mockUnitModel,
        },
        {
          provide: getModelToken('Property'),
          useValue: mockPropertyModel,
        },
      ],
    }).compile();

    service = module.get<UnitsService>(UnitsService);
    unitModel = module.get<Model<Unit>>(getModelToken('Unit'));
    propertyModel = module.get<Model<Property>>(getModelToken('Property'));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new unit and update the property', async () => {
      const createUnitDto: CreateUnitDto = {
        property: new Types.ObjectId('507f1f77bcf86cd799439011'),
        unitNumber: '101',
        floor: '1',
        sizeSqFt: 750,
        type: 'Apartment',
        bedrooms: 2,
        bathrooms: 1,
        rentAmount: 1200,
        availabilityStatus: 'Vacant',
        description: 'Test unit description',
      };

      const result = await service.create(createUnitDto);

      // Verify unit was created
      expect(result).toEqual(mockUnit);

      // Verify property was found
      expect(mockPropertyModel.findById).toHaveBeenCalledWith(createUnitDto.property);

      // Verify property was updated with the new unit
      expect(mockPropertyModel.findByIdAndUpdate).toHaveBeenCalledWith(
        createUnitDto.property,
        { $push: { units: mockUnit._id } },
        { new: true },
      );
    });

    it('should throw BadRequestException if property does not exist', async () => {
      const createUnitDto: CreateUnitDto = {
        property: new Types.ObjectId('507f1f77bcf86cd799439012'), // Valid ObjectId format but non-existent in our mocks
        unitNumber: '101',
        floor: '1',
        sizeSqFt: 750,
        type: 'Apartment',
        bedrooms: 2,
        bathrooms: 1,
        rentAmount: 1200,
        availabilityStatus: 'Vacant',
        description: 'Test unit description',
      };

      // Mock property not found
      mockPropertyModel.findById.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.create(createUnitDto)).rejects.toThrow(BadRequestException);

      expect(mockPropertyModel.findById).toHaveBeenCalledWith(createUnitDto.property);
    });
  });
});
