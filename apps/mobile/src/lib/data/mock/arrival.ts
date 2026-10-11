import {
	toSummary,
	type Category,
	type Message,
	type Thread,
	type ThreadSummary
} from '@nem/shared';
import { newId, type MockContext } from './context.js';
import { stripOwner, type MockDb, type Owned } from './db.js';
import { deliverDue } from './drafts.js';
import { countsFor } from './mail.js';

/** How often the simulator delivers due mail. */
export const TICK_MS = 1000;
/** Average gap between simulated incoming messages. */
export const ARRIVAL_MEAN_MS = 90_000;

interface Template {
	subject: string;
	body: string;
	category: Category;
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
	}
];

/**
 * Plays the server's part in the demo: sends outbox and scheduled mail when it
 * is due, and now and then drops a new message in the inbox (`mail.new`).
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

	/** One pass: deliver due mail, then maybe an arrival. */
	async tick(): Promise<void> {
		const userId = this.#ctx.userId;
		if (!userId) return;
		const db = await this.#ctx.db();
		const now = this.#ctx.now();
		let changed = (await deliverDue(db, userId, now)) > 0;
		if (now >= this.#nextArrival) {
			this.#nextArrival = now + this.#gap();
			await this.arrive();
			changed = false; // arrive() already sent counts
		}
		if (changed) this.#ctx.emit({ type: 'counts', counts: await countsFor(db, userId, now) });
	}

	/** Delivers one new message to the signed-in account's inbox now. */
	async arrive(): Promise<ThreadSummary | null> {
		const userId = this.#ctx.userId;
		if (!userId) return null;
		const db = await this.#ctx.db();
		const now = this.#ctx.now();
		const thread = await this.#makeThread(db, userId, now);
		if (!thread) return null;
		await db.put('threads', thread);
		const summary = toSummary(stripOwner(thread));
		this.#ctx.emit({ type: 'mail.new', summary });
		this.#ctx.emit({ type: 'counts', counts: await countsFor(db, userId, now) });
		return summary;
	}

	async #makeThread(db: MockDb, userId: string, now: number): Promise<Owned<Thread> | null> {
		const [user, contacts] = await Promise.all([
			db.get('users', userId),
			db.getAllFromIndex('contacts', 'byOwner', userId)
		]);
		if (!user) return null;
		const template = pick(TEMPLATES, this.#random);
		const sender = contacts.length > 0 ? pick(contacts, this.#random) : null;
		const from = sender
			? { email: sender.email, name: sender.name }
			: { email: 'hello@nemmail.example', name: 'Nem Mail' };
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

function pick<T>(items: readonly T[], random: () => number): T {
	return items[Math.floor(random() * items.length)] as T;
}
