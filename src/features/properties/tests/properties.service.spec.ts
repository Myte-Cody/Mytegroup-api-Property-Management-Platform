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
  let unitModel: any;
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
      findByIdAndUpdate: jest.Mock;
      deleteById: jest.Mock;
    };

    mockModelWithMethods.findById = jest.fn().mockReturnValue({
      exec: jest.fn(),
    });
    mockModelWithMethods.find = jest.fn().mockReturnValue({
      exec: jest.fn(),
    });
    mockModelWithMethods.findByIdAndUpdate = jest.fn().mockReturnValue({
      exec: jest.fn(),
    });
    mockModelWithMethods.deleteById = jest.fn();

    // Assign the mock to propertyModel
    propertyModel = mockModelWithMethods;

    // Create unit model mock
    const unitModelMock = jest.fn().mockImplementation(() => ({
      save: jest.fn(),
    }));
    
    const mockUnitModelWithMethods = unitModelMock as jest.Mock & {
      find: jest.Mock;
      findById: jest.Mock;
    };

    mockUnitModelWithMethods.find = jest.fn().mockReturnValue({
      exec: jest.fn(),
    });
    mockUnitModelWithMethods.findById = jest.fn().mockReturnValue({
      exec: jest.fn(),
    });
    
    unitModel = mockUnitModelWithMethods;

    organizationModel = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<SoftDeleteModel<Organization>>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PropertiesService,
        { provide: getModelToken('Property'), useValue: propertyModel },
        { provide: getModelToken('Unit'), useValue: unitModel },
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

  describe('update', () => {
    const propertyId = '507f1f77bcf86cd799439011';
    const updatePropertyDto = {
      name: 'Updated Property Name',
      description: 'Updated property description',
      address: {
        street: '456 Updated St',
        city: 'Updated City',
        state: 'UC',
        postalCode: '54321',
        country: 'Updated Country',
      },
    };

    const existingProperty = {
      _id: new Types.ObjectId(propertyId),
      name: 'Original Property',
      address: {
        street: '123 Original St',
        city: 'Original City',
        state: 'OC',
        postalCode: '12345',
        country: 'Original Country',
      },
      owner: new Types.ObjectId('507f1f77bcf86cd799439011'),
      createdAt: new Date('2023-01-01'),
      updatedAt: new Date('2023-01-01'),
    };

    const updatedProperty = {
      ...existingProperty,
      ...updatePropertyDto,
      updatedAt: new Date('2023-01-02'),
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    describe('Successful Updates', () => {
      it('should successfully update a property when it exists', async () => {
        // Mock findById to return existing property
        const mockFindByIdExec = jest.fn().mockResolvedValue(existingProperty);
        propertyModel.findById.mockReturnValue({ exec: mockFindByIdExec });

        // Mock findByIdAndUpdate to return updated property
        const mockUpdateExec = jest.fn().mockResolvedValue(updatedProperty);
        propertyModel.findByIdAndUpdate = jest.fn().mockReturnValue({ exec: mockUpdateExec });

        const result = await service.update(propertyId, updatePropertyDto);

        // Verify the service logic: check existence first, then update
        expect(propertyModel.findById).toHaveBeenCalledWith(propertyId);
        expect(propertyModel.findByIdAndUpdate).toHaveBeenCalledWith(
          propertyId,
          updatePropertyDto,
          { new: true },
        );
        expect(result).toBe(updatedProperty);
      });

      it('should pass any update DTO to findByIdAndUpdate without modification', async () => {
        // Test that service doesn't modify the DTO - this is the real logic we're testing
        const complexUpdateDto = {
          name: 'Complex Name',
          address: {
            street: 'Street',
            city: 'City',
            state: 'State',
            postalCode: '12345',
            country: 'Country',
          },
          description: 'Description',
          customField: 'should pass through',
        };

        const mockFindByIdExec = jest.fn().mockResolvedValue(existingProperty);
        propertyModel.findById.mockReturnValue({ exec: mockFindByIdExec });

        const mockUpdateExec = jest.fn().mockResolvedValue(updatedProperty);
        propertyModel.findByIdAndUpdate = jest.fn().mockReturnValue({ exec: mockUpdateExec });

        await service.update(propertyId, complexUpdateDto);

        // The key assertion: service passes DTO unchanged to database
        expect(propertyModel.findByIdAndUpdate).toHaveBeenCalledWith(
          propertyId,
          complexUpdateDto, // Should be exact same object reference
          { new: true },
        );
      });
    });

    describe('Property Not Found Scenarios', () => {
      it('should throw NotFoundException when property does not exist', async () => {
        // Mock findById to return null (property not found)
        const mockFindByIdExec = jest.fn().mockResolvedValue(null);
        propertyModel.findById.mockReturnValue({ exec: mockFindByIdExec });

        await expect(service.update(propertyId, updatePropertyDto)).rejects.toThrow(
          `Property with ID ${propertyId} not found`,
        );

        // Verify findById was called
        expect(propertyModel.findById).toHaveBeenCalledWith(propertyId);
        expect(mockFindByIdExec).toHaveBeenCalled();

        // Verify findByIdAndUpdate was NOT called since property doesn't exist
        expect(propertyModel.findByIdAndUpdate).not.toHaveBeenCalled();
      });

      it('should throw NotFoundException with correct error message format', async () => {
        const customPropertyId = '60d21b4667d0d8992e610c85';
        const mockFindByIdExec = jest.fn().mockResolvedValue(null);
        propertyModel.findById.mockReturnValue({ exec: mockFindByIdExec });

        await expect(service.update(customPropertyId, updatePropertyDto)).rejects.toThrow(
          `Property with ID ${customPropertyId} not found`,
        );

        expect(propertyModel.findById).toHaveBeenCalledWith(customPropertyId);
      });
    });

    describe('Database Error Scenarios', () => {
      it('should propagate database errors from findById', async () => {
        const dbError = new Error('Database connection failed');
        const mockFindByIdExec = jest.fn().mockRejectedValue(dbError);
        propertyModel.findById.mockReturnValue({ exec: mockFindByIdExec });

        await expect(service.update(propertyId, updatePropertyDto)).rejects.toThrow(dbError);

        expect(propertyModel.findById).toHaveBeenCalledWith(propertyId);
        expect(propertyModel.findByIdAndUpdate).not.toHaveBeenCalled();
      });

      it('should propagate database errors from findByIdAndUpdate', async () => {
        const dbError = new Error('Update operation failed');

        const mockFindByIdExec = jest.fn().mockResolvedValue(existingProperty);
        propertyModel.findById.mockReturnValue({ exec: mockFindByIdExec });

        const mockUpdateExec = jest.fn().mockRejectedValue(dbError);
        propertyModel.findByIdAndUpdate = jest.fn().mockReturnValue({ exec: mockUpdateExec });

        await expect(service.update(propertyId, updatePropertyDto)).rejects.toThrow(dbError);

        expect(propertyModel.findById).toHaveBeenCalledWith(propertyId);
        expect(propertyModel.findByIdAndUpdate).toHaveBeenCalledWith(
          propertyId,
          updatePropertyDto,
          { new: true },
        );
      });
    });
  });

  describe('remove', () => {
    const propertyId = '507f1f77bcf86cd799439011';
    const existingProperty = {
      _id: new Types.ObjectId(propertyId),
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

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should successfully delete a property when it exists and has no active units', async () => {
      // Mock findById to return existing property
      const mockFindByIdExec = jest.fn().mockResolvedValue(existingProperty);
      propertyModel.findById.mockReturnValue({ exec: mockFindByIdExec });

      // Mock unit find to return empty array (no active units)
      const mockUnitFindExec = jest.fn().mockResolvedValue([]);
      unitModel.find.mockReturnValue({ exec: mockUnitFindExec });

      // Mock deleteById method
      propertyModel.deleteById = jest.fn().mockResolvedValue(undefined);

      const result = await service.remove(propertyId);

      expect(propertyModel.findById).toHaveBeenCalledWith(propertyId);
      expect(unitModel.find).toHaveBeenCalledWith({ 
        property: propertyId,
        deleted: { $ne: true }
      });
      expect(propertyModel.deleteById).toHaveBeenCalledWith(propertyId);
      expect(result).toEqual({ message: 'Property deleted successfully' });
    });

    it('should throw NotFoundException when property does not exist', async () => {
      // Mock findById to return null
      const mockFindByIdExec = jest.fn().mockResolvedValue(null);
      propertyModel.findById.mockReturnValue({ exec: mockFindByIdExec });

      await expect(service.remove(propertyId)).rejects.toThrow(
        `Property with ID ${propertyId} not found`,
      );

      expect(propertyModel.findById).toHaveBeenCalledWith(propertyId);
      expect(unitModel.find).not.toHaveBeenCalled();
      expect(propertyModel.deleteById).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when property has active units', async () => {
      // Mock findById to return existing property
      const mockFindByIdExec = jest.fn().mockResolvedValue(existingProperty);
      propertyModel.findById.mockReturnValue({ exec: mockFindByIdExec });

      // Mock unit find to return active units
      const activeUnits = [
        { _id: new Types.ObjectId(), unitNumber: '101', property: propertyId },
        { _id: new Types.ObjectId(), unitNumber: '102', property: propertyId },
      ];
      const mockUnitFindExec = jest.fn().mockResolvedValue(activeUnits);
      unitModel.find.mockReturnValue({ exec: mockUnitFindExec });

      await expect(service.remove(propertyId)).rejects.toThrow(
        'Cannot delete property. It has 2 active unit(s). Please delete all units first.',
      );

      expect(propertyModel.findById).toHaveBeenCalledWith(propertyId);
      expect(unitModel.find).toHaveBeenCalledWith({ 
        property: propertyId,
        deleted: { $ne: true }
      });
      expect(propertyModel.deleteById).not.toHaveBeenCalled();
    });
  });
});
