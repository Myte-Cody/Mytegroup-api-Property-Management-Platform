# Scheduler Service Documentation

## Overview

The Scheduler Service manages automated cron jobs for recurring tasks like status updates, lease expiration warnings, and payment reminders. It uses `@nestjs/schedule` and includes comprehensive audit logging.

---

## Configuration

### Enabling the Scheduler

The scheduler is **disabled by default** and must be enabled explicitly:

```bash
# Start with scheduler enabled
npm run start:scheduler

# Or with custom script
node dist/main.js --enable-scheduler
```

### Environment Variables

```env
# Redis (required for distributed locking)
REDIS_HOST=localhost
REDIS_PORT=6379

# Optional: Timezone for cron jobs
TZ=America/New_York
```

---

## Scheduled Jobs

### 1. Daily Status Updates

**Schedule:** Every day at 1:00 AM  
**Cron:** `0 1 * * *`

Updates statuses for rental periods, leases, transactions, and units.

```typescript
@Cron(CronExpression.EVERY_DAY_AT_1AM)
async runDailyStatusUpdates() {
  // Updates:
  // - Rental periods (active, upcoming, completed)
  // - Leases (active, expired, upcoming)
  // - Transactions (pending, overdue, paid)
  // - Units (occupied, vacant)
}
```

**What it does:**

- Activates upcoming rental periods
- Marks expired leases
- Updates transaction statuses
- Recalculates unit occupancy
- Sends automated notifications

**Audit Log:**

```json
{
  "userId": "system",
  "action": "SchedulerService.runDailyStatusUpdates",
  "details": {
    "summary": {
      "rentalPeriods": { "activated": 5, "completed": 2 },
      "leases": { "expired": 3, "activated": 1 },
      "transactions": { "overdue": 4 },
      "units": { "vacated": 2 },
      "duration": "2.5s",
      "executionTime": "2500ms"
    }
  }
}
```

---

### 2. Lease Expiration Warnings

#### 30-Day Warning

**Schedule:** Every day at 2:00 AM  
**Cron:** `0 2 * * *`

```typescript
@Cron(CronExpression.EVERY_DAY_AT_2AM)
async send30DayLeaseExpirationWarnings() {
  await this.leasesService.sendLeaseExpirationWarningEmails(30);
}
```

#### 15-Day Warning

**Schedule:** Every day at 2:15 AM  
**Cron:** `15 2 * * *`

```typescript
@Cron('15 2 * * *')
async send15DayLeaseExpirationWarnings() {
  await this.leasesService.sendLeaseExpirationWarningEmails(15);
}
```

#### 7-Day Warning

**Schedule:** Every day at 2:30 AM  
**Cron:** `30 2 * * *`

```typescript
@Cron('30 2 * * *')
async send7DayLeaseExpirationWarnings() {
  await this.leasesService.sendLeaseExpirationWarningEmails(7);
}
```

**What it does:**

- Finds leases expiring in X days
- Sends warning emails to tenants
- Logs email delivery status

**Audit Log:**

```json
{
  "userId": "system",
  "action": "SchedulerService.send30DayLeaseExpirationWarnings",
  "details": {
    "date": "2025-10-02T02:00:00.000Z",
    "daysBeforeExpiration": 30,
    "result": {
      "emailsSent": 5,
      "leases": ["lease1", "lease2", ...]
    },
    "executionTime": "1200ms"
  }
}
```

---

### 3. Payment Reminders

#### Payment Due Reminders

**Schedule:** Every day at 3:00 AM  
**Cron:** `0 3 * * *`

Sends reminders for payments due in 7 days.

```typescript
@Cron(CronExpression.EVERY_DAY_AT_3AM)
async sendPaymentDueReminders() {
  await this.transactionsService.sendPaymentDueReminders();
}
```

#### Payment Overdue Notices

**Schedule:** Every day at 3:30 AM  
**Cron:** `30 3 * * *`

Sends notices for payments 2+ days overdue.

```typescript
@Cron('30 3 * * *')
async sendPaymentOverdueNotices() {
  await this.transactionsService.sendPaymentOverdueNotices();
}
```

**What it does:**

- Finds upcoming/overdue payments
- Sends reminder emails to tenants
- Logs notification status

