# Database Transactions Service

## Overview

The Session Service provides MongoDB transaction support for ensuring data consistency across multiple database operations. It automatically detects transaction support and handles environments without replica sets gracefully.

**Location:** `src/common/services/session.service.ts`

---

## Core Features

- **Automatic Transaction Detection**: Checks if MongoDB supports transactions (requires replica set)
- **ACID Compliance**: Ensures atomicity, consistency, isolation, and durability
- **Automatic Rollback**: Rolls back all changes on error
- **Graceful Degradation**: Works in non-replica-set environments (tests)
- **Session Management**: Proper cleanup in all scenarios

---

## Usage

### Basic Usage

```typescript
import { SessionService } from '@/common/services/session.service';

@Injectable()
export class MyService {
  constructor(private readonly sessionService: SessionService) {}

  async performMultiStepOperation() {
    return await this.sessionService.withSession(async (session) => {
      // All operations within this callback use the same session
      await this.model1.create([data1], { session });
      await this.model2.updateOne(filter, update, { session });
      await this.model3.deleteOne(filter, { session });

      // If any operation fails, all changes are rolled back
      return result;
    });
  }
}
```

### Real-World Example: Payment Proof Submission

```typescript
async submitTransactionProof(
  leaseId: string,
  rentalPeriodId: string,
  submitDto: UploadTransactionProofDto,
  currentUser: UserDocument,
): Promise<Transaction> {
  return await this.sessionService.withSession(async (session: ClientSession | null) => {
    // Step 1: Find and validate transaction
    const transaction = await this.transactionModel
      .findOne({ lease: leaseId, rentalPeriod: rentalPeriodId }, null, { session })
      .exec();

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    // Step 2: Update transaction status
    const updatedTransaction = await this.transactionModel
      .findByIdAndUpdate(
        transaction._id,
        { paymentMethod: submitDto.paymentMethod, status: PaymentStatus.PAID },
        { new: true, session }
      )
      .exec();

    // Step 3: Upload media files
    if (submitDto.media_files?.length > 0) {
      await Promise.all(
        submitDto.media_files.map(file =>
          this.mediaService.upload(file, updatedTransaction, currentUser, 'transaction_proof', undefined, undefined, session)
        )
      );
    }

    // All operations committed together
    return updatedTransaction;
  });
}
```

---

## How It Works

### Transaction Support Detection

```typescript
private async checkTransactionSupport(): Promise<void> {
  // Check server status
  const admin = this.connection.db.admin();
  const serverStatus = await admin.serverStatus();

  // MongoDB Memory Server doesn't support replica sets
  if (!serverStatus.repl) {
    this.transactionsSupported = false;
    return;
  }

  // Try to start a test transaction
  try {
    const session = await this.connection.startSession();
    await session.startTransaction();
    await session.commitTransaction();
    await session.endSession();
    this.transactionsSupported = true;
  } catch (error) {
    this.transactionsSupported = false;
  }
}
```

### Execution Flow

1. **Check Support**: Verifies if MongoDB supports transactions (cached after first check)
2. **Start Session**: Creates a new MongoDB session
3. **Execute Callback**: Runs your operations with the session
4. **Commit or Rollback**:
   - Success → Commits all changes
   - Error → Rolls back all changes and re-throws error
5. **Cleanup**: Always ends the session

---

## Best Practices

### ✅ DO

```typescript
// Pass session to all operations
await this.model.create([data], { session });
await this.model.findByIdAndUpdate(id, update, { session });
await this.model.deleteOne(filter, { session });

// Handle session parameter in called methods
async myMethod(data: any, session: ClientSession | null) {
  return await this.model.create([data], { session });
}

// Use for multi-step operations
await this.sessionService.withSession(async (session) => {
  await this.updateLease(leaseId, data, session);
  await this.createTransaction(transactionData, session);
  await this.uploadMedia(file, session);
});
```

### ❌ DON'T

```typescript
// Don't forget to pass session
await this.model.create([data]); // ❌ Changes not in transaction

// Don't nest withSession calls
await this.sessionService.withSession(async (session1) => {
  await this.sessionService.withSession(async (session2) => {
    // ❌ Creates separate transaction
    // ...
  });
});

// Don't use for single operations
await this.sessionService.withSession(async (session) => {
  return await this.model.findById(id, { session }); // ❌ Unnecessary overhead
});
```

---

## When to Use Transactions

### ✅ Use Transactions For:

- **Multi-collection updates**: Updating lease + creating transactions
- **Create with relationships**: Creating entity + uploading media
- **Complex workflows**: Lease termination (update lease + units + create refund transactions)
- **Financial operations**: Payment processing with multiple updates
- **Data consistency**: Any operation where partial completion would leave inconsistent state

### ❌ Don't Use Transactions For:

- **Single document operations**: MongoDB already provides atomicity
- **Read-only operations**: No need for transaction overhead
- **Independent operations**: Operations that don't need to be atomic
- **Performance-critical paths**: Transactions add overhead

---

## MongoDB Replica Set Requirement

### Why Replica Set?

MongoDB transactions require a replica set because:

- Transactions need an oplog for rollback capability
- Distributed consistency requires coordination
- Standalone MongoDB doesn't have these features

### Development Setup

```bash
# Start MongoDB with replica set
mongod --dbpath /usr/local/var/mongodb --replSet "rs0"

# Initialize replica set
mongosh --eval "rs.initiate()"

# Verify status
mongosh --eval "rs.status()"
```

### Production Setup

- **MongoDB Atlas**: Automatically configured as replica set
- **Self-hosted**: Configure in `/etc/mongod.conf`:
  ```yaml
  replication:
    replSetName: 'rs0'
  ```

### Testing Environment

For tests using MongoDB Memory Server (no replica set):

- Service detects lack of support
- Operations execute without transactions
- Tests still pass but without ACID guarantees

---

## Integration Points

Used by services that need multi-step atomic operations:

- **Transactions Service**: Payment proof submission with media upload
- **Leases Service**: Lease termination with deposit refunds
- **Invitations Service**: User creation with organization setup
- **Contractors Service**: Contractor creation with user account

---

## Error Handling

```typescript
try {
  await this.sessionService.withSession(async (session) => {
    // Your operations
  });
} catch (error) {
  // All changes automatically rolled back
  // Handle error appropriately
  throw new BadRequestException('Operation failed');
}
```

The service automatically:

- Aborts transaction on any error
- Cleans up session resources
- Re-throws the original error

---

## Performance Considerations

- **Caching**: Transaction support check is cached after first run
- **Overhead**: Transactions add ~10-20ms overhead per operation
- **Use Sparingly**: Only for operations requiring atomicity
- **Connection Pool**: Ensure adequate connection pool size for concurrent transactions

---

**Last Updated**: 2025-10-06  
**Version**: 1.0.0
