import * as path from 'path';
import * as crypto from 'crypto';
import { MediaType } from '../schemas/media.schema';

export class MediaUtils {
  /**
   * Generate a unique filename with UUID
   */
  static generateUniqueFilename(originalName: string): string {
    const ext = path.extname(originalName);
    const uuid = crypto.randomUUID();
    return `${uuid}${ext}`;
  }

  /**
   * Generate storage path based on entity and date
   */
  static generateStoragePath(
    entityType: string, 
    entityId: string, 
    filename: string,
    collection: string = 'default'
  ): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${entityType.toLowerCase()}/${entityId}/${collection}/${year}/${month}/${day}/${filename}`;
  }

  /**
   * Determine media type from MIME type
   */
  static getMediaTypeFromMime(mimeType: string): MediaType {
    if (mimeType.startsWith('image/')) {
      return MediaType.IMAGE;
    } else if (mimeType.startsWith('video/')) {
      return MediaType.VIDEO;
    } else if (mimeType.startsWith('audio/')) {
      return MediaType.AUDIO;
    } else if (
      mimeType.includes('pdf') ||
      mimeType.includes('document') ||
      mimeType.includes('text') ||
      mimeType.includes('application/')
    ) {
      return MediaType.DOCUMENT;
    } else {
      return MediaType.OTHER;
    }
  }

  /**
   * Validate file type against allowed types
   */
  static isAllowedMimeType(mimeType: string, allowedTypes?: string[]): boolean {
    if (!allowedTypes || allowedTypes.length === 0) {
      // Default allowed types
      const defaultAllowed = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'application/pdf',
        'text/plain',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ];
      return defaultAllowed.includes(mimeType);
    }
    
    return allowedTypes.includes(mimeType);
  }

  /**
   * Format file size in human readable format
   */
  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Extract image metadata (if available)
   */
  static extractImageMetadata(file: any): { width?: number; height?: number } | null {
    // This is a basic implementation
    // For production, consider using libraries like 'sharp' or 'jimp' for proper image metadata extraction
    return null;
  }

  /**
   * Validate file size
   */
  static isValidFileSize(size: number, maxSizeInBytes: number): boolean {
    return size <= maxSizeInBytes;
  }
}
