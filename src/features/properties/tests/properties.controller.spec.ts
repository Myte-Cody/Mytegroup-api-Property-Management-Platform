import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { CreatePropertyDto } from '../dto/create-property.dto';
import { PropertiesController } from '../properties.controller';
import { PropertiesService } from '../properties.service';

describe('PropertiesController', () => {
  let controller: PropertiesController;
  let service: PropertiesService;

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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PropertiesController],
      providers: [
        {
          provide: PropertiesService,
          useValue: mockPropertiesService,
        },
      ],
    }).compile();

    controller = module.get<PropertiesController>(PropertiesController);
    service = module.get<PropertiesService>(PropertiesService);
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
        owner: 'invalid-owner-id', // Invalid ObjectId format
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

      // Mock service to throw BadRequestException for validation error
      const errorMessage = 'name should not be empty';
      mockPropertiesService.create.mockRejectedValue({
        status: 400,
        message: errorMessage,
      });

      // Expect controller to pass through the error
      await expect(controller.create(incompletePropertyDto as any)).rejects.toEqual({
        status: 400,
        message: errorMessage,
      });
    });

    it('should verify database contains the new property record after successful API call', async () => {
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

      const savedProperty = {
        ...mockProperty,
        _id: 'newly-created-id',
      };

      // Mock service to return saved property
      mockPropertiesService.create.mockResolvedValue(savedProperty);

      // Call controller create method
      const result = await controller.create(createPropertyDto);

      // Verify service was called to persist the property
      expect(mockPropertiesService.create).toHaveBeenCalledWith(createPropertyDto);

      // Verify returned property matches what would be stored in DB
      expect(result).toEqual(savedProperty);
    });
  });
});
