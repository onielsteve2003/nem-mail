<script lang="ts">
	import MailMinus from '@lucide/svelte/icons/mail-minus';
	import Reply from '@lucide/svelte/icons/reply';
	import X from '@lucide/svelte/icons/x';
	import AIBadge from '#components/ui/AIBadge.svelte';
	import Button from '#components/ui/Button.svelte';
	import Icon from '#components/ui/Icon.svelte';
	import IconButton from '#components/ui/IconButton.svelte';
	import { MAX_NUDGES, MAX_UNSUBSCRIBE, type UnsubscribeVerdict } from '#lib/ai/models/nudges.js';
	import { getAIService, type InboxNudges } from '#lib/ai/service.svelte.js';
	import { getMailboxStore } from '#lib/stores/mailbox.svelte.js';
	import { getSessionStore } from '#lib/stores/session.svelte.js';
	import { getUiStore } from '#lib/stores/ui.svelte.js';
	import { dismiss, followUpKey, loadDismissed, unsubscribeKey } from './dismissed.js';

	const LABEL = 'Suggestions';
	const FOLLOW_UP = 'Follow up';
	const UNSUBSCRIBE = 'Unsubscribe';
	const KEEP = 'Keep';
	const DISMISS = 'Dismiss';

	const ai = getAIService();
	const session = getSessionStore();
	const mailbox = getMailboxStore();
	const ui = getUiStore();
	const storage = typeof localStorage === 'undefined' ? undefined : localStorage;

	let nudges = $state<InboxNudges | null>(null);
	let dismissed = $state<string[]>([]);

	// Once per account; the rows are extras, so a failure only hides them.
	$effect(() => {
		const user = session.user;
		nudges = null;
		if (!user) return;
		dismissed = loadDismissed(storage, user.id);
		let isCurrent = true;
		ai.inboxNudges(user).then(
			(result) => {
				if (isCurrent) nudges = result;
			},
			(error: unknown) => console.error('Inbox nudges failed', error)
		);
		return () => (isCurrent = false);
	});

	const followUps = $derived(
		(nudges?.followUps ?? [])
			.filter((n) => !dismissed.includes(followUpKey(n.value.messageId)))
			.slice(0, MAX_NUDGES)
	);
	const unsubscribe = $derived(
		(nudges?.unsubscribe ?? [])
			.filter((s) => !dismissed.includes(unsubscribeKey(s.value.email)))
			.slice(0, MAX_UNSUBSCRIBE)
	);

	function hide(key: string): void {
		const userId = session.user?.id;
		if (userId) dismissed = dismiss(storage, userId, dismissed, key);
	}

	/** Demo unsubscribe: archives their inbox mail (with Undo) and stops suggesting them. */
	function unsubscribeFrom(suggestion: UnsubscribeVerdict): void {
		hide(unsubscribeKey(suggestion.value.email));
		void mailbox.apply(suggestion.value.inboxThreadIds, { op: 'archive' });
	}

	const daysText = (days: number) => `Sent ${days} day${days === 1 ? '' : 's'} ago, no reply.`;
</script>

{#if followUps.length > 0 || unsubscribe.length > 0}
	<!-- AI-9 and AI-12: rows above the inbox; each can be acted on or dismissed. -->
	<section class="nudges" aria-label={LABEL} aria-live="polite">
		<ul class="nudges__list">
			{#each followUps as nudge (nudge.value.messageId)}
				<li class="nudge">
					<Icon icon={Reply} size="md" class="nudge__icon" />
					<div class="nudge__text">
						<p class="nudge__title nm-text-body">{daysText(nudge.value.days)} Follow up?</p>
						<p class="nudge__detail nm-text-caption">
							{nudge.value.subject} · To {nudge.value.to}
						</p>
					</div>
					<AIBadge insight={nudge} />
					<div class="nudge__actions">
						<Button
							variant="ghost"
							size="sm"
							onclick={() =>
								ui.openCompose({
									mode: 'reply',
									threadId: nudge.value.threadId,
									messageId: nudge.value.messageId
								})}>{FOLLOW_UP}</Button
						>
						<IconButton
							icon={X}
							label={`${DISMISS}: ${nudge.value.subject}`}
							size="sm"
							onclick={() => hide(followUpKey(nudge.value.messageId))}
						/>
					</div>
				</li>
			{/each}
			{#each unsubscribe as suggestion (suggestion.value.email)}
				<li class="nudge">
					<Icon icon={MailMinus} size="md" class="nudge__icon" />
					<div class="nudge__text">
						<p class="nudge__title nm-text-body">
							You opened {suggestion.value.opened} of {suggestion.value.total} emails from {suggestion
								.value.name}. Unsubscribe?
						</p>
						{#if suggestion.value.inboxThreadIds.length > 0}
							<p class="nudge__detail nm-text-caption">
								Also archives their {suggestion.value.inboxThreadIds.length} in Inbox.
							</p>
						{/if}
					</div>
					<AIBadge insight={suggestion} />
					<div class="nudge__actions">
						<Button variant="ghost" size="sm" onclick={() => unsubscribeFrom(suggestion)}
							>{UNSUBSCRIBE}</Button
						>
						<Button
							variant="ghost"
							size="sm"
							onclick={() => hide(unsubscribeKey(suggestion.value.email))}>{KEEP}</Button
						>
					</div>
				</li>
			{/each}
		</ul>
	</section>
{/if}

<style>
	.nudges {
		padding-inline: var(--nm-space-4);
		padding-block: var(--nm-space-2);
	}
	.nudges__list {
		display: grid;
		gap: var(--nm-space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.nudge {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: var(--nm-space-2) var(--nm-space-3);
		padding: var(--nm-space-3);
		border: 1px solid var(--nm-color-border);
		border-radius: var(--nm-radius-lg);
		background: var(--nm-color-surface-1);
	}
	.nudge :global(.nudge__icon) {
		color: var(--nm-color-accent);
	}
	.nudge__text {
		min-width: 0;
	}
	.nudge__title,
	.nudge__detail {
		margin: 0;
	}
	.nudge__detail {
		overflow: hidden;
		color: var(--nm-color-text-muted);
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.nudge__actions {
		display: flex;
		grid-column: 2 / -1;
		justify-content: flex-end;
		gap: var(--nm-space-2);
	}
</style>
