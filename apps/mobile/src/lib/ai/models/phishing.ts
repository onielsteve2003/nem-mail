/**
 * Phishing heuristics (PRD AI-2): rules, no model. Each check returns a plain-words
 * reason so the thread banner can say why a message was flagged.
 */

export interface PhishingInput {
	fromName: string;
	fromEmail: string;
	subject: string;
	bodyText: string;
	bodyHtml: string | null;
}

export type PhishingSignal =
	'link-mismatch' | 'ip-link' | 'lookalike-domain' | 'credential-request' | 'urgent-wording';

export interface PhishingFinding {
	signal: PhishingSignal;
	reason: string;
}

/** Signals strong enough to call a message phishing on their own. */
const STRONG_SIGNALS: readonly PhishingSignal[] = ['link-mismatch', 'ip-link', 'lookalike-domain'];

const URGENT =
	/\b(urgent|immediately|suspend(?:ed)?|within 24 hours|act (?:now|fast)|final (?:notice|warning)|account (?:will be )?(?:closed|locked))\b/i;
const CREDENTIALS =
	/\b(verify|confirm|update|enter|re-?enter)\b[^.!?\n]{0,40}\b(password|login|account details|card (?:number|details)|bank details|ssn|pin)\b/i;
/** Digits standing in for letters inside a word: n0rthbank, paypa1. */
const LOOKALIKE = /[a-z][01][a-z]|[a-z]{2,}[01]\b|\b[01][a-z]{2,}/i;
const IP_HOST = /^\d{1,3}(?:\.\d{1,3}){3}$/;

function hostOf(url: string): string | null {
	try {
		return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
	} catch {
		return null;
	}
}

/** The registrable part of a host, roughly: the last two labels (mail.bank.example → bank.example). */
function siteOf(host: string): string {
	return host.split('.').slice(-2).join('.');
}

/** `<a href="…">text</a>`. A regex, not DOMParser, because this runs in a worker, which has none. */
const ANCHOR = /<a\b[^>]*?\bhref\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

/** Links in the HTML whose visible text names a different site than the one they open. */
function linkMismatches(html: string): string[] {
	const found: string[] = [];
	for (const [, href = '', inner = ''] of html.matchAll(ANCHOR)) {
		const target = hostOf(href);
		const shown = inner
			.replace(/<[^>]*>/g, '')
			.trim()
			.match(/(?:https?:\/\/)?((?:[\w-]+\.)+[a-z]{2,})\b/i);
		if (!target || !shown?.[1]) continue;
		const shownHost = shown[1].toLowerCase().replace(/^www\./, '');
		if (siteOf(shownHost) !== siteOf(target)) found.push(`${shownHost} → ${target}`);
	}
	return found;
}

function linkHosts(input: PhishingInput): string[] {
	const text = `${input.bodyText} ${input.bodyHtml ?? ''}`;
	const urls = text.match(/https?:\/\/[^\s"'<>)]+/gi) ?? [];
	return urls.map(hostOf).filter((host): host is string => host !== null);
}

/** Runs every check. An empty list means nothing looked like phishing. */
export function checkPhishing(input: PhishingInput): PhishingFinding[] {
	const findings: PhishingFinding[] = [];
	const text = `${input.subject}\n${input.bodyText}`;

	const mismatches = input.bodyHtml ? linkMismatches(input.bodyHtml) : [];
	if (mismatches.length > 0) {
		findings.push({
			signal: 'link-mismatch',
			reason: `A link shows one address but opens another (${mismatches[0]}).`
		});
	}
	if (linkHosts(input).some((host) => IP_HOST.test(host))) {
		findings.push({ signal: 'ip-link', reason: 'A link points to a bare IP address.' });
	}
	const senderDomain = input.fromEmail.split('@')[1]?.toLowerCase() ?? '';
	if (LOOKALIKE.test(senderDomain.split('.')[0] ?? '')) {
		findings.push({
			signal: 'lookalike-domain',
			reason: `The sender's domain (${senderDomain}) swaps letters for numbers.`
		});
	}
	if (CREDENTIALS.test(text)) {
		findings.push({
			signal: 'credential-request',
			reason: 'It asks you to confirm a password or account details.'
		});
	}
	if (URGENT.test(text)) {
		findings.push({ signal: 'urgent-wording', reason: 'It uses urgent, threatening wording.' });
	}
	return findings;
}

/** Phishing when one strong signal fires, or a credential request comes with urgent wording. */
export function isPhishing(findings: readonly PhishingFinding[]): boolean {
	const signals = new Set(findings.map((f) => f.signal));
	if (STRONG_SIGNALS.some((s) => signals.has(s))) return true;
	return signals.has('credential-request') && signals.has('urgent-wording');
}
