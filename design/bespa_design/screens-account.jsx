// Bespa — Profile + Settings (merged)
//
// Opened by tapping your avatar on the Home screen (and from the
// Profile tab in the footer). One screen that is both "who you are"
// and "how the app behaves" — villagers shouldn't have to hunt for
// two different places.
//
//   • Profile hero    — avatar, name, occupation, area
//   • Driver card     — only shown for taxi drivers; ties into the
//                       simplified verification flow
//   • Settings groups — account, preferences, support
//
// All rows are big, single-purpose, color-coded — same calm language
// as the rest of Bespa.

// ─── Small building blocks ───────────────────────────────────────
function AcctGroup({ title, theme, dir, children }) {
  return (
    <div style={{ marginTop: 16, textAlign: dir === 'rtl' ? 'right' : 'left' }}>
      {title &&
      <div style={{
        fontSize: 10, fontWeight: 700, color: theme.inkSoft,
        letterSpacing: 0.5, textTransform: 'uppercase', padding: '0 6px 8px'
      }}>{title}</div>
      }
      <div style={{
        background: theme.surface, borderRadius: 16,
        border: `1px solid ${theme.borderSoft}`, overflow: 'hidden'
      }}>{children}</div>
    </div>
  );
}

function AcctRow({ icon, tint, label, value, theme, dir, first, trailing, onTap }) {
  const map = {
    primary: [theme.primarySoft, theme.primary],
    accent:  [theme.accentSoft,  theme.accent],
    info:    [theme.borderSoft,  theme.info],
    success: [theme.borderSoft,  theme.success],
    danger:  [theme.borderSoft,  theme.danger],
  };
  const [soft, solid] = map[tint] || map.primary;
  return (
    <div onClick={onTap} style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 14px',
      borderTop: first ? 'none' : `1px solid ${theme.borderSoft}`,
      flexDirection: dir === 'rtl' ? 'row-reverse' : 'row',
      cursor: onTap ? 'pointer' : 'default'
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: 10,
        background: soft, color: solid,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
      }}><Icon name={icon} size={17} stroke={solid} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: theme.ink, lineHeight: 1.2 }}>{label}</div>
        {value &&
        <div style={{ fontSize: 11.5, color: theme.inkSoft, marginTop: 2,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
        }
      </div>
      {trailing !== undefined
        ? trailing
        : <Icon name="chevron" size={16} stroke={theme.inkFaint} />}
    </div>
  );
}

// iOS-style switch (purely visual; defaults on)
function Toggle({ on = true, theme }) {
  return (
    <div style={{
      width: 42, height: 25, borderRadius: 13, flexShrink: 0,
      background: on ? theme.success : theme.border,
      display: 'flex', alignItems: 'center',
      justifyContent: on ? 'flex-end' : 'flex-start',
      padding: 3, transition: 'all .2s', cursor: 'pointer'
    }}>
      <div style={{ width: 19, height: 19, borderRadius: 10, background: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }} />
    </div>
  );
}

// Theme swatch trio (shows the active palette as a trailing accessory)
function ThemeSwatch({ theme }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ display: 'flex' }}>
        {[theme.primary, theme.accent, theme.info].map((c, i) =>
          <div key={i} style={{
            width: 16, height: 16, borderRadius: 8, background: c,
            border: `1.5px solid ${theme.surface}`,
            marginLeft: i === 0 ? 0 : -6
          }} />
        )}
      </div>
      <Icon name="chevron" size={16} stroke={theme.inkFaint} />
    </div>
  );
}

