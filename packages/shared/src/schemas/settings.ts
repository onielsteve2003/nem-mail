import { z } from 'zod';
import { AI_FEATURES } from './ai';
import { IsoDateTimeSchema } from './common';

export const THEMES = ['system', 'dark', 'light'] as const;
export const DENSITIES = ['compact', 'default', 'comfortable'] as const;
export const SWIPE_ACTIONS = ['archive', 'delete', 'toggleRead', 'snooze', 'move', 'none'] as const;
export const DEFAULT_REPLIES = ['reply', 'replyAll'] as const;

export const SwipeActionSchema = z.enum(SWIPE_ACTIONS);
export type SwipeAction = z.infer<typeof SwipeActionSchema>;

export const SIGNATURE_MAX = 2000;

/** Every AI feature is on until the user turns it off. */
const aiTogglesSchema = z.object(
	Object.fromEntries(AI_FEATURES.map((feature) => [feature, z.boolean().default(true)])) as Record<
		(typeof AI_FEATURES)[number],
		z.ZodDefault<z.ZodBoolean>
	>
);

/**
 * User settings (PRD 6.9). Every field has a default, so `SettingsSchema.parse({})`
 * gives a complete object and older saved settings gain new fields on read.
 */
export const SettingsSchema = z.object({
	theme: z.enum(THEMES).default('dark'),
	density: z.enum(DENSITIES).default('default'),
	swipe: z
		.object({
			left: SwipeActionSchema.default('archive'),
			right: SwipeActionSchema.default('toggleRead')
		})
		.prefault({}),
	ai: aiTogglesSchema.prefault({}),
	signature: z.string().max(SIGNATURE_MAX).default(''),
	vacation: z
		.object({
			enabled: z.boolean().default(false),
			subject: z.string().default(''),
			message: z.string().default(''),
			startsAt: IsoDateTimeSchema.nullable().default(null),
			endsAt: IsoDateTimeSchema.nullable().default(null)
		})
		.prefault({}),
	notifications: z.object({ newMail: z.boolean().default(true) }).prefault({}),
	defaultReply: z.enum(DEFAULT_REPLIES).default('reply'),
	confirm: z
		.object({
			delete: z.boolean().default(true),
			archive: z.boolean().default(false),
			send: z.boolean().default(false)
		})
		.prefault({})
});
export type Settings = z.infer<typeof SettingsSchema>;

export const DEFAULT_SETTINGS: Settings = SettingsSchema.parse({});
