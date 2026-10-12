import type { Account } from '@nem/shared';
import { DEMO_EMAIL, DEMO_WORK_EMAIL } from '@nem/shared';

/** Demo accounts "Add account" can sign in, in order (F10). */
export const DEMO_ACCOUNT_EMAILS: readonly string[] = [DEMO_EMAIL, DEMO_WORK_EMAIL];

/** The first demo account not yet on this device, or null when all are. */
export function nextDemoEmail(accounts: readonly Account[]): string | null {
	const signedIn = new Set(accounts.map((account) => account.email.toLowerCase()));
	return DEMO_ACCOUNT_EMAILS.find((email) => !signedIn.has(email)) ?? null;
}
