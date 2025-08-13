import { NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Model, Types } from 'mongoose';
import { CreatePropertyDto } from '../dto/create-property.dto';
import { UpdatePropertyDto } from '../dto/update-property.dto';
import { PropertiesService } from '../properties.service';
import { Property } from '../schemas/property.schema';

describe('PropertiesService', () => {
  let service: PropertiesService;
  let model: Model<Property>;

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

  // Create a proper mock for the Mongoose model
  const mockPropertyModel = function () {
    return {
      save: jest.fn().mockResolvedValue(mockProperty),
    };
  } as any;

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

  mockPropertyModel.findByIdAndDelete = jest.fn().mockReturnValue({
    exec: jest.fn().mockResolvedValue(mockProperty),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PropertiesService,
        {
          provide: getModelToken('Property'),
          useValue: mockPropertyModel,
        },
      ],
    }).compile();

    service = module.get<PropertiesService>(PropertiesService);
    model = module.get<Model<Property>>(getModelToken('Property'));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new property', async () => {
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
        units: [],
      };

      const result = await service.create(createPropertyDto);
      expect(result).toEqual(mockProperty);
    });
  });

  describe('findAll', () => {
    it('should return an array of properties', async () => {
      const properties = [mockProperty];
      mockPropertyModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue(properties),
      });

      const result = await service.findAll();
      expect(result).toEqual(properties);
    });
  });

  describe('findOne', () => {
    it('should return a single property', async () => {
      mockPropertyModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockProperty),
      });

      const result = await service.findOne('a-mock-id');
      expect(result).toEqual(mockProperty);
    });

    it('should throw NotFoundException if property not found', async () => {
      mockPropertyModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.findOne('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a property', async () => {
      const updatePropertyDto: UpdatePropertyDto = { name: 'Updated Property' };
      mockPropertyModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockProperty,
          name: 'Updated Property',
        }),
      });

      const result = await service.update('a-mock-id', updatePropertyDto);
      expect(result.name).toEqual('Updated Property');
    });

    it('should throw NotFoundException if property not found', async () => {
      mockPropertyModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.update('non-existent-id', { name: 'Updated Property' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should delete a property', async () => {
      mockPropertyModel.findByIdAndDelete.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockProperty),
      });

      const result = await service.remove('a-mock-id');
      expect(result).toEqual(mockProperty);
    });

    it('should throw NotFoundException if property not found', async () => {
      mockPropertyModel.findByIdAndDelete.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.remove('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });
});