**Audit Log:**

```json
{
  "userId": "system",
  "action": "SchedulerService.sendPaymentDueReminders",
  "details": {
    "date": "2025-10-02T03:00:00.000Z",
    "result": {
      "remindersSent": 12,
      "transactions": ["txn1", "txn2", ...]
    },
    "executionTime": "800ms"
  }
}
```

---

## Schedule Overview

| Time    | Job                              | Description                          |
| ------- | -------------------------------- | ------------------------------------ |
| 1:00 AM | Daily Status Updates             | Update all entity statuses           |
| 2:00 AM | 30-Day Lease Expiration Warnings | Notify tenants 30 days before expiry |
| 2:15 AM | 15-Day Lease Expiration Warnings | Notify tenants 15 days before expiry |
| 2:30 AM | 7-Day Lease Expiration Warnings  | Notify tenants 7 days before expiry  |
| 3:00 AM | Payment Due Reminders            | Remind about upcoming payments       |
| 3:30 AM | Payment Overdue Notices          | Notify about overdue payments        |

---

## Audit Logging

All scheduled jobs log their execution to the `AuditLog` collection.

### Successful Execution

```json
{
  "userId": "system",
  "action": "SchedulerService.{jobName}",
  "details": {
    "summary": { ... },
    "executionTime": "1500ms"
  },
  "createdAt": "2025-10-02T01:00:00.000Z"
}
```

### Failed Execution

```json
{
  "userId": "system",
  "action": "SchedulerService.{jobName}.failed",
  "details": {
    "error": {
      "message": "Connection timeout",
      "stack": "Error: Connection timeout\n  at ..."
    },
    "executionTime": "5000ms"
  },
  "createdAt": "2025-10-02T01:00:00.000Z"
}
```

### Viewing Audit Logs

```bash
# Via API (admin only)
GET /audit-logs?action=SchedulerService

# Via MongoDB
db.auditlogs.find({ action: /SchedulerService/ })
```

---

## Error Handling

### Automatic Retry

Jobs do **not** automatically retry on failure. Each job runs once per schedule.

### Error Logging

Errors are logged to:

1. **Application logs** (console/file)
2. **Audit logs** (database)

```typescript
try {
  await this.runJob();
} catch (error) {
  this.logger.error(`Job failed: ${error.message}`, error.stack);

  await this.auditLogService.createLog({
    userId: 'system',
    action: 'SchedulerService.jobName.failed',
    details: { error: { message: error.message, stack: error.stack } },
  });
}
```

### Monitoring Failures

```typescript
// Query failed jobs
const failedJobs = await this.auditLogService.findAll({
  action: /SchedulerService.*\.failed/,
  createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
});
```

---

## Manual Execution

### Via API Endpoints

Create admin endpoints for manual job execution:

```typescript
@Controller('admin/scheduler')
@UseGuards(JwtAuthGuard, AdminGuard)
export class SchedulerController {
  constructor(private schedulerService: SchedulerService) {}

  @Post('status-updates')
  async runStatusUpdates() {
    await this.schedulerService.runDailyStatusUpdates();
    return { message: 'Status updates completed' };
  }

  @Post('lease-warnings/:days')
  async sendLeaseWarnings(@Param('days') days: number) {
    if (days === 30) {
      await this.schedulerService.send30DayLeaseExpirationWarnings();
    } else if (days === 15) {
      await this.schedulerService.send15DayLeaseExpirationWarnings();
    } else if (days === 7) {
      await this.schedulerService.send7DayLeaseExpirationWarnings();
    }
    return { message: `${days}-day warnings sent` };
  }
}
```

### Via CLI

```bash
# Run status updates
npm run status:update

# Custom date for testing
ts-node src/scripts/status-updater.ts --date=2025-10-15
```

---

## Testing Scheduled Jobs

### Unit Tests

```typescript
describe('SchedulerService', () => {
  it('should run daily status updates', async () => {
    const spy = jest.spyOn(statusUpdater, 'executeStatusUpdates');

    await service.runDailyStatusUpdates();

    expect(spy).toHaveBeenCalled();
  });

  it('should log successful execution', async () => {
    const logSpy = jest.spyOn(auditLogService, 'createLog');

    await service.runDailyStatusUpdates();

    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'SchedulerService.runDailyStatusUpdates',
      }),
    );
  });
});
```

