// Bespa — service screens: Govt Notices, Village Members, Cab, Gallery

// ─── Government Notices ─────────────────────────────────────────
function ScreenNotices({ theme, t, dir, nav }) {
  const notices = [
    {
      dept: 'BDO Kargil',
      title: 'MGNREGA work allotment — March cycle',
      preview: 'New job cards approved for 24 households in Hardass and Sankoo panchayats.',
      date: '2 hrs ago',
      tag: 'Employment',
      pinned: true,
      new: true,
    },
    {
      dept: 'Health Dept.',
      title: 'Winter immunisation drive at PHC',
      preview: 'Children under 5 — vaccination camp on Friday 9 AM to 2 PM.',
      date: 'Yesterday',
      tag: 'Health',
      new: true,
    },
    {
      dept: 'PWD',
      title: 'Zoji La pass — road status update',
      preview: 'Snow clearance ongoing. Heavy vehicles restricted until further notice.',
      date: '2 days ago',
      tag: 'Roads',
      new: true,
    },
    {
      dept: 'Education',
      title: 'Scholarship applications open',
      preview: 'Post-matric scholarships for ST/SC students — apply by 30 April.',
      date: '4 days ago',
      tag: 'Scholarship',
    },
    {
      dept: 'Revenue',
      title: 'Land records digitisation camp',
      preview: 'Bring patta papers to the camp at Tehsil office, Kargil.',
      date: '1 week ago',
      tag: 'Records',
    },
  ];
  const tagColor = {
    Employment: theme.accent,
    Health: theme.success,
    Roads: theme.info,
    Scholarship: theme.primary,
    Records: theme.danger,
  };
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: theme.bg }}>
      <Header title={t.noticesHeading} subtitle="Kargil District" theme={theme} t={t}
              onBack={nav && (() => nav.back())} motif dir={dir}
              action={<Icon name="search" size={20} stroke={theme.ink}/>}/>

      {/* Filter chips */}
      <div style={{ display: 'flex', gap: 6, padding: '12px 14px 8px', overflowX: 'auto', flexShrink: 0 }}>
        {['All', 'Pinned', 'Health', 'Roads', 'Employment', 'Scholarship'].map((c, i) => (
          <div key={c} style={{
            padding: '6px 12px', borderRadius: 16,
            background: i === 0 ? theme.primary : theme.surface,
            color: i === 0 ? theme.surface : theme.inkSoft,
            fontSize: 11.5, fontWeight: 600,
            border: `1px solid ${i === 0 ? theme.primary : theme.border}`,
            whiteSpace: 'nowrap',
          }}>{c}</div>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '4px 14px 14px' }}>
        {notices.map((n, i) => (
          <div key={i} style={{
            background: theme.surface, borderRadius: 14,
            border: `1px solid ${theme.borderSoft}`,
            padding: '12px 14px', marginBottom: 8,
            position: 'relative',
            textAlign: dir === 'rtl' ? 'right' : 'left',
          }}>
            {n.pinned && (
              <div style={{ position: 'absolute', top: 12, right: 12, color: theme.accent }}>
                <Icon name="pin" size={14} stroke={theme.accent}/>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                padding: '2px 8px', borderRadius: 4,
                background: tagColor[n.tag] + '20', color: tagColor[n.tag],
                fontSize: 9.5, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase',
              }}>{n.tag}</div>
              {n.new && (
                <div style={{
                  padding: '2px 6px', borderRadius: 4,
                  background: theme.danger, color: '#fff',
                  fontSize: 9, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase',
                }}>{t.newTag}</div>
              )}
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: theme.ink, marginTop: 6, lineHeight: 1.3 }}>
              {n.title}
            </div>
            <div style={{ fontSize: 12, color: theme.inkSoft, marginTop: 4, lineHeight: 1.4 }}>
              {n.preview}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8,
              fontSize: 11, color: theme.inkFaint }}>
              <Icon name="file" size={12} stroke={theme.inkFaint}/>
              <span>{n.dept}</span>
              <span style={{ width: 3, height: 3, borderRadius: 2, background: theme.inkFaint }}/>
              <span>{n.date}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Village Members ────────────────────────────────────────────
