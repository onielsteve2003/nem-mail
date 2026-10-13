<script lang="ts">
	import type { Settings } from '@nem/shared';
	import { resolve } from '$app/paths';
	import SectionHeader from '#components/ui/SectionHeader.svelte';
	import SegmentedControl from '#components/ui/SegmentedControl.svelte';
	import Toggle from '#components/ui/Toggle.svelte';
	import { getRepositories } from '#lib/data/provider.js';
	import { DENSITY_OPTIONS, REPLY_OPTIONS, THEME_OPTIONS } from '#features/settings/general.js';
	import { SettingsEditor } from '#features/settings/editor.svelte.js';
	import SettingsScreen from '#features/settings/SettingsScreen.svelte';
	import { getThemeStore } from '#lib/stores/theme.svelte.js';

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
		sendHint: 'Ask before a message is sent'
	};

	const theme = getThemeStore();
	const editor = new SettingsEditor(getRepositories().settings, (next) =>
		theme.setPreference(next.theme)
	);
	const update = (patch: Partial<Settings>) => editor.update(patch);
	const settings = $derived(editor.settings);

	// The theme store is the source of truth for theme; it paints before settings load.
	void editor.load({ theme: theme.preference });

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
