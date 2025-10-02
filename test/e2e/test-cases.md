# API Test Cases

## Table of Contents

1. [Auth Controller](#auth-controller)
2. [Properties Controller](#properties-controller)
3. [Units Controller](#units-controller)
4. [Users Controller](#users-controller)
5. [Tenants Controller](#tenants-controller)
6. [Contractors Controller](#contractors-controller)
7. [Invitations Controller](#invitations-controller)
8. [Leases Controller](#leases-controller)
9. [Rental Periods Controller](#rental-periods-controller)
10. [Transactions Controller](#transactions-controller)

## Auth Controller

### POST /auth/login - User login

- **Successful login**
  - Should return 200 OK status
  - Should return a JWT token
  - Should return user information

- **Invalid credentials**
  - Should return 401 Unauthorized when username/email is incorrect
  - Should return 401 Unauthorized when password is incorrect

- **Validation errors**
  - Should return 400 Bad Request when required fields are missing
  - Should return 400 Bad Request when field validations fail

### GET /auth/me - Get current user

- **Successful retrieval**
  - Should return 200 OK status
  - Should return the authenticated user's information

- **Unauthorized access**
  - Should return 401 Unauthorized when no token is provided
  - Should return 401 Unauthorized when token is invalid or expired

## Properties Controller

### POST /properties - Create a new property

- **Successful creation with all required fields**
  - Should return 201 Created status
  - Should return the created property with correct data
  - Should include an \_id field in the response

- **Successful creation without optional fields (description)**
  - Should return 201 Created status
  - Should return the created property with correct data
  - Should have a falsy or empty description field

- **Successful creation with media files**
  - Should return 201 Created status
  - Should include media information in the response

- **Unauthorized access**
  - Should return 401 Unauthorized when no token is provided

- **Forbidden access**
  - Should return 403 Forbidden when user doesn't have permission (e.g., tenant trying to create property)

- **Validation errors**
  - Should return 400 Bad Request when required fields are missing
  - Should return 400 Bad Request when field validations fail (e.g., name too long)

- **Duplicate property name**
  - Should return 422 Unprocessable Entity when property name already exists

### GET /properties - Get all properties

- **Successful retrieval with pagination**
  - Should return 200 OK status
  - Should return paginated list of properties
  - Should include total count and pagination metadata

- **Filtering properties**
  - Should filter properties by name
  - Should filter properties by city
  - Should filter properties by state

- **Sorting properties**
  - Should sort properties by name (asc/desc)
  - Should sort properties by creation date (asc/desc)

- **Unauthorized access**
  - Should return 401 Unauthorized when no token is provided

- **Forbidden access**
  - Should return 403 Forbidden when user doesn't have permission

### GET /properties/:id - Get property by ID

- **Successful retrieval**
  - Should return 200 OK status
  - Should return the property with the specified ID
  - Should include media information

- **Property not found**
  - Should return 404 Not Found when property ID doesn't exist

- **Invalid ID format**
  - Should return 400 Bad Request when ID format is invalid

- **Unauthorized access**
  - Should return 401 Unauthorized when no token is provided

- **Forbidden access**
  - Should return 403 Forbidden when user doesn't have permission to view the property

### PATCH /properties/:id - Update property by ID

- **Successful update**
  - Should return 200 OK status
  - Should return the updated property with modified fields

- **Partial update**
  - Should update only the provided fields
  - Should leave other fields unchanged

- **Property not found**
  - Should return 404 Not Found when property ID doesn't exist

- **Invalid ID format**
  - Should return 400 Bad Request when ID format is invalid

- **Validation errors**
  - Should return 400 Bad Request when field validations fail

- **Duplicate property name**
  - Should return 422 Unprocessable Entity when updated name already exists

- **Unauthorized access**
  - Should return 401 Unauthorized when no token is provided

- **Forbidden access**
  - Should return 403 Forbidden when user doesn't have permission to update the property

### DELETE /properties/:id - Delete property by ID

- **Successful deletion**
  - Should return 204 No Content status
  - Should soft delete the property (not actually remove from database)

- **Property not found**
  - Should return 404 Not Found when property ID doesn't exist

- **Invalid ID format**
  - Should return 400 Bad Request when ID format is invalid

- **Property with active units**
  - Should return 409 Conflict when property has active units

- **Unauthorized access**
  - Should return 401 Unauthorized when no token is provided

- **Forbidden access**
  - Should return 403 Forbidden when user doesn't have permission to delete the property

### GET /properties/:id/units - Get all units for a property

- **Successful retrieval with pagination**
  - Should return 200 OK status
  - Should return paginated list of units for the specified property
  - Should include total count and pagination metadata

- **Property not found**
  - Should return 404 Not Found when property ID doesn't exist

- **Filtering units**
  - Should filter units by unit number
  - Should filter units by status (vacant, occupied, etc.)

- **Sorting units**
  - Should sort units by unit number (asc/desc)
  - Should sort units by rent amount (asc/desc)

- **Unauthorized access**
  - Should return 401 Unauthorized when no token is provided

- **Forbidden access**
  - Should return 403 Forbidden when user doesn't have permission

### POST /properties/:id/units - Add a unit to a property

- **Successful creation**
  - Should return 201 Created status
  - Should return the created unit with correct data
  - Should associate the unit with the specified property

- **Property not found**
  - Should return 404 Not Found when property ID doesn't exist

- **Validation errors**
  - Should return 400 Bad Request when required fields are missing
  - Should return 400 Bad Request when field validations fail

- **Duplicate unit number**
  - Should return 422 Unprocessable Entity when unit number already exists in the property

- **Unauthorized access**
  - Should return 401 Unauthorized when no token is provided

- **Forbidden access**
  - Should return 403 Forbidden when user doesn't have permission

## Units Controller

### GET /units - Get all units

- **Successful retrieval with pagination**
  - Should return 200 OK status
  - Should return paginated list of units
  - Should include total count and pagination metadata

- **Filtering units**
  - Should filter units by unit number
  - Should filter units by status (vacant, occupied, etc.)
  - Should filter units by property ID

- **Sorting units**
  - Should sort units by unit number (asc/desc)
  - Should sort units by rent amount (asc/desc)
  - Should sort units by creation date (asc/desc)

- **Unauthorized access**
  - Should return 401 Unauthorized when no token is provided

- **Forbidden access**
  - Should return 403 Forbidden when user doesn't have permission

### GET /units/:id - Get unit by ID

- **Successful retrieval**
  - Should return 200 OK status
  - Should return the unit with the specified ID
  - Should include property information
  - Should include media information

- **Unit not found**
  - Should return 404 Not Found when unit ID doesn't exist

- **Invalid ID format**
  - Should return 400 Bad Request when ID format is invalid

- **Unauthorized access**
  - Should return 401 Unauthorized when no token is provided

- **Forbidden access**
  - Should return 403 Forbidden when user doesn't have permission

### PATCH /units/:id - Update unit by ID

- **Successful update**
  - Should return 200 OK status
  - Should return the updated unit with modified fields

- **Partial update**
  - Should update only the provided fields
  - Should leave other fields unchanged

- **Unit not found**
  - Should return 404 Not Found when unit ID doesn't exist

- **Invalid ID format**
  - Should return 400 Bad Request when ID format is invalid

- **Validation errors**
  - Should return 400 Bad Request when field validations fail

- **Duplicate unit number**
  - Should return 422 Unprocessable Entity when unit number already exists in the property

- **Unauthorized access**
  - Should return 401 Unauthorized when no token is provided

- **Forbidden access**
  - Should return 403 Forbidden when user doesn't have permission

### DELETE /units/:id - Delete unit by ID

- **Successful deletion**
  - Should return 204 No Content status
  - Should soft delete the unit (not actually remove from database)

- **Unit not found**
  - Should return 404 Not Found when unit ID doesn't exist

- **Invalid ID format**
  - Should return 400 Bad Request when ID format is invalid

- **Unit with active leases**
  - Should return 409 Conflict when unit has active leases

- **Unauthorized access**
  - Should return 401 Unauthorized when no token is provided

- **Forbidden access**
  - Should return 403 Forbidden when user doesn't have permission

## Users Controller

### POST /users - Create a new user

- **Successful creation**
  - Should return 201 Created status
  - Should return the created user with correct data
  - Should include an \_id field in the response
  - Should not return the password

- **Validation errors**
  - Should return 400 Bad Request when required fields are missing
  - Should return 400 Bad Request when field validations fail (e.g., email format)

- **Duplicate email**
  - Should return 422 Unprocessable Entity when email already exists

- **Unauthorized access**
  - Should return 401 Unauthorized when no token is provided

- **Forbidden access**
  - Should return 403 Forbidden when user doesn't have permission to create users

### GET /users - Get all users

- **Successful retrieval with pagination**
  - Should return 200 OK status
  - Should return paginated list of users
  - Should include total count and pagination metadata
  - Should not return passwords

- **Filtering users**
  - Should filter users by name
  - Should filter users by email
  - Should filter users by user_type

- **Sorting users**
  - Should sort users by name (asc/desc)
  - Should sort users by email (asc/desc)
  - Should sort users by creation date (asc/desc)

- **Unauthorized access**
  - Should return 401 Unauthorized when no token is provided

- **Forbidden access**
  - Should return 403 Forbidden when user doesn't have permission

### GET /users/:id - Get user by ID

- **Successful retrieval**
  - Should return 200 OK status
  - Should return the user with the specified ID
  - Should not return the password

- **User not found**
  - Should return 404 Not Found when user ID doesn't exist

- **Invalid ID format**
  - Should return 400 Bad Request when ID format is invalid

- **Unauthorized access**
  - Should return 401 Unauthorized when no token is provided

- **Forbidden access**
  - Should return 403 Forbidden when user doesn't have permission

### PATCH /users/:id - Update user by ID

- **Successful update**
  - Should return 200 OK status
  - Should return the updated user with modified fields
  - Should not return the password

- **Partial update**
  - Should update only the provided fields
  - Should leave other fields unchanged

- **Password update**
  - Should hash the password when updating
  - Should not return the password in the response

- **User not found**
  - Should return 404 Not Found when user ID doesn't exist

- **Invalid ID format**
  - Should return 400 Bad Request when ID format is invalid

- **Validation errors**
  - Should return 400 Bad Request when field validations fail

- **Duplicate email**
  - Should return 422 Unprocessable Entity when updated email already exists

- **Unauthorized access**
  - Should return 401 Unauthorized when no token is provided

- **Forbidden access**
  - Should return 403 Forbidden when user doesn't have permission

### DELETE /users/:id - Delete user by ID

- **Successful deletion**
  - Should return 204 No Content status
  - Should soft delete the user (not actually remove from database)

- **User not found**
  - Should return 404 Not Found when user ID doesn't exist

- **Invalid ID format**
  - Should return 400 Bad Request when ID format is invalid

- **Self-deletion**
  - Should prevent users from deleting their own account (if applicable)

- **Unauthorized access**
  - Should return 401 Unauthorized when no token is provided

- **Forbidden access**
  - Should return 403 Forbidden when user doesn't have permission

## Tenants Controller

### POST /tenants - Create a new tenant

- **Successful creation**
  - Should return 201 Created status
  - Should return the created tenant with correct data
  - Should include an \_id field in the response

- **Validation errors**
  - Should return 400 Bad Request when required fields are missing
  - Should return 400 Bad Request when field validations fail

- **Unauthorized access**
  - Should return 401 Unauthorized when no token is provided

- **Forbidden access**
  - Should return 403 Forbidden when user doesn't have permission (e.g., tenant trying to create another tenant)

### GET /tenants - Get all tenants

- **Successful retrieval with pagination**
  - Should return 200 OK status
  - Should return paginated list of tenants
  - Should include total count and pagination metadata

- **Filtering tenants**
  - Should filter tenants by name
  - Should filter tenants by email
  - Should filter tenants by other relevant fields

- **Sorting tenants**
  - Should sort tenants by name (asc/desc)
  - Should sort tenants by creation date (asc/desc)

- **Unauthorized access**
  - Should return 401 Unauthorized when no token is provided

- **Forbidden access**
  - Should return 403 Forbidden when user doesn't have permission

### GET /tenants/me - Get my tenant profile

- **Successful retrieval**
  - Should return 200 OK status
  - Should return the authenticated tenant's profile information

- **Non-tenant user**
  - Should return 403 Forbidden when user is not a tenant

- **Unauthorized access**
  - Should return 401 Unauthorized when no token is provided

### GET /tenants/:id - Get tenant by ID

- **Successful retrieval**
  - Should return 200 OK status
  - Should return the tenant with the specified ID

- **Tenant not found**
  - Should return 404 Not Found when tenant ID doesn't exist

- **Invalid ID format**
  - Should return 400 Bad Request when ID format is invalid

- **Unauthorized access**
  - Should return 401 Unauthorized when no token is provided

- **Forbidden access**
  - Should return 403 Forbidden when user doesn't have permission

### PATCH /tenants/:id - Update tenant by ID

- **Successful update**
  - Should return 200 OK status
  - Should return the updated tenant with modified fields

- **Partial update**
  - Should update only the provided fields
  - Should leave other fields unchanged

- **Tenant not found**
  - Should return 404 Not Found when tenant ID doesn't exist

- **Invalid ID format**
  - Should return 400 Bad Request when ID format is invalid

- **Validation errors**
  - Should return 400 Bad Request when field validations fail

- **Unauthorized access**
  - Should return 401 Unauthorized when no token is provided

- **Forbidden access**
  - Should return 403 Forbidden when user doesn't have permission

### DELETE /tenants/:id - Delete tenant by ID

- **Successful deletion**
  - Should return 204 No Content status
  - Should soft delete the tenant (not actually remove from database)

- **Tenant not found**
  - Should return 404 Not Found when tenant ID doesn't exist

- **Invalid ID format**
  - Should return 400 Bad Request when ID format is invalid

- **Tenant with active leases**
  - Should return 409 Conflict when tenant has active leases

- **Unauthorized access**
  - Should return 401 Unauthorized when no token is provided

- **Forbidden access**
  - Should return 403 Forbidden when user doesn't have permission

### GET /tenants/:id/users - Get all users belonging to a tenant

- **Successful retrieval with pagination**
  - Should return 200 OK status
  - Should return paginated list of users belonging to the tenant
  - Should include total count and pagination metadata

- **Tenant not found**
  - Should return 404 Not Found when tenant ID doesn't exist

- **Filtering users**
  - Should filter users by name
  - Should filter users by email
  - Should filter users by role

- **Sorting users**
  - Should sort users by name (asc/desc)
  - Should sort users by email (asc/desc)
  - Should sort users by creation date (asc/desc)

- **Unauthorized access**
  - Should return 401 Unauthorized when no token is provided

- **Forbidden access**
  - Should return 403 Forbidden when user doesn't have permission

### POST /tenants/:id/users - Create a new user for a tenant

- **Successful creation**
  - Should return 201 Created status
  - Should return the created user with correct data
  - Should associate the user with the specified tenant
  - Should set the user_type to "Tenant"

- **Tenant not found**
  - Should return 404 Not Found when tenant ID doesn't exist

- **Validation errors**
  - Should return 400 Bad Request when required fields are missing
  - Should return 400 Bad Request when field validations fail

- **Duplicate email**
  - Should return 422 Unprocessable Entity when email already exists

- **Unauthorized access**
  - Should return 401 Unauthorized when no token is provided

- **Forbidden access**
  - Should return 403 Forbidden when user doesn't have permission

### PATCH /tenants/:id/users/:userId - Update a tenant user

- **Successful update**
  - Should return 200 OK status
  - Should return the updated user with modified fields

- **Tenant not found**
  - Should return 404 Not Found when tenant ID doesn't exist

- **User not found**
  - Should return 404 Not Found when user ID doesn't exist

- **User not belonging to tenant**
  - Should return 404 Not Found or 403 Forbidden when user doesn't belong to the tenant

- **Invalid ID format**
  - Should return 400 Bad Request when tenant ID or user ID format is invalid

- **Validation errors**
  - Should return 400 Bad Request when field validations fail

- **Duplicate email**
  - Should return 422 Unprocessable Entity when updated email already exists

- **Unauthorized access**
  - Should return 401 Unauthorized when no token is provided

- **Forbidden access**
  - Should return 403 Forbidden when user doesn't have permission

### DELETE /tenants/:id/users/:userId - Delete a tenant user

- **Successful deletion**
  - Should return 204 No Content status
  - Should soft delete the user (not actually remove from database)

- **Tenant not found**
  - Should return 404 Not Found when tenant ID doesn't exist

- **User not found**
  - Should return 404 Not Found when user ID doesn't exist

- **User not belonging to tenant**
  - Should return 404 Not Found or 403 Forbidden when user doesn't belong to the tenant

- **Invalid ID format**
  - Should return 400 Bad Request when tenant ID or user ID format is invalid

- **Unauthorized access**
  - Should return 401 Unauthorized when no token is provided

- **Forbidden access**
  - Should return 403 Forbidden when user doesn't have permission

## Contractors Controller

### POST /contractors - Create a new contractor

- **Successful creation**
  - Should return 201 Created status
  - Should return the created contractor with correct data
  - Should include an \_id field in the response

- **Validation errors**
  - Should return 400 Bad Request when required fields are missing
  - Should return 400 Bad Request when field validations fail

- **Unauthorized access**
  - Should return 401 Unauthorized when no token is provided

- **Forbidden access**
  - Should return 403 Forbidden when user doesn't have permission (e.g., tenant trying to create a contractor)

### GET /contractors - Get all contractors

- **Successful retrieval with pagination**
  - Should return 200 OK status
  - Should return paginated list of contractors
  - Should include total count and pagination metadata

- **Filtering contractors**
  - Should filter contractors by name
  - Should filter contractors by specialty
  - Should filter contractors by other relevant fields

- **Sorting contractors**
  - Should sort contractors by name (asc/desc)
  - Should sort contractors by creation date (asc/desc)

- **Unauthorized access**
  - Should return 401 Unauthorized when no token is provided

- **Forbidden access**
  - Should return 403 Forbidden when user doesn't have permission

### GET /contractors/me - Get my contractor profile

- **Successful retrieval**
  - Should return 200 OK status
  - Should return the authenticated contractor's profile information

- **Non-contractor user**
  - Should return 403 Forbidden when user is not a contractor

- **Unauthorized access**
  - Should return 401 Unauthorized when no token is provided

### GET /contractors/:id - Get contractor by ID

- **Successful retrieval**
  - Should return 200 OK status
  - Should return the contractor with the specified ID

- **Contractor not found**
  - Should return 404 Not Found when contractor ID doesn't exist

- **Invalid ID format**
  - Should return 400 Bad Request when ID format is invalid

- **Unauthorized access**
  - Should return 401 Unauthorized when no token is provided

- **Forbidden access**
  - Should return 403 Forbidden when user doesn't have permission

### PATCH /contractors/:id - Update contractor by ID

- **Successful update**
  - Should return 200 OK status
  - Should return the updated contractor with modified fields

- **Partial update**
  - Should update only the provided fields
  - Should leave other fields unchanged

- **Contractor not found**
  - Should return 404 Not Found when contractor ID doesn't exist

- **Invalid ID format**
  - Should return 400 Bad Request when ID format is invalid

- **Validation errors**
  - Should return 400 Bad Request when field validations fail

- **Unauthorized access**
  - Should return 401 Unauthorized when no token is provided

- **Forbidden access**
  - Should return 403 Forbidden when user doesn't have permission

### DELETE /contractors/:id - Delete contractor by ID

- **Successful deletion**
  - Should return 204 No Content status
  - Should soft delete the contractor (not actually remove from database)

- **Contractor not found**
  - Should return 404 Not Found when contractor ID doesn't exist

- **Invalid ID format**
  - Should return 400 Bad Request when ID format is invalid

- **Contractor with active work orders**
  - Should return 409 Conflict when contractor has active work orders

- **Unauthorized access**
  - Should return 401 Unauthorized when no token is provided

- **Forbidden access**
  - Should return 403 Forbidden when user doesn't have permission

## Invitations Controller

### POST /invitations - Create a new invitation

- **Successful creation**
  - Should return 201 Created status
  - Should return the created invitation with correct data
  - Should generate a unique token
  - Should set appropriate expiration date
  - Should send an email to the invited user

- **Validation errors**
  - Should return 400 Bad Request when required fields are missing
  - Should return 400 Bad Request when field validations fail
  - Should return 400 Bad Request when invalid entity type is provided

- **Duplicate invitation**
  - Should return 422 Unprocessable Entity when an active invitation already exists for the email

- **Unauthorized access**
  - Should return 401 Unauthorized when no token is provided

- **Forbidden access**
  - Should return 403 Forbidden when user doesn't have permission to create invitations

### GET /invitations - Get all invitations

- **Successful retrieval with pagination**
  - Should return 200 OK status
  - Should return paginated list of invitations
  - Should include total count and pagination metadata

- **Filtering invitations**
  - Should filter invitations by email
  - Should filter invitations by entity type
  - Should filter invitations by status (pending, accepted, expired, revoked)

- **Sorting invitations**
  - Should sort invitations by creation date (asc/desc)
  - Should sort invitations by expiration date (asc/desc)

- **Unauthorized access**
  - Should return 401 Unauthorized when no token is provided

- **Forbidden access**
  - Should return 403 Forbidden when user doesn't have permission

### GET /invitations/:token/validate - Validate invitation token

- **Valid token**
  - Should return 200 OK status
  - Should return invitation details (entity type, email, entity data)
  - Should indicate the token is valid

- **Invalid token**
  - Should return 404 Not Found when token doesn't exist

- **Expired token**
  - Should return 400 Bad Request when token has expired

- **Revoked token**
  - Should return 400 Bad Request when token has been revoked

### POST /invitations/:token/accept - Accept an invitation

- **Successful acceptance**
  - Should return 201 Created status
  - Should create the corresponding entity (tenant, contractor, etc.)
  - Should create a user account associated with the entity
  - Should mark the invitation as accepted
  - Should return the created user and entity information
  - Should return a JWT token for authentication

- **Invalid token**
  - Should return 404 Not Found when token doesn't exist

- **Expired token**
  - Should return 400 Bad Request when token has expired

- **Revoked token**
  - Should return 400 Bad Request when token has been revoked

- **Already accepted token**
  - Should return 400 Bad Request when token has already been accepted

- **Validation errors**
  - Should return 400 Bad Request when required fields are missing
  - Should return 400 Bad Request when field validations fail
  - Should return 400 Bad Request when password doesn't meet requirements

### PATCH /invitations/:id/revoke - Revoke an invitation

- **Successful revocation**
  - Should return 200 OK status
  - Should mark the invitation as revoked
  - Should return a success message

- **Invitation not found**
  - Should return 404 Not Found when invitation ID doesn't exist

- **Already accepted invitation**
  - Should return 400 Bad Request when invitation has already been accepted

- **Already expired invitation**
  - Should return 400 Bad Request when invitation has already expired

- **Unauthorized access**
  - Should return 401 Unauthorized when no token is provided

- **Forbidden access**
  - Should return 403 Forbidden when user doesn't have permission

### DELETE /invitations/:id - Delete an invitation

- **Successful deletion**
  - Should return 200 OK status
  - Should permanently delete the invitation record
  - Should return a success message

- **Invitation not found**
  - Should return 404 Not Found when invitation ID doesn't exist

- **Unauthorized access**
  - Should return 401 Unauthorized when no token is provided

- **Forbidden access**
  - Should return 403 Forbidden when user doesn't have permission

## Leases Controller

### GET /leases - Get all leases

- **Successful retrieval with pagination**
  - Should return 200 OK status
  - Should return paginated list of leases
  - Should include total count and pagination metadata

- **Filtering leases**
  - Should filter leases by tenant
  - Should filter leases by property
  - Should filter leases by unit
  - Should filter leases by status (active, terminated, expired, etc.)
  - Should filter leases by date range

- **Sorting leases**
  - Should sort leases by start date (asc/desc)
  - Should sort leases by end date (asc/desc)
  - Should sort leases by rent amount (asc/desc)

- **Unauthorized access**
  - Should return 401 Unauthorized when no token is provided

- **Forbidden access**
  - Should return 403 Forbidden when user doesn't have permission

### GET /leases/:id - Get lease by ID

- **Successful retrieval**
  - Should return 200 OK status
  - Should return the lease with the specified ID
  - Should include tenant information
  - Should include property and unit information
  - Should include payment information

- **Lease not found**
  - Should return 404 Not Found when lease ID doesn't exist

- **Invalid ID format**
  - Should return 400 Bad Request when ID format is invalid

- **Unauthorized access**
  - Should return 401 Unauthorized when no token is provided

- **Forbidden access**
  - Should return 403 Forbidden when user doesn't have permission

### POST /leases - Create a new lease

- **Successful creation**
  - Should return 201 Created status
  - Should return the created lease with correct data
  - Should include an \_id field in the response
  - Should create initial rental periods
  - Should handle security deposit correctly

- **Validation errors**
  - Should return 400 Bad Request when required fields are missing
  - Should return 400 Bad Request when field validations fail
  - Should return 400 Bad Request when dates are invalid
  - Should return 400 Bad Request when rent amount is invalid

- **Unit already leased**
  - Should return 422 Unprocessable Entity when unit is already leased for the specified period

- **Unauthorized access**
  - Should return 401 Unauthorized when no token is provided

- **Forbidden access**
  - Should return 403 Forbidden when user doesn't have permission

### PATCH /leases/:id - Update lease details

- **Successful update**
  - Should return 200 OK status
  - Should return the updated lease with modified fields

- **Partial update**
  - Should update only the provided fields
  - Should leave other fields unchanged

- **Lease not found**
  - Should return 404 Not Found when lease ID doesn't exist

- **Invalid ID format**
  - Should return 400 Bad Request when ID format is invalid

- **Validation errors**
  - Should return 400 Bad Request when field validations fail

- **Unauthorized access**
  - Should return 401 Unauthorized when no token is provided

- **Forbidden access**
  - Should return 403 Forbidden when user doesn't have permission

### POST /leases/:id/terminate - Terminate a lease

- **Successful termination**
  - Should return 200 OK status
  - Should update lease status to terminated
  - Should set termination date and reason
  - Should handle security deposit assessment if specified

- **Lease not found**
  - Should return 404 Not Found when lease ID doesn't exist

- **Invalid termination**
  - Should return 400 Bad Request when termination date is invalid
  - Should return 400 Bad Request when lease is already terminated

- **Unauthorized access**
  - Should return 401 Unauthorized when no token is provided

- **Forbidden access**
  - Should return 403 Forbidden when user doesn't have permission

### POST /leases/:id/renew - Manually renew a lease

- **Successful renewal**
  - Should return 200 OK status
  - Should create a new lease with updated dates
  - Should copy relevant information from the original lease
  - Should handle security deposit transfer if specified

- **Lease not found**
  - Should return 404 Not Found when lease ID doesn't exist

- **Invalid renewal**
  - Should return 400 Bad Request when renewal parameters are invalid
  - Should return 400 Bad Request when lease cannot be renewed

- **Unauthorized access**
  - Should return 401 Unauthorized when no token is provided

- **Forbidden access**
  - Should return 403 Forbidden when user doesn't have permission

### DELETE /leases/:id - Delete a lease

- **Successful deletion**
  - Should return 204 No Content status
  - Should delete the lease (only draft leases)

- **Lease not found**
  - Should return 404 Not Found when lease ID doesn't exist

- **Invalid deletion**
  - Should return 400 Bad Request when trying to delete a non-draft lease

- **Unauthorized access**
  - Should return 401 Unauthorized when no token is provided

- **Forbidden access**
  - Should return 403 Forbidden when user doesn't have permission

### GET /leases/:id/media - Get all media for a lease

- **Successful retrieval**
  - Should return 200 OK status
  - Should return list of media items for the lease
  - Should filter by media type if specified

- **Lease not found**
  - Should return 404 Not Found when lease ID doesn't exist

- **Unauthorized access**
  - Should return 401 Unauthorized when no token is provided

- **Forbidden access**
  - Should return 403 Forbidden when user doesn't have permission

### GET /leases/:id/documents - Get lease documents

- **Successful retrieval**
  - Should return 200 OK status
  - Should return list of document media items for the lease

- **Lease not found**
  - Should return 404 Not Found when lease ID doesn't exist

- **Unauthorized access**
  - Should return 401 Unauthorized when no token is provided

- **Forbidden access**
  - Should return 403 Forbidden when user doesn't have permission

### GET /leases/:id/contracts - Get lease contracts

- **Successful retrieval**
  - Should return 200 OK status
  - Should return list of contract media items for the lease

- **Lease not found**
  - Should return 404 Not Found when lease ID doesn't exist

- **Unauthorized access**
  - Should return 401 Unauthorized when no token is provided

- **Forbidden access**
  - Should return 403 Forbidden when user doesn't have permission

### GET /leases/:id/deposit-assessment - Get deposit assessment

- **Successful retrieval**
  - Should return 200 OK status
  - Should return deposit assessment details

- **Lease not found**
  - Should return 404 Not Found when lease ID doesn't exist

- **No security deposit**
  - Should return 400 Bad Request when lease has no security deposit

- **Unauthorized access**
  - Should return 401 Unauthorized when no token is provided

- **Forbidden access**
  - Should return 403 Forbidden when user doesn't have permission

### POST /leases/:id/deposit-assessment - Process deposit assessment

- **Successful processing**
  - Should return 200 OK status
  - Should update deposit assessment status
  - Should create refund transaction if applicable
  - Should create deduction transactions if applicable

- **Lease not found**
  - Should return 404 Not Found when lease ID doesn't exist

- **Invalid assessment**
  - Should return 400 Bad Request when assessment parameters are invalid
  - Should return 400 Bad Request when deposit has already been processed

- **Unauthorized access**
  - Should return 401 Unauthorized when no token is provided

- **Forbidden access**
  - Should return 403 Forbidden when user doesn't have permission

### GET /leases/:id/rental-periods/:rentalPeriodId/payment - Get payment details

- **Successful retrieval**
  - Should return 200 OK status
  - Should return payment transaction details for the rental period

- **Lease not found**
  - Should return 404 Not Found when lease ID doesn't exist

- **Rental period not found**
  - Should return 404 Not Found when rental period ID doesn't exist

- **Payment not found**
  - Should return 404 Not Found when payment doesn't exist for the rental period

- **Unauthorized access**
  - Should return 401 Unauthorized when no token is provided

- **Forbidden access**
  - Should return 403 Forbidden when user doesn't have permission

### GET /leases/:id/transactions - Get all transactions

- **Successful retrieval**
  - Should return 200 OK status
  - Should return list of all transactions for the lease

- **Lease not found**
  - Should return 404 Not Found when lease ID doesn't exist

- **Unauthorized access**
  - Should return 401 Unauthorized when no token is provided

- **Forbidden access**
  - Should return 403 Forbidden when user doesn't have permission

### GET /leases/:id/transactions/summary - Get transaction summary

- **Successful retrieval**
  - Should return 200 OK status
  - Should return transaction summary analytics for the lease

- **Lease not found**
  - Should return 404 Not Found when lease ID doesn't exist

- **Unauthorized access**
  - Should return 401 Unauthorized when no token is provided

- **Forbidden access**
  - Should return 403 Forbidden when user doesn't have permission

### GET /leases/:id/rental-periods - Get all rental periods

- **Successful retrieval**
  - Should return 200 OK status
  - Should return list of all rental periods for the lease

- **Lease not found**
  - Should return 404 Not Found when lease ID doesn't exist

- **Unauthorized access**
  - Should return 401 Unauthorized when no token is provided

- **Forbidden access**
  - Should return 403 Forbidden when user doesn't have permission

### GET /leases/:id/rental-periods/current - Get current rental period

- **Successful retrieval**
  - Should return 200 OK status
  - Should return the current active rental period for the lease

- **Lease not found**
  - Should return 404 Not Found when lease ID doesn't exist

- **No active rental period**
  - Should return 404 Not Found when there is no active rental period

- **Unauthorized access**
  - Should return 401 Unauthorized when no token is provided

- **Forbidden access**
  - Should return 403 Forbidden when user doesn't have permission

### POST /leases/:id/media/upload - Upload media to lease

- **Successful upload**
  - Should return 201 Created status
  - Should return the uploaded media information
  - Should associate the media with the lease

- **Lease not found**
  - Should return 404 Not Found when lease ID doesn't exist

- **Invalid file type**
  - Should return 400 Bad Request when file type is not supported

- **File too large**
  - Should return 400 Bad Request when file exceeds size limit

- **Unauthorized access**
  - Should return 401 Unauthorized when no token is provided

- **Forbidden access**
  - Should return 403 Forbidden when user doesn't have permission

### DELETE /leases/:id/media/:mediaId - Delete lease media

- **Successful deletion**
  - Should return 200 OK status
  - Should remove the media association from the lease

- **Lease not found**
  - Should return 404 Not Found when lease ID doesn't exist

- **Media not found**
  - Should return 404 Not Found when media ID doesn't exist

- **Unauthorized access**
  - Should return 401 Unauthorized when no token is provided

- **Forbidden access**
  - Should return 403 Forbidden when user doesn't have permission

### GET /leases/:id/media/:mediaId/url - Get lease media URL

- **Successful retrieval**
  - Should return 200 OK status
  - Should return the URL for the specified media

- **Lease not found**
  - Should return 404 Not Found when lease ID doesn't exist

- **Media not found**
  - Should return 404 Not Found when media ID doesn't exist

- **Unauthorized access**
  - Should return 401 Unauthorized when no token is provided

- **Forbidden access**
  - Should return 403 Forbidden when user doesn't have permission

## Rental Periods Controller

### GET /rental-periods - Get all rental periods

- **Successful retrieval with pagination**
  - Should return 200 OK status
  - Should return paginated list of rental periods
  - Should include total count and pagination metadata

- **Filtering rental periods**
  - Should filter rental periods by lease ID
  - Should filter rental periods by status (paid, unpaid, overdue)
  - Should filter rental periods by date range

- **Sorting rental periods**
  - Should sort rental periods by start date (asc/desc)
  - Should sort rental periods by due date (asc/desc)
  - Should sort rental periods by amount (asc/desc)

- **Unauthorized access**
  - Should return 401 Unauthorized when no token is provided

- **Forbidden access**
  - Should return 403 Forbidden when user doesn't have permission

### GET /rental-periods/:id - Get rental period by ID

- **Successful retrieval**
  - Should return 200 OK status
  - Should return the rental period with the specified ID
  - Should include lease information
  - Should include payment status

- **Rental period not found**
  - Should return 404 Not Found when rental period ID doesn't exist

- **Invalid ID format**
  - Should return 400 Bad Request when ID format is invalid

- **Unauthorized access**
  - Should return 401 Unauthorized when no token is provided

- **Forbidden access**
  - Should return 403 Forbidden when user doesn't have permission

### GET /rental-periods/lease/:leaseId/rent-history - Get rent history

- **Successful retrieval**
  - Should return 200 OK status
  - Should return rent history analytics for the lease
  - Should include payment trends
  - Should include on-time payment statistics

- **Lease not found**
  - Should return 404 Not Found when lease ID doesn't exist

- **Invalid ID format**
  - Should return 400 Bad Request when ID format is invalid

- **No rental periods**
  - Should return empty analytics when lease has no rental periods

- **Unauthorized access**
  - Should return 401 Unauthorized when no token is provided

- **Forbidden access**
  - Should return 403 Forbidden when user doesn't have permission

### GET /rental-periods/:id/renewal-chain - Get renewal chain

- **Successful retrieval**
  - Should return 200 OK status
  - Should return complete renewal chain for the rental period
  - Should include all linked rental periods from root to current

- **Rental period not found**
  - Should return 404 Not Found when rental period ID doesn't exist

- **Invalid ID format**
  - Should return 400 Bad Request when ID format is invalid

- **No renewal chain**
  - Should return only the current rental period when no renewal chain exists

- **Unauthorized access**
  - Should return 401 Unauthorized when no token is provided

- **Forbidden access**
  - Should return 403 Forbidden when user doesn't have permission

## Transactions Controller

### GET /transactions - Get all transactions

- **Successful retrieval with pagination**
  - Should return 200 OK status
  - Should return paginated list of transactions
  - Should include total count and pagination metadata

- **Filtering transactions**
  - Should filter transactions by type (rent, deposit, fee, etc.)
  - Should filter transactions by status (pending, paid, overdue)
  - Should filter transactions by date range
  - Should filter transactions by lease ID
  - Should filter transactions by tenant ID

- **Sorting transactions**
  - Should sort transactions by date (asc/desc)
  - Should sort transactions by amount (asc/desc)
  - Should sort transactions by status (asc/desc)

- **Unauthorized access**
  - Should return 401 Unauthorized when no token is provided

- **Forbidden access**
  - Should return 403 Forbidden when user doesn't have permission

### GET /transactions/:id - Get transaction by ID

- **Successful retrieval**
  - Should return 200 OK status
  - Should return the transaction with the specified ID
  - Should include related entity information (lease, tenant, etc.)

- **Transaction not found**
  - Should return 404 Not Found when transaction ID doesn't exist

- **Invalid ID format**
  - Should return 400 Bad Request when ID format is invalid

- **Unauthorized access**
  - Should return 401 Unauthorized when no token is provided

- **Forbidden access**
  - Should return 403 Forbidden when user doesn't have permission

### POST /transactions - Create a new transaction

- **Successful creation**
  - Should return 201 Created status
  - Should return the created transaction with correct data
  - Should include an \_id field in the response
  - Should set appropriate status based on transaction type

- **Validation errors**
  - Should return 400 Bad Request when required fields are missing
  - Should return 400 Bad Request when field validations fail
  - Should return 400 Bad Request when amount is invalid

- **Unauthorized access**
  - Should return 401 Unauthorized when no token is provided

- **Forbidden access**
  - Should return 403 Forbidden when user doesn't have permission

### PATCH /transactions/:id - Update transaction details

- **Successful update**
  - Should return 200 OK status
  - Should return the updated transaction with modified fields

- **Partial update**
  - Should update only the provided fields
  - Should leave other fields unchanged

- **Transaction not found**
  - Should return 404 Not Found when transaction ID doesn't exist

- **Invalid ID format**
  - Should return 400 Bad Request when ID format is invalid

- **Validation errors**
  - Should return 400 Bad Request when field validations fail

- **Unauthorized access**
  - Should return 401 Unauthorized when no token is provided

- **Forbidden access**
  - Should return 403 Forbidden when user doesn't have permission

### POST /transactions/:id/process - Process a pending transaction

- **Successful processing**
  - Should return 200 OK status
  - Should update transaction status to processed
  - Should update related entities as needed

- **Transaction not found**
  - Should return 404 Not Found when transaction ID doesn't exist

- **Invalid processing**
  - Should return 400 Bad Request when transaction is not in pending status
  - Should return 400 Bad Request when transaction cannot be processed

- **Unauthorized access**
  - Should return 401 Unauthorized when no token is provided

- **Forbidden access**
  - Should return 403 Forbidden when user doesn't have permission

### DELETE /transactions/:id - Delete a transaction

- **Successful deletion**
  - Should return 204 No Content status
  - Should delete the transaction (only pending transactions)

- **Transaction not found**
  - Should return 404 Not Found when transaction ID doesn't exist

- **Invalid deletion**
  - Should return 400 Bad Request when trying to delete a non-pending transaction

- **Unauthorized access**
  - Should return 401 Unauthorized when no token is provided

- **Forbidden access**
  - Should return 403 Forbidden when user doesn't have permission

### GET /transactions/:id/receipts - Get transaction receipts

- **Successful retrieval**
  - Should return 200 OK status
  - Should return list of receipt media items for the transaction

- **Transaction not found**
  - Should return 404 Not Found when transaction ID doesn't exist

- **Unauthorized access**
  - Should return 401 Unauthorized when no token is provided

- **Forbidden access**
  - Should return 403 Forbidden when user doesn't have permission

### GET /transactions/:id/documents - Get transaction documents

- **Successful retrieval**
  - Should return 200 OK status
  - Should return list of document media items for the transaction

- **Transaction not found**
  - Should return 404 Not Found when transaction ID doesn't exist

- **Unauthorized access**
  - Should return 401 Unauthorized when no token is provided

- **Forbidden access**
  - Should return 403 Forbidden when user doesn't have permission

### GET /transactions/:id/media - Get all media for a transaction

- **Successful retrieval**
  - Should return 200 OK status
  - Should return list of media items for the transaction
  - Should filter by media type if specified

- **Transaction not found**
  - Should return 404 Not Found when transaction ID doesn't exist

- **Unauthorized access**
  - Should return 401 Unauthorized when no token is provided

- **Forbidden access**
  - Should return 403 Forbidden when user doesn't have permission

### POST /transactions/:id/mark-as-paid - Mark a transaction as paid

- **Successful marking**
  - Should return 200 OK status
  - Should update transaction status to paid
  - Should record payment details
  - Should update related entities as needed

- **Transaction not found**
  - Should return 404 Not Found when transaction ID doesn't exist

- **Invalid marking**
  - Should return 400 Bad Request when transaction is already paid
  - Should return 400 Bad Request when payment details are invalid

- **Unauthorized access**
  - Should return 401 Unauthorized when no token is provided

- **Forbidden access**
  - Should return 403 Forbidden when user doesn't have permission

### POST /transactions/:id/mark-as-not-paid - Mark a transaction as not paid

- **Successful marking**
  - Should return 200 OK status
  - Should reset transaction status to pending
  - Should remove payment details
  - Should update related entities as needed

- **Transaction not found**
  - Should return 404 Not Found when transaction ID doesn't exist

- **Invalid marking**
  - Should return 400 Bad Request when transaction cannot be reset

- **Unauthorized access**
  - Should return 401 Unauthorized when no token is provided

- **Forbidden access**
  - Should return 403 Forbidden when user doesn't have permission

### POST /transactions/:id/media/upload - Upload media to transaction

- **Successful upload**
  - Should return 201 Created status
  - Should return the uploaded media information
  - Should associate the media with the transaction

- **Transaction not found**
  - Should return 404 Not Found when transaction ID doesn't exist

- **Invalid file type**
  - Should return 400 Bad Request when file type is not supported

- **File too large**
  - Should return 400 Bad Request when file exceeds size limit

- **Unauthorized access**
  - Should return 401 Unauthorized when no token is provided

- **Forbidden access**
  - Should return 403 Forbidden when user doesn't have permission

### DELETE /transactions/:id/media/:mediaId - Delete transaction media

- **Successful deletion**
  - Should return 200 OK status
  - Should remove the media association from the transaction

- **Transaction not found**
  - Should return 404 Not Found when transaction ID doesn't exist

- **Media not found**
  - Should return 404 Not Found when media ID doesn't exist

- **Unauthorized access**
  - Should return 401 Unauthorized when no token is provided

- **Forbidden access**
  - Should return 403 Forbidden when user doesn't have permission

### GET /transactions/:id/media/:mediaId/url - Get transaction media URL

- **Successful retrieval**
  - Should return 200 OK status
  - Should return the URL for the specified media

- **Transaction not found**
  - Should return 404 Not Found when transaction ID doesn't exist

- **Media not found**
  - Should return 404 Not Found when media ID doesn't exist

- **Unauthorized access**
  - Should return 401 Unauthorized when no token is provided

- **Forbidden access**
  - Should return 403 Forbidden when user doesn't have permission
