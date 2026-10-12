import { AppError, type Thread } from '@nem/shared';
import { describe, expect, it } from 'vitest';
import { threadViewState } from './view-state.js';

const thread = { id: 't1' } as Thread;

describe('threadViewState', () => {
	it('loads until a thread arrives, and keeps a cached thread while refreshing', () => {
		expect(threadViewState(undefined)).toBe('loading');
		expect(threadViewState({ status: 'loading', thread: null, error: null })).toBe('loading');
		expect(threadViewState({ status: 'loading', thread, error: null })).toBe('ready');
	});

	it('tells a missing thread from other errors', () => {
		const missing = new AppError('NOT_FOUND', 'No such thread');
		const offline = new AppError('NETWORK', 'Offline');
		expect(threadViewState({ status: 'error', thread: null, error: missing })).toBe('not-found');
		expect(threadViewState({ status: 'error', thread: null, error: offline })).toBe('error');
	});
});
