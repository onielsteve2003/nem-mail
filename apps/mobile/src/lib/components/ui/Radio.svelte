<script lang="ts" generics="T">
	import type { HTMLInputAttributes } from 'svelte/elements';

	interface Props extends Omit<HTMLInputAttributes, 'value' | 'class' | 'type'> {
		label: string;
		/** Shared by every radio in the group, so arrow keys move between them. */
		name: string;
		value: T;
		/** The selected value of the group. Bind the same variable on every radio. */
		group?: T;
		class?: string;
	}

	let { label, name, value, group = $bindable(), class: className, ...rest }: Props = $props();
</script>

<label class={['radio', { 'radio--disabled': rest.disabled }, className]}>
	<input {...rest} type="radio" class="nm-visually-hidden" {name} {value} bind:group />
	<span class="radio__dot" aria-hidden="true"></span>
	<span class="radio__label">{label}</span>
</label>

<style>
	.radio {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: var(--nm-space-4);
		min-block-size: var(--nm-size-touch);
		color: var(--nm-color-text);
		font-family: var(--nm-font-body);
		font-size: var(--nm-text-body);
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}
	.radio--disabled {
		cursor: not-allowed;
		opacity: 0.45;
	}

	.radio__dot {
		display: inline-grid;
		place-items: center;
		flex-shrink: 0;
		inline-size: var(--nm-size-icon-lg);
		block-size: var(--nm-size-icon-lg);
		border: 2px solid var(--nm-color-text-muted);
		border-radius: var(--nm-radius-round);
		transition: border-color var(--nm-duration-fast) var(--nm-ease-standard);
	}
	.radio__dot::after {
		content: '';
		inline-size: 50%;
		block-size: 50%;
		border-radius: var(--nm-radius-round);
		background: var(--nm-color-accent-text);
		transform: scale(0);
		transition: transform var(--nm-duration-base) var(--nm-ease-spring);
	}
	input:checked + .radio__dot {
		border-color: var(--nm-color-accent-text);
	}
	input:checked + .radio__dot::after {
		transform: scale(1);
	}
	input:focus-visible + .radio__dot {
		outline: 2px solid var(--nm-color-focus);
		outline-offset: 2px;
	}
</style>
