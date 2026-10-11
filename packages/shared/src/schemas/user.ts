import { z } from 'zod';
import { EmailSchema, IdSchema, IsoDateTimeSchema } from './common';

export const UserSchema = z.object({
	id: IdSchema,
	email: EmailSchema,
	name: z.string().trim().min(1).max(100),
	/** Seeds the generated avatar gradient, so it stays stable across devices. */
	avatarSeed: z.string().min(1),
	createdAt: IsoDateTimeSchema
});
export type User = z.infer<typeof UserSchema>;

/** A signed-in account on this device, listed in the account switcher. */
export const AccountSchema = UserSchema.pick({
	id: true,
	email: true,
	name: true,
	avatarSeed: true
}).extend({
	signedInAt: IsoDateTimeSchema
});
export type Account = z.infer<typeof AccountSchema>;

/** Someone the user has mailed with; powers recipient autocomplete. */
export const ContactSchema = z.object({
	id: IdSchema,
	email: EmailSchema,
	name: z.string().trim().max(200).optional(),
	lastContactedAt: IsoDateTimeSchema.nullable(),
	/** How many messages were exchanged; ranks autocomplete suggestions. */
	frequency: z.int().nonnegative()
});
export type Contact = z.infer<typeof ContactSchema>;
