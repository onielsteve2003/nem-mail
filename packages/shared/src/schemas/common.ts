import { z } from 'zod';

/** Opaque identifier. Mock data uses short strings, the API uses UUIDs. */
export const IdSchema = z.string().min(1);

/** ISO 8601 timestamp with a timezone offset, e.g. `2026-10-11T09:30:00.000Z`. */
export const IsoDateTimeSchema = z.iso.datetime({ offset: true });

export const EmailSchema = z.email();

/** A mailbox address as shown in headers: `Ada Lovelace <ada@example.com>`. */
export const AddressSchema = z.object({
	email: EmailSchema,
	name: z.string().trim().max(200).optional()
});
export type Address = z.infer<typeof AddressSchema>;
