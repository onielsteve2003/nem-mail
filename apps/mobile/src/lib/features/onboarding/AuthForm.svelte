<script lang="ts">
	import type { SignInRequest, SignUpRequest } from '@nem/shared';
	import Button from '#components/ui/Button.svelte';
	import TextField from '#components/ui/TextField.svelte';
	import {
		authErrorMessage,
		checkAuthForm,
		type AuthFieldErrors,
		type AuthMode
	} from './auth-form.js';

	const COPY = {
		signIn: { title: 'Sign in', submit: 'Sign in' },
		signUp: { title: 'Create your account', submit: 'Create account' },
		name: 'Name',
		email: 'Email',
		password: 'Password',
		passwordHint: 'At least 8 characters.'
	};

	interface Props {
		mode: AuthMode;
		/** Sends the request; a rejection is shown on the form. */
		onsubmit: (request: SignUpRequest | SignInRequest) => Promise<unknown>;
	}

	let { mode, onsubmit }: Props = $props();

	let name = $state('');
	let email = $state('');
	let password = $state('');
	let fieldErrors = $state<AuthFieldErrors>({});
	let error = $state<string | null>(null);
	let submitting = $state(false);
	const copy = $derived(COPY[mode]);

	async function submit(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		error = null;
		const check = checkAuthForm(mode, { name, email, password });
		if (!check.ok) {
			fieldErrors = check.errors;
			return;
		}
		fieldErrors = {};
		submitting = true;
		try {
			// On success the layout's guard leaves onboarding for the Inbox.
			await onsubmit(check.request);
		} catch (cause) {
			error = authErrorMessage(mode, cause);
			submitting = false;
		}
	}
</script>

<form class="form" novalidate onsubmit={submit}>
	<h1 class="nm-text-title-1">{copy.title}</h1>
	{#if mode === 'signUp'}
		<TextField
			label={COPY.name}
			bind:value={name}
			error={fieldErrors.name}
			autocomplete="name"
			maxlength={100}
			required
		/>
	{/if}
	<TextField
		label={COPY.email}
		type="email"
		inputmode="email"
		bind:value={email}
		error={fieldErrors.email}
		autocomplete={mode === 'signUp' ? 'email' : 'username'}
		autocapitalize="off"
		spellcheck={false}
		required
	/>
	<TextField
		label={COPY.password}
		type="password"
		bind:value={password}
		error={fieldErrors.password}
		hint={mode === 'signUp' ? COPY.passwordHint : undefined}
		autocomplete={mode === 'signUp' ? 'new-password' : 'current-password'}
		maxlength={200}
		required
	/>
	{#if error}<p class="error" role="alert">{error}</p>{/if}
	<Button type="submit" size="lg" loading={submitting}>{copy.submit}</Button>
</form>

<style>
	.form {
		display: grid;
		gap: var(--nm-space-4);
	}
	h1 {
		margin: 0 0 var(--nm-space-2);
	}
	.error {
		margin: 0;
		color: var(--nm-color-danger);
	}
</style>
