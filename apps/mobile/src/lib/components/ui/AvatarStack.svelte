<script lang="ts" module>
	export interface AvatarPerson {
		name: string;
		src?: string;
	}
</script>

<script lang="ts">
	import Avatar, { type AvatarSize } from './Avatar.svelte';

	/** "Ada", "Ada and Linus", "Ada, Linus and 3 others". */
	const describe = (names: string[], hidden: number) => {
		const shown = hidden > 0 ? [...names, `${hidden} ${hidden === 1 ? 'other' : 'others'}`] : names;
		if (shown.length <= 1) return shown.join('');
		return `${shown.slice(0, -1).join(', ')} and ${shown.at(-1)}`;
	};

	interface Props {
		people: AvatarPerson[];
		/** How many avatars to draw before collapsing the rest into "+N". */
		max?: number;
		size?: AvatarSize;
		class?: string;
	}

	let { people, max = 3, size = 'sm', class: className }: Props = $props();

	const visible = $derived(people.slice(0, Math.max(1, max)));
	const hiddenCount = $derived(people.length - visible.length);
	const label = $derived(
		describe(
			visible.map((p) => p.name),
			hiddenCount
		)
	);
</script>

{#if people.length > 0}
	<span class={['stack', `stack--${size}`, className]} role="img" aria-label={label}>
		{#each visible as person, i (i)}
			<span class="stack__item" aria-hidden="true">
				<Avatar name={person.name} src={person.src} {size} />
			</span>
		{/each}
		{#if hiddenCount > 0}
			<span class="stack__item stack__more" aria-hidden="true">+{hiddenCount}</span>
		{/if}
	</span>
{/if}

<style>
	.stack {
		display: inline-flex;
		align-items: center;
		--stack-size: var(--nm-size-avatar-sm);
	}
	.stack--md {
		--stack-size: var(--nm-size-avatar-md);
	}
	.stack--lg {
		--stack-size: var(--nm-size-avatar-lg);
	}

	.stack__item {
		display: inline-grid;
		place-items: center;
		border-radius: var(--nm-radius-round);
		/* A ring in the page color separates overlapping avatars. */
		box-shadow: 0 0 0 2px var(--nm-color-bg);
	}
	.stack__item + .stack__item {
		margin-inline-start: calc(var(--stack-size) * -0.3);
	}

	.stack__more {
		inline-size: var(--stack-size);
		block-size: var(--stack-size);
		background: var(--nm-color-surface-3);
		color: var(--nm-color-text);
		font-size: var(--nm-text-micro);
		font-weight: var(--nm-weight-semibold);
	}
	.stack--lg .stack__more {
		font-size: var(--nm-text-label);
	}
</style>
