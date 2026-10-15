<script lang="ts">
	import type { SignUpRequest } from '@nem/shared';
	import AuthScreen from '#features/onboarding/AuthScreen.svelte';
	import { getSessionStore } from '#lib/stores/session.svelte.js';

	const session = getSessionStore();
</script>

<svelte:head>
	<title>Create account · Nem Mail</title>
</svelte:head>

<!-- In sign-up mode the form always sends the name. -->
<AuthScreen mode="signUp" onsubmit={(request) => session.signUp(request as SignUpRequest)} />
