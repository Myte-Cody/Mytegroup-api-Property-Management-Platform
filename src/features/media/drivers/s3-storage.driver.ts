import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
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
  private readonly s3Client: S3Client;

  constructor(private configService: ConfigService) {
    this.bucket = this.configService.get('AWS_S3_BUCKET', '');
    this.region = this.configService.get('AWS_S3_REGION', 'us-east-1');
    this.accessKeyId = this.configService.get('AWS_ACCESS_KEY_ID', '');
    this.secretAccessKey = this.configService.get('AWS_SECRET_ACCESS_KEY', '');
    this.baseUrl = this.configService.get(
      'AWS_S3_BASE_URL',
      `https://${this.bucket}.s3.${this.region}.amazonaws.com`,
    );
    
    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
      },
    });
  }

  async store(file: any, path: string): Promise<string> {
    const uploadParams = {
      Bucket: this.bucket,
      Key: path,
      Body: file.buffer,
      ContentType: file.mimetype,
    };

    await this.s3Client.send(new PutObjectCommand(uploadParams));
    return path;
  }

  async delete(path: string): Promise<void> {
    const deleteParams = {
      Bucket: this.bucket,
      Key: path,
    };

    await this.s3Client.send(new DeleteObjectCommand(deleteParams));
  }

  async getUrl(path: string, expiresIn: number = 3600): Promise<string> {
    // Generate a presigned URL that expires after the specified time (default: 1 hour)
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: path,
    });
    
    try {
      // Generate a signed URL that expires after expiresIn seconds
      const signedUrl = await getSignedUrl(this.s3Client, command, { expiresIn });
      return signedUrl;
    } catch (error) {
      console.error('Error generating presigned URL:', error);
      // Fallback to the base URL if there's an error generating the signed URL
      return `${this.baseUrl}/${path}`;
    }
  }

  async exists(path: string): Promise<boolean> {
    const headParams = {
      Bucket: this.bucket,
      Key: path,
    };

    try {
      await this.s3Client.send(new HeadObjectCommand(headParams));
      return true;
    } catch (error) {
      // If the object doesn't exist, AWS returns a 404 error
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return false;
      }
      // For any other error, rethrow it
      throw error;
    }
  }
}
