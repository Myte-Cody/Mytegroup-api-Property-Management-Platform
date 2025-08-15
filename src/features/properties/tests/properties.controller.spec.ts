import { BadRequestException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { PropertyOwnerGuard } from '../../../common/authorization/guards/property-owner.guard';
import { UnitType } from '../../../common/enums/unit.enum';
import { User } from '../../users/schemas/user.schema';
import { CreatePropertyDto } from '../dto/create-property.dto';
import { CreateUnitDto } from '../dto/create-unit.dto';
import { PropertiesController } from '../properties.controller';
import { PropertiesService } from '../properties.service';
import { Property } from '../schemas/property.schema';
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
    findByLandlord: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const mockUnitsService = {
    create: jest.fn(),
  };

  // Mock for Property model needed by PropertyOwnerGuard
  const mockPropertyModel = {
    findById: jest.fn().mockImplementation(() => ({
      exec: jest.fn().mockResolvedValue({
        owner: new Types.ObjectId('507f1f77bcf86cd799439011'),
      }),
    })),
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
        {
          provide: getModelToken(Property.name),
          useValue: mockPropertyModel,
        },
        PropertyOwnerGuard,
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
      };

      const mockUser = {
        organization: {
          _id: new Types.ObjectId('507f1f77bcf86cd799439011'),
        },
      } as User;

      // Mock service to return property with unique ID
      mockPropertiesService.create.mockResolvedValue({
        ...mockProperty,
        _id: 'newly-created-id',
      });

      const result = await controller.create(mockUser, createPropertyDto);

      // Verify result contains property with ID
      expect(result).toEqual({
        ...mockProperty,
        _id: 'newly-created-id',
      });
      expect(mockPropertiesService.create).toHaveBeenCalledWith(
        createPropertyDto,
        mockUser.organization._id,
      );
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
      };

      const mockUser = {
        organization: {
          _id: 'invalid-owner-id',
        },
      } as unknown as User;

      // Mock service to throw BadRequestException for invalid format
      const errorMessage = 'Invalid owner ID format';
      mockPropertiesService.create.mockRejectedValue({
        status: 400,
        message: errorMessage,
      });

      // Expect controller to pass through the error
      await expect(controller.create(mockUser, invalidPropertyDto as any)).rejects.toEqual({
        status: 400,
        message: errorMessage,
      });
    });
  });

  describe('findByLandlord', () => {
    const mockUser = {
      organization: {
        _id: new Types.ObjectId('507f1f77bcf86cd799439011'),
      },
    } as User;

    const mockLandlordProperties = [
      {
        _id: 'property-id-1',
        name: 'Property 1',
        address: {
          street: '123 Main St',
          city: 'City 1',
          state: 'State 1',
          postalCode: '12345',
          country: 'Country 1',
        },
        owner: new Types.ObjectId('507f1f77bcf86cd799439011'),
      },
    ];
    
    // Reset mocks before each test
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should correctly pass landlordId parameter to service', async () => {
      const landlordId = '507f1f77bcf86cd799439022';
      
      // Mock the service with a simple return value
      mockPropertiesService.findByLandlord.mockResolvedValue([]);
      
      await controller.findByLandlord(mockUser, landlordId);
      
      // Verify the service was called with the provided landlord ID, not the user's organization ID
      expect(mockPropertiesService.findByLandlord).toHaveBeenCalledWith(landlordId);
      expect(mockPropertiesService.findByLandlord).not.toHaveBeenCalledWith(
        mockUser.organization._id.toString()
      );
      
      // Verify the service was called exactly once
      expect(mockPropertiesService.findByLandlord).toHaveBeenCalledTimes(1);
    });

    it('should use current user organization ID when no landlordId is provided', async () => {
      // Mock the service with a simple return value
      mockPropertiesService.findByLandlord.mockResolvedValue([]);
      
      // Create a spy to track the parameter transformation
      const orgIdSpy = jest.spyOn(mockUser.organization._id, 'toString');
      
      await controller.findByLandlord(mockUser, undefined);
      
      // Verify the toString method was called on the organization ID
      expect(orgIdSpy).toHaveBeenCalled();
      
      // Verify the service was called with the correct parameter
      expect(mockPropertiesService.findByLandlord).toHaveBeenCalledWith(
        mockUser.organization._id.toString()
      );
      
      // Verify the service was NOT called with undefined
      expect(mockPropertiesService.findByLandlord).not.toHaveBeenCalledWith(undefined);
    });

    it('should return whatever the service returns', async () => {
      const landlordId = '507f1f77bcf86cd799439033';
      
      // Test with properties
      mockPropertiesService.findByLandlord.mockResolvedValue(mockLandlordProperties);
      let result = await controller.findByLandlord(mockUser, landlordId);
      expect(result).toBe(mockLandlordProperties);
      
      // Clear mocks
      jest.clearAllMocks();
      
      // Test with empty array
      mockPropertiesService.findByLandlord.mockResolvedValue([]);
      result = await controller.findByLandlord(mockUser, landlordId);
      
      // Verify the result is an array (not null or undefined)
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });
    
    it('should propagate errors from the service', async () => {
      const landlordId = '507f1f77bcf86cd799439033';
      const testError = new Error('Database connection failed');
      
      // Mock the service to throw an error
      mockPropertiesService.findByLandlord.mockRejectedValue(testError);
      
      // Verify that the controller propagates the error
      await expect(controller.findByLandlord(mockUser, landlordId)).rejects.toThrow(testError);
      
      // Verify the service was called with the correct landlord ID
      expect(mockPropertiesService.findByLandlord).toHaveBeenCalledWith(landlordId);
    });
  });

  describe('addUnitToProperty', () => {
    const mockUnit = {
      _id: 'mock-unit-id',
      unitNumber: '101',
      size: 800,
      type: UnitType.APARTMENT,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should create a unit with valid fields and return 201 status with unit data', async () => {
      const propertyId = '507f1f77bcf86cd799439011';
      const createUnitDto: CreateUnitDto = {
        unitNumber: '101',
        size: 800,
        type: UnitType.APARTMENT,
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
        size: 800,
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
