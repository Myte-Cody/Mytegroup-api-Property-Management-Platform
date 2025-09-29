import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditLogService } from '../services/audit-log.service';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private readonly auditLogService: AuditLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const now = Date.now();
    const request = context.switchToHttp().getRequest();
    const { ip, method, path, headers, user, body, params, query } = request;

    // Extract action from controller and method names
    const controllerName = context.getClass().name;
    const handlerName = context.getHandler().name;
    const action = `${controllerName}.${handlerName}`;

    return next.handle().pipe(
      tap({
        next: (data) => {
          // Only log if we have a user (authenticated requests)
          if (user && user._id) {
            const responseTime = Date.now() - now;
            const statusCode = context.switchToHttp().getResponse().statusCode;

            // Create audit log entry
            this.auditLogService
              .createLog({
                userId: user._id.toString(),
                action,
                details: {
                  request: {
                    params,
                    query,
                    body: this.sanitizeBody(body),
                    ip,
                    userAgent: headers['user-agent'],
                    path,
                    method,
                    statusCode,
                    responseTime,
                  },
                  response: this.sanitizeResponse(data),
                },
              })
              .catch((error) => {
                console.error('Error creating audit log:', error);
              });
          }
        },
        error: (error) => {
          // Log errors if user is authenticated
          if (request.user && request.user._id) {
            const responseTime = Date.now() - now;

            this.auditLogService
              .createLog({
                userId: request.user._id.toString(),
                action,
                details: {
                  request: {
                    params,
                    query,
                    body: this.sanitizeBody(body),
                    ip,
                    userAgent: headers['user-agent'],
                    path,
                    method,
                    statusCode: error.status || 500,
                    responseTime,
                  },
                  error: {
                    message: error.message,
                    name: error.name,
                    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
                  },
                },
              })
              .catch((logError) => {
                console.error('Error creating audit log:', logError);
              });
          }
        },
      }),
    );
  }

  /**
   * Sanitize request body to remove sensitive information
   */
  private sanitizeBody(body: any): any {
    if (!body) return {};

    const sanitized = { ...body };

    // Remove sensitive fields
    const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'credit_card'];
    sensitiveFields.forEach((field) => {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  /**
   * Sanitize response data to avoid storing too much information
   */
  private sanitizeResponse(data: any): any {
    if (!data) return null;

    // If it's a large array, just store the count
    if (Array.isArray(data) && data.length > 10) {
      return {
        type: 'array',
        length: data.length,
        sample: data.slice(0, 3),
      };
    }

    // If it's an object with many fields, just store the keys
    if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
      const keys = Object.keys(data);
      if (keys.length > 20) {
        return {
          type: 'object',
          keys,
          id: data._id || data.id,
        };
      }
    }

    // For smaller data, return as is but limit string length
    if (typeof data === 'string' && data.length > 1000) {
      return data.substring(0, 1000) + '... [truncated]';
    }

    return data;
  }
}
