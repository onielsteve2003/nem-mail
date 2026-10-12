import type { Label, SystemMailbox } from '@nem/shared';

export interface MailboxNavItem {
	mailbox: SystemMailbox;
	title: string;
}

/** Drawer order of the system mailboxes (FR-2.1). */
export const MAILBOX_NAV: readonly MailboxNavItem[] = [
	{ mailbox: 'inbox', title: 'Inbox' },
	{ mailbox: 'starred', title: 'Starred' },
	{ mailbox: 'snoozed', title: 'Snoozed' },
	{ mailbox: 'important', title: 'Important' },
	{ mailbox: 'sent', title: 'Sent' },
	{ mailbox: 'scheduled', title: 'Scheduled' },
	{ mailbox: 'outbox', title: 'Outbox' },
	{ mailbox: 'drafts', title: 'Drafts' },
	{ mailbox: 'all', title: 'All mail' },
	{ mailbox: 'spam', title: 'Spam' },
	{ mailbox: 'trash', title: 'Trash' }
];

export function mailboxTitle(mailbox: SystemMailbox): string {
	return MAILBOX_NAV.find((item) => item.mailbox === mailbox)?.title ?? mailbox;
}

export interface LabelNavItem {
	label: Label;
	/** 0 for top-level labels, 1 for nested ones (FR-2.4 allows one level). */
	depth: 0 | 1;
}

/**
 * Labels in drawer order: top-level labels by name, each followed by its
 * children by name. A child whose parent is missing shows at the top level.
 */
export function labelTree(labels: readonly Label[]): LabelNavItem[] {
	const byName = (a: Label, b: Label) => a.name.localeCompare(b.name);
	const ids = new Set(labels.map((label) => label.id));
	const isTop = (label: Label) => label.parentId === null || !ids.has(label.parentId);
	return labels
		.filter(isTop)
		.sort(byName)
		.flatMap((parent) => [
			{ label: parent, depth: 0 as const },
			...labels
				.filter((label) => label.parentId === parent.id)
				.sort(byName)
				.map((label) => ({ label, depth: 1 as const }))
		]);
}
