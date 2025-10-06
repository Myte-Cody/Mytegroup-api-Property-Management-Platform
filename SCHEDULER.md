# Mytegroup Property Management Platform Scheduler

This document explains how to set up and use the scheduler for automated tasks in the Mytegroup Property Management Platform.

## Scheduled Tasks

The scheduler runs the following automated tasks:

1. **Daily Status Updates** - Every day at 1:00 AM
   - Updates rental periods (PENDING → ACTIVE, ACTIVE → EXPIRED)
   - Updates lease statuses (ACTIVE → EXPIRED when applicable)
   - Updates transaction statuses (PENDING → OVERDUE for past due dates)
   - Syncs unit availability status (VACANT ↔ OCCUPIED based on lease status)

2. **Lease Expiration Warning Emails**
   - 30-day warnings - Every day at 2:00 AM
   - 15-day warnings - Every day at 2:15 AM
   - 7-day warnings - Every day at 2:30 AM

3. **Payment Notifications**
   - Payment due reminders (7 days before due date) - Every day at 3:00 AM
   - Payment overdue notices (2 days after due date) - Every day at 3:30 AM

## Running the Scheduler

### Development Environment

To run the application with the scheduler enabled in a development environment:

```bash
npm run start:scheduler
```

This will start the application with the `--enable-scheduler` flag, which activates all scheduled tasks.

### Production Environment

For production deployment, you can use the provided systemd service file:

1. Copy the service file to the systemd directory:

```bash
sudo cp mytegroup-scheduler.service /etc/systemd/system/
```

2. Reload systemd to recognize the new service:

```bash
sudo systemctl daemon-reload
```

3. Enable the service to start on boot:

```bash
sudo systemctl enable mytegroup-scheduler
```

4. Start the service:

```bash
sudo systemctl start mytegroup-scheduler
```

5. Check the status of the service:

```bash
sudo systemctl status mytegroup-scheduler
```

## Manual Execution

You can manually trigger any of the scheduled tasks for testing or immediate execution.

### Status Updater

Run the status updater manually:

```bash
npm run status:update
```

This will execute the status updater once and then exit.

### Lease Expiration Warning Emails

You can manually send lease expiration warning emails by calling the `sendLeaseExpirationWarningEmails` method from the LeasesService:

```typescript
// Send 30-day warnings using today as the reference date
await leasesService.sendLeaseExpirationWarningEmails(30);

// Send 30-day warnings using a specific date as the reference date
const specificDate = new Date('2025-10-25');
await leasesService.sendLeaseExpirationWarningEmails(30, specificDate);
```

### Payment Notifications

You can manually trigger payment notifications:

```typescript
// Send payment due reminders
await transactionsService.sendPaymentDueReminders();

// Send payment overdue notices
await transactionsService.sendPaymentOverdueNotices();

// Use a specific reference date
const specificDate = new Date('2025-10-25');
await transactionsService.sendPaymentDueReminders(specificDate);
await transactionsService.sendPaymentOverdueNotices(specificDate);
```

## Logs

When running as a systemd service, logs are sent to syslog and can be viewed with:

```bash
sudo journalctl -u mytegroup-scheduler
```

For development mode, logs are output to the console.

## Adding New Scheduled Tasks

To add a new scheduled task to the system:

1. Create a new method in the appropriate service class that implements the task logic
2. Add a new method in the `SchedulerService` class that calls your service method
3. Decorate the method with `@Cron()` and specify the schedule using either:
   - A cron expression (e.g., `'30 3 * * *'` for 3:30 AM daily)
   - A predefined `CronExpression` constant (e.g., `CronExpression.EVERY_DAY_AT_3AM`)

Example:

```typescript
// In your service class
async sendMonthlyReports(baseDate: Date = new Date()) {
  // Implementation logic
}

// In scheduler.service.ts
@Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
async runMonthlyReports() {
  this.logger.log('📊 Generating monthly reports...');

  try {
    const today = new Date();
    await this.reportsService.sendMonthlyReports(today);
    this.logger.log('✅ Monthly reports sent successfully');
  } catch (error) {
    this.logger.error(`❌ Failed to send monthly reports: ${error.message}`, error.stack);
  }
}
```

The scheduler will automatically run your task according to the specified schedule when the application is started with the `--enable-scheduler` flag.

## Testing Scheduled Tasks

There are several approaches to testing scheduled tasks:

### Manual Testing

1. **Direct Service Method Calls**: Call the service methods directly with test data

   ```typescript
   // In a test file or controller
   await leasesService.sendLeaseExpirationWarningEmails(30, new Date('2025-10-25'));
   ```

2. **Trigger Scheduler Methods**: Call the scheduler methods directly to test the full flow

   ```typescript
   // In a test file or controller
   await schedulerService.send30DayLeaseExpirationWarnings();
   ```

### Automated Testing

For automated tests, you can mock the dependencies and verify the correct methods are called:

```typescript
describe('SchedulerService', () => {
  let schedulerService: SchedulerService;
  let leasesService: LeasesService;

  beforeEach(async () => {
    // Setup test module with mocks
    const module = await Test.createTestingModule({
      providers: [
        SchedulerService,
        {
          provide: LeasesService,
          useValue: {
            sendLeaseExpirationWarningEmails: jest.fn(),
          },
        },
        // Other mocked dependencies
      ],
    }).compile();

    schedulerService = module.get<SchedulerService>(SchedulerService);
    leasesService = module.get<LeasesService>(LeasesService);
  });

  it('should send 30-day lease expiration warnings', async () => {
    await schedulerService.send30DayLeaseExpirationWarnings();
    expect(leasesService.sendLeaseExpirationWarningEmails).toHaveBeenCalledWith(
      30,
      expect.any(Date),
    );
  });
});
```

### Testing with Custom Dates

Many scheduler methods accept a `baseDate` parameter that allows testing with different dates without changing the system clock:

```typescript
// Test with a specific date
const testDate = new Date('2025-10-25');
await leasesService.sendLeaseExpirationWarningEmails(30, testDate);
```

This is particularly useful for testing date-sensitive logic like lease expiration warnings or payment reminders.

---

**Last Updated**: 2025-10-06  
**Last Reviewed**: 2025-10-06
