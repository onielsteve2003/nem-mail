<script lang="ts">
	interface Props {
		orientation?: 'horizontal' | 'vertical';
		/** Indent a horizontal divider to line up with list text after a leading icon or avatar. */
		inset?: 'none' | 'start';
		class?: string;
	}

	let { orientation = 'horizontal', inset = 'none', class: className }: Props = $props();
</script>

{#if orientation === 'vertical'}
	<div
		role="separator"
		aria-orientation="vertical"
		class={['divider', 'divider--vertical', className]}
	></div>
{:else}
	<hr class={['divider', { 'divider--inset': inset === 'start' }, className]} />
{/if}

<style>
	.divider {
		flex-shrink: 0;
		margin: 0;
		border: 0;
		background: var(--nm-color-border);
	}
	hr.divider {
		block-size: 1px;
		margin-block: var(--nm-space-2);
	}
	/* Row padding + a medium avatar + the row gap, so it starts under the title. */
	.divider--inset {
		margin-inline-start: calc(var(--nm-space-4) + var(--nm-size-avatar-md) + var(--nm-space-4));
	}
	.divider--vertical {
		align-self: stretch;
		inline-size: 1px;
		margin-inline: var(--nm-space-2);
	}
</style>
