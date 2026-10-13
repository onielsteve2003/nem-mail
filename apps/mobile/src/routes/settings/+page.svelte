<script lang="ts">
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
	import Hand from '@lucide/svelte/icons/hand';
	import Info from '@lucide/svelte/icons/info';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import Tag from '@lucide/svelte/icons/tag';
	import UserRound from '@lucide/svelte/icons/user-round';
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
			title: 'Swipe actions',
			subtitle: 'What swiping a conversation left or right does',
			icon: Hand,
			href: resolve('/settings/swipe')
		},
		{
			title: 'AI features',
			subtitle: 'Turn features on or off, manage on-device models',
			icon: Sparkles,
			href: resolve('/settings/ai')
		},
		{
			title: 'Account',
			subtitle: 'Signature, vacation responder, notifications',
			icon: UserRound,
			href: resolve('/settings/account')
		},
		{
			title: 'Labels',
			subtitle: 'Create, rename, recolor and delete',
			icon: Tag,
			href: resolve('/settings/labels')
		},
		{
			title: 'About and help',
			subtitle: 'Version, tips, tech stack, licenses, reset demo data',
			icon: Info,
			href: resolve('/settings/about')
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
