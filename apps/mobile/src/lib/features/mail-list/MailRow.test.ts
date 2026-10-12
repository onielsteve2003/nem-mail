import type { ThreadSummary } from '@nem/shared';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import MailRow from './MailRow.svelte';

const NOW = new Date(2026, 9, 12, 18, 0).getTime();

function makeThread(overrides: Partial<ThreadSummary> = {}): ThreadSummary {
	return {
		id: 't1',
		subject: 'Launch plan',
		snippet: 'Here is the draft for Monday',
		participants: [
			{ email: 'ada@nem.dev', name: 'Ada Lovelace' },
			{ email: 'grace@nem.dev', name: 'Grace Hopper' }
		],
		messageCount: 3,
		lastMessageAt: new Date(2026, 9, 12, 9, 5).toISOString(),
		mailboxes: ['inbox'],
		category: 'primary',
		labelIds: ['l1'],
		isUnread: true,
		isStarred: true,
		isImportant: true,
		isMuted: false,
		snoozedUntil: null,
		attachments: [
			{ filename: 'plan.pdf', mime: 'application/pdf' },
			{ filename: 'photo.png', mime: 'image/png' },
			{ filename: 'notes.txt', mime: 'text/plain' }
		],
		...overrides
	};
}

const labels = [{ id: 'l1', name: 'Work', color: 'violet' as const, parentId: null }];

describe('MailRow', () => {
	it('marks search matches in the sender, subject and snippet', () => {
		const { container } = render(MailRow, {
			thread: makeThread(),
			href: '/t1',
			now: NOW,
			highlight: ['plan', 'grace']
		});
		const marks = [...container.querySelectorAll('mark')].map((m) => m.textContent);
		expect(marks).toEqual(['Grace', 'plan']);
		expect(screen.getByText('Here is the draft for Monday')).toBeInTheDocument();
	});

	it('shows every field with unread, star and important marks', () => {
		const { container } = render(MailRow, {
			thread: makeThread(),
			href: '/mail/thread/t1',
			labels,
			now: NOW
		});
		const link = screen.getByRole('link');
		expect(link).toHaveAttribute('href', '/mail/thread/t1');
		expect(link).toHaveTextContent('Unread');
		expect(link).toHaveTextContent('Ada, Grace');
		expect(screen.getByLabelText('3 messages')).toBeInTheDocument();
		expect(link).toHaveTextContent('Launch plan');
		expect(link).toHaveTextContent('Here is the draft for Monday');
		expect(screen.getByLabelText('Starred')).toBeInTheDocument();
		expect(screen.getByLabelText('Important')).toBeInTheDocument();
		expect(link).toHaveTextContent('Work');
		expect(link).toHaveTextContent('plan.pdf');
		expect(link).toHaveTextContent('photo.png');
		expect(link).toHaveTextContent('+1');
		expect(container.querySelector('.row')).toHaveClass('row--unread', 'row--default');
	});

	it('folds attachments into a paperclip when compact and hides read-only marks', () => {
		render(MailRow, {
			thread: makeThread({
				isUnread: false,
				isStarred: false,
				isImportant: false,
				messageCount: 1
			}),
			href: '#',
			density: 'compact',
			now: NOW
		});
		const link = screen.getByRole('link');
		expect(screen.getByLabelText('Has attachments')).toBeInTheDocument();
		expect(link).not.toHaveTextContent('plan.pdf');
		expect(link).not.toHaveTextContent('Unread');
		expect(screen.queryByLabelText('Starred')).toBeNull();
		expect(screen.queryByLabelText('3 messages')).toBeNull();
	});

	it('selects through the avatar', async () => {
		const onselect = vi.fn();
		render(MailRow, { thread: makeThread(), href: '#', onselect, now: NOW });
		await fireEvent.click(screen.getByRole('button', { name: 'Select Grace Hopper' }));
		expect(onselect).toHaveBeenCalledOnce();
	});

	it('toggles instead of opening when tapped in selection mode', async () => {
		const onselect = vi.fn();
		render(MailRow, { thread: makeThread(), href: '/t1', now: NOW, selecting: true, onselect });
		const link = screen.getByRole('button', { name: /Launch plan/ });
		expect(link).toHaveAttribute('aria-pressed', 'false');
		const isPrevented = !(await fireEvent.click(link));
		expect(onselect).toHaveBeenCalledOnce();
		expect(isPrevented).toBe(true);
	});

	it('toggles star and important without opening the thread', async () => {
		const onstar = vi.fn();
		const onimportant = vi.fn();
		const { container } = render(MailRow, {
			thread: makeThread({ isStarred: false }),
			href: '/t1',
			now: NOW,
			onstar,
			onimportant
		});
		const star = screen.getByRole('button', { name: 'Starred' });
		expect(star).toHaveAttribute('aria-pressed', 'false');
		expect(screen.getByRole('button', { name: 'Important' })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		await fireEvent.click(star);
		expect(onstar).toHaveBeenCalledOnce();
		expect(container.querySelectorAll('.mark__spark')).toHaveLength(6);
		await fireEvent.click(screen.getByRole('button', { name: 'Important' }));
		expect(onimportant).toHaveBeenCalledOnce();
		// The marks are buttons now, so the link no longer repeats them.
		expect(screen.getByRole('link')).not.toHaveTextContent('Starred');
	});

	it('uses mailbox-specific sender and time text', () => {
		render(MailRow, {
			thread: makeThread(),
			href: '#',
			now: NOW,
			text: { sender: 'To: Ada', when: { text: 'Sends 5:00 PM', datetime: '2026-10-12T17:00' } }
		});
		const link = screen.getByRole('link');
		expect(link).toHaveTextContent('To: Ada');
		expect(link.querySelector('time')).toHaveTextContent('Sends 5:00 PM');
		expect(link.querySelector('time')).toHaveAttribute('datetime', '2026-10-12T17:00');
	});

	it('starts selection on a long press', async () => {
		const onlongpress = vi.fn();
		const { container } = render(MailRow, {
			thread: makeThread(),
			href: '#',
			now: NOW,
			onlongpress
		});
		// The browser's own long-press menu counts as the press.
		await fireEvent.contextMenu(container.querySelector('.row') as Element);
		expect(onlongpress).toHaveBeenCalledOnce();
	});
});
