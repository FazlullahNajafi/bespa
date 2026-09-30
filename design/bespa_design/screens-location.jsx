// Bespa — Location onboarding flow
// State → District → Block → (Village + Panchayat) / (Town + Municipality) → Summary
// Sits between OTP and Home. The whole flow is hard-anchored to Ladakh/Kargil
// since the product is for that valley, but the cascade is shown end-to-end
// so users feel the geography settle into place.

// ─── Shared bits ─────────────────────────────────────────────────

// Numbered step pill row — sticky under each screen header.
function LocStepper({ step, total = 5, theme, labels }) {
  return (
    <div style={{
      display: 'flex', gap: 6, padding: '10px 16px 12px',
      background: theme.surface, borderBottom: `1px solid ${theme.borderSoft}`
    }}>
      {Array.from({ length: total }).map((_, i) => {
        const done = i < step - 1;
        const active = i === step - 1;
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{
              height: 3, borderRadius: 2,
              background: done || active ? theme.primary : theme.border
            }} />
            <div style={{
              fontSize: 9, fontWeight: 600,
              color: active ? theme.primary : done ? theme.inkSoft : theme.inkFaint,
              letterSpacing: 0.3, textTransform: 'uppercase'
            }}>{labels[i]}</div>
          </div>);

      })}
    </div>);

}

// Breadcrumb chip row — shows what's already chosen.
function LocBreadcrumb({ items, theme }) {
  if (!items.length) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap',
      padding: '12px 16px 0', fontSize: 11, color: theme.inkSoft }}>
      {items.map((it, i) =>
      <React.Fragment key={i}>
          <span style={{
          background: theme.primarySoft, color: theme.primary,
          padding: '3px 8px', borderRadius: 8, fontWeight: 600
        }}>{it}</span>
          {i < items.length - 1 &&
        <svg width="10" height="10" viewBox="0 0 24 24" style={{ color: theme.inkFaint }}>
              <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        }
        </React.Fragment>
      )}
    </div>);

}

// Floating action footer — primary CTA always visible.
function LocFooter({ label, hint, theme, disabled, onTap }) {
  return (
    <div style={{
      background: theme.surface,
      borderTop: `1px solid ${theme.borderSoft}`,
      padding: '12px 16px 14px', flexShrink: 0
    }}>
      {hint &&
      <div style={{ fontSize: 10, color: theme.inkFaint, textAlign: 'center', marginBottom: 8 }}>
          {hint}
        </div>
      }
      <div onClick={disabled ? undefined : onTap} style={{
        background: disabled ? theme.border : theme.primary,
        color: theme.surface,
        borderRadius: 14, padding: '14px 16px', textAlign: 'center',
        fontWeight: 600, fontSize: 14, letterSpacing: 0.2,
        boxShadow: disabled ? 'none' : `0 8px 18px ${theme.primary}40`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        cursor: disabled || !onTap ? 'default' : 'pointer', userSelect: 'none'
      }}>
        <span>{label}</span>
        <Icon name="arrow" size={16} stroke={theme.surface} />
      </div>
    </div>);

}

