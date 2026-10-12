import { SystemMailboxSchema } from '@nem/shared';
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

// Deep links (FR-2.5) only open system mailboxes; anything else is a 404.
export const load: PageLoad = ({ params }) => {
	const parsed = SystemMailboxSchema.safeParse(params.mailbox);
	if (!parsed.success) error(404, 'Not found');
	return { mailbox: parsed.data };
};
