# Running Nem Mail on an iPhone

There are two ways: the web app (any computer, no Mac) and the native app (needs a Mac).

## 1. Web app (no Mac needed)

1. On the iPhone, open [nem-mail.vercel.app](https://nem-mail.vercel.app) in **Safari**.
2. Tap **Share**, then **Add to Home Screen**, then **Add**.
3. Open **Nem Mail** from the Home Screen. It runs full screen with the Aurora icon and launch screen, and works offline after the first visit.

Requires iOS 16.4 or later for the full PWA (notifications from a Home Screen app). iOS 16.0 runs everything else.

## 2. Native app (needs macOS + Xcode)

The Xcode project is committed in `apps/mobile/ios/`. It uses Swift Package Manager, so there is no CocoaPods step.

**You need:** a Mac with Xcode 26 or later, Node 22, and a free Apple ID (Xcode > Settings > Accounts).

```bash
git clone https://github.com/onielsteve2003/nem-mail.git
cd nem-mail
npm ci
cd apps/mobile
npm run cap:sync      # builds the web app and copies it into ios/ and android/
npx cap open ios      # opens App.xcodeproj in Xcode
```

In Xcode:

1. Select the **App** target > **Signing & Capabilities**, tick **Automatically manage signing** and pick your Apple ID team.
2. If the bundle id `com.onahstephen.nemmail` is taken for your team, change it to something unique (for example add your initials).
3. Plug in the iPhone, pick it as the run destination and press **Run**. Or pick a simulator.
4. First run on a phone: on the iPhone open **Settings > General > VPN & Device Management**, trust your developer certificate, and turn on **Developer Mode** (Settings > Privacy & Security) when asked.

With a free Apple ID the app stays installed for 7 days, then run it from Xcode again.

After changing web code, run `npm run cap:sync` again and rebuild in Xcode.

## 3. No Mac: cloud Mac options

- **GitHub Actions (free on this public repo):** `.github/workflows/ios.yml` builds the app for the simulator on a macOS runner on every push that touches `apps/mobile/ios/`, and can be started by hand from the Actions tab (**iOS build > Run workflow**). This proves the project compiles. It cannot install on a phone, because that needs signing.
- **Rented cloud Mac** (for example MacinCloud or AWS EC2 Mac): follow section 2 over remote desktop. These are paid, so they are not part of the project's free setup.
- **Installing on a phone without a Mac** needs a paid Apple Developer account (TestFlight). Not used in Phase 1; the web app covers iPhone testing.

## What is configured

| Setting              | Value                                                                           | Where                                            |
| -------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------ |
| App name / bundle id | Nem Mail / `com.onahstephen.nemmail`                                            | `capacitor.config.ts`, Xcode target              |
| Minimum iOS          | 15.0 (Capacitor 8 minimum)                                                      | Xcode project                                    |
| App icon             | Aurora "N", 1024 px, opaque                                                     | `ios/App/App/Assets.xcassets/AppIcon.appiconset` |
| Launch screen        | Aurora Noir background with a small "N"                                         | `Assets.xcassets/Splash.imageset`                |
| Status bar           | Draws under the web view, icons follow the theme                                | `StatusBar` plugin, `lib/utils/status-bar.ts`    |
| Camera prompt        | "Take a photo to attach to an email." (the attachment picker offers the camera) | `Info.plist`                                     |
| Export compliance    | No non-exempt encryption                                                        | `Info.plist`                                     |
| Plugins              | App, Haptics, Keyboard, Local Notifications, Share, Splash Screen, Status Bar   | `ios/App/CapApp-SPM/Package.swift` (generated)   |
