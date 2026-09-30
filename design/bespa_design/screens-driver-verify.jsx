// Bespa — Taxi Driver verification (simple)
//
// Triggered when a user picks "Taxi Driver" on the occupation step.
// We only confirm that they ARE a taxi driver — no Aadhaar / KYC, no
// vehicle paperwork chase. Just the two-or-three documents the RTO
// already issues to licensed taxi drivers.
//
// Two variants:
//   • ScreenDriverVerify       — short checklist, mixed-status overview
//   • ScreenDriverVerifyCamera — single-document capture (front + back)
//
// Both screens are designed to be calm for low-literacy users: chunky
// icons, plain language, color-coded statuses, one obvious action per row.

const DRIVER_DOCS = [
  {
    id: 'dl',     icon: 'car',  label: 'Commercial driving licence',
    sub: 'With passenger (PSV) badge endorsement',
    status: 'verified',
  },
  {
    id: 'permit', icon: 'flag', label: 'Taxi permit',
    sub: 'RTO route or tourist taxi permit',
    status: 'reviewing',
  },
  {
    id: 'badge',  icon: 'file', label: 'Taxi driver badge',
    sub: 'Driver badge from the transport office',
    status: 'pending',
  },
];

// ─── Status helpers ──────────────────────────────────────────────
function statusTone(status, theme) {
  return {
    verified:  { bg: theme.success + '18', fg: theme.success, label: 'Verified',  icon: 'flag'  },
    reviewing: { bg: theme.info    + '18', fg: theme.info,    label: 'In review', icon: 'clock' },
    pending:   { bg: theme.surfaceAlt,     fg: theme.inkSoft, label: 'Not uploaded', icon: 'plus' },
    rejected:  { bg: theme.danger  + '18', fg: theme.danger,  label: 'Rejected',  icon: 'bell' },
  }[status] || { bg: theme.surfaceAlt, fg: theme.inkSoft, label: status, icon: 'file' };
}

function StatusBadge({ status, theme }) {
  const s = statusTone(status, theme);
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 9px 3px 6px', borderRadius: 999,
      background: s.bg, color: s.fg,
      fontSize: 10.5, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase',
    }}>
      {status === 'verified' && (
        <svg width="11" height="11" viewBox="0 0 24 24">
          <path d="M5 12l5 5L20 7" fill="none" stroke={s.fg}
            strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
      {status === 'reviewing' && <Icon name="clock" size={11} stroke={s.fg}/>}
      {status === 'rejected'  && <Icon name="bell"  size={11} stroke={s.fg}/>}
      {status === 'pending'   && <Icon name="plus"  size={11} stroke={s.fg}/>}
      {s.label}
    </div>
  );
}

