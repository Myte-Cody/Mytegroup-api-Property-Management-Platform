# Audit Log Service Documentation

## Overview

The Audit Log Service provides comprehensive activity tracking and logging for the application. It automatically logs all authenticated requests via interceptors and allows manual logging of system events.

---

## Architecture

### Components

- **AuditLogService**: Core service for creating and querying audit logs
- **AuditLogInterceptor**: Automatically logs all authenticated HTTP requests
- **AuditLogController**: Admin-only endpoints for viewing logs
- **AuditLog Schema**: MongoDB schema for storing log entries

---

## Audit Log Schema

```typescript
{
  userId: string;              // User ID or 'system' for automated tasks
  action: string;              // Action/event name
  details?: Record<string, any>; // Additional context and data
  ip?: string;                 // Client IP address (for HTTP requests)
  userAgent?: string;          // User agent (for HTTP requests)
  path?: string;               // Request path (for HTTP requests)
  method?: string;             // HTTP method (for HTTP requests)
  statusCode?: number;         // Response status code (for HTTP requests)
  responseTime?: number;       // Response time in ms (for HTTP requests)
  createdAt: Date;             // Timestamp
}
```

---

## Automatic Request Logging

### Interceptor Configuration

The `AuditLogInterceptor` is registered globally in `CommonModule`:

```typescript
@Module({
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLogInterceptor,
    },
  ],
})
export class CommonModule {}
```

### What Gets Logged

**Every authenticated request** is automatically logged with:

- User ID
- Action (format: `{Controller}.{Method}`)
- Request details (path, method, IP, user agent)
- Response details (status code, response time)
- Request body (sanitized)

**Example log entry:**

```json
{
  "userId": "507f1f77bcf86cd799439011",
  "action": "PropertiesController.create",
  "details": {
    "body": {
      "name": "Sunset Apartments",
      "address": { "street": "123 Main St" }
    }
  },
  "ip": "192.168.1.100",
  "userAgent": "Mozilla/5.0...",
  "path": "/properties",
  "method": "POST",
  "statusCode": 201,
  "responseTime": 145,
  "createdAt": "2025-10-02T14:30:00.000Z"
}
```

### Data Sanitization

Sensitive data is automatically removed from logs:

**Sanitized fields:**

- `password`
- `token`
- `secret`
- `apiKey`
- `authorization`

**Example:**

```typescript
// Request body
{ email: "user@example.com", password: "secret123" }

// Logged as
{ email: "user@example.com", password: "[REDACTED]" }
```

### Large Response Handling

Responses larger than 1000 characters are truncated:

```json
{
  "details": {
    "response": "[Response too large to log]"
  }
}
```

---

## Manual Logging

### Creating Audit Logs

```typescript
import { AuditLogService } from './common/services/audit-log.service';

@Injectable()
export class PropertyService {
  constructor(private auditLogService: AuditLogService) {}

  async deleteProperty(id: string, user: User) {
    const property = await this.propertyModel.findById(id);

    // Log the deletion
    await this.auditLogService.createLog({
      userId: user._id.toString(),
      action: 'PropertyService.deleteProperty',
      details: {
        propertyId: id,
        propertyName: property.name,
        reason: 'User requested deletion',
      },
    });

    await this.propertyModel.findByIdAndDelete(id);
  }
}
```

### System Event Logging

For automated tasks and system events:

```typescript
// Scheduler jobs
await this.auditLogService.createLog({
  userId: 'system',
  action: 'SchedulerService.runDailyStatusUpdates',
  details: {
    summary: {
      rentalPeriods: { activated: 5 },
      leases: { expired: 3 },
    },
    executionTime: '2500ms',
  },
});

// Background jobs
await this.auditLogService.createLog({
  userId: 'system',
  action: 'EmailQueue.processJob',
  details: {
    jobId: job.id,
    emailTo: job.data.to,
    status: 'sent',
  },
});
```

---

## Querying Audit Logs

### Get All Logs

```typescript
const logs = await this.auditLogService.getLogs(
  {}, // filter
  {
    limit: 50,
    skip: 0,
    sort: { createdAt: -1 },
  },
);
```

### Filter by User

```typescript
const userLogs = await this.auditLogService.getUserLogs(userId, { limit: 100 });
```

