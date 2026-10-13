<script lang="ts">
	import { DEFAULT_SETTINGS, type Settings } from '@nem/shared';
	import { resolve } from '$app/paths';
	import SectionHeader from '#components/ui/SectionHeader.svelte';
	import SegmentedControl from '#components/ui/SegmentedControl.svelte';
	import Toggle from '#components/ui/Toggle.svelte';
	import { getRepositories } from '#lib/data/provider.js';
	import { DENSITY_OPTIONS, REPLY_OPTIONS, THEME_OPTIONS } from '#features/settings/general.js';
	import SettingsScreen from '#features/settings/SettingsScreen.svelte';
	import { getThemeStore } from '#lib/stores/theme.svelte.js';
	import { toastStore } from '#lib/stores/toast.svelte.js';
	import { errorMessage } from '#lib/utils/errors.js';

	const COPY = {
		title: 'General',
		appearance: 'Appearance',
		theme: 'Theme',
		density: 'List density',
		replying: 'Replying',
		defaultReply: 'Default reply',
		confirm: 'Confirm before',
		delete: 'Deleting',
		deleteHint: 'Ask before a conversation is deleted forever',
		archive: 'Archiving',
		archiveHint: 'Ask before a conversation is archived',
		send: 'Sending',
		sendHint: 'Ask before a message is sent',
		saveFailed: 'Could not save settings.'
	};

	const repos = getRepositories();
	const theme = getThemeStore();

	// The theme store is the source of truth for theme, so it paints before settings load.
	let settings = $state<Settings>({
		...structuredClone(DEFAULT_SETTINGS),
		theme: theme.preference
	});

	repos.settings.get().then(
		(saved) => (settings = { ...saved, theme: theme.preference }),
		() => {
			// Defaults stay on screen; the first change saves them.
		}
	);

	/** Applies a change on screen at once, then saves; a failed save rolls back. */
	async function update(patch: Partial<Settings>): Promise<void> {
		const before = settings;
		settings = { ...settings, ...patch };
		if (patch.theme) theme.setPreference(patch.theme);
		try {
			settings = await repos.settings.save($state.snapshot(settings));
		} catch (error) {
			settings = before;
			if (patch.theme) theme.setPreference(before.theme);
			toastStore.show({ message: errorMessage(error, COPY.saveFailed), tone: 'error' });
		}
	}

	function setConfirm(key: keyof Settings['confirm'], value: boolean): void {
		void update({ confirm: { ...settings.confirm, [key]: value } });
	}
</script>

<SettingsScreen title={COPY.title} fallbackHref={resolve('/settings')}>
	<section class="group" aria-labelledby="appearance">
		<SectionHeader id="appearance" title={COPY.appearance} />
		<div class="field">
			<span class="field__label nm-text-caption">{COPY.theme}</span>
			<SegmentedControl
				label={COPY.theme}
				options={THEME_OPTIONS}
				value={settings.theme}
				onchange={(value) => void update({ theme: value })}
			/>
		</div>
		<div class="field">
			<span class="field__label nm-text-caption">{COPY.density}</span>
			<SegmentedControl
				label={COPY.density}
				options={DENSITY_OPTIONS}
				value={settings.density}
				onchange={(value) => void update({ density: value })}
			/>
		</div>
	</section>

	<section class="group" aria-labelledby="replying">
		<SectionHeader id="replying" title={COPY.replying} />
		<div class="field">
			<span class="field__label nm-text-caption">{COPY.defaultReply}</span>
			<SegmentedControl
				label={COPY.defaultReply}
				options={REPLY_OPTIONS}
				value={settings.defaultReply}
				onchange={(value) => void update({ defaultReply: value })}
			/>
		</div>
	</section>

	<section class="group" aria-labelledby="confirm">
		<SectionHeader id="confirm" title={COPY.confirm} />
		<Toggle
			label={COPY.delete}
			description={COPY.deleteHint}
			checked={settings.confirm.delete}
			onchange={(event) => setConfirm('delete', event.currentTarget.checked)}
		/>
		<Toggle
			label={COPY.archive}
			description={COPY.archiveHint}
			checked={settings.confirm.archive}
			onchange={(event) => setConfirm('archive', event.currentTarget.checked)}
		/>
		<Toggle
			label={COPY.send}
			description={COPY.sendHint}
			checked={settings.confirm.send}
			onchange={(event) => setConfirm('send', event.currentTarget.checked)}
		/>
	</section>
</SettingsScreen>

<style>
	.group {
		display: grid;
		gap: var(--nm-space-3);
		padding: var(--nm-space-3) var(--nm-space-4);
	}
	.field {
		display: grid;
		gap: var(--nm-space-2);
	}
	.field__label {
		color: var(--nm-color-text-muted);
	}
</style>
