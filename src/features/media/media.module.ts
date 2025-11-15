import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';

import { CaslModule } from '../../common/casl/casl.module';
import {
  MaintenanceTicket,
  MaintenanceTicketSchema,
} from '../maintenance/schemas/maintenance-ticket.schema';
import { Property, PropertySchema } from '../properties/schemas/property.schema';
import { Unit, UnitSchema } from '../properties/schemas/unit.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { MediaController } from './controllers/media.controller';
import { LocalStorageDriver } from './drivers/local-storage.driver';
import { S3StorageDriver } from './drivers/s3-storage.driver';
import { Media, MediaSchema } from './schemas/media.schema';
import { MediaService } from './services/media.service';
import { StorageManager } from './services/storage-manager.service';

@Module({
  imports: [
    ConfigModule,
    CaslModule,
    MongooseModule.forFeature([
      { name: Media.name, schema: MediaSchema },
      { name: User.name, schema: UserSchema },
      { name: Property.name, schema: PropertySchema },
      { name: Unit.name, schema: UnitSchema },
      { name: MaintenanceTicket.name, schema: MaintenanceTicketSchema },
    ]),
    MulterModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const nodeEnv = configService.get<string>('NODE_ENV', 'development');
        const defaultBasePath = nodeEnv === 'production' ? '/tmp/myte-uploads' : 'uploads';
        const basePath = configService.get<string>('MEDIA_UPLOAD_PATH', defaultBasePath);
        const destinationPath = `${basePath}/temp`;

        return {
          storage: diskStorage({
            destination: destinationPath,
            filename: (req, file, callback) => {
              const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
              const extension = extname(file.originalname);
              callback(null, `${file.fieldname}-${uniqueSuffix}${extension}`);
            },
          }),
          limits: {
            fileSize: 10 * 1024 * 1024,
          },
          fileFilter: (req, file, callback) => {
            const allowedMimes = [
              'image/jpeg',
              'image/png',
              'image/gif',
              'image/webp',
              'application/pdf',
              'application/msword',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              'text/plain',
            ];

            if (allowedMimes.includes(file.mimetype)) {
              callback(null, true);
            } else {
              callback(new Error('Invalid file type'), false);
            }
          },
        };
      },
    }),
  ],
  controllers: [MediaController],
  providers: [MediaService, StorageManager, LocalStorageDriver, S3StorageDriver],
  exports: [MediaService, StorageManager, MongooseModule],
})
export class MediaModule {}
