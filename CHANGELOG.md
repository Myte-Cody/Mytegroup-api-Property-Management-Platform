# MyteGroup API - Changelog

## October 30, 2025

### Expense System Enhancement & Policy Updates

**Enhanced expense management with improved authorization and service layer refinements**

#### Expense System Improvements

- **Expense Service Enhancements**
  - Refined expense CRUD operations
  - Improved expense query handling
  - Better integration with maintenance workflow
  - Enhanced expense filtering and pagination
  - Optimized expense data retrieval

- **Expense Schema Updates**
  - Refined expense schema structure
  - Better relationship management with tickets and SOWs
  - Improved data validation
  - Enhanced schema indexing for performance

- **Expense DTOs**
  - Comprehensive expense query DTO
  - Create expense DTO with validation
  - Update expense DTO for modifications
  - Response DTO for consistent API responses

#### Authorization & Policies

- **CASL Policy Updates**
  - Enhanced expense policies for role-based access
  - Updated CASL ability factory
  - Improved permission checking for expense operations
  - Better integration with existing policy framework

#### Maintenance Integration

- **Invoice Schema Updates**
  - Refined invoice schema structure
  - Better integration with expense tracking
  - Enhanced invoice-expense relationships

- **Scope of Work Updates**
  - Improved SOW service layer
  - Enhanced SOW-expense integration
  - Better expense tracking for work orders

- **Maintenance Enums**
  - Updated maintenance-related enumerations
  - Added expense-related status types
  - Better type safety across maintenance module

#### Technical Implementation

- Expense controller with full CRUD endpoints
- Expense module configuration
- Integration with app module
- Enhanced service layer architecture
- Improved data consistency and validation

#### Files Modified

- `api/src/common/casl/policies/expense.policies.ts`
- `api/src/common/casl/casl-ability.factory.ts`
- `api/src/common/enums/maintenance.enum.ts`
- `api/src/features/expenses/schemas/expense.schema.ts`
- `api/src/features/expenses/services/expenses.service.ts`
- `api/src/features/expenses/expenses.module.ts`
- `api/src/features/expenses/controllers/expenses.controller.ts`
- `api/src/features/expenses/dto/expense-query.dto.ts`
- `api/src/features/expenses/dto/create-expense.dto.ts`
- `api/src/features/expenses/dto/expense-response.dto.ts`
- `api/src/features/expenses/dto/update-expense.dto.ts`
- `api/src/features/maintenance/schemas/invoice.schema.ts`
- `api/src/features/maintenance/schemas/scope-of-work.schema.ts`
- `api/src/features/maintenance/services/scope-of-work.service.ts`
- `api/src/features/maintenance/services/invoices.service.ts`
- `api/src/features/maintenance/dto/create-invoice.dto.ts`
- `api/src/app.module.ts`

---

## October 29, 2025

### Expense Endpoints & Thread Integration

**Complete expense management system for maintenance workflow**

#### Expense System

- **Expense Endpoints**
  - Full CRUD operations for expenses
  - Create expenses for maintenance tickets and SOWs
  - Update expense details and amounts
  - Delete expenses (soft delete)
  - List expenses with filtering and pagination
  - Expense schema with maintenance references

- **Expense Features**
  - Link expenses to maintenance tickets and SOWs
  - Track expense amounts and categories
  - Integration with maintenance and SOW workflow
  - Policy-based authorization for expense management
  - Financial tracking for work orders

#### Thread System Enhancement

- **Thread Integration**
  - Enhanced thread system integration
  - Thread feature merge from pull request #25
  - Improved thread workflow with tickets and SOWs
  - Better thread management capabilities

#### Technical Implementation

- Created expense schema and DTOs
- Expense service with CRUD operations
- Policy-based permissions for expenses
- Integration with maintenance and thread modules
- Improved service layer architecture

#### Commits

- `a110cb1` - feat: expense endpoints
- `e90cff2` - Feat/threads

---

## October 28, 2025

### Thread Management Enhancements

**Thread creation and validation improvements for tickets and scope of work**

#### Thread Features

- **SOW Tickets Validation**
  - Added validation for SOW tickets before thread creation
  - Improved decline thread logic
  - Enhanced thread workflow for scope of work
  - Better error handling and status checks

- **Thread Creation with Ticket/SOW**
  - Create threads directly from tickets
  - Create threads from scope of work
  - Link threads to tickets and SOWs
  - Integration with maintenance workflow

#### Technical Implementation

- Enhanced thread validation logic
- Improved thread decline workflow
- Integration with ticket and SOW modules
- Better status management for threads

#### Commits

- `12035a5` - feat: add sow tickets validation and imporve decline thread logic
- `54b49ef` - feat: create thread with ticket/sow

---

## October 27, 2025

### Maintenance Threads & Invoice System

**Complete thread management system and invoice functionality**

#### Maintenance Threads

- **Thread Endpoints**
  - Full CRUD operations for maintenance threads
  - Thread creation and management
  - Thread status tracking
  - Integration with maintenance tickets

- **Thread Features**
  - Link threads to maintenance tickets
  - Track thread status and updates
  - Thread messaging and communication
  - Policy-based authorization for thread access

