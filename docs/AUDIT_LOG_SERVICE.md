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
    },
    "ip": "192.168.1.100",
    "userAgent": "Mozilla/5.0...",
    "path": "/properties",
    "method": "POST",
    "statusCode": 201
  },
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

### 4. Debugging

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

**Version**: 1.0.0  
**Last Updated**: 2025-10-06  
**Last Reviewed**: 2025-10-06
