// Bespa — Cab Booking (simple, role-aware flow)
//
// Two roles, three steps each. Everything fits in a single CabApp
// state machine so an artboard can be seeded into any state.
//
//   Passenger:  search → results → trip
//   Driver:     home   → request → trip
//
// Trip type (Short / Long) and Mode (Shared / Private) are first-class
// toggles in the search form — both passengers and drivers think in
// these terms in Kargil.

// ─── Data ───────────────────────────────────────────────────────
// A flat ride pool. Filter by `distance` (short|long) and `mode` (shared|private).
const RIDES = [
// short shared — village-to-town shuttles
{ id: 'ss1', from: 'Hardass', to: 'Kargil', distance: 'short', mode: 'shared',
  vehicle: 'Tata Sumo', time: '7:30 AM', dur: '35 min', seats: 4, total: 7,
  fare: 50, driver: 'Hassan Khan', plate: 'JK07 1234' },
{ id: 'ss2', from: 'Sankoo', to: 'Kargil', distance: 'short', mode: 'shared',
  vehicle: 'Tata Sumo', time: '8:00 AM', dur: '45 min', seats: 2, total: 7,
  fare: 80, driver: 'Ghulam Ali', plate: 'JK07 5588' },
{ id: 'ss3', from: 'Hardass', to: 'Kargil', distance: 'short', mode: 'shared',
  vehicle: 'Tata Sumo', time: '9:15 AM', dur: '35 min', seats: 6, total: 7,
  fare: 50, driver: 'Mehboob A.', plate: 'JK07 2211' },

// short private — book the whole vehicle
{ id: 'sp1', from: 'Hardass', to: 'Kargil', distance: 'short', mode: 'private',
  vehicle: 'Maruti Eeco', time: 'Any time', dur: '35 min', seats: 7, total: 7,
  fare: 350, driver: 'Tashi Norbu', plate: 'JK07 4422' },
{ id: 'sp2', from: 'Hardass', to: 'Kargil', distance: 'short', mode: 'private',
  vehicle: 'Maruti Alto', time: 'Any time', dur: '35 min', seats: 4, total: 4,
  fare: 300, driver: 'Padma D.', plate: 'JK07 8801' },

// long shared — scheduled inter-district sumos
{ id: 'ls1', from: 'Kargil', to: 'Leh', distance: 'long', mode: 'shared',
  vehicle: 'Tata Sumo', time: '7:30 AM', dur: '5h 30m', seats: 3, total: 7,
  fare: 600, driver: 'Ghulam Mehdi', plate: 'JK07 1234' },
{ id: 'ls2', from: 'Kargil', to: 'Drass', distance: 'long', mode: 'shared',
  vehicle: 'Tata Sumo', time: '8:00 AM', dur: '1h 45m', seats: 5, total: 9,
  fare: 250, driver: 'Mehboob Ali', plate: 'JK07 5678' },
{ id: 'ls3', from: 'Kargil', to: 'Padum', distance: 'long', mode: 'shared',
  vehicle: 'Tata Sumo', time: '6:00 AM', dur: '8h', seats: 2, total: 7,
  fare: 1200, driver: 'Stanzin W.', plate: 'JK07 9012' },

// long private — full-vehicle hire
{ id: 'lp1', from: 'Kargil', to: 'Leh', distance: 'long', mode: 'private',
  vehicle: 'Innova', time: 'Any time', dur: '5h 30m', seats: 6, total: 6,
  fare: 4500, driver: 'Tashi Norbu', plate: 'JK07 4422' },
{ id: 'lp2', from: 'Kargil', to: 'Drass', distance: 'long', mode: 'private',
  vehicle: 'Scorpio', time: 'Any time', dur: '1h 45m', seats: 6, total: 6,
  fare: 2200, driver: 'Hassan Khan', plate: 'JK07 1234' }];


// ─── Root state machine ─────────────────────────────────────────
function CabApp({
  theme, t, dir, nav,
  initialRole = 'passenger', // 'passenger' | 'driver'
  initialStep = 'search', // see role-step matrix
  initialDistance = 'long', // 'short' | 'long'
  initialMode = 'shared', // 'shared' | 'private'
  initialRideId = null,
  initialPhase = 'heading' // driver trip phase
}) {
  const [role, setRole] = React.useState(initialRole);
  const [step, setStep] = React.useState(initialStep);
  const [distance, setDistance] = React.useState(initialDistance);
  const [mode, setMode] = React.useState(initialMode);
  const [rideId, setRideId] = React.useState(initialRideId);
  const [phase, setPhase] = React.useState(initialPhase);

  const filtered = RIDES.filter((r) => r.distance === distance && r.mode === mode);
  const ride = RIDES.find((r) => r.id === rideId) || filtered[0];

  const ctx = {
    theme, t, dir, nav,
    role, setRole, step, setStep,
    distance, setDistance, mode, setMode,
    rideId, setRideId, ride, filtered,
    phase, setPhase
  };

  if (role === 'driver') {
    if (step === 'request') return <DrvRequest {...ctx} />;
    if (step === 'trip') return <DrvTrip {...ctx} />;
    return <DrvHome {...ctx} />;
  }

  if (step === 'results') return <PaxResults {...ctx} />;
  if (step === 'trip') return <PaxTrip {...ctx} />;
  return <PaxSearch {...ctx} />;
}

