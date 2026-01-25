# Native Share Setup for Instagram Recipe Import

This document explains how to configure native sharing from Instagram to the app.

## How It Works

When a user shares an Instagram post/reel to this app:
1. The app receives the shared URL via deep linking
2. The `useShareHandler` hook detects the Instagram URL
3. The Instagram Recipe Import dialog automatically opens with the URL pre-filled
4. The recipe is parsed and ready for the user to review and log

## Android Setup

After running `npx cap add android`, add the following intent filter to your `AndroidManifest.xml` inside the `<activity>` tag:

```xml
<!-- Add inside android/app/src/main/AndroidManifest.xml -->
<activity ...>
    <!-- Existing intent filters ... -->
    
    <!-- Share intent filter for receiving shared text/URLs -->
    <intent-filter>
        <action android:name="android.intent.action.SEND" />
        <category android:name="android.intent.category.DEFAULT" />
        <data android:mimeType="text/plain" />
    </intent-filter>
    
    <!-- Deep link intent filter for app links -->
    <intent-filter android:autoVerify="true">
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.BROWSABLE" />
        <data android:scheme="cjtnutrition" />
    </intent-filter>
</activity>
```

## iOS Setup

After running `npx cap add ios`:

1. Open the project in Xcode: `npx cap open ios`

2. Add Share Extension:
   - File → New → Target → Share Extension
   - Name it "ShareExtension"
   - Configure it to handle URLs

3. In `Info.plist`, add URL schemes:
```xml
<key>CFBundleURLTypes</key>
<array>
    <dict>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>cjtnutrition</string>
        </array>
    </dict>
</array>
```

4. Enable Associated Domains for app links (optional, for https:// links)

## Testing

1. Build and install the app on your device
2. Open Instagram and find a recipe post
3. Tap the Share button on the post
4. Select your app from the share sheet
5. The app should open with the recipe import dialog

## PWA Share Target (Web)

The app also supports the Web Share Target API for progressive web apps:
- When installed as a PWA, the app appears in the system share sheet
- Shared URLs containing Instagram links will auto-open the import dialog

## Supported URL Formats

The app recognizes these Instagram URL patterns:
- `https://instagram.com/p/ABC123/` (posts)
- `https://www.instagram.com/p/ABC123/` (posts with www)
- `https://instagram.com/reel/ABC123/` (reels)
- `https://instagram.com/reels/ABC123/` (reels alternate)
