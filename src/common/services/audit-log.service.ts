import { Injectable } from '@nestjs/common';
@Injectable()
export class AuditLogService {
  log(message: string) { console.log('AUDIT:', message); }
}
