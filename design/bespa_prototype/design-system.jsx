// Bespa Design System
// Kargil/Himalayan-inspired tokens — original visual language drawing from
// landscape (Suru valley, Drass, stone villages, apricot orchards).
// Religiously neutral; no copyrighted/branded motifs.

const THEMES = {
  suruDawn: {
    name: 'Suru Dawn',
    bg: '#f6efe4',        // warm parchment
    surface: '#ffffff',
    surfaceAlt: '#fbf6ec',
    ink: '#1a2238',       // deep ink-blue
    inkSoft: '#5b6580',
    inkFaint: '#9aa2b8',
    border: '#e7dcc7',
    borderSoft: '#efe7d5',
    primary: '#2b3a6b',   // twilight indigo
    primarySoft: '#dfe3ee',
    accent: '#e8915a',    // apricot
    accentSoft: '#fce7d6',
    success: '#5a8a6b',
    danger: '#b9543d',    // terracotta
    info: '#5d8a99',      // glacier teal
  },
  drassSnow: {
    name: 'Drass Snow',
    bg: '#eef3f6',
    surface: '#ffffff',
    surfaceAlt: '#f7fafc',
    ink: '#0f1f33',
    inkSoft: '#4a5b73',
    inkFaint: '#8a98ad',
    border: '#dfe7ed',
    borderSoft: '#ebf0f4',
    primary: '#1d3b66',
    primarySoft: '#d6e1ee',
    accent: '#3c8aa8',    // glacier
    accentSoft: '#d4e8ef',
    success: '#3b7d6b',
    danger: '#a04a3b',
    info: '#3c8aa8',
  },
  stoneVillage: {
    name: 'Stone Village',
    bg: '#f3ece1',
    surface: '#ffffff',
    surfaceAlt: '#f9f2e6',
    ink: '#2a1e15',
    inkSoft: '#6e5a48',
    inkFaint: '#a89380',
    border: '#e3d4bd',
    borderSoft: '#ede0cc',
    primary: '#6b3a26',   // terracotta
    primarySoft: '#f0dccb',
    accent: '#c97a3f',
    accentSoft: '#f4dcc4',
    success: '#6b7a3a',
    danger: '#a23a2a',
    info: '#5d7a8a',
  },
  twilight: {
    name: 'Twilight',
    bg: '#0f1421',
    surface: '#1a2238',
    surfaceAlt: '#222b45',
    ink: '#eef0f6',
    inkSoft: '#a3acc4',
    inkFaint: '#6a7494',
    border: '#2c3654',
    borderSoft: '#252d48',
    primary: '#7e9bd9',
    primarySoft: '#27324e',
    accent: '#e8915a',
    accentSoft: '#3a2a1f',
    success: '#7ab28c',
    danger: '#d76a51',
    info: '#7eb0c4',
  },
};

