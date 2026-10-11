<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	interface Props extends Omit<HTMLInputAttributes, 'checked' | 'class' | 'type' | 'role'> {
		label: string;
		/** Secondary line under the label, e.g. what the setting does. */
		description?: string;
		checked?: boolean;
		class?: string;
	}

	let {
		label,
		description,
		checked = $bindable(false),
		class: className,
		...rest
	}: Props = $props();

	const id = $props.id();
</script>

<label class={['toggle', { 'toggle--disabled': rest.disabled }, className]}>
	<span class="toggle__text">
		<span class="toggle__label" id="{id}-label">{label}</span>
		{#if description}<span class="toggle__description" id="{id}-desc">{description}</span>{/if}
	</span>
	<input
		{...rest}
		type="checkbox"
		role="switch"
		class="nm-visually-hidden"
		bind:checked
		aria-labelledby="{id}-label"
		aria-describedby={description ? `${id}-desc` : undefined}
	/>
	<span class="toggle__track" aria-hidden="true"><span class="toggle__thumb"></span></span>
</label>

<style>
	.toggle {
		--toggle-width: 3.25rem;
		--toggle-height: 2rem;
		--toggle-gap: 0.25rem;
		--toggle-thumb: calc(var(--toggle-height) - var(--toggle-gap) * 2);
		position: relative;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--nm-space-5);
		min-block-size: var(--nm-size-touch);
		font-family: var(--nm-font-body);
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}
	.toggle--disabled {
		cursor: not-allowed;
		opacity: 0.45;
	}

	.toggle__text {
		display: grid;
		gap: var(--nm-space-1);
	}
	.toggle__label {
		color: var(--nm-color-text);
		font-size: var(--nm-text-body);
	}
	.toggle__description {
		color: var(--nm-color-text-muted);
		font-size: var(--nm-text-caption);
	}

	.toggle__track {
		position: relative;
		flex-shrink: 0;
		inline-size: var(--toggle-width);
		block-size: var(--toggle-height);
		border: 1px solid var(--nm-color-border-strong);
		border-radius: var(--nm-radius-pill);
		background: var(--nm-color-surface-3);
		transition: background-color var(--nm-duration-base) var(--nm-ease-standard);
	}
	.toggle__thumb {
		position: absolute;
		inset-block-start: calc(var(--toggle-gap) - 1px);
		inset-inline-start: calc(var(--toggle-gap) - 1px);
		inline-size: var(--toggle-thumb);
		block-size: var(--toggle-thumb);
		border-radius: var(--nm-radius-round);
		background: var(--nm-color-text-muted);
		box-shadow: var(--nm-shadow-1);
		transition:
			transform var(--nm-duration-base) var(--nm-ease-spring),
			background-color var(--nm-duration-base) var(--nm-ease-standard);
	}

	input:checked + .toggle__track {
		border-color: transparent;
		background: var(--nm-color-accent);
	}
	input:checked + .toggle__track .toggle__thumb {
		background: var(--nm-color-on-accent);
		transform: translateX(calc(var(--toggle-width) - var(--toggle-thumb) - var(--toggle-gap) * 2));
	}
	:global([dir='rtl']) input:checked + .toggle__track .toggle__thumb {
		transform: translateX(
			calc((var(--toggle-width) - var(--toggle-thumb) - var(--toggle-gap) * 2) * -1)
		);
	}

	/* The input is hidden, so its keyboard focus ring goes on the track. */
	input:focus-visible + .toggle__track {
		outline: 2px solid var(--nm-color-focus);
		outline-offset: 2px;
	}
</style>
