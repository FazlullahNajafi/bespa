// Bespa — MGNREGA tracker
// Two variants explore the same data through different lenses:
//   • ScreenNregaDashboard — guarantee days first; payment status secondary
//   • ScreenNregaLedger    — wages ledger first; days/worksite secondary
//
// Shared mock data so both screens read as the same household, just framed
// differently. Numbers chosen to land mid-cycle with a realistic mix of paid
// and pending entries (NREGA wage delays are the headline pain point).

const NREGA_HH = {
  card: 'JK-19-002-008 / 132',
  holder: 'Hassan Ali',
  wage: 257,             // ₹/day, J&K MGNREGA wage rate
  daysWorked: 47,
  daysGuaranteed: 100,
  fy: '2025–26',
  earned: 12079,
  pending: 2313,
  pendingDays: 12,
  site: 'Sankoo Check Dam · Phase 2',
  siteDay: 8,
  siteTotal: 14,
  todayPresent: true,
};

const NREGA_ENTRIES = [
  { range: '10 – 15 Mar', site: 'Sankoo Check Dam',  days: 6, amt: 1542, status: 'pending', overdue: 12 },
  { range: '01 – 06 Mar', site: 'Hardass Road',      days: 6, amt: 1542, status: 'pending', overdue: 4 },
  { range: '22 – 28 Feb', site: 'Hardass Road',      days: 6, amt: 1542, status: 'paid', paidOn: '04 Mar' },
  { range: '08 – 14 Feb', site: 'School wall',       days: 6, amt: 1542, status: 'paid', paidOn: '21 Feb' },
  { range: '20 – 26 Jan', site: 'Drainage line',     days: 6, amt: 1542, status: 'paid', paidOn: '02 Feb' },
  { range: '04 – 10 Jan', site: 'Plantation drive',  days: 5, amt: 1285, status: 'paid', paidOn: '17 Jan' },
  { range: '18 – 24 Dec', site: 'Anganwadi repair',  days: 6, amt: 1542, status: 'paid', paidOn: '30 Dec' },
  { range: '01 – 07 Dec', site: 'Sankoo Check Dam',  days: 6, amt: 1542, status: 'paid', paidOn: '14 Dec' },
];

// ─── Small helpers ───────────────────────────────────────────────
const inr = (n) => '₹' + n.toLocaleString('en-IN');

// Circular SVG ring — % filled with primary track behind
function ProgressRing({ value, total, size = 116, stroke = 10, theme, accent }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(1, value / total);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none"
              stroke={theme.borderSoft} strokeWidth={stroke}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none"
              stroke={accent || theme.accent} strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={c * (1 - pct)}
              transform={`rotate(-90 ${size/2} ${size/2})`}/>
    </svg>
  );
}

// Dotted day-strip — N dots, first M filled. Shows where you are inside
// the current worksite cycle.
function DayStrip({ done, total, theme, accent }) {
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={{
          width: 8, height: 8, borderRadius: 4,
          background: i < done ? (accent || theme.accent)
                    : i === done ? theme.ink
                    : theme.borderSoft,
          opacity: i === done ? 0.5 : 1,
        }}/>
      ))}
    </div>
  );
}

const StatusPill = ({ kind, theme, label }) => {
  const map = {
    paid:    { bg: theme.success + '22', fg: theme.success },
    pending: { bg: theme.danger  + '22', fg: theme.danger  },
    present: { bg: theme.success + '22', fg: theme.success },
  };
  const c = map[kind] || { bg: theme.borderSoft, fg: theme.inkSoft };
  return (
    <span style={{
      padding: '3px 8px', borderRadius: 999,
      background: c.bg, color: c.fg,
      fontSize: 10, fontWeight: 700, letterSpacing: 0.4,
      textTransform: 'uppercase', whiteSpace: 'nowrap',
    }}>{label}</span>
  );
};

