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
  let propertyModel: any; // Using any to avoid TypeScript issues
  let organizationModel: jest.Mocked<SoftDeleteModel<Organization>>;

  const mockProperty: Partial<Property> = {
    _id: new Types.ObjectId(),
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

  const mockOrganization: Partial<Organization> = {
    _id: new Types.ObjectId('507f1f77bcf86cd799439011'),
    name: 'Test Organization',
  };

  beforeEach(async () => {
    // Create a mock instance with save method
    const mockPropertyInstance = {
      save: jest.fn(),
    };

    const ModelMock = jest.fn().mockImplementation(() => mockPropertyInstance);

    const mockModelWithMethods = ModelMock as jest.Mock & {
      findById: jest.Mock;
      find: jest.Mock;
    };

    mockModelWithMethods.findById = jest.fn().mockReturnValue({
      exec: jest.fn(),
    });
    mockModelWithMethods.find = jest.fn().mockReturnValue({
      exec: jest.fn(),
    });

    // Assign the mock to propertyModel
    propertyModel = mockModelWithMethods;

    organizationModel = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<SoftDeleteModel<Organization>>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PropertiesService,
        { provide: getModelToken('Property'), useValue: propertyModel },
        { provide: getModelToken('Organization'), useValue: organizationModel },
      ],
    }).compile();

    service = module.get<PropertiesService>(PropertiesService);
  });

  describe('create', () => {
    const validDto: CreatePropertyDto = {
      name: 'Test Property',
      address: {
        street: '123 Test St',
        city: 'Test City',
        state: 'Test State',
        postalCode: '12345',
        country: 'Test Country',
      },
    };

    const ownerId = mockOrganization._id.toString();

    it('should create a property when organization exists', async () => {
      // Organization check is no longer needed in the service

      const savedProperty = { ...mockProperty, _id: new Types.ObjectId() };

      const mockInstance = {
        save: jest.fn().mockResolvedValue(savedProperty),
      };
      propertyModel.mockImplementationOnce(() => mockInstance);

      const result = await service.create(validDto, ownerId);

      // No longer checking organization in the service
      expect(mockInstance.save).toHaveBeenCalled();
      expect(result).toEqual(savedProperty);
    });

    it('should create a property with the provided owner ID', async () => {
      const customOwnerId = new Types.ObjectId();

      const savedProperty = { ...mockProperty, _id: new Types.ObjectId(), owner: customOwnerId };

      const mockInstance = {
        save: jest.fn().mockResolvedValue(savedProperty),
      };
      propertyModel.mockImplementationOnce(() => mockInstance);

      const result = await service.create(validDto, customOwnerId);

      expect(mockInstance.save).toHaveBeenCalled();
      expect(result).toEqual(savedProperty);
    });

    it('should handle repository save errors', async () => {
      // Mock the constructor to return an instance with save method that throws
      const mockInstance = {
        save: jest.fn().mockRejectedValue(new Error('DB error')),
      };
      propertyModel.mockImplementationOnce(() => mockInstance);

      await expect(service.create(validDto, ownerId)).rejects.toThrow('DB error');
    });
  });

  describe('findByLandlord', () => {
    const landlordId = '507f1f77bcf86cd799439011';
    const mockProperties = [
      { ...mockProperty, _id: new Types.ObjectId() },
      { ...mockProperty, _id: new Types.ObjectId() },
    ];
    
    // Reset mocks before each test
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should return properties for a specific landlord', async () => {
      // Mock find to return properties
      const mockExec = jest.fn().mockResolvedValue(mockProperties);
      const mockFind = jest.fn().mockReturnValue({ exec: mockExec });
      propertyModel.find.mockImplementation(mockFind);

      const result = await service.findByLandlord(landlordId);

      // Verify the query is constructed correctly with the landlord ID
      expect(propertyModel.find).toHaveBeenCalledWith({ owner: landlordId });
      
      // Verify exec() is called to execute the query
      expect(mockExec).toHaveBeenCalled();
      expect(mockExec).toHaveBeenCalledTimes(1);
      
      // Verify the result matches what the database returned
      expect(result).toBe(mockProperties);
      
      // Verify find was called exactly once
      expect(propertyModel.find).toHaveBeenCalledTimes(1);
    });
    
    it('should handle database errors when finding properties by landlord', async () => {
      // Create a database error
      const dbError = new Error('Database connection failed');
      
      // Mock find to throw an error
      const mockExec = jest.fn().mockRejectedValue(dbError);
      const mockFind = jest.fn().mockReturnValue({ exec: mockExec });
      propertyModel.find.mockImplementation(mockFind);

      // Verify the service propagates the error
      await expect(service.findByLandlord(landlordId)).rejects.toThrow(dbError);
      
      // Verify the query was constructed correctly despite the error
      expect(propertyModel.find).toHaveBeenCalledWith({ owner: landlordId });
      expect(mockExec).toHaveBeenCalled();
    });
  });
});
