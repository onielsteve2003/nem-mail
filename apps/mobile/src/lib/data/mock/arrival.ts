import {
	isBinned,
	receiveMessage,
	toSummary,
	type Category,
	type Message,
	type Thread,
	type ThreadSummary,
	type User
} from '@nem/shared';
import { newId, type MockContext } from './context.js';
import { stripOwner, type MockDb, type Owned } from './db.js';
import { deliverDue } from './drafts.js';
import { countsFor, wakeDue } from './mail.js';

/** How often the simulator delivers due mail. */
export const TICK_MS = 1000;
/** Average gap between simulated incoming messages. */
export const ARRIVAL_MEAN_MS = 90_000;
/** About this share of arrivals are replies to a recent conversation rather than new threads. */
const REPLY_SHARE = 0.3;
/** Replies go to one of this many most recent conversations from other people. */
const REPLY_POOL = 10;

/** Sender used when there is no contact to write from. */
const NEM_SENDER = { email: 'hello@nemmail.example', name: 'Nem Mail' };

const REPLIES: readonly string[] = [
	'Thanks, that works for me.',
	'Following up on this. Any update?',
	'Sounds good. See you then!',
	'One more thing: can you send the latest version?'
];

interface Template {
	subject: string;
	body: string;
	category: Category;
	/** A fixed sender (e.g. spam); otherwise a random contact writes. */
	from?: { email: string; name: string };
}

/** Short, neutral messages for live arrivals; the seed corpus covers history. */
const TEMPLATES: readonly Template[] = [
	{
		subject: 'Quick question about tomorrow',
		body: 'Hi! Are we still on for tomorrow morning? Happy to move it if needed.',
		category: 'primary'
	},
	{
		subject: 'Notes from today',
		body: 'Sharing my notes from today. Let me know if I missed anything important.',
		category: 'primary'
	},
	{
		subject: 'Your weekly summary is ready',
		body: 'Here is what happened in your workspace this week: 4 new comments and 2 updates.',
		category: 'updates'
	},
	{
		subject: 'Lunch on Friday?',
		body: 'A few of us are getting lunch on Friday around noon. Want to join?',
		category: 'social'
	},
	{
		// Junk for the on-device spam filter (AI-2) to catch; the mock server does not flag it.
		subject: 'CONGRATULATIONS! You have won a gift card',
		body: 'You were selected as our lucky winner! Claim your $500 prize now, offer expires in 24 hours.',
		category: 'promotions',
		from: { email: 'winner@prize-center.example', name: 'Prize Center' }
	}
];

/**
 * Plays the server's part in the demo: sends outbox and scheduled mail when it
 * is due, wakes snoozed threads, and now and then drops a new message in the inbox (`mail.new`).
 */
export class MockMailSimulator {
	readonly #ctx: MockContext;
	readonly #random: () => number;
	#timer: ReturnType<typeof setInterval> | undefined;
	#nextArrival = 0;

	constructor(ctx: MockContext, random: () => number = Math.random) {
		this.#ctx = ctx;
		this.#random = random;
	}

