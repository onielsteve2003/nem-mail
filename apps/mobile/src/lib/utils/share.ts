import { Capacitor } from '@capacitor/core';

export interface ShareContent {
	title: string;
	text: string;
}

/** What happened: the share sheet ran, the user closed it, the text was copied, or nothing works. */
export type ShareResult = 'shared' | 'cancelled' | 'copied' | 'unsupported';

// Checked by name: a DOMException is not an Error instance in every engine.
const isAbort = (error: unknown) =>
	typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError';

/**
 * Opens the system share sheet: the Capacitor Share plugin in the native app, the Web
 * Share API in the browser, else copies the text to the clipboard.
 */
export async function shareContent(content: ShareContent): Promise<ShareResult> {
	if (Capacitor.isNativePlatform()) {
		const { Share } = await import('@capacitor/share');
		try {
			await Share.share({ title: content.title, text: content.text, dialogTitle: content.title });
			return 'shared';
		} catch (error) {
			// The plugin rejects with "Share canceled" when the sheet is dismissed.
			if (error instanceof Error && /cancel/i.test(error.message)) return 'cancelled';
			throw error;
		}
	}
	if (typeof navigator.share === 'function') {
		try {
			await navigator.share(content);
			return 'shared';
		} catch (error) {
			if (isAbort(error)) return 'cancelled';
			throw error;
		}
	}
	if (navigator.clipboard) {
		await navigator.clipboard.writeText(`${content.title}\n\n${content.text}`);
		return 'copied';
	}
	return 'unsupported';
}
