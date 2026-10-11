<script lang="ts" module>
	export type BadgeTone = 'accent' | 'danger' | 'neutral';
</script>

<script lang="ts">
	interface Props {
		/** A count to show. 0 hides the badge (unless `dot`). */
		count?: number;
		/** Counts above this show as "max+". */
		max?: number;
		/** A small dot with no number, e.g. "new" on a tab. */
		dot?: boolean;
		tone?: BadgeTone;
		/** Screen-reader text such as "12 unread". Replaces the bare number. */
		label?: string;
		class?: string;
	}

	let { count, max = 99, dot = false, tone = 'accent', label, class: className }: Props = $props();

	const isDot = $derived(dot || count === undefined);
	const isVisible = $derived(isDot || (count ?? 0) > 0);
	const text = $derived(count !== undefined && count > max ? `${max}+` : String(count ?? ''));
</script>

{#if isVisible}
	<span class={['badge', `badge--${tone}`, { 'badge--dot': isDot }, className]}>
		{#if !isDot}<span aria-hidden={label ? 'true' : undefined}>{text}</span>{/if}
		{#if label}<span class="nm-visually-hidden">{label}</span>{/if}
	</span>
{/if}

<style>
	.badge {
		display: inline-grid;
		place-items: center;
		flex-shrink: 0;
		min-inline-size: var(--nm-space-6);
		block-size: var(--nm-space-6);
		padding-inline: var(--nm-space-2);
		border-radius: var(--nm-radius-pill);
		font-family: var(--nm-font-body);
		font-size: var(--nm-text-micro);
		font-weight: var(--nm-weight-bold);
		font-variant-numeric: tabular-nums;
		line-height: 1;
	}
	.badge--dot {
		min-inline-size: var(--nm-space-3);
		inline-size: var(--nm-space-3);
		block-size: var(--nm-space-3);
		padding: 0;
	}
	.badge--accent {
		background: var(--nm-color-accent);
		color: var(--nm-color-on-accent);
	}
	.badge--danger {
		background: var(--nm-color-danger-fill);
		color: var(--nm-color-on-danger);
	}
	.badge--neutral {
		background: var(--nm-color-surface-3);
		color: var(--nm-color-text);
	}
</style>