### Filter by Action

```typescript
const loginLogs = await this.auditLogService.getLogs(
  { action: 'AuthController.login' },
  { limit: 50 },
);
```

### Filter by Date Range

```typescript
const recentLogs = await this.auditLogService.getLogs({
  createdAt: {
    $gte: new Date('2025-10-01'),
    $lte: new Date('2025-10-02'),
  },
});
```

### Complex Filters

```typescript
const failedLogins = await this.auditLogService.getLogs(
  {
    action: 'AuthController.login',
    statusCode: { $gte: 400 },
  },
  { limit: 100, sort: { createdAt: -1 } },
);
```

---

## Admin API Endpoints

### Get Audit Logs

```http
GET /audit-logs?limit=50&skip=0&userId=123&action=login
Authorization: Bearer {admin-token}
```

**Query Parameters:**

- `limit` (optional): Number of logs to return (default: 50)
- `skip` (optional): Number of logs to skip (default: 0)
- `userId` (optional): Filter by user ID
- `action` (optional): Filter by action name
- `startDate` (optional): Filter by start date
- `endDate` (optional): Filter by end date

**Response:**

```json
{
  "data": [
    {
      "_id": "...",
      "userId": "507f1f77bcf86cd799439011",
      "action": "PropertiesController.create",
      "details": { ... },
      "ip": "192.168.1.100",
      "path": "/properties",
      "method": "POST",
      "statusCode": 201,
      "responseTime": 145,
      "createdAt": "2025-10-02T14:30:00.000Z"
    }
  ],
  "total": 1250,
  "page": 1,
  "limit": 50
}
```

### Get User Activity

```http
GET /audit-logs/user/{userId}?limit=100
Authorization: Bearer {admin-token}
```

---

## Use Cases

### 1. Security Monitoring

Track failed login attempts:

```typescript
const failedLogins = await this.auditLogService.getLogs({
  action: 'AuthController.login',
  statusCode: 401,
  createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
});

if (failedLogins.length > 10) {
  // Alert: Potential brute force attack
}
```

### 2. User Activity Tracking

View all actions by a specific user:

```typescript
const userActivity = await this.auditLogService.getUserLogs(userId, {
  limit: 100,
  sort: { createdAt: -1 },
});
```

### 3. Compliance & Auditing

Track who accessed sensitive data:

```typescript
const dataAccess = await this.auditLogService.getLogs({
  action: /Transaction.*read/,
  'details.transactionId': sensitiveTransactionId,
});
```

### 4. Performance Monitoring

Find slow requests:

```typescript
const slowRequests = await this.auditLogService.getLogs(
  {
    responseTime: { $gte: 1000 }, // > 1 second
  },
  { limit: 50, sort: { responseTime: -1 } },
);
```

### 5. Debugging

Track specific user's journey:

```typescript
const userJourney = await this.auditLogService.getLogs(
  {
    userId: userId,
    createdAt: {
      $gte: new Date('2025-10-02T10:00:00'),
      $lte: new Date('2025-10-02T11:00:00'),
    },
  },
  { sort: { createdAt: 1 } },
);
```

---

## Best Practices

### 1. Use Descriptive Action Names

```typescript
// ✅ Good - clear and specific
action: 'PropertyService.deleteProperty';
action: 'LeaseService.renewLease';
action: 'SchedulerService.runDailyStatusUpdates';

// ❌ Bad - vague
action: 'delete';
action: 'update';
```

### 2. Include Relevant Context

```typescript
// ✅ Good - includes context
await this.auditLogService.createLog({
  userId: user._id.toString(),
  action: 'LeaseService.terminateLease',
  details: {
    leaseId: lease._id,
    propertyName: property.name,
    tenantName: tenant.name,
    reason: 'Early termination requested by tenant',
    terminationDate: new Date(),
  },
});

// ❌ Bad - minimal context
await this.auditLogService.createLog({
  userId: user._id.toString(),
  action: 'LeaseService.terminateLease',
});
```

### 3. Log Important State Changes

```typescript
// Log status changes
await this.auditLogService.createLog({
  userId: 'system',
  action: 'LeaseService.statusChange',
  details: {
    leaseId: lease._id,
    oldStatus: 'active',
    newStatus: 'expired',
    reason: 'End date reached',
  },
});
```

