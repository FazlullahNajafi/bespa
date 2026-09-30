// Bespa — social screens: Community feed, AI Assistant

// ─── Community feed ─────────────────────────────────────────────
function ScreenCommunity({ theme, t, dir, nav }) {
  const stories = [
  { name: 'You', tint: 'primary', me: true },
  { name: 'Tsering', tint: 'accent' },
  { name: 'Fatima', tint: 'info' },
  { name: 'Stanzin', tint: 'success' }];

  const posts = [
  {
    name: 'Mohd Ali Khan',
    role: 'Sarpanch · Hardass',
    time: '20 min',
    tint: 'primary',
    text: 'Reminder — village meeting at the community hall tomorrow 4 PM. Agenda: water supply, road repair, scholarship list.',
    likes: 24
  },
  {
    name: 'Stanzin Wangchuk',
    role: 'Teacher',
    time: '5 hrs',
    tint: 'info',
    text: 'Class 8 students won the district science fair! So proud of our kids.',
    likes: 89
  }];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: theme.bg }}>
      <Header title={t.feedHeading} subtitle="Hardass Village" theme={theme} t={t}
      dir={dir}
      action={
      <div style={{ display: 'flex', gap: 8 }}>
                  <Icon name="search" size={20} stroke={theme.ink} />
                  <Icon name="bell" size={20} stroke={theme.ink} />
                </div>
      } />

      {/* Composer */}
      <div style={{ padding: '0 14px 10px' }}>
        <div onClick={nav && (() => nav.go('communityCompose'))} style={{
          background: theme.surface, border: `1px solid ${theme.borderSoft}`,
          borderRadius: 14, padding: '10px 12px',
          display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer'
        }}>
          <Avatar name="Ali" size={32} theme={theme} tint="accent" />
          <span style={{ flex: 1, fontSize: 13, color: theme.inkFaint }}>{t.postPlaceholder}</span>
          <div style={{ width: 30, height: 30, borderRadius: 15, background: theme.accentSoft,
            color: theme.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="image" size={16} />
          </div>
        </div>
      </div>

      {/* Stories */}
      <div style={{ padding: '0 14px 12px', display: 'flex', gap: 10, overflowX: 'auto', flexShrink: 0 }}>
        {stories.map((s, i) =>
        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <div style={{
            padding: 2, borderRadius: 26,
            background: s.me ? theme.surfaceAlt : `conic-gradient(from 180deg, ${theme.accent}, ${theme.primary}, ${theme.info}, ${theme.accent})`,
            border: s.me ? `1.5px dashed ${theme.border}` : 'none',
            position: 'relative'
          }}>
              <Avatar name={s.name} size={48} theme={theme} tint={s.tint} />
              {s.me &&
            <div style={{
              position: 'absolute', bottom: -2, right: -2,
              width: 18, height: 18, borderRadius: 9,
              background: theme.primary, color: theme.surface,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: `2px solid ${theme.surface}`
            }}><Icon name="plus" size={10} stroke={theme.surface} sw={2.5} /></div>
            }
            </div>
            <span style={{ fontSize: 10, color: theme.inkSoft, fontWeight: 500 }}>{s.name}</span>
          </div>
        )}
      </div>

      {/* Posts */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 14px 14px' }}>
        {posts.map((p, i) =>
        <div key={i} style={{
          background: theme.surface, borderRadius: 16,
          border: `1px solid ${theme.borderSoft}`,
          marginBottom: 10, overflow: 'hidden',
          textAlign: dir === 'rtl' ? 'right' : 'left'
        }}>
            <div style={{ padding: '12px 14px 8px', display: 'flex', alignItems: 'center', gap: 10,
            flexDirection: dir === 'rtl' ? 'row-reverse' : 'row' }}>
              <Avatar name={p.name} size={38} theme={theme} tint={p.tint} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: theme.ink }}>{p.name}</span>
                  {p.pinned && <Icon name="pin" size={12} stroke={theme.accent} />}
                </div>
                <div style={{ fontSize: 11, color: theme.inkSoft }}>{p.role} · {p.time}</div>
              </div>
            </div>

            {p.text &&
          <div style={{ padding: '0 14px 10px', fontSize: 13.5, lineHeight: 1.5, color: theme.ink }}>
              {p.text}
            </div>
          }

            {p.img &&
          <div style={{ padding: '0 14px 12px' }}>
                <Placeholder label={p.img} theme={theme} h={170} round={12} />
              </div>
          }
          </div>
        )}
      </div>

      <TabBar active="community" theme={theme} t={t} nav={nav} />
    </div>);

}

