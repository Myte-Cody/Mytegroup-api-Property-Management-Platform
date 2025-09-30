import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditLog, AuditLogDocument } from '../schemas/audit-log.schema';

@Injectable()
export class AuditLogService {
  constructor(@InjectModel(AuditLog.name) public auditLogModel: Model<AuditLogDocument>) {}

  /**
   * Create a detailed audit log entry
   */
  async createLog(logData: { userId: string; action: string; details?: Record<string, any> }) {
    const auditLog = new this.auditLogModel(logData);
    return await auditLog.save();
  }

  /**
   * Get audit logs with optional filtering
   */
  async getLogs(
    filter: Record<string, any> = {},
    options: { limit?: number; skip?: number; sort?: Record<string, 1 | -1> } = {},
  ) {
    const query = this.auditLogModel.find(filter);

    if (options.skip) {
      query.skip(options.skip);
    }

    if (options.limit) {
      query.limit(options.limit);
    }

    if (options.sort) {
      query.sort(options.sort);
    } else {
      query.sort({ createdAt: -1 });
    }

    return await query.exec();
  }

  /**
   * Get audit logs for a specific user
   */
  async getUserLogs(
    userId: string,
    options: { limit?: number; skip?: number; sort?: Record<string, 1 | -1> } = {},
  ) {
    return this.getLogs({ userId }, options);
  }
}
