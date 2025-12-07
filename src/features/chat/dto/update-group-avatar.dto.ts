import { IsOptional } from 'class-validator';
import { HasMimeType, IsFile, MemoryStoredFile } from 'nestjs-form-data';

export class UpdateGroupAvatarDto {
  @IsOptional()
  @IsFile()
  @HasMimeType(['image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'image/webp'])
  avatar?: MemoryStoredFile;
}
