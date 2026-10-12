/** One onboarding slide (F1 step 2). */
export interface OnboardingSlide {
	id: 'inbox' | 'ai' | 'gestures';
	title: string;
	body: string;
}

export const ONBOARDING_SLIDES: readonly OnboardingSlide[] = [
	{
		id: 'inbox',
		title: 'An inbox that keeps calm',
		body: 'Tabs, priority and quick triage keep what matters at the top.'
	},
	{
		id: 'ai',
		title: 'AI that stays on your phone',
		body: 'Summaries, smart replies and spam filtering run on your device. Turn any of it off.'
	},
	{
		id: 'gestures',
		title: 'Triage with a swipe',
		body: 'Swipe to archive or snooze, long-press to select, pull down to refresh.'
	}
];
