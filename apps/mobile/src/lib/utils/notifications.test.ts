import type { ThreadSummary } from '@nem/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	alertContent,
	alertPermission,
	requestAlertPermission,
	shouldAlert,
	showMailAlert
} from './notifications.js';

const summary = {
	id: 't1',
	subject: 'Quarterly plan',
	participants: [{ email: 'grace@example.com', name: 'Grace' }, { email: 'ada@example.com' }]
} as ThreadSummary;

afterEach(() => vi.unstubAllGlobals());

describe('shouldAlert', () => {
	it('alerts only when on, allowed and out of sight', () => {
		const base = { isEnabled: true, permission: 'granted', isHidden: true } as const;
		expect(shouldAlert(base)).toBe(true);
		expect(shouldAlert({ ...base, isEnabled: false })).toBe(false);
		expect(shouldAlert({ ...base, permission: 'default' })).toBe(false);
		expect(shouldAlert({ ...base, isHidden: false })).toBe(false);
	});
});

describe('alertContent', () => {
	it('names the latest sender and the subject', () => {
		expect(alertContent(summary)).toEqual({ title: 'ada@example.com', body: 'Quarterly plan' });
		const untitled = { ...summary, subject: '', participants: [{ email: 'x@y.z', name: 'X' }] };
		expect(alertContent(untitled)).toEqual({ title: 'X', body: '(no subject)' });
	});
});

describe('web fallback', () => {
	it('reports unsupported without the Notification API', async () => {
		vi.stubGlobal('Notification', undefined);
		expect(await alertPermission()).toBe('unsupported');
		expect(await requestAlertPermission()).toBe('unsupported');
	});

	it('shows a browser notification that opens the thread on click', async () => {
		const shown: FakeNotification[] = [];
		class FakeNotification {
			static permission = 'granted';
			onclick: (() => void) | null = null;
			close = vi.fn();
			constructor(
				readonly title: string,
				readonly options: NotificationOptions
			) {
				shown.push(this);
			}
		}
		vi.stubGlobal('Notification', FakeNotification);
		vi.spyOn(window, 'focus').mockImplementation(() => {});
		expect(await alertPermission()).toBe('granted');

		const onopen = vi.fn();
		await showMailAlert(summary, onopen);
		const [alert] = shown;
		expect(alert?.title).toBe('ada@example.com');
		expect(alert?.options).toMatchObject({ body: 'Quarterly plan', tag: 't1' });
		alert?.onclick?.();
		expect(onopen).toHaveBeenCalledWith('t1');
		expect(alert?.close).toHaveBeenCalled();
	});
});
