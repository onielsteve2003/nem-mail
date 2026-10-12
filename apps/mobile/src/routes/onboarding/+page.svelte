<script lang="ts">
	import { DEMO_EMAIL } from '@nem/shared';
	import AuroraBackground from '#components/ui/AuroraBackground.svelte';
	import OnboardingCarousel from '#features/onboarding/OnboardingCarousel.svelte';
	import { getSessionStore } from '#lib/stores/session.svelte.js';
	import { errorMessage } from '#lib/utils/errors.js';

	// The mock ignores the password, but the sign-in schema still asks for one.
	const DEMO_PASSWORD = 'demo-account';

	const session = getSessionStore();
	let starting = $state(false);
	let error = $state<string | null>(null);

	// Demo sign-in needs no password (FR-1.1); the layout's guard then opens the Inbox.
	async function start(): Promise<void> {
		starting = true;
		error = null;
		try {
			await session.signIn({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
		} catch (cause) {
			error = errorMessage(cause);
			starting = false;
		}
	}
</script>

<svelte:head>
	<title>Welcome · Nem Mail</title>
</svelte:head>

<AuroraBackground />

<main class="screen">
	<OnboardingCarousel onstart={start} {starting} {error} />
</main>

<style>
	.screen {
		position: relative;
		z-index: var(--nm-z-raised);
		block-size: var(--nm-viewport-height);
		padding-block: calc(var(--nm-safe-top) + var(--nm-space-6))
			calc(var(--nm-safe-bottom) + var(--nm-space-5));
		padding-inline: var(--nm-safe-left) var(--nm-safe-right);
	}
</style>
