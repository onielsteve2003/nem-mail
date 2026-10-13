<script lang="ts">
	import type { SmartReplyVerdict } from '#lib/ai/models/smart-reply.js';
	import AIBadge from '#components/ui/AIBadge.svelte';
	import Chip from '#components/ui/Chip.svelte';

	const LABEL = 'Suggested replies';

	interface Props {
		verdict: SmartReplyVerdict;
		/** Opens a reply that starts with the tapped text. */
		onpick: (text: string) => void;
	}

	let { verdict, onpick }: Props = $props();

	const labelId = $props.id();
</script>

<!-- AI-4: three short replies; each opens compose with the reply filled in. -->
<section class="smart-replies" aria-labelledby={labelId}>
	<div class="smart-replies__header">
		<AIBadge insight={verdict} />
		<h3 id={labelId} class="smart-replies__title nm-text-label">{LABEL}</h3>
	</div>
	<ul class="smart-replies__chips">
		{#each verdict.value as reply (reply)}
			<li><Chip onclick={() => onpick(reply)}>{reply}</Chip></li>
		{/each}
	</ul>
</section>

<style>
	.smart-replies {
		display: grid;
		gap: var(--nm-space-2);
		padding-block: var(--nm-space-3);
		padding-inline: var(--nm-space-4);
	}
	.smart-replies__header {
		display: flex;
		align-items: center;
		gap: var(--nm-space-2);
	}
	.smart-replies__title {
		margin: 0;
		color: var(--nm-color-text-muted);
	}
	.smart-replies__chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--nm-space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}
</style>
