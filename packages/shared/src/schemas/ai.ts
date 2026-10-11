import { z } from 'zod';
import { CategorySchema } from './mailbox';

/**
 * Every AI result carries how sure it is and why, so the AI badge can explain it.
 * `source` is `heuristic` when the non-AI fallback produced the value.
 */
export function aiInsightSchema<T extends z.ZodType>(value: T) {
	return z.object({
		value,
		confidence: z.number().min(0).max(1),
		explanation: z.string(),
		source: z.enum(['model', 'heuristic'])
	});
}

export interface AIInsight<T> {
	value: T;
	confidence: number;
	explanation: string;
	source: 'model' | 'heuristic';
}

/** Feature IDs follow PRD section 6.8 (AI-1 to AI-12); each one has a Settings toggle. */
export const AI_FEATURES = [
	'categories',
	'spam',
	'summary',
	'smartReply',
	'smartCompose',
	'priority',
	'semanticSearch',
	'toneCheck',
	'followUp',
	'extraction',
	'assistant',
	'unsubscribe'
] as const;
export const AIFeatureSchema = z.enum(AI_FEATURES);
export type AIFeature = z.infer<typeof AIFeatureSchema>;

export const EXTRACTION_KINDS = ['date', 'meeting', 'tracking', 'otp'] as const;

export const ExtractionSchema = z.object({
	kind: z.enum(EXTRACTION_KINDS),
	/** The matched text, as written in the message. */
	text: z.string(),
	/** Normalized value: an ISO date, a tracking number, a code. */
	value: z.string()
});
export type Extraction = z.infer<typeof ExtractionSchema>;

/** AI results for one message. Each is optional: a feature may be off or not run yet. */
export const AIInsightsSchema = z.object({
	category: aiInsightSchema(CategorySchema).optional(),
	spam: aiInsightSchema(z.object({ isSpam: z.boolean(), isPhishing: z.boolean() })).optional(),
	/** Priority score from 0 (ignore) to 1 (important). */
	priority: aiInsightSchema(z.number().min(0).max(1)).optional(),
	summary: aiInsightSchema(
		z.object({ text: z.string(), actionItems: z.array(z.string()) })
	).optional(),
	smartReplies: aiInsightSchema(z.array(z.string()).max(3)).optional(),
	extractions: aiInsightSchema(z.array(ExtractionSchema)).optional()
});
export type AIInsights = z.infer<typeof AIInsightsSchema>;
