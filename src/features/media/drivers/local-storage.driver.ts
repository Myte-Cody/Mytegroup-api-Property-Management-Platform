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

@Injectable()
export class LocalStorageDriver implements StorageDriverInterface {
  private readonly uploadPath: string;
  private readonly baseUrl: string;

  constructor(private configService: ConfigService) {
    this.uploadPath = this.configService.get('MEDIA_UPLOAD_PATH', 'uploads');
    this.baseUrl = this.configService.get('APP_BASE_URL', 'http://localhost:3000');
    
    // Ensure upload directory exists
    this.ensureUploadDirectory();
  }

  async store(file: any, relativePath: string): Promise<string> {
    const fullPath = path.join(this.uploadPath, relativePath);
    const directory = path.dirname(fullPath);
    
    // Ensure directory exists
    await mkdir(directory, { recursive: true });
    
    // Write file
    await writeFile(fullPath, file.buffer);
    
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

  getUrl(relativePath: string): string {
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
