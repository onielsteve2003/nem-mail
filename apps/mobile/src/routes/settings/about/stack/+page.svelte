<script lang="ts">
	import { resolve } from '$app/paths';
	import SectionHeader from '#components/ui/SectionHeader.svelte';
	import { STACK } from '#features/settings/about.js';
	import SettingsScreen from '#features/settings/SettingsScreen.svelte';

	const COPY = {
		title: 'Tech stack',
		intro:
			'Nem Mail is a portfolio piece: a Gmail-class mail app with its own design and free, on-device AI. Here is what it is made of.',
		cost: 'Hosting cost: $0 a month.'
	};

	const slug = (title: string) => `stack-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
</script>

<SettingsScreen title={COPY.title} fallbackHref={resolve('/settings/about')}>
	<p class="intro">{COPY.intro}</p>
	{#each STACK as group (group.title)}
		<section class="group" aria-labelledby={slug(group.title)}>
			<SectionHeader id={slug(group.title)} title={group.title} />
			<ul class="items" role="list">
				{#each group.items as item (item.name)}
					<li class="item">
						<span class="item__name">{item.name}</span>
						<span class="item__detail nm-text-caption">{item.detail}</span>
					</li>
				{/each}
			</ul>
		</section>
	{/each}
	<p class="intro cost nm-text-caption">{COPY.cost}</p>
</SettingsScreen>

<style>
	.intro {
		margin: 0;
		padding: var(--nm-space-3) var(--nm-space-4) 0;
		color: var(--nm-color-text-muted);
	}
	.cost {
		padding-block-end: var(--nm-space-6);
	}
	.group {
		display: grid;
		gap: var(--nm-space-3);
		padding: var(--nm-space-3) var(--nm-space-4);
	}
	.items {
		display: grid;
		gap: var(--nm-space-3);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.item {
		display: grid;
		gap: var(--nm-space-1);
		padding: var(--nm-space-3) var(--nm-space-4);
		border: 1px solid var(--nm-color-border);
		border-radius: var(--nm-radius-md);
		background: var(--nm-color-surface-1);
	}
	.item__name {
		font-weight: var(--nm-weight-medium);
	}
	.item__detail {
		color: var(--nm-color-text-muted);
	}
</style>
