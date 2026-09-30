// Bespa — Profile setup (name + occupation)
// Sits between OTP and the Location flow. Two layout variants are exported:
//   • ScreenProfileGrid — visual tile grid for occupation, name on top
//   • ScreenProfileList — list-style occupation with separated name card
// Both reuse Loc* shell pieces (LocStepper, LocFooter) so the onboarding
// reads as one continuous flow.

// ─── Shared occupation registry ──────────────────────────────────
// (icon + tint pulled from the existing icon set / theme tokens; no new
// art assets introduced)
function getOccupations(t) {
  return [
    { id: 'farmer',   icon: 'mountain', tint: 'accent',  label: t.occFarmer,   sub: t.occFarmerSub },
    { id: 'driver',   icon: 'car',      tint: 'primary', label: t.occDriver,   sub: t.occDriverSub },
    { id: 'shop',     icon: 'home',     tint: 'success', label: t.occShop,     sub: t.occShopSub },
    { id: 'official', icon: 'flag',     tint: 'info',    label: t.occOfficial, sub: t.occOfficialSub },
    { id: 'teacher',  icon: 'file',     tint: 'primary', label: t.occTeacher,  sub: t.occTeacherSub },
    { id: 'health',   icon: 'heart',    tint: 'danger',  label: t.occHealth,   sub: t.occHealthSub },
    { id: 'student',  icon: 'spark',    tint: 'accent',  label: t.occStudent,  sub: t.occStudentSub },
    { id: 'guide',    icon: 'pin',      tint: 'info',    label: t.occGuide,    sub: t.occGuideSub },
    { id: 'home',     icon: 'people',   tint: 'success', label: t.occHome,     sub: t.occHomeSub },
    { id: 'artisan',  icon: 'settings', tint: 'accent',  label: t.occArtisan,  sub: t.occArtisanSub },
    { id: 'other',    icon: 'plus',     tint: 'primary', label: t.occOther,    sub: t.occOtherSub },
  ];
}

function tintFor(theme, tint) {
  return {
    primary: [theme.primarySoft, theme.primary],
    accent:  [theme.accentSoft,  theme.accent],
    info:    [theme.borderSoft,  theme.info],
    success: [theme.borderSoft,  theme.success],
    danger:  [theme.borderSoft,  theme.danger],
  }[tint] || [theme.primarySoft, theme.primary];
}

