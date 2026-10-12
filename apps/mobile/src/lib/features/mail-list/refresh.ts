import { createContext } from 'svelte';

/**
 * Lets the visible list answer the layout's pull to refresh: the list knows
 * its filter, the layout owns the refresher.
 */
export class ListRefresh {
	#handler: (() => Promise<void>) | null = null;

	/** Sets the handler for the visible list. Returns a function that removes it. */
	register(handler: () => Promise<void>): () => void {
		this.#handler = handler;
		return () => {
			if (this.#handler === handler) this.#handler = null;
		};
	}

	/** Runs the visible list's refresh, if any. */
	async run(): Promise<void> {
		await this.#handler?.();
	}
}

export const [getListRefresh, setListRefresh] = createContext<ListRefresh>();
