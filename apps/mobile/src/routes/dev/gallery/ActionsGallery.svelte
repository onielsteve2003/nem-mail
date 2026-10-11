<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import Star from '@lucide/svelte/icons/star';
	import Tag from '@lucide/svelte/icons/tag';
	import AIBadge from '#components/ui/AIBadge.svelte';
	import Avatar from '#components/ui/Avatar.svelte';
	import AvatarStack from '#components/ui/AvatarStack.svelte';
	import Badge from '#components/ui/Badge.svelte';
	import Button, { type ButtonVariant } from '#components/ui/Button.svelte';
	import Chip from '#components/ui/Chip.svelte';
	import Icon from '#components/ui/Icon.svelte';
	import IconButton from '#components/ui/IconButton.svelte';
	import LabelPill, { LABEL_COLORS } from '#components/ui/LabelPill.svelte';
	import GallerySection from './GallerySection.svelte';

	const VARIANTS: ButtonVariant[] = ['primary', 'ghost', 'glass', 'danger'];
	const PEOPLE = ['Ada Lovelace', 'Grace Hopper', 'Alan Turing', 'Katherine Johnson', 'Linus T'];

	let isChipSelected = $state(true);
	let isAvatarSelected = $state(false);
	let chips = $state(['Work', 'Travel']);
</script>

<GallerySection title="Icons">
	<Icon icon={Star} size="sm" />
	<Icon icon={Star} size="md" />
	<Icon icon={Star} size="lg" />
	<Icon icon={Star} size="xl" label="Starred" />
</GallerySection>

<GallerySection title="Buttons">
	{#each VARIANTS as variant (variant)}
		<Button {variant}>{variant}</Button>
	{/each}
	<Button size="sm">Small</Button>
	<Button size="lg">
		{#snippet leading()}<Icon icon={Plus} />{/snippet}
		Large
	</Button>
	<Button loading>Saving</Button>
	<Button disabled>Disabled</Button>
	<IconButton icon={Star} label="Star" />
	<IconButton icon={Tag} label="Label" variant="glass" />
</GallerySection>

<GallerySection title="Avatars">
	<Avatar name="Ada Lovelace" size="sm" />
	<Avatar name="Grace Hopper" />
	<Avatar name="Alan Turing" size="lg" />
	<Avatar
		name="Katherine Johnson"
		selected={isAvatarSelected}
		onclick={() => (isAvatarSelected = !isAvatarSelected)}
	/>
	<AvatarStack people={PEOPLE.map((name) => ({ name }))} max={3} />
</GallerySection>

<GallerySection title="Chips and badges">
	<Chip selected={isChipSelected} onclick={() => (isChipSelected = !isChipSelected)}>Unread</Chip>
	{#each chips as chip (chip)}
		<Chip onremove={() => (chips = chips.filter((c) => c !== chip))}>{chip}</Chip>
	{/each}
	<Chip disabled>Disabled</Chip>
	<Badge count={3} label="3 unread" />
	<Badge count={120} tone="danger" label="120 unread" />
	<Badge dot tone="neutral" label="New" />
	{#each LABEL_COLORS as color (color)}
		<LabelPill name={color} {color} />
	{/each}
	<AIBadge />
	<AIBadge>
		{#snippet explanation()}Flagged as spam: 92% confidence.{/snippet}
	</AIBadge>
</GallerySection>
