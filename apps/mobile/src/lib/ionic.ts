import { defineCustomElements } from '@ionic/core/loader';

let isRegistered = false;

/**
 * Registers Ionic's web components with the lazy loader: each `<ion-*>` tag
 * downloads its own chunk the first time it appears in the DOM.
 */
export function setupIonic(): Promise<void> {
	if (isRegistered) return Promise.resolve();
	isRegistered = true;
	return defineCustomElements(window);
}
