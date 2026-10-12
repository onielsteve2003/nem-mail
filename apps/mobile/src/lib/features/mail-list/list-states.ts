import type { SystemMailbox } from '@nem/shared';
import type { StateIllustrationName } from '#components/ui/StateIllustration.svelte';

export interface ListStateCopy {
	title: string;
	message: string;
	illustration: StateIllustrationName;
}

const EMPTY: Record<SystemMailbox, ListStateCopy> = {
	inbox: { title: 'Inbox zero', message: 'You are all caught up.', illustration: 'done' },
	starred: {
		title: 'No starred mail',
		message: 'Star a conversation to find it here quickly.',
		illustration: 'inbox'
	},
	snoozed: {
		title: 'Nothing snoozed',
		message: 'Snoozed conversations come back to the Inbox when it is time.',
		illustration: 'inbox'
	},
	important: {
		title: 'Nothing important',
		message: 'Conversations marked important show here.',
		illustration: 'inbox'
	},
	sent: { title: 'No sent mail', message: 'Mail you send shows here.', illustration: 'folder' },
	scheduled: {
		title: 'Nothing scheduled',
		message: 'Schedule a message from compose to send it later.',
		illustration: 'folder'
	},
	outbox: {
		title: 'Outbox is empty',
		message: 'Mail waiting to go out shows here.',
		illustration: 'folder'
	},
	drafts: {
		title: 'No drafts',
		message: 'Unsent messages are saved here.',
		illustration: 'folder'
	},
	all: { title: 'No mail yet', message: 'Every conversation shows here.', illustration: 'inbox' },
	spam: { title: 'No spam', message: 'Hooray, nothing suspicious here.', illustration: 'done' },
	trash: { title: 'Trash is empty', message: 'Deleted mail shows here.', illustration: 'done' }
};

const LABEL_EMPTY: ListStateCopy = {
	title: 'No conversations',
	message: 'Conversations with this label show here.',
	illustration: 'folder'
};

/** Empty-state copy for a mailbox, or for a label when `mailbox` is null (FR-3.9). */
export function emptyCopy(mailbox: SystemMailbox | null): ListStateCopy {
	return mailbox ? EMPTY[mailbox] : LABEL_EMPTY;
}

/** Error copy; offline gets its own wording (FR-3.9). */
export function errorCopy(isOffline: boolean): ListStateCopy {
	return isOffline
		? {
				title: "You're offline",
				message: 'This list has not been saved yet. Reconnect and try again.',
				illustration: 'offline'
			}
		: {
				title: "Couldn't load your mail",
				message: 'Check your connection and try again.',
				illustration: 'error'
			};
}