// ─── Shared bits ────────────────────────────────────────────────

// Role indicator pill on every cab screen — cycles to swap views.
function RolePill({ role, setRole, setStep, theme }) {
  const isDriver = role === 'driver';
  return (
    <div
      onClick={() => {
        setRole(isDriver ? 'passenger' : 'driver');
        setStep(isDriver ? 'search' : 'home');
      }}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '4px 9px 4px 4px', borderRadius: 999,
        background: isDriver ? theme.accent : theme.primarySoft,
        color: isDriver ? theme.surface : theme.primary,
        cursor: 'pointer', userSelect: 'none'
      }}>
      <div style={{
        width: 20, height: 20, borderRadius: 10,
        background: isDriver ? theme.surface : theme.primary,
        color: isDriver ? theme.accent : theme.surface,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 9, fontWeight: 700
      }}>{isDriver ? 'D' : 'P'}</div>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.3 }}>
        {isDriver ? 'Driver' : 'Rider'}
      </span>
    </div>);

}

function CabHeader({ title, sub, theme, dir, onBack, role, setRole, setStep }) {
  return (
    <div style={{ background: theme.surface, padding: '14px 16px 12px',
      display: 'flex', alignItems: 'center', gap: 10 }}>
      {onBack &&
      <div onClick={onBack} style={{
        width: 34, height: 34, borderRadius: 17, background: theme.surfaceAlt,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer'
      }}><Icon name="back" size={16} /></div>
      }
      <div style={{ flex: 1, textAlign: dir === 'rtl' ? 'right' : 'left' }}>
        {sub &&
        <div style={{ fontSize: 11, color: theme.inkFaint, fontWeight: 600,
          letterSpacing: 0.4, textTransform: 'uppercase' }}>{sub}</div>
        }
        <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: 22,
          color: theme.ink, lineHeight: 1.1, marginTop: 2, letterSpacing: -0.3 }}>
          {title}
        </div>
      </div>
      {role && <RolePill role={role} setRole={setRole} setStep={setStep} theme={theme} />}
    </div>);

}

function CabFooter({ label, onTap, theme, disabled, secondary, danger, icon = 'arrow', hint }) {
  const bg = disabled ? theme.border :
  danger ? theme.danger :
  secondary ? theme.surfaceAlt :
  theme.primary;
  const fg = secondary && !danger ? theme.ink : theme.surface;
  return (
    <div style={{
      background: theme.surface, borderTop: `1px solid ${theme.borderSoft}`,
      padding: '12px 16px 14px', flexShrink: 0
    }}>
      {hint &&
      <div style={{ fontSize: 11, color: theme.inkSoft, textAlign: 'center', marginBottom: 8 }}>
          {hint}
        </div>
      }
      <div onClick={disabled ? undefined : onTap} style={{
        background: bg, color: fg,
        borderRadius: 14, padding: '14px 16px', textAlign: 'center',
        fontWeight: 600, fontSize: 14,
        boxShadow: disabled || secondary ? 'none' : `0 8px 18px ${bg}40`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        cursor: disabled ? 'default' : 'pointer', userSelect: 'none'
      }}>
        <span>{label}</span>
        {icon && <Icon name={icon} size={16} stroke={fg} />}
      </div>
    </div>);

}

