import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import {
  FeedbackEntry,
  FeedbackMessageRole,
  FeedbackPriority,
  FeedbackStatus,
} from '../schemas/feedback.schema';

export interface FeedbackAnalysisResult {
  summary: string;
  actionItems: string[];
  tags: string[];
  sentiment: string;
  recommendedPriority: FeedbackPriority;
  escalationRisk?: string;
}

const ANALYSIS_PROMPT = `You are the Myte Feedback Strategist for the Myte real estate platform.
- Study the entire conversation and extract the real workflow pain.
- Quantify urgency, identify affected personas, and propose next steps we can actually ship.
- Always return JSON with keys: summary (string), action_items (array of strings), tags (array of strings), sentiment (string), recommended_priority (LOW|MEDIUM|HIGH), escalation_risk (string).
- Voice should be optimistic and operator-friendly, never robotic.`;

@Injectable()
export class FeedbackAnalysisService {
  private readonly logger = new Logger(FeedbackAnalysisService.name);
  private readonly openAi?: OpenAI;
  private readonly model: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    this.model = this.configService.get<string>('OPENAI_FEEDBACK_MODEL') ?? 'gpt-4.1-mini';
    if (apiKey) {
      this.openAi = new OpenAI({ apiKey });
    }
  }

  async analyze(feedback: FeedbackEntry): Promise<FeedbackAnalysisResult> {
    if (!this.openAi) {
      this.logger.warn('OPENAI_API_KEY not configured. Using heuristic fallback for feedback analysis.');
      return this.buildFallback(feedback);
    }

    try {
      const response = await this.openAi.responses.create({
        model: this.model,
        temperature: 0.2,
        input: [
          { role: 'system', content: ANALYSIS_PROMPT },
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: `Conversation (JSON): ${JSON.stringify(feedback.conversation)}`,
              },
            ],
          },
        ],
      });

      const rawOutput = response.output_text ?? '{}';
      const parsed = JSON.parse(rawOutput);

      return {
        summary: parsed.summary || this.buildFallback(feedback).summary,
        actionItems: parsed.action_items ?? [],
        tags: parsed.tags ?? [],
        sentiment: parsed.sentiment ?? 'neutral',
        recommendedPriority: (parsed.recommended_priority as FeedbackPriority) ?? feedback.priority,
        escalationRisk: parsed.escalation_risk,
      };
    } catch (error) {
      this.logger.error(`OpenAI feedback analysis failed: ${error.message}`);
      return this.buildFallback(feedback);
    }
  }

  private buildFallback(feedback: FeedbackEntry): FeedbackAnalysisResult {
    const latestUserMessage = [...feedback.conversation]
      .reverse()
      .find((message) => message.role === FeedbackMessageRole.USER);
    const summary =
      latestUserMessage?.content.length && latestUserMessage.content.length > 240
        ? `${latestUserMessage.content.slice(0, 237)}...`
        : latestUserMessage?.content ?? 'User shared general product feedback.';

    const tags = this.deriveTags(feedback);
    const actionItems = this.deriveActionItems(feedback);
    const sentiment = this.deriveSentiment(feedback);

    return {
      summary,
      actionItems,
      tags,
      sentiment,
      recommendedPriority: feedback.priority ?? FeedbackPriority.MEDIUM,
    };
  }

  private deriveTags(feedback: FeedbackEntry): string[] {
    const tags = new Set<string>();
    const tagMap: { pattern: RegExp; value: string }[] = [
      { pattern: /rent|payment|invoice/i, value: 'Revenue Ops' },
      { pattern: /maintenance|ticket|scope|work order/i, value: 'Maintenance' },
      { pattern: /tenant|resident/i, value: 'Resident Experience' },
      { pattern: /vendor|contractor/i, value: 'Vendor Ops' },
      { pattern: /report|dashboard|insight/i, value: 'Insights' },
    ];

    tagMap.forEach((entry) => {
      if (
        feedback.conversation.some(
          (message) => message.role === FeedbackMessageRole.USER && entry.pattern.test(message.content),
        )
      ) {
        tags.add(entry.value);
      }
    });

    if (!tags.size) {
      tags.add('General Insight');
    }

    return Array.from(tags).slice(0, 4);
  }

  private deriveActionItems(feedback: FeedbackEntry): string[] {
    const actions: string[] = [];
    const patterns = [
      {
        regex: /automation|manual|duplicate/i,
        action: 'Document the current workflow, flag repetitive steps, and spec automation opportunities.',
      },
      {
        regex: /ticket|maintenance|scope/i,
        action: 'Audit maintenance SLAs and tighten intake → dispatch routing with better telemetry.',
      },
      {
        regex: /tenant|resident|communication/i,
        action: 'Design a calmer notification plan with message templates and escalation paths.',
      },
      {
        regex: /report|dashboard|metric/i,
        action: 'Capture the KPI definition, data source, and publish cadence for the requested insight.',
      },
    ];

    patterns.forEach((entry) => {
      if (feedback.conversation.some((message) => entry.regex.test(message.content))) {
        actions.push(entry.action);
      }
    });

    if (!actions.length) {
      actions.push('Schedule a follow-up call to validate the workflow pain and co-design next steps.');
    }

    return actions.slice(0, 3);
  }

  private deriveSentiment(feedback: FeedbackEntry): string {
    const latest = [...feedback.conversation]
      .reverse()
      .find((message) => message.role === FeedbackMessageRole.USER);
    if (!latest) return 'neutral';
    if (/frustrat|angry|upset|broken|awful/i.test(latest.content)) return 'frustrated';
    if (/love|excited|great|awesome|grateful/i.test(latest.content)) return 'optimistic';
    return 'neutral';
  }
}
