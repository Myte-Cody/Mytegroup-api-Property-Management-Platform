# MyteGroup API - Changelog

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
