import {
	isBinned,
	type Address,
	parseQuery,
	sortKey,
	toSummary,
	type Label,
	type SearchClause,
	type Thread,
	type ThreadSummary
} from '@nem/shared';

/** BM25 term-frequency saturation and length normalization (the usual defaults). */
const K1 = 1.2;
const B = 0.75;

/** A hit in the subject or a sender's name counts more than one in the body. */
const FIELD_WEIGHTS = { subject: 3, from: 2, to: 1, body: 1 } as const;
type Field = keyof typeof FIELD_WEIGHTS;

/** Lowercase, accents folded, split on anything that is not a letter or digit. */
export function tokenize(text: string): string[] {
	return text
		.normalize('NFKD')
		.replace(/\p{M}/gu, '')
		.toLowerCase()
		.split(/[^\p{L}\p{N}]+/u)
		.filter(Boolean);
}

/** Tokens joined by single spaces, so phrases match across punctuation and line breaks. */
function normalized(text: string): string {
	return ` ${tokenize(text).join(' ')} `;
}

interface IndexedThread {
	thread: Thread;
	summary: ThreadSummary;
	/** Weighted token count, the BM25 document length. */
	length: number;
	/** Every field as normalized text, for phrase and negation checks. */
	text: string;
	from: string;
	to: string;
	subject: string;
}

/** Inverted index over one account's threads: term → (thread id → weighted frequency). */
export interface SearchIndex {
	docs: Map<string, IndexedThread>;
	postings: Map<string, Map<string, number>>;
	averageLength: number;
}

function addressText(addresses: Address[]): string {
	return addresses.map((a) => `${a.name ?? ''} ${a.email}`).join(' ');
}

/** Builds the index; Spam and Trash are left out, as in Gmail's default search. */
export function buildIndex(threads: Thread[]): SearchIndex {
	const docs = new Map<string, IndexedThread>();
	const postings = new Map<string, Map<string, number>>();
	let total = 0;

	for (const thread of threads) {
		if (isBinned(thread)) continue;
		const fields: Record<Field, string> = {
			subject: thread.subject,
			from: addressText(thread.messages.map((m) => m.from)),
			to: addressText(thread.messages.flatMap((m) => [...m.to, ...m.cc, ...m.bcc])),
			body: thread.messages.map((m) => m.bodyText).join('\n')
		};
		let length = 0;
		for (const field of Object.keys(fields) as Field[]) {
			const weight = FIELD_WEIGHTS[field];
			for (const term of tokenize(fields[field])) {
				let posting = postings.get(term);
				if (!posting) postings.set(term, (posting = new Map()));
				posting.set(thread.id, (posting.get(thread.id) ?? 0) + weight);
				length += weight;
			}
		}
		total += length;
		docs.set(thread.id, {
			thread,
			summary: toSummary(thread),
			length,
			text: normalized(Object.values(fields).join(' ')),
			from: fields.from.toLowerCase(),
			to: fields.to.toLowerCase(),
			subject: thread.subject.toLowerCase()
		});
	}
	return { docs, postings, averageLength: docs.size ? total / docs.size : 0 };
}

/** Start of a local calendar day from YYYY-MM-DD. */
function dayStart(date: string): number {
	const [y, m, d] = date.split('-').map(Number) as [number, number, number];
	return new Date(y, m - 1, d).getTime();
}

/** Lowercase label names a thread carries, by name and by "parent/child" path. */
function labelNames(labelIds: string[], labels: Label[]): string[] {
	const byId = new Map(labels.map((l) => [l.id, l]));
	return labelIds.flatMap((id) => {
		const label = byId.get(id);
		if (!label) return [];
		const name = label.name.toLowerCase();
		const parent = label.parentId ? byId.get(label.parentId) : undefined;
		return parent ? [name, `${parent.name.toLowerCase()}/${name}`] : [name];
	});
}

/** Whether the thread passes one clause, before negation. */
function passes(doc: IndexedThread, clause: SearchClause, labels: Label[]): boolean {
	const { summary, thread } = doc;
	switch (clause.kind) {
		case 'text':
			return doc.text.includes(normalized(clause.value));
		case 'from':
			return doc.from.includes(clause.value);
		case 'to':
			return doc.to.includes(clause.value);
		case 'subject':
			return doc.subject.includes(clause.value);
		case 'label': {
			const wanted = clause.value.replace(/-/g, ' ');
			return labelNames(summary.labelIds, labels).some((n) => n === clause.value || n === wanted);
		}
		case 'has':
			return thread.messages.some((m) => m.attachments.length > 0);
		case 'is':
			if (clause.value === 'starred') return summary.isStarred;
			return clause.value === 'unread' ? summary.isUnread : !summary.isUnread;
		case 'before':
			return thread.messages.some((m) => Date.parse(m.sentAt) < dayStart(clause.value));
		case 'after':
			return thread.messages.some((m) => Date.parse(m.sentAt) >= dayStart(clause.value));
	}
}

/** Simplified BM25 over the query's positive words, summed per thread. */
function score(index: SearchIndex, doc: IndexedThread, terms: string[]): number {
	const n = index.docs.size;
	let total = 0;
	for (const term of terms) {
		const posting = index.postings.get(term);
		const tf = posting?.get(doc.thread.id) ?? 0;
		if (!posting || tf === 0) continue;
		const idf = Math.log(1 + (n - posting.size + 0.5) / (posting.size + 0.5));
		const norm = 1 - B + (B * doc.length) / (index.averageLength || 1);
		total += (idf * tf * (K1 + 1)) / (tf + K1 * norm);
	}
	return total;
}

export interface SearchHit {
	summary: ThreadSummary;
	score: number;
}

/**
 * Runs a query: every clause must pass (negated ones must not), then hits are
 * ranked by BM25 score, newest first among equal scores (operator-only queries).
 */
export function searchIndex(index: SearchIndex, query: string, labels: Label[]): SearchHit[] {
	const { clauses } = parseQuery(query);
	if (clauses.length === 0) return [];
	const terms = clauses.flatMap((c) => (c.kind === 'text' && !c.negated ? tokenize(c.value) : []));
	const hits: SearchHit[] = [];
	for (const doc of index.docs.values()) {
		if (!clauses.every((c) => passes(doc, c, labels) !== c.negated)) continue;
		hits.push({ summary: doc.summary, score: score(index, doc, terms) });
	}
	return hits.sort(
		(a, b) => b.score - a.score || (sortKey(a.summary) < sortKey(b.summary) ? 1 : -1)
	);
}

/** Descending string key for keyset pagination of ranked hits: score, then date and id. */
export function hitKey(hit: SearchHit): string {
	return `${hit.score.toFixed(6).padStart(16, '0')}|${sortKey(hit.summary)}`;
}
