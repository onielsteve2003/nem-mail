import { describe, expect, it } from 'vitest';
import { readingThreadId, withReadingThread } from './reading-pane.js';

const url = (path: string) => new URL(path, 'https://nem.example');

describe('reading pane', () => {
	it('reads the open thread from the URL', () => {
		expect(readingThreadId(url('/mail/inbox?thread=t1'))).toBe('t1');
		expect(readingThreadId(url('/mail/inbox'))).toBeNull();
		expect(readingThreadId(url('/mail/inbox?thread='))).toBeNull();
	});

	it('opens and closes a thread, keeping other params', () => {
		expect(withReadingThread(url('/mail/inbox'), 't1')).toBe('/mail/inbox?thread=t1');
		expect(withReadingThread(url('/mail/inbox?fail=0.1&thread=t1'), 't2')).toBe(
			'/mail/inbox?fail=0.1&thread=t2'
		);
		expect(withReadingThread(url('/mail/inbox?fail=0.1&thread=t1'), null)).toBe(
			'/mail/inbox?fail=0.1'
		);
		expect(withReadingThread(url('/mail/inbox?thread=t1'), null)).toBe('/mail/inbox');
	});
});