// Bilingual copy registry — every UI string keyed here so the language
// tweak flips them all in lockstep.
const COPY = {
  en: {
    appName: 'Bespa',
    tagline: 'For Kargil and the valleys around it',

    // home tiles
    notices: 'Govt Notices',
    members: 'Village Members',
    cabs: 'Cabs',
    assistant: 'Bespa AI ',
    community: 'Community',
    gallery: 'Gallery',
    weather: 'Weather',
    settings: 'Settings',
    profile: 'Profile',

    // login
    welcome: 'Welcome to Bespa',
    loginSubtitle: 'Sign in with your mobile number',
    phoneLabel: 'Mobile number',
    sendOtp: 'Send OTP',
    continueGoogle: 'Continue with Google',
    orDivider: 'or',
    enterOtp: 'Enter the 6-digit code',
    otpSentTo: 'Sent to',
    verify: 'Verify & continue',
    resend: 'Resend code',

    // home
    namaskar: 'Hello, Ali',
    yourVillage: 'Hardass Village · Kargil',
    quickAccess: 'Quick access',
    todayInValley: 'Today in the valley',

    // weather
    feelsLike: 'Feels like',
    forecast: '7-day forecast',
    sunrise: 'Sunrise',
    sunset: 'Sunset',
    wind: 'Wind',
    humidity: 'Humidity',

    // cab
    cabHeading: 'Book a cab',
    shared: 'Shared',
    private: 'Private',
    from: 'From',
    to: 'To',
    when: 'When',
    bookNow: 'Book now',
    seatsLeft: 'seats left',
    sumoToLeh: 'Tata Sumo · Kargil → Leh',

    // notices
    noticesHeading: 'Government notices',
    newTag: 'New',

    // community
    feedHeading: 'Community',
    postPlaceholder: "What's happening in the village?",
    like: 'Like',
    comment: 'Comment',

    // gallery
    galleryHeading: 'Village gallery',
    albums: 'Albums',
    upload: 'Upload',

    // assistant
    askAnything: 'Ask anything in your language',
    typeMessage: 'Type a message…',

    // members
    membersHeading: 'Members directory',
    searchMembers: 'Search by name or role',
    elders: 'Elders',
    youth: 'Youth',
    officials: 'Officials',

    // profile (name + occupation)
    profileTitle: 'Tell us about you',
    profileSub: 'A name to greet you by and what you do — so notices and people in your area find you faster.',
    nameLabel: 'Your name',
    namePlaceholder: '\n',
    nameHint: '\n',
    occupationLabel: 'What do you do?',
    occupationHint: 'Pick the closest one. You can add more later.',
    occFarmer: 'Farmer ',
    occFarmerSub: '\n',
    occDriver: 'Taxi Driver',
    occDriverSub: '\n',
    occShop: 'Shopkeeper',
    occShopSub: '\n',
    occOfficial: 'Govt. Official',
    occOfficialSub: '\n',
    occTeacher: 'Teacher',
    occTeacherSub: '\n',
    occHealth: 'Health worker',
    occHealthSub: '\n',
    occStudent: 'Student',
    occStudentSub: 'School or college',
    occGuide: 'Guide / Tourism',
    occGuideSub: 'Trek, homestay, taxi',
    occHome: 'Homemaker',
    occHomeSub: 'Household & care',
    occArtisan: 'Artisan',
    occArtisanSub: 'Weaving, carpentry, mason',
    occOther: 'Something else',
    occOtherSub: 'Tell us in your words',
    profileContinue: 'Continue',
    profileOptional: '\n',

    // location onboarding
    locWelcome: 'Set up your area',
    locWhy: 'We’ll tailor notices, services and stats to where you actually live.',
    locState: 'State / UT',
    locDistrict: 'District',
    locBlock: 'Block',
    locAreaType: 'Where do you live?',
    locRural: 'Village',
    locRuralSub: 'Gram Panchayat area',
    locUrban: 'Town',
    locUrbanSub: 'Municipal area',
    locPanchayat: 'Panchayat halqa',
    locMunicipality: 'Municipality',
    locContinue: 'Continue',
    locConfirm: 'Confirm & continue',
    locStep: 'Step',
    locOf: 'of',
    locSelected: 'Selected',
    locPopulation: 'Population',
    locHouseholds: 'Households',
    locVillages: 'villages',
    locArea: 'Area',
    locSexRatio: 'Sex ratio',
    locLiteracy: 'Literacy',
    locElevation: 'Elevation',
    locYourArea: 'Your area',
    locReady: 'You’re all set, Tashi',
    locReadySub: 'Bespa will now show notices and services for Hardass.',
    locSearchPlace: 'Search village or town…',
    locChangeAnytime: 'You can change this anytime from Settings.',
  },
  pq: {
    // Purgi/Balti — written here in Perso-Arabic script (common in Kargil)
    // with Roman fallback in parentheses to keep the spec readable.
    appName: 'بیسپا',
    tagline: 'کرگل اور ارد گرد کے دیہاتوں کے لیے',

    notices: 'سرکاری اطلاعات',
    members: 'گاؤں کے لوگ',
    cabs: 'گاڑی',
    assistant: 'Bespa AI ',
    community: 'لوگ',
    gallery: 'تصویرخانہ',
    weather: 'موسم',
    settings: 'ترتیبات',
    profile: 'پروفائل',

    welcome: 'بیسپا میں خوش آمدید',
    loginSubtitle: 'موبائل نمبر سے داخل ہوں',
    phoneLabel: 'موبائل نمبر',
    sendOtp: 'کوڈ بھیجیں',
    continueGoogle: 'Google سے جاری رکھیں',
    orDivider: 'یا',
    enterOtp: '۶ ہندسوں کا کوڈ درج کریں',
    otpSentTo: 'بھیجا گیا',
    verify: 'تصدیق کریں',
    resend: 'دوبارہ بھیجیں',

    namaskar: 'جولے، تاشی',
    yourVillage: 'گاؤں ہرڈاس · کرگل',
    quickAccess: 'فوری رسائی',
    todayInValley: 'وادی میں آج',

    feelsLike: 'محسوس ہوتا ہے',
    forecast: '۷ دن کی پیش گوئی',
    sunrise: 'طلوع',
    sunset: 'غروب',
    wind: 'ہوا',
    humidity: 'نمی',

    cabHeading: 'گاڑی بک کریں',
    shared: 'مشترکہ',
    private: 'نجی',
    from: 'سے',
    to: 'تک',
    when: 'کب',
    bookNow: 'ابھی بک کریں',
    seatsLeft: 'سیٹیں باقی',
    sumoToLeh: 'سومو · کرگل سے لیہہ',

    noticesHeading: 'سرکاری اطلاعات',
    newTag: 'نیا',

    feedHeading: 'برادری',
    postPlaceholder: 'گاؤں میں کیا ہو رہا ہے؟',
    like: 'پسند',
    comment: 'تبصرہ',

    galleryHeading: 'گاؤں کی تصاویر',
    albums: 'البم',
    upload: 'اپ لوڈ',

    askAnything: 'اپنی زبان میں کچھ بھی پوچھیں',
    typeMessage: 'پیغام لکھیں…',

    membersHeading: 'لوگوں کی فہرست',
    searchMembers: 'نام یا کام سے تلاش کریں',
    elders: 'بزرگ',
    youth: 'نوجوان',
    officials: 'افسر',

    // profile (name + occupation)
    profileTitle: 'اپنے بارے میں بتائیں',
    profileSub: 'ایک نام جس سے ہم آپ کو پکاریں اور آپ کا کام — تاکہ آپ کے علاقے کی اطلاعات اور لوگ آپ تک جلدی پہنچ سکیں۔',
    nameLabel: 'آپ کا نام',
    namePlaceholder: '\n',
    nameHint: '\n',
    occupationLabel: 'آپ کیا کام کرتے ہیں؟',
    occupationHint: 'قریب ترین چنیں۔ بعد میں مزید شامل کر سکتے ہیں۔',
    occFarmer: 'کسان ',
    occFarmerSub: '\n',
    occDriver: 'ڈرائیور',
    occDriverSub: '\n',
    occShop: 'دکاندار',
    occShopSub: '\n',
    occOfficial: 'سرکاری ملازم',
    occOfficialSub: '\n',
    occTeacher: 'استاد',
    occTeacherSub: '\n',
    occHealth: 'صحت کارکن',
    occHealthSub: '\n',
    occStudent: 'طالب علم',
    occStudentSub: 'اسکول یا کالج',
    occGuide: 'گائیڈ / سیاحت',
    occGuideSub: 'ٹریک، ہوم اسٹے',
    occHome: 'گھریلو',
    occHomeSub: 'گھر اور دیکھ بھال',
    occArtisan: 'دستکار',
    occArtisanSub: 'بُنائی، بڑھئی، مستری',
    occOther: 'کوئی اور',
    occOtherSub: 'اپنے الفاظ میں بتائیں',
    profileContinue: 'آگے بڑھیں',
    profileOptional: '\n',

    // location onboarding
    locWelcome: 'اپنا علاقہ منتخب کریں',
    locWhy: 'ہم آپ کے علاقے کے مطابق اطلاعات اور اعداد و شمار دکھائیں گے۔',
    locState: 'ریاست',
    locDistrict: 'ضلع',
    locBlock: 'بلاک',
    locAreaType: 'آپ کہاں رہتے ہیں؟',
    locRural: 'گاؤں',
    locRuralSub: 'گرام پنچایت',
    locUrban: 'قصبہ',
    locUrbanSub: 'میونسپل علاقہ',
    locPanchayat: 'پنچایت حلقہ',
    locMunicipality: 'میونسپلٹی',
    locContinue: 'آگے بڑھیں',
    locConfirm: 'تصدیق کریں',
    locStep: 'مرحلہ',
    locOf: 'بٹا',
    locSelected: 'منتخب',
    locPopulation: 'آبادی',
    locHouseholds: 'گھرانے',
    locVillages: 'گاؤں',
    locArea: 'رقبہ',
    locSexRatio: 'جنسی تناسب',
    locLiteracy: 'شرحِ خواندگی',
    locElevation: 'بلندی',
    locYourArea: 'آپ کا علاقہ',
    locReady: 'سب تیار ہے، تاشی',
    locReadySub: 'بیسپا اب ہرڈاس کی اطلاعات دکھائے گا۔',
    locSearchPlace: 'گاؤں یا قصبہ تلاش کریں…',
    locChangeAnytime: 'آپ ترتیبات سے کسی بھی وقت تبدیل کر سکتے ہیں۔',
  },
};

