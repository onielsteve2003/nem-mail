import type { ComposeMode } from '@nem/shared';

const TITLES: Record<ComposeMode, string> = {
	new: 'New message',
	reply: 'Reply',
	replyAll: 'Reply all',
	forward: 'Forward'
};

/** The compose header title; a reopened draft keeps the mode it was started in. */
export function composeTitle(request: { mode: ComposeMode; draftId?: string } | null): string {
	if (!request) return TITLES.new;
	return request.draftId && request.mode === 'new' ? 'Draft' : TITLES[request.mode];
}
