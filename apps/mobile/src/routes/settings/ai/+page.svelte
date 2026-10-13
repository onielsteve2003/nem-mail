<script lang="ts">
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import type { AIFeature } from '@nem/shared';
	import { resolve } from '$app/paths';
	import Button from '#components/ui/Button.svelte';
	import ConfirmDialog from '#components/ui/ConfirmDialog.svelte';
	import Icon from '#components/ui/Icon.svelte';
	import ModelManager from '#components/ui/ModelManager.svelte';
	import SectionHeader from '#components/ui/SectionHeader.svelte';
	import Toggle from '#components/ui/Toggle.svelte';
	import { MODELS } from '#lib/ai/registry.js';
	import { getAIService } from '#lib/ai/service.svelte.js';
	import { getRepositories } from '#lib/data/provider.js';
	import { AI_FEATURE_COPY } from '#features/settings/ai.js';
	import { SettingsEditor } from '#features/settings/editor.svelte.js';
	import SettingsScreen from '#features/settings/SettingsScreen.svelte';
	import { getSessionStore } from '#lib/stores/session.svelte.js';
	import { toastStore } from '#lib/stores/toast.svelte.js';
	import { errorMessage } from '#lib/utils/errors.js';

	const COPY = {
		title: 'AI features',
		features: 'Features',
		featuresHint: 'Each feature has a non-AI fallback, so turning one off never breaks mail.',
		privacy: 'Privacy',
		privacyText:
			'Every AI feature runs on this device. Your mail is never sent to an AI service. ' +
			'Optional models download once from Hugging Face and are stored in this browser.',
		learning: 'What the models learned',
		learningHint:
			'Spam, categories, priority and smart compose learn from what you do. Reset them to start fresh.',
		reset: 'Reset models',
		resetTitle: 'Reset learned models?',
		resetMessage:
			'Spam, categories, priority and smart compose forget what they learned from you. ' +
			'Downloaded models are kept.',
		resetDone: 'Models reset.',
		resetFailed: 'Could not reset the models.',
		removeFailed: 'Could not delete the model.'
	};

	const ai = getAIService();
	const session = getSessionStore();
	const editor = new SettingsEditor(getRepositories().settings, (next) => {
		ai.toggles = { ...next.ai };
	});
	void editor.load();
	const settings = $derived(editor.settings);

	let isConfirming = $state(false);
	let isResetting = $state(false);

	// Checks which optional models are on this device. If the worker cannot start, the
	// manager keeps saying it is checking and the features use their fallbacks.
	$effect(() => {
		void ai.refresh().catch(() => {});
	});

	function setFeature(feature: AIFeature, value: boolean): void {
		void editor.update({ ai: { ...settings.ai, [feature]: value } });
	}

	async function remove(id: string): Promise<void> {
		try {
			await ai.remove(id);
		} catch (error) {
			toastStore.show({ message: errorMessage(error, COPY.removeFailed), tone: 'error' });
		}
	}

	async function reset(): Promise<void> {
		const userId = session.user?.id;
		if (!userId) return;
		isResetting = true;
		try {
			await ai.resetLearning(userId);
			toastStore.show({ message: COPY.resetDone });
		} catch (error) {
			toastStore.show({ message: errorMessage(error, COPY.resetFailed), tone: 'error' });
		} finally {
			isResetting = false;
		}
	}
</script>

<SettingsScreen title={COPY.title} fallbackHref={resolve('/settings')}>
	<section class="group" aria-labelledby="privacy">
		<SectionHeader id="privacy" title={COPY.privacy} />
		<p class="note">
			<Icon icon={ShieldCheck} size="sm" />
			<span>{COPY.privacyText}</span>
		</p>
	</section>

	<section class="group" aria-labelledby="features">
		<SectionHeader id="features" title={COPY.features} />
		<p class="hint nm-text-caption">{COPY.featuresHint}</p>
		{#each AI_FEATURE_COPY as copy (copy.feature)}
			<Toggle
				label={copy.name}
				description={copy.description}
				checked={settings.ai[copy.feature]}
				onchange={(event) => setFeature(copy.feature, event.currentTarget.checked)}
			/>
		{/each}
	</section>

	<div class="group">
		<ModelManager
			models={MODELS}
			states={ai.models}
			backend={ai.backend}
			ondownload={(id) => void ai.download(id)}
			onremove={(id) => void remove(id)}
		/>
	</div>

	<section class="group" aria-labelledby="learning">
		<SectionHeader id="learning" title={COPY.learning} />
		<p class="hint nm-text-caption">{COPY.learningHint}</p>
		<div>
			<Button
				variant="glass"
				loading={isResetting}
				disabled={!session.user}
				onclick={() => (isConfirming = true)}
			>
				{#snippet leading()}<Icon icon={RotateCcw} size="sm" />{/snippet}
				{COPY.reset}
			</Button>
		</div>
	</section>
</SettingsScreen>

<ConfirmDialog
	bind:open={isConfirming}
	title={COPY.resetTitle}
	message={COPY.resetMessage}
	confirmLabel={COPY.reset}
	destructive
	onconfirm={() => void reset()}
/>

<style>
	.group {
		display: grid;
		gap: var(--nm-space-3);
		padding: var(--nm-space-3) var(--nm-space-4);
	}
	.hint {
		margin: 0;
		color: var(--nm-color-text-muted);
	}
	.note {
		display: flex;
		gap: var(--nm-space-2);
		align-items: flex-start;
		margin: 0;
		color: var(--nm-color-text-muted);
	}
</style>
