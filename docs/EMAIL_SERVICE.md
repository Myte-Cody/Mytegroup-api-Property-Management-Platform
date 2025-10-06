# Email Service

A comprehensive email service module for sending emails with template support and background queue processing using BullMQ.

## Architecture

The email service is organized into specialized services for better maintainability:

- **`EmailService`** - Core email sending functionality (SMTP transport)
- **`WelcomeEmailService`** - User onboarding emails
- **`AuthEmailService`** - Authentication-related emails (password reset, verification)
- **`TemplateService`** - Email template compilation
- **`EmailQueueService`** - Background job processing

## Quick Start

### Basic Email Sending

```typescript
import { EmailService } from './email.service';

@Injectable()
export class NotificationService {
  constructor(private emailService: EmailService) {}

  async sendSimpleEmail() {
    await this.emailService.sendMail({
      to: 'user@example.com',
      subject: 'Hello World',
      html: '<h1>Welcome!</h1>',
      text: 'Welcome!',
    });
  }
}
```

### Using Specialized Email Services

```typescript
import { WelcomeEmailService, AuthEmailService } from './services';

@Injectable()
export class UserService {
  constructor(
    private welcomeEmailService: WelcomeEmailService,
    private authEmailService: AuthEmailService,
  ) {}

  // Welcome email
  async registerUser(userData: CreateUserDto) {
    const user = await this.createUser(userData);
    await this.welcomeEmailService.sendWelcomeEmail(
      user.email,
      user.name,
      'https://app.example.com/dashboard',
    );
  }

  // Password reset
  async requestPasswordReset(email: string) {
    const resetToken = this.generateResetToken();
    await this.authEmailService.sendPasswordResetEmail(email, resetToken);
  }
}
```

## Template System

### Using Templates

```typescript
import { TemplateService } from './services/template.service';

@Injectable()
export class NotificationService {
  constructor(private templateService: TemplateService) {}

  async sendCustomEmail() {
    const { html, subject, text } = await this.templateService.compileTemplate('welcome', {
      userName: 'John Doe',
      dashboardUrl: 'https://app.example.com/dashboard',
    });

    await this.emailService.sendMail({
      to: 'user@example.com',
      subject,
      html,
      text,
    });
  }
}
```

## Background Queue Processing

The email system automatically handles background processing through BullMQ. Templates are compiled before queuing for optimal performance.

### Queue Options

```typescript
const options: EmailQueueOptions = {
  delay: 5000, // Delay 5 seconds
  attempts: 3, // Retry 3 times
  backoff: {
    type: 'exponential',
    delay: 2000,
  },
};

// Use options with any email service
await this.welcomeEmailService.sendWelcomeEmail('user@example.com', 'John Doe', dashboardUrl, {
  queue: true,
  ...options,
});
```

### Direct Queue Service Usage (Advanced)

```typescript
import { EmailQueueService } from './services/email-queue.service';

@Injectable()
export class CustomEmailService {
  constructor(private emailQueueService: EmailQueueService) {}

  // Queue pre-compiled email
  async queueCustomEmail() {
    await this.emailQueueService.queueEmail({
      to: 'user@example.com',
      subject: 'Custom Email',
      html: '<p>Pre-compiled email content</p>',
      text: 'Pre-compiled email content',
    });
  }

  // Queue multiple pre-compiled emails
  async queueBulkEmails(emails: SendEmailOptions[]) {
    await this.emailQueueService.queueBulkEmails(emails);
  }
}
```

## Creating Custom Templates

### 1. Create Template File

Create `src/features/email/templates/invoice.hbs`:

```handlebars
<html>
  <body>
    <h1>Invoice {{invoiceNumber}}</h1>
    <p>Dear {{capitalize customerName}},</p>
    <p>Amount: {{formatCurrency amount}}</p>
    <p>Due: {{formatDate dueDate}}</p>
  </body>
</html>
```

### 2. Create Template Config

Create `src/features/email/templates/invoice.json`:

```json
{
  "subject": "Invoice {{invoiceNumber}} - {{formatCurrency amount}}",
  "text": "Invoice {{invoiceNumber}} for {{formatCurrency amount}} due {{formatDate dueDate}}"
}
```

### 3. Use Custom Template

