(function () {
  'use strict';

  const CITYS = [
    { key: 'nyc', label: 'NYC', market: 'NYC', aliases: ['new york', 'new york city', 'nyc'] },
    { key: 'nj', label: 'NJ', market: 'NJ', aliases: ['new jersey', 'nj'] },
    { key: 'miami', label: 'Miami', market: 'Miami', aliases: ['mia', 'miami'] },
    { key: 'la', label: 'LA', market: 'LA', aliases: ['los angeles', 'la'] },
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
  const QUICK_PROMPTS = [
    'What should we do tonight?',
    'Plan my birthday',
    'Dinner then lounge',
    'Best brunch move',
    'Date night',
    'Rooftop then late night',
    'Club night',
    'VIP/table night',
    'Low-key drinks',
    'This weekend'
  ];
  const CITY_CHIPS = ['nyc', 'nj', 'miami', 'la', 'dallas', 'philadelphia', 'atlanta'];
  const TIMING_CHIPS = ['tonight', 'tomorrow', 'weekend'];
  const VIBE_CHIPS = ['birthday', 'date night', 'dinner + lounge', 'brunch', 'rooftop', 'club night', 'vip/table', 'low-key drinks'];
  const GROUP_CHIPS = ['2', '4', '6', '8+'];
  const BUDGET_CHIPS = ['moderate', 'premium', 'vip'];
  const ACCESS_CHIPS = ['reservation', 'guest list', 'tickets', 'vip/table', 'wave pass', 'just exploring'];
  const FLOW_CHIPS = ['dinner only', 'dinner + lounge', 'brunch + day party', 'rooftop + late night', 'club/event only', 'full night plan', 'low-key'];
  const MUSIC_CHIPS = ['hip-hop', 'afrobeats', 'latin', 'house', 'open format', 'photo-friendly'];

  const CITY_LOOKUP = new Map(CITYS.map((city) => [city.key, city]));
  const CITY_ALIAS = new Map();
  CITYS.forEach((city) => city.aliases.forEach((alias) => CITY_ALIAS.set(alias.toLowerCase(), city.key)));

  const STATE_KEYS = {
    lastPlan: 'wtw_wavebot_last_plan',
    selectedCity: 'wtw_wavebot_selected_city',
    selectedVibe: 'wtw_wavebot_selected_vibe'
  };
  const FALLBACK_NOTE = 'WaveBot is using the current WTW fallback inventory while live inventory loads.';
  const POLICY_NOTE = 'WTW routes requests for review. Final access, reservations, and tables remain subject to venue or partner confirmation.';

  const state = {
    loaded: false,
    usingFallback: true,
    sourceNote: FALLBACK_NOTE,
    inventory: { events: [], venues: [] },
    selections: {
      city: 'nyc',
      timing: 'tonight',
      vibe: 'dinner + lounge',
      group: '4',
      budget: 'premium',
      flow: 'full night plan',
      access: 'just exploring',
      music: '',
      customDate: '',
      prompt: ''
    },
    lastBundle: null
  };

  const els = {};

  function $(id) { return document.getElementById(id); }
  function text(value) { return String(value == null ? '' : value).trim(); }
  function lower(value) { return text(value).toLowerCase(); }
  function escapeHtml(value) {
    return text(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  function slugify(value) { return lower(value).replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  function truthy(value) { return value === true || value === 'true' || value === 1 || value === '1' || lower(value) === 'yes'; }
  function toNumber(value, fallback = 0) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
  function pad(n) { return String(n).padStart(2, '0'); }
  function dayStart(date) { const d = new Date(date); d.setHours(0, 0, 0, 0); return d; }
  function addDays(date, days) { const d = new Date(date.getTime()); d.setDate(d.getDate() + days); return d; }
  function isoDate(date) { return date.toISOString().slice(0, 10); }
  function isIsoDate(value) { return /^\d{4}-\d{2}-\d{2}$/.test(text(value)); }
  function resolveQueryCity() {
    const params = new URLSearchParams(window.location.search);
    return params.get('city') || params.get('market') || localStorage.getItem('wtwSelectedCity') || 'nyc';
  }
  function normalizeCityInput(value) {
    const raw = lower(value);
    if (!raw) return 'nyc';
    if (CITY_LOOKUP.has(raw)) return raw;
    if (CITY_ALIAS.has(raw)) return CITY_ALIAS.get(raw);
    const found = CITYS.find((city) => city.aliases.some((alias) => raw.includes(alias)));
    return found ? found.key : 'nyc';
  }
  function cityLabel(key) { return (CITY_LOOKUP.get(key) || CITY_LOOKUP.get('nyc')).label; }
  function marketForCity(key) { return (CITY_LOOKUP.get(key) || CITY_LOOKUP.get('nyc')).market; }
  function marketLabel(value) {
    const raw = lower(value);
    const match = CITYS.find((city) => lower(city.market) === raw || lower(city.label) === raw || city.aliases.includes(raw));
    return match ? match.market : (text(value) || 'NYC');
  }
  function normalizeDate(value) {
    const raw = text(value);
    if (!raw) return '';
    if (isIsoDate(raw)) return raw;
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return isoDate(parsed);
    return raw;
  }
  function formatDate(value) {
    const raw = text(value);
    if (!raw) return 'TBD';
    if (isIsoDate(raw)) {
      const d = new Date(`${raw}T00:00:00`);
      if (!Number.isNaN(d.getTime())) return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }
    return raw;
  }
  function formatTime(value) {
    const raw = text(value);
    if (!raw) return 'TBD';
    if (/^open$/i.test(raw)) return 'Open';
    const match = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
    if (!match) return raw;
    let hour = parseInt(match[1], 10);
    const minute = match[2];
    const period = match[4] ? match[4].toUpperCase() : '';
    if (period) {
      if (hour > 12) hour -= 12;
      if (hour === 0) hour = 12;
      return `${hour}:${minute} ${period}`;
    }
    if (hour === 0) return `12:${minute} AM`;
    if (hour === 12) return `12:${minute} PM`;
    if (hour > 12) return `${hour - 12}:${minute} PM`;
    return `${hour}:${minute} AM`;
  }
  function priceTierScore(value) {
    const raw = text(value).replace(/[^$]/g, '');
    if (!raw) return 1;
    return Math.max(1, raw.length);
  }
  function describeBudget(budget) {
    if (budget === 'vip') return 'VIP spend';
    if (budget === 'premium') return 'premium spend';
    if (budget === 'moderate') return 'moderate spend';
    return 'flexible spend';
  }
  function dateRangeForTiming(timing, customDate) {
    const now = dayStart(new Date());
    if (timing === 'tomorrow') {
      const d = addDays(now, 1);
      return [isoDate(d), isoDate(d)];
    }
    if (timing === 'weekend') {
      const offset = (5 - now.getDay() + 7) % 7;
      const fri = addDays(now, offset);
      const sun = addDays(fri, 2);
      return [isoDate(fri), isoDate(sun)];
    }
    if (isIsoDate(customDate)) return [customDate, customDate];
    const today = isoDate(now);
    return [today, today];
  }
  function getQuestionMode(value) {
    const q = lower(value);
    if (/what is wave pass|wave pass/.test(q)) return 'wave-pass';
    if (/what should i wear/.test(q)) return 'wear';
    if (/\bguaranteed\b|entry.*guaranteed|access.*confirmed|approval/.test(q)) return 'policy';
    if (/how does wtw work/.test(q) || /can wtw help me get access/.test(q)) return 'policy';
    if (/what is good this weekend/.test(q)) return 'general';
    if (/brunch/.test(q)) return 'brunch';
    if (/birthday/.test(q)) return 'birthday';
    if (/date/.test(q)) return 'date';
    if (/club/.test(q) || /guest list|tickets|vip|table/.test(q)) return 'club';
    if (/low[- ]key|quiet/.test(q)) return 'low-key';
    if (/dinner.*lounge|lounge.*dinner|dinner then lounge|eat before going out|dinner.*night/.test(q)) return 'dinner-night';
    return 'general';
  }
  function detectCity(value) {
    const q = lower(value);
    if (!q) return null;
    const found = CITYS.find((city) => city.aliases.some((alias) => q.includes(alias)));
    return found ? found.key : null;
  }
  function detectTiming(value) {
    const q = lower(value);
    if (q.includes('tomorrow')) return 'tomorrow';
    if (q.includes('weekend')) return 'weekend';
    if (q.includes('tonight') || q.includes('today')) return 'tonight';
    const match = q.match(/\b(\d{4}-\d{2}-\d{2})\b/);
    return match ? match[1] : null;
  }
  function detectBudget(value) {
    const q = lower(value);
    if (q.includes('vip') || q.includes('table') || q.includes('section')) return 'vip';
    if (q.includes('premium') || q.includes('upscale')) return 'premium';
    if (q.includes('moderate')) return 'moderate';
    if (q.includes('flexible')) return 'flexible';
    return null;
  }
  function detectGroupSize(value) {
    const q = lower(value);
    const match = q.match(/group(?:\s+of)?\s+(\d+)/) || q.match(/for\s+(\d+)/) || q.match(/\b(\d+)\s*(?:people|guests|friends|ppl)\b/);
    if (!match) {
      if (q.includes('8+')) return 8;
      if (q.includes('six')) return 6;
      if (q.includes('four')) return 4;
      if (q.includes('two')) return 2;
      return null;
    }
    return Math.max(1, Math.min(30, parseInt(match[1], 10)));
  }
  function detectVibe(value) {
    const q = lower(value);
    if (/birthday/.test(q)) return 'birthday';
    if (/date/.test(q)) return 'date night';
    if (/brunch/.test(q)) return 'brunch';
    if (/rooftop/.test(q)) return 'rooftop';
    if (/club/.test(q)) return 'club night';
    if (/vip|table/.test(q)) return 'vip/table';
    if (/low[- ]key/.test(q)) return 'low-key drinks';
    if (/dinner.*lounge|lounge.*dinner/.test(q)) return 'dinner + lounge';
    return null;
  }
  function detectAccess(value) {
    const q = lower(value);
    if (q.includes('guest list')) return 'guest list';
    if (q.includes('ticket')) return 'tickets';
    if (q.includes('wave pass')) return 'wave pass';
    if (q.includes('vip') || q.includes('table') || q.includes('section')) return 'vip/table';
    if (q.includes('reservation') || q.includes('book')) return 'reservation';
    return null;
  }
  function detectFlow(value) {
    const q = lower(value);
    if (/brunch.*day party|day party.*brunch/.test(q)) return 'brunch + day party';
    if (/rooftop.*late|late.*rooftop/.test(q)) return 'rooftop + late night';
    if (/club.*only|event.*only/.test(q)) return 'club/event only';
    if (/low[- ]key|quiet/.test(q)) return 'low-key';
    if (/dinner.*lounge|lounge.*dinner|dinner then lounge/.test(q)) return 'dinner + lounge';
    if (/dinner only|just dinner/.test(q)) return 'dinner only';
    if (/full night|plan my night|dinner.*club/.test(q)) return 'full night plan';
    return null;
  }
  function parsePrompt(raw) {
    const q = text(raw);
    return {
      question: q,
      city: detectCity(q),
      timing: detectTiming(q),
      vibe: detectVibe(q),
      occasion: getQuestionMode(q),
      budget: detectBudget(q),
      group: detectGroupSize(q),
      access: detectAccess(q),
      flow: detectFlow(q),
      customDate: isIsoDate(q) ? q : ''
    };
  }
  function normalizeEvent(row) {
    const market = marketLabel(row.market || row.source_city || row.city || 'NYC');
    const cityKey = CITYS.find((city) => city.market === market)?.key || normalizeCityInput(market);
    return {
      id: text(row.id) || slugify([market, row.title, row.venue_name, row.event_date].join('-')),
      title: text(row.title) || 'Untitled Event',
      venue_name: text(row.venue_name || row.venue) || 'Venue',
      market,
      cityKey,
      category: text(row.category) || 'Nightlife',
      event_date: normalizeDate(row.event_date || row.date || row.start_date),
      start_time: text(row.start_time || row.startTime),
      end_time: text(row.end_time || row.endTime),
      address: text(row.address),
      image_url: text(row.image_url) || 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200&q=80&auto=format&fit=crop',
      description: text(row.description) || `${text(row.title) || 'This event'} in ${cityLabel(cityKey)}.`,
      music: text(row.music),
      dress_code: text(row.dress_code || row.dresscode) || 'Smart Casual',
      age_requirement: text(row.age_requirement || row.age) || '21+',
      ticket_price: toNumber(row.ticket_price ?? row.price ?? 0, 0),
      guest_list_available: truthy(row.guest_list_available || row.guestListAvailable),
      vip_table_available: truthy(row.vip_table_available || row.vipTableAvailable),
      status: text(row.status) || 'available',
      created_at: text(row.created_at || row.createdAt)
    };
  }
  function normalizeVenue(row) {
    const market = marketLabel(row.market || row.source_city || row.city || 'NYC');
    const cityKey = CITYS.find((city) => city.market === market)?.key || normalizeCityInput(market);
    return {
      id: text(row.id) || slugify([market, row.name].join('-')),
      name: text(row.name) || 'Venue',
      market,
      cityKey,
      type: text(row.type || row.category) || 'Dinner',
      neighborhood: text(row.neighborhood || row.area || market),
      address: text(row.address),
      image_url: text(row.image_url || row.image) || 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200&q=80&auto=format&fit=crop',
      price_tier: text(row.price_tier || row.priceTier) || '$$$',
      atmosphere: text(row.atmosphere || row.vibe) || 'WTW curated',
      best_for: text(row.best_for || row.bestFor) || 'Reservation Request',
      dress_code: text(row.dress_code || row.dressCode) || 'Smart Casual',
      reservation_available: truthy(row.reservation_available || row.reservationAvailable),
      table_available: truthy(row.table_available || row.tableAvailable),
      guest_list_available: truthy(row.guest_list_available || row.guestListAvailable),
      description: text(row.description) || `${text(row.name) || 'Venue'} in ${cityLabel(cityKey)}.`,
      status: text(row.status) || 'available',
      created_at: text(row.created_at || row.createdAt)
    };
  }
  function normalizeInventory(payload) {
    const events = Array.isArray(payload && payload.events) ? payload.events.map(normalizeEvent) : [];
    const venues = Array.isArray(payload && payload.venues) ? payload.venues.map(normalizeVenue) : [];
    return { events, venues };
  }
  function matchesKeywords(hay, keywords) {
    const q = lower(hay);
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
    if (ctx.vibe && matchesKeywords(hay, ctx.vibeKeywords)) score += 18;
    if (ctx.occasion === 'birthday' && (event.vip_table_available || event.guest_list_available || /premium|lounge|rooftop|late/.test(hay))) score += 18;
    if (ctx.occasion === 'date night' && /premium|lounge|supper|salon|social|rooftop|photo/.test(hay)) score += 18;
    if (ctx.occasion === 'brunch' && /brunch|day|rooftop/.test(hay)) score += 18;
    if (ctx.flow === 'club/event only' && /club|late|night|weekend|dj|dance|after dark/.test(hay)) score += 18;
    if (ctx.flow === 'dinner + lounge' && /dinner|lounge|supper|salon|social|cocktail/.test(hay)) score += 15;
    if (ctx.flow === 'rooftop + late night' && /rooftop|terrace|skyline|late|night/.test(hay)) score += 16;
    if (ctx.access === 'guest list' && event.guest_list_available) score += 14;
    if (ctx.access === 'vip/table' && event.vip_table_available) score += 14;
    if (ctx.access === 'wave pass') score += 6;
    if (ctx.budget === 'vip' && event.ticket_price >= 45) score += 10;
    if (ctx.budget === 'premium' && event.ticket_price >= 25 && event.ticket_price <= 80) score += 8;
    if (ctx.budget === 'moderate' && event.ticket_price <= 60) score += 8;
    if (/high-interest|guestlist|available/.test(lower(event.status))) score += 5;
    if (ctx.timing === 'weekend' && /fri|sat|sun/.test(lower(formatDate(event.event_date)))) score += 10;
    if ((ctx.timing === 'tonight' || ctx.timing === 'tomorrow') && /available|high-interest/.test(lower(event.status))) score += 6;
    return score;
  }
  function scoreVenue(venue, ctx) {
    let score = 0;
    const hay = venueKeywords(venue);
    if (ctx.cityMarket && lower(venue.market) === lower(ctx.cityMarket)) score += 45;
    if (ctx.vibe && matchesKeywords(hay, ctx.vibeKeywords)) score += 18;
    if (ctx.occasion === 'birthday' && /birthday|celebration|party|section|table|vip/.test(hay)) score += 18;
    if (ctx.occasion === 'date night' && /date|quiet|luxury|cocktail|supper|salon|romantic|photo/.test(hay)) score += 18;
    if (ctx.occasion === 'brunch' && /brunch|day|garden|patio/.test(hay)) score += 18;
    if (ctx.flow === 'dinner only' && /dinner|supper|restaurant|table/.test(hay)) score += 18;
    if (ctx.flow === 'dinner + lounge' && /lounge|cocktail|supper|social|dinner/.test(hay)) score += 18;
    if (ctx.flow === 'brunch + day party' && /brunch|day|party|rooftop/.test(hay)) score += 18;
    if (ctx.flow === 'rooftop + late night' && /rooftop|terrace|skyline|night/.test(hay)) score += 18;
    if (ctx.flow === 'low-key' && /quiet|cocktail|social|lounge|intimate/.test(hay)) score += 18;
    if (ctx.access === 'reservation' && venue.reservation_available) score += 14;
    if (ctx.access === 'guest list' && venue.guest_list_available) score += 12;
    if (ctx.access === 'vip/table' && venue.table_available) score += 14;
    if (ctx.access === 'wave pass') score += 6;
    const tier = priceTierScore(venue.price_tier);
    if (ctx.budget === 'vip' && tier >= 4) score += 10;
    if (ctx.budget === 'premium' && tier >= 3) score += 9;
    if (ctx.budget === 'moderate' && tier <= 3) score += 8;
    if (/high-interest|available/.test(lower(venue.status))) score += 5;
    return score;
  }
  function cityEventPool(ctx) {
    const all = state.inventory.events.slice();
    if (!ctx.cityMarket) return all;
    const matched = all.filter((event) => lower(event.market) === lower(ctx.cityMarket));
    return matched.length ? matched : all;
  }
  function cityVenuePool(ctx) {
    const all = state.inventory.venues.slice();
    if (!ctx.cityMarket) return all;
    const matched = all.filter((venue) => lower(venue.market) === lower(ctx.cityMarket));
    return matched.length ? matched : all;
  }
  function eventMatchesTiming(event, ctx) {
    if (!event.event_date) return true;
    const [start, end] = dateRangeForTiming(ctx.timing, ctx.customDate);
    return event.event_date >= start && event.event_date <= end;
  }
  function pickTop(list, scoreFn, ctx, limit = 3) {
    return list
      .slice()
      .sort((a, b) => scoreFn(b, ctx) - scoreFn(a, ctx) || String(a.title || a.name || '').localeCompare(String(b.title || b.name || '')))
      .slice(0, limit);
  }
  function policyAnswer(mode, ctx) {
    if (mode === 'wear') {
      return {
        summary: 'WTW can help route this request for review. Wear upscale nightlife attire: polished, clean, and venue-aware. Smart dark layers usually work best, but always check the venue dress code because it can vary by room.',
        cards: []
      };
    }
    if (mode === 'wave-pass') {
      return {
        summary: 'Wave Pass is WTW’s premium priority review and routing layer. It helps prioritize planning and request handling, but it does not guarantee entry, reservations, or tables.',
        cards: []
      };
    }
    return {
      summary: 'No. WTW curates and routes requests. Final access remains subject to venue or partner confirmation.',
      cards: []
    };
  }
  function routeTemplates(mode) {
    const base = [
      {
        title: 'Dinner first, then keep it moving',
        flow: 'Dinner → Lounge → Event',
        kind: 'balanced',
        why: 'Best for a clean start that leaves room for a late-night move.',
        start: 'Start with the best dinner room in the city.',
        next: 'Move to a lounge or rooftop after the first stop.',
        late: 'Keep an event or club option ready if the room is still flowing.'
      },
      {
        title: 'Go straight to the energy',
        flow: 'Event → Drinks → Late move',
        kind: 'event',
        why: 'Best for guest list, ticket, or table-heavy nights.',
        start: 'Lead with the strongest public event match.',
        next: 'Use a nearby lounge or rooftop as the warm-up.',
        late: 'Have a late-night add-on ready if the group wants more.'
      },
      {
        title: 'Keep it smooth and premium',
        flow: 'Venue → Lounge → Easy exit',
        kind: 'low-key',
        why: 'Best for date night, low-key drinks, or a quieter premium plan.',
        start: 'Choose a polished venue with atmosphere.',
        next: 'Stay flexible on the second stop and keep the pace easy.',
        late: 'Add a Wave Pass upgrade only if you want priority review.'
      }
    ];
    if (mode === 'birthday') {
      base[0] = {
        title: 'Birthday dinner with room to grow',
        flow: 'Dinner → Lounge → Celebration',
        kind: 'balanced',
        why: 'Fits a group that wants a room with energy but still wants a proper start.',
        start: 'Lock in a group-friendly dinner room.',
        next: 'Move the group to a louder lounge or rooftop.',
        late: 'Keep a late-night event or VIP move in reserve.'
      };
      base[1] = {
        title: 'Birthday with late-night energy',
        flow: 'Venue → Event → VIP/table',
        kind: 'event',
        why: 'Good if the group wants a stronger nightlife finish.',
        start: 'Use the most social room in the market.',
        next: 'Layer in guest list or table potential where it exists.',
        late: 'Add a late event option if the group wants to keep going.'
      };
    } else if (mode === 'date') {
      base[0] = {
        title: 'Date night with a polished start',
        flow: 'Dinner → Lounge → Optional late stop',
        kind: 'balanced',
        why: 'Good for a refined night that should feel thoughtful instead of loud.',
        start: 'Choose the most polished dinner room.',
        next: 'Shift into a softer lounge or rooftop.',
        late: 'Keep the ending flexible and low pressure.'
      };
      base[1] = {
        title: 'Quiet room, strong finish',
        flow: 'Venue → Cocktail → Evening walk',
        kind: 'low-key',
        why: 'Better when the vibe should feel intimate and premium.',
        start: 'Start with a room that feels clean and calm.',
        next: 'Move to a cocktail stop instead of a club.',
        late: 'Skip the heavy club move unless the night changes.'
      };
    } else if (mode === 'brunch') {
      base[0] = {
        title: 'Brunch into the afternoon',
        flow: 'Brunch → Day party → Night option',
        kind: 'balanced',
        why: 'Best for daytime energy that can still stretch into the night.',
        start: 'Lead with the most food-friendly brunch room.',
        next: 'Add a day-party or rooftop lane after brunch.',
        late: 'Leave a late-night fallback if the group wants it.'
      };
      base[1] = {
        title: 'Brunch with a rooftop finish',
        flow: 'Brunch → Rooftop → Early evening',
        kind: 'low-key',
        why: 'Good when the group wants a slower burn with a strong look and feel.',
        start: 'Use a bright, social brunch pick.',
        next: 'Move to a rooftop before the evening cools down.',
        late: 'No heavy club pressure needed.'
      };
    } else if (mode === 'club') {
      base[0] = {
        title: 'Go straight to the energy',
        flow: 'Event → Guest list → Late move',
        kind: 'event',
        why: 'Best when the request is already nightlife-first.',
        start: 'Lead with the top event or guest list match.',
        next: 'Keep a late lounge or VIP lane ready.',
        late: 'Use Wave Pass if you want priority review.'
      };
      base[1] = {
        title: 'Warm-up, then club',
        flow: 'Lounge → Event → Late exit',
        kind: 'balanced',
        why: 'Gives the group a better start before the room gets loud.',
        start: 'Pick the strongest lounge for the city and vibe.',
        next: 'Move to the event when the timing is right.',
        late: 'A table or guest list lane may make sense here.'
      };
    } else if (mode === 'low-key') {
      base[0] = {
        title: 'Easy upscale start',
        flow: 'Dinner → Lounge → Chill finish',
        kind: 'low-key',
        why: 'Great when the night should feel smooth, social, and premium without overdoing it.',
        start: 'Pick a dinner room with a strong atmosphere.',
        next: 'Add a lounge or rooftop if the group wants more.',
        late: 'Keep the finish soft and optional.'
      };
    } else if (mode === 'dinner-night') {
      base[0] = {
        title: 'Dinner into nightlife',
        flow: 'Dinner → Lounge → Event',
        kind: 'balanced',
        why: 'Built for the classic WTW dinner-to-night route.',
        start: 'Use the best dinner-first room in the city.',
        next: 'Slide into a lounge or rooftop after dinner.',
        late: 'Have a late-night event ready if the energy stays high.'
      };
    }
    return base;
  }
  function makePlanCard(template, ctx, primaryVenue, secondaryVenue, primaryEvent, secondaryEvent, index) {
    const title = template.title;
    const flow = template.flow;
    const city = cityLabel(ctx.cityKey);
    const vibe = text(ctx.vibeLabel || ctx.vibe || 'WTW curated');
    const primaryLine = primaryVenue ? `${primaryVenue.name} · ${primaryVenue.neighborhood || city} · ${primaryVenue.price_tier}` : 'No venue match surfaced';
    const secondaryLine = primaryEvent ? `${primaryEvent.title} · ${formatDate(primaryEvent.event_date)} · ${formatTime(primaryEvent.start_time)}` : 'No event match surfaced';
    const venueHref = primaryVenue ? `indulge-detail.html?city=${encodeURIComponent(ctx.cityKey)}&venue=${encodeURIComponent(primaryVenue.name)}` : `indulge.html?city=${encodeURIComponent(ctx.cityKey)}`;
    const eventHref = primaryEvent ? `event-detail.html?city=${encodeURIComponent(ctx.cityKey)}&event=${encodeURIComponent(primaryEvent.id)}` : `events.html?city=${encodeURIComponent(ctx.cityKey)}`;
    const accessHref = primaryEvent && /event/.test(template.kind) ? eventHref : venueHref;
    const routeHint = primaryVenue && primaryEvent
      ? `${primaryVenue.name} can start the night, and ${primaryEvent.title} can finish it.`
      : primaryVenue
        ? `${primaryVenue.name} gives you the strongest start.`
        : primaryEvent
          ? `${primaryEvent.title} is the best energy match.`
          : `Keep exploring the city and refine the prompt.`;
    const spend = primaryVenue ? estimateSpend(primaryVenue, ctx.budget) : primaryEvent ? estimateSpend(primaryEvent, ctx.budget) : describeBudget(ctx.budget);
    return {
      title,
      flow,
      why: template.why,
      start: `${template.start}${primaryVenue ? ` ${primaryVenue.name}` : primaryEvent ? ` ${primaryEvent.title}` : ''}`.trim(),
      next: `${template.next}${secondaryVenue ? ` ${secondaryVenue.name}` : secondaryEvent ? ` ${secondaryEvent.title}` : ''}`.trim(),
      late: template.late,
      city,
      vibe,
      spend,
      primaryLine,
      secondaryLine,
      routeHint,
      bestMatch: index === 0,
      bestReason: index === 0 ? 'Best match for your city, vibe, and timing.' : '',
      cards: {
        venueHref,
        eventHref,
        accessHref,
        wavePassHref: 'pass.html'
      },
      badges: [city, ctx.timingLabel, ctx.occasionLabel, ctx.accessLabel].filter(Boolean).slice(0, 4),
      order: index + 1
    };
  }
  function estimateSpend(item, budget) {
    if (!item) return describeBudget(budget);
    if (item.ticket_price !== undefined) {
      const price = toNumber(item.ticket_price, 0);
      const base = price > 0 ? `$${price}+ ticket` : 'request pricing';
      if (budget === 'vip') return `${base} · VIP/table potential`;
      if (budget === 'premium') return `${base} · premium spend`;
      if (budget === 'moderate') return `${base} · moderate spend`;
      return `${base} · flexible`;
    }
    const tier = priceTierScore(item.price_tier);
    if (budget === 'vip' || tier >= 4) return `${item.price_tier || '$$$$'} · VIP/table potential`;
    if (budget === 'premium' || tier === 3) return `${item.price_tier || '$$$'} · premium spend`;
    if (budget === 'moderate' || tier === 2) return `${item.price_tier || '$$'} · moderate spend`;
    return `${item.price_tier || '$'} · flexible`;
  }
  function buildContext(rawQuestion) {
    const question = text(rawQuestion);
    const parsed = parsePrompt(question);
    const selections = state.selections;
    const city = parsed.city || selections.city;
    const timing = parsed.timing || selections.timing;
    const customDate = parsed.customDate || selections.customDate;
    const vibe = parsed.vibe || selections.vibe;
    const budget = parsed.budget || selections.budget;
    const access = parsed.access || selections.access;
    const flow = parsed.flow || selections.flow;
    const group = parsed.group || parseInt(selections.group, 10) || 4;
    const mode = parsed.occasion === 'general' ? 'dinner-night' : parsed.occasion;
    return {
      question,
      mode,
      cityKey: city,
      cityMarket: marketForCity(city),
      cityLabel: cityLabel(city),
      timing,
      timingLabel: timing === 'weekend' ? 'This weekend' : timing === 'tomorrow' ? 'Tomorrow' : timing === 'tonight' ? 'Tonight' : isIsoDate(timing) ? formatDate(timing) : timing,
      vibe,
      vibeKeywords: vibe ? [vibe] : [selections.vibe].filter(Boolean),
      occasion: mode === 'policy' ? '' : mode,
      occasionLabel: mode === 'birthday' ? 'Birthday' : mode === 'date' ? 'Date night' : mode === 'brunch' ? 'Brunch' : mode === 'club' ? 'Club night' : mode === 'low-key' ? 'Low-key' : 'Night out',
      group,
      budget,
      access,
      accessLabel: access === 'vip/table' ? 'VIP/table' : access === 'wave pass' ? 'Wave Pass' : access === 'guest list' ? 'Guest list' : access === 'tickets' ? 'Tickets' : access === 'reservation' ? 'Reservation' : 'Just exploring',
      flow,
      flowLabel: flow || 'Full night plan',
      customDate,
      customDateLabel: isIsoDate(customDate) ? formatDate(customDate) : '',
      music: text(selections.music || parsed.music || ''),
      policyMode: mode === 'policy' || mode === 'wear' || mode === 'wave-pass'
    };
  }
  function buildSummaryLine(ctx, cards, policySummary) {
    if (policySummary) return policySummary;
    const city = ctx.cityLabel;
    const timing = ctx.timingLabel || 'Tonight';
    const count = cards.length;
    const hint = cards[0] ? cards[0].routeHint : 'WaveBot is building a route from the current inventory.';
    return `Built ${count} routes for ${city}${timing ? ` ${timing.toLowerCase()}` : ''}. ${hint}`;
  }
  function buildCards(ctx) {
    const templates = routeTemplates(ctx.mode);
    const scopedEvents = cityEventPool(ctx);
    const filteredEvents = scopedEvents.filter((event) => eventMatchesTiming(event, ctx));
    const events = filteredEvents.length ? filteredEvents : scopedEvents;
    const venues = cityVenuePool(ctx);
    const rankedEvents = pickTop(events, scoreEvent, ctx, 4);
    const rankedVenues = pickTop(venues, scoreVenue, ctx, 4);
    const topEvent = rankedEvents[0] || null;
    const secondEvent = rankedEvents[1] || rankedEvents[0] || null;
    const topVenue = rankedVenues[0] || null;
    const secondVenue = rankedVenues[1] || rankedVenues[0] || null;
    return {
      timedMatchFound: !!filteredEvents.length,
      cards: templates.map((template, index) => {
      let primaryVenue = topVenue;
      let secondaryVenue = secondVenue;
      let primaryEvent = topEvent;
      let secondaryEvent = secondEvent;
      if (template.kind === 'event') {
        primaryVenue = topVenue || secondVenue;
        primaryEvent = topEvent || secondEvent;
      } else if (template.kind === 'low-key') {
        primaryVenue = topVenue || secondVenue;
        secondaryVenue = secondVenue || topVenue;
        primaryEvent = secondEvent || topEvent;
      }
      return makePlanCard(template, ctx, primaryVenue, secondaryVenue, primaryEvent, secondaryEvent, index);
      })
    };
  }
  function routeFromQuestion(rawQuestion) {
    const ctx = buildContext(rawQuestion);
    if (ctx.policyMode) {
      const answer = policyAnswer(ctx.mode, ctx);
      return {
        ctx,
        cards: [],
        summary: answer.summary
      };
    }
    const bundle = buildCards(ctx);
    return {
      ctx,
      cards: bundle.cards,
      summary: buildSummaryLine(ctx, bundle.cards),
      note: bundle.timedMatchFound ? '' : 'I did not find a perfect timed event match, so I built a venue-first route from WTW inventory.'
    };
  }
  function setActiveChips(groupId, value) {
    const nodes = document.querySelectorAll(`[data-chip-group="${groupId}"] .chip-btn`);
    nodes.forEach((node) => {
      const active = lower(node.dataset.value) === lower(value);
      node.classList.toggle('active', active);
      node.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }
  function renderChipGroup(container, groupId, values, selected, onPick) {
    const root = $(container);
    if (!root) return;
    root.innerHTML = values.map((value) => `<button class="chip-btn${lower(selected) === lower(value) ? ' active' : ''}" data-chip-group="${groupId}" data-value="${escapeHtml(value)}" type="button" aria-pressed="${lower(selected) === lower(value)}">${escapeHtml(value)}</button>`).join('');
    root.querySelectorAll('.chip-btn').forEach((button) => {
      button.addEventListener('click', () => onPick(button.dataset.value));
    });
  }
  function renderQuickPrompts() {
    const root = $('quickPrompts');
    if (!root) return;
    root.innerHTML = QUICK_PROMPTS.map((prompt) => `<button class="prompt-pill" type="button" data-prompt="${escapeHtml(prompt)}">${escapeHtml(prompt)}</button>`).join('');
    root.querySelectorAll('[data-prompt]').forEach((button) => {
      button.addEventListener('click', () => {
        els.prompt.value = button.dataset.prompt;
        planFromInput(true);
      });
    });
  }
  function renderPlannerChips() {
    renderChipGroup('cityChips', 'city', CITY_CHIPS, state.selections.city, (value) => {
      state.selections.city = normalizeCityInput(value);
      setActiveChips('city', state.selections.city);
      syncStateToStorage();
      renderInputSuffix();
    });
    renderChipGroup('timingChips', 'timing', TIMING_CHIPS, state.selections.timing, (value) => {
      state.selections.timing = lower(value).includes('weekend') ? 'weekend' : lower(value);
      setActiveChips('timing', state.selections.timing);
      syncStateToStorage();
      renderInputSuffix();
    });
    renderChipGroup('vibeChips', 'vibe', VIBE_CHIPS, state.selections.vibe, (value) => {
      state.selections.vibe = text(value);
      syncStateToStorage();
      setActiveChips('vibe', state.selections.vibe);
      renderInputSuffix();
    });
    renderChipGroup('groupChips', 'group', GROUP_CHIPS, state.selections.group, (value) => {
      state.selections.group = text(value);
      syncStateToStorage();
      setActiveChips('group', state.selections.group);
      renderInputSuffix();
    });
    renderChipGroup('budgetChips', 'budget', BUDGET_CHIPS, state.selections.budget, (value) => {
      state.selections.budget = text(value);
      syncStateToStorage();
      setActiveChips('budget', state.selections.budget);
      renderInputSuffix();
    });
    renderChipGroup('accessChips', 'access', ACCESS_CHIPS, state.selections.access, (value) => {
      state.selections.access = text(value);
      syncStateToStorage();
      setActiveChips('access', state.selections.access);
      renderInputSuffix();
    });
    renderChipGroup('flowChips', 'flow', FLOW_CHIPS, state.selections.flow, (value) => {
      state.selections.flow = text(value);
      syncStateToStorage();
      setActiveChips('flow', state.selections.flow);
      renderInputSuffix();
    });
  }
  function renderInputSuffix() {
    const city = cityLabel(state.selections.city);
    const timing = state.selections.timing === 'weekend' ? 'this weekend' : state.selections.timing;
    const vibe = state.selections.vibe;
    const group = state.selections.group;
    const budget = state.selections.budget;
    const access = state.selections.access;
    const suffix = [city, timing, vibe, `${group} guests`, budget, access].filter(Boolean).join(' · ');
    if (els.statusLine) {
      els.statusLine.textContent = `WaveBot reads public events and venues only. Private request tables stay protected. ${suffix ? `Current planner state: ${suffix}.` : ''}`;
    }
  }
  function syncStateToStorage() {
    try {
      localStorage.setItem('wtwSelectedCity', state.selections.city);
      sessionStorage.setItem(STATE_KEYS.selectedCity, state.selections.city);
      sessionStorage.setItem(STATE_KEYS.selectedVibe, state.selections.vibe);
    } catch (error) {
      void error;
    }
  }
  function persistBundle(bundle) {
    state.lastBundle = bundle;
    try {
      sessionStorage.setItem(STATE_KEYS.lastPlan, JSON.stringify(bundle));
    } catch (error) {
      void error;
    }
  }
  function renderWelcome() {
    if (els.responseNote) els.responseNote.textContent = state.sourceNote;
    if (els.responseSummary) {
      els.responseSummary.innerHTML = `
        <div class="summary-line">Tell me the city, vibe, group size, and timing.</div>
        <div class="summary-line" style="color:rgba(242,238,232,.72);font-size:15px">I’ll build a few WTW routes for the night.</div>
      `;
    }
    if (els.planGrid) els.planGrid.innerHTML = '';
  }
  function renderPolicyAnswer(summary) {
    if (els.responseSummary) {
      els.responseSummary.innerHTML = `<div class="summary-line">${escapeHtml(summary)}</div>`;
    }
    if (els.planGrid) els.planGrid.innerHTML = '';
  }
  function renderPlans(summary, cards, ctx) {
    if (els.responseNote) {
      els.responseNote.textContent = state.sourceNote;
    }
    if (els.responseSummary) {
      const meta = [ctx.cityLabel, ctx.timingLabel, ctx.occasionLabel, ctx.flowLabel, ctx.accessLabel].filter(Boolean).join(' · ');
      els.responseSummary.innerHTML = `
        <div class="summary-line">${escapeHtml(summary)}</div>
        <div class="summary-line" style="color:rgba(242,238,232,.66);font-size:14px">${escapeHtml(meta)}${ctx.customDateLabel ? ` · ${escapeHtml(ctx.customDateLabel)}` : ''}</div>
      `;
    }
    if (els.planGrid) {
      els.planGrid.innerHTML = cards.map((card) => {
        const classes = ['plan-card'];
        if (card.bestMatch) classes.push('best');
        const venueBtn = card.cards.venueHref ? `<a class="card-btn" href="${escapeHtml(card.cards.venueHref)}">View Venue</a>` : '';
        const eventBtn = card.cards.eventHref ? `<a class="card-btn" href="${escapeHtml(card.cards.eventHref)}">View Event</a>` : '';
        const accessBtn = `<a class="card-btn primary" href="${escapeHtml(card.cards.accessHref)}">Request Access</a>`;
        const passBtn = `<a class="card-btn" href="${escapeHtml(card.cards.wavePassHref)}">Join Wave Pass</a>`;
        const refineBtn = `<button class="card-btn" type="button" data-refine-plan="1">Refine Plan</button>`;
        return `
          <article class="${classes.join(' ')}">
            <div class="plan-head">
              <div>
                <div class="plan-kicker">Route ${card.order}</div>
                <h3 class="plan-title">${escapeHtml(card.title)}</h3>
              </div>
              ${card.bestMatch ? '<span class="best-badge">BEST MATCH</span>' : `<span class="small-chip">${escapeHtml(card.city)}</span>`}
            </div>
            ${card.bestMatch ? `<div class="best-reason">${escapeHtml(card.bestReason)}</div>` : ''}
            <div class="route-line"><span>Route</span> <strong>${escapeHtml(card.flow)}</strong></div>
            <div class="plan-chipline">
              <span class="small-chip">Best for ${escapeHtml(card.vibe)}</span>
              <span class="small-chip">${escapeHtml(card.spend)}</span>
              <span class="small-chip">${escapeHtml(card.city)}</span>
            </div>
            <div class="plan-copy short">
              <div><strong>Suggested start</strong><br>${escapeHtml(card.primaryLine)}</div>
              <div><strong>Next move</strong><br>${escapeHtml(card.secondaryLine)}</div>
              <div><strong>Why it works</strong><br>${escapeHtml(card.routeHint)}</div>
            </div>
            <div class="plan-actions">
              ${accessBtn}
              ${venueBtn}
              ${eventBtn}
              ${passBtn}
              ${refineBtn}
            </div>
          </article>
        `;
      }).join('');
    }
    if (els.inventoryNote) {
      els.inventoryNote.textContent = state.sourceNote;
    }
  }
  function planFromInput(forceScroll) {
    const rawQuestion = els.prompt.value || '';
    const parsed = parsePrompt(rawQuestion);
    if (parsed.city) state.selections.city = parsed.city;
    if (parsed.timing) state.selections.timing = parsed.timing;
    if (parsed.vibe) state.selections.vibe = parsed.vibe;
    if (parsed.group) state.selections.group = String(parsed.group >= 8 ? '8+' : parsed.group);
    if (parsed.budget) state.selections.budget = parsed.budget;
    if (parsed.access) state.selections.access = parsed.access;
    if (parsed.flow) state.selections.flow = parsed.flow;
    if (parsed.customDate) state.selections.customDate = parsed.customDate;
    state.selections.prompt = rawQuestion;
    syncStateToStorage();
    renderPlannerChips();
    const loading = `${state.sourceNote} WaveBot is building your route...`;
    if (els.responseSummary) {
      els.responseSummary.innerHTML = `<div class="summary-line">${escapeHtml(loading)}</div>`;
    }
    if (els.planGrid) els.planGrid.innerHTML = '';
    const run = () => {
      const ctx = buildContext(rawQuestion);
      if (ctx.policyMode) {
        const answer = policyAnswer(ctx.mode, ctx);
        renderPolicyAnswer(answer.summary);
        persistBundle({ question: rawQuestion, ctx, answer, cards: [], createdAt: new Date().toISOString() });
        if (forceScroll && els.responseSummary) els.responseSummary.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      const result = routeFromQuestion(rawQuestion);
      const summary = result.note ? `${result.summary} ${result.note}` : result.summary;
      renderPlans(summary, result.cards, result.ctx);
      persistBundle({
        question: rawQuestion,
        ctx: result.ctx,
        summary,
        cards: result.cards,
        createdAt: new Date().toISOString(),
        source: state.usingFallback ? 'fallback' : 'supabase'
      });
      if (forceScroll && els.responseSummary) els.responseSummary.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    window.setTimeout(run, 180);
  }
  function loadLiveInventory() {
    const loader = window.WTWBackend;
    const live = loader && typeof loader.fetchPublicEvents === 'function' && typeof loader.fetchPublicVenues === 'function';
    const fallback = window.WTW_WAVEBOT_FALLBACK || { events: [], venues: [] };
    if (!live) {
      state.inventory = normalizeInventory(fallback);
      state.usingFallback = true;
      state.sourceNote = FALLBACK_NOTE;
      state.loaded = true;
      renderWelcome();
      renderPlannerChips();
      renderInputSuffix();
      return Promise.resolve();
    }
    return Promise.all([
      loader.fetchPublicEvents().catch(() => []),
      loader.fetchPublicVenues().catch(() => [])
    ]).then(([events, venues]) => {
      const liveEvents = Array.isArray(events) ? events : [];
      const liveVenues = Array.isArray(venues) ? venues : [];
      const useFallbackEvents = !liveEvents.length;
      const useFallbackVenues = !liveVenues.length;
      const finalEvents = useFallbackEvents ? (fallback.events || []) : liveEvents;
      const finalVenues = useFallbackVenues ? (fallback.venues || []) : liveVenues;
      state.inventory = normalizeInventory({ events: finalEvents, venues: finalVenues });
      state.usingFallback = useFallbackEvents || useFallbackVenues;
      state.sourceNote = state.usingFallback ? FALLBACK_NOTE : 'WaveBot is reading live public inventory.';
      state.loaded = true;
      renderWelcome();
      renderPlannerChips();
      renderInputSuffix();
    }).catch(() => {
      state.inventory = normalizeInventory(fallback);
      state.usingFallback = true;
      state.sourceNote = FALLBACK_NOTE;
      state.loaded = true;
      renderWelcome();
      renderPlannerChips();
      renderInputSuffix();
    });
  }
  function bindUI() {
    els.prompt = $('wavebotPrompt');
    els.planButton = $('planButton');
    els.quickButton = $('quickButton');
    els.responseSummary = $('responseSummary');
    els.responseNote = $('responseNote');
    els.planGrid = $('planGrid');
    els.inventoryNote = $('inventoryNote');
    els.statusLine = $('statusLine');
    els.customDate = $('customDate');
    els.musicNote = $('musicNote');

    els.planButton.addEventListener('click', () => planFromInput(true));
    els.quickButton.addEventListener('click', () => {
      const target = $('quickPrompts');
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      els.prompt.focus();
    });
    document.addEventListener('click', (event) => {
      const button = event.target && event.target.closest ? event.target.closest('[data-refine-plan]') : null;
      if (!button) return;
      const target = $('wavebotPrompt');
      if (target) {
        target.focus();
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
    els.prompt.addEventListener('keydown', (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        planFromInput(true);
      }
    });
    els.customDate.addEventListener('change', (event) => {
      state.selections.customDate = text(event.target.value);
      syncStateToStorage();
      renderInputSuffix();
    });
    els.musicNote.addEventListener('input', (event) => {
      state.selections.music = text(event.target.value);
      syncStateToStorage();
      renderInputSuffix();
    });
  }
  function init() {
    document.documentElement.classList.toggle('wtw-compact', window.innerWidth < 1120);
    bindUI();
    renderQuickPrompts();
    renderPlannerChips();
    renderInputSuffix();
    const savedCity = localStorage.getItem('wtwSelectedCity');
    if (savedCity) state.selections.city = normalizeCityInput(savedCity);
    const queryCity = resolveQueryCity();
    if (queryCity) state.selections.city = normalizeCityInput(queryCity);
    setTimeout(() => {
      setActiveChips('city', state.selections.city);
      setActiveChips('timing', state.selections.timing);
      setActiveChips('vibe', state.selections.vibe);
      setActiveChips('group', state.selections.group);
      setActiveChips('budget', state.selections.budget);
      setActiveChips('access', state.selections.access);
      setActiveChips('flow', state.selections.flow);
      els.customDate.value = state.selections.customDate || '';
      els.musicNote.value = state.selections.music || '';
      const prompt = `${cityLabel(state.selections.city)} · ${state.selections.timing} · ${state.selections.vibe} · ${state.selections.group} guests`;
      els.prompt.value = prompt;
      syncStateToStorage();
      renderInputSuffix();
      loadLiveInventory().then(() => {
        if (!state.loaded) renderWelcome();
      });
    }, 0);
  }
  document.addEventListener('DOMContentLoaded', init);
})();