function LocHeader({ title, sub, theme, t, dir, onBack = false, eyebrow }) {
  const eb = eyebrow === undefined ? t.locWelcome : eyebrow;
  return (
    <div style={{ background: theme.surface, padding: '14px 16px 8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {onBack &&
        <div onClick={typeof onBack === 'function' ? onBack : undefined} style={{
          width: 32, height: 32, borderRadius: 16, background: theme.surfaceAlt,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: typeof onBack === 'function' ? 'pointer' : 'default'
        }}><Icon name="back" size={16} /></div>
        }
        <div style={{ flex: 1, textAlign: dir === 'rtl' ? 'right' : 'left' }}>
          {eb &&
          <div style={{
            fontSize: 10, fontWeight: 700, color: theme.inkFaint,
            letterSpacing: 0.6, textTransform: 'uppercase'
          }}>{eb}</div>
          }
          <div style={{
            fontFamily: 'Instrument Serif, serif', fontSize: 22,
            lineHeight: 1.1, color: theme.ink, marginTop: 2, letterSpacing: -0.3
          }}>{title}</div>
          {sub &&
          <div style={{ fontSize: 11.5, color: theme.inkSoft, marginTop: 4, lineHeight: 1.45 }}>
              {sub}
            </div>
          }
        </div>
      </div>
    </div>);

}

// Selectable row — used in district/block/village lists.
function LocRow({ title, subtitle, meta, selected, theme, dir, leading, accent }) {
  const accentCol = accent || theme.primary;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '11px 12px',
      background: selected ? theme.primarySoft : theme.surface,
      border: `1.5px solid ${selected ? accentCol : theme.borderSoft}`,
      borderRadius: 12,
      textAlign: dir === 'rtl' ? 'right' : 'left'
    }}>
      {leading}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: theme.ink, lineHeight: 1.2 }}>{title}</div>
        {subtitle &&
        <div style={{ fontSize: 10.5, color: theme.inkSoft, marginTop: 2, lineHeight: 1.3,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {subtitle}
          </div>
        }
      </div>
      {meta &&
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
          {meta}
        </div>
      }
      <div style={{
        width: 18, height: 18, borderRadius: 9, flexShrink: 0,
        border: `2px solid ${selected ? accentCol : theme.border}`,
        background: selected ? accentCol : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        {selected &&
        <svg width="10" height="10" viewBox="0 0 24 24">
            <path d="M5 12l5 5L20 7" fill="none" stroke={theme.surface} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        }
      </div>
    </div>);

}

// Tiny stat chip — count + label
function StatChip({ value, label, theme }) {
  return (
    <div style={{ textAlign: 'right' }}>
      <div style={{ fontFamily: 'DM Mono, ui-monospace, monospace',
        fontSize: 12, fontWeight: 600, color: theme.ink, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 9, color: theme.inkFaint, marginTop: 3,
        letterSpacing: 0.3, textTransform: 'uppercase', fontWeight: 600 }}>{label}</div>
    </div>);

}

const STEP_LABELS = ['State', 'Dist', 'Block', 'Area', 'You'];

// ─── 01 · State ──────────────────────────────────────────────────
function ScreenLocState({ theme, t, dir, nav }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: theme.bg }}>
      <LocHeader
        title={t.locState === 'State / UT' ? 'Which state do you live in?' : 'آپ کس ریاست میں رہتے ہیں؟'}
        sub={t.locWhy} theme={theme} t={t} dir={dir} />
      <LocStepper step={1} theme={theme} labels={STEP_LABELS} />

      <div style={{ flex: 1, overflow: 'auto', padding: '14px 14px 8px' }}>
        {/* Hero map placeholder card — Ladakh selected */}
        <div style={{
          position: 'relative', borderRadius: 18, overflow: 'hidden',
          background: theme.primary, color: theme.surface,
          border: `1.5px solid ${theme.primary}`,
          padding: '16px 16px 14px'
        }}>
          {/* layered mountain motif */}
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 96, opacity: 0.45 }}>
            <MountainMotif height={96}
            c1={theme.surface + '20'} c2={theme.surface + '35'} c3={theme.surface + '60'} />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, position: 'relative', zIndex: 1 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, background: theme.accent,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0
            }}>
              <Icon name="mountain" size={20} stroke={theme.surface} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, opacity: 0.8, letterSpacing: 0.6,
                textTransform: 'uppercase', fontWeight: 600 }}>
                {t.locSelected} · Union Territory
              </div>
              <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: 28,
                lineHeight: 1, marginTop: 4 }}>Ladakh</div>
              <div style={{ fontSize: 11, opacity: 0.85, marginTop: 4 }}>
                The cold desert · 2 districts
              </div>
            </div>
            <div style={{
              width: 22, height: 22, borderRadius: 11, background: theme.accent,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24">
                <path d="M5 12l5 5L20 7" fill="none" stroke={theme.surface}
                strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          {/* mini stat strip */}
          <div style={{ display: 'flex', gap: 0, marginTop: 14, position: 'relative', zIndex: 1 }}>
            {[
            { v: '274,289', l: t.locPopulation },
            { v: '59,124', l: t.locHouseholds },
            { v: "59,146 km²", l: t.locArea }].
            map((s, i) =>
            <div key={i} style={{
              flex: 1,
              borderLeft: i > 0 ? `1px solid ${theme.surface}30` : 'none',
              paddingLeft: i > 0 ? 10 : 0
            }}>
                <div style={{ fontFamily: 'DM Mono, ui-monospace, monospace',
                fontSize: 13, fontWeight: 600 }}>{s.v}</div>
                <div style={{ fontSize: 9, opacity: 0.75, marginTop: 2,
                letterSpacing: 0.4, textTransform: 'uppercase', fontWeight: 600 }}>{s.l}</div>
              </div>
            )}
          </div>
        </div>

        {/* Search hint */}
        <div style={{
          marginTop: 12, padding: '10px 12px',
          background: theme.surface, border: `1px solid ${theme.borderSoft}`,
          borderRadius: 12, display: 'flex', alignItems: 'center', gap: 8
        }}>
          <Icon name="search" size={14} stroke={theme.inkFaint} />
          <span style={{ fontSize: 12, color: theme.inkFaint }}>Search other states</span>
        </div>

        {/* faint suggestion strip */}
        <div style={{ marginTop: 14, padding: '0 4px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: theme.inkSoft,
            letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 }}>
            Nearby
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
            { n: 'Jammu & Kashmir', d: '20 districts' },
            { n: 'Himachal Pradesh', d: '12 districts' }].
            map((s) =>
            <div key={s.n} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 12px', background: theme.surface,
              border: `1px solid ${theme.borderSoft}`, borderRadius: 10
            }}>
                <div style={{ width: 28, height: 28, borderRadius: 8,
                background: theme.surfaceAlt, color: theme.inkSoft,
                display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="pin" size={14} stroke={theme.inkSoft} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: theme.ink }}>{s.n}</div>
                  <div style={{ fontSize: 10, color: theme.inkFaint, marginTop: 1 }}>{s.d}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <LocFooter label={t.locContinue} theme={theme} onTap={nav && (() => nav.go('locDistrict'))} />
    </div>);

}

