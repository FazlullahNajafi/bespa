# Setting up the map

> **Not done, on purpose — decided 2026-11-05.** A Google Maps key needs a billing
> account on the Cloud project, and this project has none. `react-native-maps` was
> installed, wired and then removed, so the app ships no map code at all.
>
> This file is kept as the instructions for reversing that if billing ever appears. None
> of it is a pending task.
>
> **What the app does instead.** The Places list, search, category chips, distances,
> Directions and the 150 m duplicate check all work without a map. The one real loss is
> spec 03.2 step 5: a place can only be added from where you are standing, because "use
> my current location" is the only way left to set a coordinate.
>
> **If the pin-drop turns out to matter**, there is a key-free route — OpenStreetMap
> raster tiles rendered by Leaflet inside a WebView, no account and no card. It is more
> work than this page and it is not built.

If you do turn billing on, the steps below take about twenty minutes, in four parts, and
end with `react-native-maps` being reinstalled:

```bash
npx expo install react-native-maps
git show 1a1e7a2 -- src/components/place-map.tsx | git apply
```

That restores the map component as it was written and tested; the two screens then need
their toggle and `PinPicker` put back, which `git show 1a1e7a2 -- src/app/places/` shows.

---

## Why it is not just pasted into the code

The EAS project id and the Sentry slugs *are* written straight into `app.config.ts`. This
one is not, and the difference is money.

A Google Maps key is billable. If it leaks out of a public repository, somebody else's map
loads come off your quota and eventually your card. The protection is a **restriction**:
the key only works for requests coming from an app with a specific package name, signed
with a specific certificate. That makes the key safe to ship inside the APK — which is
necessary, because the map has to work on a phone with no server to ask.

So: create the key, restrict it, then give it to EAS as an environment variable rather
than committing it.

---

# Part 1 — Google Cloud console

Your Firebase project `bespa-b215b` is also a Google Cloud project, automatically. You do
not need to create anything new.

### 1. Open the right project

Go to **https://console.cloud.google.com**.

At the top of the page there is a project name in a dropdown. Click it and choose
**bespa-b215b**. If you do not see it, type `bespa` in the search box of that dialog.

Check the top of the page says `bespa-b215b` before going on. Everything below applies to
whichever project is selected, and doing it in the wrong one is the most common way to
lose an afternoon here.

### 2. Turn on Maps SDK for Android

In the search bar at the very top, type **Maps SDK for Android** and open the result (it
will be under "Marketplace" or "APIs & Services").

Press the blue **Enable** button.

If it already says **Manage** instead of Enable, it is on already — move on.

> **If it asks you to set up billing.** Google requires a billing account on the project
> even for free usage. Maps gives a large monthly free allowance and this app will not
> come near it — a village has a few dozen places and the map opens a few times a day. You
> still have to attach a card. If you would rather not, stop here: the app works without
> the map, and this is a reasonable thing to postpone.

### 3. Create the key

Left-hand menu → **APIs & Services** → **Credentials**.

Press **+ Create credentials** at the top, then **API key**.

A box appears with the new key in it. **Do not paste it into chat, a file in the repo, or
a commit.** Copy it and either keep the box open or paste it somewhere temporary — you
need it twice, in Part 2 and Part 3.