### 4. Don't Log Sensitive Data

```typescript
// ✅ Good - no sensitive data
await this.auditLogService.createLog({
  userId: user._id.toString(),
  action: 'UserService.updatePassword',
  details: {
    userId: user._id,
    timestamp: new Date(),
  },
});

// ❌ Bad - logs password
await this.auditLogService.createLog({
  userId: user._id.toString(),
  action: 'UserService.updatePassword',
  details: {
    oldPassword: oldPass, // ❌ Never log passwords
    newPassword: newPass, // ❌ Never log passwords
  },
});
```

### 5. Use System User for Automated Tasks

```typescript
// ✅ Good - clearly identifies automated task
await this.auditLogService.createLog({
  userId: 'system',
  action: 'SchedulerService.sendPaymentReminders',
  details: { remindersSent: 15 },
});

// ❌ Bad - uses arbitrary user
await this.auditLogService.createLog({
  userId: adminUser._id, // ❌ Misleading
  action: 'SchedulerService.sendPaymentReminders',
});
```

---

## Performance Considerations

### 1. Indexing

Ensure proper indexes on frequently queried fields:

```typescript
// In audit-log.schema.ts
@Schema({ timestamps: true })
export class AuditLog {
  @Prop({ index: true })
  userId: string;

  @Prop({ index: true })
  action: string;

  @Prop({ index: true })
  createdAt: Date;
}
```

### 2. Pagination

Always use pagination for large result sets:

```typescript
// ✅ Good - paginated
const logs = await this.auditLogService.getLogs(filter, { limit: 50, skip: page * 50 });

// ❌ Bad - loads all logs
const allLogs = await this.auditLogService.getLogs(filter);
```

### 3. Archiving

Consider archiving old logs:

```typescript
// Archive logs older than 90 days
const archiveDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
await this.auditLogModel.deleteMany({
  createdAt: { $lt: archiveDate },
});
```

---

## Monitoring & Alerts

### Track Critical Events

```typescript
// Monitor for security events
const criticalEvents = await this.auditLogService.getLogs({
  action: {
    $in: ['AuthController.login', 'UserService.deleteUser', 'PropertyService.deleteProperty'],
  },
  statusCode: { $gte: 400 },
});

if (criticalEvents.length > threshold) {
  // Send alert
}
```

### Dashboard Metrics

```typescript
// Get activity summary
const today = new Date();
today.setHours(0, 0, 0, 0);

const todayLogs = await this.auditLogService.getLogs({
  createdAt: { $gte: today },
});

const metrics = {
  totalRequests: todayLogs.length,
  uniqueUsers: new Set(todayLogs.map((log) => log.userId)).size,
  errors: todayLogs.filter((log) => log.statusCode >= 400).length,
  avgResponseTime:
    todayLogs.reduce((sum, log) => sum + (log.responseTime || 0), 0) / todayLogs.length,
};
```

---

## Testing

### Unit Tests

```typescript
describe('AuditLogService', () => {
  it('should create audit log', async () => {
    const log = await service.createLog({
      userId: 'user123',
      action: 'test.action',
      details: { test: true },
    });

    expect(log.userId).toBe('user123');
    expect(log.action).toBe('test.action');
  });

  it('should filter logs by user', async () => {
    const logs = await service.getUserLogs('user123');

    expect(logs.every((log) => log.userId === 'user123')).toBe(true);
  });
});
```

### Integration Tests

```typescript
describe('Audit Log Interceptor', () => {
  it('should log authenticated requests', async () => {
    const response = await request(app.getHttpServer())
      .get('/properties')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const logs = await auditLogService.getLogs({
      action: 'PropertiesController.findAll',
    });

    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].method).toBe('GET');
    expect(logs[0].path).toBe('/properties');
  });
});
```

---

## Related Documentation

- Interceptor: `src/common/interceptors/audit-log.interceptor.ts`
- Service: `src/common/services/audit-log.service.ts`
- Schema: `src/common/schemas/audit-log.schema.ts`
- Controller: `src/common/controllers/audit-log.controller.ts`
- Scheduler Integration: `docs/services/SCHEDULER_SERVICE.md`

---

**Version**: 1.0.0  
**Last Updated**: 2025-10-02