// ─── 02 · District ───────────────────────────────────────────────
function ScreenLocDistrict({ theme, t, dir, nav }) {
  const districts = [
  {
    id: 'kargil', name: 'Kargil', selected: true,
    sub: '\n', pop: '140,802', blocks: 8
  },
  {
    id: 'leh', name: 'Leh', selected: false,
    sub: '\n', pop: '133,487', blocks: 16
  }];


  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: theme.bg }}>
      <LocHeader
        title="Pick your district"
        theme={theme} t={t} dir={dir} onBack={nav && (() => nav.back())} eyebrow={null} />
      <LocStepper step={1} total={3} theme={theme} labels={['Dist', 'Block', 'Area']} />
      <LocBreadcrumb items={['Ladakh']} theme={theme} />

      <div style={{ flex: 1, overflow: 'auto', padding: '12px 14px 8px',
        display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* AUTO-DETECT CARD — primary shortcut through the cascade */}
        <div style={{
          background: theme.surface,
          border: `1.5px solid ${theme.accent}`,
          borderRadius: 16, padding: '14px 14px',
          position: 'relative', overflow: 'hidden',
          textAlign: dir === 'rtl' ? 'right' : 'left'
        }}>
          {/* soft pulse halo behind icon */}
          <div style={{
            position: 'absolute', top: -20, left: dir === 'rtl' ? 'auto' : -20,
            right: dir === 'rtl' ? -20 : 'auto',
            width: 90, height: 90, borderRadius: 45,
            background: theme.accent + '15', pointerEvents: 'none'
          }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12,
            position: 'relative', flexDirection: dir === 'rtl' ? 'row-reverse' : 'row' }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: theme.accent, color: theme.surface,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, boxShadow: `0 6px 14px ${theme.accent}55`
            }}>
              <Icon name="locate" size={22} stroke={theme.surface} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: theme.ink, lineHeight: 1.2 }}>
                Use my location
              </div>
              <div style={{ fontSize: 11, color: theme.inkSoft, marginTop: 3, lineHeight: 1.35 }}>

              </div>
            </div>
          </div>
          <div style={{
            marginTop: 12,
            background: theme.accent, color: theme.surface,
            borderRadius: 12, padding: '11px 14px',
            textAlign: 'center', fontSize: 13.5, fontWeight: 700, letterSpacing: 0.2,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: `0 8px 16px ${theme.accent}40`
          }}>
            <Icon name="locate" size={14} stroke={theme.surface} />
            Detect my location
          </div>
          {/* permission hint */}
          <div style={{
            marginTop: 8, fontSize: 10.5, color: theme.inkFaint,
            textAlign: 'center', lineHeight: 1.45
          }}>

          </div>
        </div>

        {/* OR divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10,
          padding: '2px 4px 2px' }}>
          <div style={{ flex: 1, height: 1, background: theme.border }} />
          <div style={{ fontSize: 10, color: theme.inkFaint, fontWeight: 700,
            letterSpacing: 0.6, textTransform: 'uppercase' }}>or pick manually</div>
          <div style={{ flex: 1, height: 1, background: theme.border }} />
        </div>

        {districts.map((d) =>
        <div key={d.id} style={{
          position: 'relative', borderRadius: 16, overflow: 'hidden',
          background: d.selected ? theme.surface : theme.surface,
          border: `1.5px solid ${d.selected ? theme.primary : theme.borderSoft}`,
          padding: '14px 14px 12px',
          boxShadow: d.selected ? `0 6px 14px ${theme.primary}18` : 'none'
        }}>
            {d.selected &&
          <div style={{
            position: 'absolute', top: 12, right: 12,
            width: 22, height: 22, borderRadius: 11, background: theme.primary,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
                <svg width="12" height="12" viewBox="0 0 24 24">
                  <path d="M5 12l5 5L20 7" fill="none" stroke={theme.surface}
              strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
          }

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: d.selected ? theme.primarySoft : theme.surfaceAlt,
              color: d.selected ? theme.primary : theme.inkSoft,
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
                <Icon name="pin" size={18} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: 22,
                lineHeight: 1, color: theme.ink }}>
                  {d.name}
                </div>
                <div style={{ fontSize: 11, color: theme.inkSoft, marginTop: 3 }}>{d.sub}</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 0, marginTop: 12,
            paddingTop: 10, borderTop: `1px solid ${theme.borderSoft}` }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'DM Mono, ui-monospace, monospace',
                fontSize: 13, fontWeight: 600, color: theme.ink }}>{d.pop}</div>
                <div style={{ fontSize: 9, color: theme.inkFaint, marginTop: 2,
                letterSpacing: 0.4, textTransform: 'uppercase', fontWeight: 600 }}>
                  {t.locPopulation}
                </div>
              </div>
              <div style={{ flex: 1, borderLeft: `1px solid ${theme.borderSoft}`, paddingLeft: 10 }}>
                <div style={{ fontFamily: 'DM Mono, ui-monospace, monospace',
                fontSize: 13, fontWeight: 600, color: theme.ink }}>{d.blocks}</div>
                <div style={{ fontSize: 9, color: theme.inkFaint, marginTop: 2,
                letterSpacing: 0.4, textTransform: 'uppercase', fontWeight: 600 }}>
                  {t.locBlock}s
                </div>
              </div>
              <div style={{ flex: 1, borderLeft: `1px solid ${theme.borderSoft}`, paddingLeft: 10 }}>
                <div style={{ fontFamily: 'DM Mono, ui-monospace, monospace',
                fontSize: 13, fontWeight: 600, color: theme.ink }}>
                  {d.id === 'kargil' ? '129' : '113'}
                </div>
                <div style={{ fontSize: 9, color: theme.inkFaint, marginTop: 2,
                letterSpacing: 0.4, textTransform: 'uppercase', fontWeight: 600 }}>
                  {t.locVillages}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <LocFooter label={t.locContinue} theme={theme} onTap={nav && (() => nav.go('locBlock'))} />
    </div>);

}

// ─── 03 · Block ──────────────────────────────────────────────────
function ScreenLocBlock({ theme, t, dir, nav }) {
  const blocks = [
  { id: 'kargil', n: 'Kargil', v: 19, p: '24,150', sel: true },
  { id: 'sankoo', n: 'Sankoo', v: 22, p: '21,840' },
  { id: 'drass', n: 'Drass', v: 16, p: '15,672' },
  { id: 'taisuru', n: 'Taisuru (T.S.G.)', v: 14, p: '11,210' },
  { id: 'shakar', n: 'Shakar-Chiktan', v: 18, p: '17,406' },
  { id: 'gm-pore', n: 'G.M. Pore', v: 11, p: '9,840' },
  { id: 'trespone', n: 'Trespone', v: 9, p: '7,520' },
  { id: 'bhimbat', n: 'Bhimbat', v: 12, p: '10,160' }];


  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: theme.bg }}>
      <LocHeader
        title="Pick your block"
        theme={theme} t={t} dir={dir} onBack={nav && (() => nav.back())} eyebrow={null} />
      <LocStepper step={2} total={3} theme={theme} labels={['Dist', 'Block', 'Area']} />
      <LocBreadcrumb items={['Ladakh', 'Kargil']} theme={theme} />

      {/* search */}
      <div style={{ padding: '10px 14px 4px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: theme.surface, border: `1px solid ${theme.border}`,
          borderRadius: 12, padding: '9px 12px'
        }}>
          <Icon name="search" size={14} stroke={theme.inkFaint} />
          <span style={{ fontSize: 12, color: theme.inkFaint, flex: 1 }}>
            Search 8 blocks
          </span>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '8px 14px',
        display: 'flex', flexDirection: 'column', gap: 6 }}>
        {blocks.map((b) =>
        <LocRow key={b.id} theme={theme} dir={dir}
        selected={b.sel}
        title={b.n}
        subtitle={`${b.v} villages`}
        leading={
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: b.sel ? theme.primary : theme.surfaceAlt,
          color: b.sel ? theme.surface : theme.inkSoft,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'Instrument Serif, serif', fontSize: 14, flexShrink: 0
        }}>{b.n[0]}</div>
        }
        meta={<StatChip value={b.p} label={t.locPopulation} theme={theme} />} />

        )}
      </div>

      <LocFooter label={t.locContinue} theme={theme} onTap={nav && (() => nav.go('locLocality'))} />
    </div>);

}

