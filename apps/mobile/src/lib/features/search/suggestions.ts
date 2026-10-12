import { formatQuery, type ThreadSummary } from '@nem/shared';

/** Subjects from threads already loaded that contain `text`, ignoring case, without repeats. */
export function subjectSuggestions(threads: ThreadSummary[], text: string, limit = 4): string[] {
	const q = text.trim().toLowerCase();
	if (!q) return [];
	const seen = new Set<string>();
	const found: string[] = [];
	for (const thread of threads) {
		const subject = thread.subject.trim();
		const key = subject.toLowerCase();
		if (!subject || seen.has(key) || !key.includes(q)) continue;
		seen.add(key);
		found.push(subject);
		if (found.length === limit) break;
	}
	return found;
}

/** The query a tapped contact suggestion runs. */
export function fromQuery(email: string): string {
	return formatQuery({ clauses: [{ kind: 'from', value: email, negated: false }] });
}

/** The query a tapped subject suggestion runs. */
export function subjectQuery(subject: string): string {
	return formatQuery({ clauses: [{ kind: 'subject', value: subject, negated: false }] });
}
