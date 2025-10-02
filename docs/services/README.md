# Services Documentation

This directory contains comprehensive documentation for the core services in the MyTeGroup API.

---

## Available Documentation

### Core Services

- **[Media Service](./MEDIA_SERVICE.md)** - File upload and storage management
  - Local filesystem storage
  - AWS S3 storage (planned)
  - File validation and authorization
  - URL generation and media retrieval

- **[Email Service](./EMAIL_SERVICE.md)** - Email delivery and templating
  - SMTP configuration (Gmail, SendGrid, AWS SES)
  - Handlebars template system
  - Email queue with BullMQ
  - Specialized email services (auth, invitations, leases, payments)
  - Development mode with Ethereal

- **[Scheduler Service](./SCHEDULER_SERVICE.md)** - Automated cron jobs
  - Daily status updates
  - Lease expiration warnings (30, 15, 7 days)
  - Payment reminders and overdue notices
  - Comprehensive audit logging

- **[Audit Log Service](./AUDIT_LOG_SERVICE.md)** - Activity tracking and logging
  - Request-level logging via interceptors
  - System event logging
  - Admin audit log viewing

---

## Service Categories

### File Management

- Media Service

### Communication

- Email Service
- Template Service
- Email Queue Service

### Automation

- Scheduler Service
- Status Updater Service

### Security & Monitoring

- Audit Log Service
- CASL Authorization Service (see [CASL Documentation](../CASL_AUTHORIZATION.md))

### Business Logic

- Leases Service
- Transactions Service
- Properties Service
- Users Service
- Tenants Service
- Contractors Service

---

## Quick Links

### Related Documentation

- [CASL Authorization](../CASL_AUTHORIZATION.md) - Authorization and permissions
- [CASL Quick Reference](../CASL_QUICK_REFERENCE.md) - Quick reference guide

### Source Code

- Services: `src/features/*/services/`
- Common Services: `src/common/services/`
- Scheduler: `src/scheduler/`

---

## Contributing

When adding new services, please:

1. Create comprehensive documentation following the existing format
2. Include:
   - Overview and architecture
   - Configuration options
   - Usage examples
   - Error handling
   - Best practices
   - Testing examples
3. Update this README with a link to the new documentation
4. Keep examples up-to-date with code changes

---

**Last Updated**: 2025-10-02
