import type { ServerEvent, Settings, ThreadSummary } from '@nem/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { connectMailAlerts } from './mail-alerts.js';

const summary = { id: 't9', subject: 'Hello', participants: [{ email: 'a@b.c' }] } as ThreadSummary;

function setup(newMail: boolean, isHidden: boolean) {
	let emit: (event: ServerEvent) => void = () => {};
	const shown: string[] = [];
	vi.stubGlobal(
		'Notification',
		class {
			static permission = 'granted';
			constructor(title: string) {
				shown.push(title);
			}
		}
	);
	const stop = connectMailAlerts({
		mail: {
			subscribe: (listener) => {
				emit = listener;
				return () => {};
			}
		},
		settings: { get: async () => ({ notifications: { newMail } }) as Settings },
		onopen: () => {},
		isHidden: () => isHidden
	});
	return { emit: (event: ServerEvent) => emit(event), shown, stop };
}

afterEach(() => vi.unstubAllGlobals());

describe('connectMailAlerts', () => {
	it('alerts for new mail while the app is in the background', async () => {
		const { emit, shown, stop } = setup(true, true);
		emit({ type: 'mail.new', summary });
		await vi.waitFor(() => expect(shown).toEqual(['a@b.c']));
		stop();
	});

	it('stays quiet when the setting is off or the app is in view', async () => {
		for (const [newMail, isHidden] of [
			[false, true],
			[true, false]
		] as const) {
			const { emit, shown, stop } = setup(newMail, isHidden);
			emit({ type: 'mail.new', summary });
			await new Promise((resolve) => setTimeout(resolve, 0));
			expect(shown).toEqual([]);
			stop();
		}
	});
});
