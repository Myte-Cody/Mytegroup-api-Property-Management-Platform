import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Action, CaslAbilityFactory } from '../../../common/casl/casl-ability.factory';
import { AppModel } from '../../../common/interfaces/app-model.interface';
import { User } from '../../users/schemas/user.schema';
import { MediaServiceInterface } from '../interfaces/media.interfaces';
import { Media, MediaType, StorageDisk } from '../schemas/media.schema';
import { StorageManager } from './storage-manager.service';
import { MediaUtils } from '../utils/media.utils';

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
    disk?: StorageDisk
  ): Promise<Media> {
    // Validate file
    this.validateFile(file);

    // Check permissions
    const ability = this.caslAbilityFactory.createForUser(currentUser);
    if (!ability.can(Action.Create, Media)) {
      throw new ForbiddenException('You do not have permission to upload media');
    }

    // Ensure user has tenant context
    if (!(currentUser as any).landlord_id) {
      throw new ForbiddenException('Cannot upload media: No tenant context');
    }

    const landlordId = (currentUser as any).landlord_id && typeof (currentUser as any).landlord_id === 'object' 
      ? ((currentUser as any).landlord_id as any)._id 
      : (currentUser as any).landlord_id;

    // Generate unique filename and path
    const uniqueFilename = MediaUtils.generateUniqueFilename(file.originalname);
    
    // Determine entity type more reliably for mongo-tenant models
    let entityType = entity.constructor.name;
    if (entityType === 'MongoTenantModel' || entityType === 'model') {
      // For mongo-tenant models, try to determine type from schema or properties
      if (entity.address && entity.name && !entity.property) {
        entityType = 'Property';
      } else if (entity.property && entity.unitNumber !== undefined) {
        entityType = 'Unit';
      } else if (entity.email && entity.user_type) {
        entityType = 'User';
      } else {
        // Fallback to a more generic approach
        entityType = entity.schema?.modelName || 'UnknownModel';
      }
    }
    
    const storagePath = MediaUtils.generateStoragePath(
      entityType,
      entity._id.toString(),
      uniqueFilename,
      collection
    );

    // Get storage driver and store file
    const storageDriver = this.storageManager.getDriver(disk);
    const actualPath = await storageDriver.store(file, storagePath);

    // Create media record
    const mediaData = {
      model_type: entityType,
      model_id: entity._id,
      landlord_id: landlordId,
      name: file.originalname,
      file_name: uniqueFilename,
      mime_type: file.mimetype,
      size: file.size,
      type: MediaUtils.getMediaTypeFromMime(file.mimetype),
      disk: disk || this.storageManager.getDefaultDisk(),
      path: actualPath,
      url: storageDriver.getUrl(actualPath),
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
    filters?: { media_type?: MediaType }
  ): Promise<Media[]> {
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

    return this.mediaModel.byTenant((user as any).landlord_id).find(query).exec();
  }

  async findOne(id: string, user: User): Promise<Media> {
    const media = await this.mediaModel.byTenant((user as any).landlord_id).findById(id).exec();
    
    if (!media) {
      throw new NotFoundException('Media not found');
    }

    // Check if user can read this media
    const ability = this.caslAbilityFactory.createForUser(user);
    if (!ability.can(Action.Read, media)) {
      throw new ForbiddenException('You do not have permission to access this media');
    }

    return media;
  }

  async deleteMedia(id: string, user: User): Promise<void> {
    const media = await this.findOne(id, user);
    
    // Check if user can delete this media
    const ability = this.caslAbilityFactory.createForUser(user);
    if (!ability.can(Action.Delete, media)) {
      throw new ForbiddenException('You do not have permission to delete this media');
    }

    // Delete file from storage
    const driver = this.storageManager.getDriver(media.disk);
    await driver.delete(media.path);

    // Delete from database
    await this.mediaModel.byTenant((user as any).landlord_id).findByIdAndDelete(id);
  }

  async getMediaUrl(media: Media): Promise<string> {
    const driver = this.storageManager.getDriver(media.disk);
    return driver.getUrl(media.path);
  }

  private validateFile(file: any): void {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    if (!MediaUtils.isValidFileSize(file.size, this.maxFileSize)) {
      throw new BadRequestException(
        `File size too large. Maximum allowed: ${MediaUtils.formatFileSize(this.maxFileSize)}`
      );
    }

    if (!MediaUtils.isAllowedMimeType(file.mimetype, this.allowedMimeTypes)) {
      throw new BadRequestException(
        `File type not allowed. Allowed types: ${this.allowedMimeTypes.join(', ')}`
      );
    }
  }

  private extractMetadata(file: any): any {
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
