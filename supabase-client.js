/*
  WTW Supabase client placeholder.
  Frontend-safe only: never ship a service role key here.
  This file is designed so the static HTML pages can call a single API layer
  later without changing the request shapes.
*/

(function (global) {
  const TABLES = Object.freeze({
    users: 'users',
    events: 'events',
    venues: 'venues',
    reservationRequests: 'reservation_requests',
    ticketRequests: 'ticket_requests',
    guestListRequests: 'guest_list_requests',
    partnerApplications: 'partner_applications',
    wavePassRequests: 'wave_pass_requests'
  });

  function getConfig() {
    return global.WTW_SUPABASE_CONFIG || {
      url: '',
      anonKey: '',
      debug: true
    };
  }

  function hasSupabaseRuntime() {
    return !!(global.supabase && typeof global.supabase.createClient === 'function');
  }

  function createClient() {
    const cfg = getConfig();
    if (!cfg.url || !cfg.anonKey || !hasSupabaseRuntime()) return null;
    return global.supabase.createClient(cfg.url, cfg.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
  }

  function getClientOrThrow() {
    const client = createClient();
    if (!client) {
      throw new Error('WTW Supabase client is not configured yet. Add WTW_SUPABASE_CONFIG and load the Supabase JS runtime before using request helpers.');
    }
    return client;
  }

  async function insert(table, payload) {
    const client = getClientOrThrow();
    const { data, error } = await client.from(table).insert(payload).select().single();
    if (error) throw error;
    return data;
  }

  async function createReservationRequest(payload) {
    return insert(TABLES.reservationRequests, payload);
  }

  async function createTicketRequest(payload) {
    return insert(TABLES.ticketRequests, payload);
  }

  async function createGuestListRequest(payload) {
    return insert(TABLES.guestListRequests, payload);
  }

  async function createPartnerApplication(payload) {
    return insert(TABLES.partnerApplications, payload);
  }

  async function createWavePassRequest(payload) {
    return insert(TABLES.wavePassRequests, payload);
  }

  async function fetchAdminSnapshot() {
    const client = getClientOrThrow();
    const [events, venues, reservations, tickets, guestLists, partners, wavePass] = await Promise.all([
      client.from(TABLES.events).select('id,title,market,status,created_at').order('created_at', { ascending: false }).limit(20),
      client.from(TABLES.venues).select('id,name,market,status,created_at').order('created_at', { ascending: false }).limit(20),
      client.from(TABLES.reservationRequests).select('id,user_name,market,status,created_at').order('created_at', { ascending: false }).limit(20),
      client.from(TABLES.ticketRequests).select('id,user_name,event_title,status,created_at').order('created_at', { ascending: false }).limit(20),
      client.from(TABLES.guestListRequests).select('id,user_name,event_title,status,created_at').order('created_at', { ascending: false }).limit(20),
      client.from(TABLES.partnerApplications).select('id,business_name,market,status,created_at').order('created_at', { ascending: false }).limit(20),
      client.from(TABLES.wavePassRequests).select('id,full_name,market,status,created_at').order('created_at', { ascending: false }).limit(20)
    ]);

    return {
      events: events.data || [],
      venues: venues.data || [],
      reservations: reservations.data || [],
      ticketRequests: tickets.data || [],
      guestLists: guestLists.data || [],
      partnerApplications: partners.data || [],
      wavePassRequests: wavePass.data || [],
      errors: [events.error, venues.error, reservations.error, tickets.error, guestLists.error, partners.error, wavePass.error].filter(Boolean)
    };
  }

  global.WTWBackend = Object.freeze({
    TABLES,
    getConfig,
    createClient,
    createReservationRequest,
    createTicketRequest,
    createGuestListRequest,
    createPartnerApplication,
    createWavePassRequest,
    fetchAdminSnapshot
  });
})(window);
