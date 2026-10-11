import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	TOAST_DURATION_MS,
	TOAST_QUEUE_LIMIT,
	ToastStore,
	UNDO_WINDOW_MS
} from './toast.svelte.js';

describe('ToastStore', () => {
	let store: ToastStore;

	beforeEach(() => {
		vi.useFakeTimers();
		store = new ToastStore();
	});

	afterEach(() => {
		store.clear();
		vi.useRealTimers();
	});

	it('shows one toast at a time, in order', () => {
		store.show({ message: 'First' });
		store.show({ message: 'Second' });

		expect(store.current?.message).toBe('First');
		vi.advanceTimersByTime(TOAST_DURATION_MS);
		expect(store.current?.message).toBe('Second');
		vi.advanceTimersByTime(TOAST_DURATION_MS);
		expect(store.current).toBeUndefined();
	});

	it('keeps an Undo toast up for the undo window', () => {
		store.show({ message: 'Archived', action: { label: 'Undo', onaction: vi.fn() } });

		vi.advanceTimersByTime(UNDO_WINDOW_MS - 1);
		expect(store.current?.message).toBe('Archived');
		vi.advanceTimersByTime(1);
		expect(store.current).toBeUndefined();
	});

	it('runs the action once and moves on', () => {
		const onaction = vi.fn();
		const id = store.show({ message: 'Archived', action: { label: 'Undo', onaction } });
		store.show({ message: 'Next' });

		store.runAction(id);
		store.runAction(id);

		expect(onaction).toHaveBeenCalledOnce();
		expect(store.current?.message).toBe('Next');
	});

	it('pauses and resumes with the remaining time', () => {
		store.show({ message: 'Saved' });
		vi.advanceTimersByTime(1000);
		store.pause();
		vi.advanceTimersByTime(TOAST_DURATION_MS * 2);
		expect(store.current?.message).toBe('Saved');

		store.resume();
		vi.advanceTimersByTime(TOAST_DURATION_MS - 1001);
		expect(store.current?.message).toBe('Saved');
		vi.advanceTimersByTime(1);
		expect(store.current).toBeUndefined();
	});

	it('keeps a duration 0 toast until dismissed', () => {
		const id = store.show({ message: 'Offline', duration: 0 });
		vi.advanceTimersByTime(60_000);
		expect(store.current?.id).toBe(id);

		store.dismiss(id);
		expect(store.current).toBeUndefined();
	});

	it('drops the oldest waiting toast past the queue limit', () => {
		store.show({ message: 'Showing' });
		for (let i = 0; i <= TOAST_QUEUE_LIMIT; i++) store.show({ message: `Waiting ${i}` });

		expect(store.queue).toHaveLength(TOAST_QUEUE_LIMIT + 1);
		expect(store.queue.map((toast) => toast.message)).not.toContain('Waiting 0');
		expect(store.current?.message).toBe('Showing');
	});
});
