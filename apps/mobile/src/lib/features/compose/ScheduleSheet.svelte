<script lang="ts">
	import TimeSheet from '#components/ui/TimeSheet.svelte';
	import { schedulePresets } from './schedule.js';

	const TITLE = 'Schedule send';

	interface Props {
		open?: boolean;
		/** Reference time for presets and validation; tests pin it. */
		now?: () => Date;
		onschedule: (at: Date) => void;
		onclose?: () => void;
	}

	let { open = $bindable(false), now, onschedule, onclose }: Props = $props();
</script>

<TimeSheet
	bind:open
	title={TITLE}
	presets={schedulePresets}
	confirmLabel={TITLE}
	{now}
	onpick={onschedule}
	{onclose}
/>