// ─── Screen ──────────────────────────────────────────────────────
function ScreenAccount({ theme, t, dir, nav }) {
  const lang = dir === 'rtl' ? 'پرگی' : 'English';
  // Mirrors the simplified driver verification: 1 of 3 cleared so far.
  const docsTotal = 3, docsDone = 1;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: theme.bg }}>
      {/* Header */}
      <div style={{ background: theme.surface, padding: '14px 16px 10px',
        display: 'flex', alignItems: 'center', gap: 10 }}>
        <div onClick={nav && (() => nav.back())} style={{
          width: 34, height: 34, borderRadius: 17, background: theme.surfaceAlt,
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
        }}><Icon name="back" size={16} /></div>
        <div style={{ flex: 1, textAlign: dir === 'rtl' ? 'right' : 'left' }}>
          <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: 22,
            color: theme.ink, lineHeight: 1.1, letterSpacing: -0.3 }}>{t.profile}</div>
        </div>
        <div style={{
          width: 34, height: 34, borderRadius: 17, background: theme.surfaceAlt,
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
        }}><Icon name="edit" size={16} /></div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '4px 14px 14px' }}>
        {/* Profile hero */}
        <div style={{
          position: 'relative', borderRadius: 18, overflow: 'hidden',
          background: theme.primary, color: theme.surface, padding: '16px 16px 16px',
          textAlign: dir === 'rtl' ? 'right' : 'left'
        }}>
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 64, opacity: 0.35 }}>
            <MountainMotif height={64}
              c1={theme.surface + '20'} c2={theme.surface + '35'} c3={theme.surface + '60'} />
          </div>
          <div style={{ position: 'relative', zIndex: 1,
            display: 'flex', alignItems: 'center', gap: 14,
            flexDirection: dir === 'rtl' ? 'row-reverse' : 'row' }}>
            <div style={{
              width: 60, height: 60, borderRadius: 30, flexShrink: 0,
              background: '#ffffff22', border: `2px solid ${theme.surface}55`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'DM Sans, sans-serif', fontSize: 24, fontWeight: 600,
              letterSpacing: 0.5
            }}>A</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: 26, lineHeight: 1.05 }}>Ali</div>
              <div style={{ fontSize: 12, opacity: 0.9, marginTop: 3,
                display: 'flex', alignItems: 'center', gap: 6,
                flexDirection: dir === 'rtl' ? 'row-reverse' : 'row' }}>
                <Icon name="car" size={13} stroke={theme.surface} />
                Taxi Driver
              </div>
              <div style={{ fontSize: 11.5, opacity: 0.8, marginTop: 3,
                display: 'flex', alignItems: 'center', gap: 6,
                flexDirection: dir === 'rtl' ? 'row-reverse' : 'row' }}>
                <Icon name="pin" size={13} stroke={theme.surface} />
                Hardass Village · Kargil
              </div>
            </div>
          </div>
        </div>

        

        {/* Account */}
        <AcctGroup title="Account" theme={theme} dir={dir}>
          <AcctRow first icon="phone" tint="info" label="Mobile number"
            value="+91 98765 43210" theme={theme} dir={dir}
            trailing={<span style={{ fontSize: 10.5, fontWeight: 700, color: theme.success,
              letterSpacing: 0.3, textTransform: 'uppercase' }}>Verified</span>} />
          <AcctRow icon="pin" tint="accent" label="Your area"
            value="Hardass Village · Kargil" theme={theme} dir={dir} />
          <AcctRow icon="user" tint="primary" label="Name & occupation"
            value="Ali · Taxi Driver" theme={theme} dir={dir} />
        </AcctGroup>

        {/* Preferences */}
        <AcctGroup title="Preferences" theme={theme} dir={dir}>
          <AcctRow first icon="globe" tint="info" label="Language"
            value={lang} theme={theme} dir={dir} />
          <AcctRow icon="image" tint="accent" label="Appearance"
            value={theme.name} theme={theme} dir={dir}
            trailing={<ThemeSwatch theme={theme} />} />
          <AcctRow icon="bell" tint="primary" label="Notifications"
            value="Notices, rides & weather" theme={theme} dir={dir}
            trailing={<Toggle on theme={theme} />} />
        </AcctGroup>

        {/* Sign out */}
        <div style={{ marginTop: 16 }}>
          <div style={{
            background: theme.surface, borderRadius: 16,
            border: `1px solid ${theme.danger}30`,
            padding: '13px 14px', display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: 8, cursor: 'pointer',
            color: theme.danger, fontSize: 13.5, fontWeight: 700
          }}>
            <Icon name="logout" size={16} stroke={theme.danger} />
            Sign out
          </div>
        </div>
      </div>

      <TabBar active="profile" theme={theme} t={t} nav={nav} />
    </div>
  );
}

Object.assign(window, { ScreenAccount });
