import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
	appId: 'com.onahstephen.nemmail',
	appName: 'Nem Mail',
	// The adapter-static SPA output; run `npm run build` before `npx cap sync`.
	webDir: 'build'
};

export default config;