#### Invoice System

- **Invoice Management**
  - Invoice creation and tracking
  - Invoice status management
  - Integration with maintenance workflow
  - Financial tracking for maintenance work

#### Technical Implementation

- Created thread schema and DTOs
- Thread service with CRUD operations
- Policy-based permissions for threads
- Integration with maintenance module
- Invoice service layer implementation

#### Commits

- `ba67ced` - feat: maintenance threads endpoints
- `3b69693` - feat: invoices

---

## October 26, 2025

### Invoice Management & Maintenance Improvements

**Complete invoice system for scope of work and maintenance tickets**

#### Invoice System

- **Invoice Endpoints**
  - Full CRUD operations for invoices
  - Create invoices from scope of work
  - Update invoice details and status
  - Delete invoices (soft delete)
  - List invoices with filtering and pagination
  - Invoice schema with maintenance ticket references

- **Invoice Features**
  - Link invoices to maintenance tickets
  - Track invoice status and amounts
  - Media attachment support for invoice documents
  - Policy-based authorization for invoice management
  - Integration with scope of work workflow

#### Maintenance Ticket Updates

- **Mark as Done Logic**
  - Enhanced ticket completion workflow
  - Updated mark as done endpoint
  - Improved ticket status tracking
  - Better handling of ticket closure

- **Scope of Work Closure**
  - Close scope of work functionality
  - Simplified SOW and ticket closing logic
  - Removed redundant close DTOs
  - Streamlined closure workflow
  - Updated service layer for better consistency

#### Technical Implementation

- Created invoice schema and DTOs
- Invoice service with CRUD operations
- Policy-based permissions for invoices
- Integration with maintenance and SOW modules
- Refactored ticket and SOW closing logic
- Improved service layer architecture

#### Commits

- `8258c8d` - feat: invoices endpoints
- `119080b` - feat: close scope of work
- `b9a0219` - feat: update mark as done logic

---

## October 23, 2025

### Maintenance & SOW Improvements

**Enhanced ticket and SOW management for contractors**

#### Ticket Management Updates

- **Accept/Refuse Logic Enhancement**
  - Updated ticket acceptance workflow
  - Improved ticket refusal handling
  - Enhanced contractor interaction with tickets

- **Contractor Data Fetching**
  - Updated tickets fetch logic for contractors
  - Improved SOW retrieval for contractor users
  - Enhanced data filtering for contractor role

#### Commits

- `c952384` - feat: update accept/refuse ticket logic
- `2bb18de` - feat: update tickets and sows fetch for contractors

---

## October 21-22, 2025

### Scope of Work (SOW) Feature Implementation

**Complete scope of work management system for maintenance tickets**

#### New Endpoints

- SOW CRUD operations with pagination
- SOW status management (pending, in-review, approved, rejected)
- Filter SOW by date range
- Include related tickets and sub-SOWs
- Contractor list management for SOWs
- Mark SOW in review and update status from ticket

#### Scope of Work Features

- **SOW Creation & Management**
  - Create scope of work from maintenance tickets
  - Add title and description to SOW
  - Ticket status validation before SOW creation
  - Session-based SOW service integration
  - Include tickets and sub-SOWs in responses

- **Status Management**
  - Change SOW status endpoints
  - Mark SOW as in-review
  - Update SOW status from ticket context
  - Proper status workflow tracking

- **Filtering & Pagination**
  - Filter SOWs by date range
  - Pagination support for SOW listings
  - Query-based filtering capabilities

- **Contractor Management**
  - Add contractors list to SOWs
  - Link contractors with specific SOWs
  - Track contractor assignments

#### Technical Implementation

- Created SOW-specific DTOs and queries
- Service layer with session management
- Status validation and workflow logic
- Integration with maintenance ticket system
- Date range filtering capabilities

#### Commits

- `bde0f68` - wip; add contractors list to sows
- `24f8211` - feat: mark scope of work in review endpoint + update sow status from ticket
- `a2d0061` - feat: add title and description to sow
- `6161b6a` - feat: include tickets and sub sows with sow
- `6b667df` - feat: add filter by date range in sow
- `7059540` - feat: add pagination to scope of work
- `f04b62f` - feat: add ticket status check before creating sow
- `c1004c9` - feat: add session to scope of work service
- `ba0feac` - feat: change sow status endpoints
- `b0ed1ea` - feat: add scope of work in maintenance

---

## October 20, 2025

### Marketplace Feature Implementation

**Complete marketplace system for unit listings and inquiries**

#### New Endpoints

- Marketplace unit listing endpoints
- Unit inquiry management endpoints
- Unit localization extraction
- Marketplace filtering capabilities

#### Marketplace Features

- **Unit Localization** (09:49)
  - Extract and store localization information for units
  - Support for unit address and location data
  - Integration with unit management system

- **Marketplace Filtering** (11:00)
  - Filter units by "publish to marketplace" field
  - Control unit visibility in marketplace
  - Query-based filtering for marketplace listings