// ─── Community · New post (upload messages + photos) ────────────
// Opened from the composer bar at the top of the feed. Lets a villager
// write a message, attach photos, tag a topic, and choose who sees it.
// Same calm card language as the feed; footer carries the post action.
function ScreenCommunityCompose({ theme, t, dir, nav }) {
  // demo state — a message half-typed with two photos already attached
  const draft = 'Apricots are ready in the upper orchard. Anyone who wants to help with the harvest this Saturday is welcome — chai and lunch on me!';
  const photos = [
    { label: 'photo · apricot orchard', cover: true },
    { label: 'photo · ripe apricots' },
  ];
  const topics = [
    { id: 'help',   label: 'Help needed', on: true },
    { id: 'event',  label: 'Event' },
    { id: 'notice', label: 'Notice' },
    { id: 'sale',   label: 'For sale' },
    { id: 'lost',   label: 'Lost & found' },
  ];

  const align = dir === 'rtl' ? 'right' : 'left';
  const rev = dir === 'rtl' ? 'row-reverse' : 'row';

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: theme.bg }}>
      {/* Header */}
      <div style={{ background: theme.surface, padding: '14px 16px 12px',
        display: 'flex', alignItems: 'center', gap: 10,
        borderBottom: `1px solid ${theme.borderSoft}` }}>
        <div onClick={nav && (() => nav.back())} style={{
          width: 34, height: 34, borderRadius: 17, background: theme.surfaceAlt,
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
        }}><Icon name="close" size={16} /></div>
        <div style={{ flex: 1, textAlign: align }}>
          <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: 22,
            color: theme.ink, lineHeight: 1.1, letterSpacing: -0.3 }}>New post</div>
        </div>
        <div style={{
          padding: '7px 16px', borderRadius: 999,
          background: theme.surfaceAlt, color: theme.inkFaint,
          fontSize: 13, fontWeight: 700, letterSpacing: 0.2, cursor: 'pointer'
        }}>Draft</div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '12px 14px 8px' }}>
        {/* Author + audience selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexDirection: rev }}>
          <Avatar name="Ali" size={40} theme={theme} tint="accent" />
          <div style={{ flex: 1, textAlign: align }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: theme.ink }}>Ali</div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 3,
              padding: '3px 9px 3px 7px', borderRadius: 999,
              background: theme.primarySoft, color: theme.primary,
              fontSize: 10.5, fontWeight: 700, cursor: 'pointer',
              flexDirection: rev
            }}>
              <Icon name="people" size={12} stroke={theme.primary} />
              Hardass Village
              <Icon name="chevron" size={12} stroke={theme.primary} />
            </div>
          </div>
        </div>

        {/* Message field */}
        <div style={{
          marginTop: 14, background: theme.surface,
          border: `1.5px solid ${theme.primary}`, borderRadius: 16,
          padding: '14px 14px 12px', textAlign: align,
          boxShadow: `0 0 0 4px ${theme.primary}12`
        }}>
          <div style={{ fontSize: 15, color: theme.ink, lineHeight: 1.5 }}>
            {draft}
            <span style={{ display: 'inline-block', width: 1.5, height: 18,
              background: theme.primary, marginLeft: 2, verticalAlign: -3 }} />
          </div>
        </div>

        {/* Photo upload grid */}
        <div style={{ marginTop: 14, textAlign: align }}>
          <div style={{
            fontSize: 10, fontWeight: 700, color: theme.inkSoft,
            letterSpacing: 0.5, textTransform: 'uppercase',
            padding: '0 4px 8px', display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', flexDirection: rev
          }}>
            <span>Photos</span>
            <span style={{ fontSize: 9, fontWeight: 500, color: theme.inkFaint,
              textTransform: 'none', letterSpacing: 0 }}>{photos.length} of 4 added</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {photos.map((ph, i) =>
              <div key={i} style={{ position: 'relative' }}>
                <Placeholder label={ph.label} theme={theme} h={92} round={12} tone="primary" />
                {/* remove badge */}
                <div style={{
                  position: 'absolute', top: 5, right: 5,
                  width: 20, height: 20, borderRadius: 10,
                  background: theme.ink + 'cc', color: theme.surface,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer'
                }}><Icon name="close" size={11} stroke={theme.surface} sw={2.2} /></div>
                {ph.cover &&
                <div style={{
                  position: 'absolute', bottom: 5, left: 5,
                  padding: '2px 7px', borderRadius: 7,
                  background: theme.accent, color: theme.surface,
                  fontSize: 8.5, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase'
                }}>Cover</div>
                }
              </div>
            )}
            {/* Add tile */}
            <div style={{
              height: 92, borderRadius: 12,
              border: `1.5px dashed ${theme.border}`,
              background: theme.surfaceAlt,
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: 5, cursor: 'pointer', color: theme.inkSoft
            }}>
              <Icon name="plus" size={20} stroke={theme.inkSoft} />
              <span style={{ fontSize: 10.5, fontWeight: 600 }}>Add</span>
            </div>
          </div>
        </div>

        {/* Topic tags */}
        <div style={{ marginTop: 16, textAlign: align }}>
          <div style={{
            fontSize: 10, fontWeight: 700, color: theme.inkSoft,
            letterSpacing: 0.5, textTransform: 'uppercase', padding: '0 4px 8px'
          }}>Add a topic</div>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap',
            flexDirection: dir === 'rtl' ? 'row-reverse' : 'row' }}>
            {topics.map(tp =>
              <div key={tp.id} style={{
                padding: '7px 13px', borderRadius: 999,
                background: tp.on ? theme.primary : theme.surface,
                color: tp.on ? theme.surface : theme.inkSoft,
                border: `1px solid ${tp.on ? theme.primary : theme.borderSoft}`,
                fontSize: 12, fontWeight: 600, cursor: 'pointer', userSelect: 'none'
              }}>{tp.label}</div>
            )}
          </div>
        </div>
      </div>

      {/* Attachment toolbar + post action */}
      <div style={{
        background: theme.surface, borderTop: `1px solid ${theme.borderSoft}`,
        padding: '10px 14px 14px', flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
          flexDirection: rev }}>
          {[
            { icon: 'image',  label: 'Gallery', tint: theme.accent,  soft: theme.accentSoft },
            { icon: 'camera', label: 'Camera',  tint: theme.primary, soft: theme.primarySoft },
            { icon: 'pin',    label: 'Place',   tint: theme.info,    soft: theme.info + '1f' },
          ].map(a =>
            <div key={a.label} style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '9px 6px', borderRadius: 12,
              background: a.soft, color: a.tint, cursor: 'pointer',
              fontSize: 12, fontWeight: 600
            }}>
              <Icon name={a.icon} size={16} stroke={a.tint} />
              {a.label}
            </div>
          )}
        </div>
        <div onClick={nav && (() => nav.back())} style={{
          background: theme.primary, color: theme.surface,
          borderRadius: 14, padding: '14px 16px', textAlign: 'center',
          fontWeight: 700, fontSize: 14.5, letterSpacing: 0.2,
          boxShadow: `0 8px 18px ${theme.primary}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          cursor: 'pointer', userSelect: 'none'
        }}>
          Post to community
          <Icon name="send" size={16} stroke={theme.surface} />
        </div>
      </div>
    </div>
  );
}

// ─── AI Assistant ───────────────────────────────────────────────
function ScreenAssistant({ theme, t, dir, nav }) {
  const messages = [
  { who: 'ai', text: t.askAnything, time: '' },
  { who: 'me', text: 'Apricot leh storkar drangs khasiyat tang?', time: '', script: 'purgi' },
  { who: 'ai', text: 'Apricot kernels from Kargil are high in vitamin E and oleic acid. Traditionally pressed for oil — good for skin and used in winter cooking.', time: '' },
  { who: 'me', text: 'Zoji La pass khula hai kya?', time: '' },
  { who: 'ai', text: 'Zoji La opened on 1 March this year. Latest BRO update: heavy vehicles restricted between 7 PM – 7 AM. Want me to check the road status now?', time: '', suggest: ['Check road', 'Weather at pass', 'Cab to Srinagar'] }];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: theme.bg }}>
      {/* Custom header */}
      <div style={{
        background: theme.surface, padding: '14px 16px 12px',
        borderBottom: `1px solid ${theme.borderSoft}`,
        display: 'flex', alignItems: 'center', gap: 10
      }}>
        <div onClick={nav && (() => nav.back())} style={{
          width: 34, height: 34, borderRadius: 17, background: theme.surfaceAlt,
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: nav ? 'pointer' : 'default'
        }}><Icon name="back" size={18} /></div>
        <div style={{
          width: 38, height: 38, borderRadius: 19,
          background: `conic-gradient(from 0deg, ${theme.accent}, ${theme.primary}, ${theme.info}, ${theme.accent})`,
          padding: 2, flexShrink: 0
        }}>
          <div style={{
            width: '100%', height: '100%', borderRadius: 17,
            background: theme.surface, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: theme.primary
          }}>
            <Icon name="spark" size={18} stroke={theme.primary} />
          </div>
        </div>
        <div style={{ flex: 1, textAlign: dir === 'rtl' ? 'right' : 'left' }}>
          <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: 18, color: theme.ink, lineHeight: 1 }}>Bespa AI

          </div>
          <div style={{ fontSize: 11, color: theme.success, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: 3, background: theme.success }} />
            English, Purgi, Urdu, Hindi
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflow: 'auto', padding: '14px 14px 4px' }}>
        {messages.map((m, i) => {
          const me = m.who === 'me';
          return (
            <div key={i} style={{ marginBottom: 10, display: 'flex', justifyContent: me ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '78%',
                background: me ? theme.primary : theme.surface,
                color: me ? theme.surface : theme.ink,
                borderRadius: 14,
                borderTopLeftRadius: me ? 14 : 4,
                borderTopRightRadius: me ? 4 : 14,
                padding: '9px 12px',
                border: me ? 'none' : `1px solid ${theme.borderSoft}`,
                fontSize: 13.5, lineHeight: 1.45
              }}>
                <div style={{
                  fontFamily: m.script === 'purgi' ?
                  'Noto Naskh Arabic, DM Sans, sans-serif' :
                  'DM Sans, sans-serif'
                }}>{m.text}</div>
                {m.suggest &&
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {m.suggest.map((s) =>
                  <div key={s} style={{
                    padding: '5px 10px', borderRadius: 12,
                    background: theme.primarySoft, color: theme.primary,
                    fontSize: 11, fontWeight: 600
                  }}>{s}</div>
                  )}
                  </div>
                }
                <div style={{
                  fontSize: 9.5, marginTop: 4, opacity: 0.6,
                  textAlign: me ? 'right' : 'left'
                }}>{m.time}</div>
              </div>
            </div>);

        })}
        {/* Suggestion chips above input */}
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          {['Weather today', 'Govt schemes', 'PM-Kisan status', 'Translate'].map((s) =>
          <div key={s} style={{
            padding: '6px 11px', borderRadius: 14,
            background: theme.surface, border: `1px solid ${theme.border}`,
            color: theme.inkSoft, fontSize: 11.5, fontWeight: 500
          }}>{s}</div>
          )}
        </div>
      </div>

      {/* Input */}
      <div style={{
        padding: '8px 12px 10px', background: theme.surface,
        borderTop: `1px solid ${theme.borderSoft}`,
        display: 'flex', alignItems: 'center', gap: 8
      }}>
        <div style={{ width: 36, height: 36, borderRadius: 18, background: theme.surfaceAlt,
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.inkSoft }}>
          <Icon name="plus" size={18} />
        </div>
        <div style={{
          flex: 1, background: theme.bg, border: `1px solid ${theme.border}`,
          borderRadius: 20, padding: '9px 14px',
          display: 'flex', alignItems: 'center', gap: 8
        }}>
          <span style={{ flex: 1, fontSize: 13, color: theme.inkFaint }}>{t.typeMessage}</span>
        </div>
        <div style={{
          width: 38, height: 38, borderRadius: 19,
          background: theme.primary, color: theme.surface,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <Icon name="send" size={16} stroke={theme.surface} />
        </div>
      </div>
    </div>);

}

Object.assign(window, { ScreenCommunity, ScreenCommunityCompose, ScreenAssistant });