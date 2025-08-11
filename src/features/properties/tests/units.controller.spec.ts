import { Test, TestingModule } from "@nestjs/testing";
import { UnitsController } from "../units.controller";
import { UnitsService } from "../units.service";
import { CreateUnitDto } from "../dto/create-unit.dto";
import { Types } from "mongoose";

describe("UnitsController", () => {
  let controller: UnitsController;
  let service: UnitsService;

  const mockUnit = {
    _id: "unit-mock-id",
    property: new Types.ObjectId("507f1f77bcf86cd799439011"),
    unitNumber: "101",
    floor: "1",
    sizeSqFt: 750,
    type: "Apartment",
    bedrooms: 2,
    bathrooms: 1,
    rentAmount: 1200,
    availabilityStatus: "Vacant",
    description: "Test unit description",
    tenants: [],
    leases: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUnitsService = {
    create: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UnitsController],
      providers: [
        {
          provide: UnitsService,
          useValue: mockUnitsService,
        },
      ],
    }).compile();

    controller = module.get<UnitsController>(UnitsController);
    service = module.get<UnitsService>(UnitsService);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("create", () => {
    it("should create a unit", async () => {
      const createUnitDto: CreateUnitDto = {
        property: new Types.ObjectId("507f1f77bcf86cd799439011"),
        unitNumber: "101",
        floor: "1",
        sizeSqFt: 750,
        type: "Apartment",
        bedrooms: 2,
        bathrooms: 1,
        rentAmount: 1200,
        availabilityStatus: "Vacant",
        description: "Test unit description",
      };

      mockUnitsService.create.mockResolvedValue(mockUnit);

      const result = await controller.create(createUnitDto);
      expect(result).toEqual(mockUnit);
      expect(mockUnitsService.create).toHaveBeenCalledWith(createUnitDto);
    });
  });
});
