import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession } from 'mongoose';
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
    entityType?: string,
    session?: ClientSession,
  ): Promise<Media> {
    // Validate file
    this.validateFile(file);

    // Check permissions
    const ability = this.caslAbilityFactory.createForUser(currentUser);
    if (!ability.can(Action.Create, Media)) {
      throw new ForbiddenException('You do not have permission to upload media');
    }

    // Generate unique filename and path - handle different file object structures
    const originalName = file.originalname || file.originalName || file.name || 'unknown.jpg';
    const uniqueFilename = MediaUtils.generateUniqueFilename(originalName);

    // Determine entity type - use explicit parameter if provided
    let determinedEntityType =
      entityType || entity?.constructor?.name || entity.model_type || 'UnknownModel';
    if (determinedEntityType === 'model' || determinedEntityType === 'Object') {
      // Try to determine type from schema or properties
      if (entity?.address && entity?.name && !entity?.property) {
        determinedEntityType = 'Property';
      } else if (entity?.property && entity?.unitNumber !== undefined) {
        determinedEntityType = 'Unit';
      } else if (entity?.email && entity?.user_type) {
        determinedEntityType = 'User';
      } else {
        // Fallback to a more generic approach
        determinedEntityType = entity?.schema?.modelName || 'UnknownModel';
      }
    }

    const storagePath = MediaUtils.generateStoragePath(
      determinedEntityType,
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
      model_type: determinedEntityType,
      model_id: entity?._id,
      name: originalName,
      file_name: uniqueFilename,
      mime_type: mimeType,
      size: fileSize,
      type: MediaUtils.getMediaTypeFromMime(mimeType),
      disk: selectedDisk,
      path: actualPath,
      collection_name: collection,
      metadata: this.extractMetadata(file),
    };

    // Create media record
    const newMedia = new this.mediaModel(mediaData);

    return session ? await newMedia.save({ session }) : await newMedia.save();
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

    const media = await this.mediaModel.find(query).exec();
    return this.enrichMediaArrayWithUrls(media);
  }

  async findOne(id: string, user: User): Promise<Media & { url: string }> {
    const media = await this.mediaModel.findById(id).exec();

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

  async deleteMedia(id: string, user: User, session: ClientSession | null = null): Promise<void> {
    // Get media without URL enrichment for deletion (more efficient)
    const media = await this.mediaModel.findById(id).exec();

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
    await this.mediaModel.findByIdAndDelete(id, { session });
  }

  async getMediaUrl(media: Media, expiresIn?: number): Promise<string> {
    // For S3 storage, generate a temporary URL with the specified expiration
    // For local storage, just return the regular URL
    const driver = this.storageManager.getDriver(media.disk);
    return await driver.getUrl(media.path, expiresIn);
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
