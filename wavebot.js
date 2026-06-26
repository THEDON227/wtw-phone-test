(function () {
  'use strict';

  const CITY_OPTIONS = [
    { key: 'nyc', label: 'New York', market: 'NYC', aliases: ['new york', 'new york city', 'nyc'] },
    { key: 'nj', label: 'New Jersey', market: 'NJ', aliases: ['new jersey', 'nj'] },
    { key: 'miami', label: 'Miami', market: 'Miami', aliases: ['mia', 'miami'] },
    { key: 'la', label: 'Los Angeles', market: 'LA', aliases: ['los angeles', 'la'] },
    { key: 'dallas', label: 'Dallas', market: 'Dallas', aliases: ['dallas'] },
    { key: 'philadelphia', label: 'Philadelphia', market: 'Philadelphia', aliases: ['philadelphia', 'philly'] },
    { key: 'atlanta', label: 'Atlanta', market: 'Atlanta', aliases: ['atlanta', 'atl'] },
    { key: 'jersey city', label: 'Jersey City', market: 'NJ', aliases: ['jersey city'] },
    { key: 'hoboken', label: 'Hoboken', market: 'NJ', aliases: ['hoboken'] },
    { key: 'newark', label: 'Newark', market: 'NJ', aliases: ['newark'] },
    { key: 'asbury park', label: 'Asbury Park', market: 'NJ', aliases: ['asbury park'] },
    { key: 'edgewater', label: 'Edgewater', market: 'NJ', aliases: ['edgewater'] },
    { key: 'montclair', label: 'Montclair', market: 'NJ', aliases: ['montclair'] },
    { key: 'weehawken', label: 'Weehawken', market: 'NJ', aliases: ['weehawken'] }
  ];
  const CITY_LOOKUP = new Map();
  const CITY_MARKET_TO_KEY = {
    NYC: 'nyc', NJ: 'nj', Miami: 'miami', LA: 'la', Dallas: 'dallas', Philadelphia: 'philadelphia', Atlanta: 'atlanta'
  };
  const CITY_NAME_TO_KEY = new Map();
  CITY_OPTIONS.forEach((city) => {
    CITY_LOOKUP.set(city.key, city);
    CITY_NAME_TO_KEY.set(city.label.toLowerCase(), city.key);
    city.aliases.forEach((alias) => CITY_NAME_TO_KEY.set(alias.toLowerCase(), city.key));
  });

  const VIBE_KEYWORDS = {
    chill: ['chill', 'low-key', 'easy', 'relaxed', 'soft'],
    upscale: ['upscale', 'cocktail', 'luxury', 'premium', 'polished', 'refined', 'editorial'],
    'high-energy': ['high-energy', 'high energy', 'party', 'club', 'late', 'late-night', 'late night', 'turnt', 'momentum'],
    rooftop: ['rooftop', 'skyline', 'view', 'sunset', 'terrace'],
    'hip-hop': ['hip-hop', 'hip hop', 'rap', 'r&b'],
    afrobeats: ['afrobeats', 'amapiano', 'afro'],
    latin: ['latin', 'reggaeton', 'salsa', 'bachata'],
    house: ['house', 'deep house', 'dance', 'electronic'],
    'open format': ['open format', 'all genres', 'mixed'],
    'food-first': ['food-first', 'dinner', 'supper', 'restaurant', 'brunch'],
    'photo-friendly': ['photo-friendly', 'photo', 'content', 'instagram', 'visual']
  };
  const OCCASION_KEYWORDS = {
    birthday: ['birthday', 'bday'],
    'date night': ['date night', 'date'],
    brunch: ['brunch'],
    friends: ['friends', 'group', 'crew', 'girls night', 'guys night'],
    'business dinner': ['business dinner', 'client', 'work dinner', 'after work'],
    celebration: ['celebration', 'anniversary', 'engagement', 'proposal', 'launch'],
    'club night': ['club night', 'club', 'night out'],
    casual: ['casual', 'low-key', 'low key']
  };
  const FLOW_KEYWORDS = {
    'dinner only': ['dinner only', 'just dinner', 'eat only'],
    'dinner + lounge': ['dinner then lounge', 'dinner + lounge', 'dinner and lounge', 'food then drinks'],
    'brunch + day party': ['brunch + day party', 'brunch then day party', 'day party', 'brunch and day party'],
    'rooftop + late night': ['rooftop + late night', 'rooftop then late night', 'rooftop then club', 'rooftop then night'],
    'club/event only': ['club/event only', 'event only', 'club only', 'just club', 'just event'],
    'full night plan': ['full night plan', 'plan my night', 'full night', 'dinner then club', 'dinner, lounge, and club'],
    'low-key': ['low-key', 'low key', 'drinks only', 'quiet night']
  };
  const ACCESS_KEYWORDS = {
    reservation: ['reservation', 'book', 'table for dinner'],
    'guest list': ['guest list', 'guestlist', 'list'],
    tickets: ['ticket', 'tickets', 'admission'],
    'vip/table': ['vip', 'table', 'section', 'bottle'],
    'Wave Pass': ['wave pass', 'pass']
  };
  const CITY_ALIASES = Object.fromEntries(CITY_OPTIONS.flatMap((city) => city.aliases.map((alias) => [alias, city.key])));
  const STORAGE_KEYS = {
    lastPlan: 'wtw_wavebot_last_plan',
    selectedCity: 'wtw_wavebot_selected_city',
    selectedVibe: 'wtw_wavebot_selected_vibe'
  };
  const FALLBACK_NOTE = 'WaveBot is using the current WTW fallback inventory while live inventory loads.';
  const POLICY_NOTE = 'Requests remain subject to availability and venue/partner confirmation.';

  const state = {
    inventory: { events: [], venues: [] },
    usingFallback: true,
    currentCity: 'nyc',
    currentVibe: 'chill',
    lastBuild: null,
    loaded: false,
    lastSourceNote: FALLBACK_NOTE
  };

  const els = {};

  function $(id) { return document.getElementById(id); }
  function text(v) { return String(v == null ? '' : v).trim(); }
  function lower(v) { return text(v).toLowerCase(); }
  function slugify(v) { return lower(v).replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  function truthy(v) { return v === true || v === 'true' || v === 1 || v === '1' || lower(v) === 'yes'; }
  function toNum(v, fallback = 0) { const n = Number(v); return Number.isFinite(n) ? n : fallback; }
  function addDays(date, days) { const d = new Date(date.getTime()); d.setDate(d.getDate() + days); return d; }
  function dayStart(date) { const d = new Date(date); d.setHours(0, 0, 0, 0); return d; }
  function formatDateISO(date) { return date.toISOString().slice(0, 10); }
  function formatDateLabel(value) { if (!value) return 'TBD'; const d = new Date(`${value}T00:00:00`); if (Number.isNaN(d.getTime())) return text(value); return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); }
  function formatTimeLabel(value) { const raw = text(value); if (!raw) return 'TBD'; if (/^open$/i.test(raw)) return 'Open'; const match = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i); if (!match) return raw; let hour = parseInt(match[1], 10); const minute = match[2]; const period = match[4] ? match[4].toUpperCase() : ''; if (period) { if (hour > 12) hour -= 12; if (hour === 0) hour = 12; return `${hour}:${minute} ${period}`; } if (hour === 0) return `12:${minute} AM`; if (hour === 12) return `12:${minute} PM`; if (hour > 12) return `${hour - 12}:${minute} PM`; return `${hour}:${minute} AM`; }
  function cityLabel(key) { return (CITY_LOOKUP.get(key) || {}).label || 'New York'; }
  function marketForCity(key) { return (CITY_LOOKUP.get(key) || {}).market || 'NYC'; }
  function normalizeCityInput(value) { const raw = lower(value); if (!raw) return 'nyc'; if (CITY_LOOKUP.has(raw)) return raw; if (CITY_NAME_TO_KEY.has(raw)) return CITY_NAME_TO_KEY.get(raw); if (CITY_ALIASES[raw]) return CITY_ALIASES[raw]; return 'nyc'; }
  function resolveCityFromInput(value) { return normalizeCityInput(value); }
  function resolveMarket(value) { const raw = lower(value); const market = CITY_OPTIONS.find((city) => lower(city.market) === raw || lower(city.label) === raw || city.aliases.includes(raw)); return market ? market.market : null; }
  function priceTierScore(value) { const raw = text(value).replace(/[^$]/g, ''); if (!raw) return 1; return raw.length; }
  function numericSpendTier(value) { if (value === 'vip') return 4; if (value === 'premium') return 3; if (value === 'moderate') return 2; return 1; }
  function vibeToKeywords(vibe) { return VIBE_KEYWORDS[vibe] || []; }
  function describeBudget(tier) { if (tier >= 4) return 'VIP spend'; if (tier === 3) return 'premium spend'; if (tier === 2) return 'moderate spend'; return 'flexible spend'; }
  function estimateSpendFromEvent(event, budget) { const price = toNum(event.ticket_price, 0); const base = price > 0 ? `$${price}+ ticket` : 'request pricing'; if (budget >= 4) return `${base} · VIP/table potential`; if (budget === 3) return `${base} · premium night`; if (budget === 2) return `${base} · moderate spend`; return `${base} · flexible`;
  }
  function estimateSpendFromVenue(venue, budget) { const tier = priceTierScore(venue.price_tier || '$'); if (budget >= 4 || tier >= 4) return `${venue.price_tier || '$$$$'} · VIP/table potential`; if (budget === 3 || tier === 3) return `${venue.price_tier || '$$$'} · premium spend`; if (budget === 2 || tier === 2) return `${venue.price_tier || '$$'} · moderate spend`; return `${venue.price_tier || '$'} · flexible`; }
  function normalizeDateInput(value) { const raw = text(value); if (!raw) return null; const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/); if (!match) return null; return raw; }
  function detectTiming(textValue) { const q = lower(textValue); if (q.includes('tomorrow')) return 'tomorrow'; if (q.includes('weekend')) return 'weekend'; if (q.includes('tonight') || q.includes('today')) return 'tonight'; const custom = q.match(/\b(\d{4}-\d{2}-\d{2})\b/); if (custom) return custom[1]; return null; }
  function detectOccasion(textValue) { const q = lower(textValue); for (const [key, list] of Object.entries(OCCASION_KEYWORDS)) { if (list.some((phrase) => q.includes(phrase))) return key; } return null; }
  function detectFlow(textValue) { const q = lower(textValue); for (const [key, list] of Object.entries(FLOW_KEYWORDS)) { if (list.some((phrase) => q.includes(phrase))) return key; } return null; }
  function detectAccessNeed(textValue) { const q = lower(textValue); for (const [key, list] of Object.entries(ACCESS_KEYWORDS)) { if (list.some((phrase) => q.includes(phrase))) return key; } return 'just exploring'; }
  function detectVibe(textValue) { const q = lower(textValue); for (const [key, list] of Object.entries(VIBE_KEYWORDS)) { if (list.some((phrase) => q.includes(phrase))) return key; } if (q.includes('birthday')) return 'high-energy'; if (q.includes('date')) return 'upscale'; if (q.includes('brunch')) return 'food-first'; return 'chill'; }
  function detectGroupSize(textValue, fallback = 2) { const q = lower(textValue); const match = q.match(/group(?:\s+of)?\s+(\d+)/) || q.match(/for\s+(\d+)/) || q.match(/\b(\d+)\s*(?:people|guests|friends|ppl)\b/); return match ? Math.max(1, Math.min(30, parseInt(match[1], 10))) : fallback; }
  function detectBudget(textValue) { const q = lower(textValue); if (q.includes('vip') || q.includes('table') || q.includes('section')) return 'vip'; if (q.includes('premium') || q.includes('upscale')) return 'premium'; if (q.includes('moderate')) return 'moderate'; if (q.includes('flexible')) return 'flexible'; return null; }
  function detectMarketKey(textValue) { const q = lower(textValue); const cleaned = q.replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim(); if (CITY_NAME_TO_KEY.has(cleaned)) return CITY_NAME_TO_KEY.get(cleaned); for (const city of CITY_OPTIONS) { if (cleaned.includes(city.label.toLowerCase())) return city.key; if (city.aliases.some((alias) => cleaned.includes(alias))) return city.key; } return null; }
  function policyQuestion(textValue) { const q = lower(textValue); return /guaranteed|what should i wear|how does wtw work|can wtw help me|get me access|wave pass/.test(q); }
  function getQuestionMode(textValue) { const q = lower(textValue); if (policyQuestion(q)) return 'policy'; if (/brunch/.test(q)) return 'brunch'; if (/birthday/.test(q)) return 'birthday'; if (/date/.test(q)) return 'date'; if (/club/.test(q) || /guest list|tickets|vip|table/.test(q)) return 'club'; if (/low[- ]key|quiet/.test(q)) return 'low-key'; if (/dinner.*lounge|lounge.*dinner|dinner then lounge|eat before going out/.test(q)) return 'dinner-night'; return 'general'; }
  function cityMarketRows(items, cityKey) { const market = marketForCity(cityKey); if (!market) return items.slice(); const matched = items.filter((item) => lower(item.market) === lower(market)); return matched.length ? matched : items.slice(); }
  function normalizeEventRow(row) { const sourceMarket = row.market || row.source_market || row.source_city || ''; const market = resolveMarket(sourceMarket) || resolveMarket(row.city) || 'NYC'; const marketKey = CITY_MARKET_TO_KEY[market] || 'nyc'; const title = text(row.title) || 'Untitled Event'; const venueName = text(row.venue_name || row.venue) || 'Venue'; const eventDate = normalizeDateInput(row.event_date) || normalizeDateInput(row.date) || normalizeDateInput(row.start_date) || text(row.event_date) || text(row.date) || text(row.start_date) || null; const startTime = text(row.start_time || row.startTime) || null; const endTime = text(row.end_time || row.endTime) || null; return {
      id: text(row.id) || slugify([marketKey, title, venueName, eventDate].join('-')),
      title,
      venue_name: venueName,
      market,
      marketKey,
      category: text(row.category) || 'Nightlife',
      event_date: eventDate,
      start_time: startTime,
      end_time: endTime,
      address: text(row.address) || '',
      image_url: text(row.image_url) || 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200&q=80&auto=format&fit=crop',
      description: text(row.description) || `${title} in ${cityLabel(marketKey)}.`,
      music: text(row.music) || '',
      dress_code: text(row.dress_code || row.dresscode) || 'Smart Casual',
      age_requirement: text(row.age_requirement || row.age) || '21+',
      ticket_price: toNum(row.ticket_price ?? row.price ?? 0, 0),
      guest_list_available: truthy(row.guest_list_available || row.guestListAvailable),
      vip_table_available: truthy(row.vip_table_available || row.vipTableAvailable),
      status: text(row.status) || 'available',
      created_at: text(row.created_at || row.createdAt) || ''
    };
  }
  function normalizeVenueRow(row) { const sourceMarket = row.market || row.source_city || row.city || ''; const market = resolveMarket(sourceMarket) || resolveMarket(row.market_name) || 'NYC'; const marketKey = CITY_MARKET_TO_KEY[market] || 'nyc'; const name = text(row.name) || 'Venue'; const category = text(row.type || row.category) || 'Dinner'; return {
      id: text(row.id) || slugify([marketKey, name].join('-')),
      name,
      market,
      marketKey,
      type: category,
      neighborhood: text(row.neighborhood || row.area || row.market || row.city) || cityLabel(marketKey),
      address: text(row.address) || '',
      image_url: text(row.image_url || row.image) || 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200&q=80&auto=format&fit=crop',
      price_tier: text(row.price_tier || row.priceTier) || '$$$',
      atmosphere: text(row.atmosphere || row.vibe) || 'WTW curated',
      best_for: text(row.best_for || row.bestFor) || 'Reservation Request',
      dress_code: text(row.dress_code || row.dressCode) || 'Smart Casual',
      reservation_available: truthy(row.reservation_available || row.reservationAvailable),
      table_available: truthy(row.table_available || row.tableAvailable),
      guest_list_available: truthy(row.guest_list_available || row.guestListAvailable),
      description: text(row.description) || `${name} in ${cityLabel(marketKey)}.`,
      status: text(row.status) || 'available',
      created_at: text(row.created_at || row.createdAt) || ''
    };
  }
  function normalizeInventory(payload) {
    const events = Array.isArray(payload && payload.events) ? payload.events.map(normalizeEventRow) : [];
    const venues = Array.isArray(payload && payload.venues) ? payload.venues.map(normalizeVenueRow) : [];
    return { events, venues };
  }
  function matchesKeywords(textValue, keywords) {
    const q = lower(textValue);
    return keywords.some((keyword) => q.includes(keyword));
  }
  function eventKeywords(event) {
    return [event.title, event.venue_name, event.category, event.music, event.description, event.dress_code, event.status].join(' ').toLowerCase();
  }
  function venueKeywords(venue) {
    return [venue.name, venue.type, venue.atmosphere, venue.best_for, venue.description, venue.dress_code].join(' ').toLowerCase();
  }
  function scoreEvent(event, ctx) {
    let score = 0;
    const hay = eventKeywords(event);
    if (ctx.cityMarket && lower(event.market) === lower(ctx.cityMarket)) score += 45;
    else if (ctx.cityKey === 'philadelphia') score += 6;
    if (ctx.vibe && matchesKeywords(hay, vibeToKeywords(ctx.vibe))) score += 20;
    if (ctx.occasion === 'birthday' && (event.vip_table_available || event.guest_list_available || /premium|lounge|rooftop|late/.test(hay))) score += 18;
    if (ctx.occasion === 'date night' && /premium|lounge|supper|salon|social|rooftop/.test(hay)) score += 18;
    if (ctx.occasion === 'brunch' && /brunch|day|rooftop/.test(hay)) score += 18;
    if (ctx.flow === 'club/event only' && /club|late|night|weekend|dj|dance|after dark|latenight/.test(hay)) score += 18;
    if (ctx.flow === 'dinner + lounge' && /dinner|lounge|supper|salon|social|cocktail/.test(hay)) score += 15;
    if (ctx.flow === 'rooftop + late night' && /rooftop|terrace|skyline|late|night/.test(hay)) score += 16;
    if (ctx.accessNeed === 'guest list' && event.guest_list_available) score += 14;
    if (ctx.accessNeed === 'VIP/table' && event.vip_table_available) score += 14;
    if (ctx.accessNeed === 'Wave Pass') score += 6;
    if (ctx.budget >= 4 && event.ticket_price >= 45) score += 10;
    if (ctx.budget === 3 && event.ticket_price >= 25 && event.ticket_price <= 70) score += 8;
    if (ctx.budget === 2 && event.ticket_price <= 50) score += 8;
    if (ctx.budget === 1 && event.ticket_price <= 35) score += 8;
    if (/high-interest|guestlist|available/.test(lower(event.status))) score += 5;
    if (ctx.timing === 'weekend' && /fri|sat|sun/.test(lower(formatDateLabel(event.event_date)))) score += 12;
    if (ctx.timing === 'tonight' || ctx.timing === 'tomorrow') score += /available|high-interest/.test(lower(event.status)) ? 6 : 0;
    return score;
  }
  function scoreVenue(venue, ctx) {
    let score = 0;
    const hay = venueKeywords(venue);
    if (ctx.cityMarket && lower(venue.market) === lower(ctx.cityMarket)) score += 45;
    else if (ctx.cityKey === 'philadelphia') score += 6;
    if (ctx.vibe && matchesKeywords(hay, vibeToKeywords(ctx.vibe))) score += 20;
    if (ctx.occasion === 'birthday' && /birthday|celebration|party|section|table|vip/.test(hay)) score += 18;
    if (ctx.occasion === 'date night' && /date|quiet|luxury|cocktail|supper|salon|romantic|photo/.test(hay)) score += 18;
    if (ctx.occasion === 'brunch' && /brunch|day|garden|patio/.test(hay)) score += 18;
    if (ctx.flow === 'dinner only' && /dinner|supper|restaurant|table/.test(hay)) score += 18;
    if (ctx.flow === 'dinner + lounge' && /lounge|cocktail|supper|social|dinner/.test(hay)) score += 18;
    if (ctx.flow === 'brunch + day party' && /brunch|day|party|rooftop/.test(hay)) score += 18;
    if (ctx.flow === 'rooftop + late night' && /rooftop|terrace|skyline|night/.test(hay)) score += 18;
    if (ctx.flow === 'low-key' && /quiet|cocktail|social|lounge|intimate/.test(hay)) score += 18;
    if (ctx.accessNeed === 'reservation' && venue.reservation_available) score += 14;
    if (ctx.accessNeed === 'guest list' && venue.guest_list_available) score += 12;
    if (ctx.accessNeed === 'VIP/table' && venue.table_available) score += 14;
    if (ctx.accessNeed === 'Wave Pass') score += 6;
    const tier = priceTierScore(venue.price_tier);
    if (ctx.budget >= 4 && tier >= 4) score += 10;
    if (ctx.budget === 3 && tier >= 3) score += 9;
    if (ctx.budget === 2 && tier <= 3) score += 8;
    if (ctx.budget === 1 && tier <= 2) score += 10;
    if (/high-interest|available/.test(lower(venue.status))) score += 5;
    return score;
  }
  function cityEventPool(ctx) {
    const market = ctx.cityMarket;
    const events = state.inventory.events.slice();
    if (!market) return events;
    const matched = events.filter((event) => lower(event.market) === lower(market));
    return matched.length ? matched : events;
  }
  function cityVenuePool(ctx) {
    const market = ctx.cityMarket;
    const venues = state.inventory.venues.slice();
    if (!market) return venues;
    const matched = venues.filter((venue) => lower(venue.market) === lower(market));
    return matched.length ? matched : venues;
  }
  function currentDateRange(timing, customDate) {
    const now = dayStart(new Date());
    if (timing === 'tomorrow') {
      const d = addDays(now, 1); return [formatDateISO(d), formatDateISO(d)];
    }
    if (timing === 'weekend') {
      const day = now.getDay();
      const fridayOffset = (5 - day + 7) % 7;
      const friday = addDays(now, fridayOffset);
      const sunday = addDays(friday, 2);
      return [formatDateISO(friday), formatDateISO(sunday)];
    }
    if (timing === 'tonight') {
      return [formatDateISO(now), formatDateISO(now)];
    }
    if (customDate) {
      return [customDate, customDate];
    }
    return [null, null];
  }
  function dateInRange(dateValue, range) {
    const raw = text(dateValue);
    if (!raw || !range || !range[0]) return false;
    return raw >= range[0] && raw <= range[1];
  }
  function pickExactEvents(ctx) {
    const pool = cityEventPool(ctx);
    const range = currentDateRange(ctx.timing, ctx.customDate);
    const exact = pool.filter((event) => dateInRange(event.event_date, range));
    if (exact.length) return { events: exact, exact: true };
    return { events: pool, exact: false };
  }
  function rankEvents(ctx) {
    const picked = pickExactEvents(ctx);
    const ranked = picked.events.slice().sort((a, b) => scoreEvent(b, ctx) - scoreEvent(a, ctx));
    return { items: ranked, exact: picked.exact };
  }
  function rankVenues(ctx) {
    const ranked = cityVenuePool(ctx).slice().sort((a, b) => scoreVenue(b, ctx) - scoreVenue(a, ctx));
    return ranked;
  }
  function eventRoute(event, cityKey) {
    const eventId = slugify([cityKey, event.title, event.venue_name, event.event_date].join('-'));
    return `event-detail.html?city=${encodeURIComponent(cityKey)}&event=${encodeURIComponent(eventId)}`;
  }
  function venueRoute(venue, cityKey) {
    return `indulge-detail.html?city=${encodeURIComponent(cityKey)}&venue=${encodeURIComponent(venue.name)}`;
  }
  function planStorage(plan, ctx) {
    try {
      sessionStorage.setItem(STORAGE_KEYS.lastPlan, JSON.stringify({
        city: ctx.cityKey,
        cityLabel: cityLabel(ctx.cityKey),
        vibe: ctx.vibe,
        occasion: ctx.occasion,
        flow: ctx.flow,
        accessNeed: ctx.accessNeed,
        groupSize: ctx.groupSize,
        budget: ctx.budget,
        timing: ctx.timing,
        customDate: ctx.customDate,
        plan
      }));
      sessionStorage.setItem(STORAGE_KEYS.selectedCity, ctx.cityKey);
      sessionStorage.setItem(STORAGE_KEYS.selectedVibe, ctx.vibe);
    } catch (error) {
      console.warn('WTW WaveBot could not store the last plan:', error);
    }
  }
  function renderCityModal() {
    const mount = els.cityList;
    if (!mount) return;
    mount.innerHTML = CITY_OPTIONS.map((city) => `
      <div class="city-option ${city.key === state.currentCity ? 'selected' : ''}" data-city="${city.key}">
        <div class="co-dot" style="background:${pickAccent(city.key)};box-shadow:0 0 8px ${pickAccent(city.key)}88"></div>
        <div>
          <div class="co-name" style="${city.key === state.currentCity ? `color:${pickAccent(city.key)}` : ''}">${city.label}</div>
          <div class="co-mood">${city.market} · WTW market</div>
        </div>
        ${city.key === state.currentCity ? `<span class="co-check" style="color:${pickAccent(city.key)}">&#10003;</span>` : ''}
      </div>
    `).join('');
    mount.querySelectorAll('.city-option').forEach((el) => {
      el.addEventListener('click', () => {
        setCity(el.dataset.city || 'nyc', { rebuild: true });
        closeCityModal();
      });
    });
  }
  function pickAccent(cityKey) {
    const accent = {
      nyc: '#00C2D1', nj: '#0EA5E9', miami: '#E91E8C', la: '#8B6FE8', dallas: '#D6A94A', philadelphia: '#8C6AEE', atlanta: '#E84545', 'jersey city': '#0EA5E9', hoboken: '#0EA5E9', newark: '#0EA5E9', 'asbury park': '#0EA5E9', edgewater: '#0EA5E9', montclair: '#0EA5E9', weehawken: '#0EA5E9'
    };
    return accent[cityKey] || '#00C2D1';
  }
  function openCityModal() { const modal = els.cityModal; if (modal) modal.classList.add('open'); }
  function closeCityModal() { const modal = els.cityModal; if (modal) modal.classList.remove('open'); }
  function setCity(key, opts = {}) {
    const normalized = resolveCityFromInput(key);
    state.currentCity = normalized;
    const formCity = els.wavebotCity;
    if (formCity) formCity.value = normalized;
    try { localStorage.setItem(STORAGE_KEYS.selectedCity, normalized); } catch (error) { /* noop */ }
    updateHeaderCity();
    renderCityModal();
    if (opts.rebuild && state.lastBuild) runPlanner();
  }
  function updateHeaderCity() {
    const spec = CITY_LOOKUP.get(state.currentCity) || CITY_LOOKUP.get('nyc');
    if (els.headerCity) els.headerCity.textContent = spec.label;
    if (els.headerDot) els.headerDot.style.background = pickAccent(state.currentCity);
  }
  function setStatus(textValue, isError = false) {
    if (!els.inventoryStatus) return;
    els.inventoryStatus.style.borderColor = isError ? 'rgba(239,68,68,.45)' : 'rgba(0,194,209,.22)';
    els.inventoryStatus.style.background = isError ? 'rgba(239,68,68,.08)' : 'rgba(0,194,209,.08)';
    els.inventoryStatus.textContent = textValue;
  }
  function showEmptyState(show) {
    if (!els.wavebotEmpty) return;
    els.wavebotEmpty.classList.toggle('hide', !show);
  }
  function buildPolicyCard(ctx) {
    return {
      kind: 'policy',
      title: 'WTW guidance',
      why: 'WTW curates and routes access. Final entry, table, or reservation is always subject to venue or partner confirmation.',
      suggestedStart: 'Use the plan as a review-ready route, not a guarantee.',
      nextMove: 'Ask WTW to route the request and keep the backup option ready.',
      lateNight: 'Wave Pass supports priority review, not guaranteed access.',
      vibeSpend: 'curated · request based · subject to confirmation',
      image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1400&q=80&auto=format&fit=crop',
      tags: ['WTW Policy', 'No Guarantees', 'Priority Review'],
      primary: { label: 'Join Wave Pass', href: 'pass.html' },
      secondary: { label: 'Browse Events', href: `events.html?city=${encodeURIComponent(ctx.cityKey)}` },
      tertiary: { label: 'Browse Indulge', href: `indulge.html?city=${encodeURIComponent(ctx.cityKey)}` }
    };
  }
  function makePlan(kind, primaryItem, secondaryItem, ctx, overrides = {}) {
    const cityName = cityLabel(ctx.cityKey);
    const budgetText = describeBudget(ctx.budget);
    const common = {
      title: primaryItem ? (primaryItem.title || primaryItem.name) : 'WTW Curated Option',
      why: '',
      suggestedStart: '',
      nextMove: '',
      lateNight: '',
      vibeSpend: budgetText,
      image: primaryItem ? (primaryItem.image_url || primaryItem.image) : 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=1400&q=80&auto=format&fit=crop',
      tags: [],
      primary: { label: 'Request Access', href: 'pass.html' },
      secondary: { label: 'Explore More', href: `events.html?city=${encodeURIComponent(ctx.cityKey)}` },
      tertiary: { label: 'Join Wave Pass', href: 'pass.html' }
    };
    const plan = Object.assign(common, overrides);
    if (kind === 'event' && primaryItem) {
      plan.why = primaryItem.description || `This is a strong ${ctx.occasion || 'night out'} fit in ${cityName}.`;
      plan.suggestedStart = `Suggested start: ${formatDateLabel(primaryItem.event_date)} · ${formatTimeLabel(primaryItem.start_time)}`;
      plan.nextMove = primaryItem.guest_list_available || primaryItem.vip_table_available ? 'Use the event detail page to review access options and route the request.' : 'Use the event detail page to review the plan and route the request.';
      plan.lateNight = secondaryItem ? `Late-night backup: ${secondaryItem.title || secondaryItem.name}` : 'Late-night backup: explore more WTW nightlife in the city.';
      plan.tags = [primaryItem.category, primaryItem.venue_name, primaryItem.guest_list_available ? 'Guest List' : '']
        .filter(Boolean)
        .slice(0, 3);
      plan.vibeSpend = `${primaryItem.category || 'nightlife'} · ${estimateSpendFromEvent(primaryItem, ctx.budget)}`;
      plan.primary = { label: 'View Event', href: eventRoute(primaryItem, ctx.cityKey) };
      plan.secondary = { label: 'Request Access', href: eventRoute(primaryItem, ctx.cityKey) };
      plan.tertiary = { label: 'Join Wave Pass', href: 'pass.html' };
      plan.relatedHref = secondaryItem && secondaryItem.title ? eventRoute(secondaryItem, ctx.cityKey) : `events.html?city=${encodeURIComponent(ctx.cityKey)}`;
    } else if (kind === 'venue' && primaryItem) {
      plan.why = primaryItem.description || `A strong ${ctx.occasion || 'night out'} venue fit for ${cityName}.`;
      plan.suggestedStart = `Suggested start: ${primaryItem.neighborhood || cityName} · ${primaryItem.best_for || 'reservation-first'}`;
      plan.nextMove = primaryItem.table_available || primaryItem.guest_list_available ? 'Use the venue detail page to route the request and keep the night flexible.' : 'Use the venue detail page to review dinner-first options.';
      plan.lateNight = secondaryItem ? `Late-night backup: ${secondaryItem.title || secondaryItem.name}` : 'Late-night backup: check related WTW events.';
      plan.tags = [primaryItem.type, primaryItem.best_for, primaryItem.table_available ? 'Table Potential' : '']
        .filter(Boolean)
        .slice(0, 3);
      plan.vibeSpend = `${primaryItem.type || 'venue'} · ${estimateSpendFromVenue(primaryItem, ctx.budget)}`;
      plan.primary = { label: 'View Venue', href: venueRoute(primaryItem, ctx.cityKey) };
      plan.secondary = { label: 'Request Reservation', href: venueRoute(primaryItem, ctx.cityKey) };
      plan.tertiary = { label: 'Join Wave Pass', href: 'pass.html' };
      plan.relatedHref = secondaryItem && secondaryItem.name ? venueRoute(secondaryItem, ctx.cityKey) : `indulge.html?city=${encodeURIComponent(ctx.cityKey)}`;
    } else if (kind === 'combo' && primaryItem && secondaryItem) {
      plan.title = `${primaryItem.name || primaryItem.title} + ${secondaryItem.title || secondaryItem.name}`;
      plan.why = `This route pairs a ${primaryItem.best_for || primaryItem.category || 'venue'} start with a stronger ${secondaryItem.category || 'event'} finish.`;
      plan.suggestedStart = `Start with ${primaryItem.name || primaryItem.title} around ${primaryItem.best_for || 'early evening'}.`;
      plan.nextMove = `Move to ${secondaryItem.title || secondaryItem.name} when the room wants more energy.`;
      plan.lateNight = `Keep ${cityName} moving with a WTW access request if the night needs a late lane.`;
      plan.tags = [primaryItem.best_for || primaryItem.type, secondaryItem.category || secondaryItem.status, 'Dinner-to-night']
        .filter(Boolean)
        .slice(0, 3);
      plan.vibeSpend = `${describeBudget(ctx.budget)} · ${estimateSpendFromVenue(primaryItem, ctx.budget)} + ${estimateSpendFromEvent(secondaryItem, ctx.budget)}`;
      plan.primary = { label: 'View Venue', href: venueRoute(primaryItem, ctx.cityKey) };
      plan.secondary = { label: 'View Event', href: eventRoute(secondaryItem, ctx.cityKey) };
      plan.tertiary = { label: 'Request Access', href: eventRoute(secondaryItem, ctx.cityKey) };
      plan.relatedHref = eventRoute(secondaryItem, ctx.cityKey);
    }
    return plan;
  }
  function buildPlanBundle(ctx) {
    const eventRank = rankEvents(ctx);
    const venueRank = rankVenues(ctx);
    const hasExactCityEvents = state.inventory.events.some((event) => lower(event.market) === lower(ctx.cityMarket));
    const hasExactCityVenues = state.inventory.venues.some((venue) => lower(venue.market) === lower(ctx.cityMarket));
    const hasExactCityData = hasExactCityEvents || hasExactCityVenues;
    const events = eventRank.items;
    const venues = venueRank;
    const primaryEvent = events[0] || null;
    const secondaryEvent = events[1] || null;
    const primaryVenue = venues[0] || null;
    const secondaryVenue = venues[1] || null;
    const mode = ctx.mode;
    const plans = [];

    if (mode === 'policy') {
      plans.push(buildPolicyCard(ctx));
      if (primaryVenue) plans.push(makePlan('venue', primaryVenue, secondaryEvent || primaryEvent, ctx));
      if (primaryEvent) plans.push(makePlan('event', primaryEvent, secondaryVenue || primaryVenue, ctx));
      const note = hasExactCityData ? 'WTW policy guidance is shown first because the question asks about access or safety.' : `No exact ${cityLabel(ctx.cityKey)} rows yet; showing the strongest WTW inventory.`;
      return { plans: plans.slice(0, 3), note };
    }

    if (mode === 'brunch') {
      if (primaryVenue) plans.push(makePlan('venue', primaryVenue, primaryEvent || secondaryEvent, ctx, { title: primaryVenue.name }));
      if (primaryEvent) plans.push(makePlan('event', primaryEvent, primaryVenue || secondaryVenue, ctx, { title: primaryEvent.title }));
      if (secondaryVenue) plans.push(makePlan('combo', primaryVenue, secondaryEvent || primaryEvent, ctx, { title: `${primaryVenue.name} → ${secondaryEvent ? (secondaryEvent.title || secondaryEvent.name) : 'Late option'}` }));
      const note = !hasExactCityData ? `No exact ${cityLabel(ctx.cityKey)} rows yet; showing the strongest WTW inventory.` : (ctx.exactDateMatch ? 'Current inventory has a date fit for this brunch request.' : 'No exact brunch date match yet; showing the strongest city options.');
      return { plans: plans.slice(0, 3), note };
    }

    if (mode === 'birthday') {
      if (primaryVenue) plans.push(makePlan('venue', primaryVenue, primaryEvent || secondaryEvent, ctx, { title: `${primaryVenue.name} for the birthday start` }));
      if (primaryEvent) plans.push(makePlan('event', primaryEvent, primaryVenue || secondaryVenue, ctx, { title: primaryEvent.title }));
      if (primaryVenue && secondaryEvent) plans.push(makePlan('combo', primaryVenue, secondaryEvent, ctx, { title: `${primaryVenue.name} + ${secondaryEvent.title}` }));
      const note = !hasExactCityData ? `No exact ${cityLabel(ctx.cityKey)} rows yet; showing the strongest WTW inventory.` : (ctx.groupSize >= 6 ? 'Large-group birthday routing favored table or guest list potential.' : 'Birthday routing prioritized venues with stronger celebration fit.');
      return { plans: plans.slice(0, 3), note };
    }

    if (mode === 'date') {
      if (primaryVenue) plans.push(makePlan('venue', primaryVenue, primaryEvent || secondaryEvent, ctx, { title: primaryVenue.name }));
      if (primaryEvent) plans.push(makePlan('event', primaryEvent, primaryVenue || secondaryVenue, ctx, { title: primaryEvent.title }));
      if (secondaryVenue) plans.push(makePlan('combo', primaryVenue, primaryEvent || secondaryEvent, ctx, { title: `${primaryVenue.name} → ${primaryEvent ? primaryEvent.title : 'late option'}` }));
      const note = !hasExactCityData ? `No exact ${cityLabel(ctx.cityKey)} rows yet; showing the strongest WTW inventory.` : 'Date-night routing favors upscale, photo-friendly, or lower-friction rooms.';
      return { plans: plans.slice(0, 3), note };
    }

    if (mode === 'club') {
      if (primaryEvent) plans.push(makePlan('event', primaryEvent, primaryVenue || secondaryVenue, ctx, { title: primaryEvent.title }));
      if (primaryVenue) plans.push(makePlan('venue', primaryVenue, primaryEvent || secondaryEvent, ctx, { title: primaryVenue.name }));
      if (secondaryEvent) plans.push(makePlan('combo', primaryVenue || secondaryVenue, secondaryEvent, ctx, { title: `${primaryEvent ? primaryEvent.title : 'Event'} + ${primaryVenue ? primaryVenue.name : 'Venue'}` }));
      const note = !hasExactCityData ? `No exact ${cityLabel(ctx.cityKey)} rows yet; showing the strongest WTW inventory.` : (ctx.accessNeed !== 'just exploring' ? 'Access-focused routing prioritized guest list, tickets, or VIP/table potential.' : 'Event-first routing is prioritized for club nights.');
      return { plans: plans.slice(0, 3), note };
    }

    if (mode === 'low-key') {
      if (primaryVenue) plans.push(makePlan('venue', primaryVenue, primaryEvent || secondaryEvent, ctx, { title: primaryVenue.name }));
      if (secondaryVenue) plans.push(makePlan('venue', secondaryVenue, primaryEvent || secondaryEvent, ctx, { title: secondaryVenue.name }));
      if (primaryEvent) plans.push(makePlan('event', primaryEvent, primaryVenue || secondaryVenue, ctx, { title: primaryEvent.title }));
      const note = !hasExactCityData ? `No exact ${cityLabel(ctx.cityKey)} rows yet; showing the strongest WTW inventory.` : 'Low-key routing favors lounges, cocktails, and food-first rooms.';
      return { plans: plans.slice(0, 3), note };
    }

    // general / dinner-night
    if (primaryVenue) plans.push(makePlan('venue', primaryVenue, primaryEvent || secondaryEvent, ctx, { title: primaryVenue.name }));
    if (primaryEvent) plans.push(makePlan('event', primaryEvent, primaryVenue || secondaryVenue, ctx, { title: primaryEvent.title }));
    if (primaryVenue && primaryEvent) plans.push(makePlan('combo', primaryVenue, primaryEvent, ctx, { title: `${primaryVenue.name} + ${primaryEvent.title}` }));
    return {
      plans: plans.slice(0, 3),
      note: !hasExactCityData ? `No exact ${cityLabel(ctx.cityKey)} rows yet; showing the strongest WTW inventory.` : (eventRank.exact ? 'WaveBot found exact-date inventory matches.' : 'No exact date match in current inventory yet; showing the strongest city options.')
    };
  }
  function extractPlanContext() {
    const question = text(els.wavebotQuestion && els.wavebotQuestion.value) || text(els.wavebotNatural && els.wavebotNatural.value);
    const formCity = els.wavebotCity ? els.wavebotCity.value : state.currentCity;
    const questionCity = detectMarketKey(question);
    const cityKey = resolveCityFromInput(questionCity || formCity || state.currentCity);
    const timing = detectTiming(question) || (els.wavebotTiming ? els.wavebotTiming.value : 'tonight');
    const customDate = normalizeDateInput(els.wavebotDate && els.wavebotDate.value);
    const occasion = detectOccasion(question) || (els.wavebotOccasion ? els.wavebotOccasion.value : 'casual');
    const groupSize = detectGroupSize(question, toNum(els.wavebotGroup && els.wavebotGroup.value, 2));
    const budget = detectBudget(question) || (els.wavebotBudget ? els.wavebotBudget.value : 'flexible');
    const vibe = detectVibe(question) || (els.wavebotVibe ? els.wavebotVibe.value : 'chill');
    const flow = detectFlow(question) || (els.wavebotFlow ? els.wavebotFlow.value : 'full night plan');
    const accessNeed = detectAccessNeed(question) || (els.wavebotAccessNeed ? els.wavebotAccessNeed.value : 'just exploring');
    const mode = getQuestionMode(question);
    return {
      cityKey,
      cityMarket: marketForCity(cityKey),
      timing,
      customDate,
      occasion,
      groupSize,
      budget: numericSpendTier(budget),
      vibe,
      flow,
      accessNeed,
      mode,
      question,
      exactDateMatch: false
    };
  }
  function applyPrompt(prompt) {
    if (!prompt) return;
    if (els.wavebotQuestion) els.wavebotQuestion.value = prompt.question || '';
    if (els.wavebotNatural) els.wavebotNatural.value = prompt.question || '';
    if (prompt.city && els.wavebotCity) els.wavebotCity.value = prompt.city;
    if (prompt.timing && els.wavebotTiming) els.wavebotTiming.value = prompt.timing;
    if (prompt.customDate && els.wavebotDate) els.wavebotDate.value = prompt.customDate;
    if (prompt.occasion && els.wavebotOccasion) els.wavebotOccasion.value = prompt.occasion;
    if (prompt.groupSize && els.wavebotGroup) els.wavebotGroup.value = String(prompt.groupSize);
    if (prompt.budget && els.wavebotBudget) els.wavebotBudget.value = prompt.budget;
    if (prompt.vibe && els.wavebotVibe) els.wavebotVibe.value = prompt.vibe;
    if (prompt.flow && els.wavebotFlow) els.wavebotFlow.value = prompt.flow;
    if (prompt.accessNeed && els.wavebotAccessNeed) els.wavebotAccessNeed.value = prompt.accessNeed;
    if (prompt.city) setCity(prompt.city, { rebuild: false });
  }
  function renderPlanCard(plan, ctx, index) {
    const actionHtml = `
      <div class="plan-actions">
        <a class="action primary" href="${plan.primary.href}">${plan.primary.label}</a>
        <a class="action" href="${plan.secondary.href}">${plan.secondary.label}</a>
        <a class="action" href="${plan.tertiary.href}">${plan.tertiary.label}</a>
      </div>
    `;
    return `
      <article class="plan-card">
        <div class="plan-hero" style="background-image:url('${plan.image}')"></div>
        <div class="plan-body">
          <div class="plan-kicker">Option ${index + 1} · ${cityLabel(ctx.cityKey)}</div>
          <h3 class="plan-title">${plan.title}</h3>
          <p class="plan-copy">${plan.why}</p>
          <div class="plan-meta">
            <div class="plan-line"><span>Suggested start</span><div>${plan.suggestedStart}</div></div>
            <div class="plan-line"><span>Next move</span><div>${plan.nextMove}</div></div>
            <div class="plan-line"><span>Late-night option</span><div>${plan.lateNight}</div></div>
            <div class="plan-line"><span>Estimated vibe / spend</span><div>${plan.vibeSpend}</div></div>
          </div>
          <div class="plan-tags">${plan.tags.map((tag) => `<span class="tag">${tag}</span>`).join('')}</div>
          ${actionHtml}
        </div>
      </article>
    `;
  }
  function updateInventoryNote(note, usingFallback, hasLive) {
    const parts = [];
    if (hasLive) parts.push('Connected to WTW public inventory.');
    if (usingFallback) parts.push(FALLBACK_NOTE);
    if (note) parts.push(note);
    setStatus(parts.join(' '), false);
  }
  function renderResults(bundle, ctx) {
    const mount = els.wavebotResults;
    if (!mount) return;
    mount.innerHTML = bundle.plans.map((plan, index) => renderPlanCard(plan, ctx, index)).join('');
    showEmptyState(false);
    if (bundle.note) {
      setStatus(`${state.usingFallback ? FALLBACK_NOTE + ' ' : ''}${bundle.note}`, false);
    }
    planStorage(bundle.plans[0] || null, ctx);
    state.lastBuild = { bundle, ctx };
  }
  function clearResults(message) {
    if (els.wavebotResults) els.wavebotResults.innerHTML = '';
    showEmptyState(true);
    setStatus(message || (state.usingFallback ? FALLBACK_NOTE : 'WTW inventory loaded.'), false);
  }
  function runPlanner() {
    const ctx = extractPlanContext();
    state.currentCity = ctx.cityKey;
    state.currentVibe = ctx.vibe;
    if (els.headerCity) els.headerCity.textContent = cityLabel(ctx.cityKey);
    if (els.headerDot) els.headerDot.style.background = pickAccent(ctx.cityKey);
    const bundle = buildPlanBundle(ctx);
    renderResults(bundle, ctx);
    return bundle;
  }
  function bindQuickPrompts() {
    const prompts = [
      { title: 'What should we do tonight?', note: 'Build a full night plan.', question: 'What should we do tonight?', city: state.currentCity, timing: 'tonight', flow: 'full night plan', accessNeed: 'just exploring', vibe: 'high-energy' },
      { title: 'Plan my birthday', note: 'Group-friendly celebration routing.', question: 'Plan my birthday for a group of 6.', city: state.currentCity, timing: 'tonight', occasion: 'birthday', flow: 'full night plan', groupSize: 6, budget: 'premium', vibe: 'high-energy', accessNeed: 'VIP/table' },
      { title: 'Dinner then lounge', note: 'Food-first into late drinks.', question: 'I want dinner then lounge tonight.', city: state.currentCity, timing: 'tonight', flow: 'dinner + lounge', vibe: 'food-first', accessNeed: 'reservation' },
      { title: 'Best brunch move', note: 'Daytime flow with optional night add-on.', question: 'What is the best brunch move this weekend?', city: state.currentCity, timing: 'weekend', occasion: 'brunch', flow: 'brunch + day party', vibe: 'food-first' },
      { title: 'Date night', note: 'Upscale and photo-friendly.', question: 'Give me a date night plan.', city: state.currentCity, timing: 'tonight', occasion: 'date night', flow: 'dinner + lounge', budget: 'premium', vibe: 'upscale' },
      { title: 'Rooftop then late night', note: 'Skyline into the late room.', question: 'Rooftop then late night tonight.', city: state.currentCity, timing: 'tonight', flow: 'rooftop + late night', vibe: 'rooftop', accessNeed: 'VIP/table' },
      { title: 'Club night', note: 'Event-first access routing.', question: 'What is good for a club night?', city: state.currentCity, timing: 'tonight', occasion: 'club night', flow: 'club/event only', vibe: 'high-energy', accessNeed: 'guest list' },
      { title: 'VIP / table night', note: 'Premium access planning.', question: 'What should we do for a VIP table night?', city: state.currentCity, timing: 'tonight', flow: 'club/event only', budget: 'vip', accessNeed: 'VIP/table', vibe: 'upscale' },
      { title: 'Low-key drinks', note: 'Quiet, polished, food-first.', question: 'What is good for low-key drinks?', city: state.currentCity, timing: 'tonight', flow: 'low-key', vibe: 'chill' },
      { title: 'This weekend', note: 'Weekend routing.', question: 'What is happening this weekend?', city: state.currentCity, timing: 'weekend', flow: 'full night plan', accessNeed: 'just exploring' }
    ];
    if (!els.quickGrid) return;
    els.quickGrid.innerHTML = prompts.map((prompt) => `
      <button class="quick-card" type="button" data-question="${prompt.question.replace(/"/g, '&quot;')}">
        <div>
          <div class="quick-label">WaveBot</div>
          <h3>${prompt.title}</h3>
        </div>
        <p>${prompt.note}</p>
      </button>
    `).join('');
    els.quickGrid.querySelectorAll('.quick-card').forEach((button, index) => {
      button.addEventListener('click', () => {
        const prompt = prompts[index];
        applyPrompt(prompt);
        runPlanner();
        window.location.hash = '#results';
      });
    });
  }
  function renderNaturalQuestionExamples() {
    const examples = [
      'What should we do tonight in Miami for a birthday group of 6?',
      'Give me a date night plan in NYC.',
      'What’s good this weekend in NJ?',
      'Where should we brunch then go out?',
      'I want dinner, lounge, and a club after.'
    ];
    if (els.wavebotNatural) {
      els.wavebotNatural.value = els.wavebotNatural.value || examples[0];
      els.wavebotNatural.addEventListener('change', () => {
        if (els.wavebotQuestion) els.wavebotQuestion.value = els.wavebotNatural.value;
      });
    }
  }
  function bindEvents() {
    if (els.wavebotForm) {
      els.wavebotForm.addEventListener('submit', (event) => {
        event.preventDefault();
        if (els.wavebotQuestion && els.wavebotNatural) {
          els.wavebotNatural.value = els.wavebotQuestion.value;
        }
        runPlanner();
        window.location.hash = '#results';
      });
    }
    if (els.wavebotReset) {
      els.wavebotReset.addEventListener('click', () => {
        if (els.wavebotQuestion) els.wavebotQuestion.value = '';
        if (els.wavebotNatural) els.wavebotNatural.value = '';
        if (els.wavebotDate) els.wavebotDate.value = '';
        if (els.wavebotGroup) els.wavebotGroup.value = '2';
        if (els.wavebotBudget) els.wavebotBudget.value = 'flexible';
        if (els.wavebotVibe) els.wavebotVibe.value = 'chill';
        if (els.wavebotFlow) els.wavebotFlow.value = 'full night plan';
        if (els.wavebotAccessNeed) els.wavebotAccessNeed.value = 'just exploring';
        if (els.wavebotOccasion) els.wavebotOccasion.value = 'casual';
        if (els.wavebotTiming) els.wavebotTiming.value = 'tonight';
        setCity('nyc', { rebuild: false });
        clearResults();
      });
    }
    ['wavebotCity', 'wavebotTiming', 'wavebotDate', 'wavebotOccasion', 'wavebotGroup', 'wavebotBudget', 'wavebotVibe', 'wavebotFlow', 'wavebotAccessNeed']
      .forEach((id) => {
        const el = $(id);
        if (el) el.addEventListener('change', () => {
          if (id === 'wavebotCity') setCity(el.value, { rebuild: false });
        });
      });
    if (els.wavebotQuestion) {
      els.wavebotQuestion.addEventListener('input', () => {
        if (els.wavebotNatural) els.wavebotNatural.value = els.wavebotQuestion.value;
      });
    }
    if (els.wavebotNatural) {
      els.wavebotNatural.addEventListener('input', () => {
        if (els.wavebotQuestion) els.wavebotQuestion.value = els.wavebotNatural.value;
      });
    }
  }
  async function loadInventory() {
    const fallbackLoader = window.WTW_WAVEBOT_FALLBACK_PROMISE || Promise.resolve(window.WTW_WAVEBOT_FALLBACK || null);
    const fallback = await fallbackLoader.catch(() => null);
    const fallbackInventory = normalizeInventory(fallback || window.WTW_WAVEBOT_FALLBACK || { events: [], venues: [] });

    let liveEvents = [];
    let liveVenues = [];
    let liveEventsOk = false;
    let liveVenuesOk = false;

    if (window.WTWBackend && typeof WTWBackend.fetchPublicEvents === 'function' && typeof WTWBackend.fetchPublicVenues === 'function') {
      try {
        const [events, venues] = await Promise.all([
          WTWBackend.fetchPublicEvents().catch(() => []),
          WTWBackend.fetchPublicVenues().catch(() => [])
        ]);
        liveEvents = Array.isArray(events) ? events : [];
        liveVenues = Array.isArray(venues) ? venues : [];
        liveEventsOk = liveEvents.length > 0;
        liveVenuesOk = liveVenues.length > 0;
      } catch (error) {
        console.warn('WTW WaveBot live inventory load failed:', error);
      }
    }

    const liveInventory = normalizeInventory({ events: liveEvents, venues: liveVenues });
    state.inventory.events = liveEventsOk ? liveInventory.events : fallbackInventory.events;
    state.inventory.venues = liveVenuesOk ? liveInventory.venues : fallbackInventory.venues;
    state.usingFallback = !(liveEventsOk && liveVenuesOk);
    state.loaded = true;
    const noteParts = [];
    if (liveEventsOk && liveVenuesOk) noteParts.push('Connected to WTW public inventory.');
    if (state.usingFallback) noteParts.push(FALLBACK_NOTE);
    noteParts.push(POLICY_NOTE);
    setStatus(noteParts.join(' '), false);
    runPlanner();
  }
  function syncFromHashAndStorage() {
    let stored = 'nyc';
    try { stored = localStorage.getItem(STORAGE_KEYS.selectedCity) || 'nyc'; } catch (error) { /* noop */ }
    const queryCity = new URLSearchParams(window.location.search).get('city');
    setCity(queryCity || stored || 'nyc', { rebuild: false });
    if (els.wavebotTiming && !els.wavebotTiming.value) els.wavebotTiming.value = 'tonight';
  }
  function buildInfoNote() {
    if (!state.loaded) {
      setStatus('Loading live inventory and fallback data...', false);
    }
  }
  function init() {
    els.headerCity = $('headerCity');
    els.headerDot = $('headerDot');
    els.wavebotCity = $('wavebotCity');
    els.wavebotTiming = $('wavebotTiming');
    els.wavebotDate = $('wavebotDate');
    els.wavebotOccasion = $('wavebotOccasion');
    els.wavebotGroup = $('wavebotGroup');
    els.wavebotBudget = $('wavebotBudget');
    els.wavebotVibe = $('wavebotVibe');
    els.wavebotFlow = $('wavebotFlow');
    els.wavebotAccessNeed = $('wavebotAccessNeed');
    els.wavebotQuestion = $('wavebotQuestion');
    els.wavebotNatural = $('wavebotNatural');
    els.wavebotForm = $('wavebotForm');
    els.wavebotReset = $('wavebotReset');
    els.quickGrid = $('quickGrid');
    els.wavebotResults = $('wavebotResults');
    els.wavebotEmpty = $('wavebotEmpty');
    els.inventoryStatus = $('inventoryStatus');
    els.cityModal = $('cityModal');
    els.cityList = $('cityList');

    window.openCityModal = openCityModal;
    window.closeCityModal = closeCityModal;
    window.changeCity = (key) => setCity(key, { rebuild: true });

    syncFromHashAndStorage();
    buildInfoNote();
    renderCityModal();
    renderNaturalQuestionExamples();
    bindQuickPrompts();
    bindEvents();
    updateHeaderCity();
    showEmptyState(true);
    loadInventory();
  }

  window.WTWWaveBot = Object.freeze({
    buildPlanBundle,
    normalizeCityInput,
    resolveCityFromInput
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
