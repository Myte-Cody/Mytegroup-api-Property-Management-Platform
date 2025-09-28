import { Type } from 'class-transformer';
import { IsArray, IsEmail, IsOptional, IsString, ValidateNested } from 'class-validator';

export class EmailAttachmentDto {
  @IsString()
  filename: string;

  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  contentType?: string;

  @IsOptional()
  @IsString()
  encoding?: string;

  @IsOptional()
  @IsString()
  cid?: string;
}

export class SendEmailDto {
  @IsEmail({}, { each: true })
  to: string | string[];

  @IsString()
  subject: string;

  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsString()
  html?: string;

  @IsOptional()
  @IsEmail({}, { each: true })
  cc?: string | string[];

  @IsOptional()
  @IsEmail({}, { each: true })
  bcc?: string | string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EmailAttachmentDto)
  attachments?: EmailAttachmentDto[];
}

export class SendTemplateEmailDto {
  @IsEmail({}, { each: true })
  to: string | string[];

  @IsString()
  templateName: string;

  @IsOptional()
  context?: Record<string, any>;

  @IsOptional()
  @IsEmail({}, { each: true })
  cc?: string | string[];

  @IsOptional()
  @IsEmail({}, { each: true })
  bcc?: string | string[];
}

export class BulkEmailDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SendEmailDto)
  emails: SendEmailDto[];

  @IsOptional()
  @IsString()
  templateName?: string;

  @IsOptional()
  context?: Record<string, any>;
}
