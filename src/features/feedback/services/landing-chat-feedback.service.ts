import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { EmailQueueService } from '../../email/services/email-queue.service';
import { TemplateService } from '../../email/services/template.service';
import { SubscribersService } from '../../subscribers/subscribers.service';
import { LandingChatFeedbackDto } from '../dto/landing-chat-feedback.dto';
import { FeedbackPriority } from '../schemas/feedback.schema';
import { FeedbackService } from './feedback.service';

interface LandingFeedbackClassification {
  summary: string;
  tags: string[];
  sentiment: string;
  primary_role: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  user_email_body: string;
}

@Injectable()
export class LandingChatFeedbackService {
  private readonly logger = new Logger(LandingChatFeedbackService.name);
  private readonly openAi?: OpenAI;
  private readonly model: string;
  private readonly internalFeedbackRecipient?: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly templateService: TemplateService,
    private readonly emailQueueService: EmailQueueService,
    private readonly subscribersService: SubscribersService,
    private readonly feedbackService: FeedbackService,
  ) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    this.model = this.configService.get<string>('OPENAI_FEEDBACK_MODEL') ?? 'gpt-4.1';
    this.internalFeedbackRecipient = this.configService.get<string>('FEEDBACK_INBOX_EMAIL');

    if (apiKey) {
      this.openAi = new OpenAI({ apiKey });
    }
  }

  async handleLandingFeedback(dto: LandingChatFeedbackDto): Promise<void> {
    const { email, name, channel, conversation } = dto;
    const normalizedEmail = email.trim().toLowerCase();

    const plainConversation = conversation
      .map((message) => {
        const speaker = message.role === 'user' ? 'User' : 'MYTE Estates';
        return `${speaker}: ${message.content}`;
      })
      .join('\n');

    const classification = await this.classifyConversation(plainConversation);

    try {
      await this.subscribersService.upsertFromFeedback(
        normalizedEmail,
        {
          channel,
          summary: classification.summary,
          tags: classification.tags,
          actionItems: [],
          sentiment: classification.sentiment,
        },
        name,
      );
    } catch (err) {
      this.logger.error(
        `Proceeding without subscriber upsert due to error: ${err?.message || err}`,
      );
    }

    // Persist into feedback collection when the email maps to an existing user
    try {
      await this.feedbackService.createFromLandingEmail(normalizedEmail, conversation, {
        summary: classification.summary,
        tags: classification.tags,
        sentiment: classification.sentiment,
        priority: this.mapPriorityToEnum(classification.priority),
      });
    } catch (err) {
      this.logger.error(
        `Failed to persist landing feedback to feedback collection: ${err?.message || err}`,
      );
    }

    await this.sendInternalNotification(
      normalizedEmail,
      name,
      channel,
      plainConversation,
      classification,
    );
    await this.sendUserConfirmation(normalizedEmail, name, classification);
  }

  private async classifyConversation(conversation: string): Promise<LandingFeedbackClassification> {
    if (!this.openAi) {
      this.logger.warn(
        'OPENAI_API_KEY not configured. Using heuristic landing feedback classification.',
      );
      return {
        summary:
          conversation.length > 280
            ? `${conversation.slice(0, 277)}...`
            : conversation || 'User shared product feedback.',
        tags: ['Landing Chat'],
        sentiment: 'neutral',
        primary_role: 'unknown',
        priority: 'MEDIUM',
        user_email_body:
          'Thanks for taking the time to share feedback on MYTE Estates. We will review what you shared and fold it into how we shape the product.',
      };
    }

    const systemPrompt = `You are the feedback summarizer for MYTE Estates, an operator-minded real estate workspace.

You will be given a raw chat transcript between a visitor and the MYTE Estates assistant.

Your job:
- Extract the core product feedback and workflow pain in a way that founders and operators can quickly understand.
- Identify likely persona (owner, tenant, service_provider, or other).
- Estimate sentiment and rough priority (LOW, MEDIUM, HIGH).
- Draft a short, warm email body we can send back to the user thanking them for their feedback.

Important formatting rules:
- Respond with STRICT JSON only. No markdown, no commentary, no extra keys.
- Use this exact JSON shape:
  {
    "summary": string,
    "tags": string[],
    "sentiment": "very_negative" | "negative" | "neutral" | "positive" | "very_positive",
    "primary_role": "owner" | "tenant" | "service_provider" | "other",
    "priority": "LOW" | "MEDIUM" | "HIGH",
    "user_email_body": string
  }

Rules for user_email_body:
- 3–6 short sentences, friendly and operator-minded.
- Thank them, reflect back what they seem to care about, and reassure them we will treat it seriously.
- Do NOT include any profanity, slurs, or insulting language.
- Do NOT give legal, tax, or safety-critical advice.
- Do NOT promise specific shipping dates or guarantees — speak in terms like "we'll review", "we're exploring", "we'll factor this into our roadmap".
- Do NOT include a greeting or sign-off; we will wrap it in our own email template.`;

    try {
      const response = await this.openAi.responses.create({
        model: this.model,
        temperature: 0.3,
        max_output_tokens: 300,
        input: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: `Chat transcript:\n${conversation}`,
              },
            ],
          },
        ],
      });

      const raw = response.output_text ?? '{}';
      const parsed = JSON.parse(raw) as LandingFeedbackClassification;

      return {
        summary: parsed.summary || 'User shared product feedback via landing chat.',
        tags: parsed.tags ?? [],
        sentiment: parsed.sentiment ?? 'neutral',
        primary_role: parsed.primary_role ?? 'other',
        priority: (parsed.priority as LandingFeedbackClassification['priority']) ?? 'MEDIUM',
        user_email_body:
          parsed.user_email_body ||
          'Thanks for taking the time to share feedback on MYTE Estates. We will review what you shared and fold it into how we shape the product.',
      };
    } catch (error: any) {
      this.logger.error(`Landing feedback classification failed: ${error.message}`, error.stack);
      return {
        summary:
          conversation.length > 280
            ? `${conversation.slice(0, 277)}...`
            : conversation || 'User shared product feedback.',
        tags: ['Landing Chat'],
        sentiment: 'neutral',
        primary_role: 'other',
        priority: 'MEDIUM',
        user_email_body:
          'Thanks for taking the time to share feedback on MYTE Estates. We will review what you shared and fold it into how we shape the product.',
      };
    }
  }

  private async sendInternalNotification(
    email: string,
    name: string | undefined,
    channel: string,
    conversation: string,
    classification: LandingFeedbackClassification,
  ): Promise<void> {
    if (!this.internalFeedbackRecipient) {
      this.logger.warn(
        'FEEDBACK_INBOX_EMAIL not configured; skipping internal feedback notification email.',
      );
      return;
    }

    const brandName = this.configService.get<string>('BRAND_NAME') || 'MYTE';
    const brandLogoUrl = this.configService.get<string>('BRAND_LOGO_URL') || '';
    const brandColor = this.configService.get<string>('BRAND_PRIMARY_COLOR') || '#2563eb';

    const context = {
      email,
      name: name ?? '',
      channel,
      summary: classification.summary,
      tags: classification.tags,
      sentiment: classification.sentiment,
      primary_role: classification.primary_role,
      priority: classification.priority,
      conversation,
      brandName,
      brandLogoUrl,
      brandColor,
    };

    const { html, subject, text } = await this.templateService.compileTemplate(
      'landing-chat-feedback-internal',
      context,
    );

    await this.emailQueueService.queueEmail({
      to: this.internalFeedbackRecipient,
      subject,
      html,
      text,
    });
  }

  private async sendUserConfirmation(
    email: string,
    name: string | undefined,
    classification: LandingFeedbackClassification,
  ): Promise<void> {
    const brandName = this.configService.get<string>('BRAND_NAME') || 'MYTE';
    const brandLogoUrl = this.configService.get<string>('BRAND_LOGO_URL') || '';
    const brandColor = this.configService.get<string>('BRAND_PRIMARY_COLOR') || '#2563eb';

    const context = {
      email,
      name: name ?? '',
      body: classification.user_email_body,
      summary: classification.summary,
      brandName,
      brandLogoUrl,
      brandColor,
    };

    const { html, subject, text } = await this.templateService.compileTemplate(
      'landing-chat-feedback-confirmation',
      context,
    );

    await this.emailQueueService.queueEmail({
      to: email,
      subject,
      html,
      text,
    });
  }

  private mapPriorityToEnum(priority: LandingFeedbackClassification['priority']): FeedbackPriority {
    switch (priority) {
      case 'HIGH':
        return FeedbackPriority.HIGH;
      case 'LOW':
        return FeedbackPriority.LOW;
      case 'MEDIUM':
      default:
        return FeedbackPriority.MEDIUM;
    }
  }
}
