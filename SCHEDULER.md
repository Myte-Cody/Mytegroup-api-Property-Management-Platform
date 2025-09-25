# Mytegroup Property Management Platform Scheduler

This document explains how to set up and use the scheduler for automated tasks in the Mytegroup Property Management Platform.

## Scheduled Tasks

The scheduler runs the following tasks:

1. **Daily Status Updates** - Every day at 1:00 AM
   - Updates rental periods (PENDING → ACTIVE, ACTIVE → EXPIRED)
   - Updates lease statuses (ACTIVE → EXPIRED when applicable)
   - Updates transaction statuses (PENDING → OVERDUE for past due dates)
   - Syncs unit availability status (VACANT ↔ OCCUPIED based on lease status)

2. **Lease Expiration Warning Emails**
   - 30-day warnings - Every day at 2:00 AM
   - 15-day warnings - Every day at 2:15 AM
   - 7-day warnings - Every day at 2:30 AM

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

### Status Updater

You can run the status updater manually at any time:

```bash
npm run status:update
```

This will execute the status updater once and then exit.

### Lease Expiration Warning Emails

You can manually send lease expiration warning emails by calling the `sendLeaseExpirationWarningEmails` method from the LeasesService. This method accepts two parameters:

- `daysRemaining`: Number of days remaining before lease expiration (e.g., 30, 15, 7)
- `baseDate` (optional): The reference date to use for calculations (defaults to today)

Example usage in a controller or service:

```typescript
// Send 30-day warnings using today as the reference date
await leasesService.sendLeaseExpirationWarningEmails(30);

// Send 30-day warnings using a specific date as the reference date
const specificDate = new Date('2025-10-25');
await leasesService.sendLeaseExpirationWarningEmails(30, specificDate);
```

## Logs

When running as a systemd service, logs are sent to syslog and can be viewed with:

```bash
sudo journalctl -u mytegroup-scheduler
```

For development mode, logs are output to the console.
