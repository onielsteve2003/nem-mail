import type { Address } from '../schemas/common';
import type { Draft } from '../schemas/draft';
import type { Label } from '../schemas/label';
import type { Attachment, Message, Thread } from '../schemas/mail';
import type { Category, StoredMailbox } from '../schemas/mailbox';
import { DEFAULT_SETTINGS, type Settings } from '../schemas/settings';
import type { Contact, User } from '../schemas/user';
import {
	ATTACHMENTS,
	BULLETINS,
	CONTACT_DOMAINS,
	CONVERSATIONS,
	FIRST_NAMES,
	LABEL_DEFS,
	LAST_NAMES,
	VOCAB,
	type BulletinDef,
	type ConversationDef,
	type VocabKey
} from './corpus';
import { createRng, type Rng } from './prng';

export const DEFAULT_SEED = 'nem-mail-demo-2';

export interface SeedOptions {
	seed?: string;
	/** Every timestamp is relative to this, so the demo always looks fresh. */
	now?: Date;
}

/** Everything one demo account owns. Threads carry this account's flags (read, starred...). */
export interface SeedAccount {
	user: User;
	labels: Label[];
	contacts: Contact[];
	threads: Thread[];
	drafts: Draft[];
	settings: Settings;
}

export interface SeedData {
	seed: string;
	generatedAt: string;
	accounts: SeedAccount[];
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const HISTORY_DAYS = 120;
const CONTACT_COUNT = 40;

type ThreadKind = Category | 'spam';

interface AccountPlan {
	id: string;
	name: string;
	email: string;
	threadCount: number;
	/** Relative weights of thread kinds. */
	mix: Partial<Record<ThreadKind, number>>;
	/** Label keys this account uses; others are dropped from templates. */
	labelKeys: string[];
	extras: boolean;
}

/** The seeded demo accounts (FR-1.1, FR-1.3); "Try the demo" signs in as the first. */
export const DEMO_EMAIL = 'alex@nemmail.example';
export const DEMO_WORK_EMAIL = 'alex.work@nemmail.example';
/** The mock ignores the password, but the sign-in schema still asks for one. */
export const DEMO_PASSWORD = 'demo-account';

const PLANS: readonly AccountPlan[] = [
	{
		id: 'u1',
		name: 'Alex Rivera',
		email: DEMO_EMAIL,
		threadCount: 360,
		mix: { primary: 34, promotions: 18, social: 13, updates: 18, forums: 7, spam: 10 },
		labelKeys: LABEL_DEFS.map((def) => def.key),
		extras: true
	},
	{
		id: 'u2',
		name: 'Alex Rivera',
		email: DEMO_WORK_EMAIL,
		threadCount: 40,
		mix: { primary: 60, updates: 25, forums: 15 },
		labelKeys: ['work', 'projects'],
		extras: false
	}
];

/**
 * Builds the demo data set. The same seed and `now` always give identical output,
 * so the mock backend (IndexedDB) and the Phase 2 database seed match.
 */
export function generateSeed(options: SeedOptions = {}): SeedData {
	const seed = options.seed ?? DEFAULT_SEED;
	const now = (options.now ?? new Date()).getTime();
	const rng = createRng(seed);
	const people = makePeople(rng);
	return {
		seed,
		generatedAt: new Date(now).toISOString(),
		accounts: PLANS.map((plan) => makeAccount(rng, plan, people, now))
	};
}

function makePeople(rng: Rng): Address[] {
	const firsts = rng.sample(FIRST_NAMES, FIRST_NAMES.length);
	const lasts = rng.sample(LAST_NAMES, LAST_NAMES.length);
	return Array.from({ length: CONTACT_COUNT }, (_, i) => {
		const first = firsts[i % firsts.length] as string;
		const last = lasts[(i * 7) % lasts.length] as string;
		const domain = rng.pick(CONTACT_DOMAINS);
		return { name: `${first} ${last}`, email: `${first}.${last}@${domain}`.toLowerCase() };
	});
}

function makeAccount(rng: Rng, plan: AccountPlan, people: Address[], now: number): SeedAccount {
	const me: Address = { name: plan.name, email: plan.email };
	const user: User = {
		id: plan.id,
		email: plan.email,
		name: plan.name,
		avatarSeed: plan.email,
		createdAt: iso(now - 400 * DAY)
	};
	const labels = makeLabels(plan);
	const labelIds = new Map(labels.map((label, i) => [plan.labelKeys[i] as string, label.id]));
	const ctx: AccountCtx = { rng, plan, me, people, now, labelIds };

	const threads: Thread[] = [];
	for (let i = 0; i < plan.threadCount; i++) {
		// Squared spread: most mail is recent, a long tail reaches back HISTORY_DAYS.
		const age = (i / plan.threadCount) ** 2 * HISTORY_DAYS * DAY + rng.int(5, 90) * 60_000;
		const kind = pickWeighted(rng, plan.mix);
		const id = `${plan.id}-t${i + 1}`;
		threads.push(
			kind === 'primary'
				? conversationThread(ctx, id, now - age)
				: bulletinThread(ctx, id, now - age, kind)
		);
	}
	let drafts: Draft[] = [];
	if (plan.extras) {
		applyExtras(ctx, threads);
		threads.push(...scheduledThreads(ctx));
		drafts = makeDrafts(ctx, threads);
	}
	threads.sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
	return {
		user,
		labels,
		contacts: makeContacts(plan.email, threads),
		threads,
		drafts,
		settings: structuredClone(DEFAULT_SETTINGS)
	};
}

interface AccountCtx {
	rng: Rng;
	plan: AccountPlan;
	me: Address;
	people: Address[];
	now: number;
	labelIds: Map<string, string>;
}

function makeLabels(plan: AccountPlan): Label[] {
	const ids = new Map(plan.labelKeys.map((key, i) => [key, `${plan.id}-l${i + 1}`]));
	return plan.labelKeys.map((key) => {
		const def = LABEL_DEFS.find((d) => d.key === key);
		if (!def) throw new Error(`Unknown label key ${key}`);
		return {
			id: ids.get(key) as string,
			name: def.name,
			color: def.color,
			parentId: def.parent ? (ids.get(def.parent) ?? null) : null
		};
	});
}

function conversationThread(ctx: AccountCtx, id: string, lastAt: number): Thread {
	const { rng, me, now } = ctx;
	const def: ConversationDef = rng.pick(CONVERSATIONS);
	const other = rng.pick(ctx.people);
	// Some threads copy in one or two more people, so the demo has mail where Reply all applies.
	const cc = rng.chance(0.3)
		? [...new Set([rng.pick(ctx.people), rng.pick(ctx.people)])].filter((p) => p !== other)
		: [];
	const fill = filler(rng, { from: firstName(other) });
	const count = rng.pick([1, 1, 2, 2, 2, 3, 3, 4]);
	const meFirst = rng.chance(0.3);
	const subject = fill(def.subject);
	const unread = lastAt > now - 3 * DAY ? rng.chance(0.65) : rng.chance(0.08);

	const messages: Message[] = [];
	for (let j = 0; j < count; j++) {
		const fromMe = (j % 2 === 0) === meFirst;
		const from = fromMe ? me : other;
		const to = fromMe ? other : me;
		const sentAt = lastAt - (count - 1 - j) * rng.int(1, 20) * HOUR;
		const paragraphs =
			j === 0
				? def.opener.map((line) => fill(line, { to: firstName(to) }))
				: [`Hi ${firstName(to)},`, fill(def.replies[(j - 1) % def.replies.length] as string)];
		const messageId = `${id}m${j + 1}`;
		const attachments =
			j === 0 && def.attachment && rng.chance(0.6)
				? [makeAttachment(rng, `${messageId}a1`, def.attachment, fill)]
				: [];
		messages.push(
			makeMessage({
				id: messageId,
				threadId: id,
				from,
				to: [to],
				cc,
				subject: j === 0 ? subject : `Re: ${subject}`,
				paragraphs: [...paragraphs, firstName(from)],
				html: rng.chance(0.3),
				sentAt,
				inReplyTo: j === 0 ? null : `${id}m${j}`,
				attachments,
				isRead: fromMe || !unread || j < count - 1
			})
		);
	}

	const received = messages.some((m) => m.from.email !== me.email);
	const sent = messages.some((m) => m.from.email === me.email);
	const archived = lastAt < now - 14 * DAY && rng.chance(0.3);
	const mailboxes: StoredMailbox[] = [];
	if (received && !archived) mailboxes.push('inbox');
	if (sent) mailboxes.push('sent');

	return makeThread(ctx, id, messages, {
		mailboxes,
		category: received ? 'primary' : null,
		labelKeys: def.labels && rng.chance(0.7) ? def.labels : [],
		isStarred: rng.chance(0.12),
		isImportant: rng.chance(0.35)
	});
}

function bulletinThread(ctx: AccountCtx, id: string, lastAt: number, kind: ThreadKind): Thread {
	const { rng, me, now } = ctx;
	const def: BulletinDef = rng.pick(BULLETINS.filter((b) => b.category === kind));
	const fill = filler(rng, { from: firstName(rng.pick(ctx.people)) });
	const messageId = `${id}m1`;
	const unreadChance = kind === 'spam' || kind === 'promotions' ? 0.7 : 0.4;
	const recent = lastAt > now - 5 * DAY;
	const message = makeMessage({
		id: messageId,
		threadId: id,
		from: { name: def.brand, email: def.address },
		to: [me],
		subject: fill(def.subject),
		paragraphs: def.body.map((line) => fill(line)),
		html: true,
		cta: def.cta,
		sentAt: lastAt,
		inReplyTo: null,
		attachments: def.attachment
			? [makeAttachment(rng, `${messageId}a1`, def.attachment, fill)]
			: [],
		isRead: !(recent ? rng.chance(unreadChance) : rng.chance(0.05))
	});
	const archived = kind === 'updates' && lastAt < now - 30 * DAY && rng.chance(0.4);
	return makeThread(ctx, id, [message], {
		mailboxes: kind === 'spam' ? ['spam'] : archived ? [] : ['inbox'],
		category: kind === 'spam' ? null : kind,
		labelKeys: def.labels ?? [],
		isStarred: kind === 'updates' && rng.chance(0.05),
		isImportant: kind === 'updates' && rng.chance(0.2)
	});
}

interface ThreadFlags {
	mailboxes: StoredMailbox[];
	category: Category | null;
	labelKeys: readonly string[];
	isStarred: boolean;
	isImportant: boolean;
}

function makeThread(ctx: AccountCtx, id: string, messages: Message[], flags: ThreadFlags): Thread {
	const last = messages[messages.length - 1] as Message;
	const participants: Address[] = [];
	for (const m of messages) {
		if (!participants.some((p) => p.email === m.from.email)) participants.push(m.from);
	}
	return {
		id,
		subject: (messages[0] as Message).subject,
		snippet: last.snippet,
		participants,
		messageCount: messages.length,
		lastMessageAt: last.sentAt,
		mailboxes: flags.mailboxes,
		category: flags.category,
		labelIds: flags.labelKeys.flatMap((key) => ctx.labelIds.get(key) ?? []),
		isUnread: messages.some((m) => !m.isRead),
		isStarred: flags.isStarred,
		isImportant: flags.isImportant,
		isMuted: false,
		snoozedUntil: null,
		attachments: messages.flatMap((m) =>
			m.attachments.map(({ filename, mime }) => ({ filename, mime }))
		),
		messages
	};
}

interface MessageInput {
	id: string;
	threadId: string;
	from: Address;
	to: Address[];
	cc?: Address[];
	subject: string;
	paragraphs: string[];
	html: boolean;
	cta?: string | undefined;
	sentAt: number;
	inReplyTo: string | null;
	attachments: Attachment[];
	isRead: boolean;
}

function makeMessage(input: MessageInput): Message {
	const bodyText = input.paragraphs.join('\n\n') + (input.cta ? `\n\n${input.cta}` : '');
	const bodyHtml = input.html ? toHtml(input.paragraphs, input.from.email, input.cta) : null;
	return {
		id: input.id,
		threadId: input.threadId,
		from: input.from,
		to: input.to,
		cc: input.cc ?? [],
		bcc: [],
		subject: input.subject,
		bodyHtml,
		bodyText,
		snippet: bodyText.replace(/\s+/g, ' ').slice(0, 140),
		sentAt: iso(input.sentAt),
		sendAt: null,
		status: 'sent',
		inReplyTo: input.inReplyTo,
		attachments: input.attachments,
		isRead: input.isRead
	};
}

/** Simple newsletter-style HTML. Real mail is untrusted; the reader sanitizes it (FR-4.3). */
function toHtml(paragraphs: string[], email: string, cta?: string): string {
	const body = paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('');
	const site = `https://${email.split('@')[1] ?? 'example.com'}`;
	const button = cta
		? `<p><a href="${site}" style="display:inline-block;padding:12px 20px;border-radius:999px;background:#7050f5;color:#fff;text-decoration:none">${escapeHtml(cta)}</a></p>`
		: '';
	return `<div style="font-family:sans-serif;line-height:1.5">${body}${button}</div>`;
}

function makeAttachment(
	rng: Rng,
	id: string,
	key: string,
	fill: (text: string) => string
): Attachment {
	const def = ATTACHMENTS[key];
	if (!def) throw new Error(`Unknown attachment ${key}`);
	const filename = fill(def.filename).replace(/\s+/g, '-').toLowerCase();
	return { id, filename, mime: def.mime, size: rng.int(20, 4000) * 1024 };
}

/** Trash, snooze and mute a few threads, so every mailbox has something in it. */
function applyExtras(ctx: AccountCtx, threads: Thread[]): void {
	const { rng, now } = ctx;
	const old = threads.filter(
		(t) => t.lastMessageAt < iso(now - 10 * DAY) && t.mailboxes[0] === 'inbox'
	);
	for (const t of rng.sample(old, 8)) t.mailboxes = ['trash'];

	const inbox = threads.filter((t) => t.mailboxes.includes('inbox'));
	for (const t of rng.sample(inbox, 4)) t.snoozedUntil = iso(now + rng.int(2, 72) * HOUR);

	const long = threads.filter((t) => t.messageCount >= 3 && t.mailboxes.includes('inbox'));
	for (const t of rng.sample(long, 2)) {
		t.isMuted = true;
		t.mailboxes = t.mailboxes.filter((m) => m !== 'inbox');
	}
}

function scheduledThreads(ctx: AccountCtx): Thread[] {
	const { rng, me, now, plan } = ctx;
	return [1, 2].map((n) => {
		const id = `${plan.id}-s${n}`;
		const to = rng.pick(ctx.people);
		const sendAt = now + rng.int(12, 96) * HOUR;
		const message = makeMessage({
			id: `${id}m1`,
			threadId: id,
			from: me,
			to: [to],
			subject: n === 1 ? 'Happy birthday!' : 'Following up on our chat',
			paragraphs:
				n === 1
					? [`Hi ${firstName(to)},`, 'Happy birthday! Hope the day is wonderful.', firstName(me)]
					: [
							`Hi ${firstName(to)},`,
							'Just following up on what we discussed. Any update?',
							firstName(me)
						],
			html: false,
			sentAt: sendAt,
			inReplyTo: null,
			attachments: [],
			isRead: true
		});
		message.status = 'scheduled';
		message.sendAt = message.sentAt;
		return makeThread(ctx, id, [message], {
			mailboxes: ['scheduled'],
			category: null,
			labelKeys: [],
			isStarred: false,
			isImportant: false
		});
	});
}

function makeDrafts(ctx: AccountCtx, threads: Thread[]): Draft[] {
	const { rng, now, plan } = ctx;
	const updatedAt = (hoursAgo: number) => iso(now - hoursAgo * HOUR);
	const base = { cc: [], bcc: [], attachments: [], scheduledAt: null };
	const replyTo = threads.find((t) => t.category === 'primary' && t.mailboxes.includes('inbox'));
	const forward = threads.find((t) => t.category === 'updates' && t.attachments.length > 0);
	const drafts: Draft[] = [
		{
			...base,
			id: `${plan.id}-d1`,
			mode: 'new',
			threadId: null,
			inReplyTo: null,
			to: [rng.pick(ctx.people)],
			subject: 'Ideas for the team offsite',
			bodyHtml:
				'<p>A few ideas so far:</p><ul><li>Hike in the morning</li><li>Workshop after lunch</li></ul>',
			updatedAt: updatedAt(2)
		}
	];
	for (const [thread, mode, n] of [
		[replyTo, 'reply', 2],
		[forward, 'forward', 3]
	] as const) {
		if (!thread) continue;
		const last = thread.messages[thread.messages.length - 1] as Message;
		drafts.push({
			...base,
			id: `${plan.id}-d${n}`,
			mode,
			threadId: thread.id,
			inReplyTo: last.id,
			to: mode === 'reply' ? [last.from] : [],
			subject: `${mode === 'reply' ? 'Re' : 'Fwd'}: ${thread.subject}`,
			bodyHtml: mode === 'reply' ? '<p>Sounds good, one thought:</p>' : '',
			updatedAt: updatedAt(n * 5)
		});
	}
	return drafts;
}

/** Contacts are everyone this account exchanged mail with, ranked by how often. */
function makeContacts(ownEmail: string, threads: Thread[]): Contact[] {
	const byEmail = new Map<string, Contact>();
	for (const thread of threads) {
		for (const m of thread.messages) {
			for (const address of [m.from, ...m.to]) {
				if (address.email === ownEmail || !isPerson(address.email)) continue;
				const contact = byEmail.get(address.email) ?? {
					id: '',
					email: address.email,
					name: address.name,
					lastContactedAt: null,
					frequency: 0
				};
				contact.frequency += 1;
				if (
					m.status === 'sent' &&
					(!contact.lastContactedAt || m.sentAt > contact.lastContactedAt)
				) {
					contact.lastContactedAt = m.sentAt;
				}
				byEmail.set(address.email, contact);
			}
		}
	}
	return [...byEmail.values()]
		.sort((a, b) => b.frequency - a.frequency || a.email.localeCompare(b.email))
		.map((contact, i) => ({ ...contact, id: `${ownEmail.split('@')[0]}-c${i + 1}` }));
}

function isPerson(email: string): boolean {
	return CONTACT_DOMAINS.some((domain) => email.endsWith(`@${domain}`));
}

/**
 * Returns a template filler for one thread. Each placeholder gets one random value
 * per thread, so a subject and its body mention the same place or project.
 */
function filler(rng: Rng, fixed: Record<string, string>) {
	const values = new Map(Object.entries(fixed));
	const generated: Record<string, () => string> = {
		code: () => String(rng.int(100000, 999999)),
		number: () => String(rng.int(1000, 99999)),
		tracking: () => `PX${rng.int(10000, 99999)}${rng.int(10000, 99999)}`,
		amount: () => `${rng.int(5, 240)}.${String(rng.int(0, 99)).padStart(2, '0')}`
	};
	return (text: string, extra: Record<string, string> = {}) =>
		text.replace(/\{(\w+)\}/g, (match, key: string) => {
			if (extra[key] !== undefined) return extra[key];
			let value = values.get(key);
			if (value === undefined) {
				if (key in VOCAB) value = rng.pick(VOCAB[key as VocabKey]);
				else if (generated[key]) value = generated[key]();
				else return match;
				values.set(key, value);
			}
			return value;
		});
}

function pickWeighted<T extends string>(rng: Rng, weights: Partial<Record<T, number>>): T {
	const entries = Object.entries(weights) as [T, number][];
	let roll = rng.next() * entries.reduce((sum, [, w]) => sum + w, 0);
	for (const [key, weight] of entries) {
		roll -= weight;
		if (roll < 0) return key;
	}
	return (entries[entries.length - 1] as [T, number])[0];
}

function firstName(address: Address): string {
	return (address.name ?? address.email).split(' ')[0] as string;
}

function escapeHtml(text: string): string {
	return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function iso(ms: number): string {
	return new Date(ms).toISOString();
}
