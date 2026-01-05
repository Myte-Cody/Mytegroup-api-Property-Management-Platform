export interface SmsConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
  enabled?: boolean;
}

export interface SendSmsOptions {
  to: string | string[];
  body: string;
  mediaUrl?: string[];
  statusCallback?: string;
}

export interface SmsTemplate {
  name: string;
  body: string;
}

export interface TemplateContext {
  [key: string]: any;
}

export interface BulkSmsJob {
  messages: SendSmsOptions[];
  templateName?: string;
  context?: TemplateContext;
}

export interface SmsQueueOptions {
  delay?: number;
  attempts?: number;
  backoff?: {
    type: 'fixed' | 'exponential';
    delay: number;
  };
  priority?: number;
}

export interface SmsMessageStatus {
  sid: string;
  status: 'queued' | 'sending' | 'sent' | 'delivered' | 'undelivered' | 'failed';
  errorCode?: string;
  errorMessage?: string;
  dateSent?: Date;
  dateCreated: Date;
  dateUpdated: Date;
}

export interface SendSmsResult {
  success: boolean;
  messageSid?: string;
  status?: string;
  error?: string;
  to: string;
}