- **Inquiry System** (13:37)
  - Create and manage unit inquiries
  - Handle potential tenant inquiries
  - Inquiry tracking and management
  - Communication between interested parties and landlords

- **Marketplace Units** (15:10)
  - Dedicated marketplace unit endpoints
  - Public unit listings
  - Enhanced unit display for marketplace
  - Integration with inquiry system

#### Technical Implementation

- Created marketplace-specific DTOs and queries
- Service layer for marketplace logic
- Controller with proper Swagger documentation
- Integration with existing unit and property modules
- Localization data extraction and storage

#### Commits

- `c50d98c` - feat: extract localization info for units
- `c5c9da8` - feat: filter units by publish to marketplace field
- `9b0770f` - feat: inquiries endpoints
- `9b44568` - feat: marketplace units

---

## October 16, 2025

### Feed Posts Feature Implementation

**Complete feeds system for property announcements and tenant engagement**

#### New Endpoints

- `POST /feed-posts` - Create feed post (landlord only)
- `GET /feed-posts` - List all posts with filtering and pagination
- `GET /feed-posts/:id` - Get single post details
- `PATCH /feed-posts/:id` - Update post (landlord only)
- `DELETE /feed-posts/:id` - Soft delete post (landlord only)
- `POST /feed-posts/:id/vote` - Upvote/downvote posts
- `POST /feed-posts/:id/poll/vote` - Vote on poll options

#### Feed Post Features

- **Post Management** (Landlord Only)
  - Create posts with title and rich text description
  - Attach optional photo (single image per post)
  - Add optional poll with multiple choice options
  - Edit and delete posts (soft delete)
  - Filter posts by property

- **Voting System** (All Users)
  - Reddit/Stack Overflow style upvote/downvote system
  - Track who voted to prevent double voting
  - Remove votes functionality
  - Vote count tracking

- **Poll System**
  - Create polls with multiple string options
  - Optional "allow multiple votes" setting
  - Track voters per option
  - Prevent duplicate votes (unless explicitly allowed)

- **Search & Filtering**
  - Filter by property ID
  - Search in title and description
  - Pagination support (default 10 items per page)
  - Sorting by any field (default: newest first)

#### Schema & Data Model

- `FeedPost` document with property, landlord, title, description
- `Poll` subdocument with options and multiple vote settings
- `PollOption` subdocument with text, votes count, and voters tracking
- Upvote/downvote arrays with user ID tracking
- Media attachment support via virtual relationship
- Soft delete and CASL accessibility plugins

#### Permissions & Authorization

- **Landlords**: Full management (create, read, update, delete all posts)
- **Tenants**: Read all posts, vote/react on posts and polls
- Policy-based authorization with CASL guards
- All endpoints protected with appropriate policy handlers

#### Technical Implementation

- Created DTOs: `CreateFeedPostDto`, `UpdateFeedPostDto`, `VotePostDto`, `VotePollDto`, `CreatePollDto`, `FeedPostQueryDto`
- Service with CRUD operations, voting logic, and poll management
- Controller with proper Swagger documentation
- Module integration with Media, CASL, and Session services
- Transaction support for data consistency

### User Permission Fixes

- Fixed tenant permissions for maintenance ticket creation and updates
- Fixed contractor and tenant user creation permissions

#### Commits

- `6aaf7c9` - fix: tenant permission for maintenance ticket
- `fd5708a` - fix: create tenants & contractors users (#3)
- `bb22fd0` - wip: feeds

---

## October 13-15, 2025

### Maintenance & Contractor Management

#### Contractor Management

- Full contractor CRUD operations
- Contractor invitation system
- Contractor user management
- Contractor profile handling

#### Maintenance Tickets

- Ticket creation for properties
- Ticket assignment to contractors
- Ticket acceptance by contractors
- Ticket refusal with reasons
- Ticket closing with notes
- Ticket filtering by date, property, and user role

#### Permissions & Security

- Role-based access control (RBAC)
- Permission policies for landlords, tenants, and contractors
- Protected endpoints with proper authorization

---

## Key Features Summary

### Scope of Work System ✓

✓ SOW creation from maintenance tickets
✓ Title and description management
✓ Status workflow (pending, in-review, approved, rejected)
✓ Date range filtering
✓ Pagination support
✓ Contractor list management
✓ Integration with tickets and sub-SOWs
✓ Ticket status validation

### Marketplace System ✓

✓ Unit localization extraction
✓ Marketplace filtering by publish status
✓ Inquiry management system
✓ Public unit listings
✓ Marketplace-specific endpoints

### Feed Posts System ✓

✓ Landlord-only post creation and management
✓ Rich text description support
✓ Single image attachment per post
✓ Reddit-style upvote/downvote system
✓ Poll creation with multiple options
✓ Poll voting with duplicate prevention
✓ Property-based filtering
✓ Full-text search
✓ Pagination and sorting

### Maintenance System ✓

✓ Ticket lifecycle management
✓ Contractor assignment
✓ Acceptance/refusal workflow
✓ Completion tracking

### User Management ✓

✓ Multi-tenant architecture
✓ Role-based permissions
✓ Landlord, tenant, and contractor user types
✓ Organization-based isolation
