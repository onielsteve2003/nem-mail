<script lang="ts">
	import Menu from '@lucide/svelte/icons/menu';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import Search from '@lucide/svelte/icons/search';
	import Avatar from '#components/ui/Avatar.svelte';
	import Icon from '#components/ui/Icon.svelte';
	import IconButton from '#components/ui/IconButton.svelte';

	const MENU_LABEL = 'Open menu';
	const PLACEHOLDER = 'Search in mail';
	const REFRESH_LABEL = 'Check for new mail';
	const ACCOUNT_LABEL = (name: string) => `Account: ${name}`;

	interface Props {
		/** The resolve()d search route. */
		searchHref: string;
		/** The signed-in user's name, for the avatar. */
		accountName: string;
		onmenu: () => void;
		onaccount: () => void;
		/** Reloads the list: the button alternative to pull to refresh. */
		onrefresh?: () => Promise<void>;
		/** Slides the bar away (scrolling down). It comes back while it holds focus. */
		hidden?: boolean;
	}

	let { searchHref, accountName, onmenu, onaccount, onrefresh, hidden = false }: Props = $props();

	let refreshing = $state(false);

	async function refresh(): Promise<void> {
		if (!onrefresh || refreshing) return;
		refreshing = true;
		try {
			await onrefresh();
		} finally {
			refreshing = false;
		}
	}
</script>

<header class="bar" class:bar--hidden={hidden}>
	<div class="pill">
		<IconButton icon={Menu} label={MENU_LABEL} onclick={onmenu} />
		<!-- The pill opens the search screen (F6); typing happens there. -->
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the caller passes a resolve()d route. -->
		<a class="field" href={searchHref}>
			<Icon icon={Search} size="md" />
			<span>{PLACEHOLDER}</span>
		</a>
		{#if onrefresh}
			<IconButton icon={RefreshCw} label={REFRESH_LABEL} loading={refreshing} onclick={refresh} />
		{/if}
		<button
			type="button"
			class="account"
			aria-label={ACCOUNT_LABEL(accountName)}
			aria-haspopup="dialog"
			onclick={onaccount}
		>
			<Avatar name={accountName} size="sm" />
		</button>
	</div>
</header>

<style>
	.bar {
		position: sticky;
		inset-block-start: 0;
		z-index: var(--nm-z-sticky);
		padding-block: calc(var(--nm-safe-top) + var(--nm-space-2)) var(--nm-space-2);
		padding-inline: max(var(--nm-space-3), var(--nm-safe-left))
			max(var(--nm-space-3), var(--nm-safe-right));
		transition: transform var(--nm-duration-base) var(--nm-ease-standard);
		pointer-events: none;
		view-transition-name: nm-search-bar;
	}
	.bar--hidden:not(:focus-within) {
		transform: translateY(-110%);
	}
	.pill {
		display: flex;
		align-items: center;
		gap: var(--nm-space-1);
		padding: var(--nm-space-1);
		border: 1px solid var(--nm-color-border);
		border-radius: var(--nm-radius-pill);
		background: var(--nm-color-glass);
		backdrop-filter: blur(16px) saturate(1.4);
		-webkit-backdrop-filter: blur(16px) saturate(1.4);
		box-shadow: var(--nm-shadow-2);
		pointer-events: auto;
	}
	.field {
		flex: 1;
		display: flex;
		align-items: center;
		gap: var(--nm-space-2);
		min-block-size: var(--nm-size-touch);
		padding-inline: var(--nm-space-2);
		border-radius: var(--nm-radius-pill);
		color: var(--nm-color-text-muted);
		text-decoration: none;
	}
	.account {
		display: grid;
		place-items: center;
		inline-size: var(--nm-size-touch);
		block-size: var(--nm-size-touch);
		padding: 0;
		border: 0;
		border-radius: var(--nm-radius-round);
		background: none;
		cursor: pointer;
	}
</style>