### Integration Tests

```typescript
describe('Scheduler Integration', () => {
  it('should send lease expiration warnings', async () => {
    // Create lease expiring in 30 days
    const lease = await createTestLease({
      endDate: addDays(new Date(), 30),
    });

    await service.send30DayLeaseExpirationWarnings();

    // Verify email was sent
    const emails = await getEmailQueue();
    expect(emails).toContainEqual(
      expect.objectContaining({
        to: lease.tenant.email,
        subject: expect.stringContaining('expiring'),
      }),
    );
  });
});
```

---

## Performance Considerations

### Database Queries

Jobs may process large datasets:

```typescript
// ✅ Good: Process in batches
const leases = await this.leaseModel.find({ ... }).limit(100);
for (const batch of chunk(leases, 10)) {
  await Promise.all(batch.map(lease => this.processLease(lease)));
}

// ❌ Bad: Load all at once
const allLeases = await this.leaseModel.find();
```

### Email Delivery

Use queue for email delivery:

```typescript
// ✅ Good: Queue emails
await this.emailQueue.addEmailJob(emailOptions);

// ❌ Bad: Send synchronously
await this.emailService.sendMail(emailOptions);
```

### Execution Time

Monitor job duration:

```typescript
const startTime = Date.now();
await this.runJob();
const duration = Date.now() - startTime;

if (duration > 60000) {
  this.logger.warn(`Job took ${duration}ms - consider optimization`);
}
```

---

## Distributed Systems

### Multiple Instances

When running multiple app instances, use distributed locking to prevent duplicate job execution:

```typescript
// TODO: Implement Redis-based locking
import { Redlock } from 'redlock';

@Cron(CronExpression.EVERY_DAY_AT_1AM)
async runDailyStatusUpdates() {
  const lock = await this.redlock.acquire(['scheduler:status-updates'], 60000);

  try {
    await this.executeJob();
  } finally {
    await lock.release();
  }
}
```

### Timezone Considerations

Set timezone in environment:

```env
TZ=America/New_York
```

Or use timezone in cron expression:

```typescript
@Cron('0 1 * * *', { timeZone: 'America/New_York' })
async runDailyStatusUpdates() { ... }
```

---

## Best Practices

1. **Always log execution** for debugging and monitoring

   ```typescript
   this.logger.log('Starting job...');
   // ... job logic
   this.logger.log('Job completed');
   ```

2. **Use audit logs** for accountability

   ```typescript
   await this.auditLogService.createLog({
     userId: 'system',
     action: 'SchedulerService.jobName',
     details: { summary },
   });
   ```

3. **Handle errors gracefully** - don't let one failure stop other jobs

   ```typescript
   try {
     await this.runJob();
   } catch (error) {
     this.logger.error('Job failed', error);
     // Continue execution
   }
   ```

4. **Test with different dates** using the `baseDate` parameter

   ```typescript
   // Test 30-day warnings with custom date
   await this.leasesService.sendLeaseExpirationWarningEmails(30, new Date('2025-11-01'));
   ```

5. **Monitor execution time** and optimize slow jobs
   ```typescript
   const startTime = Date.now();
   await this.runJob();
   this.logger.log(`Execution time: ${Date.now() - startTime}ms`);
   ```

---

## Troubleshooting

### Jobs Not Running

**Check:**

1. Is scheduler enabled? `--enable-scheduler` flag
2. Is the application running?
3. Check application logs for errors

### Duplicate Executions

**Solution:** Implement distributed locking with Redis

### Wrong Timezone

**Solution:** Set `TZ` environment variable or use `timeZone` option

### Performance Issues

**Solutions:**

- Add database indexes
- Process in batches
- Use queue for async operations
- Optimize queries

---

## Related Documentation

- Status Updater: `src/scripts/status-updater.ts`
- Lease Service: `src/features/leases/services/leases.service.ts`
- Email Service: `docs/services/EMAIL_SERVICE.md`
- Audit Logs: `src/common/services/audit-log.service.ts`

---

**Version**: 1.0.0  
**Last Updated**: 2025-10-02
