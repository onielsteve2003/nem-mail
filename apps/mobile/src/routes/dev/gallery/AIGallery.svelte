<script lang="ts">
	import AiOrb from '#components/layout/AiOrb.svelte';
	import AIBadge from '#components/ui/AIBadge.svelte';
	import AICard from '#components/ui/AICard.svelte';
	import AIThinking from '#components/ui/AIThinking.svelte';
	import Button from '#components/ui/Button.svelte';
	import ModelManager from '#components/ui/ModelManager.svelte';
	import { MODELS } from '#lib/ai/registry.js';
	import { getAIService } from '#lib/ai/service.svelte.js';
	import GallerySection from './GallerySection.svelte';

	const SPAM_INSIGHT = {
		value: true,
		confidence: 0.92,
		explanation: 'Urgent wording and a link whose text and address do not match.',
		source: 'model'
	} as const;

	const ai = getAIService();
	let isThinking = $state(false);

	// Real service: the gallery checks this device and can download models for real.
	$effect(() => {
		void ai.refresh();
	});
</script>

<GallerySection title="AI">
	<AIBadge insight={SPAM_INSIGHT} />
	<AiOrb {isThinking} onclick={() => (isThinking = !isThinking)} />
	<AIThinking label="Summarizing" />
	<AICard title="Summary" insight={SPAM_INSIGHT} ondismiss={() => {}}>
		Dana moved the launch review to Thursday and needs the deck by Wednesday noon.
		{#snippet actions()}
			<Button variant="glass" size="sm">Add to calendar</Button>
		{/snippet}
	</AICard>
	<AICard title="Summary" isLoading loadingLabel="Summarizing" />
	<AICard title="Summary" error="Could not summarize this thread." onretry={() => {}} />
	<ModelManager
		models={MODELS}
		states={ai.models}
		backend={ai.backend}
		ondownload={(id) => void ai.download(id)}
		onremove={(id) => void ai.remove(id)}
	/>
</GallerySection>