// ─── Variant A · Tile-grid occupation picker ─────────────────────
// Name field + warm hero, occupation as 2-up icon cards. Reads as the
// glossier of the two — works well for first-time users.
function ScreenProfileGrid({ theme, t, dir, nav }) {
  const occupations = getOccupations(t);
  const selected = 'farmer'; // demo state

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: theme.bg }}>
      {/* Hero header */}
      <div style={{
        position: 'relative', background: theme.surface,
        padding: '14px 16px 16px', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 70, opacity: 0.55, pointerEvents: 'none' }}>
          <MountainMotif height={70}
            c1={theme.primary + '12'}
            c2={theme.primary + '22'}
            c3={theme.primary + '38'}/>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative', zIndex: 1 }}>
          <div onClick={nav && (() => nav.back())} style={{
            width: 32, height: 32, borderRadius: 16, background: theme.surfaceAlt,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: nav ? 'pointer' : 'default',
          }}><Icon name="back" size={16}/></div>
          <div style={{ flex: 1, textAlign: dir === 'rtl' ? 'right' : 'left' }}>
            <div style={{
              fontSize: 10, fontWeight: 700, color: theme.inkFaint,
              letterSpacing: 0.6, textTransform: 'uppercase',
            }}>{t.welcome}</div>
            <div style={{
              fontFamily: 'Instrument Serif, serif', fontSize: 24,
              lineHeight: 1.1, color: theme.ink, marginTop: 2, letterSpacing: -0.3,
            }}>{t.profileTitle}</div>
            <div style={{ fontSize: 11.5, color: theme.inkSoft, marginTop: 4, lineHeight: 1.45 }}>
              {t.profileSub}
            </div>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '14px 14px 8px' }}>
        {/* Name field */}
        <div style={{ textAlign: dir === 'rtl' ? 'right' : 'left' }}>
          <div style={{
            fontSize: 10, fontWeight: 700, color: theme.inkSoft,
            letterSpacing: 0.5, textTransform: 'uppercase',
            paddingLeft: 4,
          }}>{t.nameLabel}</div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: theme.surface, border: `1.5px solid ${theme.primary}`,
            borderRadius: 14, padding: '13px 14px', marginTop: 8,
            boxShadow: `0 0 0 4px ${theme.primary}15`,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 16,
              background: theme.accentSoft, color: theme.accent,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'Instrument Serif, serif', fontSize: 15, fontWeight: 600,
              flexShrink: 0,
            }}>T</div>
            <div style={{ flex: 1,
              fontSize: 16, fontWeight: 600, color: theme.ink, letterSpacing: 0.1 }}>
              Tashi Ali
              <span style={{ display: 'inline-block', width: 1.5, height: 18,
                background: theme.primary, marginLeft: 2, verticalAlign: -3,
                animation: 'none' }}/>
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, color: theme.success,
              letterSpacing: 0.4, textTransform: 'uppercase' }}>✓</span>
          </div>
          <div style={{ fontSize: 10.5, color: theme.inkFaint, marginTop: 6, paddingLeft: 4 }}>
            {t.nameHint}
          </div>
        </div>

        {/* Occupation grid */}
        <div style={{ marginTop: 18, textAlign: dir === 'rtl' ? 'right' : 'left' }}>
          <div style={{
            fontSize: 10, fontWeight: 700, color: theme.inkSoft,
            letterSpacing: 0.5, textTransform: 'uppercase',
            paddingLeft: 4, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
          }}>
            <span>{t.occupationLabel}</span>
            <span style={{ fontSize: 9, fontWeight: 500,
              color: theme.inkFaint, textTransform: 'none', letterSpacing: 0 }}>
              {t.occupationHint}
            </span>
          </div>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr',
            gap: 8, marginTop: 10,
          }}>
            {occupations.map(o => {
              const isSel = o.id === selected;
              const [soft, solid] = tintFor(theme, o.tint);
              return (
                <div key={o.id} style={{
                  position: 'relative',
                  background: isSel ? theme.surface : theme.surface,
                  border: `1.5px solid ${isSel ? solid : theme.borderSoft}`,
                  borderRadius: 14, padding: '11px 11px 12px',
                  boxShadow: isSel ? `0 6px 14px ${solid}25` : 'none',
                  textAlign: dir === 'rtl' ? 'right' : 'left',
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 9,
                    background: isSel ? solid : soft,
                    color: isSel ? theme.surface : solid,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}><Icon name={o.icon} size={17}/></div>
                  <div style={{ marginTop: 8, fontSize: 12.5, fontWeight: 600,
                    color: theme.ink, lineHeight: 1.2 }}>{o.label}</div>
                  <div style={{ fontSize: 10, color: theme.inkSoft,
                    marginTop: 3, lineHeight: 1.3,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {o.sub}
                  </div>
                  {isSel && (
                    <div style={{
                      position: 'absolute', top: 8, right: 8,
                      width: 18, height: 18, borderRadius: 9, background: solid,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <svg width="10" height="10" viewBox="0 0 24 24">
                        <path d="M5 12l5 5L20 7" fill="none" stroke={theme.surface}
                          strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <LocFooter label={t.profileContinue} theme={theme} onTap={nav && (() => nav.go('locState'))}/>
    </div>
  );
}

// ─── Variant B · List-style with hero name card ──────────────────
// Big "card" name input that doubles as a preview of how the user
// will appear in the directory; occupation is a compact list with
// radio-style selection. Calmer, easier to scan with long fingers.
function ScreenProfileList({ theme, t, dir }) {
  const occupations = getOccupations(t);
  const selected = 'driver'; // demo state — different from grid to show variety

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: theme.bg }}>
      {/* Header */}
      <div style={{ background: theme.surface, padding: '14px 16px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 16, background: theme.surfaceAlt,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}><Icon name="back" size={16}/></div>
          <div style={{ flex: 1, textAlign: dir === 'rtl' ? 'right' : 'left' }}>
            <div style={{
              fontSize: 10, fontWeight: 700, color: theme.inkFaint,
              letterSpacing: 0.6, textTransform: 'uppercase',
            }}>{t.welcome}</div>
            <div style={{
              fontFamily: 'Instrument Serif, serif', fontSize: 22,
              lineHeight: 1.1, color: theme.ink, marginTop: 2, letterSpacing: -0.3,
            }}>{t.profileTitle}</div>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '12px 14px 8px' }}>
        {/* Hero name card — shows how the user will appear */}
        <div style={{
          position: 'relative', borderRadius: 16, overflow: 'hidden',
          background: theme.primary, color: theme.surface,
          padding: '14px 14px 14px',
        }}>
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 60, opacity: 0.35 }}>
            <MountainMotif height={60}
              c1={theme.surface + '20'} c2={theme.surface + '35'} c3={theme.surface + '60'}/>
          </div>
          <div style={{
            fontSize: 10, opacity: 0.85, fontWeight: 600,
            letterSpacing: 0.5, textTransform: 'uppercase',
            position: 'relative', zIndex: 1,
          }}>{t.nameLabel}</div>

          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, marginTop: 10,
            position: 'relative', zIndex: 1,
          }}>
            {/* Avatar slot — empty, tappable, with camera + add badge */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div style={{
                width: 56, height: 56, borderRadius: 28,
                background: '#ffffff18',
                border: `1.5px dashed ${theme.surface}66`,
                color: theme.surface,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {/* camera icon */}
                <svg width="22" height="22" viewBox="0 0 24 24">
                  <path d="M4 8h3.5l1.5-2h6l1.5 2H20a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"
                    fill="none" stroke={theme.surface} strokeWidth="1.5"
                    strokeLinecap="round" strokeLinejoin="round" opacity="0.9"/>
                  <circle cx="12" cy="13" r="3.2" fill="none" stroke={theme.surface}
                    strokeWidth="1.5"/>
                </svg>
              </div>
              {/* + badge */}
              <div style={{
                position: 'absolute', right: -2, bottom: -2,
                width: 20, height: 20, borderRadius: 10,
                background: theme.accent, color: theme.surface,
                border: `2px solid ${theme.primary}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 700, lineHeight: 1,
              }}>+</div>
            </div>

            {/* Name input — real input field on the hero */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <input
                type="text"
                placeholder="Type your name"
                defaultValue=""
                autoFocus
                className="bespa-hero-input"
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  borderBottom: `1.5px solid ${theme.surface}55`,
                  padding: '4px 0 6px',
                  fontFamily: 'Instrument Serif, serif',
                  fontSize: 24, lineHeight: 1.1, letterSpacing: -0.4,
                  color: theme.surface,
                  caretColor: theme.surface,
                }}/>
            </div>
          </div>
        </div>

        {/* Occupation list */}
        <div style={{ marginTop: 14, textAlign: dir === 'rtl' ? 'right' : 'left' }}>
          <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            paddingLeft: 4, paddingRight: 4, marginBottom: 8,
          }}>
            <div style={{
              fontSize: 10, fontWeight: 700, color: theme.inkSoft,
              letterSpacing: 0.5, textTransform: 'uppercase',
            }}>{t.occupationLabel}</div>
            <div style={{ fontSize: 9, fontWeight: 500, color: theme.inkFaint }}>
              {t.profileOptional}
            </div>
          </div>

          <div style={{
            background: theme.surface, borderRadius: 14,
            border: `1px solid ${theme.borderSoft}`, overflow: 'hidden',
          }}>
            {occupations.slice(0, 7).map((o, i) => {
              const isSel = o.id === selected;
              const [soft, solid] = tintFor(theme, o.tint);
              return (
                <div key={o.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '11px 12px',
                  borderTop: i === 0 ? 'none' : `1px solid ${theme.borderSoft}`,
                  background: isSel ? theme.primarySoft : 'transparent',
                }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: 8,
                    background: isSel ? solid : soft,
                    color: isSel ? theme.surface : solid,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}><Icon name={o.icon} size={15}/></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: theme.ink, lineHeight: 1.2 }}>
                      {o.label}
                    </div>
                    <div style={{ fontSize: 10.5, color: theme.inkSoft, marginTop: 2,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {o.sub}
                    </div>
                  </div>
                  <div style={{
                    width: 18, height: 18, borderRadius: 9,
                    border: `2px solid ${isSel ? theme.primary : theme.border}`,
                    background: isSel ? theme.primary : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    {isSel && <div style={{ width: 7, height: 7, borderRadius: 4, background: theme.surface }}/>}
                  </div>
                </div>
              );
            })}
            <div style={{
              padding: '11px 12px', borderTop: `1px solid ${theme.borderSoft}`,
              display: 'flex', alignItems: 'center', gap: 8,
              color: theme.inkSoft, fontSize: 12, fontWeight: 500,
            }}>
              <div style={{
                width: 22, height: 22, borderRadius: 11, background: theme.surfaceAlt,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}><Icon name="plus" size={12} stroke={theme.inkSoft}/></div>
              <span>Show {occupations.length - 7} more</span>
            </div>
          </div>
        </div>
      </div>

      <LocFooter label={t.profileContinue} theme={theme}/>
    </div>
  );
}

Object.assign(window, { ScreenProfileGrid, ScreenProfileList });
