import type { AIInsight, ThreadSummary } from '@nem/shared';

/** How the inbox is ordered: newest first, or most important first (AI-6). */
export type ListSort = 'newest' | 'priority';

/**
 * The non-AI fallback score, for threads the model has not scored (or priority is off):
 * the user's own flags, Important first.
 */
export function fallbackPriority(thread: ThreadSummary): number {
	return (
		(thread.isImportant ? 0.6 : 0) + (thread.isStarred ? 0.25 : 0) + (thread.isUnread ? 0.1 : 0)
	);
}

/**
 * Orders rows for the Priority sort: by model score, else by the fallback, newest first
 * on a tie. A thread the user marked important always outranks one the model merely likes.
 */
export function priorityOrder(
	items: readonly ThreadSummary[],
	scores: Readonly<Record<string, AIInsight<number>>>
): ThreadSummary[] {
	const score = (thread: ThreadSummary) =>
		(thread.isImportant ? 1 : 0) + (scores[thread.id]?.value ?? fallbackPriority(thread));
	return items
		.map((thread, index) => ({ thread, index, score: score(thread) }))
		.sort((a, b) => b.score - a.score || a.index - b.index)
		.map(({ thread }) => thread);
}
