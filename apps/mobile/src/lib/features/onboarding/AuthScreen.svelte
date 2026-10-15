<script lang="ts">
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import { resolve } from '$app/paths';
	import type { SignInRequest, SignUpRequest } from '@nem/shared';
	import AuroraBackground from '#components/ui/AuroraBackground.svelte';
	import IconButton from '#components/ui/IconButton.svelte';
	import AuthForm from './AuthForm.svelte';
	import type { AuthMode } from './auth-form.js';

	const BACK_LABEL = 'Back to welcome';
	const SWITCH = {
		signIn: { prompt: 'New to Nem Mail?', link: 'Create an account' },
		signUp: { prompt: 'Already have an account?', link: 'Sign in' }
	};

	interface Props {
		mode: AuthMode;
		onsubmit: (request: SignUpRequest | SignInRequest) => Promise<unknown>;
	}

	let { mode, onsubmit }: Props = $props();
	const other = $derived(
		mode === 'signIn' ? resolve('/onboarding/sign-up') : resolve('/onboarding/sign-in')
	);
</script>

<AuroraBackground />

<main class="screen">
	<IconButton icon={ArrowLeft} label={BACK_LABEL} href={resolve('/onboarding')} />
	<div class="body">
		<AuthForm {mode} {onsubmit} />
		<p class="switch nm-text-muted">
			{SWITCH[mode].prompt}
			<a href={other}>{SWITCH[mode].link}</a>
		</p>
	</div>
</main>

<style>
	.screen {
		position: relative;
		z-index: var(--nm-z-raised);
		min-block-size: var(--nm-viewport-height);
		padding-block: calc(var(--nm-safe-top) + var(--nm-space-3))
			calc(var(--nm-safe-bottom) + var(--nm-space-5));
		padding-inline: calc(var(--nm-safe-left) + var(--nm-space-3))
			calc(var(--nm-safe-right) + var(--nm-space-3));
	}
	.body {
		display: grid;
		gap: var(--nm-space-5);
		max-inline-size: 26rem;
		margin-inline: auto;
		padding-block-start: var(--nm-space-6);
		padding-inline: var(--nm-space-3);
	}
	.switch {
		margin: 0;
		text-align: center;
	}
	.switch a {
		display: inline-block;
		min-block-size: var(--nm-size-touch);
		padding-block: var(--nm-space-3);
		color: var(--nm-color-accent-text);
		font-weight: 600;
	}
</style>