	/** Starts ticking. `arrivals: false` only delivers sent mail. */
	start({ arrivals = true }: { arrivals?: boolean } = {}): void {
		this.stop();
		this.#nextArrival = arrivals ? this.#ctx.now() + this.#gap() : Infinity;
		this.#timer = setInterval(() => {
			this.tick().catch((error: unknown) => console.error('Mail simulator tick failed', error));
		}, TICK_MS);
	}

	stop(): void {
		clearInterval(this.#timer);
		this.#timer = undefined;
	}

	/** One pass: deliver due mail, wake due snoozes, then maybe an arrival. */
	async tick(): Promise<void> {
		const userId = this.#ctx.userId;
		if (!userId) return;
		const db = await this.#ctx.db();
		const now = this.#ctx.now();
		let changed = (await deliverDue(db, userId, now)) > 0;
		const woke = await wakeDue(db, userId, now);
		if (woke.length > 0) {
			this.#ctx.emit({ type: 'snooze.woke', summaries: woke });
			changed = true;
		}
		if (now >= this.#nextArrival) {
			this.#nextArrival = now + this.#gap();
			await this.arrive();
			changed = false; // arrive() already sent counts
		}
		if (changed) this.#ctx.emit({ type: 'counts', counts: await countsFor(db, userId, now) });
	}

	/** Delivers one new message now: a new thread, or now and then a reply to a recent one. */
	async arrive(): Promise<ThreadSummary | null> {
		const userId = this.#ctx.userId;
		if (!userId) return null;
		const db = await this.#ctx.db();
		const now = this.#ctx.now();
		const isReply = this.#random() > 1 - REPLY_SHARE;
		const thread = isReply
			? await this.#replyToRecent(db, userId, now)
			: await this.#makeThread(db, userId, now);
		if (!thread) return null;
		await db.put('threads', thread);
		const summary = toSummary(stripOwner(thread));
		this.#ctx.emit({ type: 'mail.new', summary });
		this.#ctx.emit({ type: 'counts', counts: await countsFor(db, userId, now) });
		return summary;
	}

	/**
	 * Someone replies in one of the account's threads (or a recent one when no
	 * id is given). A muted thread takes the reply without returning to the inbox.
	 */
	async reply(threadId?: string): Promise<ThreadSummary | null> {
		const userId = this.#ctx.userId;
		if (!userId) return null;
		const db = await this.#ctx.db();
		const now = this.#ctx.now();
		const [user, stored] = await Promise.all([
			db.get('users', userId),
			threadId ? db.get('threads', threadId) : undefined
		]);
		const thread =
			user && stored?.ownerId === userId
				? withReply(stored, user, now, this.#random)
				: await this.#replyToRecent(db, userId, now);
		if (!thread) return null;
		await db.put('threads', thread);
		const summary = toSummary(stripOwner(thread));
		this.#ctx.emit({ type: 'mail.new', summary });
		this.#ctx.emit({ type: 'counts', counts: await countsFor(db, userId, now) });
		return summary;
	}

	async #replyToRecent(db: MockDb, userId: string, now: number): Promise<Owned<Thread> | null> {
		const user = await db.get('users', userId);
		if (!user) return null;
		const recent = (await db.getAllFromIndex('threads', 'byOwner', userId))
			.filter((t) => !isBinned(t))
			.filter((t) => t.messages.some((m) => m.from.email !== user.email))
			.sort((a, b) => (a.lastMessageAt < b.lastMessageAt ? 1 : -1))
			.slice(0, REPLY_POOL);
		const thread = recent.length > 0 ? pick(recent, this.#random) : null;
		return thread && withReply(thread, user, now, this.#random);
	}

	async #makeThread(db: MockDb, userId: string, now: number): Promise<Owned<Thread> | null> {
		const [user, contacts] = await Promise.all([
			db.get('users', userId),
			db.getAllFromIndex('contacts', 'byOwner', userId)
		]);
		if (!user) return null;
		const template = pick(TEMPLATES, this.#random);
		const sender = contacts.length > 0 ? pick(contacts, this.#random) : null;
		const from =
			template.from ?? (sender ? { email: sender.email, name: sender.name } : NEM_SENDER);
		const id = newId(`${userId}-n`);
		const sentAt = new Date(now).toISOString();
		const message: Message = {
			id: `${id}m1`,
			threadId: id,
			from,
			to: [{ email: user.email, name: user.name }],
			cc: [],
			bcc: [],
			subject: template.subject,
			bodyHtml: null,
			bodyText: template.body,
			snippet: template.body.slice(0, 140),
			sentAt,
			sendAt: null,
			status: 'sent',
			inReplyTo: null,
			attachments: [],
			isRead: false
		};
		return {
			id,
			subject: template.subject,
			snippet: message.snippet,
			participants: [from],
			messageCount: 1,
			lastMessageAt: sentAt,
			mailboxes: ['inbox'],
			category: template.category,
			labelIds: [],
			isUnread: true,
			isStarred: false,
			isImportant: false,
			isMuted: false,
			snoozedUntil: null,
			attachments: [],
			messages: [message],
			ownerId: userId
		};
	}

	/** Exponential gaps make arrivals feel random rather than clockwork. */
	#gap(): number {
		return -Math.log(1 - this.#random()) * ARRIVAL_MEAN_MS;
	}
}

/** The thread with a reply to the owner from the last other person who wrote in it. */
function withReply(
	thread: Owned<Thread>,
	user: Pick<User, 'email' | 'name'>,
	now: number,
	random: () => number
): Owned<Thread> {
	const last = thread.messages.at(-1);
	const isOther = (email: string) => email.toLowerCase() !== user.email.toLowerCase();
	const from =
		[...thread.messages].reverse().find((m) => isOther(m.from.email))?.from ??
		thread.participants.find((p) => isOther(p.email)) ??
		NEM_SENDER;
	const body = pick(REPLIES, random);
	const sentAt = new Date(now).toISOString();
	const message: Message = {
		id: `${thread.id}r${thread.messages.length + 1}-${now}`,
		threadId: thread.id,
		from,
		to: [{ email: user.email, name: user.name }],
		cc: [],
		bcc: [],
		subject: thread.subject.startsWith('Re:') ? thread.subject : `Re: ${thread.subject}`,
		bodyHtml: null,
		bodyText: body,
		snippet: body,
		sentAt,
		sendAt: null,
		status: 'sent',
		inReplyTo: last?.id ?? null,
		attachments: [],
		isRead: false
	};
	return { ...receiveMessage(thread, message), ownerId: thread.ownerId };
}

function pick<T>(items: readonly T[], random: () => number): T {
	return items[Math.floor(random() * items.length)] as T;
}
