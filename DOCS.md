# Myte Estates API - Backend Documentation

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Tech Stack](#tech-stack)
4. [Project Structure](#project-structure)
5. [Getting Started](#getting-started)
6. [Core Concepts](#core-concepts)
7. [API Endpoints](#api-endpoints)
8. [Database Schema](#database-schema)
9. [Background Jobs](#background-jobs)
10. [Real-Time Features](#real-time-features)
11. [Testing](#testing)
12. [Deployment](#deployment)
13. [Best Practices](#best-practices)

---

## Overview

The **Myte Estates API** is a NestJS-based backend service providing RESTful APIs for a multi-tenant property management platform. It handles authentication, property management, lease tracking, maintenance tickets, payments, and more.

### Key Features

- **Multi-tenant architecture** with organization-based data isolation
- **Role-based access control** (RBAC) with CASL
- **Real-time communications** via Socket.IO
- **Background job processing** with BullMQ and Redis
- **Payment processing** via Stripe
- **AI integrations** with OpenAI
- **File storage** on AWS S3
- **Email/SMS notifications**

### System Architecture

```
┌─────────────┐
│  Next.js    │
│  Frontend   │
└──────┬──────┘
       │ HTTP/WebSocket
       ↓
┌─────────────────┐
│   NestJS API    │ ← This service
│   (Port 3000)   │
└────────┬────────┘
         │
    ┌────┴────┬──────────┬────────────┐
    ↓         ↓          ↓            ↓
┌────────┐ ┌─────┐  ┌────────┐  ┌──────────┐
│MongoDB │ │Redis│  │AWS S3  │  │  Stripe  │
└────────┘ └─────┘  └────────┘  └──────────┘
         ↓
┌─────────────────┐
│Python AI Service│
│   (FastAPI)     │
└─────────────────┘
```

---

## Architecture

### Multi-Tenancy

The API uses **organization-based multi-tenancy**:

- Each request is scoped to an organization via JWT claims
- Data isolation enforced at the database query level
- Tenant context automatically injected using decorators

```typescript
// Automatic tenant scoping in controllers
@Controller('properties')
export class PropertiesController {
  @Get()
  async findAll(@TenantId() organizationId: string) {
    // organizationId extracted from JWT automatically
    return this.propertiesService.findAll(organizationId);
  }
}
```

### Authentication Flow

1. User registers or logs in → receives JWT access token + refresh token
2. Access token contains: `userId`, `email`, `role`, `organizationId`
3. Protected routes validate JWT via `JwtAuthGuard`
4. Refresh token used to obtain new access tokens

```typescript
// JWT Payload Structure
interface JwtPayload {
  sub: string; // User ID
  email: string;
  role: Role;
  organizationId: string;
  iat: number;
  exp: number;
}
```

### Authorization (CASL)

Fine-grained permissions using **CASL** (ability-based):

```typescript
// Define abilities per role
if (user.role === Role.LANDLORD) {
  can('manage', 'Property');
  can('manage', 'Tenant');
  can('read', 'Maintenance');
} else if (user.role === Role.TENANT) {
  can('read', 'Property');
  can('create', 'Maintenance');
  can('read', 'Maintenance', { tenantId: user.id });
}

// Enforce in controllers
@UseGuards(JwtAuthGuard, PoliciesGuard)
@CheckPolicies((ability) => ability.can('create', 'Property'))
@Post()
async create(@Body() dto: CreatePropertyDto) { ... }
```

---

## Tech Stack

| Category       | Technology               | Version |
| -------------- | ------------------------ | ------- |
| Framework      | NestJS                   | 11.x    |
| Runtime        | Node.js                  | 22.21.1 |
| Language       | TypeScript               | 5.9.2   |
| Database       | MongoDB                  | 7       |
| ODM            | Mongoose                 | Latest  |
| Multi-tenancy  | mongo-tenant             | Latest  |
| Cache/Queue    | Redis + BullMQ           | 7       |
| Authentication | JWT, Passport.js, Argon2 | Latest  |
| Authorization  | CASL                     | Latest  |
| API Docs       | Swagger/OpenAPI          | Latest  |
| Testing        | Jest                     | Latest  |
| Email          | Nodemailer + Handlebars  | Latest  |
| SMS            | Twilio                   | Latest  |
| Storage        | AWS S3                   | Latest  |
| PDF Generation | Puppeteer                | Latest  |
| Real-time      | Socket.IO                | Latest  |
| Payments       | Stripe                   | Latest  |
| AI             | OpenAI API               | Latest  |

---

## Project Structure

```
api/
├── src/
│   ├── features/              # Domain-driven feature modules
│   │   ├── auth/              # Authentication & JWT
│   │   ├── users/             # User management
│   │   ├── properties/        # Properties & units
│   │   ├── leases/            # Lease agreements
│   │   ├── tenants/           # Tenant management
│   │   ├── landlords/         # Landlord management
│   │   ├── contractors/       # Contractor directory
│   │   ├── maintenance/       # Maintenance tickets
│   │   ├── expenses/          # Expense tracking
│   │   ├── revenues/          # Revenue management
│   │   ├── deposits/          # Security deposits
│   │   ├── payments/          # Stripe integration
│   │   ├── tasks/             # Task management
│   │   ├── schedules/         # Scheduling system
│   │   ├── chat/              # Real-time messaging
│   │   ├── notifications/     # Notification system
│   │   ├── email/             # Email queue
│   │   ├── sms/               # SMS notifications
│   │   ├── media/             # File uploads (S3)
│   │   ├── kpi/               # Analytics/KPIs
│   │   ├── ai/                # AI integration
│   │   ├── ai-chat/           # AI chatbot
│   │   ├── marketing-chat/    # Marketing bot
│   │   ├── feedback/          # User feedback
│   │   ├── onboarding/        # User onboarding
│   │   ├── availability/      # Property availability
│   │   ├── inquiries/         # Prospect inquiries
│   │   ├── invitations/       # User invitations
│   │   ├── feed-posts/        # Social feed
│   │   ├── favorites/         # Favorites system
│   │   ├── subscribers/       # Newsletter
│   │   └── admin/             # Admin features
│   ├── common/                # Shared utilities
│   │   ├── guards/            # Auth guards, CSRF protection
│   │   ├── decorators/        # Custom decorators (@TenantId, @CurrentUser)
│   │   ├── interceptors/      # HTTP interceptors
│   │   ├── pipes/             # Validation pipes
│   │   ├── filters/           # Exception filters
│   │   ├── casl/              # Permission definitions
│   │   ├── services/          # Shared services
│   │   └── utils/             # Utility functions
│   ├── commands/              # CLI commands (nest-commander)
│   ├── scripts/               # Background scripts
│   ├── scheduler/             # Cron jobs (@nestjs/schedule)
│   ├── config/                # Configuration files
│   ├── shared/                # Shared types/constants
│   └── main.ts                # Application entry point
├── ai_features/               # Python AI microservice
│   ├── invoice_classifier/    # Invoice ML model
│   └── voice_assistant/       # Voice AI
├── test/                      # E2E tests
├── uploads/                   # Local file storage (dev)
├── dist/                      # Compiled output
├── docker-compose.yml         # Local development stack
└── Dockerfile                 # Production container
```

### Feature Module Structure

Each feature follows a consistent pattern:

```
features/properties/
├── properties.module.ts       # Module definition
├── properties.controller.ts   # REST endpoints
├── properties.service.ts      # Business logic
├── properties.gateway.ts      # WebSocket gateway (if needed)
├── dto/                       # Data Transfer Objects
│   ├── create-property.dto.ts
│   ├── update-property.dto.ts
│   └── query-property.dto.ts
├── schemas/                   # Mongoose schemas
│   └── property.schema.ts
├── interfaces/                # TypeScript interfaces
└── properties.service.spec.ts # Unit tests
```

---

## Getting Started

### Prerequisites

- **Node.js** 22.21.1+
- **npm** 10.9.4+
- **Docker** and **Docker Compose**
- **MongoDB** 7+ (via Docker)
- **Redis** 7+ (via Docker)

### Installation

```bash
# Navigate to API directory
cd api

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
```

### Environment Variables

Edit `.env` with your configuration:

```bash
# Application
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:3001

# Database
DATABASE_URL=mongodb://localhost:27017/mytegroup

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your-secret-key-change-in-production
JWT_REFRESH_SECRET=your-refresh-secret-key
JWT_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

# AWS S3
AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret
AWS_REGION=us-east-1
S3_BUCKET_NAME=mytegroup-dev

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# OpenAI
OPENAI_API_KEY=sk-...

# Twilio
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1234567890

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

### Running the Application

#### Using Docker (Recommended)

```bash
# Start MongoDB and Redis
docker-compose up -d mongodb redis

# Start API in development mode
npm run start:dev

# API available at http://localhost:3000
# Swagger docs at http://localhost:3000/api
```

#### Using Docker for Everything

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f api
```

### Development Commands

```bash
# Development mode (hot reload)
npm run start:dev

# Production build
npm run build
npm run start:prod

# Run tests
npm run test
npm run test:e2e
npm run test:cov

# Linting and formatting
npm run lint
npm run format

# Database seeding
npm run seed

# CLI commands
npm run cli -- <command>
```

### Creating a New Feature Module

```bash
# Generate module, controller, service
nest generate module features/my-feature
nest generate controller features/my-feature
nest generate service features/my-feature

# Generate with spec files
nest generate service features/my-feature --spec
```

---

## Core Concepts

### 1. Dependency Injection

NestJS uses dependency injection extensively:

```typescript
@Injectable()
export class PropertiesService {
  constructor(
    @InjectModel(Property.name) private propertyModel: Model<Property>,
    private readonly tenantsService: TenantsService,
  ) {}
}
```

### 2. DTOs and Validation

Use DTOs with `class-validator` for input validation:

```typescript
import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';

export class CreatePropertyDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(PropertyType)
  type: PropertyType;

  @IsOptional()
  @IsString()
  description?: string;
}
```

### 3. Mongoose Schemas

Define MongoDB schemas with decorators:

```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Property extends Document {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, index: true })
  organizationId: string;

  @Prop({ type: Object })
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
  };

  @Prop({ default: 'ACTIVE' })
  status: string;
}

export const PropertySchema = SchemaFactory.createForClass(Property);
```

### 4. Custom Decorators

Extract common patterns into decorators:

```typescript
// @CurrentUser() - Get current user from request
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);

// @TenantId() - Get organization ID from JWT
export const TenantId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user?.organizationId;
  },
);

// Usage
@Get()
async findAll(
  @TenantId() organizationId: string,
  @CurrentUser() user: User,
) {
  return this.service.findAll(organizationId);
}
```

### 5. Exception Handling

Use built-in HTTP exceptions:

```typescript
import { NotFoundException, BadRequestException } from '@nestjs/common';

async findOne(id: string) {
  const property = await this.propertyModel.findById(id);
  if (!property) {
    throw new NotFoundException(`Property with ID ${id} not found`);
  }
  return property;
}
```

---

## API Endpoints

### Authentication

#### POST `/auth/register`

Register a new user and organization

**Request:**

```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "firstName": "John",
  "lastName": "Doe",
  "organizationName": "My Company"
}
```

**Response:**

```json
{
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc...",
  "user": {
    "id": "123",
    "email": "user@example.com",
    "role": "LANDLORD"
  }
}
```

#### POST `/auth/login`

Login with email and password

#### POST `/auth/refresh`

Refresh access token

#### POST `/auth/forgot-password`

Request password reset

#### POST `/auth/reset-password`

Reset password with token

### Properties

#### GET `/properties`

List all properties (organization-scoped)

**Query params:**

- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)
- `search`: Search term
- `status`: Filter by status

#### POST `/properties`

Create a new property

**Request:**

```json
{
  "name": "Sunset Apartments",
  "address": {
    "street": "123 Main St",
    "city": "San Francisco",
    "state": "CA",
    "zipCode": "94102"
  },
  "type": "APARTMENT",
  "units": 10
}
```

#### GET `/properties/:id`

Get property details

#### PATCH `/properties/:id`

Update property

#### DELETE `/properties/:id`

Delete property (soft delete)

### Maintenance Tickets

#### POST `/maintenance`

Create maintenance ticket

**Request:**

```json
{
  "propertyId": "prop_123",
  "unitId": "unit_456",
  "title": "Broken AC",
  "description": "AC not cooling properly",
  "priority": "HIGH",
  "category": "HVAC"
}
```

#### GET `/maintenance/:id`

Get ticket with threads

#### PATCH `/maintenance/:id/assign`

Assign ticket to contractor

#### POST `/maintenance/:id/threads`

Add comment to ticket

### Payments

#### POST `/payments/create-payment-intent`

Create Stripe payment intent

**Request:**

```json
{
  "amount": 150000, // $1500.00 in cents
  "leaseId": "lease_123"
}
```

### Full Documentation

Access interactive API documentation:

- **Swagger UI**: http://localhost:3000/api
- **OpenAPI JSON**: http://localhost:3000/api-json

---

## Database Schema

### Collections Overview

#### Users

```typescript
{
  _id: ObjectId,
  email: string (unique, indexed),
  passwordHash: string,
  firstName: string,
  lastName: string,
  role: 'ADMIN' | 'LANDLORD' | 'TENANT' | 'CONTRACTOR' | 'STAFF',
  organizationId: ObjectId (indexed),
  phone?: string,
  avatar?: string,
  isEmailVerified: boolean,
  createdAt: Date,
  updatedAt: Date
}
```

#### Properties

```typescript
{
  _id: ObjectId,
  organizationId: ObjectId (indexed),
  name: string,
  type: 'APARTMENT' | 'HOUSE' | 'CONDO' | 'COMMERCIAL',
  address: {
    street: string,
    city: string,
    state: string,
    zipCode: string,
    coordinates?: { lat: number, lng: number }
  },
  units: [{ unitNumber: string, ... }],
  amenities: string[],
  images: string[],
  status: 'ACTIVE' | 'INACTIVE',
  createdAt: Date,
  updatedAt: Date
}
```

#### Leases

```typescript
{
  _id: ObjectId,
  organizationId: ObjectId (indexed),
  propertyId: ObjectId,
  unitId: ObjectId,
  tenantId: ObjectId,
  startDate: Date,
  endDate: Date,
  rentAmount: number,
  depositAmount: number,
  status: 'ACTIVE' | 'EXPIRED' | 'TERMINATED' | 'PENDING',
  autoRenew: boolean,
  createdAt: Date,
  updatedAt: Date
}
```

#### Maintenance Tickets

```typescript
{
  _id: ObjectId,
  organizationId: ObjectId (indexed),
  propertyId: ObjectId,
  unitId: ObjectId,
  tenantId: ObjectId,
  assignedContractorId?: ObjectId,
  title: string,
  description: string,
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT',
  category: 'PLUMBING' | 'ELECTRICAL' | 'HVAC' | 'APPLIANCE' | 'OTHER',
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED',
  threads: [{
    userId: ObjectId,
    message: string,
    attachments: string[],
    createdAt: Date
  }],
  createdAt: Date,
  updatedAt: Date
}
```

### Indexes

Critical indexes for performance:

```typescript
// Users
users.createIndex({ email: 1 }, { unique: true });
users.createIndex({ organizationId: 1 });

// Properties
properties.createIndex({ organizationId: 1 });
properties.createIndex({ status: 1 });

// Leases
leases.createIndex({ organizationId: 1 });
leases.createIndex({ tenantId: 1 });
leases.createIndex({ status: 1 });

// Maintenance
maintenance.createIndex({ organizationId: 1 });
maintenance.createIndex({ status: 1 });
maintenance.createIndex({ assignedContractorId: 1 });
```

---

## Background Jobs

### BullMQ Queues

#### Email Queue

**Producer:**

```typescript
@Injectable()
export class EmailService {
  constructor(@InjectQueue('email') private emailQueue: Queue) {}

  async sendWelcomeEmail(to: string, data: any) {
    await this.emailQueue.add('welcome', { to, data });
  }
}
```

**Consumer:**

```typescript
@Processor('email')
export class EmailProcessor {
  @Process('welcome')
  async handleWelcome(job: Job) {
    const { to, data } = job.data;
    await this.mailerService.sendMail({
      to,
      subject: 'Welcome to Myte Estates',
      template: 'welcome',
      context: data,
    });
  }
}
```

#### Available Queues

- **email**: Email notifications
- **sms**: SMS notifications
- **feedback-analysis**: AI-powered feedback analysis

### Cron Jobs

Using `@nestjs/schedule`:

```typescript
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class LeaseScheduler {
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async checkLeaseExpirations() {
    // Check for expiring leases and send notifications
  }
}
```

---

## Real-Time Features

### WebSocket Gateways

#### Chat Gateway

```typescript
@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    // Authenticate and join rooms
  }

  @SubscribeMessage('sendMessage')
  async handleMessage(@MessageBody() data: SendMessageDto, @ConnectedSocket() client: Socket) {
    // Save message to database
    const message = await this.chatService.createMessage(data);

    // Broadcast to room
    this.server.to(data.roomId).emit('newMessage', message);
  }
}
```

#### Authentication in Gateways

```typescript
handleConnection(client: Socket) {
  const token = client.handshake.auth.token;
  const user = this.authService.verifyToken(token);

  if (!user) {
    client.disconnect();
    return;
  }

  client.data.user = user;
}
```

---

## Testing

### Unit Tests

```typescript
describe('PropertiesService', () => {
  let service: PropertiesService;
  let model: Model<Property>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PropertiesService,
        {
          provide: getModelToken(Property.name),
          useValue: {
            find: jest.fn(),
            findById: jest.fn(),
            create: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PropertiesService>(PropertiesService);
    model = module.get<Model<Property>>(getModelToken(Property.name));
  });

  it('should find all properties', async () => {
    const mockProperties = [{ name: 'Test Property' }];
    jest.spyOn(model, 'find').mockReturnValue({
      exec: jest.fn().resolveValue(mockProperties),
    } as any);

    const result = await service.findAll('org_123');
    expect(result).toEqual(mockProperties);
  });
});
```

### E2E Tests

```typescript
describe('Properties (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Login to get token
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'test@example.com', password: 'password' });

    accessToken = response.body.accessToken;
  });

  it('GET /properties should return properties', () => {
    return request(app.getHttpServer())
      .get('/properties')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
  });
});
```

### Run Tests

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Coverage
npm run test:cov

# Watch mode
npm run test:watch
```

---

## Deployment

### Production Environment

#### Infrastructure

- **Platform**: AWS ECS (EC2 Launch Type)
- **Database**: MongoDB Atlas
- **Cache**: AWS ElastiCache for Redis
- **Storage**: AWS S3
- **Container Registry**: AWS ECR

#### Docker Build

```bash
# Build image
docker build -t mytegroup-api:latest .

# Tag for ECR
docker tag mytegroup-api:latest <account>.dkr.ecr.<region>.amazonaws.com/mytegroup-api:latest

# Push to ECR
aws ecr get-login-password --region <region> | docker login --username AWS --password-stdin <account>.dkr.ecr.<region>.amazonaws.com
docker push <account>.dkr.ecr.<region>.amazonaws.com/mytegroup-api:latest
```

#### Environment Variables (Production)

```bash
NODE_ENV=production
PORT=3000
DATABASE_URL=mongodb+srv://user:pass@cluster.mongodb.net/mytegroup
REDIS_HOST=production-redis.cache.amazonaws.com
JWT_SECRET=<secure-random-string>
AWS_ACCESS_KEY_ID=<aws-key>
AWS_SECRET_ACCESS_KEY=<aws-secret>
S3_BUCKET_NAME=mytegroup-production
STRIPE_SECRET_KEY=sk_live_...
```

#### Health Checks

Endpoints for monitoring:

- `GET /health` - Application health
- `GET /health/db` - Database connectivity
- `GET /health/redis` - Redis connectivity

---

## Best Practices

### 1. Always Scope Queries by Organization

```typescript
// Good
async findAll(organizationId: string) {
  return this.model.find({ organizationId }).exec();
}

// Bad - missing organization scope
async findAll() {
  return this.model.find().exec();
}
```

### 2. Use DTOs for Validation

```typescript
// Good
@Post()
async create(@Body() dto: CreatePropertyDto) {
  return this.service.create(dto);
}

// Bad - no validation
@Post()
async create(@Body() data: any) {
  return this.service.create(data);
}
```

### 3. Handle Errors Properly

```typescript
// Good
async findOne(id: string) {
  const property = await this.model.findById(id);
  if (!property) {
    throw new NotFoundException(`Property ${id} not found`);
  }
  return property;
}
```

### 4. Use Transactions for Multi-Collection Operations

```typescript
async createLeaseWithDeposit(dto: CreateLeaseDto) {
  const session = await this.connection.startSession();
  session.startTransaction();

  try {
    const lease = await this.leaseModel.create([dto], { session });
    const deposit = await this.depositModel.create([{ leaseId: lease[0]._id }], { session });

    await session.commitTransaction();
    return lease[0];
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}
```

### 5. Use Indexes for Frequent Queries

```typescript
@Schema({ timestamps: true })
export class Property {
  @Prop({ required: true, index: true })
  organizationId: string;

  @Prop({ index: true })
  status: string;
}
```

---

## Additional Resources

- **NestJS Documentation**: https://docs.nestjs.com
- **Mongoose Documentation**: https://mongoosejs.com/docs
- **BullMQ Documentation**: https://docs.bullmq.io
- **Swagger Documentation**: http://localhost:3000/api

---

**Last Updated**: January 2026
**Version**: 1.0.0
