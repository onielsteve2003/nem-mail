import type { MailRepository, SettingsRepository } from '#lib/data/repositories.js';
import {
	alertPermission,
	listenAlertTaps,
	shouldAlert,
	showMailAlert
} from '#lib/utils/notifications.js';

interface MailAlertsDeps {
	mail: Pick<MailRepository, 'subscribe'>;
	settings: Pick<SettingsRepository, 'get'>;
	/** Opens a thread, e.g. when an alert is tapped. */
	onopen: (threadId: string) => void;
	/** Whether the app is out of sight; injectable for tests. */
	isHidden?: () => boolean;
}

/**
 * New-mail alerts (FR-9.7, FR-10.2): when mail arrives while the app is in the
 * background and the "New mail" setting is on, shows a local notification.
 * Returns a stop function.
 */
export function connectMailAlerts({
	mail,
	settings,
	onopen,
	isHidden = () => document.visibilityState === 'hidden'
}: MailAlertsDeps): () => void {
	const unsubscribe = mail.subscribe((event) => {
		if (event.type !== 'mail.new' || !isHidden()) return;
		void (async () => {
			const [current, permission] = await Promise.all([settings.get(), alertPermission()]);
			const isEnabled = current.notifications.newMail;
			if (shouldAlert({ isEnabled, permission, isHidden: isHidden() })) {
				await showMailAlert(event.summary, onopen);
			}
		})().catch((error: unknown) => console.error('New-mail alert failed', error));
	});
	const stopTaps = listenAlertTaps(onopen);
	return () => {
		unsubscribe();
		stopTaps();
	};
}
