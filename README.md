# Mytegroup API - Property Management Platform

A robust NestJS-based REST API for property management with role-based access control, multi-tenancy, and comprehensive CRUD operations.

## 🏢 Project Overview

Enterprise-grade property management platform built with modern technologies:

- **Backend**: NestJS (Node.js framework)
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT with role-based access control
- **Authorization**: CASL for fine-grained permissions
- **Architecture**: Multi-tenant with organization-based isolation

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18
- MongoDB >= 5.0 (must be configured as replica set for transactions)
- Redis >= 6.0 (for job queues and caching)
- npm or yarn
- AWS S3 account (optional, for cloud media storage)

### MongoDB Replica Set Setup

**Important**: This application requires MongoDB to be configured as a replica set to support transactions.

#### Development Environment (Local)

1. Stop existing MongoDB instance:

   ```bash
   # Find and kill existing mongod process
   ps aux | grep mongod
   kill <process_id>
   ```

2. Start MongoDB with replica set configuration:

   ```bash
   # Start MongoDB with replica set named "rs0"
   mongod --dbpath /usr/local/var/mongodb --replSet "rs0"
   ```

3. Initialize the replica set:

   ```bash
   # In a new terminal, connect to MongoDB and initialize
   mongosh --eval "rs.initiate()"
   ```

4. Verify replica set status:
   ```bash
   mongosh --eval "rs.status()"
   ```

#### Production Environment

1. **For MongoDB Atlas (Cloud)**:
   - MongoDB Atlas automatically provides replica set configuration
   - No additional setup required - just use your Atlas connection string

2. **For Self-Hosted MongoDB**:
   - Configure replica set in `/etc/mongod.conf`:
     ```yaml
     replication:
       replSetName: 'rs0'
     ```
   - Restart MongoDB service:
     ```bash
     sudo systemctl restart mongod
     ```
   - Initialize replica set:
     ```bash
     mongosh --eval "rs.initiate()"
     ```

**Note**: Without replica set configuration, you'll encounter the error: "Transaction numbers are only allowed on a replica set member or mongos"

### Redis Setup

Redis is required for BullMQ job queues (email notifications, scheduled tasks).

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd Mytegroup-api-Property-Management-Platform

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Configure your environment variables
# Edit .env file with your MongoDB URL, JWT secret, etc.
```

### Environment Configuration

Create a `.env` file based on `.env.example`:

```bash
# Database
DB_URL=mongodb+srv://username:password@cluster.example.mongodb.net/
MONGO_DB_NAME=PropertyManagementPlatform

# Authentication
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRATION=1d

# Admin Seeder
ADMIN_USERNAME=admin
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=securePassword123

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Email (Gmail example)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=your-email@gmail.com
EMAIL_USE_ETHEREAL=false  # Set to true for development testing

# Media Storage (Local by default)
MEDIA_UPLOAD_PATH=uploads
# AWS S3 (optional - leave empty for local storage)
AWS_S3_BUCKET=
AWS_S3_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
```

### Quick Setup

```bash
# Start in development mode
npm run start:dev

# Seed admin user
npm run db:seed

# Build for production
npm run build
```

## ⚙️ API Documentation

### Authentication

All protected endpoints require JWT token in Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

### Base URL

- Development: `http://localhost:3000`
- Production: Your configured `APP_BASE_URL`

### Swagger Documentation

Visit `/api/docs` when the server is running for interactive API documentation.

## 🗄️ Database

### Schema Overview

- **Users**: User accounts with role-based permissions
- **Organizations**: Multi-tenant organization structure
- **Properties**: Property listings with ownership
- **Units**: Individual units within properties

### Database Seeding

```bash
# Run all seeders
npm run db:seed

# Run specific seeder
npm run db:seed -- --seeder=admin
```

## 🧪 Development

### Available Scripts

```bash
# Development
npm run start:dev          # Start with hot reload
npm run start:prod         # Start production build

# Building
npm run build             # Compile TypeScript

# Testing
npm run test              # Run unit tests
npm run test:watch        # Run tests in watch mode
npm run test:cov          # Run tests with coverage
npm run test:e2e          # Run end-to-end tests
npm run test:e2e:cov      # E2E tests with coverage

# Database
npm run db:seed           # Run all database seeders

# Code Quality
npm run format            # Format code with Prettier
npm run format:check      # Check code formatting
```

### Development Workflow

1. Start the development server:

   ```bash
   npm run start:dev
   ```

2. The API will be available at `http://localhost:3000`

3. Access Swagger documentation at `http://localhost:3000/api/docs`

4. Use the seeded admin account to get started:
   - Email: From `ADMIN_EMAIL` env variable
   - Password: From `ADMIN_PASSWORD` env variable

---

**Last Updated**: 2025-10-06  
**Last Reviewed**: 2025-10-06
