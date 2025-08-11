import { Test, TestingModule } from "@nestjs/testing";
import { PropertiesController } from "../properties.controller";
import { PropertiesService } from "../properties.service";
import { CreatePropertyDto } from "../dto/create-property.dto";
import { UpdatePropertyDto } from "../dto/update-property.dto";
import { Types } from "mongoose";

describe("PropertiesController", () => {
  let controller: PropertiesController;
  let service: PropertiesService;

  const mockProperty = {
    _id: "a-mock-id",
    name: "Test Property",
    address: {
      street: "123 Test St",
      city: "Test City",
      state: "Test State",
      postalCode: "12345",
      country: "Test Country",
    },
    owner: new Types.ObjectId("507f1f77bcf86cd799439011"),
    status: "Active",
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

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("create", () => {
    it("should create a property", async () => {
      const createPropertyDto: CreatePropertyDto = {
        name: "Test Property",
        address: {
          street: "123 Test St",
          city: "Test City",
          state: "Test State",
          postalCode: "12345",
          country: "Test Country",
        },
        owner: new Types.ObjectId("507f1f77bcf86cd799439011"),
        units: [],
      };

      mockPropertiesService.create.mockResolvedValue(mockProperty);

      const result = await controller.create(createPropertyDto);
      expect(result).toEqual(mockProperty);
      expect(mockPropertiesService.create).toHaveBeenCalledWith(
        createPropertyDto,
      );
    });
  });

  describe("findAll", () => {
    it("should return an array of properties", async () => {
      const properties = [mockProperty];
      mockPropertiesService.findAll.mockResolvedValue(properties);

      const result = await controller.findAll();
      expect(result).toEqual(properties);
      expect(mockPropertiesService.findAll).toHaveBeenCalled();
    });
  });

  describe("findOne", () => {
    it("should return a single property", async () => {
      mockPropertiesService.findOne.mockResolvedValue(mockProperty);

      const result = await controller.findOne("a-mock-id");
      expect(result).toEqual(mockProperty);
      expect(mockPropertiesService.findOne).toHaveBeenCalledWith("a-mock-id");
    });
  });

  describe("update", () => {
    it("should update a property", async () => {
      const updatePropertyDto: UpdatePropertyDto = { name: "Updated Property" };
      const updatedProperty = { ...mockProperty, name: "Updated Property" };

      mockPropertiesService.update.mockResolvedValue(updatedProperty);

      const result = await controller.update("a-mock-id", updatePropertyDto);
      expect(result).toEqual(updatedProperty);
      expect(mockPropertiesService.update).toHaveBeenCalledWith(
        "a-mock-id",
        updatePropertyDto,
      );
    });
  });

  describe("remove", () => {
    it("should remove a property", async () => {
      mockPropertiesService.remove.mockResolvedValue(mockProperty);

      const result = await controller.remove("a-mock-id");
      expect(result).toEqual(mockProperty);
      expect(mockPropertiesService.remove).toHaveBeenCalledWith("a-mock-id");
    });
  });
});
