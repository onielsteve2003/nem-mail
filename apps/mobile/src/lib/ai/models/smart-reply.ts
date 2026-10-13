import { tokenize, type AIInsight } from '@nem/shared';

/** The message being replied to. */
export interface ReplyInput {
	/** The sender's display name, for a personal touch; empty when unknown. */
	fromName: string;
	fromEmail: string;
	subject: string;
	/** The sender's own words (quotes stripped by the caller or not, either works). */
	text: string;
}

export type ReplyIntent =
	'meeting' | 'invitation' | 'approval' | 'request' | 'question' | 'thanks' | 'congrats' | 'update';

export type SmartReplyVerdict = AIInsight<string[]> & { intent: ReplyIntent | null };

/** Words that signal each intent, with phrases matched on the raw text. */
const SIGNALS: Record<ReplyIntent, { words: string[]; phrases: RegExp[] }> = {
	meeting: {
		words: [
			'meet',
			'meeting',
			'call',
			'schedule',
			'available',
			'availability',
			'calendar',
			'slot',
			'sync'
		],
		phrases: [/\b(does|would) .{0,20}(work for you|suit you)\b/i, /\bfree (on|at|for)\b/i]
	},
	invitation: {
		words: [
			'invite',
			'invited',
			'invitation',
			'party',
			'dinner',
			'lunch',
			'rsvp',
			'celebrate',
			'join'
		],
		phrases: [/\bjoin us\b/i, /\bwould you like to come\b/i]
	},
	approval: {
		words: ['approve', 'approval', 'sign', 'confirm', 'okay', 'greenlight'],
		phrases: [/\bsign[- ]off\b/i, /\bok to (go|proceed|ship)\b/i, /\bgood to go\b/i]
	},
	request: {
		words: ['please', 'send', 'review', 'share', 'need', 'update'],
		phrases: [/\b(can|could|would) you\b/i, /\blet me know\b/i]
	},
	question: { words: [], phrases: [/\b\w+(?: \w+){0,3}\?/] },
	thanks: {
		words: ['thanks', 'thank', 'appreciate', 'grateful'],
		phrases: [/\bthank you\b/i]
	},
	congrats: {
		words: ['congratulations', 'congrats', 'promoted', 'promotion', 'milestone', 'launched'],
		phrases: [/\bwelcome (to|aboard)\b/i]
	},
	update: {
		words: ['fyi', 'heads', 'update', 'shipped', 'done', 'finished', 'attached'],
		phrases: [/\bheads up\b/i, /\bjust (wanted to )?let you know\b/i]
	}
};

/** Earlier intents win ties: a meeting question is a meeting, not just a question. */
const ORDER = Object.keys(SIGNALS) as ReplyIntent[];

/** What each intent's replies offer, for the explanation. */
const OFFERS: Record<ReplyIntent, string> = {
	meeting: 'a meeting request, so the replies accept, ask for another time, or decline',
	invitation: 'an invitation, so the replies accept, maybe, or decline',
	approval: 'a request for approval, so the replies approve, ask a question, or hold',
	request: 'a request, so the replies agree, set a time, or ask for details',
	question: 'a question, so the replies answer yes, no, or not sure yet',
	thanks: 'a thank-you, so the replies acknowledge it',
	congrats: 'good news, so the replies say thanks',
	update: 'an update, so the replies acknowledge it'
};

/** Short replies per intent; `{name}` is the sender's first name. */
const TEMPLATES: Record<ReplyIntent, string[]> = {
	meeting: ['Sounds good, see you then!', 'Could we find another time?', "Sorry, I can't make it."],
	invitation: [
		"I'd love to come, thanks {name}!",
		'Maybe, I’ll let you know soon.',
		"Sorry, I can't make it this time."
	],
	approval: [
		'Approved, go ahead.',
		'I have a couple of questions first.',
		"Let's hold off for now."
	],
	request: [
		'Sure, I’ll take care of it.',
		'I’ll get back to you by tomorrow.',
		'Could you share more details?'
	],
	question: ['Yes, that works.', "No, I don't think so.", 'Let me check and get back to you.'],
	thanks: ["You're welcome, {name}!", 'Happy to help!', 'Anytime!'],
	congrats: [
		'Thank you so much, {name}!',
		'Thanks, really appreciate it!',
		'Thanks! It was a team effort.'
	],
	update: [
		'Thanks for the update, {name}!',
		'Got it, thanks!',
		'Great, thanks for letting me know.'
	]
};

/** When nothing stands out: polite, safe replies. */
const GENERIC = ['Thanks, {name}!', 'Got it, thanks!', 'I’ll get back to you soon.'];

// Mail nobody answers: automated senders and bulk mail.
const NO_REPLY = /no-?reply|do-?not-?reply|notifications?@|mailer-daemon/i;
const BULK = /\bunsubscribe\b/i;

/** The first name to greet, or an empty string (templates then drop the name). */
function firstName(name: string): string {
	const first = name.trim().split(/\s+/)[0] ?? '';
	return /^[\p{L}'-]+$/u.test(first) ? first : '';
}

function fill(template: string, name: string): string {
	return name ? template.replaceAll('{name}', name) : template.replace(/,? \{name\}/g, '');
}

/** Each intent's evidence: matching words and phrases, as found in the message. */
export function detectIntent(input: ReplyInput): {
	intent: ReplyIntent | null;
	evidence: string[];
	share: number;
} {
	const text = `${input.subject}\n${input.text}`;
	const words = new Set(tokenize(text));
	let best: { intent: ReplyIntent | null; evidence: string[] } = { intent: null, evidence: [] };
	let total = 0;
	for (const intent of ORDER) {
		const { words: list, phrases } = SIGNALS[intent];
		const evidence = [
			...list.filter((word) => words.has(word)),
			...phrases.flatMap((phrase) => text.match(phrase)?.[0] ?? [])
		];
		total += evidence.length;
		if (evidence.length > best.evidence.length) best = { intent, evidence };
	}
	return { ...best, share: total > 0 ? best.evidence.length / total : 0 };
}

/**
 * Three short replies for a message (AI-4): intent detection by keyword evidence,
 * then templates for that intent. Null for mail nobody replies to (no-reply, bulk).
 */
export function suggestReplies(input: ReplyInput): SmartReplyVerdict | null {
	if (NO_REPLY.test(input.fromEmail) || BULK.test(input.text)) return null;
	const name = firstName(input.fromName);
	const { intent, evidence, share } = detectIntent(input);
	const replies = (intent ? TEMPLATES[intent] : GENERIC).map((t) => fill(t, name));
	const quoted = [...new Set(evidence.map((e) => e.toLowerCase()))]
		.slice(0, 3)
		.map((e) => `“${e}”`)
		.join(', ');
	return {
		value: replies,
		intent,
		confidence: intent ? Math.round((0.5 + 0.4 * share) * 100) / 100 : 0.4,
		explanation: intent
			? `It reads as ${OFFERS[intent]} (from ${quoted}).`
			: 'Nothing specific stood out, so these are general replies.',
		source: 'heuristic'
	};
}