```typescript
const { html, subject, text } = await this.templateService.compileTemplate('invoice', {
  invoiceNumber: 'INV-001',
  customerName: 'john doe',
  amount: 299.99,
  dueDate: new Date('2025-10-01'),
});
```

## Built-in Template Helpers

- `{{formatDate date}}` - Format dates
- `{{formatCurrency amount}}` - Format currency ($299.99)
- `{{capitalize string}}` - Capitalize first letter

## Error Handling

```typescript
try {
  await this.emailService.sendMail(emailData);
} catch (error) {
  // Handle SMTP errors, template errors, etc.
  console.error('Email failed:', error.message);
}
```

## Service Organization

```
src/features/email/
├── services/
│   ├── email.service.ts           # Core SMTP functionality
│   ├── template.service.ts        # Template compilation
│   ├── email-queue.service.ts     # Queue management
│   ├── welcome-email.service.ts   # Welcome & onboarding emails
│   └── auth-email.service.ts      # Authentication emails
├── processors/
│   └── email-queue.processor.ts   # Background job processing
├── templates/                     # Handlebars email templates
├── interfaces/
├── dto/
└── README.md
```

## Common Use Cases

### User Registration

```typescript
@Injectable()
export class UserService {
  constructor(private welcomeEmailService: WelcomeEmailService) {}

  async registerUser(userData: CreateUserDto) {
    const user = await this.userRepository.create(userData);

    // Send welcome email (queued for background processing)
    await this.welcomeEmailService.queueWelcomeEmail(user.email, user.name, this.getDashboardUrl());

    return user;
  }
}
```

### Password Reset Flow

```typescript
@Injectable()
export class AuthService {
  constructor(private authEmailService: AuthEmailService) {}

  async requestPasswordReset(email: string) {
    const user = await this.findUserByEmail(email);
    if (!user) return; // Don't reveal if email exists

    const resetToken = await this.generateResetToken(user.id);

    // Send password reset email
    await this.authEmailService.sendPasswordResetEmail(email, resetToken);
  }
}
```

## Email Debugging with Ethereal

For development debugging, the email service supports Ethereal Email, which provides:

- **Test email accounts** - Auto-generated credentials
- **Web preview** - View sent emails in browser
- **No real delivery** - Safe for testing

### Setup Ethereal Debugging

1. **Enable in Environment**

   ```bash
   NODE_ENV=development
   EMAIL_USE_ETHEREAL=true
   ```

2. **Automatic Configuration**
   - Service creates test accounts automatically
   - Logs credentials and preview URLs
   - Falls back to configured SMTP if Ethereal fails

3. **Preview Emails**

   ```
   [EmailService] Using Ethereal Email for development debugging
   [EmailService] Ethereal credentials - User: test@ethereal.email, Pass: abc123
   [EmailService] Email sent successfully to user@example.com. Message ID: <msg@ethereal.email>
   [EmailService] 📧 Ethereal preview URL: https://ethereal.email/message/abc123
   ```

4. **Access Emails**
   - Click the preview URL to view the email
   - Use credentials to log into Ethereal dashboard
   - View all sent emails in one place

## Best Practices

1. **Use Specialized Services** - Import only the email services you need

   ```typescript
   // ✅ Good - Import specific services
   constructor(
     private welcomeEmailService: WelcomeEmailService,
     private authEmailService: AuthEmailService,
   ) {}

   // ❌ Avoid - Don't import everything
   constructor(private emailService: EmailService) {}
   ```

2. **Queue Background Operations** - Use queue methods for non-critical emails

   ```typescript
   // ✅ For user registration (can be delayed)
   await this.welcomeEmailService.sendWelcomeEmail(email, name, url, { queue: true });

   // ✅ For critical security emails (immediate)
   await this.authEmailService.sendPasswordResetEmail(email, token);
   ```

3. **Development Debugging** - Use Ethereal for testing

   ```typescript
   // Set EMAIL_USE_ETHEREAL=true in development
   // View emails at preview URLs instead of real inboxes
   ```

4. **Template Reuse** - Create reusable templates for common email types
5. **Error Handling** - Implement proper error handling for email failures
6. **Testing** - Test templates with sample data before production
7. **Rate Limiting** - Be mindful of email provider rate limits
8. **Service Organization** - Keep email logic organized by purpose (auth, welcome, notifications)

---

**Last Updated**: 2025-10-06  
**Last Reviewed**: 2025-10-06
