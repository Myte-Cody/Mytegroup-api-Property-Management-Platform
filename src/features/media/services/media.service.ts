import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { MemoryStoredFile } from 'nestjs-form-data';
import { Action, CaslAbilityFactory } from '../../../common/casl/casl-ability.factory';
import { AppModel } from '../../../common/interfaces/app-model.interface';
import { User } from '../../users/schemas/user.schema';
import { MediaServiceInterface } from '../interfaces/media.interfaces';
import { Media, MediaType, StorageDisk } from '../schemas/media.schema';
import { MediaUtils } from '../utils/media.utils';
import { StorageManager } from './storage-manager.service';

@Injectable()
export class MediaService implements MediaServiceInterface {
  private readonly maxFileSize: number;
  private readonly allowedMimeTypes: string[];

  constructor(
    @InjectModel(Media.name)
    private readonly mediaModel: AppModel<Media>,
    private readonly storageManager: StorageManager,
    private readonly caslAbilityFactory: CaslAbilityFactory,
    private readonly configService: ConfigService,
  ) {
    // Configuration - these could be moved to ConfigService
    this.maxFileSize = 10 * 1024 * 1024; // 10MB
    this.allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
  }

  async upload(
    file: any,
    entity: any,
    currentUser: User,
    collection: string = 'default',
    disk?: StorageDisk,
    modelType?: string,
  ): Promise<Media> {
    // Validate file
    this.validateFile(file);

    // Check permissions
    const ability = this.caslAbilityFactory.createForUser(currentUser);
    if (!ability.can(Action.Create, Media)) {
      throw new ForbiddenException('You do not have permission to upload media');
    }

    // Ensure user has tenant context
    if (!(currentUser as any).tenantId) {
      throw new ForbiddenException('Cannot upload media: No tenant context');
    }

    const landlordId =
      (currentUser as any).tenantId && typeof (currentUser as any).tenantId === 'object'
        ? ((currentUser as any).tenantId as any)._id
        : (currentUser as any).tenantId;

    // Generate unique filename and path - handle different file object structures
    const originalName = file.originalname || file.originalName || file.name || 'unknown.jpg';
    const uniqueFilename = MediaUtils.generateUniqueFilename(originalName);

    // Determine entity type - use explicit modelType if provided, otherwise auto-detect
    let entityType = modelType || this.determineEntityType(entity);

    const storagePath = MediaUtils.generateStoragePath(
      entityType,
      entity?._id?.toString() || 'unknown',
      uniqueFilename,
      collection,
    );

    // Get storage driver and store file
    const storageDriver = this.storageManager.getDriver(disk);
    const actualPath = await storageDriver.store(file, storagePath);

    // Create media record - handle different file object structures
    const selectedDisk = disk || this.storageManager.getDefaultDisk();
    const mimeType = file.mimetype || file.type || 'application/octet-stream';
    const fileSize = file.size || file.length || 0;

    const mediaData = {
      model_type: entityType,
      model_id: entity?._id,
      tenantId: landlordId,
      name: originalName,
      file_name: uniqueFilename,
      mime_type: mimeType,
      size: fileSize,
      type: MediaUtils.getMediaTypeFromMime(mimeType),
      disk: selectedDisk,
      path: actualPath,
      // Only store URL for non-local storage (S3, CDN, etc.)
      ...(selectedDisk !== 'local' && { url: storageDriver.getUrl(actualPath) }),
      collection_name: collection,
      metadata: this.extractMetadata(file),
    };

    // Create within tenant context
    const MediaWithTenant = this.mediaModel.byTenant(landlordId);
    const newMedia = new MediaWithTenant(mediaData);

    return await newMedia.save();
  }

  async getMediaForEntity(
    model_type: string,
    model_id: string,
    user: User,
    collection_name?: string,
    filters?: { media_type?: MediaType },
  ): Promise<(Media & { url: string })[]> {
    const query: any = {
      model_type,
      model_id,
    };

    if (collection_name) {
      query.collection_name = collection_name;
    }

    if (filters?.media_type) {
      query.media_type = filters.media_type;
    }

    const media = await this.mediaModel
      .byTenant((user as any).tenantId)
      .find(query)
      .exec();
    return this.enrichMediaArrayWithUrls(media);
  }

  async findOne(id: string, user: User): Promise<Media & { url: string }> {
    const media = await this.mediaModel
      .byTenant((user as any).tenantId)
      .findById(id)
      .exec();

    if (!media) {
      throw new NotFoundException('Media not found');
    }

    // Check if user can read this media
    const ability = this.caslAbilityFactory.createForUser(user);
    if (!ability.can(Action.Read, media)) {
      throw new ForbiddenException('You do not have permission to access this media');
    }

    return this.enrichMediaWithUrl(media);
  }

