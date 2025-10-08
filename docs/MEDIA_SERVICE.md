# Media Service Documentation

## Overview

The Media Service provides file upload, storage, and retrieval functionality with support for multiple storage backends (Local and S3). It handles file validation, authorization, and automatic URL generation for stored media.

---

## Architecture

### Components

- **MediaService**: Main service for media operations
- **StorageManager**: Manages storage driver selection
- **LocalStorageDriver**: Handles local filesystem storage
- **S3StorageDriver**: Handles AWS S3 storage with temporary URL support
- **MediaUtils**: Utility functions for file handling

### StorageDriverInterface

All storage drivers implement this common interface:

```typescript
export interface StorageDriverInterface {
  store(file: any, path: string): Promise<string>;
  delete(path: string): Promise<void>;
  getUrl(path: string, expiresIn?: number): Promise<string>;
  exists(path: string): Promise<boolean>;
}
```

### Storage Backends

#### 1. Local Storage (Default)

Stores files on the local filesystem.

**Configuration:**

```env
MEDIA_DEFAULT_DISK=local
MEDIA_UPLOAD_PATH=uploads
APP_BASE_URL=http://localhost:3000
```

**Features:**

- Files stored in `uploads/` directory
- Automatic directory creation
- URL format: `{APP_BASE_URL}/uploads/{path}`

#### 2. S3 Storage

Stores files on AWS S3 with support for temporary URLs.

**Configuration:**

```env
MEDIA_DEFAULT_DISK=s3
AWS_S3_BUCKET=your-bucket-name
AWS_S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_S3_BASE_URL=https://your-bucket.s3.amazonaws.com
```

**Features:**

- Files stored in AWS S3 bucket
- Secure access via presigned URLs
- Configurable URL expiration
- Automatic error handling with fallback URLs

**Required Packages:**

- `@aws-sdk/client-s3`
- `@aws-sdk/s3-request-presigner`

---

## Usage

### Uploading Files

```typescript
import { MediaService } from './features/media/services/media.service';
import { StorageDisk } from './features/media/schemas/media.schema';

@Injectable()
export class PropertyService {
  constructor(private mediaService: MediaService) {}

  async uploadPropertyImage(
    file: MemoryStoredFile,
    property: Property,
    user: User,
  ): Promise<Media> {
    return this.mediaService.upload(
      file,
      property,
      user,
      'images', // collection name
      StorageDisk.LOCAL, // optional: specify storage disk
      'Property', // optional: entity type
    );
  }
}
```

### Retrieving Media

#### Get Media for Entity

```typescript
const media = await this.mediaService.getMediaForEntity(
  'Property', // model type
  propertyId, // model ID
  user, // current user
  'images', // optional: collection name
  { media_type: MediaType.IMAGE }, // optional: filters
);

// Returns array with URLs
// [{ _id: '...', name: 'photo.jpg', url: 'http://...', ... }]
```

#### Get Single Media

```typescript
const media = await this.mediaService.findOne(mediaId, user);
// Returns: { _id: '...', name: 'photo.jpg', url: 'http://...', ... }
```

#### Get Media URL

```typescript
// Get regular URL (default expiration for S3)
const url = await this.mediaService.getMediaUrl(media);

// Get URL with custom expiration (for S3 only, in seconds)
const url = await this.mediaService.getMediaUrl(media, 1800); // 30 minutes
```

### Deleting Media

```typescript
await this.mediaService.deleteMedia(mediaId, user);
// Deletes both the file and database record
```

---

## File Validation

### Size Limits

**Default:** 10MB per file

Configurable in `MediaService` constructor:

```typescript
this.maxFileSize = 10 * 1024 * 1024; // 10MB
```

### Allowed MIME Types

**Default allowed types:**

- `image/jpeg`
- `image/png`
- `image/gif`
- `image/webp`
- `application/pdf`
- `text/plain`
- `application/msword`
- `application/vnd.openxmlformats-officedocument.wordprocessingml.document`

Configurable in `MediaService` constructor:

```typescript
this.allowedMimeTypes = ['image/jpeg', 'image/png', ...];
```

---

## Authorization

Media operations use CASL for authorization:

- **Upload**: Requires `Action.Create` permission on `Media`
- **Read**: Requires `Action.Read` permission on specific media
- **Delete**: Requires both `Action.Read` and `Action.Delete` permissions

```typescript
// Example permission definition
can(Action.Create, Media);
can(Action.Read, Media, { model_type: 'Property' });
can(Action.Delete, Media, { model_type: 'Property' });
```

---

## Media Schema

