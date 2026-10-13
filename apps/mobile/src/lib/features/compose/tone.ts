import type { ToneVerdict } from '#lib/ai/models/tone.js';

/** Sending never waits longer than this for the tone check (a model may still be loading). */
export const TONE_TIMEOUT_MS = 2500;

/**
 * Runs the tone check before sending (AI-8). Resolves null, meaning "send", when the
 * check is off, fails or takes too long, so it can never block a message.
 */
export async function toneBeforeSend(
	check: () => Promise<ToneVerdict | null>,
	timeoutMs = TONE_TIMEOUT_MS
): Promise<ToneVerdict | null> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const timeout = new Promise<null>((resolve) => {
		timer = setTimeout(() => resolve(null), timeoutMs);
	});
	try {
		const verdict = await Promise.race([check().catch(() => null), timeout]);
		return verdict?.value.isHarsh ? verdict : null;
	} finally {
		clearTimeout(timer);
	}
}
