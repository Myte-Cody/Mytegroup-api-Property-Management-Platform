# MyTeGroup API Documentation

Welcome to the MyTeGroup API documentation. This directory contains comprehensive guides for understanding and working with the codebase.

---

## Documentation Index

### Authorization & Security

- **[CASL Authorization](./CASL_AUTHORIZATION.md)** - Complete guide to the CASL authorization system
  - Permission definitions
  - Policy handlers
  - Guards and decorators
  - Role-based access control

- **[CASL Quick Reference](./CASL_QUICK_REFERENCE.md)** - Quick reference for common CASL patterns
  - Common patterns
  - Controller and service examples
  - Testing patterns
  - Debugging tips

### Services

- **[Services Documentation](./services/)** - Comprehensive service documentation
  - [Media Service](./services/MEDIA_SERVICE.md) - File upload and storage (Local & S3)
  - [Email Service](./services/EMAIL_SERVICE.md) - Email delivery and templating
  - [Scheduler Service](./services/SCHEDULER_SERVICE.md) - Automated cron jobs
  - [Audit Log Service](./services/AUDIT_LOG_SERVICE.md) - Activity tracking and logging

---

## Quick Start

### For New Developers

1. Start with [CASL Authorization](./CASL_AUTHORIZATION.md) to understand the permission system
2. Review [Services Documentation](./services/) for core functionality
3. Use [CASL Quick Reference](./CASL_QUICK_REFERENCE.md) as a daily reference

### For Adding New Features

1. Check [CASL Quick Reference](./CASL_QUICK_REFERENCE.md) for authorization patterns
2. Review relevant service documentation in [services/](./services/)
3. Follow existing patterns and best practices

---

## Documentation Standards

When adding new documentation:

1. **Use Markdown** with proper formatting
2. **Include examples** for all concepts
3. **Add code snippets** with syntax highlighting
4. **Keep it up-to-date** with code changes
5. **Cross-reference** related documentation

---

**Last Updated**: 2025-10-02
