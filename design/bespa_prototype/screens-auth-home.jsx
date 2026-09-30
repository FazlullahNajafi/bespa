// Bespa — Auth & Home screens

// ─── Login (phone) ───────────────────────────────────────────────
function ScreenLogin({ theme, t, dir, nav }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: theme.surface, position: 'relative' }}>
      {/* Hero with mountains */}
      <div style={{ position: 'relative', padding: '40px 24px 0', height: 280, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0 }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 280,
            background: `linear-gradient(180deg, ${theme.primarySoft}88 0%, ${theme.surface} 100%)` }} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
            <MountainMotif height={150}
            c1={theme.primary + '20'}
            c2={theme.primary + '50'}
            c3={theme.primary} />
          </div>
          {/* sun/moon */}
          <div style={{ position: 'absolute', top: 50, right: 36,
            width: 56, height: 56, borderRadius: 56, background: theme.accent,
            boxShadow: `0 0 60px ${theme.accent}80` }} />
        </div>
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
          <BespaLogo size={40} theme={theme} />
          <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: 28, color: theme.ink }}>{t.appName}</div>
        </div>
      </div>

      {/* Form */}
      <div style={{ flex: 1, padding: '20px 24px 0', textAlign: dir === 'rtl' ? 'right' : 'left' }}>
        <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: 30, lineHeight: 1.1, color: theme.ink, letterSpacing: -0.5 }}>
          {t.welcome}
        </div>
        <div style={{ fontSize: 13, color: theme.inkSoft, marginTop: 8, lineHeight: 1.5 }}>
          {t.loginSubtitle}
        </div>

        <div style={{ marginTop: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: theme.inkSoft, letterSpacing: 0.4, textTransform: 'uppercase' }}>
            {t.phoneLabel}
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: theme.bg, border: `1.5px solid ${theme.border}`,
            borderRadius: 14, padding: '14px 16px', marginTop: 8
          }}>
            <span style={{ fontWeight: 600, color: theme.ink }}>+91</span>
            <span style={{ width: 1, height: 18, background: theme.border }} />
            <span style={{ flex: 1, fontFamily: 'DM Mono, ui-monospace, monospace',
              letterSpacing: 1.5, color: theme.ink, fontSize: 17 }}>
              98765 43210
            </span>
            <Icon name="phone" size={18} stroke={theme.inkFaint} />
          </div>
        </div>

        <div onClick={nav && (() => nav.go('otp'))} style={{
          marginTop: 20, background: theme.primary, color: theme.surface,
          borderRadius: 14, padding: '15px 16px', textAlign: 'center',
          fontWeight: 600, fontSize: 15, letterSpacing: 0.2,
          boxShadow: `0 8px 20px ${theme.primary}40`, cursor: nav ? 'pointer' : 'default'
        }}>{t.sendOtp}</div>

        {/* OR divider */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          margin: '16px 4px 0'
        }}>
          <div style={{ flex: 1, height: 1, background: theme.borderSoft }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: theme.inkFaint,
            letterSpacing: 0.8, textTransform: 'uppercase' }}>{t.orDivider}</span>
          <div style={{ flex: 1, height: 1, background: theme.borderSoft }} />
        </div>

        {/* Continue with Google — neutral monogram, not a recreation of Google's branded mark */}
        <div onClick={nav && (() => nav.reset('home'))} style={{
          marginTop: 12,
          background: theme.surface, color: theme.ink,
          border: `1.5px solid ${theme.border}`,
          borderRadius: 14, padding: '13px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          fontWeight: 600, fontSize: 14.5, letterSpacing: 0.2, cursor: nav ? 'pointer' : 'default'
        }}>
          <div style={{
            width: 22, height: 22, borderRadius: 11,
            background: theme.surfaceAlt, border: `1px solid ${theme.borderSoft}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Instrument Serif, serif', fontSize: 14, fontWeight: 600,
            color: theme.ink, lineHeight: 1
          }}>G</div>
          <span>{t.continueGoogle}</span>
        </div>

        <div style={{ textAlign: 'center', fontSize: 11, color: theme.inkFaint, marginTop: 18, lineHeight: 1.6 }}>
          <br />
          <span style={{ color: theme.primary, fontWeight: 600 }}></span>  <span style={{ color: theme.primary, fontWeight: 600 }}></span>
        </div>
      </div>
    </div>);

}

// ─── OTP entry ───────────────────────────────────────────────────
function ScreenOtp({ theme, t, dir, nav }) {
  const digits = ['4', '8', '2', '1', '', ''];
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: theme.surface }}>
      <div style={{ padding: '16px 16px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div onClick={nav && (() => nav.back())} style={{
          width: 36, height: 36, borderRadius: 18, background: theme.surfaceAlt,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: nav ? 'pointer' : 'default'
        }}><Icon name="back" size={18} /></div>
      </div>

      <div style={{ padding: '16px 24px 0', textAlign: dir === 'rtl' ? 'right' : 'left', flex: 1 }}>
        <div style={{ fontSize: 30, lineHeight: 1.1, color: theme.ink, letterSpacing: -0.5, fontFamily: "Ubuntu" }}>
          {t.enterOtp}
        </div>
        <div style={{ fontSize: 13, color: theme.inkSoft, marginTop: 8 }}>
          {t.otpSentTo} <span style={{ color: theme.ink, fontWeight: 600 }}>+91 98765 43210</span>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 28, justifyContent: 'space-between' }}>
          {digits.map((d, i) =>
          <div key={i} style={{
            flex: 1, height: 56, borderRadius: 14,
            border: `1.5px solid ${d ? theme.primary : theme.border}`,
            background: d ? theme.primarySoft : theme.bg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'DM Mono, ui-monospace, monospace',
            fontSize: 24, fontWeight: 600, color: theme.ink
          }}>{d || ''}</div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 18, fontSize: 12, color: theme.inkSoft }}>
          <Icon name="clock" size={14} stroke={theme.inkSoft} />
          <span>{t.resend} in <span style={{ color: theme.primary, fontWeight: 600 }}>0:24</span></span>
        </div>

        <div onClick={nav && (() => nav.go('profile'))} style={{
          marginTop: 24, background: theme.primary, color: theme.surface,
          borderRadius: 14, padding: '15px 16px', textAlign: 'center',
          fontWeight: 600, fontSize: 15,
          boxShadow: `0 8px 20px ${theme.primary}40`, cursor: nav ? 'pointer' : 'default'
        }}>{t.verify}</div>

        {/* Number pad preview */}
        <div style={{
          marginTop: 22, background: theme.surfaceAlt, borderRadius: 16,
          padding: 10, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6
        }}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, '⌫'].map((n, i) =>
          <div key={i} style={{
            height: 36, borderRadius: 10,
            background: n === '' ? 'transparent' : theme.surface,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'DM Mono, ui-monospace, monospace', fontSize: 17, fontWeight: 500,
            color: theme.ink
          }}>{n}</div>
          )}
        </div>
      </div>
    </div>);

}

// ─── Home (6-tile grid) ──────────────────────────────────────────
function ScreenHome({ theme, t, dir, nav }) {
  const tiles = [
  { id: 'notices', icon: 'bell', label: t.notices, tint: 'primary', badge: '3' },
  { id: 'members', icon: 'people', label: t.members, tint: 'info' },
  { id: 'cabs', icon: 'car', label: t.cabs, tint: 'accent' },
  { id: 'assistant', icon: 'spark', label: t.assistant, tint: 'success' },
  { id: 'community', icon: 'chat', label: t.community, tint: 'primary' },
  { id: 'gallery', icon: 'image', label: t.gallery, tint: 'accent' }];

  const tintMap = {
    primary: [theme.primarySoft, theme.primary],
    accent: [theme.accentSoft, theme.accent],
    info: [theme.borderSoft, theme.info],
    success: [theme.borderSoft, theme.success]
  };
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: theme.bg }}>
      {/* Greeting header w/ mountain motif */}
      <div style={{ background: theme.surface, padding: '18px 18px 0', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: dir === 'rtl' ? 'right' : 'left' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: theme.inkFaint, letterSpacing: 0.6, textTransform: 'uppercase', fontWeight: 600 }}>
              {t.yourVillage}
            </div>
            <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: 26, color: theme.ink, marginTop: 2, lineHeight: 1.1 }}>
              {t.namaskar}
            </div>
          </div>
          <div onClick={nav && (() => nav.go('account'))} style={{
            cursor: 'pointer', borderRadius: 999, flexShrink: 0,
            boxShadow: `0 0 0 2px ${theme.surface}, 0 0 0 3px ${theme.accent}55`
          }} title="Open profile & settings">
            <Avatar name="Ali" size={42} theme={theme} tint="accent" />
          </div>
        </div>

        {/* Weather card (compact) */}
        <div onClick={nav && (() => nav.go('weather'))} style={{
          marginTop: 14, background: theme.primary, color: theme.surface,
          borderRadius: 16, padding: '14px 16px',
          display: 'flex', alignItems: 'center', gap: 14,
          position: 'relative', overflow: 'hidden', cursor: nav ? 'pointer' : 'default'
        }}>
          <div style={{ position: 'absolute', right: -10, bottom: -10, opacity: 0.25 }}>
            <MountainMotif height={70} c1={theme.surface + '30'} c2={theme.surface + '60'} c3={theme.surface + '90'} />
          </div>
          <div style={{ width: 44, height: 44, borderRadius: 22, background: theme.accent,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            boxShadow: `0 0 24px ${theme.accent}80` }}>
            <Icon name="sun" size={22} stroke={theme.surface} />
          </div>
          <div style={{ flex: 1, position: 'relative', zIndex: 1 }}>
            <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: 26, lineHeight: 1 }}>12°</div>
            <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>Clear · Kargil, Ladakh</div>
          </div>
          <div style={{ textAlign: 'right', position: 'relative', zIndex: 1 }}>
            <div style={{ fontSize: 11, opacity: 0.8 }}>{t.feelsLike}</div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>9°</div>
          </div>
        </div>
      </div>

      {/* Tile grid */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px 14px 12px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: theme.inkSoft,
          letterSpacing: 0.6, textTransform: 'uppercase', padding: '0 6px 10px', textAlign: dir === 'rtl' ? 'right' : 'left' }}>
          {t.quickAccess}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {tiles.map((tile) => {
            const [soft, solid] = tintMap[tile.tint];
            return (
              <div key={tile.id} onClick={nav && (() => nav.go(tile.id))} style={{
                background: theme.surface, borderRadius: 16,
                padding: '14px 10px', minHeight: 96,
                border: `1px solid ${theme.borderSoft}`,
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                gap: 8, position: 'relative', cursor: nav ? 'pointer' : 'default'
              }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 11,
                  background: soft, color: solid,
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}><Icon name={tile.icon} size={20} /></div>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: theme.ink, lineHeight: 1.2 }}>
                  {tile.label}
                </div>
                {tile.badge &&
                <div style={{
                  position: 'absolute', top: 10, right: 10,
                  minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9,
                  background: theme.danger, color: '#fff',
                  fontSize: 10, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>{tile.badge}</div>
                }
              </div>);

          })}
        </div>

        {/* Today in the valley */}
        <div onClick={nav && (() => nav.go('notices'))} style={{
          marginTop: 14, padding: '12px 14px',
          background: theme.surface, border: `1px solid ${theme.borderSoft}`,
          borderRadius: 16, cursor: nav ? 'pointer' : 'default'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: theme.inkSoft, letterSpacing: 0.5, textTransform: 'uppercase' }}>
              {t.todayInValley}
            </div>
            <Icon name="arrow" size={14} stroke={theme.inkFaint} />
          </div>
          <div style={{ marginTop: 10, display: 'flex', gap: 10 }}>
            <div style={{ width: 4, borderRadius: 2, background: theme.accent }} />
            <div style={{ flex: 1, textAlign: dir === 'rtl' ? 'right' : 'left' }}>
              <div style={{ fontSize: 13, color: theme.ink, fontWeight: 600 }}>Road to Drass open</div>
              <div style={{ fontSize: 11, color: theme.inkSoft, marginTop: 2 }}>NH-1 clear · last update 7:30</div>
            </div>
          </div>
          <div style={{ marginTop: 8, display: 'flex', gap: 10 }}>
            <div style={{ width: 4, borderRadius: 2, background: theme.info }} />
            <div style={{ flex: 1, textAlign: dir === 'rtl' ? 'right' : 'left' }}>
              <div style={{ fontSize: 13, color: theme.ink, fontWeight: 600 }}>Apricot festival · Sankoo</div>
              <div style={{ fontSize: 11, color: theme.inkSoft, marginTop: 2 }}>Saturday · 2 days away</div>
            </div>
          </div>
        </div>
      </div>

      <TabBar active="home" theme={theme} t={t} nav={nav} />
    </div>);

}

// ─── Weather (detail) ────────────────────────────────────────────
function ScreenWeather({ theme, t, dir, nav }) {
  const days = [
  { d: 'Today', icon: 'sun', hi: 12, lo: 1 },
  { d: 'Wed', icon: 'sun', hi: 14, lo: 2 },
  { d: 'Thu', icon: 'cloud', hi: 10, lo: 0 },
  { d: 'Fri', icon: 'cloud', hi: 8, lo: -2 },
  { d: 'Sat', icon: 'cloud', hi: 6, lo: -4 },
  { d: 'Sun', icon: 'sun', hi: 9, lo: -1 },
  { d: 'Mon', icon: 'sun', hi: 11, lo: 0 }];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: theme.bg }}>
      {/* Hero */}
      <div style={{ background: theme.primary, color: theme.surface, padding: '16px 18px 24px',
        position: 'relative', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative', zIndex: 1 }}>
          <div onClick={nav && (() => nav.back())} style={{ width: 32, height: 32, borderRadius: 16, background: '#ffffff20',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: nav ? 'pointer' : 'default' }}>
            <Icon name="back" size={16} stroke={theme.surface} />
          </div>
          <div style={{ flex: 1, textAlign: dir === 'rtl' ? 'right' : 'left' }}>
            <div style={{ fontSize: 12, opacity: 0.85 }}>Kargil District</div>
            <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: 22, lineHeight: 1 }}>Hardass Village</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, marginTop: 18, position: 'relative', zIndex: 1 }}>
          <div style={{ width: 64, height: 64, borderRadius: 32, background: theme.accent,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 0 50px ${theme.accent}99`, flexShrink: 0 }}>
            <Icon name="sun" size={36} stroke={theme.surface} sw={2} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: 72, lineHeight: 0.9, letterSpacing: -2 }}>
              12°
            </div>
            <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>Clear sky · {t.feelsLike} 9°</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 18, position: 'relative', zIndex: 1 }}>
          {[
          { l: t.wind, v: '12 km/h' },
          { l: t.humidity, v: '38%' },
          { l: 'UV', v: '6' }].
          map((s) =>
          <div key={s.l} style={{
            flex: 1, background: '#ffffff15', borderRadius: 12, padding: '8px 10px'
          }}>
              <div style={{ fontSize: 10, opacity: 0.75 }}>{s.l}</div>
              <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>{s.v}</div>
            </div>
          )}
        </div>

        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
          <MountainMotif height={70} c1="#ffffff15" c2="#ffffff25" c3="#ffffff40" />
        </div>
      </div>

      {/* 7-day */}
      <div style={{ flex: 1, overflow: 'auto', padding: '14px 14px 12px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: theme.inkSoft,
          letterSpacing: 0.5, textTransform: 'uppercase', padding: '0 4px 10px' }}>
          {t.forecast}
        </div>
        <div style={{ background: theme.surface, borderRadius: 16, border: `1px solid ${theme.borderSoft}`, overflow: 'hidden' }}>
          {days.map((day, i) =>
          <div key={i} style={{
            display: 'flex', alignItems: 'center', padding: '11px 16px',
            borderTop: i === 0 ? 'none' : `1px solid ${theme.borderSoft}`
          }}>
              <div style={{ width: 56, fontSize: 13, fontWeight: 600, color: theme.ink }}>{day.d}</div>
              <div style={{ width: 32, color: day.icon === 'sun' ? theme.accent : theme.info }}>
                <Icon name={day.icon} size={20} />
              </div>
              <div style={{ flex: 1, height: 4, background: theme.borderSoft, borderRadius: 2, margin: '0 14px', position: 'relative' }}>
                <div style={{
                position: 'absolute', height: '100%', borderRadius: 2,
                background: `linear-gradient(90deg, ${theme.info}, ${theme.accent})`,
                left: `${(day.lo + 5) / 20 * 100}%`,
                width: `${(day.hi - day.lo) / 20 * 100}%`
              }} />
              </div>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: theme.inkSoft, width: 28, textAlign: 'right' }}>{day.lo}°</div>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, color: theme.ink, fontWeight: 600, width: 28, textAlign: 'right' }}>{day.hi}°</div>
            </div>
          )}
        </div>

        {/* Sunrise/sunset */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
          {[
          { icon: 'sun', l: t.sunrise, v: '5:42' },
          { icon: 'moon', l: t.sunset, v: '7:18' }].
          map((s) =>
          <div key={s.l} style={{ background: theme.surface, borderRadius: 14, padding: '12px 14px', border: `1px solid ${theme.borderSoft}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: theme.accent }}>
                <Icon name={s.icon} size={16} stroke={theme.accent} />
                <span style={{ fontSize: 10, fontWeight: 700, color: theme.inkSoft, letterSpacing: 0.5, textTransform: 'uppercase' }}>{s.l}</span>
              </div>
              <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: 22, color: theme.ink, marginTop: 4 }}>{s.v}</div>
            </div>
          )}
        </div>
      </div>
    </div>);

}

Object.assign(window, { ScreenLogin, ScreenOtp, ScreenHome, ScreenWeather });