// Shared headline header for both variants
function VerifyHeader({ theme, t, dir, onBack, eyebrow, title, sub }) {
  return (
    <div style={{ background: theme.surface, padding: '14px 16px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {onBack && (
          <div onClick={typeof onBack === 'function' ? onBack : undefined} style={{
            width: 34, height: 34, borderRadius: 17, background: theme.surfaceAlt,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: typeof onBack === 'function' ? 'pointer' : 'default',
          }}><Icon name="back" size={16}/></div>
        )}
        <div style={{ flex: 1, textAlign: dir === 'rtl' ? 'right' : 'left' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: theme.accent,
            letterSpacing: 0.6, textTransform: 'uppercase' }}>{eyebrow}</div>
          <div style={{
            fontFamily: 'Instrument Serif, serif', fontSize: 22,
            lineHeight: 1.1, color: theme.ink, marginTop: 3, letterSpacing: -0.3,
          }}>{title}</div>
          {sub && (
            <div style={{ fontSize: 12, color: theme.inkSoft, marginTop: 4, lineHeight: 1.45 }}>
              {sub}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Variant A · Full checklist ──────────────────────────────────
function ScreenDriverVerify({ theme, t, dir, nav }) {
  const total = DRIVER_DOCS.length;
  const done  = DRIVER_DOCS.filter(d => d.status === 'verified').length;
  const pct   = done / total;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: theme.bg }}>
      <VerifyHeader theme={theme} t={t} dir={dir} onBack={nav && (() => nav.back())}
        eyebrow="Taxi driver verification"
        title="Confirm you drive a taxi"/>

      {/* Progress strip */}
      <div style={{
        margin: '4px 14px 12px',
        background: theme.surface, borderRadius: 14,
        border: `1px solid ${theme.borderSoft}`,
        padding: '12px 14px',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6,
          textAlign: dir === 'rtl' ? 'right' : 'left' }}>
          <div style={{ fontFamily: 'Instrument Serif, serif',
            fontSize: 22, color: theme.ink, lineHeight: 1 }}>{done}</div>
          <div style={{ fontSize: 12, color: theme.inkSoft }}>of {total} verified</div>
          <div style={{ flex: 1 }}/>
          <div style={{ fontSize: 11, color: theme.primary, fontWeight: 700 }}>
            {Math.round(pct * 100)}%
          </div>
        </div>
        <div style={{
          marginTop: 10, height: 8, borderRadius: 4,
          background: theme.borderSoft, overflow: 'hidden',
        }}>
          <div style={{
            width: `${pct * 100}%`, height: '100%',
            background: `linear-gradient(90deg, ${theme.success}, ${theme.accent})`,
            transition: 'width 0.3s ease',
          }}/>
        </div>
        <div style={{ marginTop: 8, fontSize: 11, color: theme.inkFaint, lineHeight: 1.4,
          textAlign: dir === 'rtl' ? 'right' : 'left' }}>
          Review usually takes <span style={{ color: theme.ink, fontWeight: 600 }}>a few hours</span>.
        </div>
      </div>

      {/* Document list */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 14px 12px',
        display: 'flex', flexDirection: 'column', gap: 8 }}>

        {DRIVER_DOCS.map(d => {
          const s = statusTone(d.status, theme);
          const ctaLabel = d.status === 'pending'   ? 'Upload'
                         : d.status === 'rejected'  ? 'Re-upload'
                         : d.status === 'reviewing' ? 'View'
                         :                            'View';
          const ctaPrimary = d.status === 'pending' || d.status === 'rejected';
          return (
            <div key={d.id} style={{
              background: theme.surface, borderRadius: 14,
              border: `1px solid ${d.status === 'rejected' ? theme.danger + '50' : theme.borderSoft}`,
              padding: '12px 14px',
              textAlign: dir === 'rtl' ? 'right' : 'left',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12,
                flexDirection: dir === 'rtl' ? 'row-reverse' : 'row' }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: s.bg, color: s.fg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Icon name={d.icon} size={20} stroke={s.fg}/>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: theme.ink, lineHeight: 1.2 }}>
                    {d.label}
                  </div>
                  <div style={{ fontSize: 11, color: theme.inkSoft, marginTop: 2 }}>
                    {d.sub}
                  </div>
                </div>
                <div onClick={nav && (() => nav.go('driverVerifyCamera'))} style={{
                  padding: '8px 14px', borderRadius: 10, flexShrink: 0,
                  background: ctaPrimary ? theme.primary : theme.surfaceAlt,
                  color: ctaPrimary ? theme.surface : theme.ink,
                  fontSize: 12, fontWeight: 700, letterSpacing: 0.2,
                  cursor: 'pointer', userSelect: 'none',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}>
                  {ctaPrimary && <Icon name="plus" size={12} stroke={theme.surface}/>}
                  {ctaLabel}
                </div>
              </div>

              {/* Status badge row + optional rejection note */}
              <div style={{
                marginTop: 10, paddingTop: 9,
                borderTop: `1px dashed ${theme.borderSoft}`,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <StatusBadge status={d.status} theme={theme}/>
                {d.note && (
                  <div style={{ fontSize: 11, color: theme.danger, fontWeight: 600,
                    lineHeight: 1.3, flex: 1 }}>
                    {d.note}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Help row */}
        <div style={{
          background: theme.primarySoft, borderRadius: 12,
          padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10,
          marginTop: 4,
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 14, background: theme.primary,
            color: theme.surface,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}><Icon name="phone" size={14} stroke={theme.surface}/></div>
          <div style={{ flex: 1, fontSize: 11.5, color: theme.ink, lineHeight: 1.4 }}>
            Need help? Visit Bespa office at Hussaini Chowk, Kargil — open 10 AM to 5 PM.
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        background: theme.surface, borderTop: `1px solid ${theme.borderSoft}`,
        padding: '12px 16px 14px', flexShrink: 0,
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        <div onClick={nav && (() => nav.back())} style={{
          background: theme.primary, color: theme.surface,
          borderRadius: 14, padding: '14px 16px', textAlign: 'center',
          fontWeight: 700, fontSize: 14, letterSpacing: 0.2,
          boxShadow: `0 8px 18px ${theme.primary}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          cursor: nav ? 'pointer' : 'default',
        }}>
          Submit for verification
          <Icon name="arrow" size={16} stroke={theme.surface}/>
        </div>
        <div style={{
          textAlign: 'center', fontSize: 12, color: theme.inkSoft, fontWeight: 600,
        }}>Save and continue later</div>
      </div>
    </div>
  );
}

// ─── Variant B · Single document capture (camera-first) ──────────
function ScreenDriverVerifyCamera({ theme, t, dir, nav }) {
  // Pretend the user is on doc 2 of 3 — Taxi permit, front captured, back pending.
  const stepIdx = 2;
  const total = DRIVER_DOCS.length;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: theme.bg }}>
      <VerifyHeader theme={theme} t={t} dir={dir} onBack={nav && (() => nav.back())}
        eyebrow={`Document ${stepIdx} of ${total}`}
        title="Taxi permit"/>

      {/* Tiny doc-progress dots */}
      <div style={{ padding: '0 16px 12px',
        display: 'flex', alignItems: 'center', gap: 4 }}>
        {DRIVER_DOCS.map((d, i) => {
          const active = i === stepIdx - 1;
          const done = i < stepIdx - 1;
          return (
            <div key={d.id} style={{
              flex: 1, height: 4, borderRadius: 2,
              background: done ? theme.success : (active ? theme.primary : theme.border),
            }}/>
          );
        })}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '0 14px 8px',
        display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Capture slots */}
        {[
          { side: 'Front side', status: 'done',    label: 'Captured · tap to retake' },
          { side: 'Back side',  status: 'pending', label: 'Tap to capture' },
        ].map((slot, i) => {
          const done = slot.status === 'done';
          return (
            <div key={i} style={{
              background: theme.surface, borderRadius: 16,
              border: `1.5px ${done ? 'solid' : 'dashed'} ${done ? theme.success + '60' : theme.border}`,
              padding: '12px 14px',
              textAlign: dir === 'rtl' ? 'right' : 'left',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10,
                flexDirection: dir === 'rtl' ? 'row-reverse' : 'row' }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: done ? theme.success : theme.surfaceAlt,
                  color: done ? theme.surface : theme.inkSoft,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {done ? (
                    <svg width="14" height="14" viewBox="0 0 24 24">
                      <path d="M5 12l5 5L20 7" fill="none" stroke={theme.surface}
                        strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : (
                    <Icon name="image" size={16}/>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: theme.ink }}>
                    {slot.side}
                  </div>
                  <div style={{ fontSize: 11, color: theme.inkSoft, marginTop: 2 }}>
                    {slot.label}
                  </div>
                </div>
              </div>

              {/* Big tappable preview area */}
              <div style={{
                marginTop: 10, height: 130, borderRadius: 12,
                background: done
                  ? `linear-gradient(135deg, ${theme.primary}, ${theme.ink})`
                  : theme.surfaceAlt,
                border: done ? 'none' : `2px dashed ${theme.border}`,
                position: 'relative', overflow: 'hidden',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column', gap: 6,
                color: done ? theme.surface : theme.inkFaint,
              }}>
                {done ? (
                  <>
                    {/* faux RC card */}
                    <div style={{ position: 'absolute', inset: 16,
                      background: '#ffffff15', borderRadius: 6,
                      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                      padding: 10, fontFamily: 'DM Mono, monospace',
                    }}>
                      <div style={{ fontSize: 9, opacity: 0.75, letterSpacing: 0.5 }}>TAXI PERMIT</div>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>PMT-JK07-882</div>
                      <div style={{ fontSize: 8, opacity: 0.6 }}>•••• ••••</div>
                    </div>
                    <div style={{
                      position: 'absolute', top: 8, right: 8,
                      background: theme.success, color: theme.surface,
                      padding: '3px 8px', borderRadius: 8, fontSize: 9, fontWeight: 700,
                      letterSpacing: 0.4, textTransform: 'uppercase',
                    }}>Captured</div>
                  </>
                ) : (
                  <>
                    <Icon name="image" size={28} stroke={theme.inkFaint}/>
                    <div style={{ fontSize: 12, fontWeight: 600, color: theme.inkSoft }}>
                      Tap to open camera
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}

             </div>

      {/* Footer — Skip + Next */}
      <div style={{
        background: theme.surface, borderTop: `1px solid ${theme.borderSoft}`,
        padding: '12px 14px 14px', flexShrink: 0,
        display: 'flex', gap: 8,
      }}>
        <div onClick={nav && (() => nav.back())} style={{
          flex: 1, padding: '14px 12px', borderRadius: 14,
          background: theme.surfaceAlt, color: theme.ink,
          textAlign: 'center', fontSize: 13, fontWeight: 600,
          cursor: nav ? 'pointer' : 'default',
        }}>Skip for now</div>
        <div onClick={nav && (() => nav.back())} style={{
          flex: 2, padding: '14px 12px', borderRadius: 14,
          background: theme.primary, color: theme.surface,
          textAlign: 'center', fontSize: 13, fontWeight: 700,
          boxShadow: `0 8px 18px ${theme.primary}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          cursor: nav ? 'pointer' : 'default',
        }}>
          Save & next document
          <Icon name="arrow" size={14} stroke={theme.surface}/>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ScreenDriverVerify, ScreenDriverVerifyCamera });