```typescript
{
  model_type: string;        // Entity type (e.g., 'Property', 'Unit')
  model_id: ObjectId;        // Entity ID
  name: string;              // Original filename
  file_name: string;         // Unique generated filename
  mime_type: string;         // MIME type
  size: number;              // File size in bytes
  type: MediaType;           // IMAGE | DOCUMENT | VIDEO | AUDIO | OTHER
  disk: StorageDisk;         // LOCAL | S3
  path: string;              // Storage path
  url?: string;              // Public URL (for non-local storage)
  collection_name: string;   // Collection/category name
  metadata?: any;            // Additional metadata (dimensions, etc.)
  createdAt: Date;
  updatedAt: Date;
}
```

---

## Storage Paths

Files are organized by entity type and ID:

**Pattern:** `{entityType}/{entityId}/{collection}/{filename}`

**Examples:**

- `Property/507f1f77bcf86cd799439011/images/uuid-photo.jpg`
- `Unit/507f1f77bcf86cd799439012/documents/uuid-lease.pdf`
- `User/507f1f77bcf86cd799439013/avatar/uuid-profile.jpg`

---

## URL Generation

### Local Storage

URLs are generated dynamically:

```typescript
const url = `${APP_BASE_URL}/uploads/${relativePath}`;
// Example: http://localhost:3000/uploads/Property/123/images/photo.jpg
```

### S3 Storage

URLs are generated dynamically as temporary presigned URLs:

```typescript
// Generate a temporary URL that expires after 1 hour (default)
const url = await storageDriver.getUrl(path);

// Generate a temporary URL with custom expiration (e.g., 15 minutes)
const url = await storageDriver.getUrl(path, 900);

// Example: https://bucket.s3.amazonaws.com/Property/123/images/photo.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=...
```

#### Temporary URL Benefits

- **Security**: Access to S3 objects is time-limited
- **Privacy**: Files can be stored privately in S3 but shared temporarily when needed
- **Control**: Different expiration times can be set for different use cases

---

## Controller Integration

```typescript
@Controller('properties')
export class PropertiesController {
  @Post(':id/media')
  @UseGuards(JwtAuthGuard, CaslGuard)
  @CheckPolicies(new CreateMediaPolicyHandler())
  @UseInterceptors(FileInterceptor('file'))
  async uploadMedia(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: User,
  ) {
    const property = await this.propertiesService.findOne(id, user);
    return this.mediaService.upload(file, property, user, 'images');
  }

  @Get(':id/media')
  @UseGuards(JwtAuthGuard)
  async getMedia(@Param('id') id: string, @CurrentUser() user: User) {
    return this.mediaService.getMediaForEntity('Property', id, user);
  }

  @Delete('media/:mediaId')
  @UseGuards(JwtAuthGuard, CaslGuard)
  @CheckPolicies(new DeleteMediaPolicyHandler())
  async deleteMedia(@Param('mediaId') mediaId: string, @CurrentUser() user: User) {
    await this.mediaService.deleteMedia(mediaId, user);
    return { message: 'Media deleted successfully' };
  }
}

@Controller('media')
@UseGuards(CaslGuard)
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Get(':id')
  @CheckPolicies(new ReadMediaPolicyHandler())
  async getMedia(@Param('id') id: string, @CurrentUser() user: User) {
    const media = await this.mediaService.findOne(id, user);
    return {
      success: true,
      data: media,
    };
  }

  @Get(':id/download')
  @CheckPolicies(new ReadMediaPolicyHandler())
  async downloadMedia(@Param('id') id: string, @CurrentUser() user: User, @Res() res: Response) {
    const media = await this.mediaService.findOne(id, user);
    const url = await this.mediaService.getMediaUrl(media);

    // For local storage, serve the file directly
    if (media.disk === StorageDisk.LOCAL) {
      res.sendFile(media.path, { root: '' });
    } else {
      // For remote storage, redirect to the URL
      res.redirect(url);
    }
  }
}
```

---

## Transactions Support

Media uploads can participate in MongoDB transactions:

```typescript
const session = await this.connection.startSession();
session.startTransaction();

try {
  const property = await this.propertyModel.create([propertyData], { session });
  const media = await this.mediaService.upload(
    file,
    property[0],
    user,
    'images',
    StorageDisk.LOCAL,
    'Property',
    session, // Pass session for transactional support
  );

  await session.commitTransaction();
} catch (error) {
  await session.abortTransaction();
  throw error;
} finally {
  session.endSession();
}
```

---

## Error Handling

### Common Errors

**BadRequestException:**

- No file provided
- File size too large
- File type not allowed

**ForbiddenException:**

- User lacks permission to upload
- User lacks permission to access media
- User lacks permission to delete media

**NotFoundException:**

- Media not found

### Example Error Handling

```typescript
try {
  const media = await this.mediaService.upload(file, entity, user);
} catch (error) {
  if (error instanceof BadRequestException) {
    // Handle validation errors
  } else if (error instanceof ForbiddenException) {
    // Handle authorization errors
  }
}
```

---

## Best Practices

