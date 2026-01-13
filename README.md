# Mytegroup API - Property Management Platform

NestJS REST API for multi-tenant property management with role-based access control and CRUD operations.

## Project overview

- **Backend**: NestJS (Node.js)
- **Database**: MongoDB with Mongoose ODM
- **Auth**: JWT + RBAC
- **Permissions**: CASL
- **Architecture**: Multi-tenant with organization isolation

## Quick start

### Prerequisites

- Node.js 22.x (see `.nvmrc`)
- MongoDB >= 5.0 (replica set required for transactions)
- Redis >= 6.0
- npm or yarn
- Optional: AWS S3 for media storage

### Installation

```bash
git clone <repository-url>
cd Mytegroup-api-Property-Management-Platform
npm install
cp .env.example .env
```

### Environment configuration

Set the required values in `.env` based on `.env.example`.

### Start the API

```bash
npm run start:dev
```

API available at `http://localhost:3000`  
Swagger docs: `http://localhost:3000/api/docs`

## MongoDB replica set setup

**Important**: Transactions require a replica set.

### Local (development)

```bash
mongod --dbpath /usr/local/var/mongodb --replSet "rs0"
mongosh --eval "rs.initiate()"
mongosh --eval "rs.status()"
```

### Production

MongoDB Atlas already provides a replica set. For self-hosted:

```yaml
replication:
  replSetName: "rs0"
```

Then initialize:

```bash
mongosh --eval "rs.initiate()"
```

## Database seeding

```bash
npm run db:seed
```

Admin credentials come from the `ADMIN_*` env vars.

## Scripts

```bash
npm run build
npm run start:prod
npm run test
npm run test:e2e
npm run format
```

## License

Internal use only. Commercial use and hosting as a service are prohibited.  
See `LICENSE`.
