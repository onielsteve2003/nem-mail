<script lang="ts">
	import { resolve } from '$app/paths';
	import SectionHeader from '#components/ui/SectionHeader.svelte';
	import { MODEL_CREDITS, PACKAGE_CREDITS } from '#features/settings/about.js';
	import SettingsScreen from '#features/settings/SettingsScreen.svelte';

	const COPY = {
		title: 'Open-source licenses',
		intro: 'Nem Mail is built on free, open-source work. Thank you to everyone behind it.',
		packages: 'Code',
		models: 'AI models (optional downloads)'
	};

	const groups = [
		{ id: 'packages', title: COPY.packages, credits: PACKAGE_CREDITS },
		{ id: 'models', title: COPY.models, credits: MODEL_CREDITS }
	];
</script>

<SettingsScreen title={COPY.title} fallbackHref={resolve('/settings/about')}>
	<p class="intro">{COPY.intro}</p>
	{#each groups as group (group.id)}
		<section class="group" aria-labelledby={group.id}>
			<SectionHeader id={group.id} title={group.title} />
			<ul class="credits" role="list">
				{#each group.credits as credit (credit.name)}
					<li class="credit">
						<span class="credit__name">{credit.name}</span>
						<span class="credit__meta nm-text-caption">{credit.use} · {credit.license}</span>
					</li>
				{/each}
			</ul>
		</section>
	{/each}
</SettingsScreen>

<style>
	.intro {
		margin: 0;
		padding: var(--nm-space-3) var(--nm-space-4) 0;
		color: var(--nm-color-text-muted);
	}
	.group {
		display: grid;
		gap: var(--nm-space-3);
		padding: var(--nm-space-3) var(--nm-space-4);
	}
	.credits {
		display: grid;
		gap: var(--nm-space-3);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.credit {
		display: grid;
		gap: var(--nm-space-1);
		overflow-wrap: anywhere;
	}
	.credit__name {
		font-weight: var(--nm-weight-medium);
	}
	.credit__meta {
		color: var(--nm-color-text-muted);
	}
</style>