// ─── 04 · Locality (Village/Panchayat or Town/Municipality) ─────
function ScreenLocLocality({ theme, t, dir, nav }) {
  const villages = [
  { id: 'hardass', n: 'Hardass', p: 'Pashkum Halqa', pop: '1,842', sel: true },
  { id: 'choskor', n: 'Choskor', p: 'Pashkum Halqa', pop: '1,124' },
  { id: 'minji', n: 'Minji', p: 'Minji Halqa', pop: '2,318' },
  { id: 'pashkum', n: 'Pashkum', p: 'Pashkum Halqa', pop: '3,041' },
  { id: 'lato', n: 'Lato', p: 'Trespone Halqa', pop: '687' },
  { id: 'baroo', n: 'Baroo', p: 'Baroo Halqa', pop: '4,210' }];


  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: theme.bg }}>
      <LocHeader
        title="Pick your village"
        theme={theme} t={t} dir={dir} onBack={nav && (() => nav.back())} eyebrow={null} />
      <LocStepper step={3} total={3} theme={theme} labels={['Dist', 'Block', 'Area']} />
      <LocBreadcrumb items={['Ladakh', 'Kargil', 'Kargil Block']} theme={theme} />

      {/* Rural / Urban segmented control */}
      <div style={{ padding: '10px 14px 0' }}>
        <div style={{
          display: 'flex', gap: 6, background: theme.surfaceAlt,
          borderRadius: 12, padding: 4
        }}>
          {[
          { id: 'rural', label: t.locRural, sub: t.locRuralSub, icon: 'mountain', on: true },
          { id: 'urban', label: t.locUrban, sub: t.locUrbanSub, icon: 'home', on: false }].
          map((seg) =>
          <div key={seg.id} style={{
            flex: 1, padding: '8px 10px', borderRadius: 9,
            background: seg.on ? theme.surface : 'transparent',
            boxShadow: seg.on ? `0 2px 6px ${theme.ink}15` : 'none',
            display: 'flex', alignItems: 'center', gap: 8
          }}>
              <div style={{
              width: 26, height: 26, borderRadius: 7,
              background: seg.on ? theme.primarySoft : 'transparent',
              color: seg.on ? theme.primary : theme.inkFaint,
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}><Icon name={seg.icon} size={14} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600,
                color: seg.on ? theme.ink : theme.inkSoft, lineHeight: 1 }}>{seg.label}</div>
                <div style={{ fontSize: 9, color: theme.inkFaint, marginTop: 2,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {seg.sub}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* search */}
      <div style={{ padding: '10px 14px 4px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: theme.surface, border: `1px solid ${theme.border}`,
          borderRadius: 12, padding: '9px 12px'
        }}>
          <Icon name="search" size={14} stroke={theme.inkFaint} />
          <span style={{ fontSize: 12, color: theme.inkFaint, flex: 1 }}>
            {t.locSearchPlace}
          </span>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '6px 14px 10px',
        display: 'flex', flexDirection: 'column', gap: 6 }}>
        {villages.map((v) =>
        <LocRow key={v.id} theme={theme} dir={dir}
        selected={v.sel}
        title={v.n}
        subtitle={v.p}
        leading={
        <div style={{
          width: 32, height: 32, borderRadius: 16,
          background: v.sel ? theme.accent : theme.surfaceAlt,
          color: v.sel ? theme.surface : theme.inkSoft,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
        }}>
                <Icon name="home" size={15} />
              </div>
        }
        meta={<StatChip value={v.pop} label="pop." theme={theme} />}
        accent={theme.accent} />

        )}

        {/* If urban: shown as ghost preview at bottom */}
        <div style={{
          marginTop: 6, padding: '10px 12px',
          background: theme.surface, border: `1.5px dashed ${theme.border}`,
          borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 7, background: theme.surfaceAlt,
            color: theme.inkFaint,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}><Icon name="flag" size={14} /></div>
          <div style={{ flex: 1, fontSize: 11, color: theme.inkSoft, lineHeight: 1.35 }}>
            Living in <strong style={{ color: theme.ink }}>Kargil town</strong>?
            <br />Switch to <em>Town</em> above for Municipal Committee data.
          </div>
        </div>
      </div>

      <LocFooter label={t.locContinue} theme={theme} onTap={nav && (() => nav.go('locSummary'))} />
    </div>);

}

