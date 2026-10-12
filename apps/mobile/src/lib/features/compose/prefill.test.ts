import type { Message } from '@nem/shared';
import { describe, expect, it } from 'vitest';
import { forwardSubject, prefill, replyRecipients, replySubject } from './prefill.js';

const ME = 'me@nem.mail';

function message(overrides: Partial<Message> = {}): Message {
	return {
		id: 'm1',
		threadId: 't1',
		from: { email: 'ada@example.com', name: 'Ada' },
		to: [{ email: ME }, { email: 'grace@example.com' }],
		cc: [{ email: 'Ada@example.com' }, { email: 'alan@example.com' }],
		bcc: [],
		subject: 'Launch plan',
		bodyHtml: '<p>Ship it <script>x()</script></p>',
		bodyText: 'Ship it',
		snippet: 'Ship it',
		sentAt: '2026-10-12T09:30:00.000Z',
		sendAt: null,
		status: 'sent',
		inReplyTo: null,
		attachments: [],
		isRead: true,
		...overrides
	};
}

const emails = (list: { email: string }[]) => list.map((a) => a.email);

describe('subjects', () => {
	it('adds Re: and Fwd: once', () => {
		expect(replySubject('Launch plan')).toBe('Re: Launch plan');
		expect(replySubject('RE: Launch plan')).toBe('RE: Launch plan');
		expect(forwardSubject('Launch plan')).toBe('Fwd: Launch plan');
		expect(forwardSubject('Fw: Launch plan')).toBe('Fw: Launch plan');
		expect(forwardSubject('Re: Launch plan')).toBe('Fwd: Re: Launch plan');
	});
});

describe('replyRecipients', () => {
	it('replies to the sender only', () => {
		expect(replyRecipients('reply', message(), ME)).toEqual({
			to: [{ email: 'ada@example.com', name: 'Ada' }],
			cc: []
		});
	});

	it('reply all keeps everyone but the user, once each', () => {
		const { to, cc } = replyRecipients('replyAll', message(), 'ME@nem.mail');
		expect(emails(to)).toEqual(['ada@example.com', 'grace@example.com']);
		expect(emails(cc)).toEqual(['alan@example.com']);
	});

	it('replying to your own message goes to the people you wrote to', () => {
		const own = message({ from: { email: ME }, cc: [{ email: 'alan@example.com' }] });
		expect(emails(replyRecipients('reply', own, ME).to)).toEqual(['grace@example.com']);
		const all = replyRecipients('replyAll', own, ME);
		expect(emails(all.to)).toEqual(['grace@example.com']);
		expect(emails(all.cc)).toEqual(['alan@example.com']);
	});
});

describe('prefill', () => {
	it('quotes the sanitized original under the signature for a reply', () => {
		const result = prefill('reply', message(), ME, 'Me');
		expect(result.subject).toBe('Re: Launch plan');
		expect(result.bodyHtml).toMatch(
			/^<div><br><\/div><div><br><\/div><div>-- <br>Me<\/div><div>On .+2026.+, Ada &lt;ada@example.com&gt; wrote:<\/div><blockquote><p>Ship it <\/p><\/blockquote>$/
		);
	});

	it('forwards with no recipients and the original headers', () => {
		const result = prefill('forward', message({ bodyHtml: null }), ME, '');
		expect(result.to).toEqual([]);
		expect(result.subject).toBe('Fwd: Launch plan');
		expect(result.bodyHtml).toContain(
			'---------- Forwarded message ---------<br>From: Ada &lt;ada@example.com&gt;'
		);
		expect(result.bodyHtml).toContain(
			'To: me@nem.mail, grace@example.com<br>Cc: Ada@example.com, alan@example.com'
		);
		expect(result.bodyHtml).toMatch(/<br>Ship it$/);
	});
});
