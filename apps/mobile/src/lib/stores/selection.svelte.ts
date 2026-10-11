import { createContext } from 'svelte';
import { SvelteSet } from 'svelte/reactivity';

/** Multi-select in the mail list. Selection mode is on while anything is selected. */
export class SelectionStore {
	readonly ids = new SvelteSet<string>();
	readonly count = $derived(this.ids.size);
	readonly isActive = $derived(this.ids.size > 0);

	has(id: string): boolean {
		return this.ids.has(id);
	}

	toggle(id: string): void {
		if (!this.ids.delete(id)) this.ids.add(id);
	}

	select(ids: Iterable<string>): void {
		for (const id of ids) this.ids.add(id);
	}

	deselect(ids: Iterable<string>): void {
		for (const id of ids) this.ids.delete(id);
	}

	/** Leaves selection mode. */
	clear(): void {
		this.ids.clear();
	}
}

export const [getSelectionStore, setSelectionStore] = createContext<SelectionStore>();
