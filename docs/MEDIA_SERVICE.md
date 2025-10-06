# Media Service Documentation

## Overview

The Media Service provides file upload, storage, and retrieval functionality with support for multiple storage backends (Local and S3). It handles file validation, authorization, and automatic URL generation for stored media.

---

## Architecture

### Components

- **MediaService**: Main service for media operations
- **StorageManager**: Manages storage driver selection
- **LocalStorageDriver**: Handles local filesystem storage
- **S3StorageDriver**: Handles AWS S3 storage (planned)
- **MediaUtils**: Utility functions for file handling

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

#### 2. S3 Storage (Planned)

Stores files on AWS S3.

**Configuration:**

```env
MEDIA_DEFAULT_DISK=s3
AWS_S3_BUCKET=your-bucket-name
AWS_S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_S3_BASE_URL=https://your-bucket.s3.amazonaws.com
```

**Status:** Implementation pending - requires `@aws-sdk/client-s3` package

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

URLs are stored in the database during upload:

```typescript
const url = `${AWS_S3_BASE_URL}/${path}`;
// Example: https://bucket.s3.amazonaws.com/Property/123/images/photo.jpg
```

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

2. **Use appropriate storage disk** based on environment

   ```typescript
   const disk = process.env.NODE_ENV === 'production' ? StorageDisk.S3 : StorageDisk.LOCAL;
   ```

3. **Clean up media when deleting entities**

   ```typescript
   async deleteProperty(id: string, user: User) {
     const media = await this.mediaService.getMediaForEntity('Property', id, user);
     await Promise.all(media.map(m => this.mediaService.deleteMedia(m._id, user)));
     await this.propertyModel.findByIdAndDelete(id);
   }
   ```

4. **Validate files on the client side** to improve UX
   - Check file size before upload
   - Check file type before upload
   - Show upload progress

5. **Use transactions for critical operations**
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

## Migration to S3

To enable S3 storage:

1. Install AWS SDK:

   ```bash
   bun add @aws-sdk/client-s3
   ```

2. Update `s3-storage.driver.ts` to implement S3 operations

3. Set environment variables:

   ```env
   MEDIA_DEFAULT_DISK=s3
   AWS_S3_BUCKET=your-bucket
   AWS_S3_REGION=us-east-1
   AWS_ACCESS_KEY_ID=your-key
   AWS_SECRET_ACCESS_KEY=your-secret
   ```

4. Configure S3 bucket CORS if needed for direct uploads

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

**Version**: 1.0.0  
**Last Updated**: 2025-10-02  
**Last Reviewed**: 2025-10-06
