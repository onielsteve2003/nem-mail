<script lang="ts">
	import MailList from '#lib/features/mail-list/MailList.svelte';
	import type { PageProps } from './$types';

	const TITLE = 'Label';

	let { params }: PageProps = $props();
	const filter = $derived({ labelId: params.labelId });
</script>

<svelte:head>
	<title>{TITLE} · Nem Mail</title>
</svelte:head>

<main>
	<MailList {filter} />
</main>
