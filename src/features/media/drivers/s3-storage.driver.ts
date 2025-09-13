import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageDriverInterface } from '../interfaces/media.interfaces';

@Injectable()
export class S3StorageDriver implements StorageDriverInterface {
  private readonly bucket: string;
  private readonly region: string;
  private readonly accessKeyId: string;
  private readonly secretAccessKey: string;
  private readonly baseUrl: string;

  constructor(private configService: ConfigService) {
    this.bucket = this.configService.get('AWS_S3_BUCKET', '');
    this.region = this.configService.get('AWS_S3_REGION', 'us-east-1');
    this.accessKeyId = this.configService.get('AWS_ACCESS_KEY_ID', '');
    this.secretAccessKey = this.configService.get('AWS_SECRET_ACCESS_KEY', '');
    this.baseUrl = this.configService.get(
      'AWS_S3_BASE_URL',
      `https://${this.bucket}.s3.${this.region}.amazonaws.com`,
    );
  }

  async store(file: any, path: string): Promise<string> {
    // TODO: install @aws-sdk/client-s3
    throw new Error('S3 storage not yet implemented.');

    /*    
    const s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
      },
    });

    const uploadParams = {
      Bucket: this.bucket,
      Key: path,
      Body: file.buffer,
      ContentType: file.mimetype,
    };

    await s3Client.send(new PutObjectCommand(uploadParams));
    return path;
    */
  }

  async delete(path: string): Promise<void> {
    // TODO: Implement S3 delete
    throw new Error('S3 storage not yet implemented.');
  }

  getUrl(path: string): string {
    return `${this.baseUrl}/${path}`;
  }

  async exists(path: string): Promise<boolean> {
    // TODO: Implement S3 head object check
    return false;
  }
}