Press **Edit API key** in that box (or close it and click the key's name in the list).

### 4. Give the key a name you will recognise

At the top of the edit page, change **Name** from "API key 1" to something like
**Bespa Android Maps**. In a year this is the difference between knowing what a key is for
and being afraid to delete it.

### 5. Restrict it to your app — Application restrictions

On the edit page, under **Application restrictions**, choose **Android apps**.

A table appears. Press **+ Add** once for each row below, filling in the two fields:

| Package name | SHA-1 certificate fingerprint |
|---|---|
| `com.bespa.app.dev` | `3C:AA:EF:3B:71:4F:79:AE:39:E5:29:86:F4:BB:F5:CC:6F:0C:02:F9` |
| `com.bespa.app.preview` | `FE:01:8C:E6:4A:FD:2D:9D:EA:D4:7F:35:1B:D9:87:AC:11:59:F9:76` |

Those two fingerprints are the ones EAS already generated for your dev and preview
keystores. They are not secret — they identify a certificate, they do not let anyone use
it — and they are already in `google-services.json` in this repo, which is where the two
above were read from.

**Production is deliberately not in that table.** `com.bespa.app` has never been built, so
no keystore exists for it yet. See "When you build production" at the bottom.

### 6. Restrict it to one API — API restrictions

Further down the same page, under **API restrictions**, choose **Restrict key**.

In the dropdown that appears, tick **Maps SDK for Android** and nothing else.

This is the half people skip. Without it, a key that leaks can be spent on any Google API
enabled on the project, not just maps.

### 7. Save

Press **Save** at the bottom.

Restriction changes can take a few minutes to take effect. If the first build shows a grey
map, wait five minutes and reopen the app before assuming something is wrong.

---

# Part 2 — Give the key to EAS

EAS Build runs on Google's servers, not your laptop. It cannot see your `.env` file. If
the key is only in `.env`, every build will come out with **a blank grey rectangle and no
error message at all** — this project has been caught by that exact trap twice already,
once with Sentry.

So the key has to be an EAS environment variable, in all three environments.

Run this in the terminal, in `D:\apps\bespa`, replacing `PASTE_THE_KEY_HERE` with the key
from step 3:

```bash
npx eas-cli env:set --name EXPO_PUBLIC_GOOGLE_MAPS_KEY --value PASTE_THE_KEY_HERE --environment development --environment preview --environment production --visibility sensitive --scope project --non-interactive
```

One command, all three environments. `--visibility sensitive` means EAS will not print the
value back to you in listings; the build still receives it.

Check it took:

```bash
npx eas-cli env:list --environment preview
```

You should see `EXPO_PUBLIC_GOOGLE_MAPS_KEY` in the list. (That command **needs**
`--environment` — without it, it stops and asks, and fails outright if the terminal is not
interactive.)

---

# Part 3 — Put it in `.env` too, for this machine

`.env` is gitignored, so this is for local work only — it is what makes `npx expo
prebuild` and any local native build pick the key up.

Open `D:\apps\bespa\.env` and add one line at the end:

```
EXPO_PUBLIC_GOOGLE_MAPS_KEY=PASTE_THE_KEY_HERE
```

Save it. Do not add it to `.env.example` or any file that is committed.

---

# Part 4 — Build

The map is native code. An over-the-air update cannot deliver it; you need a new build.

```bash
git status
```

Make sure everything is committed — **EAS builds the last commit, not what is on disk.**
Then:

```bash
npx eas-cli build --profile development --platform android --non-interactive
```

That takes roughly 10–15 minutes. When it finishes, install the APK on the phone, open
Places, and there should now be a **Map** button under the filter chips.

---

## How to tell whether it worked

Three outcomes, and they look different:

| What you see | What it means |
|---|---|
| No **Map** button at all | The key never reached the build. `extra.mapsEnabled` is false. Check Part 2 — almost always the env variable is missing from that environment. |
| A **Map** button, but tapping it gives a blank grey box | The key reached the build but Google is refusing it. Either the restriction does not match (wrong package or wrong SHA-1), or Maps SDK for Android is not enabled, or billing is not attached. |
| A map with the village on it | Done. |

For the middle case, `adb logcat | grep -i "Google Maps"` on the phone usually prints the
actual reason, which is one of those three.

---

## When you build production

`com.bespa.app` is not set up anywhere yet. Before the first production build it needs,
in this order:

1. An **Android app registered in Firebase** for `com.bespa.app`, or the build fails
   outright in `:app:processReleaseGoogleServices` after about eight minutes.
2. Its **SHA-1 added to the Maps key** in Part 1 step 5, as a third row.

And after the first release to the Play Store, a fourth row: Play App Signing re-signs
your app with **its own** certificate, so the fingerprint that reaches Google at runtime is
Play's, not EAS's. You will find it in the Play Console under **Setup → App integrity →
App signing key certificate**. Until that row exists, the map will be grey for everyone
who installed from the Play Store while working perfectly on any APK you side-load.

---

## If you want to turn it off again

Delete the variable and rebuild; the app goes back to hiding the map:

```bash
npx eas-cli env:delete --variable-name EXPO_PUBLIC_GOOGLE_MAPS_KEY --variable-environment development
```

And delete the key itself in the Cloud console, under APIs & Services → Credentials, so it
cannot be billed.