// ─── Iconography ─────────────────────────────────────────────────
// Original line icons — simple geometry only. No brand glyphs.
function Icon({ name, size = 22, stroke = 'currentColor', fill = 'none', sw = 1.7 }) {
  const p = { fill, stroke, strokeWidth: sw, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const paths = {
    mountain: <><path d="M3 19l5-9 4 6 3-4 6 7H3z" {...p}/><circle cx="17" cy="6" r="2" {...p}/></>,
    bell: <><path d="M6 16h12l-1.5-2v-4a4.5 4.5 0 0 0-9 0v4L6 16z" {...p}/><path d="M10 19a2 2 0 0 0 4 0" {...p}/></>,
    people: <><circle cx="9" cy="8" r="3" {...p}/><circle cx="17" cy="9" r="2.2" {...p}/><path d="M4 19c0-3 2-5 5-5s5 2 5 5" {...p}/><path d="M14 19c0-2 1.4-3.6 3-3.6S20 17 20 19" {...p}/></>,
    car: <><path d="M4 14h16l-2-5H6l-2 5z" {...p}/><path d="M4 14v3M20 14v3" {...p}/><circle cx="8" cy="16.5" r="1.6" {...p}/><circle cx="16" cy="16.5" r="1.6" {...p}/></>,
    spark: <><path d="M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6L12 4z" {...p}/><path d="M19 16l.6 1.4L21 18l-1.4.6L19 20l-.6-1.4L17 18l1.4-.6L19 16z" {...p}/></>,
    chat: <><path d="M4 6h16v10H9l-4 3v-3H4z" {...p}/></>,
    image: <><rect x="3.5" y="5" width="17" height="14" rx="2" {...p}/><circle cx="9" cy="10" r="1.6" {...p}/><path d="M5 17l4-4 3 3 3-4 4 5" {...p}/></>,
    cloud: <><path d="M7 16a3.5 3.5 0 0 1 .5-7 5 5 0 0 1 9.5 1 3 3 0 0 1 0 6H7z" {...p}/></>,
    settings: <><circle cx="12" cy="12" r="3" {...p}/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4.9a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.5a7 7 0 0 0-2 1.2L5 5.8 3 9.2l2 1.6a7 7 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-.9a7 7 0 0 0 2 1.2L10 21h4l.5-2.5a7 7 0 0 0 2-1.2l2.5.9 2-3.4-2-1.6c.07-.4.1-.8.1-1.2z" {...p}/></>,
    phone: <><path d="M5 4h6l1.5 4-2.5 1.5a11 11 0 0 0 4.5 4.5L16 11.5 20 13v6a2 2 0 0 1-2 2A14 14 0 0 1 4 7a3 3 0 0 1 1-3z" {...p}/></>,
    search: <><circle cx="11" cy="11" r="6" {...p}/><path d="M16 16l4 4" {...p}/></>,
    plus: <><path d="M12 5v14M5 12h14" {...p}/></>,
    arrow: <><path d="M5 12h14M14 6l6 6-6 6" {...p}/></>,
    back: <><path d="M19 12H5M10 6l-6 6 6 6" {...p}/></>,
    heart: <><path d="M12 19s-7-4-7-9.5A4 4 0 0 1 12 7a4 4 0 0 1 7 2.5C19 15 12 19 12 19z" {...p}/></>,
    send: <><path d="M4 12l16-7-7 16-2-7-7-2z" {...p}/></>,
    pin: <><path d="M12 21s-6-6.5-6-11a6 6 0 1 1 12 0c0 4.5-6 11-6 11z" {...p}/><circle cx="12" cy="10" r="2" {...p}/></>,
    sun: <><circle cx="12" cy="12" r="3.5" {...p}/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.5 5.5l1.4 1.4M17.1 17.1l1.4 1.4M5.5 18.5l1.4-1.4M17.1 6.9l1.4-1.4" {...p}/></>,
    moon: <><path d="M20 14a8 8 0 1 1-9-10 6 6 0 0 0 9 10z" {...p}/></>,
    home: <><path d="M4 11l8-7 8 7v9h-5v-6h-6v6H4z" {...p}/></>,
    flag: <><path d="M5 4v17M5 5h10l-2 3 2 3H5" {...p}/></>,
    file: <><path d="M7 3h7l4 4v14H7z" {...p}/><path d="M14 3v4h4" {...p}/></>,
    seat: <><path d="M6 18v-3a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v3" {...p}/><path d="M8 12V8a3 3 0 0 1 3-3h2a3 3 0 0 1 3 3v4" {...p}/></>,
    clock: <><circle cx="12" cy="12" r="8" {...p}/><path d="M12 7v5l3 2" {...p}/></>,
    locate: <><circle cx="12" cy="12" r="3" {...p}/><circle cx="12" cy="12" r="8" {...p}/><path d="M12 2v3M12 19v3M2 12h3M19 12h3" {...p}/></>,
    user: <><circle cx="12" cy="8.5" r="3.5" {...p}/><path d="M5 19c0-3.6 3.1-6 7-6s7 2.4 7 6" {...p}/></>,
    edit: <><path d="M5 19h4l9-9-4-4-9 9v4z" {...p}/><path d="M13.5 6.5l4 4" {...p}/></>,
    globe: <><circle cx="12" cy="12" r="8" {...p}/><path d="M4 12h16M12 4c2.5 2.5 2.5 13 0 16M12 4c-2.5 2.5-2.5 13 0 16" {...p}/></>,
    shield: <><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" {...p}/><path d="M9 12l2 2 4-4" {...p}/></>,
    chevron: <><path d="M9 6l6 6-6 6" {...p}/></>,
    logout: <><path d="M14 4h-7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7" {...p}/><path d="M16 8l4 4-4 4M9 12h11" {...p}/></>,
    camera: <><path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" {...p}/><circle cx="12" cy="13" r="3.2" {...p}/></>,
    close: <><path d="M6 6l12 12M18 6L6 18" {...p}/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block' }}>
      {paths[name] || paths.spark}
    </svg>
  );
}

// ─── Mountain motif ──────────────────────────────────────────────
// Abstract layered mountains — used on headers/hero areas only.
function MountainMotif({ height = 80, c1, c2, c3, opacity = 1 }) {
  return (
    <svg width="100%" height={height} viewBox="0 0 400 100" preserveAspectRatio="none"
         style={{ display: 'block', opacity }}>
      <path d="M0 100 L0 65 L60 28 L100 50 L150 20 L210 60 L260 35 L320 55 L400 30 L400 100 Z" fill={c1}/>
      <path d="M0 100 L0 75 L50 50 L110 70 L170 45 L240 75 L300 55 L360 70 L400 60 L400 100 Z" fill={c2} opacity="0.85"/>
      <path d="M0 100 L0 88 L80 78 L160 85 L240 75 L320 82 L400 78 L400 100 Z" fill={c3} opacity="0.9"/>
    </svg>
  );
}

// ─── Placeholder image tile ──────────────────────────────────────
function Placeholder({ label, w = '100%', h = 120, theme, tone = 'soft', round = 12 }) {
  const bg = tone === 'soft' ? theme.surfaceAlt : theme.primarySoft;
  const stripe = tone === 'soft' ? theme.border : theme.primary;
  return (
    <div style={{
      width: w, height: h, borderRadius: round,
      background: `repeating-linear-gradient(135deg, ${bg} 0 10px, ${stripe}33 10px 11px)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'JetBrains Mono, ui-monospace, monospace',
      fontSize: 10, color: theme.inkSoft, letterSpacing: 0.5,
      border: `1px solid ${theme.borderSoft}`,
      overflow: 'hidden',
    }}>{label}</div>
  );
}

// ─── Avatar (initials + soft tinted bg) ──────────────────────────
function Avatar({ name, size = 38, theme, tint = 'primary' }) {
  const initials = (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const palette = {
    primary: [theme.primarySoft, theme.primary],
    accent: [theme.accentSoft, theme.accent],
    info: [theme.borderSoft, theme.info],
    success: [theme.borderSoft, theme.success],
  }[tint] || [theme.primarySoft, theme.primary];
  return (
    <div style={{
      width: size, height: size, borderRadius: size,
      background: palette[0], color: palette[1],
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.36, fontWeight: 600, letterSpacing: 0.5,
      fontFamily: 'DM Sans, system-ui, sans-serif',
      flexShrink: 0,
    }}>{initials}</div>
  );
}

// ─── Bespa logo mark ─────────────────────────────────────────────
// Stylized mountain peaks inside a soft square — original mark.
function BespaLogo({ size = 36, theme }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.28,
      background: theme.primary, color: theme.accent,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: `0 6px 18px ${theme.primary}40`,
      flexShrink: 0,
    }}>
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24">
        <path d="M3 19l5-9 3.5 5L15 9l6 10H3z" fill="currentColor"/>
        <circle cx="17" cy="6.5" r="1.6" fill="currentColor"/>
      </svg>
    </div>
  );
}

// ─── Themed phone shell — replaces the M3 default frame ──────────
// Custom status bar + content + gesture nav, painted with the active
// theme so the chrome reads as part of the design rather than as a
// generic Android wrapper.
function Phone({ children, theme, statusDark, width = 360, height = 720, contentStyle = {} }) {
  const sbDark = statusDark ?? (theme.name === 'Twilight');
  const ic = sbDark ? '#ffffff' : theme.ink;
  return (
    <div style={{
      width, height, borderRadius: 36, overflow: 'hidden',
      background: theme.bg,
      border: `8px solid ${theme.ink}`,
      boxShadow: `0 24px 60px ${theme.ink}40, inset 0 0 0 1px ${theme.ink}20`,
      display: 'flex', flexDirection: 'column', position: 'relative',
      fontFamily: 'DM Sans, system-ui, sans-serif',
      color: theme.ink,
    }}>
      {/* Status bar */}
      <div style={{
        height: 30, padding: '0 18px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        fontFamily: 'DM Sans, system-ui, sans-serif',
        fontSize: 12, fontWeight: 600, color: ic, flexShrink: 0,
        position: 'relative', zIndex: 2,
      }}>
        <span>9:41</span>
        <div style={{
          position: 'absolute', left: '50%', top: 8, transform: 'translateX(-50%)',
          width: 16, height: 16, borderRadius: 8, background: theme.ink,
        }}/>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          <svg width="14" height="10" viewBox="0 0 14 10"><path d="M1 7l1-1 1 1v2H1V7zm3-2l1-1 1 1v4H4V5zm3-2l1-1 1 1v6H7V3zm3-2l1-1 1 1v8h-2V1z" fill={ic}/></svg>
          <svg width="14" height="10" viewBox="0 0 14 10"><path d="M0 2a10 10 0 0114 0l-2 2a7 7 0 00-10 0L0 2zm3 3a6 6 0 018 0l-2 2a3 3 0 00-4 0L3 5zm3 3a2 2 0 012 0l-1 1-1-1z" fill={ic}/></svg>
          <div style={{ width: 22, height: 10, border: `1.2px solid ${ic}`, borderRadius: 2, position: 'relative', padding: 1 }}>
            <div style={{ width: '75%', height: '100%', background: ic, borderRadius: 1 }}/>
            <div style={{ position: 'absolute', right: -3, top: 2, width: 2, height: 4, background: ic, borderRadius: 1 }}/>
          </div>
        </div>
      </div>
      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative', ...contentStyle }}>
        {children}
      </div>
      {/* Gesture nav */}
      <div style={{ height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <div style={{ width: 100, height: 4, borderRadius: 2, background: theme.ink, opacity: 0.5 }}/>
      </div>
    </div>
  );
}

// ─── Bottom tab bar (used on most main screens) ──────────────────
function TabBar({ active = 'home', theme, t, nav }) {
  const tabs = [
    { id: 'home', icon: 'home', label: t.appName, dest: 'home' },
    { id: 'community', icon: 'people', label: t.community, dest: 'community' },
    { id: 'assistant', icon: 'spark', label: t.assistant, dest: 'assistant' },
    { id: 'profile', icon: 'user', label: t.profile, dest: 'account' },
  ];
  return (
    <div style={{
      display: 'flex', borderTop: `1px solid ${theme.borderSoft}`,
      background: theme.surface,
      padding: '6px 4px 4px',
      flexShrink: 0,
    }}>
      {tabs.map(tab => {
        const on = tab.id === active;
        return (
          <div key={tab.id}
            onClick={nav ? () => nav.go(tab.dest) : undefined}
            style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            color: on ? theme.primary : theme.inkFaint, padding: '4px 0',
            cursor: nav ? 'pointer' : 'default',
          }}>
            <div style={{
              padding: '3px 14px', borderRadius: 14,
              background: on ? theme.primarySoft : 'transparent',
            }}>
              <Icon name={tab.icon} size={20}/>
            </div>
            <span style={{ fontSize: 10, fontWeight: on ? 600 : 500 }}>{tab.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Screen-level header (mountain motif optional) ───────────────
function Header({ title, subtitle, theme, t, onBack, action, motif = false, dir }) {
  return (
    <div style={{ position: 'relative', background: theme.surface, paddingBottom: motif ? 0 : 14 }}>
      {motif && (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 80, pointerEvents: 'none' }}>
          <MountainMotif height={80}
            c1={theme.primary + '12'}
            c2={theme.primary + '22'}
            c3={theme.primary + '38'}/>
        </div>
      )}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '14px 16px 8px', position: 'relative', zIndex: 1,
      }}>
        {onBack && (
          <div onClick={typeof onBack === 'function' ? onBack : undefined} style={{
            width: 34, height: 34, borderRadius: 17, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            background: theme.surfaceAlt, color: theme.ink,
            cursor: typeof onBack === 'function' ? 'pointer' : 'default',
          }}><Icon name="back" size={18}/></div>
        )}
        <div style={{ flex: 1, textAlign: dir === 'rtl' ? 'right' : 'left' }}>
          <div style={{
            fontFamily: 'Instrument Serif, Cormorant Garamond, serif',
            fontSize: 24, fontWeight: 400, letterSpacing: -0.3, lineHeight: 1.1,
            color: theme.ink,
          }}>{title}</div>
          {subtitle && (
            <div style={{ fontSize: 12, color: theme.inkSoft, marginTop: 2 }}>{subtitle}</div>
          )}
        </div>
        {action}
      </div>
    </div>
  );
}

Object.assign(window, {
  THEMES, COPY, Icon, MountainMotif, Placeholder, Avatar,
  BespaLogo, Phone, TabBar, Header,
});
