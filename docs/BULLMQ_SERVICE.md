# BullMQ Job Queue Service

Job queue implementation using BullMQ for handling asynchronous background tasks in the Property Management Platform.

> **📚 Official Documentation:** For general BullMQ concepts, API reference, and advanced features, see the [BullMQ Official Documentation](https://docs.bullmq.io/)

## Overview

This document covers our **specific implementation** of BullMQ in the platform for handling asynchronous background tasks.

**Key Technologies:**
- `@nestjs/bullmq` - NestJS integration
- `bullmq` - Core queue library
- `ioredis` - Redis client
- `@bull-board/nestjs` - Queue monitoring UI

**Current Queues:**
- `email` - Asynchronous email processing

## Configuration

### Environment Variables

```bash
# .env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password  # Optional
```

### Global Setup (`src/app.module.ts`)

```typescript
BullModule.forRoot({
  connection: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
  },
}),
```

### Bull Board Monitoring

Access queue monitoring UI at: **`http://localhost:3000/admin/queues`**

```typescript
// Already configured in app.module.ts
BullBoardModule.forRoot({
  route: '/admin/queues',
  adapter: ExpressAdapter,
}),
```

## Implementation Pattern

### File Structure

```
src/features/<feature>/
├── services/
│   └── <feature>-queue.service.ts      # Queue management
├── processors/
│   └── <feature>-queue.processor.ts    # Job processing
└── <feature>.module.ts                 # Module registration
```

### Queue Service Pattern

```typescript
@Injectable()
export class QueueService {
  constructor(@InjectQueue('queue-name') private queue: Queue) {}

  async addJob(data: JobData, options?: JobOptions) {
    const job = await this.queue.add('job-type', data, {
      delay: options?.delay,
      attempts: options?.attempts || 3,
      backoff: options?.backoff || { type: 'exponential', delay: 2000 },
    });
  }

  async addBulkJobs(jobs: JobData[]) {
    const bulkJobs = jobs.map((data, index) => ({
      name: 'job-type',
      data,
      opts: { attempts: 3, delay: index * 100 },
    }));
    await this.queue.addBulk(bulkJobs);
  }

  async getQueueStatus() { /* ... */ }
  async pauseQueue() { /* ... */ }
  async resumeQueue() { /* ... */ }
  async retryFailedJobs() { /* ... */ }
}
```

### Processor Pattern

```typescript
@Processor('queue-name')
export class QueueProcessor extends WorkerHost {
  constructor(private readonly service: Service) {
    super();
  }

  async process(job: Job<JobData>): Promise<any> {
    switch (job.name) {
      case 'job-type':
        return await this.handleJob(job);
      default:
        throw new Error(`Unknown job type: ${job.name}`);
    }
  }

  async handleJob(job: Job<JobData>): Promise<void> {
    try {
      await this.service.processJob(job.data);
      this.logger.log(`Job ${job.id} completed successfully`);
    } catch (error) {
      this.logger.error(`Job ${job.id} failed`, error);
      throw error; // Triggers retry
    }
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    console.log(`Processing job ${job.id}...`);
  }
}
```

### Module Registration Pattern

```typescript
@Module({
  imports: [
    BullModule.registerQueue({
      name: 'queue-name',
      defaultJobOptions: {
        removeOnComplete: 100,  // Keep last 100 completed jobs
        removeOnFail: 50,       // Keep last 50 failed jobs
      },
    }),
  ],
  providers: [QueueService, QueueProcessor, /* ... */],
  exports: [QueueService],
})
export class FeatureModule {}
```

## Usage Examples

### Basic Job Queuing

```typescript
@Injectable()
export class FeatureService {
  constructor(private queueService: QueueService) {}

  async performAction(data: ActionData) {
    const result = await this.repository.create(data);
    
    // Queue background job (non-blocking)
    await this.queueService.addJob({
      id: result.id,
      type: 'process',
    });
    
    return result;
  }
}
```

### Delayed Job

```typescript
// Process job after 3 days
await this.queueService.addJob(
  { id: '123', type: 'reminder' },
  {
    delay: 3 * 24 * 60 * 60 * 1000, // 3 days in milliseconds
    attempts: 3,
  },
);
```

### Bulk Jobs

```typescript
// Queue multiple jobs efficiently
const jobs = items.map(item => ({
  id: item.id,
  type: 'process',
}));

await this.queueService.addBulkJobs(jobs);
```

## Queue Management Operations

```typescript
// Get queue status
const status = await this.queueService.getQueueStatus();
// Returns: { waiting, active, completed, failed, delayed }

// Pause/resume queue
await this.queueService.pauseQueue();
await this.queueService.resumeQueue();

// Retry failed jobs
await this.queueService.retryFailedJobs();

// Clean old jobs
await this.queue.clean(3600000, 100, 'completed');
```

## Best Practices

1. **Keep Job Data Small** - Store references (IDs), not large objects
2. **Make Jobs Idempotent** - Safe to retry without side effects
3. **Handle Errors Properly** - Log details, then throw to trigger retry
4. **Set Appropriate Timeouts** - Prevent jobs from running indefinitely
5. **Monitor Queue Health** - Use Bull Board to track job status
6. **Use Retry with Backoff** - Default: 3 attempts with exponential backoff

## Common Patterns

### Job Options

```typescript
{
  delay: 5000,                          // Delay 5 seconds
  attempts: 3,                          // Retry 3 times
  backoff: {
    type: 'exponential',
    delay: 2000                         // 2s, 4s, 8s
  },
  timeout: 30000,                       // 30 second timeout
  removeOnComplete: 100,                // Keep last 100
  removeOnFail: 50                      // Keep last 50 failed
}
```

### Worker Events

```typescript
@OnWorkerEvent('active')
onActive(job: Job) { /* Job started */ }

@OnWorkerEvent('completed')
onCompleted(job: Job) { /* Job succeeded */ }

@OnWorkerEvent('failed')
onFailed(job: Job, error: Error) { /* Job failed */ }
```

## Additional Resources

- **BullMQ Docs:** https://docs.bullmq.io/
- **NestJS BullMQ:** https://docs.nestjs.com/techniques/queues
- **Bull Board:** https://github.com/felixmosh/bull-board

## Example Implementation

For a complete working example, see:
- `src/features/email/` - Email queue implementation
- `docs/EMAIL_SERVICE.md` - Email service documentation

---

**Last Updated**: 2025-10-06  
**Last Reviewed**: 2025-10-06
