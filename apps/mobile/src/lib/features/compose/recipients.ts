import { EmailSchema, type Address } from '@nem/shared';

/** One chip in a To/Cc/Bcc field. Invalid entries stay as chips so the user can see and fix them. */
export interface Recipient extends Address {
	isValid: boolean;
}

// Commas and semicolons inside quotes ("Lovelace, Ada" <ada@x.com>) are part of a name, not separators.
const SEPARATOR = /[,;\n](?=(?:[^"]*"[^"]*")*[^"]*$)/;
const NAMED = /^\s*"?([^"<]*?)"?\s*<([^>]*)>\s*$/;

/** Parses one typed entry: `ada@x.com`, `Ada <ada@x.com>` or `"Lovelace, Ada" <ada@x.com>`. */
export function parseRecipient(raw: string): Recipient | null {
	const text = raw.trim();
	if (!text) return null;
	const named = NAMED.exec(text);
	const email = (named?.[2] ?? text).trim().toLowerCase();
	const name = named?.[1]?.trim() || undefined;
	return { email, ...(name && { name }), isValid: EmailSchema.safeParse(email).success };
}

/** Splits pasted or typed text into recipients, skipping blanks. */
export function parseRecipients(text: string): Recipient[] {
	return text
		.split(SEPARATOR)
		.map(parseRecipient)
		.filter((recipient) => recipient !== null);
}

/** Appends recipients, skipping any address already in the list. */
export function addRecipients(list: Recipient[], added: Recipient[]): Recipient[] {
	const seen = new Set(list.map((recipient) => recipient.email));
	const next = [...list];
	for (const recipient of added) {
		if (seen.has(recipient.email)) continue;
		seen.add(recipient.email);
		next.push(recipient);
	}
	return next;
}

/** Typing one of these ends the current entry and turns it into a chip. */
export function isSeparatorKey(key: string): boolean {
	return key === ',' || key === ';' || key === 'Enter' || key === 'Tab';
}

/** The valid addresses, as a draft stores them. */
export function toAddresses(list: Recipient[]): Address[] {
	return list
		.filter((r) => r.isValid)
		.map(({ email, name }) => (name ? { email, name } : { email }));
}

/** Chips from stored addresses (a draft or a reply prefill). */
export function fromAddresses(list: Address[]): Recipient[] {
	return list.map((address) => ({ ...address, isValid: true }));
}
