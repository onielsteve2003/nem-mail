import { CATEGORIES, type Category, type ThreadSummary } from '@nem/shared';
import type { ReplyIntent } from './models/smart-reply.js';

/** The three prompts the assistant sheet offers (AI-11). */
export const ASSISTANT_PROMPTS = ['summarizeUnread', 'needsReply', 'draftReply'] as const;
export type AssistantPrompt = (typeof ASSISTANT_PROMPTS)[number];

/** One conversation an answer points at; tapping it opens the thread. */
export interface AssistantItem {
	threadId: string;
	title: string;
	detail: string;
}

/** A reply the user can open in compose. */
export interface AssistantDraft {
	threadId: string;
	messageId: string;
	text: string;
}

export interface AssistantAnswer {
	text: string;
	items: AssistantItem[];
	draft: AssistantDraft | null;
	explanation: string;
	source: 'model' | 'heuristic';
}

/** How many conversations an answer lists. */
export const ASSISTANT_ITEMS = 5;
/** Longest one-line detail under an item. */
const DETAIL_MAX = 140;

const TAB_NAMES: Record<Category, string> = {
	primary: 'Primary',
	promotions: 'Promotions',
	social: 'Social',
	updates: 'Updates',
	forums: 'Forums'
};

/** Intents that leave the ball in the user's court, with how the assistant says so. */
export const NEEDS_REPLY: Partial<Record<ReplyIntent, string>> = {
	question: 'Asks you a question',
	request: 'Asks you for something',
	meeting: 'Wants to find a time',
	invitation: 'Invites you',
	approval: 'Waiting on your approval'
};

/** "You have 12 unread conversations: 4 in Primary and 8 in Promotions." */
export function unreadIntro(unread: readonly ThreadSummary[]): string {
	if (unread.length === 0) return "You're all caught up. Nothing unread in your inbox.";
	const counts = CATEGORIES.map((category) => ({
		category,
		count: unread.filter((thread) => (thread.category ?? 'primary') === category).length
	})).filter((c) => c.count > 0);
	const parts = counts.map((c) => `${c.count} in ${TAB_NAMES[c.category]}`);
	const noun = unread.length === 1 ? 'conversation' : 'conversations';
	const where = parts.length > 1 ? `: ${joinAnd(parts)}` : ` in ${TAB_NAMES[counts[0]!.category]}`;
	const top = unread.length > 1 ? ' The ones that look most important:' : '';
	return `You have ${unread.length} unread ${noun}${where}.${top}`;
}

/** "3 conversations look like they need a reply:" */
export function needsReplyIntro(count: number): string {
	if (count === 0) return 'Nothing in your inbox seems to be waiting on you. Nice.';
	return count === 1
		? 'One conversation looks like it needs a reply:'
		: `${count} conversations look like they need a reply:`;
}

/** A short reply grown into a whole message: greeting, the reply, sign-off. */
export function draftText(reply: string, toName: string, selfName: string): string {
	const greeting = toName ? `Hi ${firstName(toName)},` : 'Hi,';
	const signOff = selfName ? `Best,\n${firstName(selfName)}` : 'Best,';
	return `${greeting}\n\n${reply}\n\n${signOff}`;
}

/** First sentence of a text, cut to one line. */
export function oneLine(text: string): string {
	const flat = text.replace(/\s+/g, ' ').trim();
	const sentence = /^.+?[.!?](?=\s|$)/.exec(flat)?.[0] ?? flat;
	return sentence.length > DETAIL_MAX
		? `${sentence.slice(0, DETAIL_MAX - 1).trimEnd()}…`
		: sentence;
}

/** "Ada · Lunch Friday?" */
export function itemTitle(thread: ThreadSummary, selfEmail: string): string {
	const self = selfEmail.toLowerCase();
	const sender =
		thread.participants.findLast((p) => p.email.toLowerCase() !== self) ?? thread.participants[0];
	const name = sender?.name || sender?.email || '';
	return `${name} · ${thread.subject || '(no subject)'}`;
}

function firstName(name: string): string {
	return name.trim().split(/\s+/)[0] ?? name;
}

function joinAnd(parts: string[]): string {
	return parts.length <= 1
		? (parts[0] ?? '')
		: `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`;
}
