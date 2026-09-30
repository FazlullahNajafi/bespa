// Bespa — main app: lays out all 9 screens on a design canvas
// and wires up the Tweaks panel for theme + language toggle.

const PHONE_W = 320;
const PHONE_H = 660;

function BespaApp() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const theme = THEMES[t.theme] || THEMES.suruDawn;
  const lang = t.language || 'en';
  const copy = COPY[lang];
  const dir = lang === 'pq' ? 'rtl' : 'ltr';

  // wrap each screen in the themed phone shell so artboards read as
  // real device renders, not raw HTML panels
  const screen = (Component, statusDark, extraProps) => (
    <Phone theme={theme} width={PHONE_W} height={PHONE_H} statusDark={statusDark}>
      <Component theme={theme} t={copy} dir={dir} {...(extraProps || {})}/>
    </Phone>
  );

  const AB_W = PHONE_W + 24;
  const AB_H = PHONE_H + 24;

  return (
    <>
      <DesignCanvas>
        <DCSection id="onboarding" title="Onboarding" subtitle="OTP-based sign-in for any mobile number">
          <DCArtboard id="login" label="01 · Login" width={AB_W} height={AB_H}>
            {screen(ScreenLogin)}
          </DCArtboard>
          <DCArtboard id="otp" label="02 · OTP" width={AB_W} height={AB_H}>
            {screen(ScreenOtp)}
          </DCArtboard>
        </DCSection>

        <DCSection id="profile" title="Tell us about you" subtitle="Name + occupation for the new user ">
          <DCArtboard id="profile-grid" label="2a · Profile (tile grid)" width={AB_W} height={AB_H}>
            {screen(ScreenProfileGrid)}
          </DCArtboard>
          <DCArtboard id="profile-list" label="2b · Profile (list + hero name)" width={AB_W} height={AB_H}>
            {screen(ScreenProfileList)}
          </DCArtboard>
        </DCSection>

        <DCSection id="driver-verify" title="Taxi driver verification" subtitle="Shown only when a user picks Taxi Driver as their occupation — RTO documents must clear before they can accept passengers">
          <DCArtboard id="driver-verify-list" label="2c · Document checklist" width={AB_W} height={AB_H}>
            {screen(ScreenDriverVerify)}
          </DCArtboard>
          <DCArtboard id="driver-verify-camera" label="2d · Capture (one at a time)" width={AB_W} height={AB_H}>
            {screen(ScreenDriverVerifyCamera)}
          </DCArtboard>
        </DCSection>

        <DCSection id="location" title="Set up your area" subtitle="Cascading picker — State › District › Block › Village + Panchayat / Town + Municipality — that personalises the rest of the app">
          <DCArtboard id="loc-state" label="03a · State" width={AB_W} height={AB_H}>
            {screen(ScreenLocState)}
          </DCArtboard>
          <DCArtboard id="loc-district" label="03b · District" width={AB_W} height={AB_H}>
            {screen(ScreenLocDistrict)}
          </DCArtboard>
          <DCArtboard id="loc-block" label="03c · Block" width={AB_W} height={AB_H}>
            {screen(ScreenLocBlock)}
          </DCArtboard>
          <DCArtboard id="loc-locality" label="03d · Village + Panchayat" width={AB_W} height={AB_H}>
            {screen(ScreenLocLocality)}
          </DCArtboard>
          <DCArtboard id="loc-summary" label="03e · Your area" width={AB_W} height={AB_H}>
            {screen(ScreenLocSummary)}
          </DCArtboard>
        </DCSection>

        <DCSection id="core" title="Home & weather" subtitle="The dashboard everyone lands on">
          <DCArtboard id="home" label="04 · Home" width={AB_W} height={AB_H}>
            {screen(ScreenHome)}
          </DCArtboard>
          <DCArtboard id="weather" label="05 · Weather" width={AB_W} height={AB_H}>
            {screen(ScreenWeather, true)}
          </DCArtboard>
        </DCSection>

        <DCSection id="account" title="Profile & settings" subtitle="Opened by tapping your avatar on Home (and the new Profile tab) — identity and app settings merged into one calm screen">
          <DCArtboard id="account" label="04b · Profile + Settings" width={AB_W} height={AB_H}>
            {screen(ScreenAccount)}
          </DCArtboard>
        </DCSection>

        <DCSection id="services" title="Govt & community services" subtitle="Notices, the people directory, and shared cabs">
          <DCArtboard id="notices" label="06 · Govt Notices" width={AB_W} height={AB_H}>
            {screen(ScreenNotices)}
          </DCArtboard>
          <DCArtboard id="members" label="07 · Village Members" width={AB_W} height={AB_H}>
            {screen(ScreenMembers)}
          </DCArtboard>
        </DCSection>

        <DCSection id="cab" title="Cab booking flow" subtitle="Short ↔ long, shared ↔ private — same UI for both passengers and drivers. Tap inside any phone to walk the flow live.">
          <DCArtboard id="cab-pax-search" label="08a · Rider — Search" width={AB_W} height={AB_H}>
            {screen(CabApp, false, { initialRole: 'passenger', initialStep: 'search' })}
          </DCArtboard>
          <DCArtboard id="cab-pax-results" label="08b · Rider — Results" width={AB_W} height={AB_H}>
            {screen(CabApp, false, { initialRole: 'passenger', initialStep: 'results', initialDistance: 'long', initialMode: 'shared' })}
          </DCArtboard>
          <DCArtboard id="cab-pax-trip" label="08c · Rider — Trip" width={AB_W} height={AB_H}>
            {screen(CabApp, false, { initialRole: 'passenger', initialStep: 'trip', initialRideId: 'ls1' })}
          </DCArtboard>
          <DCArtboard id="cab-drv-home" label="08d · Driver — Dashboard" width={AB_W} height={AB_H}>
            {screen(CabApp, false, { initialRole: 'driver', initialStep: 'home' })}
          </DCArtboard>
          <DCArtboard id="cab-drv-request" label="08e · Driver — Request" width={AB_W} height={AB_H}>
            {screen(CabApp, false, { initialRole: 'driver', initialStep: 'request', initialRideId: 'lp1' })}
          </DCArtboard>
          <DCArtboard id="cab-drv-trip" label="08f · Driver — Active trip" width={AB_W} height={AB_H}>
            {screen(CabApp, false, { initialRole: 'driver', initialStep: 'trip', initialRideId: 'lp1', initialPhase: 'onboard' })}
          </DCArtboard>
        </DCSection>

        <DCSection id="cab-shortprivate" title="Short private hire · Ladakh" subtitle="The everyday Kargil case — hire a whole taxi from your village to town, leaving now. Tap inside the phones to walk the flow.">
          <DCArtboard id="sp-search" label="SP1 · Search (short · private)" width={AB_W} height={AB_H}>
            {screen(CabApp, false, { initialRole: 'passenger', initialStep: 'search', initialDistance: 'short', initialMode: 'private' })}
          </DCArtboard>
          <DCArtboard id="sp-results" label="SP2 · Results" width={AB_W} height={AB_H}>
            {screen(CabApp, false, { initialRole: 'passenger', initialStep: 'results', initialDistance: 'short', initialMode: 'private' })}
          </DCArtboard>
          <DCArtboard id="sp-trip" label="SP3 · Trip confirmed" width={AB_W} height={AB_H}>
            {screen(CabApp, false, { initialRole: 'passenger', initialStep: 'trip', initialRideId: 'sp1' })}
          </DCArtboard>
        </DCSection>

        <DCSection id="nrega" title="MGNREGA tracker" subtitle={"\n"}>
          <DCArtboard id="nrega-dashboard" label="12a · NREGA Dashboard (progress-first)" width={AB_W} height={AB_H}>
            {screen(ScreenNregaDashboard)}
          </DCArtboard>
          <DCArtboard id="nrega-ledger" label="12b · NREGA Ledger (wages-first)" width={AB_W} height={AB_H}>
            {screen(ScreenNregaLedger)}
          </DCArtboard>
        </DCSection>

        <DCSection id="social" title="Social & assistance" subtitle="Where the valley talks to itself — and to the assistant">
          <DCArtboard id="community" label="09 · Community feed" width={AB_W} height={AB_H}>
            {screen(ScreenCommunity)}
          </DCArtboard>
          <DCArtboard id="community-compose" label="09b · New post (upload)" width={AB_W} height={AB_H}>
            {screen(ScreenCommunityCompose)}
          </DCArtboard>
          <DCArtboard id="gallery" label="10 · Photo Gallery" width={AB_W} height={AB_H}>
            {screen(ScreenGallery)}
          </DCArtboard>
          <DCArtboard id="assistant" label="11 · AI Assistant" width={AB_W} height={AB_H}>
            {screen(ScreenAssistant)}
          </DCArtboard>
        </DCSection>
      </DesignCanvas>

      <TweaksPanel title="Bespa Tweaks">
        <TweakSection label="Language">
          <TweakRadio
            label="UI language"
            value={lang}
            onChange={(v) => setTweak('language', v)}
            options={[
              { value: 'en', label: 'English' },
              { value: 'pq', label: 'پرگی' },
            ]}/>
        </TweakSection>

        <TweakSection label="Theme">
          <TweakSelect
            label="Palette"
            value={t.theme}
            onChange={(v) => setTweak('theme', v)}
            options={[
              { value: 'suruDawn', label: 'Suru Dawn — apricot & indigo' },
              { value: 'drassSnow', label: 'Drass Snow — glacier blues' },
              { value: 'stoneVillage', label: 'Stone Village — terracotta' },
              { value: 'twilight', label: 'Twilight — dark mode' },
            ]}/>
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<BespaApp/>);