// ─── Variant A · Dashboard ───────────────────────────────────────
function ScreenNregaDashboard({ theme, t, dir }) {
  const h = NREGA_HH;
  const remaining = h.daysGuaranteed - h.daysWorked;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: theme.bg }}>
      <Header title="MGNREGA" subtitle={`Job card · ${h.card}`}
              theme={theme} t={t} onBack dir={dir} motif
              action={<Icon name="file" size={18} stroke={theme.ink}/>}/>

      <div style={{ flex: 1, overflow: 'auto', padding: '4px 14px 14px' }}>

        {/* HERO — progress ring + summary */}
        <div style={{
          background: theme.surface, borderRadius: 18,
          border: `1px solid ${theme.borderSoft}`,
          padding: '16px 16px', marginBottom: 10,
          display: 'flex', alignItems: 'center', gap: 14,
          textAlign: dir === 'rtl' ? 'right' : 'left',
          flexDirection: dir === 'rtl' ? 'row-reverse' : 'row',
        }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <ProgressRing value={h.daysWorked} total={h.daysGuaranteed}
                          theme={theme} size={104} stroke={9}/>
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{
                fontFamily: 'Instrument Serif, serif',
                fontSize: 30, lineHeight: 1, color: theme.ink,
              }}>{h.daysWorked}</div>
              <div style={{ fontSize: 10, color: theme.inkFaint,
                marginTop: 2, letterSpacing: 0.4 }}>of {h.daysGuaranteed} days</div>
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: theme.inkFaint,
              letterSpacing: 0.5, textTransform: 'uppercase' }}>FY {h.fy}</div>
            <div style={{ fontFamily: 'Instrument Serif, serif',
              fontSize: 19, lineHeight: 1.15, color: theme.ink, marginTop: 4 }}>
              {remaining} days left in your guarantee
            </div>
            <div style={{
              marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6,
              background: theme.primarySoft, color: theme.primary,
              padding: '4px 10px', borderRadius: 999,
              fontSize: 11, fontWeight: 600,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: 4, background: theme.primary }}/>
              Wage {inr(h.wage)} / day
            </div>
          </div>
        </div>

        {/* ACTIVE WORK */}
        <div style={{
          background: theme.surface, borderRadius: 14,
          border: `1px solid ${theme.borderSoft}`,
          padding: '12px 14px', marginBottom: 10,
          textAlign: dir === 'rtl' ? 'right' : 'left',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: theme.inkFaint,
              letterSpacing: 0.5, textTransform: 'uppercase' }}>Current worksite</div>
            {h.todayPresent && <StatusPill kind="present" theme={theme} label="✓ Present today"/>}
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: theme.ink, marginTop: 6, lineHeight: 1.3 }}>
            {h.site}
          </div>
          <div style={{ fontSize: 11.5, color: theme.inkSoft, marginTop: 3 }}>
            Day <span style={{ color: theme.ink, fontWeight: 600 }}>{h.siteDay}</span> of {h.siteTotal} · Mate Stanzin W.
          </div>
          <div style={{ marginTop: 10 }}>
            <DayStrip done={h.siteDay} total={h.siteTotal} theme={theme}/>
          </div>
        </div>

        {/* WAGES — 2 columns */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
          <div style={{
            background: theme.surface, borderRadius: 14,
            border: `1px solid ${theme.borderSoft}`,
            padding: '12px 14px',
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: theme.inkFaint,
              letterSpacing: 0.5, textTransform: 'uppercase' }}>Earned</div>
            <div style={{
              fontFamily: 'Instrument Serif, serif',
              fontSize: 22, color: theme.ink, marginTop: 4, lineHeight: 1,
            }}>{inr(h.earned)}</div>
            <div style={{ fontSize: 10.5, color: theme.success, fontWeight: 600, marginTop: 4 }}>
              ▲ {inr(1542)} this week
            </div>
          </div>
          <div style={{
            background: theme.danger + '0d', borderRadius: 14,
            border: `1px solid ${theme.danger}33`,
            padding: '12px 14px',
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: theme.danger,
              letterSpacing: 0.5, textTransform: 'uppercase' }}>Pending</div>
            <div style={{
              fontFamily: 'Instrument Serif, serif',
              fontSize: 22, color: theme.ink, marginTop: 4, lineHeight: 1,
            }}>{inr(h.pending)}</div>
            <div style={{ fontSize: 10.5, color: theme.danger, fontWeight: 600, marginTop: 4 }}>
              {h.pendingDays}d overdue · 2 entries
            </div>
          </div>
        </div>

        {/* RECENT MUSTER ROLL */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
          padding: '6px 4px 8px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: theme.inkSoft,
            letterSpacing: 0.5, textTransform: 'uppercase' }}>Recent muster</div>
          <div style={{ fontSize: 11, color: theme.primary, fontWeight: 600 }}>See all</div>
        </div>

        <div style={{
          background: theme.surface, borderRadius: 14,
          border: `1px solid ${theme.borderSoft}`,
          overflow: 'hidden',
        }}>
          {NREGA_ENTRIES.slice(0, 4).map((e, i) => (
            <div key={i} style={{
              padding: '10px 14px',
              borderTop: i === 0 ? 'none' : `1px solid ${theme.borderSoft}`,
              display: 'flex', alignItems: 'center', gap: 10,
              textAlign: dir === 'rtl' ? 'right' : 'left',
              flexDirection: dir === 'rtl' ? 'row-reverse' : 'row',
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 9,
                background: e.status === 'paid' ? theme.success + '18' : theme.danger + '18',
                color: e.status === 'paid' ? theme.success : theme.danger,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Icon name={e.status === 'paid' ? 'flag' : 'clock'} size={16}/>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: theme.ink,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {e.site}
                </div>
                <div style={{ fontSize: 10.5, color: theme.inkFaint, marginTop: 2 }}>
                  {e.range} · {e.days} days
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: theme.ink,
                  fontFamily: 'DM Mono, monospace' }}>{inr(e.amt)}</div>
                <div style={{ fontSize: 9.5, fontWeight: 700, marginTop: 2,
                  color: e.status === 'paid' ? theme.success : theme.danger,
                  letterSpacing: 0.4, textTransform: 'uppercase' }}>
                  {e.status === 'paid' ? `Paid ${e.paidOn}` : `${e.overdue}d late`}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* DEMAND WORK CTA */}
        <div style={{
          marginTop: 12,
          background: theme.primary, color: theme.surface,
          borderRadius: 14, padding: '12px 14px',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Need more work?</div>
            <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>
              Apply for the next 14-day cycle at the Panchayat
            </div>
          </div>
          <div style={{
            padding: '7px 12px', borderRadius: 10,
            background: theme.surface, color: theme.primary,
            fontSize: 11.5, fontWeight: 700, flexShrink: 0,
          }}>Apply</div>
        </div>

      </div>
    </div>
  );
}

// ─── Variant B · Ledger ──────────────────────────────────────────
function ScreenNregaLedger({ theme, t, dir }) {
  const h = NREGA_HH;
  const filters = ['All', 'Pending', 'Paid', 'Disputed'];
  const activeFilter = 0;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: theme.bg }}>
      <Header title="Wages & Payments" subtitle={`MGNREGA · ${h.card}`}
              theme={theme} t={t} onBack dir={dir}
              action={<Icon name="search" size={20} stroke={theme.ink}/>}/>

      {/* Big balance hero — payments-first */}
      <div style={{
        margin: '4px 14px 10px',
        background: `linear-gradient(160deg, ${theme.primary} 0%, ${theme.ink} 100%)`,
        borderRadius: 18, padding: '16px 16px 14px',
        color: '#fff', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.18, pointerEvents: 'none' }}>
          <MountainMotif height={140} c1="#ffffff20" c2="#ffffff35" c3="#ffffff55"/>
        </div>
        <div style={{ position: 'relative', zIndex: 1,
          textAlign: dir === 'rtl' ? 'right' : 'left' }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.6,
            textTransform: 'uppercase', opacity: 0.75 }}>Earned · FY {h.fy}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
            <div style={{ fontFamily: 'Instrument Serif, serif',
              fontSize: 38, lineHeight: 1 }}>{inr(h.earned)}</div>
            <div style={{ fontSize: 11, opacity: 0.8 }}>· {h.daysWorked} days</div>
          </div>

          {/* Sub-tabs */}
          <div style={{ display: 'flex', gap: 4, marginTop: 12,
            background: 'rgba(255,255,255,0.12)', padding: 3, borderRadius: 10,
            width: 'fit-content',
          }}>
            {['This year', 'Lifetime', 'Bank'].map((tab, i) => (
              <div key={tab} style={{
                padding: '5px 12px', borderRadius: 8,
                fontSize: 11, fontWeight: 600,
                background: i === 0 ? '#ffffff' : 'transparent',
                color: i === 0 ? theme.primary : 'rgba(255,255,255,0.85)',
              }}>{tab}</div>
            ))}
          </div>
        </div>
      </div>

      {/* Pending callout */}
      <div style={{
        margin: '0 14px 10px',
        background: theme.danger + '12',
        border: `1px solid ${theme.danger}33`,
        borderRadius: 12, padding: '10px 12px',
        display: 'flex', alignItems: 'center', gap: 10,
        textAlign: dir === 'rtl' ? 'right' : 'left',
        flexDirection: dir === 'rtl' ? 'row-reverse' : 'row',
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: theme.danger, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}><Icon name="clock" size={18} stroke="#fff"/></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: theme.ink }}>
            {inr(h.pending)} pending · 2 entries
          </div>
          <div style={{ fontSize: 10.5, color: theme.inkSoft, marginTop: 2 }}>
            Oldest entry overdue by {h.pendingDays} days · raise grievance
          </div>
        </div>
        <Icon name="arrow" size={18} stroke={theme.danger}/>
      </div>

      {/* Filter chips */}
      <div style={{ display: 'flex', gap: 6, padding: '0 14px 8px', flexShrink: 0,
        overflowX: 'auto' }}>
        {filters.map((c, i) => (
          <div key={c} style={{
            padding: '6px 12px', borderRadius: 16,
            background: i === activeFilter ? theme.ink : theme.surface,
            color: i === activeFilter ? theme.surface : theme.inkSoft,
            fontSize: 11.5, fontWeight: 600,
            border: `1px solid ${i === activeFilter ? theme.ink : theme.border}`,
            whiteSpace: 'nowrap',
          }}>{c}</div>
        ))}
      </div>

      {/* Ledger entries */}
      <div style={{ flex: 1, overflow: 'auto', padding: '4px 14px 14px' }}>
        {NREGA_ENTRIES.map((e, i) => {
          const paid = e.status === 'paid';
          return (
            <div key={i} style={{
              background: theme.surface, borderRadius: 14,
              border: `1px solid ${theme.borderSoft}`,
              padding: '12px 14px', marginBottom: 8,
              textAlign: dir === 'rtl' ? 'right' : 'left',
              borderLeft: dir === 'rtl' ? undefined : `3px solid ${paid ? theme.success : theme.danger}`,
              borderRight: dir === 'rtl' ? `3px solid ${paid ? theme.success : theme.danger}` : undefined,
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10.5, color: theme.inkFaint, fontWeight: 600,
                    letterSpacing: 0.4, textTransform: 'uppercase' }}>{e.range}</div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: theme.ink,
                    marginTop: 3, lineHeight: 1.3 }}>{e.site}</div>
                  <div style={{ fontSize: 11, color: theme.inkSoft, marginTop: 2 }}>
                    {e.days} days × ₹{h.wage}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'Instrument Serif, serif',
                    fontSize: 20, color: theme.ink, lineHeight: 1 }}>{inr(e.amt)}</div>
                  <div style={{ marginTop: 6 }}>
                    <StatusPill kind={e.status} theme={theme}
                                label={paid ? 'Paid' : 'Pending'}/>
                  </div>
                </div>
              </div>

              {/* Sub-strip — bank routing / overdue */}
              <div style={{
                marginTop: 10, paddingTop: 9,
                borderTop: `1px dashed ${theme.borderSoft}`,
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 10.5, color: theme.inkFaint,
              }}>
                {paid ? (
                  <>
                    <Icon name="flag" size={11} stroke={theme.success}/>
                    <span>Credited {e.paidOn} · A/C ••••4127</span>
                  </>
                ) : (
                  <>
                    <Icon name="clock" size={11} stroke={theme.danger}/>
                    <span style={{ color: theme.danger, fontWeight: 600 }}>
                      {e.overdue} days overdue
                    </span>
                    <span style={{ flex: 1 }}/>
                    <span style={{ color: theme.primary, fontWeight: 600 }}>
                      Raise grievance →
                    </span>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

Object.assign(window, { ScreenNregaDashboard, ScreenNregaLedger });
