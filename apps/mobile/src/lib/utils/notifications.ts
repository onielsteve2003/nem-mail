import { Capacitor } from '@capacitor/core';
import type { ThreadSummary } from '@nem/shared';

export type AlertPermission = 'granted' | 'denied' | 'default' | 'unsupported';

const NO_SUBJECT = '(no subject)';
const ICON_PATH = '/icons/icon-192.png';

/** Alerts only when the user wants them, allowed them, and is not already looking at the app. */
export function shouldAlert(input: {
	isEnabled: boolean;
	permission: AlertPermission;
	isHidden: boolean;
}): boolean {
	return input.isEnabled && input.permission === 'granted' && input.isHidden;
}

/** The title and body of a new-mail alert: the sender, then the subject. */
export function alertContent(summary: ThreadSummary): { title: string; body: string } {
	const sender = summary.participants.at(-1);
	return {
		title: sender?.name || sender?.email || 'New mail',
		body: summary.subject || NO_SUBJECT
	};
}

const hasWebNotifications = () => typeof Notification !== 'undefined';

function fromNative(state: string): AlertPermission {
	if (state === 'granted' || state === 'denied') return state;
	return 'default';
}

/** Whether new-mail alerts may show: Capacitor Local Notifications natively, the Notification API on the web. */
export async function alertPermission(): Promise<AlertPermission> {
	if (Capacitor.isNativePlatform()) {
		const { LocalNotifications } = await import('@capacitor/local-notifications');
		return fromNative((await LocalNotifications.checkPermissions()).display);
	}
	return hasWebNotifications() ? Notification.permission : 'unsupported';
}

/** Asks for permission to alert. Call it only after a clear user action, such as a toggle. */
export async function requestAlertPermission(): Promise<AlertPermission> {
	if (Capacitor.isNativePlatform()) {
		const { LocalNotifications } = await import('@capacitor/local-notifications');
		return fromNative((await LocalNotifications.requestPermissions()).display);
	}
	return hasWebNotifications() ? Notification.requestPermission() : 'unsupported';
}

// Native notification ids are 32-bit integers; a counter keeps them unique per launch.
let nextId = 1;

/** Shows a new-mail alert. Tapping it calls `onopen` with the thread id. */
export async function showMailAlert(
	summary: ThreadSummary,
	onopen: (threadId: string) => void
): Promise<void> {
	const { title, body } = alertContent(summary);
	if (Capacitor.isNativePlatform()) {
		const { LocalNotifications } = await import('@capacitor/local-notifications');
		await LocalNotifications.schedule({
			notifications: [{ id: nextId++, title, body, extra: { threadId: summary.id } }]
		});
		return;
	}
	if (!hasWebNotifications()) return;
	const alert = new Notification(title, { body, tag: summary.id, icon: ICON_PATH });
	alert.onclick = () => {
		window.focus();
		onopen(summary.id);
		alert.close();
	};
}

/** Opens the thread when a native alert is tapped. Returns a stop function. */
export function listenAlertTaps(onopen: (threadId: string) => void): () => void {
	if (!Capacitor.isNativePlatform()) return () => {};
	let stopped = false;
	let remove: (() => Promise<void>) | undefined;
	void import('@capacitor/local-notifications').then(async ({ LocalNotifications }) => {
		const handle = await LocalNotifications.addListener(
			'localNotificationActionPerformed',
			({ notification }) => {
				const threadId: unknown = notification.extra?.threadId;
				if (typeof threadId === 'string') onopen(threadId);
			}
		);
		if (stopped) void handle.remove();
		else remove = handle.remove;
	});
	return () => {
		stopped = true;
		void remove?.();
	};
}
