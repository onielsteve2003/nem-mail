<script lang="ts">
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
	import Tag from '@lucide/svelte/icons/tag';
	import { resolve } from '$app/paths';
	import Icon from '#components/ui/Icon.svelte';
	import ListItem from '#components/ui/ListItem.svelte';
	import SettingsScreen from '#features/settings/SettingsScreen.svelte';

	const TITLE = 'Settings';

	const sections = [
		{
			title: 'General',
			subtitle: 'Theme, density, default reply, confirmations',
			icon: SlidersHorizontal,
			href: resolve('/settings/general')
		},
		{
			title: 'Labels',
			subtitle: 'Create, rename, recolor and delete',
			icon: Tag,
			href: resolve('/settings/labels')
		}
	];
</script>

<SettingsScreen
	title={TITLE}
	fallbackHref={resolve('/mail/(list)/[mailbox]', { mailbox: 'inbox' })}
>
	<nav aria-label={TITLE}>
		<ul class="sections" role="list">
			{#each sections as section (section.href)}
				<li>
					<ListItem title={section.title} subtitle={section.subtitle} href={section.href}>
						{#snippet leading()}<Icon icon={section.icon} />{/snippet}
						{#snippet trailing()}<Icon icon={ChevronRight} size="sm" />{/snippet}
					</ListItem>
				</li>
			{/each}
		</ul>
	</nav>
</SettingsScreen>

<style>
	.sections {
		margin: 0;
		padding: 0;
		list-style: none;
	}
</style>
