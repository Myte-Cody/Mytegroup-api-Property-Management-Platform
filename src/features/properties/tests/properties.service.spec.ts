import { BadRequestException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { SoftDeleteModel } from '../../../common/interfaces/soft-delete-model.interface';
import { Organization } from '../../organizations/schemas/organization.schema';
import { CreatePropertyDto } from '../dto/create-property.dto';
import { PropertiesService } from '../properties.service';
import { Property } from '../schemas/property.schema';

describe('PropertiesService', () => {
  let service: PropertiesService;
  let propertyModel: SoftDeleteModel<Property>;
  let organizationModel: SoftDeleteModel<Organization>;

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

  // Mock organization
  const mockOrganization = {
    _id: '507f1f77bcf86cd799439011',
    name: 'Test Organization',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Create a proper mock for the Property Mongoose model with soft delete functionality
  const mockPropertyModel = jest.fn(() => ({
    save: jest.fn().mockResolvedValue(mockProperty),
  })) as any;

  // Add soft delete methods to the property model
  mockPropertyModel.deleteById = jest.fn().mockResolvedValue({ acknowledged: true });
  mockPropertyModel.delete = jest.fn().mockResolvedValue({ acknowledged: true });
  mockPropertyModel.restore = jest.fn().mockResolvedValue({ acknowledged: true });
  mockPropertyModel.findDeleted = jest.fn().mockReturnValue({
    exec: jest.fn().mockResolvedValue([mockProperty]),
  });

  // Add static methods to the mock model
  mockPropertyModel.find = jest.fn().mockReturnValue({
    exec: jest.fn().mockResolvedValue([mockProperty]),
  });

  mockPropertyModel.findById = jest.fn().mockReturnValue({
    exec: jest.fn().mockResolvedValue(mockProperty),
  });

  mockPropertyModel.findByIdAndUpdate = jest.fn().mockReturnValue({
    exec: jest.fn().mockResolvedValue(mockProperty),
  });

  // Create a proper mock for the Organization Mongoose model
  const mockOrganizationModel = jest.fn(() => {
    return {};
  }) as any;

  // Add static methods to the organization mock model
  mockOrganizationModel.findById = jest.fn().mockReturnValue({
    exec: jest.fn().mockResolvedValue(mockOrganization),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PropertiesService,
        {
          provide: getModelToken('Property'),
          useValue: mockPropertyModel,
        },
        {
          provide: getModelToken('Organization'),
          useValue: mockOrganizationModel,
        },
      ],
    }).compile();

    service = module.get<PropertiesService>(PropertiesService);
    propertyModel = module.get<SoftDeleteModel<Property>>(getModelToken('Property'));
    organizationModel = module.get<SoftDeleteModel<Organization>>(getModelToken('Organization'));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new property with valid fields and return property data with unique ID', async () => {
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

      // Mock property model save to return property with ID
      const savedProperty = {
        ...mockProperty,
        _id: 'newly-created-id',
      };

      // Mock the constructor and save method
      mockPropertyModel.mockImplementation(() => ({
        save: jest.fn().mockResolvedValue(savedProperty),
      }));

      const result = await service.create(createPropertyDto);

      // Verify result contains property with ID
      expect(result).toEqual(savedProperty);
      expect(organizationModel.findById).toHaveBeenCalledWith(createPropertyDto.owner);
    });

    it('should handle invalid field formats and return 400 status with descriptive error', async () => {
      // Create DTO with invalid address format
      const invalidPropertyDto = {
        name: 'Test Property',
        address: 'invalid-address-format', // Should be an object
        owner: new Types.ObjectId('507f1f77bcf86cd799439011'),
      };

      // Mock organization check to pass
      jest.spyOn(mockOrganizationModel, 'findById').mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(mockOrganization),
      });

      // Mock property model to throw error when constructed with invalid data
      mockPropertyModel.mockImplementation(() => {
        throw new BadRequestException('Invalid address format');
      });

      // Expect service to throw BadRequestException
      await expect(service.create(invalidPropertyDto as any)).rejects.toThrow(BadRequestException);
    });

    it('should handle missing required fields and return 400 status with validation error', async () => {
      // Missing required name field
      const incompletePropertyDto = {
        address: {
          street: '123 Test St',
          city: 'Test City',
          state: 'Test State',
          postalCode: '12345',
          country: 'Test Country',
        },
        owner: new Types.ObjectId('507f1f77bcf86cd799439011'),
      };

      // Mock organization check to pass
      jest.spyOn(mockOrganizationModel, 'findById').mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(mockOrganization),
      });

      // Mock property model to throw error when constructed with incomplete data
      mockPropertyModel.mockImplementation(() => {
        throw new BadRequestException('name should not be empty');
      });

      // Expect service to throw BadRequestException
      await expect(service.create(incompletePropertyDto as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should verify database contains the new property record after successful creation', async () => {
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

      // Create a spy to verify save is called
      const saveSpy = jest.fn().mockResolvedValue(mockProperty);

      // Mock the constructor and save method
      mockPropertyModel.mockImplementation(() => ({
        save: saveSpy,
      }));

      // Mock organization check to pass
      jest.spyOn(mockOrganizationModel, 'findById').mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(mockOrganization),
      });

      await service.create(createPropertyDto);

      // Verify save was called to persist to database
      expect(saveSpy).toHaveBeenCalled();
    });

    it('should throw BadRequestException if organization does not exist', async () => {
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

      mockPropertyModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      // Reset previous mocks to ensure proper behavior
      mockPropertyModel.mockReset();

      // Mock property model to throw exception when organization not found
      mockPropertyModel.mockImplementation(() => {
        throw new BadRequestException(`Organization with ID ${createPropertyDto.owner} not found`);
      });

      await expect(service.create(createPropertyDto)).rejects.toThrow(BadRequestException);
      expect(organizationModel.findById).toHaveBeenCalledWith(createPropertyDto.owner);
    });
  });
});
