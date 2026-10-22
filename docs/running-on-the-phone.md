# Running Bespa on the phone

Every command here is run from `D:\apps\bespa`, in one terminal window, in this order.
You need the phone connected by USB cable.

There is no emulator installed on this machine, so the phone is the only way to see the
app. That is not a limitation worth fixing: three real defects — unreadable tab icons,
the keyboard covering the submit button, and content drawn under the status bar — were
invisible in a browser and obvious within seconds on a device.

---

## The short version

```bash
npm start
```

Then, in a second terminal:

```bash
adb reverse tcp:8081 tcp:8081
```

```bash
adb shell am start -a android.intent.action.VIEW -d "bespa-dev://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081" -p com.bespa.app.dev
```

That is the whole thing. The rest of this page explains each step and what to do when one
of them misbehaves.

---

## Step 1 — Plug in the phone and check it is seen

```bash
adb devices
```

You want one line with the word `device` after the serial number:

```
List of devices attached
9b010059305330363400dd4058a7bb	device
```

- **Empty list?** The cable may be charge-only — try another one. Unlock the phone.
- **Says `unauthorized`?** Look at the phone: there is a prompt asking whether to allow
  USB debugging from this computer. Tick "always allow" and accept it.
- **Says `offline`, or nothing works?** Run `adb kill-server`, then `adb devices` again.

If USB debugging has never been turned on: Settings → About phone → tap "Build number"
seven times → go back → Developer options → USB debugging.

---

## Step 2 — Start the dev server

```bash
npm start
```

This is Metro, the thing that builds the JavaScript and serves it to the phone. Leave it
running in its own terminal — you will come back to this window to see logs and to press
`r` to reload.

Wait until it prints `Waiting on http://localhost:8081`. If port 8081 is already taken it
will pick another one (8082, say) — if that happens, use that number in steps 3 and 4
instead of 8081.

> **Do not open `localhost:8081` in a browser.** The browser makes Metro build a *web*
> version, which fails on this project, and while that is happening the phone's request
> dies with `unexpected end of stream` — which reads like a broken cable and is not. If
> you did open it, close the tab and run step 4 again.

---

## Step 3 — Bridge the port to the phone

```bash
adb reverse tcp:8081 tcp:8081
```

This makes `127.0.0.1:8081` *on the phone* mean `127.0.0.1:8081` *on this laptop*.
Without it the phone looks for the dev server on itself and finds nothing.

**Run this again whenever the USB connection hiccups.** The mapping disappears silently —
no error, no message — and the symptom is an app that will not load. It is the first
thing to re-run before blaming anything else.

You can check what is mapped with:

```bash
adb reverse --list
```

You do **not** need a second mapping for the database. The app points at the hosted
Supabase project, which the phone reaches over its own internet connection. (If `.env` is
ever switched back to the local Docker stack, you would also need
`adb reverse tcp:55321 tcp:55321`.)

---

## Step 4 — Open the app

```bash
adb shell am start -a android.intent.action.VIEW -d "bespa-dev://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081" -p com.bespa.app.dev
```

You can also just tap the Bespa Dev icon on the phone — but then it opens a launcher
screen rather than the app, and you have to type the address in by hand. The command
above is the launcher screen filled in for you.

**Why that long URL:** `http%3A%2F%2F127.0.0.1%3A8081` is `http://127.0.0.1:8081` with the
punctuation escaped, because it is a web address being carried inside another web
address.

You should see the splash screen, then the app. The first load takes 10–30 seconds while
Metro builds the bundle; the terminal from step 2 prints `Android Bundled` when it is
done. After that, changes you make to the code appear almost instantly.

---

## Which app is which

Three separate apps can be installed side by side. They do not share data, accounts or
settings.

| On the phone | Package | Deep-link prefix | What it runs |
|---|---|---|---|
| **Bespa Dev** | `com.bespa.app.dev` | `bespa-dev://` | Whatever this laptop is serving. This is the one you develop with. |
| **Bespa Preview** | `com.bespa.app.preview` | `bespa-preview://` | A fixed build. Updates arrive over the air, not from this laptop. |
| Bespa | `com.bespa.app` | `bespa://` | Production. Not built yet. |

The `-p com.bespa.app.dev` at the end of the command names the app explicitly. Android
lets several apps claim the same link prefix and then picks between them unpredictably,
so naming it removes the guesswork.

---

## When something goes wrong

### "Activity not started, unable to resolve Intent"

The installed app does not recognise `bespa-dev://`. Older builds used plain `bespa://`
instead. Try:

```bash
adb shell am start -a android.intent.action.VIEW -d "bespa://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081" -p com.bespa.app.dev
```

If that works, the installed build is an old one.

### The app opens on a list/launcher screen with a text box

That is the development launcher, and it is not a fault — a development build contains
the native code but no JavaScript, so until it is pointed at a dev server it has nothing
to show. It means the `?url=` part did not arrive. Re-run the step 4 command exactly, or
type `http://127.0.0.1:8081` into the box on that screen.

### A red screen saying "Cannot find native module …"

The app on the phone was built before some piece of native code was added, and the
JavaScript now expects it. No amount of reloading fixes this — the phone needs a new
build:

```bash
npx eas-cli build --profile development --platform android --non-interactive
```

It takes about ten minutes, then gives you a link; open it on the phone to install, or
install the downloaded file with `adb install -r <file>.apk`. Your data survives.

### It spins forever, or says `unexpected end of stream`

Almost always one of three things, in order of likelihood:

1. The port bridge dropped — re-run step 3.
2. A browser tab is open on `localhost:8081` — close it, then re-run step 4.
3. Metro died. Look at the terminal from step 2: if it has exited, start it again. On
   this machine it occasionally dies at startup with
   `UNKNOWN: unknown error, scandir …\node_modules\…`, which is not a code problem —
   just start it again.

### Changes are not showing up

- Press `r` in the Metro terminal to force a reload.
- If you just installed a new npm package, Metro's cache needs clearing: stop it, delete
  `node_modules/.cache`, start it again.
- If the *data* looks stale rather than the layout, that is the app's own cache: profile
  and notices are held for several minutes and survive a restart. Clear the app's data
  (below) or wait it out.

### Starting completely fresh

```bash
adb shell pm clear com.bespa.app.dev
```

This signs you out and erases everything the app has stored on the phone — the quickest
way back to the sign-up screen, which is also the only way to see onboarding again once
you have been through it. There is no sign-out button yet.

---

## Reading the screen without picking the phone up

Useful when the phone is across the desk, and what the assistant uses to check its own
work.

```bash
adb shell screencap -p /sdcard/s.png
adb pull /sdcard/s.png .
```

```bash
adb shell uiautomator dump /sdcard/ui.xml
adb shell cat /sdcard/ui.xml
```

In Git Bash, run `export MSYS_NO_PATHCONV=1` first, or `/sdcard/...` gets rewritten into a
Windows path and the commands fail.

---

## What needs a new build, and what does not

Most changes — screens, text, colours, queries, logic — reach the phone through Metro in
seconds. Nothing to install.

A **new build** is needed only when the native side changes:

- adding a package with native code (`expo-location`, `expo-notifications`, Google
  Sign-In),
- changing anything in `app.config.ts` that affects the Android manifest (permissions,
  app name, icon, deep-link schemes),
- changing the app's package name.

The giveaway is a red screen naming a native module, or a permission the app never asks
for.
