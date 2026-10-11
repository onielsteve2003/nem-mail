import { z } from 'zod';
import { IdSchema } from './common';

/** Label colors map to Aurora Noir accents, never to Gmail's palette. */
export const LABEL_COLORS = ['neutral', 'violet', 'lime', 'cyan', 'coral', 'amber'] as const;
export const LabelColorSchema = z.enum(LABEL_COLORS);
export type LabelColor = z.infer<typeof LabelColorSchema>;

export const LABEL_NAME_MAX = 50;

export const LabelSchema = z.object({
	id: IdSchema,
	name: z.string().trim().min(1).max(LABEL_NAME_MAX),
	color: LabelColorSchema,
	/** Labels nest one level deep (FR-2.4). */
	parentId: IdSchema.nullable()
});
export type Label = z.infer<typeof LabelSchema>;
