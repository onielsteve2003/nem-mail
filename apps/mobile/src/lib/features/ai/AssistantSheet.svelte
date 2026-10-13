<script lang="ts">
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import {
		ASSISTANT_PROMPTS,
		type AssistantAnswer,
		type AssistantPrompt
	} from '#lib/ai/assistant.js';
	import { getAIService } from '#lib/ai/service.svelte.js';
	import AICard from '#components/ui/AICard.svelte';
	import BottomSheet from '#components/ui/BottomSheet.svelte';
	import Button from '#components/ui/Button.svelte';
	import Chip from '#components/ui/Chip.svelte';
	import Icon from '#components/ui/Icon.svelte';
	import { getSessionStore } from '#lib/stores/session.svelte.js';
	import { getUiStore } from '#lib/stores/ui.svelte.js';
	import { errorMessage } from '#lib/utils/errors.js';
	import TypingText from './TypingText.svelte';

	const TITLE = 'Assistant';
	const INTRO = 'Ask about your mail. Everything runs on this device.';
	const PROMPTS_LABEL = 'Ask the assistant';
	const PROMPT_TEXT: Record<AssistantPrompt, string> = {
		summarizeUnread: 'Summarize unread',
		needsReply: 'What needs a reply?',
		draftReply: 'Draft reply'
	};
	const THINKING = 'Reading your mail…';
	const OPEN_IN_COMPOSE = 'Open in compose';
	const OFF = 'The assistant is turned off. You can turn it on again in Settings.';

	interface Props {
		open: boolean;
		onclose: () => void;
		/** The conversation on screen (two-pane), which "Draft reply" answers first. */
		openThreadId?: string | null;
		/** Where a listed conversation opens. */
		threadHref: (threadId: string) => string;
		/** Fires when work on an answer starts and ends, for the orb's ring. */
		onthinking?: (isThinking: boolean) => void;
	}

	let { open, onclose, openThreadId = null, threadHref, onthinking }: Props = $props();

	const ai = getAIService();
	const session = getSessionStore();
	const ui = getUiStore();

	let asked = $state<AssistantPrompt | null>(null);
	let answer = $state<AssistantAnswer | null>(null);
	let error = $state<string | null>(null);
	/** Items and the draft come in once the text has typed out. */
	let isTyped = $state(false);
	let run = 0;

	async function ask(prompt: AssistantPrompt): Promise<void> {
		const user = session.user;
		if (!user) return;
		const id = ++run;
		asked = prompt;
		answer = null;
		error = null;
		isTyped = false;
		onthinking?.(true);
		try {
			const result =
				prompt === 'summarizeUnread'
					? await ai.summarizeUnread(user)
					: prompt === 'needsReply'
						? await ai.needsReply(user)
						: await ai.draftReply(user, openThreadId);
			if (id === run) answer = result;
		} catch (failure) {
			if (id === run) error = errorMessage(failure);
		} finally {
			if (id === run) onthinking?.(false);
		}
	}

	function openDraft(): void {
		const draft = answer?.draft;
		if (!draft) return;
		onclose();
		ui.openCompose({
			mode: 'reply',
			threadId: draft.threadId,
			messageId: draft.messageId,
			replyText: draft.text
		});
	}
</script>

<BottomSheet {open} title={TITLE} snapPoints={[0.6, 0.92]} {onclose}>
	<div class="assistant">
		<p class="assistant__intro nm-text-body">{INTRO}</p>
		{#if !ai.isEnabled('assistant')}
			<p class="assistant__off nm-text-body" role="note">{OFF}</p>
		{:else}
			<ul class="assistant__prompts" aria-label={PROMPTS_LABEL}>
				{#each ASSISTANT_PROMPTS as prompt (prompt)}
					<li>
						<Chip selected={asked === prompt} onclick={() => void ask(prompt)}>
							{PROMPT_TEXT[prompt]}
						</Chip>
					</li>
				{/each}
			</ul>
			{#if asked}
				<AICard
					title={PROMPT_TEXT[asked]}
					insight={answer
						? {
								value: answer.text,
								confidence: 1,
								explanation: answer.explanation,
								source: answer.source
							}
						: undefined}
					isLoading={!answer && !error}
					loadingLabel={THINKING}
					{error}
					onretry={() => asked && void ask(asked)}
				>
					{#if answer}
						<TypingText text={answer.text} ondone={() => (isTyped = true)} />
						{#if isTyped && answer.items.length > 0}
							<ul class="assistant__items">
								{#each answer.items as item (item.threadId)}
									<li>
										<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- threadHref returns a resolve()d route. -->
										<a class="assistant__item" href={threadHref(item.threadId)} onclick={onclose}>
											<span class="assistant__item-text">
												<span class="assistant__item-title nm-text-body">{item.title}</span>
												<span class="assistant__item-detail nm-text-caption">{item.detail}</span>
											</span>
											<Icon icon={ChevronRight} size="sm" />
										</a>
									</li>
								{/each}
							</ul>
						{/if}
						{#if answer.draft}
							<div class="assistant__draft">
								<TypingText text={answer.draft.text} />
							</div>
						{/if}
					{/if}
					{#snippet actions()}
						{#if answer?.draft && isTyped}
							<Button size="sm" onclick={openDraft}>{OPEN_IN_COMPOSE}</Button>
						{/if}
					{/snippet}
				</AICard>
			{/if}
		{/if}
	</div>
</BottomSheet>

<style>
	.assistant {
		display: grid;
		gap: var(--nm-space-3);
		padding-inline: var(--nm-space-4);
		padding-block-end: var(--nm-space-6);
	}
	.assistant__intro,
	.assistant__off {
		margin: 0;
		color: var(--nm-color-text-muted);
	}
	.assistant__prompts,
	.assistant__items {
		display: flex;
		flex-wrap: wrap;
		gap: var(--nm-space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.assistant__items {
		flex-direction: column;
		margin-block-start: var(--nm-space-3);
	}
	.assistant__item {
		display: flex;
		align-items: center;
		gap: var(--nm-space-2);
		min-height: var(--nm-size-touch);
		padding: var(--nm-space-2) var(--nm-space-3);
		border-radius: var(--nm-radius-md);
		background: var(--nm-color-surface-2);
		color: inherit;
		text-decoration: none;
	}
	.assistant__item-text {
		display: grid;
		flex: 1;
		min-width: 0;
	}
	.assistant__item-title,
	.assistant__item-detail {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.assistant__item-detail {
		color: var(--nm-color-text-muted);
	}
	.assistant__draft {
		margin-block-start: var(--nm-space-3);
		padding: var(--nm-space-3);
		border-inline-start: 2px solid var(--nm-color-accent);
		border-radius: var(--nm-radius-sm);
		background: var(--nm-color-surface-2);
	}
</style>