  async deleteMedia(id: string, user: User): Promise<void> {
    // Get media without URL enrichment for deletion (more efficient)
    const media = await this.mediaModel
      .byTenant((user as any).tenantId)
      .findById(id)
      .exec();

    if (!media) {
      throw new NotFoundException('Media not found');
    }

    // Check if user can read and delete this media
    const ability = this.caslAbilityFactory.createForUser(user);
    if (!ability.can(Action.Read, media) || !ability.can(Action.Delete, media)) {
      throw new ForbiddenException('You do not have permission to delete this media');
    }

    // Delete file from storage
    const driver = this.storageManager.getDriver(media.disk);
    await driver.delete(media.path);

    // Delete from database
    await this.mediaModel.byTenant((user as any).tenantId).findByIdAndDelete(id);
  }

  async getMediaUrl(media: Media): Promise<string> {
    // Use stored URL if available, otherwise calculate it
    if (media.url) {
      return media.url;
    }

    const driver = this.storageManager.getDriver(media.disk);
    return driver.getUrl(media.path);
  }

  async enrichMediaWithUrl(media: Media): Promise<Media & { url: string }> {
    const url = await this.getMediaUrl(media);
    return { ...media.toObject(), url };
  }

  async enrichMediaArrayWithUrls(mediaArray: Media[]): Promise<(Media & { url: string })[]> {
    return Promise.all(mediaArray.map((media) => this.enrichMediaWithUrl(media)));
  }

  private validateFile(file: MemoryStoredFile): void {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    if (!MediaUtils.isValidFileSize(file.size, this.maxFileSize)) {
      throw new BadRequestException(
        `File size too large. Maximum allowed: ${MediaUtils.formatFileSize(this.maxFileSize)}`,
      );
    }

    if (!MediaUtils.isAllowedMimeType(file.mimetype, this.allowedMimeTypes)) {
      throw new BadRequestException(
        `File type not allowed. Allowed types: ${this.allowedMimeTypes.join(', ')}`,
      );
    }
  }

  private determineEntityType(entity: any): string {
    if (entity?.constructor?.name && entity.constructor.name !== 'MongoTenantModel' && entity.constructor.name !== 'model') {
      return entity.constructor.name;
    }

    if (entity?.schema?.modelName) {
      return entity.schema.modelName;
    }

    if (entity?.collection?.modelName) {
      return entity.collection.modelName;
    }

    if (entity?.__t) {
      return entity.__t;
    }

    if (entity?.address && entity?.name && !entity?.property && !entity?.unit) {
      return 'Property';
    } else if (entity?.property && entity?.unitNumber !== undefined) {
      return 'Unit';
    } else if (entity?.email && entity?.user_type) {
      return 'User';
    } else if (entity?.tenant && entity?.ticketNumber) {
      return 'MaintenanceTicket';
    } else if (entity?.unit && entity?.tenant && entity?.startDate && entity?.endDate) {
      return 'Lease';
    } else if (entity?.name && entity?.email && !entity?.user_type) {
      return 'Tenant';
    } else if (entity?.name && entity?.specializations) {
      return 'Contractor';
    }

    const fieldPatterns = {
      MaintenanceTicket: ['ticketNumber', 'category', 'priority', 'requestDate'],
      Lease: ['rentAmount', 'paymentCycle', 'startDate', 'endDate'],
      Property: ['address', 'propertyType'],
      Unit: ['unitNumber', 'type', 'availabilityStatus'],
      Tenant: ['name', 'email', 'phoneNumber'],
      Contractor: ['name', 'specializations', 'hourlyRate'],
      User: ['username', 'email', 'user_type']
    };

    for (const [modelName, fields] of Object.entries(fieldPatterns)) {
      const hasRequiredFields = fields.some(field => entity && entity.hasOwnProperty(field));
      if (hasRequiredFields) {
        return modelName;
      }
    }

    console.warn(`Could not determine entity type for entity:`, {
      constructor: entity?.constructor?.name,
      schema: entity?.schema?.modelName,
      collection: entity?.collection?.modelName,
      keys: entity ? Object.keys(entity) : []
    });

    return 'UnknownModel';
  }

  private extractMetadata(file: MemoryStoredFile): any {
    const metadata: any = {};

    // Extract basic metadata
    if (file.mimetype.startsWith('image/')) {
      // For images, you could use a library like 'sharp' to extract dimensions
      const imageMetadata = MediaUtils.extractImageMetadata(file);
      if (imageMetadata) {
        metadata.width = imageMetadata.width;
        metadata.height = imageMetadata.height;
      }
    }

    return Object.keys(metadata).length > 0 ? metadata : undefined;
  }
}
