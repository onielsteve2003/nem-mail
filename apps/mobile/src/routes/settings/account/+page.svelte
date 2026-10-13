<script lang="ts">
	import { SIGNATURE_MAX, type Settings } from '@nem/shared';
	import { resolve } from '$app/paths';
	import SectionHeader from '#components/ui/SectionHeader.svelte';
	import Toggle from '#components/ui/Toggle.svelte';
	import { getRepositories } from '#lib/data/provider.js';
	import { SettingsEditor } from '#features/settings/editor.svelte.js';
	import SettingsScreen from '#features/settings/SettingsScreen.svelte';
	import TextArea from '#features/settings/TextArea.svelte';
	import VacationForm from '#features/settings/VacationForm.svelte';

	const COPY = {
		title: 'Account',
		signature: 'Signature',
		signatureLabel: 'Signature text',
		signatureHint: (used: number) =>
			`Added below new messages and replies. ${used} / ${SIGNATURE_MAX}`,
		vacation: 'Vacation responder',
		notifications: 'Notifications',
		newMail: 'New mail',
		newMailHint: 'Alerts on this device when mail arrives',
		blocked: 'This browser blocks notifications for Nem Mail, so alerts show inside the app only.',
		unsupported: 'This browser has no notifications, so alerts show inside the app only.'
	};

	const editor = new SettingsEditor(getRepositories().settings);
	const settings = $derived(editor.settings);
	let isLoaded = $state(false);
	void editor.load().then(() => (isLoaded = true));

	// The draft follows saved settings and saves on change (blur), not on every key.
	let signature = $derived(settings.signature);

	const hasNotifications = typeof Notification !== 'undefined';
	let permission = $state<NotificationPermission | 'unsupported'>(
		hasNotifications ? Notification.permission : 'unsupported'
	);

	const update = (patch: Partial<Settings>) => void editor.update(patch);

	async function setNewMail(isOn: boolean): Promise<void> {
		update({ notifications: { ...settings.notifications, newMail: isOn } });
		// Ask only when turned on, so the browser prompt follows a clear user action.
		if (isOn && hasNotifications && Notification.permission === 'default') {
			permission = await Notification.requestPermission();
		}
	}
</script>

<SettingsScreen title={COPY.title} fallbackHref={resolve('/settings')}>
	<section class="group" aria-labelledby="signature">
		<SectionHeader id="signature" title={COPY.signature} />
		<TextArea
			label={COPY.signatureLabel}
			hint={COPY.signatureHint(signature.length)}
			maxlength={SIGNATURE_MAX}
			disabled={!isLoaded}
			bind:value={signature}
			onchange={() => update({ signature })}
		/>
	</section>

	<section class="group" aria-labelledby="vacation">
		<SectionHeader id="vacation" title={COPY.vacation} />
		<VacationForm
			vacation={settings.vacation}
			disabled={!isLoaded}
			onsave={(vacation) => update({ vacation })}
		/>
	</section>

	<section class="group" aria-labelledby="notifications">
		<SectionHeader id="notifications" title={COPY.notifications} />
		<Toggle
			label={COPY.newMail}
			description={COPY.newMailHint}
			checked={settings.notifications.newMail}
			disabled={!isLoaded}
			onchange={(event) => void setNewMail(event.currentTarget.checked)}
		/>
		{#if settings.notifications.newMail && (permission === 'denied' || permission === 'unsupported')}
			<p class="note nm-text-caption">
				{permission === 'denied' ? COPY.blocked : COPY.unsupported}
			</p>
		{/if}
	</section>
</SettingsScreen>

<style>
	.group {
		display: grid;
		gap: var(--nm-space-3);
		padding: var(--nm-space-3) var(--nm-space-4);
	}
	.note {
		margin: 0;
		color: var(--nm-color-text-muted);
	}
</style>
