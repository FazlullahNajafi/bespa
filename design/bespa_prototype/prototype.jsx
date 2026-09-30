// Bespa — interactive prototype router
//
// Reuses the SAME screen components that the Bespa.html design canvas
// renders (screens-*.jsx). Each screen takes an optional `nav` prop;
// the canvas omits it (static artboards) while this prototype passes a
// real nav stack, so the two never drift apart.
//
// Flow:  login → otp → profile → location cascade → home → (everything)
// Cab booking is fully walkable for both rider and driver (the role pill
// inside the cab flow swaps between them).

const PHONE_W = 320;
const PHONE_H = 660;

// ─── tiny history-stack navigator ───────────────────────────────
function useNav(initial) {
  const [stack, setStack] = React.useState([initial]);
  const current = stack[stack.length - 1];
  return {
    current,
    stack,
    go:      (s) => setStack(st => [...st, s]),
    back:    ()  => setStack(st => st.length > 1 ? st.slice(0, -1) : st),
    reset:   (s) => setStack([s]),
    replace: (s) => setStack(st => [...st.slice(0, -1), s]),
  };
}

function BespaPrototype() {
  const [tw, setTweak] = useTweaks(PROTO_TWEAK_DEFAULTS);
  const theme = THEMES[tw.theme] || THEMES.suruDawn;
  const lang = tw.language || 'en';
  const t = COPY[lang];
  const dir = lang === 'pq' ? 'rtl' : 'ltr';

  const nav = useNav('login');
  const p = { theme, t, dir, nav };

  // nav key → screen element (all share the same props bag)
  const screens = {
    login:              <ScreenLogin {...p} />,
    otp:                <ScreenOtp {...p} />,
    profile:            <ScreenProfileGrid {...p} />,
    locState:           <ScreenLocState {...p} />,
    locDistrict:        <ScreenLocDistrict {...p} />,
    locBlock:           <ScreenLocBlock {...p} />,
    locLocality:        <ScreenLocLocality {...p} />,
    locSummary:         <ScreenLocSummary {...p} />,
    home:               <ScreenHome {...p} />,
    weather:            <ScreenWeather {...p} />,
    notices:            <ScreenNotices {...p} />,
    members:            <ScreenMembers {...p} />,
    gallery:            <ScreenGallery {...p} />,
    cabs:               <CabApp {...p} initialRole="passenger" initialStep="search" />,
    community:          <ScreenCommunity {...p} />,
    communityCompose:   <ScreenCommunityCompose {...p} />,
    assistant:          <ScreenAssistant {...p} />,
    account:            <ScreenAccount {...p} />,
    driverVerify:       <ScreenDriverVerify {...p} />,
    driverVerifyCamera: <ScreenDriverVerifyCamera {...p} />,
  };

  const view = screens[nav.current] || screens.home;
  // dark status bar on theme-coloured full-bleed screens
  const darkStatus = theme.name === 'Twilight' || nav.current === 'weather';

  return (
    <div style={{
      minHeight: '100vh', width: '100%',
      background: `radial-gradient(circle at 50% -10%, ${theme.primary}22, transparent 55%), ${theme.bg}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '28px 18px', position: 'relative', overflow: 'hidden',
    }}>
      {/* faint mountain watermark behind the phone */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0,
        opacity: 0.4, pointerEvents: 'none' }}>
        <MountainMotif height={300}
          c1={theme.primary + '08'} c2={theme.primary + '10'} c3={theme.primary + '16'} />
      </div>

      {/* Phone */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <Phone theme={theme} width={PHONE_W} height={PHONE_H} statusDark={darkStatus}>
          <div key={nav.current} style={{
            height: '100%', animation: 'bespa-screen-in 0.26s cubic-bezier(.2,.7,.3,1)',
          }}>
            {view}
          </div>
        </Phone>
      </div>

      <TweaksPanel title="Bespa Tweaks">
        <TweakSection label="Jump to">
          <TweakRadio
            label="Section"
            value={['login','otp','profile'].includes(nav.current) ? 'onboard'
              : nav.current === 'cabs' ? 'cabs'
              : nav.current === 'account' ? 'account' : 'home'}
            onChange={(v) => nav.reset(
              v === 'onboard' ? 'login' :
              v === 'cabs' ? 'cabs' :
              v === 'account' ? 'account' : 'home')}
            options={[
              { value: 'onboard', label: 'Onboarding' },
              { value: 'home', label: 'Home' },
              { value: 'cabs', label: 'Cabs' },
              { value: 'account', label: 'Profile' },
            ]}/>
        </TweakSection>

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
            value={tw.theme}
            onChange={(v) => setTweak('theme', v)}
            options={[
              { value: 'suruDawn', label: 'Suru Dawn — apricot & indigo' },
              { value: 'drassSnow', label: 'Drass Snow — glacier blues' },
              { value: 'stoneVillage', label: 'Stone Village — terracotta' },
              { value: 'twilight', label: 'Twilight — dark mode' },
            ]}/>
        </TweakSection>

        <TweakSection label="Navigation">
          <TweakButton label="Restart from login" onClick={() => nav.reset('login')}/>
        </TweakSection>
      </TweaksPanel>

      <style>{`
        @keyframes bespa-screen-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

const protoRoot = ReactDOM.createRoot(document.getElementById('root'));
protoRoot.render(<BespaPrototype/>);
