<script lang="ts">
	import Mail from '@lucide/svelte/icons/mail';
	import Checkbox from '#components/ui/Checkbox.svelte';
	import Icon from '#components/ui/Icon.svelte';
	import Radio from '#components/ui/Radio.svelte';
	import SearchField from '#components/ui/SearchField.svelte';
	import SegmentedControl from '#components/ui/SegmentedControl.svelte';
	import TextField from '#components/ui/TextField.svelte';
	import Toggle from '#components/ui/Toggle.svelte';
	import GallerySection from './GallerySection.svelte';

	type Density = 'compact' | 'default' | 'comfy';
	const DENSITIES = [
		{ value: 'compact', label: 'Compact' },
		{ value: 'default', label: 'Default' },
		{ value: 'comfy', label: 'Comfy' }
	] satisfies { value: Density; label: string }[];

	let email = $state('');
	let query = $state('from:ada');
	let isSmartReplyOn = $state(true);
	let isChecked = $state(true);
	let reply = $state('reply');
	let density = $state<Density>('default');
</script>

<GallerySection title="Text inputs">
	<div class="gallery-block">
		<TextField label="Email" bind:value={email} hint="We never share it." type="email">
			{#snippet leading()}<Icon icon={Mail} />{/snippet}
		</TextField>
	</div>
	<div class="gallery-block">
		<TextField label="Subject" value="Re:" error="Subject is too short." />
	</div>
	<div class="gallery-block">
		<SearchField label="Search mail" bind:value={query} />
	</div>
</GallerySection>

<GallerySection title="Choices">
	<div class="gallery-block">
		<Toggle
			label="Smart reply"
			description="Suggest short replies under each message."
			bind:checked={isSmartReplyOn}
		/>
	</div>
	<Checkbox label="Select all" bind:checked={isChecked} />
	<Checkbox label="Some selected" indeterminate />
	<Radio label="Reply" name="default-reply" value="reply" bind:group={reply} />
	<Radio label="Reply all" name="default-reply" value="reply-all" bind:group={reply} />
	<div class="gallery-block">
		<SegmentedControl
			label="Density"
			options={DENSITIES}
			value={density}
			onchange={(next) => (density = next)}
		/>
	</div>
</GallerySection>
