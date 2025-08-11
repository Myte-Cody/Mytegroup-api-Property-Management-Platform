import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "../src/app.module";
import { MongooseModule } from "@nestjs/mongoose";
import { ConfigModule } from "@nestjs/config";
import { MongoMemoryServer } from "mongodb-memory-server";
import { Types } from "mongoose";

describe("Properties Resource (e2e)", () => {
  let app: INestApplication;
  let mongoMemoryServer: MongoMemoryServer;
  let propertyId: string;

  beforeAll(async () => {
    // Create an in-memory MongoDB instance for testing
    mongoMemoryServer = await MongoMemoryServer.create();
    const uri = mongoMemoryServer.getUri();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: ".env.test",
        }),
        MongooseModule.forRoot(uri),
        AppModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await mongoMemoryServer.stop();
  });

  it("should create a property (POST /properties)", () => {
    return request(app.getHttpServer())
      .post("/properties")
      .send({
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
      })
      .expect(201)
      .then((response) => {
        expect(response.body).toHaveProperty("_id");
        expect(response.body.name).toBe("Test Property");
        expect(response.body.address.street).toBe("123 Test St");
        propertyId = response.body._id;
      });
  });

  it("should get all properties (GET /properties)", () => {
    return request(app.getHttpServer())
      .get("/properties")
      .expect(200)
      .then((response) => {
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThan(0);
      });
  });

  it("should get a property by ID (GET /properties/:id)", () => {
    return request(app.getHttpServer())
      .get(`/properties/${propertyId}`)
      .expect(200)
      .then((response) => {
        expect(response.body).toHaveProperty("_id", propertyId);
        expect(response.body.name).toBe("Test Property");
      });
  });

  it("should update a property (PATCH /properties/:id)", () => {
    return request(app.getHttpServer())
      .patch(`/properties/${propertyId}`)
      .send({
        name: "Updated Property",
        units: 15,
      })
      .expect(200)
      .then((response) => {
        expect(response.body).toHaveProperty("_id", propertyId);
        expect(response.body.name).toBe("Updated Property");
        expect(response.body.units).toBe(15);
        expect(response.body.address.street).toBe("123 Test St");
      });
  });

  it("should delete a property (DELETE /properties/:id)", () => {
    return request(app.getHttpServer())
      .delete(`/properties/${propertyId}`)
      .expect(200)
      .then((response) => {
        expect(response.body).toHaveProperty("_id", propertyId);
      });
  });

  it("should return 404 when getting a deleted property", () => {
    return request(app.getHttpServer())
      .get(`/properties/${propertyId}`)
      .expect(404);
  });
});
