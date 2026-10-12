/** Where signed-out visitors go: the onboarding carousel (F1). */
export const SIGNED_OUT_HOME = '/onboarding';
/** Where signed-in users land: the Inbox (F1 step 4). */
export const SIGNED_IN_HOME = '/mail/inbox';

/** Paths that work either way: the dev gallery. */
const OPEN_PREFIXES = ['/dev/'];

/**
 * The route guard: where to send someone who is on `pathname`, or null to stay.
 * Signed-out visitors may only see onboarding; signed-in users skip it.
 */
export function guardRedirect(
	pathname: string,
	isSignedIn: boolean
): typeof SIGNED_OUT_HOME | typeof SIGNED_IN_HOME | null {
	if (OPEN_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return null;
	const isOnboarding = pathname === SIGNED_OUT_HOME || pathname.startsWith(`${SIGNED_OUT_HOME}/`);
	if (!isSignedIn) return isOnboarding ? null : SIGNED_OUT_HOME;
	return isOnboarding || pathname === '/' ? SIGNED_IN_HOME : null;
}