// ─── 05 · Summary ────────────────────────────────────────────────
function ScreenLocSummary({ theme, t, dir, nav }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: theme.bg }}>
      <LocHeader
        title={t.locReady}
        sub={t.locReadySub}
        theme={theme} t={t} dir={dir} onBack={nav && (() => nav.back())} />
      <LocStepper step={5} theme={theme} labels={STEP_LABELS} />

      <div style={{ flex: 1, overflow: 'auto', padding: '14px 14px 8px' }}>
        {/* Hero summary card */}
        <div style={{
          position: 'relative', borderRadius: 18, overflow: 'hidden',
          background: theme.primary, color: theme.surface,
          padding: '16px 16px 16px'
        }}>
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 100, opacity: 0.35 }}>
            <MountainMotif height={100}
            c1={theme.surface + '20'} c2={theme.surface + '35'} c3={theme.surface + '60'} />
          </div>

          {/* breadcrumb cascade */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap',
            fontSize: 10, opacity: 0.85, position: 'relative', zIndex: 1, letterSpacing: 0.3 }}>
            {['Ladakh', 'Kargil', 'Kargil Block', 'Pashkum Halqa'].map((b, i, arr) =>
            <React.Fragment key={i}>
                <span style={{ fontWeight: 600 }}>{b}</span>
                {i < arr.length - 1 &&
              <svg width="10" height="10" viewBox="0 0 24 24">
                    <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
              }
              </React.Fragment>
            )}
          </div>

          <div style={{ marginTop: 8, position: 'relative', zIndex: 1 }}>
            <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: 36,
              lineHeight: 1, letterSpacing: -0.5 }}>Hardass</div>
            <div style={{ fontSize: 11, opacity: 0.85, marginTop: 4 }}>
              Village · Rural · 2,738 m elevation
            </div>
          </div>

          {/* primary stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr',
            gap: 10, marginTop: 16, position: 'relative', zIndex: 1 }}>
            {[
            { v: '1,842', l: t.locPopulation },
            { v: '298', l: t.locHouseholds }].
            map((s) =>
            <div key={s.l} style={{
              background: '#ffffff18', borderRadius: 12,
              padding: '10px 12px'
            }}>
                <div style={{ fontFamily: 'Instrument Serif, serif',
                fontSize: 28, lineHeight: 1 }}>{s.v}</div>
                <div style={{ fontSize: 9, opacity: 0.85, marginTop: 4,
                letterSpacing: 0.4, textTransform: 'uppercase', fontWeight: 600 }}>
                  {s.l}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* secondary stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: 8, marginTop: 10 }}>
          {[
          { l: t.locSexRatio, v: '973', s: 'F/1000 M', icon: 'people', acc: 'info' },
          { l: t.locLiteracy, v: '71%', s: 'Avg.', icon: 'file', acc: 'success' },
          { l: t.locArea, v: '4.2', s: 'km²', icon: 'pin', acc: 'primary' },
          { l: 'Avg. HH size', v: '6.2', s: 'persons', icon: 'home', acc: 'accent' }].
          map((s, i) => {
            const col = { primary: theme.primary, accent: theme.accent,
              info: theme.info, success: theme.success }[s.acc];
            const soft = { primary: theme.primarySoft, accent: theme.accentSoft,
              info: theme.borderSoft, success: theme.borderSoft }[s.acc];
            return (
              <div key={i} style={{
                background: theme.surface, border: `1px solid ${theme.borderSoft}`,
                borderRadius: 14, padding: '11px 12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: 6,
                    background: soft, color: col,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}><Icon name={s.icon} size={12} /></div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: theme.inkSoft,
                    letterSpacing: 0.4, textTransform: 'uppercase' }}>{s.l}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 6 }}>
                  <div style={{ fontFamily: 'Instrument Serif, serif',
                    fontSize: 22, color: theme.ink, lineHeight: 1 }}>{s.v}</div>
                  <div style={{ fontSize: 10, color: theme.inkFaint }}>{s.s}</div>
                </div>
              </div>);

          })}
        </div>

        {/* what you'll see */}
        <div style={{
          marginTop: 12, background: theme.surface,
          border: `1px solid ${theme.borderSoft}`, borderRadius: 14,
          padding: '12px 14px'
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: theme.inkSoft,
            letterSpacing: 0.5, textTransform: 'uppercase' }}>
            What Bespa will localise
          </div>
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
            { i: 'bell', t: 'Panchayat & block notices' },
            { i: 'car', t: 'Shared cabs from Kargil → your village' },
            { i: 'cloud', t: 'Weather for Hardass, not Leh' },
            { i: 'people', t: 'Members of your gram panchayat' }].
            map((row, i) =>
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                width: 26, height: 26, borderRadius: 7,
                background: theme.primarySoft, color: theme.primary,
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}><Icon name={row.i} size={13} /></div>
                <span style={{ fontSize: 12, color: theme.ink, fontWeight: 500 }}>{row.t}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <LocFooter
        label="Enter Bespa"
        hint={t.locChangeAnytime}
        onTap={nav && (() => nav.reset('home'))}
        theme={theme} />
    </div>);

}

Object.assign(window, {
  ScreenLocState, ScreenLocDistrict, ScreenLocBlock,
  ScreenLocLocality, ScreenLocSummary
});