<script lang="ts">
	import AuthScreen from '#features/onboarding/AuthScreen.svelte';
	import { getSessionStore } from '#lib/stores/session.svelte.js';

	const session = getSessionStore();
</script>

<svelte:head>
	<title>Sign in · Nem Mail</title>
</svelte:head>

<AuthScreen mode="signIn" onsubmit={(request) => session.signIn(request)} />
