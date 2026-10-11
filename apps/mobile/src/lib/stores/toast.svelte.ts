/** How long a plain toast stays up. */
export const TOAST_DURATION_MS = 4000;
/** How long an Undo toast stays up (FR-3.7, FR-5.6). */
export const UNDO_WINDOW_MS = 5000;
/** Waiting toasts beyond this are dropped, oldest first, so a burst cannot bury new ones. */
export const TOAST_QUEUE_LIMIT = 4;

export type ToastTone = 'neutral' | 'success' | 'error';

export interface ToastAction {
	label: string;
	onaction: () => void;
}

export interface ToastInput {
	message: string;
	tone?: ToastTone;
	/** One inline button, e.g. Undo or Retry. */
	action?: ToastAction;
	/** Milliseconds on screen; 0 keeps it until dismissed. Defaults depend on whether there is an action. */
	duration?: number;
}

export interface Toast {
	id: number;
	message: string;
	tone: ToastTone;
	action?: ToastAction;
	duration: number;
}

/**
 * Snackbar queue: one toast shows at a time and the next appears when it
 * leaves. The timer pauses while the user hovers or focuses the toast.
 */
export class ToastStore {
	queue = $state<Toast[]>([]);
	readonly current = $derived(this.queue[0]);

	#nextId = 1;
	#timer: ReturnType<typeof setTimeout> | undefined;
	#remaining = 0;
	#startedAt = 0;

	/** Queues a toast and returns its id. */
	show(input: ToastInput): number {
		const toast: Toast = {
			id: this.#nextId++,
			message: input.message,
			tone: input.tone ?? 'neutral',
			action: input.action,
			duration: input.duration ?? (input.action ? UNDO_WINDOW_MS : TOAST_DURATION_MS)
		};
		const head = this.queue[0];
		const waiting = this.queue.slice(1);
		if (waiting.length >= TOAST_QUEUE_LIMIT) waiting.shift();
		this.queue = head ? [head, ...waiting, toast] : [toast];
		if (!head) this.#start(toast);
		return toast.id;
	}

	/** Removes a toast, showing the next one if it was on screen. */
	dismiss(id: number): void {
		const wasCurrent = this.queue[0]?.id === id;
		this.queue = this.queue.filter((toast) => toast.id !== id);
		if (!wasCurrent) return;
		clearTimeout(this.#timer);
		this.#timer = undefined;
		const next = this.queue[0];
		if (next) this.#start(next);
	}

	/** Runs the toast's action, then dismisses it. */
	runAction(id: number): void {
		const toast = this.queue.find((item) => item.id === id);
		if (!toast) return;
		this.dismiss(id);
		toast.action?.onaction();
	}

	/** Stops the countdown, e.g. while the toast is hovered or focused. */
	pause(): void {
		if (this.#timer === undefined) return;
		clearTimeout(this.#timer);
		this.#timer = undefined;
		this.#remaining -= Date.now() - this.#startedAt;
	}

	/** Continues the countdown with the time that was left. */
	resume(): void {
		const toast = this.queue[0];
		if (!toast || this.#timer !== undefined || toast.duration === 0) return;
		this.#schedule(toast.id, Math.max(this.#remaining, 0));
	}

	/** Drops every toast, e.g. on sign-out. */
	clear(): void {
		clearTimeout(this.#timer);
		this.#timer = undefined;
		this.queue = [];
	}

	#start(toast: Toast) {
		this.#remaining = toast.duration;
		if (toast.duration > 0) this.#schedule(toast.id, toast.duration);
	}

	#schedule(id: number, ms: number) {
		this.#startedAt = Date.now();
		this.#remaining = ms;
		this.#timer = setTimeout(() => {
			this.#timer = undefined;
			this.dismiss(id);
		}, ms);
	}
}

/** The app-wide toast queue. Stores and components call toastStore.show(). */
export const toastStore = new ToastStore();
