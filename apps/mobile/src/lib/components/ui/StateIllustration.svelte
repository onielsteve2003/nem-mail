<script lang="ts" module>
	export type StateIllustrationName = 'inbox' | 'done' | 'search' | 'folder' | 'error' | 'offline';
</script>

<script lang="ts">
	interface Props {
		name: StateIllustrationName;
	}

	let { name }: Props = $props();

	const gradientId = $props.id();
</script>

<!-- Decorative: the title and message next to it carry the meaning. -->
<svg class="art" viewBox="0 0 160 120" fill="none" aria-hidden="true">
	<defs>
		<linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
			<stop offset="0" class="stop-a" />
			<stop offset="1" class="stop-b" />
		</linearGradient>
	</defs>
	<ellipse class="glow" cx="80" cy="64" rx="64" ry="44" fill="url(#{gradientId})" />

	{#if name === 'inbox'}
		<path class="shape" d="M40 58 52 34h56l12 24v28a6 6 0 0 1-6 6H46a6 6 0 0 1-6-6Z" />
		<path class="line" d="M40 58h22l6 10h24l6-10h22" />
	{:else if name === 'done'}
		<circle class="shape" cx="80" cy="62" r="30" />
		<path class="accent" d="m66 62 10 10 20-20" />
		<path class="spark" d="M124 30v10M119 35h10M36 84v8M32 88h8" />
	{:else if name === 'search'}
		<circle class="shape" cx="72" cy="56" r="24" />
		<path class="accent" d="m90 74 20 20" />
		<path class="line" d="M64 56h16" />
	{:else if name === 'folder'}
		<path
			class="shape"
			d="M38 42a6 6 0 0 1 6-6h22l8 8h42a6 6 0 0 1 6 6v36a6 6 0 0 1-6 6H44a6 6 0 0 1-6-6Z"
		/>
		<path class="line" d="M38 54h84" />
	{:else if name === 'error'}
		<path class="shape" d="M80 30 114 90H46Z" />
		<path class="accent" d="M80 52v18M80 78v1" />
	{:else}
		<path class="shape" d="M50 82a18 18 0 0 1 2-36 26 26 0 0 1 50 4 16 16 0 0 1 4 32Z" />
		<path class="accent" d="m44 34 72 60" />
	{/if}
</svg>

<style>
	.art {
		inline-size: min(10rem, 60%);
		block-size: auto;
	}
	.stop-a {
		stop-color: var(--nm-color-violet);
		stop-opacity: 0.35;
	}
	.stop-b {
		stop-color: var(--nm-color-cyan);
		stop-opacity: 0.15;
	}
	.shape {
		fill: var(--nm-color-surface-2);
		stroke: var(--nm-color-border-strong);
		stroke-width: 3;
		stroke-linejoin: round;
	}
	.line,
	.accent,
	.spark {
		stroke-width: 4;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.line {
		stroke: var(--nm-color-text-subtle);
	}
	.accent {
		stroke: var(--nm-color-accent-text);
	}
	.spark {
		stroke: var(--nm-color-lime-text);
	}
</style>
