<script lang="ts">
	import { resolve } from '$app/paths';
	import LabelManager from '#features/organize/LabelManager.svelte';
	import SettingsScreen from '#features/settings/SettingsScreen.svelte';

	const TITLE = 'Labels';
</script>

<SettingsScreen
	title={TITLE}
	fallbackHref={resolve('/mail/(list)/[mailbox]', { mailbox: 'inbox' })}
>
	<LabelManager />
</SettingsScreen>