1. **Always specify collection names** for better organization

   ```typescript
   upload(file, property, user, 'images'); // ✅ Good
   upload(file, property, user); // ❌ Uses 'default'
   ```

2. **Clean up media when deleting entities**

   ```typescript
   async deleteProperty(id: string, user: User) {
     const media = await this.mediaService.getMediaForEntity('Property', id, user);
     await Promise.all(media.map(m => this.mediaService.deleteMedia(m._id, user)));
     await this.propertyModel.findByIdAndDelete(id);
   }
   ```

3. **Validate files on the client side** to improve UX
   - Check file size before upload
   - Check file type before upload
   - Show upload progress

4. **Use transactions for critical operations**
   - When creating entities with required media
   - When updating multiple related records

---

## Performance Considerations

1. **URL Enrichment**: URLs are generated on-demand for local storage
   - Consider caching for frequently accessed media
   - S3 URLs are stored in database (no runtime generation)

2. **Batch Operations**: Use `enrichMediaArrayWithUrls()` for multiple files

   ```typescript
   const mediaWithUrls = await this.mediaService.enrichMediaArrayWithUrls(mediaArray);
   ```

3. **File Size**: Large files should use streaming (future enhancement)

4. **CDN**: Consider using CloudFront or similar CDN for S3 storage

---

## S3StorageDriver Implementation

The S3StorageDriver implements the StorageDriverInterface to provide AWS S3 storage capabilities.

### Key Methods

#### `store(file: any, path: string): Promise<string>`

- Uploads a file to S3 using `PutObjectCommand`
- Preserves the file's original MIME type
- Returns the stored path for reference

#### `delete(path: string): Promise<void>`

- Removes a file from S3 using `DeleteObjectCommand`
- Takes the relative path as input

#### `getUrl(path: string, expiresIn?: number): Promise<string>`

- Generates a temporary presigned URL using `GetObjectCommand` and `getSignedUrl`
- Default expiration is 3600 seconds (1 hour)
- Falls back to regular URL if signing fails

#### `exists(path: string): Promise<boolean>`

- Checks if a file exists in S3 using `HeadObjectCommand`
- Returns true if file exists, false if not found (404)
- Properly handles AWS error responses

### Implementation Details

- Creates a single S3Client instance in the constructor for efficiency
- Configurable via environment variables
- Handles AWS SDK errors appropriately

## Using S3 Storage

### Configuration

1. Install required AWS SDK packages:

   ```bash
   bun add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
   ```

2. Set environment variables:

   ```env
   MEDIA_DEFAULT_DISK=s3
   AWS_S3_BUCKET=your-bucket
   AWS_S3_REGION=us-east-1
   AWS_ACCESS_KEY_ID=your-key
   AWS_SECRET_ACCESS_KEY=your-secret
   AWS_S3_BASE_URL=https://your-bucket.s3.amazonaws.com
   ```

3. Configure S3 bucket CORS if needed for direct uploads:

   ```json
   [
     {
       "AllowedHeaders": ["*"],
       "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
       "AllowedOrigins": ["*"],
       "ExposeHeaders": ["ETag"]
     }
   ]
   ```

### S3 Bucket Policy

For private files with temporary access:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::YOUR_ACCOUNT_ID:user/YOUR_IAM_USER"
      },
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::your-bucket/*"
    }
  ]
}
```

### Using Temporary URLs

```typescript
// Get a temporary URL that expires in 1 hour (default)
const url = await mediaService.getMediaUrl(media);

// Get a temporary URL that expires in 15 minutes
const url = await mediaService.getMediaUrl(media, 900);

// Get a temporary URL via API endpoint
// GET /media/123/temp-url?expiresIn=1800
```

---

## Testing

### Unit Tests

```typescript
describe('MediaService', () => {
  it('should upload file successfully', async () => {
    const file = createMockFile();
    const media = await service.upload(file, entity, user, 'images');

    expect(media.name).toBe(file.originalname);
    expect(media.disk).toBe(StorageDisk.LOCAL);
  });

  it('should reject oversized files', async () => {
    const largeFile = createMockFile({ size: 20 * 1024 * 1024 });

    await expect(service.upload(largeFile, entity, user)).rejects.toThrow(BadRequestException);
  });
});
```

### E2E Tests

```typescript
describe('Media Upload (e2e)', () => {
  it('should upload property image', () => {
    return request(app.getHttpServer())
      .post('/properties/123/media')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', 'test/fixtures/image.jpg')
      .expect(201)
      .expect((res) => {
        expect(res.body.url).toBeDefined();
      });
  });
});
```

---

## Related Documentation

- Schema: `src/features/media/schemas/media.schema.ts`
- Drivers: `src/features/media/drivers/`
- Utils: `src/features/media/utils/media.utils.ts`
- CASL Authorization: `docs/CASL_AUTHORIZATION.md`

---
