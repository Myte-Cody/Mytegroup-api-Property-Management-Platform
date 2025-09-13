import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LocalStorageDriver } from '../drivers/local-storage.driver';
import { S3StorageDriver } from '../drivers/s3-storage.driver';
import { StorageDriverInterface } from '../interfaces/media.interfaces';
import { StorageDisk } from '../schemas/media.schema';

@Injectable()
export class StorageManager {
  constructor(
    private localDriver: LocalStorageDriver,
    private s3Driver: S3StorageDriver,
    private configService: ConfigService,
  ) {}

  getDriver(disk?: StorageDisk): StorageDriverInterface {
    const driverName = disk || this.configService.get('MEDIA_DEFAULT_DISK', StorageDisk.LOCAL);

    switch (driverName) {
      case StorageDisk.S3:
        return this.s3Driver;
      case StorageDisk.LOCAL:
      default:
        return this.localDriver;
    }
  }

  getDefaultDisk(): StorageDisk {
    const diskName = this.configService.get('MEDIA_DEFAULT_DISK', 'local');
    return diskName === 's3' ? StorageDisk.S3 : StorageDisk.LOCAL;
  }
}
