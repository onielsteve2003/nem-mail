<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import LogOut from '@lucide/svelte/icons/log-out';
	import UserPlus from '@lucide/svelte/icons/user-plus';
	import { DEMO_PASSWORD } from '@nem/shared';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Avatar from '#components/ui/Avatar.svelte';
	import BottomSheet from '#components/ui/BottomSheet.svelte';
	import Divider from '#components/ui/Divider.svelte';
	import Icon from '#components/ui/Icon.svelte';
	import ListItem from '#components/ui/ListItem.svelte';
	import Spinner from '#components/ui/Spinner.svelte';
	import { getSessionStore } from '#lib/stores/session.svelte.js';
	import { toastStore } from '#lib/stores/toast.svelte.js';
	import { errorMessage } from '#lib/utils/errors.js';
	import { nextDemoEmail } from './accounts.js';

	const TITLE = 'Accounts';
	const LIST_LABEL = 'Signed-in accounts';
	const CURRENT_LABEL = 'Current account';
	const ADD_TITLE = 'Add account';
	const ADD_SUBTITLE = (email: string) => `Demo: ${email}`;
	const ADD_NONE = 'Every demo account is signed in';
	const SIGN_OUT_TITLE = 'Sign out';
	const SIGN_OUT_SUBTITLE = (email: string) => `Sign out of ${email}`;
	const SIGNED_OUT = (email: string) => `Signed out of ${email}`;

	interface Props {
		open: boolean;
		onclose: () => void;
	}

	let { open, onclose }: Props = $props();

	const session = getSessionStore();
	const addEmail = $derived(nextDemoEmail(session.accounts));
	/** The row whose action is running, so only one runs at a time. */
	let busy = $state<string | null>(null);

	async function run(key: string, action: () => Promise<unknown>): Promise<void> {
		if (busy) return;
		busy = key;
		try {
			await action();
			onclose();
			// F10: the Inbox reloads for the account now in use. With nobody
			// signed in, the layout's guard opens onboarding instead.
			if (session.user) await goto(resolve('/mail/(list)/[mailbox]', { mailbox: 'inbox' }));
		} catch (error) {
			toastStore.show({ message: errorMessage(error), tone: 'error' });
		} finally {
			busy = null;
		}
	}

	function switchTo(accountId: string): void {
		if (accountId === session.user?.id) return onclose();
		void run(accountId, () => session.switchAccount(accountId));
	}

	function add(email: string): void {
		void run('add', () => session.signIn({ email, password: DEMO_PASSWORD }));
	}

	function signOut(): void {
		const email = session.user?.email ?? '';
		void run('signout', async () => {
			await session.signOut();
			toastStore.show({ message: SIGNED_OUT(email) });
		});
	}
</script>

<BottomSheet {open} title={TITLE} {onclose}>
	<ul class="list" aria-label={LIST_LABEL}>
		{#each session.accounts as account (account.id)}
			{@const isCurrent = account.id === session.user?.id}
			<li>
				<ListItem
					title={account.name}
					subtitle={account.email}
					current={isCurrent}
					disabled={busy !== null && busy !== account.id}
					onclick={() => switchTo(account.id)}
				>
					{#snippet leading()}<Avatar name={account.name} size="md" />{/snippet}
					{#snippet trailing()}
						{#if busy === account.id}
							<Spinner size="sm" />
						{:else if isCurrent}
							<Icon icon={Check} label={CURRENT_LABEL} />
						{/if}
					{/snippet}
				</ListItem>
			</li>
		{/each}
	</ul>
	<Divider />
	<ul class="list">
		<li>
			<ListItem
				title={ADD_TITLE}
				subtitle={addEmail ? ADD_SUBTITLE(addEmail) : ADD_NONE}
				disabled={!addEmail || busy !== null}
				onclick={() => addEmail && add(addEmail)}
			>
				{#snippet leading()}<Icon icon={UserPlus} />{/snippet}
				{#snippet trailing()}{#if busy === 'add'}<Spinner size="sm" />{/if}{/snippet}
			</ListItem>
		</li>
		<li>
			<ListItem
				title={SIGN_OUT_TITLE}
				subtitle={SIGN_OUT_SUBTITLE(session.user?.email ?? '')}
				disabled={busy !== null}
				onclick={signOut}
			>
				{#snippet leading()}<Icon icon={LogOut} />{/snippet}
				{#snippet trailing()}{#if busy === 'signout'}<Spinner size="sm" />{/if}{/snippet}
			</ListItem>
		</li>
	</ul>
</BottomSheet>

<style>
	.list {
		margin: 0;
		padding: 0;
		list-style: none;
	}
</style>
