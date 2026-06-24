// Shared country list with ISO code (for flagcdn flags), international dial code
// and a display time zone. Used by the admin Brand Identity selector and the
// booking-page phone field.
export const COUNTRIES = [
  // ── Gulf / MENA (primary markets) ──
  { iso: 'qa', name: 'Qatar',                dial: '+974', tz: 'Asia/Qatar (GMT+3)' },
  { iso: 'ae', name: 'United Arab Emirates', dial: '+971', tz: 'Asia/Dubai (GMT+4)' },
  { iso: 'sa', name: 'Saudi Arabia',         dial: '+966', tz: 'Asia/Riyadh (GMT+3)' },
  { iso: 'kw', name: 'Kuwait',               dial: '+965', tz: 'Asia/Kuwait (GMT+3)' },
  { iso: 'bh', name: 'Bahrain',              dial: '+973', tz: 'Asia/Bahrain (GMT+3)' },
  { iso: 'om', name: 'Oman',                 dial: '+968', tz: 'Asia/Muscat (GMT+4)' },
  { iso: 'jo', name: 'Jordan',               dial: '+962', tz: 'Asia/Amman (GMT+3)' },
  { iso: 'lb', name: 'Lebanon',              dial: '+961', tz: 'Asia/Beirut (GMT+2)' },
  { iso: 'eg', name: 'Egypt',                dial: '+20',  tz: 'Africa/Cairo (GMT+2)' },
  { iso: 'iq', name: 'Iraq',                 dial: '+964', tz: 'Asia/Baghdad (GMT+3)' },
  { iso: 'ma', name: 'Morocco',              dial: '+212', tz: 'Africa/Casablanca (GMT+1)' },
  { iso: 'tn', name: 'Tunisia',              dial: '+216', tz: 'Africa/Tunis (GMT+1)' },
  { iso: 'dz', name: 'Algeria',              dial: '+213', tz: 'Africa/Algiers (GMT+1)' },
  { iso: 'tr', name: 'Türkiye',              dial: '+90',  tz: 'Europe/Istanbul (GMT+3)' },
  // ── South Asia ──
  { iso: 'in', name: 'India',                dial: '+91',  tz: 'Asia/Kolkata (GMT+5:30)' },
  { iso: 'pk', name: 'Pakistan',             dial: '+92',  tz: 'Asia/Karachi (GMT+5)' },
  { iso: 'bd', name: 'Bangladesh',           dial: '+880', tz: 'Asia/Dhaka (GMT+6)' },
  { iso: 'lk', name: 'Sri Lanka',            dial: '+94',  tz: 'Asia/Colombo (GMT+5:30)' },
  { iso: 'np', name: 'Nepal',                dial: '+977', tz: 'Asia/Kathmandu (GMT+5:45)' },
  // ── South-East / East Asia ──
  { iso: 'ph', name: 'Philippines',          dial: '+63',  tz: 'Asia/Manila (GMT+8)' },
  { iso: 'id', name: 'Indonesia',            dial: '+62',  tz: 'Asia/Jakarta (GMT+7)' },
  { iso: 'my', name: 'Malaysia',             dial: '+60',  tz: 'Asia/Kuala_Lumpur (GMT+8)' },
  { iso: 'th', name: 'Thailand',             dial: '+66',  tz: 'Asia/Bangkok (GMT+7)' },
  { iso: 'vn', name: 'Vietnam',              dial: '+84',  tz: 'Asia/Ho_Chi_Minh (GMT+7)' },
  { iso: 'sg', name: 'Singapore',            dial: '+65',  tz: 'Asia/Singapore (GMT+8)' },
  { iso: 'cn', name: 'China',                dial: '+86',  tz: 'Asia/Shanghai (GMT+8)' },
  // ── Africa ──
  { iso: 'ng', name: 'Nigeria',              dial: '+234', tz: 'Africa/Lagos (GMT+1)' },
  { iso: 'ke', name: 'Kenya',                dial: '+254', tz: 'Africa/Nairobi (GMT+3)' },
  { iso: 'gh', name: 'Ghana',                dial: '+233', tz: 'Africa/Accra (GMT+0)' },
  { iso: 'et', name: 'Ethiopia',             dial: '+251', tz: 'Africa/Addis_Ababa (GMT+3)' },
  { iso: 'ug', name: 'Uganda',               dial: '+256', tz: 'Africa/Kampala (GMT+3)' },
  { iso: 'tz', name: 'Tanzania',             dial: '+255', tz: 'Africa/Dar_es_Salaam (GMT+3)' },
  { iso: 'za', name: 'South Africa',         dial: '+27',  tz: 'Africa/Johannesburg (GMT+2)' },
  // ── Europe ──
  { iso: 'gb', name: 'United Kingdom',       dial: '+44',  tz: 'Europe/London (GMT+0)' },
  { iso: 'fr', name: 'France',               dial: '+33',  tz: 'Europe/Paris (GMT+1)' },
  { iso: 'de', name: 'Germany',              dial: '+49',  tz: 'Europe/Berlin (GMT+1)' },
  { iso: 'es', name: 'Spain',                dial: '+34',  tz: 'Europe/Madrid (GMT+1)' },
  { iso: 'it', name: 'Italy',                dial: '+39',  tz: 'Europe/Rome (GMT+1)' },
  { iso: 'nl', name: 'Netherlands',          dial: '+31',  tz: 'Europe/Amsterdam (GMT+1)' },
  { iso: 'ru', name: 'Russia',               dial: '+7',   tz: 'Europe/Moscow (GMT+3)' },
  // ── Americas / Oceania ──
  { iso: 'us', name: 'United States',        dial: '+1',   tz: 'America/New_York (GMT-5)' },
  { iso: 'ca', name: 'Canada',               dial: '+1',   tz: 'America/Toronto (GMT-5)' },
  { iso: 'au', name: 'Australia',            dial: '+61',  tz: 'Australia/Sydney (GMT+11)' },
];

// Default country used when the brand has not chosen one yet.
export const DEFAULT_COUNTRY = 'qa';

// ISO (e.g. 'qa') → dial code (e.g. '+974'). Falls back to Qatar.
export function dialCodeFor(iso) {
  const c = COUNTRIES.find(x => x.iso === (iso || '').toLowerCase());
  return c ? c.dial : '+974';
}

// ISO (e.g. 'qa') → display time zone (e.g. 'Asia/Qatar (GMT+3)'). Falls back to Qatar.
export function timezoneFor(iso) {
  const c = COUNTRIES.find(x => x.iso === (iso || '').toLowerCase());
  return c ? c.tz : 'Asia/Qatar (GMT+3)';
}
