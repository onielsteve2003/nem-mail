import { describe, expect, it } from 'vitest';
import { load } from './+page.js';

type LoadEvent = Parameters<typeof load>[0];
const run = (mailbox: string) => load({ params: { mailbox } } as LoadEvent);

describe('mailbox route load', () => {
	it('accepts system mailboxes and 404s anything else', () => {
		expect(run('starred')).toEqual({ mailbox: 'starred' });
		expect(() => run('nope')).toThrow(expect.objectContaining({ status: 404 }));
	});
});
