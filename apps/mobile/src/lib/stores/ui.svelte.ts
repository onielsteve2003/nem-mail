import type { ComposeMode } from '@nem/shared';
import { createContext } from 'svelte';
import { ScrollMemory } from '#lib/utils/navigation.js';

/** The sheet name compose opens under. */
export const COMPOSE_SHEET = 'compose';

/** What compose should start from: a new message, a reply to or forward of a message, or a draft. */
export interface ComposeRequest {
	mode: ComposeMode;
	threadId: string | null;
	/** The message being replied to or forwarded. */
	messageId: string | null;
	draftId?: string;
}

/**
 * Chrome state that is not in the URL: the drawer and the stack of open
 * sheets (a sheet can open another, e.g. labels from the actions sheet).
 */
export class UiStore {
	isDrawerOpen = $state(false);
	sheets = $state<string[]>([]);
	/** Read by the compose sheet (M7) when it opens. */
	composeRequest = $state<ComposeRequest | null>(null);
	/** The topmost sheet, or null. */
	readonly activeSheet = $derived(this.sheets.at(-1) ?? null);
	/** Scroll position of each list screen (not reactive). */
	readonly scroll = new ScrollMemory();

	openDrawer(): void {
		this.isDrawerOpen = true;
	}

	closeDrawer(): void {
		this.isDrawerOpen = false;
	}

	toggleDrawer(): void {
		this.isDrawerOpen = !this.isDrawerOpen;
	}

	/** Opens a sheet on top; opening one already in the stack brings it to the top. */
	openSheet(name: string): void {
		this.sheets = [...this.sheets.filter((sheet) => sheet !== name), name];
	}

	/** Closes the named sheet, or the topmost one. */
	closeSheet(name?: string): void {
		this.sheets = name ? this.sheets.filter((sheet) => sheet !== name) : this.sheets.slice(0, -1);
	}

	/** Opens compose for a new message, a reply or forward, or a draft. */
	openCompose(request: ComposeRequest): void {
		this.composeRequest = request;
		this.openSheet(COMPOSE_SHEET);
	}

	isSheetOpen(name: string): boolean {
		return this.sheets.includes(name);
	}

	/** Closes the drawer and every sheet, e.g. on navigation. */
	closeAll(): void {
		this.isDrawerOpen = false;
		this.sheets = [];
	}
}

export const [getUiStore, setUiStore] = createContext<UiStore>();
