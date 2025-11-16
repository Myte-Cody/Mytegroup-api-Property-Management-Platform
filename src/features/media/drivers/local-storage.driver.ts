import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { StorageDriverInterface } from '../interfaces/media.interfaces';

const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);
const access = promisify(fs.access);
const mkdir = promisify(fs.mkdir);
const copyFile = promisify(fs.copyFile);

@Injectable()
export class LocalStorageDriver implements StorageDriverInterface {
  private readonly uploadPath: string;
  private readonly baseUrl: string;

  constructor(private configService: ConfigService) {
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
    const defaultUploadPath = nodeEnv === 'production' ? '/tmp/myte-uploads' : 'uploads';
    this.uploadPath = this.configService.get('MEDIA_UPLOAD_PATH', defaultUploadPath);
    this.baseUrl = this.configService.get('APP_BASE_URL', 'http://localhost:3000');
  }

  async store(file: any, relativePath: string): Promise<string> {
    // Ensure base upload directory exists before writing
    await this.ensureUploadDirectory();

    const fullPath = path.join(this.uploadPath, relativePath);
    const directory = path.dirname(fullPath);

    // Ensure directory exists
    await mkdir(directory, { recursive: true });

    // Handle different file object structures
    if (file.buffer) {
      // Memory storage - file has buffer property
      await writeFile(fullPath, file.buffer);
    } else if (file.path) {
      // Disk storage - file is already stored, need to move it
      await copyFile(file.path, fullPath);
      // Clean up temp file
      try {
        await unlink(file.path);
      } catch (error) {
        console.warn('Failed to clean up temp file:', file.path);
      }
    } else {
      throw new Error('File object must have either buffer or path property');
    }

    return relativePath;
  }

  async delete(relativePath: string): Promise<void> {
    const fullPath = path.join(this.uploadPath, relativePath);

    try {
      await unlink(fullPath);
    } catch (error) {
      // File might not exist, which is fine
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async getUrl(relativePath: string, expiresIn?: number): Promise<string> {
    // Local storage doesn't need temporary URLs, so we ignore the expiresIn parameter
    return `${this.baseUrl}/uploads/${relativePath}`;
  }

  async exists(relativePath: string): Promise<boolean> {
    const fullPath = path.join(this.uploadPath, relativePath);

    try {
      await access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  private async ensureUploadDirectory(): Promise<void> {
    try {
      await mkdir(this.uploadPath, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }
}
