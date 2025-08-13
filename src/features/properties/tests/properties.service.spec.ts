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
      owner: mockOrganization._id as Types.ObjectId,
    };

    it('should create a property when organization exists', async () => {
      organizationModel.findById.mockReturnValue({
        exec: () => Promise.resolve(mockOrganization as Organization),
      } as any);

      const savedProperty = { ...mockProperty, _id: new Types.ObjectId() };

      const mockInstance = {
        save: jest.fn().mockResolvedValue(savedProperty),
      };
      propertyModel.mockImplementationOnce(() => mockInstance);

      const result = await service.create(validDto);

      expect(organizationModel.findById).toHaveBeenCalledWith(validDto.owner);
      expect(mockInstance.save).toHaveBeenCalled();
      expect(result).toEqual(savedProperty);
    });

    it('should throw BadRequestException if organization does not exist', async () => {
      organizationModel.findById.mockReturnValue({
        exec: () => Promise.resolve(null),
      } as any);

      await expect(service.create(validDto)).rejects.toThrow(BadRequestException);
    });

    it('should handle repository save errors', async () => {
      organizationModel.findById.mockReturnValue({
        exec: () => Promise.resolve(mockOrganization as Organization),
      } as any);

      // Mock the constructor to return an instance with save method that throws
      const mockInstance = {
        save: jest.fn().mockRejectedValue(new Error('DB error')),
      };
      propertyModel.mockImplementationOnce(() => mockInstance);

      await expect(service.create(validDto)).rejects.toThrow('DB error');
    });
  });
});
