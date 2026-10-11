<script lang="ts">
	import type { LucideIcon } from '@lucide/svelte';
	import type { ComponentProps } from 'svelte';
	import Button from './Button.svelte';
	import Icon from './Icon.svelte';

	type ButtonProps = Omit<
		ComponentProps<typeof Button>,
		'iconOnly' | 'leading' | 'trailing' | 'children' | 'aria-label'
	>;

	interface Props extends ButtonProps {
		icon: LucideIcon;
		/** Required: an icon-only button has no visible text. */
		label: string;
	}

	let { icon, label, variant = 'ghost', size = 'md', ...rest }: Props = $props();
</script>

<Button {...rest} {variant} {size} iconOnly aria-label={label}>
	{#snippet leading()}
		<Icon {icon} size={size === 'lg' ? 'lg' : 'md'} />
	{/snippet}
</Button>