function ScreenMembers({ theme, t, dir, nav }) {
  const members = [
    { name: 'Mohd Ali Khan', role: 'Sarpanch', tint: 'primary', online: true, sub: '' },
    { name: 'Tsering Dolma', role: 'ASHA Worker', tint: 'success', sub: '' },
    { name: 'Stanzin Wangchuk', role: 'Teacher', tint: 'info', online: true, sub: '' },
    { name: 'Fatima Bano', role: 'Anganwadi', tint: 'accent', sub: '' },
    { name: 'Hassan Ali', role: 'Farmer', tint: 'primary', sub: '' },
    { name: 'Padma Ladol', role: 'Weaver', tint: 'accent', online: true, sub: '' },
    { name: 'Ghulam Mehdi', role: 'Driver', tint: 'info', sub: 'Tata Sumo · Kargil–Leh' },
  ];
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: theme.bg }}>
      <Header title={t.membersHeading} subtitle="142 members · Hardass" theme={theme} t={t}
              onBack={nav && (() => nav.back())} dir={dir}
              action={<Icon name="plus" size={20} stroke={theme.ink}/>}/>

      <div style={{ padding: '4px 14px 10px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: theme.surface, border: `1px solid ${theme.border}`,
          borderRadius: 12, padding: '10px 12px',
        }}>
          <Icon name="search" size={16} stroke={theme.inkFaint}/>
          <span style={{ flex: 1, fontSize: 13, color: theme.inkFaint }}>{t.searchMembers}</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, padding: '0 14px 10px', flexShrink: 0 }}>
        {[t.elders, t.youth, t.officials, 'Women', 'Drivers'].map((c, i) => (
          <div key={c} style={{
            padding: '5px 11px', borderRadius: 14,
            background: i === 2 ? theme.accentSoft : theme.surface,
            color: i === 2 ? theme.accent : theme.inkSoft,
            fontSize: 11, fontWeight: 600,
            border: `1px solid ${i === 2 ? theme.accent + '40' : theme.borderSoft}`,
            whiteSpace: 'nowrap',
          }}>{c}</div>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '0 10px 14px' }}>
        {members.map((m, i) => (
          <div key={i} style={{
            background: theme.surface, borderRadius: 14,
            border: `1px solid ${theme.borderSoft}`,
            padding: '10px 12px', marginBottom: 6,
            display: 'flex', alignItems: 'center', gap: 12,
            textAlign: dir === 'rtl' ? 'right' : 'left',
            flexDirection: dir === 'rtl' ? 'row-reverse' : 'row',
          }}>
            <div style={{ position: 'relative' }}>
              <Avatar name={m.name} size={44} theme={theme} tint={m.tint}/>
              {m.online && (
                <div style={{
                  position: 'absolute', bottom: 0, right: 0, width: 12, height: 12,
                  borderRadius: 6, background: theme.success, border: `2px solid ${theme.surface}`,
                }}/>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: theme.ink, lineHeight: 1.2 }}>{m.name}</div>
              <div style={{ fontSize: 11.5, color: theme.inkSoft, marginTop: 2 }}>
                <span style={{ color: theme.primary, fontWeight: 600 }}>{m.role}</span>
                {m.sub && (
                  <span style={{ color: theme.inkFaint }}> · {m.sub}</span>
                )}
              </div>
            </div>
            <div style={{
              width: 32, height: 32, borderRadius: 16,
              background: theme.primarySoft, color: theme.primary,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name="phone" size={15}/>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Cab booking ────────────────────────────────────────────────
function ScreenCab_legacy({ theme, t, dir }) {
  const cabs = [
    { route: t.sumoToLeh, time: '7:30 AM', seats: 3, total: 7, fare: '₹600', driver: 'Ghulam M.', dur: '5h 30m' },
    { route: 'Sumo · Kargil → Drass', time: '8:00 AM', seats: 5, total: 9, fare: '₹250', driver: 'Mehboob A.', dur: '1h 45m' },
    { route: 'Innova · Kargil → Padum', time: '6:00 AM', seats: 2, total: 6, fare: '₹1,200', driver: 'Tashi N.', dur: '8h' },
    { route: 'Sumo · Sankoo → Kargil', time: '9:15 AM', seats: 4, total: 7, fare: '₹150', driver: 'Hassan K.', dur: '45m' },
  ];
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: theme.bg }}>
      <Header title={t.cabHeading} subtitle="Find a ride in the valley" theme={theme} t={t}
              onBack dir={dir}/>

      {/* Shared/Private toggle */}
      <div style={{ padding: '4px 14px 10px' }}>
        <div style={{
          display: 'flex', background: theme.surface, border: `1px solid ${theme.borderSoft}`,
          borderRadius: 14, padding: 4,
        }}>
          {[t.shared, t.private].map((tab, i) => (
            <div key={tab} style={{
              flex: 1, textAlign: 'center', padding: '8px 0',
              fontSize: 13, fontWeight: 600,
              borderRadius: 10,
              background: i === 0 ? theme.primary : 'transparent',
              color: i === 0 ? theme.surface : theme.inkSoft,
            }}>{tab}</div>
          ))}
        </div>
      </div>

      {/* From/To */}
      <div style={{ padding: '0 14px 12px' }}>
        <div style={{
          background: theme.surface, borderRadius: 16,
          border: `1px solid ${theme.borderSoft}`, padding: '4px 14px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0',
            borderBottom: `1px dashed ${theme.borderSoft}`, textAlign: dir === 'rtl' ? 'right' : 'left' }}>
            <div style={{ width: 8, height: 8, borderRadius: 4, background: theme.success, flexShrink: 0 }}/>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: theme.inkFaint, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase' }}>{t.from}</div>
              <div style={{ fontSize: 13, color: theme.ink, fontWeight: 600 }}>Hardass Village</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', textAlign: dir === 'rtl' ? 'right' : 'left' }}>
            <div style={{ width: 8, height: 8, borderRadius: 4, background: theme.danger, flexShrink: 0 }}/>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: theme.inkFaint, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase' }}>{t.to}</div>
              <div style={{ fontSize: 13, color: theme.ink, fontWeight: 600 }}>Leh, Ladakh</div>
            </div>
          </div>
        </div>
      </div>

      {/* Available list */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 14px 14px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: theme.inkSoft,
          letterSpacing: 0.5, textTransform: 'uppercase', padding: '0 4px 8px' }}>
          4 rides available today
        </div>
        {cabs.map((c, i) => (
          <div key={i} style={{
            background: theme.surface, borderRadius: 14,
            border: `1px solid ${theme.borderSoft}`, padding: '12px 14px',
            marginBottom: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: theme.accentSoft, color: theme.accent,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}><Icon name="car" size={22}/></div>
              <div style={{ flex: 1, textAlign: dir === 'rtl' ? 'right' : 'left' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: theme.ink, lineHeight: 1.3 }}>{c.route}</div>
                <div style={{ fontSize: 11, color: theme.inkSoft, marginTop: 3 }}>
                  Driver {c.driver} · {c.dur}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: 20, color: theme.ink, lineHeight: 1 }}>{c.fare}</div>
                <div style={{ fontSize: 10, color: theme.inkFaint, marginTop: 2 }}>per seat</div>
              </div>
            </div>
            <div style={{
              marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${theme.borderSoft}`,
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: theme.inkSoft }}>
                <Icon name="clock" size={13} stroke={theme.inkSoft}/>
                <span style={{ color: theme.ink, fontWeight: 600 }}>{c.time}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: theme.inkSoft }}>
                <Icon name="seat" size={13} stroke={theme.inkSoft}/>
                <span><span style={{ color: theme.success, fontWeight: 700 }}>{c.seats}</span>/{c.total} {t.seatsLeft}</span>
              </div>
              <div style={{ flex: 1 }}/>
              <div style={{
                padding: '5px 12px', borderRadius: 12,
                background: theme.primary, color: theme.surface,
                fontSize: 11, fontWeight: 600,
              }}>{t.bookNow}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Photo Gallery ──────────────────────────────────────────────
function ScreenGallery({ theme, t, dir, nav }) {
  const albums = [
    { name: 'Apricot Festival', count: 142, tone: 'accent' },
    { name: 'Winter at Drass', count: 86, tone: 'info' },
    { name: 'School Annual Day', count: 54, tone: 'primary' },
  ];
  const photos = [
    { label: 'mountains', tall: true },
    { label: 'village street' },
    { label: 'kids dancing' },
    { label: 'apricot tree', tall: true },
    { label: 'stone homes' },
    { label: 'snow scene' },
    { label: 'elders' },
    { label: 'mosque' },
  ];
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: theme.bg }}>
      <Header title={t.galleryHeading} subtitle="Hardass · Sankoo · Drass" theme={theme} t={t}
              onBack={nav && (() => nav.back())} dir={dir}
              action={
                <div style={{
                  padding: '6px 12px', background: theme.primary, color: theme.surface,
                  borderRadius: 12, fontSize: 12, fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: 5,
                }}>
                  <Icon name="plus" size={14} stroke={theme.surface}/>
                  {t.upload}
                </div>
              }/>

      {/* Albums row */}
      <div style={{ padding: '4px 14px 14px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: theme.inkSoft,
          letterSpacing: 0.5, textTransform: 'uppercase', padding: '0 4px 8px',
          textAlign: dir === 'rtl' ? 'right' : 'left' }}>{t.albums}</div>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
          {albums.map((a, i) => {
            const tints = { accent: theme.accent, info: theme.info, primary: theme.primary };
            return (
              <div key={i} style={{
                flexShrink: 0, width: 130, height: 130, borderRadius: 14,
                background: `linear-gradient(135deg, ${tints[a.tone]}cc, ${tints[a.tone]})`,
                padding: 12, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
                color: '#fff', position: 'relative', overflow: 'hidden',
              }}>
                <div style={{ position: 'absolute', inset: 0, opacity: 0.3 }}>
                  <MountainMotif height={130} c1="#ffffff20" c2="#ffffff35" c3="#ffffff55"/>
                </div>
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: 18, lineHeight: 1.1 }}>{a.name}</div>
                  <div style={{ fontSize: 11, opacity: 0.9, marginTop: 4 }}>{a.count} photos</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Photo masonry grid */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 14px 14px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: theme.inkSoft,
          letterSpacing: 0.5, textTransform: 'uppercase', padding: '0 4px 8px',
          textAlign: dir === 'rtl' ? 'right' : 'left' }}>Recent</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {photos.map((p, i) => (
            <Placeholder key={i} label={p.label} theme={theme} h={p.tall ? 160 : 110} round={12}/>
          ))}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ScreenNotices, ScreenMembers, ScreenGallery });
