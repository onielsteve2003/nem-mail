<script lang="ts">
	import { mailboxTitle } from '#components/layout/nav.js';
	import MailList from '#lib/features/mail-list/MailList.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const title = $derived(mailboxTitle(data.mailbox));
	const filter = $derived({ mailbox: data.mailbox });
</script>

<svelte:head>
	<title>{title} · Nem Mail</title>
</svelte:head>

<main>
	<MailList {filter} {title} />
</main>
