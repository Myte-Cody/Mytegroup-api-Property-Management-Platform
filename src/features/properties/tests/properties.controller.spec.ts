import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { UnitAvailabilityStatus, UnitType } from '../../../common/enums/unit.enum';
import { CreatePropertyDto } from '../dto/create-property.dto';
import { CreateUnitDto } from '../dto/create-unit.dto';
import { PropertiesController } from '../properties.controller';
import { PropertiesService } from '../properties.service';
import { UnitsService } from '../units.service';

describe('PropertiesController', () => {
  let controller: PropertiesController;
  let service: PropertiesService;
  let unitsService: UnitsService;

  const mockProperty = {
    _id: 'a-mock-id',
    name: 'Test Property',
    address: {
      street: '123 Test St',
      city: 'Test City',
      state: 'Test State',
      postalCode: '12345',
      country: 'Test Country',
    },
    owner: new Types.ObjectId('507f1f77bcf86cd799439011'),
    status: 'Active',
    units: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPropertiesService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const mockUnitsService = {
    create: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PropertiesController],
      providers: [
        {
          provide: PropertiesService,
          useValue: mockPropertiesService,
        },
        {
          provide: UnitsService,
          useValue: mockUnitsService,
        },
      ],
    }).compile();

    controller = module.get<PropertiesController>(PropertiesController);
    service = module.get<PropertiesService>(PropertiesService);
    unitsService = module.get<UnitsService>(UnitsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a property with valid fields and return 201 status with property data', async () => {
      const createPropertyDto: CreatePropertyDto = {
        name: 'Test Property',
        address: {
          street: '123 Test St',
          city: 'Test City',
          state: 'Test State',
          postalCode: '12345',
          country: 'Test Country',
        },
        owner: new Types.ObjectId('507f1f77bcf86cd799439011'),
      };

      // Mock service to return property with unique ID
      mockPropertiesService.create.mockResolvedValue({
        ...mockProperty,
        _id: 'newly-created-id',
      });

      const result = await controller.create(createPropertyDto);

      // Verify result contains property with ID
      expect(result).toEqual({
        ...mockProperty,
        _id: 'newly-created-id',
      });
      expect(mockPropertiesService.create).toHaveBeenCalledWith(createPropertyDto);
    });

    it('should handle invalid field formats and return 400 status with descriptive error', async () => {
      const invalidPropertyDto = {
        name: 'Test Property',
        address: {
          street: '123 Test St',
          city: 'Test City',
          state: 'Test State',
          postalCode: '12345',
          country: 'Test Country',
        },
        owner: 'invalid-owner-id',
      };

      // Mock service to throw BadRequestException for invalid format
      const errorMessage = 'Invalid owner ID format';
      mockPropertiesService.create.mockRejectedValue({
        status: 400,
        message: errorMessage,
      });

      // Expect controller to pass through the error
      await expect(controller.create(invalidPropertyDto as any)).rejects.toEqual({
        status: 400,
        message: errorMessage,
      });
    });
  });

  describe('addUnitToProperty', () => {
    const mockUnit = {
      _id: 'mock-unit-id',
      unitNumber: '101',
      floor: '1',
      sizeSqFt: 800,
      type: UnitType.APARTMENT,
      bedrooms: 2,
      bathrooms: 1,
      availabilityStatus: UnitAvailabilityStatus.VACANT,
      rentAmount: 1200,
      description: 'A nice apartment',
      tenants: [],
      leases: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should create a unit with valid fields and return 201 status with unit data', async () => {
      const propertyId = '507f1f77bcf86cd799439011';
      const createUnitDto: CreateUnitDto = {
        unitNumber: '101',
        floor: '1',
        sizeSqFt: 800,
        type: UnitType.APARTMENT,
        bedrooms: 2,
        bathrooms: 1,
        availabilityStatus: UnitAvailabilityStatus.VACANT,
        rentAmount: 1200,
        description: 'A nice apartment',
      };

      // Mock service to return unit with unique ID
      mockUnitsService.create.mockResolvedValue({
        ...mockUnit,
        _id: 'newly-created-unit-id',
      });

      const result = await controller.addUnitToProperty(propertyId, createUnitDto);

      // Verify result contains unit with ID
      expect(result).toEqual({
        ...mockUnit,
        _id: 'newly-created-unit-id',
      });
      expect(mockUnitsService.create).toHaveBeenCalledWith(
        {
          ...createUnitDto,
        },
        propertyId,
      );
    });

    it('should handle property not found and return 400 status with descriptive error', async () => {
      const propertyId = 'non-existent-property-id';
      const createUnitDto: CreateUnitDto = {
        unitNumber: '101',
        type: UnitType.APARTMENT,
      };

      // Mock service to throw BadRequestException for non-existent property
      const errorMessage = `Property with ID ${propertyId} not found`;
      mockUnitsService.create.mockRejectedValue(new BadRequestException(errorMessage));

      // Expect controller to pass through the error
      await expect(controller.addUnitToProperty(propertyId, createUnitDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(controller.addUnitToProperty(propertyId, createUnitDto)).rejects.toThrow(
        errorMessage,
      );
    });

    it('should handle validation errors and return 400 status with descriptive error', async () => {
      const propertyId = '507f1f77bcf86cd799439011';
      const invalidUnitDto = {
        // Missing required unitNumber
        type: 'InvalidType', // Invalid enum value
      };

      // Mock service to throw BadRequestException for validation errors
      const errorMessage = 'Validation failed';
      mockUnitsService.create.mockRejectedValue(new BadRequestException(errorMessage));

      // Expect controller to pass through the error
      await expect(controller.addUnitToProperty(propertyId, invalidUnitDto as any)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