// Two-state segmented toggle — used for both Short/Long and Shared/Private
function SegToggle({ value, onChange, options, theme }) {
  return (
    <div style={{
      display: 'flex', background: theme.surfaceAlt,
      borderRadius: 12, padding: 4
    }}>
      {options.map((opt) => {
        const on = value === opt.value;
        return (
          <div key={opt.value} onClick={() => onChange(opt.value)} style={{
            flex: 1, padding: '9px 6px', borderRadius: 9,
            background: on ? theme.surface : 'transparent',
            boxShadow: on ? `0 2px 6px ${theme.ink}15` : 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            cursor: 'pointer', userSelect: 'none'
          }}>
            <div style={{
              width: 22, height: 22, borderRadius: 6,
              background: on ? opt.tint || theme.primarySoft : 'transparent',
              color: on ? opt.tintFg || theme.primary : theme.inkFaint,
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}><Icon name={opt.icon} size={12} /></div>
            <div style={{
              fontSize: 12, fontWeight: 600,
              color: on ? theme.ink : theme.inkSoft
            }}>{opt.label}</div>
          </div>);

      })}
    </div>);

}

// Single ride card — clean, no seat-map noise.
function RideCard({ ride, theme, dir, onTap }) {
  const private_ = ride.mode === 'private';
  return (
    <div onClick={onTap} style={{
      background: theme.surface, borderRadius: 14,
      border: `1px solid ${theme.borderSoft}`,
      padding: '12px 14px', cursor: 'pointer'
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: private_ ? theme.primarySoft : theme.accentSoft,
          color: private_ ? theme.primary : theme.accent,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
        }}><Icon name="car" size={20} /></div>
        <div style={{ flex: 1, minWidth: 0, textAlign: dir === 'rtl' ? 'right' : 'left' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: theme.ink, lineHeight: 1.3 }}>
            {ride.from} → {ride.to}
          </div>
          <div style={{ fontSize: 11, color: theme.inkSoft, marginTop: 3 }}>
            {ride.vehicle} · {ride.driver}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: 20,
            color: theme.ink, lineHeight: 1 }}>₹{ride.fare}</div>
          <div style={{ fontSize: 10, color: theme.inkFaint, marginTop: 2 }}>
            {private_ ? 'whole car' : 'per seat'}
          </div>
        </div>
      </div>

      <div style={{
        marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${theme.borderSoft}`,
        display: 'flex', alignItems: 'center', gap: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5,
          fontSize: 11, color: theme.inkSoft }}>
          <Icon name="clock" size={13} stroke={theme.inkSoft} />
          <span style={{ color: theme.ink, fontWeight: 600 }}>{ride.time}</span>
          <span style={{ color: theme.inkFaint }}>· {ride.dur}</span>
        </div>
        <div style={{ flex: 1 }} />
        {private_ ?
        <div style={{
          padding: '3px 8px', borderRadius: 8,
          background: theme.primary, color: theme.surface,
          fontSize: 10, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase'
        }}>Private</div> :

        <div style={{ display: 'flex', alignItems: 'center', gap: 4,
          fontSize: 11, color: theme.inkSoft }}>
            <Icon name="seat" size={13} stroke={theme.inkSoft} />
            <span><span style={{ color: theme.success, fontWeight: 700 }}>{ride.seats}</span>/{ride.total} left</span>
          </div>
        }
      </div>
    </div>);

}

// ────────────────────────────────────────────────────────────────
//   PASSENGER · 1 · Search
// ────────────────────────────────────────────────────────────────
function PaxSearch({ theme, t, dir, distance, setDistance, mode, setMode, setStep, role, setRole, nav }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: theme.bg }}>
      <CabHeader title="Book a cab" sub="Where to today?" theme={theme} dir={dir}
      role={role} setRole={setRole} setStep={setStep}
      onBack={nav && (() => nav.back())} />

      <div style={{ flex: 1, overflow: 'auto', padding: '4px 14px 12px',
        display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Trip type toggle */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: theme.inkSoft,
            letterSpacing: 0.5, textTransform: 'uppercase', padding: '0 4px 6px' }}>
            Trip type
          </div>
          <SegToggle value={distance} onChange={setDistance} theme={theme}
          options={[
          { value: 'short', label: 'Short trip', icon: 'pin' },
          { value: 'long', label: 'Long trip', icon: 'mountain' }]
          } />
          <div style={{ fontSize: 10.5, color: theme.inkFaint, padding: '6px 4px 0',
            lineHeight: 1.4 }}>
            {distance === 'short' ?
            'Within the block — village to town, under an hour, fixed local fare.' :
            'Across districts — Kargil to Leh, Drass or Padum. Half-day or full-day.'}
          </div>
        </div>

        {/* Mode toggle */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: theme.inkSoft,
            letterSpacing: 0.5, textTransform: 'uppercase', padding: '0 4px 6px' }}>
            How you ride
          </div>
          <SegToggle value={mode} onChange={setMode} theme={theme}
          options={[
          { value: 'shared', label: 'Shared', icon: 'people',
            tint: theme.accentSoft, tintFg: theme.accent },
          { value: 'private', label: 'Private', icon: 'car' }]
          } />
          <div style={{ fontSize: 10.5, color: theme.inkFaint, padding: '6px 4px 0',
            lineHeight: 1.4 }}>
            {mode === 'shared' ?
            'Share a Sumo with others going your way. Pay only for your seat.' :
            'Book the whole vehicle. Leave whenever you like.'}
          </div>
        </div>

        {/* From / To */}
        <div style={{
          background: theme.surface, borderRadius: 16,
          border: `1px solid ${theme.borderSoft}`, padding: '4px 14px',
          position: 'relative'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0',
            borderBottom: `1px dashed ${theme.borderSoft}` }}>
            <div style={{ width: 8, height: 8, borderRadius: 4, background: theme.success, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: theme.inkFaint, fontWeight: 600,
                letterSpacing: 0.5, textTransform: 'uppercase' }}>From</div>
              <div style={{ fontSize: 13, color: theme.ink, fontWeight: 600 }}>
                {distance === 'short' ? 'Hardass Village' : 'Kargil'}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0' }}>
            <div style={{ width: 8, height: 8, borderRadius: 4, background: theme.danger, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: theme.inkFaint, fontWeight: 600,
                letterSpacing: 0.5, textTransform: 'uppercase' }}>To</div>
              <div style={{ fontSize: 13, color: theme.ink, fontWeight: 600 }}>
                {distance === 'short' ? 'Kargil Town' : 'Leh'}
              </div>
            </div>
          </div>
        </div>

        {/* Date chips — only meaningful for long trips */}
        {distance === 'long' &&
        <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: theme.inkSoft,
            letterSpacing: 0.5, textTransform: 'uppercase', padding: '0 4px 6px' }}>
              When
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[
            { l: 'Today', on: true },
            { l: 'Tomorrow' }, { l: 'Sat 30' }, { l: 'Sun 31' }].
            map((c, i) =>
            <div key={i} style={{
              flex: 1, padding: '8px 4px', borderRadius: 10, textAlign: 'center',
              background: c.on ? theme.ink : theme.surface,
              color: c.on ? theme.surface : theme.inkSoft,
              fontSize: 11.5, fontWeight: 600,
              border: `1px solid ${c.on ? theme.ink : theme.borderSoft}`,
              cursor: 'pointer', userSelect: 'none'
            }}>{c.l}</div>
            )}
            </div>
          </div>
        }

        {/* Pickup time — a private hire leaves on your schedule, so let the
            rider grab a car now or set a time. Most relevant for short local hires. */}
        {mode === 'private' &&
        <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: theme.inkSoft,
            letterSpacing: 0.5, textTransform: 'uppercase', padding: '0 4px 6px' }}>
              Pickup
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[
            { l: 'Now', on: true }, { l: 'In 30 min' }, { l: 'In 1 hr' }, { l: 'Pick time' }].
            map((c, i) =>
            <div key={i} style={{
              flex: 1, padding: '8px 4px', borderRadius: 10, textAlign: 'center',
              background: c.on ? theme.primary : theme.surface,
              color: c.on ? theme.surface : theme.inkSoft,
              fontSize: 11.5, fontWeight: 600,
              border: `1px solid ${c.on ? theme.primary : theme.borderSoft}`,
              cursor: 'pointer', userSelect: 'none'
            }}>{c.l}</div>
            )}
            </div>
          </div>
        }
      </div>

      <CabFooter label="Find rides" theme={theme} onTap={() => setStep('results')} />
    </div>);

}

// ────────────────────────────────────────────────────────────────
//   PASSENGER · 2 · Results
// ────────────────────────────────────────────────────────────────
function PaxResults({ theme, t, dir, distance, setDistance, mode, setMode,
  filtered, setRideId, setStep, role, setRole }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: theme.bg }}>
      <CabHeader
        title={`${distance === 'short' ? 'Short' : 'Long'} · ${mode === 'shared' ? 'Shared' : 'Private'}`}
        sub={`${filtered.length} rides available`}
        theme={theme} dir={dir}
        role={role} setRole={setRole} setStep={setStep}
        onBack={() => setStep('search')} />

      {/* Inline filter chips so passengers can flip without going back */}
      <div style={{ padding: '4px 14px 8px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {[
        { l: 'Short', on: distance === 'short', set: () => setDistance('short') },
        { l: 'Long', on: distance === 'long', set: () => setDistance('long') },
        { l: 'Shared', on: mode === 'shared', set: () => setMode('shared') },
        { l: 'Private', on: mode === 'private', set: () => setMode('private') }].
        map((c, i) =>
        <div key={i} onClick={c.set} style={{
          padding: '5px 11px', borderRadius: 12,
          background: c.on ? theme.primary : theme.surface,
          color: c.on ? theme.surface : theme.inkSoft,
          border: `1px solid ${c.on ? theme.primary : theme.borderSoft}`,
          fontSize: 11, fontWeight: 600, cursor: 'pointer', userSelect: 'none'
        }}>{c.l}</div>
        )}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '4px 14px 14px',
        display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.length === 0 ?
        <div style={{
          background: theme.surface, border: `1px dashed ${theme.border}`,
          borderRadius: 14, padding: '32px 16px', textAlign: 'center'
        }}>
            <div style={{ fontSize: 13, color: theme.inkSoft }}>
              No rides match this combination today.
            </div>
            <div style={{ fontSize: 11, color: theme.inkFaint, marginTop: 6 }}>
              Try a different trip type or mode.
            </div>
          </div> :
        filtered.map((r) =>
        <RideCard key={r.id} ride={r} theme={theme} dir={dir}
        onTap={() => {setRideId(r.id);setStep('trip');}} />
        )}
      </div>
    </div>);

}

// ────────────────────────────────────────────────────────────────
//   PASSENGER · 3 · Trip (confirmed booking)
// ────────────────────────────────────────────────────────────────
function PaxTrip({ theme, t, dir, ride, setStep, role, setRole }) {
  const private_ = ride.mode === 'private';
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: theme.bg }}>
      <CabHeader title="Your trip" sub="Confirmed" theme={theme} dir={dir}
      role={role} setRole={setRole} setStep={setStep}
      onBack={() => setStep('results')} />

      <div style={{ flex: 1, overflow: 'auto', padding: '12px 14px 8px',
        display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Status banner */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: theme.success + '18', color: theme.ink,
          borderRadius: 12, padding: '10px 12px'
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 14, background: theme.success,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24">
              <path d="M5 12l5 5L20 7" fill="none" stroke={theme.surface}
              strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div style={{ flex: 1, fontSize: 12, fontWeight: 600, lineHeight: 1.3 }}>
            Driver will reach pickup in <span style={{ color: theme.success }}>12 min</span>
          </div>
        </div>

        {/* Trip hero */}
        <div style={{
          background: theme.primary, color: theme.surface,
          borderRadius: 16, padding: '14px 16px',
          position: 'relative', overflow: 'hidden'
        }}>
          <div style={{ position: 'absolute', right: -10, bottom: -10, opacity: 0.25 }}>
            <MountainMotif height={70} c1="#ffffff30" c2="#ffffff60" c3="#ffffff90" />
          </div>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ fontSize: 10, opacity: 0.85, fontWeight: 600,
              letterSpacing: 0.4, textTransform: 'uppercase' }}>
              {ride.time} · {ride.dur}
            </div>
            <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: 26,
              lineHeight: 1, marginTop: 4 }}>
              {ride.from} → {ride.to}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
              <div style={{
                padding: '3px 8px', borderRadius: 8,
                background: '#ffffff25', fontSize: 10, fontWeight: 700,
                letterSpacing: 0.4, textTransform: 'uppercase'
              }}>{ride.distance === 'short' ? 'Short' : 'Long'}</div>
              <div style={{
                padding: '3px 8px', borderRadius: 8,
                background: private_ ? theme.accent : '#ffffff25',
                color: private_ ? theme.surface : theme.surface,
                fontSize: 10, fontWeight: 700,
                letterSpacing: 0.4, textTransform: 'uppercase'
              }}>{private_ ? 'Private' : 'Shared'}</div>
            </div>
          </div>
        </div>

        {/* Driver card */}
        <div style={{
          background: theme.surface, borderRadius: 16,
          border: `1px solid ${theme.borderSoft}`, padding: '12px 14px',
          display: 'flex', alignItems: 'center', gap: 12
        }}>
          <Avatar name={ride.driver} size={48} theme={theme} tint="primary" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: theme.ink }}>{ride.driver}</div>
            <div style={{ fontSize: 11, color: theme.inkSoft, marginTop: 2 }}>
              {ride.vehicle} ·{' '}
              <span style={{ fontFamily: 'DM Mono, monospace', color: theme.ink, fontWeight: 600 }}>
                {ride.plate}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 18,
              background: theme.success, color: theme.surface,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer'
            }}><Icon name="phone" size={15} stroke={theme.surface} /></div>
            <div style={{
              width: 36, height: 36, borderRadius: 18,
              background: theme.primarySoft, color: theme.primary,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer'
            }}><Icon name="chat" size={15} stroke={theme.primary} /></div>
          </div>
        </div>

        {/* Fare summary */}
        <div style={{
          background: theme.surface, borderRadius: 14,
          border: `1px solid ${theme.borderSoft}`, padding: '12px 14px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 10, color: theme.inkFaint, fontWeight: 700,
                letterSpacing: 0.4, textTransform: 'uppercase' }}>
                Total fare
              </div>
              <div style={{ fontSize: 11, color: theme.inkSoft, marginTop: 4 }}>
                {private_ ? 'Whole vehicle' : '1 seat'} ·{' '}
                <span style={{ color: theme.primary, fontWeight: 600 }}>UPI</span>
              </div>
            </div>
            <div style={{ fontFamily: 'Instrument Serif, serif',
              fontSize: 28, color: theme.ink }}>₹{ride.fare}</div>
          </div>
        </div>

        {/* Booking meta */}
        <div style={{ display: 'flex', gap: 8 }}>
          {[
          { l: 'Booking', v: 'BSP-' + ride.id.toUpperCase() },
          { l: 'Pickup', v: ride.time }].
          map((m, i) =>
          <div key={i} style={{ flex: 1,
            background: theme.surface, borderRadius: 12,
            border: `1px solid ${theme.borderSoft}`, padding: '10px 12px'
          }}>
              <div style={{ fontSize: 9, color: theme.inkFaint, fontWeight: 700,
              letterSpacing: 0.4, textTransform: 'uppercase' }}>{m.l}</div>
              <div style={{ fontSize: 13, color: theme.ink, fontWeight: 600, marginTop: 3,
              fontFamily: 'DM Mono, monospace' }}>{m.v}</div>
            </div>
          )}
        </div>
      </div>

      <CabFooter label="Cancel booking" theme={theme} danger secondary icon={null}
      onTap={() => setStep('search')} />
    </div>);

}

// ────────────────────────────────────────────────────────────────
//   DRIVER · 1 · Home (dashboard)
// ────────────────────────────────────────────────────────────────
// Rural-driver design notes:
//   • Big single-purpose request cards — one tap to open, route + price
//     are the only things you can confuse at a glance.
//   • Drop the dual `kind`/`mode` chip stack — fold mode into a single
//     color-coded "Shared"/"Private" tag.
//   • Pickup + drop on their own lines (no arrow glyph that older users
//     parse as decoration).
//   • Visible decline button on each card so accept/decline isn't a
//     mystery behind another screen.
function DrvHome({ theme, t, dir, setStep, setRideId, role, setRole, nav }) {
  const requests = [
  { id: 'ss1', mode: 'shared', from: 'Hardass', to: 'Kargil', time: 'in 12 min', fare: 50, name: 'Tashi Ali', ago: 'just now', dur: '35 min' },
  { id: 'lp1', mode: 'private', from: 'Kargil', to: 'Leh', time: '7:30 AM', fare: 4500, name: 'Padma Ladol', ago: '2 min ago', dur: '5h 30m' },
  { id: 'ls2', mode: 'shared', from: 'Kargil', to: 'Drass', time: '8:00 AM', fare: 250, name: 'Mohd Ali', ago: '5 min ago', dur: '1h 45m' }];


  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: theme.bg }}>
      <CabHeader title="Driver" sub="Hello, Ghulam" theme={theme} dir={dir}
      role={role} setRole={setRole} setStep={setStep}
      onBack={nav && (() => nav.back())} />

      {/* Count strip — single line, big readable */}
      <div style={{ padding: '4px 14px 10px',
        display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 10, height: 10, borderRadius: 5,
          background: theme.success, boxShadow: `0 0 0 4px ${theme.success}30`
        }} />
        <div style={{ fontSize: 13, color: theme.ink, fontWeight: 600 }}>
          {requests.length} new rides for you
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 11, color: theme.inkFaint }}>Tap a ride to see details</div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '0 14px 14px',
        display: 'flex', flexDirection: 'column', gap: 10 }}>

        {requests.map((r) => {
          const private_ = r.mode === 'private';
          return (
            <div key={r.id}
            onClick={() => {setRideId(r.id);setStep('request');}}
            style={{
              background: theme.surface, borderRadius: 16,
              border: `1px solid ${theme.borderSoft}`,
              padding: '14px 14px 12px', cursor: 'pointer',
              textAlign: dir === 'rtl' ? 'right' : 'left'
            }}>

              {/* Top row — tag + price */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  padding: '4px 10px', borderRadius: 999,
                  background: private_ ? theme.primary : theme.accent,
                  color: theme.surface,
                  fontSize: 11, fontWeight: 700, letterSpacing: 0.3
                }}>{private_ ? 'Private' : 'Shared'}</span>
                <span style={{ fontSize: 12, color: theme.inkSoft }}>{r.dur}</span>
                <div style={{ flex: 1 }} />
                <div style={{ fontFamily: 'Instrument Serif, serif',
                  fontSize: 26, color: theme.ink, lineHeight: 1 }}>₹{r.fare}</div>
              </div>

              {/* Pickup → Drop on two lines, big */}
              <div style={{ display: 'flex', gap: 10, marginTop: 12, alignItems: 'stretch' }}>
                <div style={{ width: 12, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', paddingTop: 6 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 5,
                    background: theme.success, flexShrink: 0 }} />
                  <div style={{ flex: 1, width: 2, background: theme.borderSoft, margin: '3px 0' }} />
                  <div style={{ width: 10, height: 10, borderRadius: 5,
                    background: theme.danger, flexShrink: 0 }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div>
                    <div style={{ fontSize: 10, color: theme.inkFaint, fontWeight: 700,
                      letterSpacing: 0.4, textTransform: 'uppercase' }}>Pickup</div>
                    <div style={{ fontSize: 16, color: theme.ink, fontWeight: 600,
                      marginTop: 1, lineHeight: 1.2 }}>{r.from}</div>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 10, color: theme.inkFaint, fontWeight: 700,
                      letterSpacing: 0.4, textTransform: 'uppercase' }}>Drop</div>
                    <div style={{ fontSize: 16, color: theme.ink, fontWeight: 600,
                      marginTop: 1, lineHeight: 1.2 }}>{r.to}</div>
                  </div>
                </div>
              </div>

              {/* Passenger + time strip */}
              <div style={{
                marginTop: 12, paddingTop: 10,
                borderTop: `1px dashed ${theme.borderSoft}`,
                display: 'flex', alignItems: 'center', gap: 8,
                fontSize: 12, color: theme.inkSoft
              }}>
                <Avatar name={r.name} size={24} theme={theme}
                tint={private_ ? 'primary' : 'accent'} />
                <span style={{ color: theme.ink, fontWeight: 600 }}>{r.name}</span>
                <span style={{ width: 3, height: 3, borderRadius: 2, background: theme.inkFaint }} />
                <span>{r.ago}</span>
                <div style={{ flex: 1 }} />
                <div style={{
                  padding: '5px 10px', borderRadius: 10,
                  background: theme.primarySoft, color: theme.primary,
                  fontSize: 11, fontWeight: 700,
                  display: 'flex', alignItems: 'center', gap: 4
                }}>
                  <Icon name="clock" size={12} stroke={theme.primary} />
                  {r.time}
                </div>
              </div>
            </div>);

        })}

        {/* Help line — explains what to expect */}
        <div style={{
          textAlign: 'center', fontSize: 11, color: theme.inkFaint,
          padding: '6px 16px 0', lineHeight: 1.5
        }}>
          More rides will appear here as people book.{'\n'}
          Tap any ride to accept or decline.
        </div>
      </div>
    </div>);

}

// ────────────────────────────────────────────────────────────────
//   DRIVER · 2 · Request (incoming booking)
// ────────────────────────────────────────────────────────────────
// Decision moment — keep the page calm. Hero shows just the price
// (the thing the driver is deciding on), pickup/drop are big and
// flat, action buttons are full-width with generous height.
function DrvRequest({ theme, t, dir, ride, setStep, setPhase, role, setRole }) {
  const private_ = ride.mode === 'private';
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: theme.bg }}>
      <CabHeader title="New ride" sub="Tap accept or decline"
      theme={theme} dir={dir}
      role={role} setRole={setRole} setStep={setStep}
      onBack={() => setStep('home')} />

      <div style={{ flex: 1, overflow: 'auto', padding: '6px 14px 8px',
        display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* HERO — You earn ₹X */}
        <div style={{
          background: theme.primary, color: theme.surface,
          borderRadius: 18, padding: '20px 18px 18px',
          position: 'relative', overflow: 'hidden',
          textAlign: dir === 'rtl' ? 'right' : 'left'
        }}>
          <div style={{ position: 'absolute', right: -10, bottom: -10, opacity: 0.25 }}>
            <MountainMotif height={90} c1="#ffffff30" c2="#ffffff60" c3="#ffffff90" />
          </div>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.85,
              letterSpacing: 0.4, textTransform: 'uppercase' }}></div>
            <div style={{ fontFamily: 'Instrument Serif, serif',
              fontSize: 52, lineHeight: 1, marginTop: 4 }}>₹{ride.fare}</div>
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                padding: '3px 9px', borderRadius: 999,
                background: private_ ? theme.accent : '#ffffff30',
                color: theme.surface, fontSize: 11, fontWeight: 700,
                letterSpacing: 0.3
              }}>{private_ ? 'Private' : 'Shared'}</span>
              <span style={{ fontSize: 12, opacity: 0.85 }}>
                {ride.distance === 'short' ? 'Short trip' : 'Long trip'} · {ride.dur}
              </span>
            </div>
          </div>
        </div>

        {/* Pickup / Drop — large, plain */}
        <div style={{
          background: theme.surface, borderRadius: 16,
          border: `1px solid ${theme.borderSoft}`, padding: '16px',
          textAlign: dir === 'rtl' ? 'right' : 'left'
        }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
            <div style={{ width: 14, display: 'flex', flexDirection: 'column',
              alignItems: 'center', paddingTop: 6 }}>
              <div style={{ width: 12, height: 12, borderRadius: 6,
                background: theme.success, flexShrink: 0 }} />
              <div style={{ flex: 1, width: 2, background: theme.borderSoft, margin: '3px 0' }} />
              <div style={{ width: 12, height: 12, borderRadius: 6,
                background: theme.danger, flexShrink: 0 }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ paddingBottom: 14 }}>
                <div style={{ fontSize: 11, color: theme.inkFaint, fontWeight: 700,
                  letterSpacing: 0.4, textTransform: 'uppercase' }}>Pickup</div>
                <div style={{ fontSize: 18, color: theme.ink, fontWeight: 600,
                  marginTop: 2, lineHeight: 1.2 }}>{ride.from}</div>
                <div style={{ fontSize: 12, color: theme.inkSoft, marginTop: 3 }}>
                  Main bazar · {ride.time}
                </div>
              </div>
              <div style={{ borderTop: `1px dashed ${theme.borderSoft}`, paddingTop: 12 }}>
                <div style={{ fontSize: 11, color: theme.inkFaint, fontWeight: 700,
                  letterSpacing: 0.4, textTransform: 'uppercase' }}>Drop</div>
                <div style={{ fontSize: 18, color: theme.ink, fontWeight: 600,
                  marginTop: 2, lineHeight: 1.2 }}>{ride.to}</div>
                <div style={{ fontSize: 12, color: theme.inkSoft, marginTop: 3 }}>
                  About {ride.dur} drive
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Passenger — compact line */}
        <div style={{
          background: theme.surface, borderRadius: 14,
          border: `1px solid ${theme.borderSoft}`,
          padding: '12px 14px',
          display: 'flex', alignItems: 'center', gap: 12
        }}>
          <Avatar name="Ali" size={44} theme={theme} tint="accent" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, color: theme.inkFaint, fontWeight: 700,
              letterSpacing: 0.4, textTransform: 'uppercase' }}>Passenger</div>
            <div style={{ fontSize: 15, color: theme.ink, fontWeight: 600, marginTop: 2 }}>Ali</div>
            <div style={{ fontSize: 11, color: theme.inkSoft, marginTop: 2 }}>
              <span style={{ color: theme.accent, fontWeight: 700 }}></span>
              <span style={{ color: theme.inkFaint }}></span>
            </div>
          </div>
        </div>
      </div>

      {/* Action row — full-width Accept, secondary Decline */}
      <div style={{
        background: theme.surface, borderTop: `1px solid ${theme.borderSoft}`,
        padding: '12px 14px 14px', flexShrink: 0,
        display: 'flex', flexDirection: 'column', gap: 8
      }}>
        <div onClick={() => {setPhase('heading');setStep('trip');}} style={{
          padding: '16px 12px', borderRadius: 14,
          background: theme.success, color: theme.surface,
          textAlign: 'center', fontSize: 16, fontWeight: 700,
          boxShadow: `0 8px 18px ${theme.success}40`,
          cursor: 'pointer', userSelect: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path d="M5 12l5 5L20 7" fill="none" stroke={theme.surface}
            strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Accept ride
        </div>
        <div onClick={() => setStep('home')} style={{
          padding: '12px', borderRadius: 14,
          background: 'transparent', color: theme.danger,
          textAlign: 'center', fontSize: 14, fontWeight: 600,
          cursor: 'pointer', userSelect: 'none',
          border: `1px solid ${theme.danger}30`
        }}>Decline</div>
      </div>
    </div>);

}

// ────────────────────────────────────────────────────────────────
//   DRIVER · 3 · Active trip (4 phases)
// ────────────────────────────────────────────────────────────────
// Single-action screen. CTA changes word by phase; everything else
// stays put so the driver can glance at the phone without re-orienting.
function DrvTrip({ theme, t, dir, ride, phase, setPhase, setStep, role, setRole }) {
  const phases = [
  { id: 'heading', label: 'Going to pickup', cta: 'I have arrived', next: 'arrived' },
  { id: 'arrived', label: 'Waiting at pickup', cta: 'Start the trip', next: 'onboard' },
  { id: 'onboard', label: 'Trip in progress', cta: 'Trip complete', next: 'done' },
  { id: 'done', label: 'Trip complete', cta: 'Back to home', next: 'exit' }];

  const idx = phases.findIndex((p) => p.id === phase);
  const cur = phases[idx] || phases[0];
  const onCta = () => {
    if (cur.next === 'exit') {setStep('home');setPhase('heading');} else
    setPhase(cur.next);
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: theme.bg }}>
      <CabHeader title={cur.label} sub={`${ride.from} → ${ride.to}`}
      theme={theme} dir={dir}
      role={role} setRole={setRole} setStep={setStep} />

      <div style={{ flex: 1, overflow: 'auto', padding: '12px 14px 8px',
        display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Phase stepper */}
        <div style={{
          background: theme.surface, borderRadius: 14,
          border: `1px solid ${theme.borderSoft}`,
          padding: '12px 14px'
        }}>
          {phases.map((p, i) => {
            const done = i < idx;
            const active = i === idx;
            return (
              <div key={p.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '6px 0'
              }}>
                <div style={{
                  width: 22, height: 22, borderRadius: 11,
                  background: done ? theme.success : active ? theme.primary : theme.surfaceAlt,
                  color: theme.surface,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, flexShrink: 0,
                  border: `2px solid ${done ? theme.success : active ? theme.primary : theme.border}`
                }}>
                  {done ?
                  <svg width="11" height="11" viewBox="0 0 24 24">
                      <path d="M5 12l5 5L20 7" fill="none" stroke={theme.surface}
                    strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg> :

                  <span style={{ color: active ? theme.surface : theme.inkFaint }}>{i + 1}</span>
                  }
                </div>
                <div style={{
                  flex: 1, fontSize: 13,
                  color: active ? theme.ink : done ? theme.inkSoft : theme.inkFaint,
                  fontWeight: active ? 700 : 500
                }}>{p.label}</div>
              </div>);

          })}
        </div>

        {/* Passenger contact card */}
        <div style={{
          background: theme.surface, borderRadius: 14,
          border: `1px solid ${theme.borderSoft}`, padding: '11px 12px',
          display: 'flex', alignItems: 'center', gap: 12
        }}>
          <Avatar name="Ali" size={42} theme={theme} tint="accent" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: theme.inkFaint, fontWeight: 700,
              letterSpacing: 0.4, textTransform: 'uppercase' }}>Passenger</div>
            <div style={{ fontSize: 13.5, color: theme.ink, fontWeight: 600, marginTop: 2 }}>Ali</div>
            <div style={{ fontSize: 11, color: theme.inkSoft, marginTop: 1,
              fontFamily: 'DM Mono, monospace' }}>+91 98765 43210</div>
          </div>
          <div style={{
            width: 38, height: 38, borderRadius: 19,
            background: theme.success, color: theme.surface,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer'
          }}><Icon name="phone" size={16} stroke={theme.surface} /></div>
        </div>

        {/* Trip facts */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
          { l: 'Pickup', v: ride.from, icon: 'pin', col: theme.success },
          { l: 'Drop', v: ride.to, icon: 'flag', col: theme.danger },
          { l: 'Type', v: `${ride.distance === 'short' ? 'Short' : 'Long'} · ${ride.mode}`,
            icon: 'car', col: theme.primary },
          { l: 'Earning', v: `₹${ride.fare}`, icon: 'spark', col: theme.accent }].
          map((s, i) =>
          <div key={i} style={{
            background: theme.surface, borderRadius: 12,
            border: `1px solid ${theme.borderSoft}`, padding: '11px 12px'
          }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Icon name={s.icon} size={12} stroke={s.col} />
                <div style={{ fontSize: 9, color: theme.inkFaint, fontWeight: 700,
                letterSpacing: 0.4, textTransform: 'uppercase' }}>{s.l}</div>
              </div>
              <div style={{ fontSize: 13.5, color: theme.ink, fontWeight: 600,
              marginTop: 4, textTransform: i === 2 ? 'capitalize' : 'none' }}>{s.v}</div>
            </div>
          )}
        </div>

        {/* Completed state — show summary card */}
        {phase === 'done' &&
        <div style={{
          background: theme.success + '15', borderRadius: 14,
          border: `1px solid ${theme.success}40`, padding: '14px',
          textAlign: 'center'
        }}>
            <div style={{ fontSize: 11, color: theme.success, fontWeight: 700,
            letterSpacing: 0.5, textTransform: 'uppercase' }}>Paid in cash</div>
            <div style={{ fontFamily: 'Instrument Serif, serif',
            fontSize: 36, color: theme.ink, lineHeight: 1, marginTop: 6 }}>
              ₹{ride.fare}
            </div>
            <div style={{ fontSize: 11, color: theme.inkSoft, marginTop: 6 }}>
              Added to today\u2019s earnings
            </div>
          </div>
        }
      </div>

      <CabFooter
        label={cur.cta}
        theme={theme}
        onTap={onCta}
        icon={phase === 'done' ? 'home' : 'arrow'} />
    </div>);

}

Object.assign(window, { CabApp });