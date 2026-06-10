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
    wavePassRequests: 'wave_pass_requests',
    partners: 'partners',
    partnerUsers: 'partner_users',
    requestAssignments: 'request_assignments',
    customerConfirmations: 'customer_confirmations',
    confirmationDeliveries: 'confirmation_deliveries'
  });
  const RECORD_TYPES = Object.freeze({
    reservation: 'reservation',
    guest_list: 'guest_list',
    ticket: 'ticket',
    wave_pass: 'wave_pass',
    partner_application: 'partner_application'
  });
  const ROUTABLE_REQUEST_TYPES = Object.freeze([
    'reservation',
    'guest_list',
    'vip_table',
    'ticket'
  ]);
  const PARTNER_ROLES = Object.freeze([
    'owner',
    'manager',
    'reservations',
    'promoter',
    'staff'
  ]);

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
    if (global.__WTW_SUPABASE_CLIENT__) return global.__WTW_SUPABASE_CLIENT__;
    const cfg = getConfig();
    if (!cfg.url || !cfg.anonKey || !hasSupabaseRuntime()) return null;
    const client = global.supabase.createClient(cfg.url, cfg.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
    global.__WTW_SUPABASE_CLIENT__ = client;
    return client;
  }

  function getAuthClientOrThrow() {
    return getClientOrThrow();
  }

  function normalizeRecordType(recordType) {
    return String(recordType || '').trim().toLowerCase();
  }

  function normalizeConfirmationTimeInput(value) {
    const raw = String(value === undefined || value === null ? '' : value).trim();
    if (!raw) return null;
    if (!/^\d{2}:\d{2}:\d{2}$/.test(raw)) return null;
    return raw;
  }

  function formatConfirmationTimeForDisplay(value) {
    const raw = String(value === undefined || value === null ? '' : value).trim();
    if (!raw) return raw;
    const compact = raw.replace(/\s+/g, ' ').toUpperCase();
    const match = compact.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/);
    if (!match) return raw;
    let hour = Number(match[1]);
    const minute = String(match[2]).padStart(2, '0');
    const period = (match[3] || '').toUpperCase();
    if (!Number.isInteger(hour)) return raw;
    if (period) {
      if (hour < 1 || hour > 12) return raw;
      return `${hour}:${minute} ${period}`;
    }
    if (hour === 0) return `12:${minute} AM`;
    if (hour === 12) return `12:${minute} PM`;
    if (hour > 12) return `${hour - 12}:${minute} PM`;
    return `${hour}:${minute} AM`;
  }

  function assertRecordType(recordType) {
    const value = normalizeRecordType(recordType);
    if (!Object.values(RECORD_TYPES).includes(value)) {
      throw new Error('WTW record type must be reservation, guest_list, ticket, wave_pass, or partner_application.');
    }
    return value;
  }

  function assertRoutableRequestType(requestType) {
    const value = String(requestType || '').trim().toLowerCase();
    if (!ROUTABLE_REQUEST_TYPES.includes(value)) {
      throw new Error('WTW request type must be reservation, guest_list, vip_table, or ticket.');
    }
    return value;
  }

  async function getAuthenticatedClientOrThrow() {
    const client = getClientOrThrow();
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    const session = data && data.session;
    if (!session || !session.user) {
      throw new Error('WTW admin session required.');
    }
    return { client, user: session.user };
  }

  async function getSession() {
    const client = getAuthClientOrThrow();
    return client.auth.getSession();
  }

  async function getPartnerSession() {
    return getSession();
  }

  async function signInAdmin(email, password) {
    const client = getAuthClientOrThrow();
    return client.auth.signInWithPassword({ email, password });
  }

  async function signInPartner(email, password) {
    const client = getAuthClientOrThrow();
    return client.auth.signInWithPassword({ email, password });
  }

  async function signOutAdmin() {
    const client = getAuthClientOrThrow();
    return client.auth.signOut();
  }

  async function signOutPartner() {
    const client = getAuthClientOrThrow();
    return client.auth.signOut();
  }

  async function isWtwAdmin() {
    const client = getAuthClientOrThrow();
    const { data, error } = await client.rpc('is_wtw_admin');
    if (error) throw error;
    return !!data;
  }

  async function isWtwPartnerUser() {
    const client = getAuthClientOrThrow();
    const { data, error } = await client.rpc('is_wtw_partner_user');
    if (error) throw error;
    return !!data;
  }

  function isUuidLike(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim());
  }

  function normalizePartnerRole(role) {
    return String(role || '').trim().toLowerCase();
  }

  function assertPartnerRole(role) {
    const value = normalizePartnerRole(role);
    if (!PARTNER_ROLES.includes(value)) {
      throw new Error('WTW partner role must be owner, manager, reservations, promoter, or staff.');
    }
    return value;
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
    const cfg = getConfig();
    if (!cfg.url || !cfg.anonKey) {
      throw new Error('WTW Supabase client is not configured yet. Add WTW_SUPABASE_CONFIG before using request helpers.');
    }
    const response = await fetch(`${cfg.url}/rest/v1/${TABLES.reservationRequests}`, {
      method: 'POST',
      headers: {
        apikey: cfg.anonKey,
        Authorization: `Bearer ${cfg.anonKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      throw new Error(await response.text());
    }
    const data = await response.json();
    return Array.isArray(data) ? data[0] : data;
  }

  async function createTicketRequest(payload) {
    const cfg = getConfig();
    if (!cfg.url || !cfg.anonKey) {
      throw new Error('WTW Supabase client is not configured yet. Add WTW_SUPABASE_CONFIG before using request helpers.');
    }
    const body = Object.assign({}, payload, {
      user_email: payload.user_email ?? ''
    });
    const response = await fetch(`${cfg.url}/rest/v1/${TABLES.ticketRequests}`, {
      method: 'POST',
      headers: {
        apikey: cfg.anonKey,
        Authorization: `Bearer ${cfg.anonKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      throw new Error(await response.text());
    }
    const data = await response.json();
    return Array.isArray(data) ? data[0] : data;
  }

  async function createGuestListRequest(payload) {
    const cfg = getConfig();
    if (!cfg.url || !cfg.anonKey) {
      throw new Error('WTW Supabase client is not configured yet. Add WTW_SUPABASE_CONFIG before using request helpers.');
    }
    const body = Object.assign({}, payload, {
      user_email: payload.user_email ?? ''
    });
    const response = await fetch(`${cfg.url}/rest/v1/${TABLES.guestListRequests}`, {
      method: 'POST',
      headers: {
        apikey: cfg.anonKey,
        Authorization: `Bearer ${cfg.anonKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      throw new Error(await response.text());
    }
    const data = await response.json();
    return Array.isArray(data) ? data[0] : data;
  }

  async function updateRequestStatus(tableName, id, status) {
    const allowed = new Set([
      TABLES.reservationRequests,
      TABLES.guestListRequests,
      TABLES.ticketRequests,
      TABLES.wavePassRequests,
      TABLES.partnerApplications
    ]);
    if (!allowed.has(tableName)) {
      throw new Error('WTW update helper only allows reservation, guest list, ticket request, Wave Pass, and partner application tables.');
    }
    const cfg = getConfig();
    if (!cfg.url || !cfg.anonKey) {
      throw new Error('WTW Supabase client is not configured yet. Add WTW_SUPABASE_CONFIG before using request helpers.');
    }
    const client = getClientOrThrow();
    const { data, error } = await client
      .from(tableName)
      .update({ status })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async function updatePartnerLevel(id, partnerLevel) {
    const allowed = new Set(['basic', 'preferred', 'signature']);
    const level = String(partnerLevel || '').trim().toLowerCase();
    if (!allowed.has(level)) {
      throw new Error('WTW partner level must be basic, preferred, or signature.');
    }
    const client = getClientOrThrow();
    const { data, error } = await client
      .from(TABLES.partnerApplications)
      .update({ partner_level: level })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async function fetchPartners() {
    const { client } = await getAuthenticatedClientOrThrow();
    const { data, error } = await client
      .from(TABLES.partners)
      .select('id,business_name,business_type,market,website,instagram,partner_level,status,source_application_id,created_at,updated_at')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async function fetchCurrentPartnerMemberships() {
    const { client, user } = await getAuthenticatedClientOrThrow();
    const { data, error } = await client
      .from(TABLES.partnerUsers)
      .select('user_id,partner_id,role,active,created_at')
      .eq('user_id', user.id)
      .eq('active', true)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async function fetchCurrentPartnerProfiles() {
    const memberships = await fetchCurrentPartnerMemberships();
    const partnerIds = Array.from(new Set(memberships.map(function(row){
      return String(row && row.partner_id || '').trim();
    }).filter(Boolean)));
    if (!partnerIds.length) return [];
    const { client } = await getAuthenticatedClientOrThrow();
    const { data, error } = await client
      .from(TABLES.partners)
      .select('id,business_name,business_type,market,website,instagram,partner_level,status,created_at,updated_at')
      .in('id', partnerIds)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async function fetchPartnerUsers(partnerId) {
    const id = String(partnerId || '').trim();
    if (!id) throw new Error('WTW partner user lookup requires a partner id.');
    const { client } = await getAuthenticatedClientOrThrow();
    const { data, error } = await client
      .from(TABLES.partnerUsers)
      .select('user_id,partner_id,role,active,created_at')
      .eq('partner_id', id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async function addPartnerUser(partnerId, userId, role, active) {
    const pid = String(partnerId || '').trim();
    const uid = String(userId || '').trim();
    if (!isUuidLike(pid)) throw new Error('WTW partner id must be a valid UUID.');
    if (!isUuidLike(uid)) throw new Error('WTW Auth user id must be a valid UUID.');
    const normalizedRole = assertPartnerRole(role);
    const { client } = await getAuthenticatedClientOrThrow();
    const partnerResult = await client
      .from(TABLES.partners)
      .select('id,status')
      .eq('id', pid)
      .maybeSingle();
    if (partnerResult.error) throw partnerResult.error;
    if (!partnerResult.data) {
      throw new Error('WTW partner not found.');
    }
    const partnerStatus = String(partnerResult.data.status || '').trim().toLowerCase();
    if (partnerStatus !== 'pending_setup' && partnerStatus !== 'active') {
      throw new Error('WTW partner must be pending_setup or active before linking users.');
    }
    const payload = {
      user_id: uid,
      partner_id: pid,
      role: normalizedRole,
      active: active === undefined ? true : !!active
    };
    const { data, error } = await client
      .from(TABLES.partnerUsers)
      .upsert(payload, { onConflict: 'user_id,partner_id' })
      .select('user_id,partner_id,role,active,created_at')
      .single();
    if (error) throw error;
    return data;
  }

  async function fetchPartnersForRouting(market) {
    const partners = await fetchPartners();
    const requestMarket = String(market || '').trim().toLowerCase();
    const active = partners.filter(function(row){
      const status = String(row && row.status || '').trim().toLowerCase();
      return status === 'pending_setup' || status === 'active';
    });
    const scoped = requestMarket
      ? active.filter(function(row){
          return String(row && row.market || '').trim().toLowerCase().toLowerCase() === requestMarket;
        })
      : active.slice();
    const source = scoped.length ? scoped : active;
    const levelOrder = { signature: 0, preferred: 1, basic: 2 };
    return source.sort(function(a, b){
      const am = String(a && a.market || '').trim().toLowerCase() === requestMarket ? 0 : 1;
      const bm = String(b && b.market || '').trim().toLowerCase() === requestMarket ? 0 : 1;
      if (am !== bm) return am - bm;
      const al = levelOrder[String(a && a.partner_level || '').trim().toLowerCase()] ?? 3;
      const bl = levelOrder[String(b && b.partner_level || '').trim().toLowerCase()] ?? 3;
      if (al !== bl) return al - bl;
      const an = String(a && a.business_name || '').localeCompare(String(b && b.business_name || ''));
      if (an !== 0) return an;
      return String(a && a.id || '').localeCompare(String(b && b.id || ''));
    });
  }

  async function fetchRequestAssignments() {
    const { client } = await getAuthenticatedClientOrThrow();
    const { data, error } = await client
      .from(TABLES.requestAssignments)
      .select('id,request_type,request_id,partner_id,assigned_venue_id,routed_at,routed_by,internal_status,partner_status,partner_response_at,partner_response_by,metadata,created_at,updated_at')
      .order('routed_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async function fetchAssignmentsForRequest(requestType, requestId) {
    const rt = assertRoutableRequestType(requestType);
    const rid = String(requestId || '').trim();
    if (!rid) throw new Error('WTW assignment lookup requires a request id.');
    const { client } = await getAuthenticatedClientOrThrow();
    const { data, error } = await client
      .from(TABLES.requestAssignments)
      .select('id,request_type,request_id,partner_id,assigned_venue_id,routed_at,routed_by,internal_status,partner_status,partner_response_at,partner_response_by,metadata,created_at,updated_at')
      .eq('request_type', rt)
      .eq('request_id', rid)
      .order('routed_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async function routeRequestToPartner(requestType, requestId, partnerId, assignedVenueId) {
    const rt = assertRoutableRequestType(requestType);
    const rid = String(requestId || '').trim();
    const pid = String(partnerId || '').trim();
    const vid = assignedVenueId === undefined || assignedVenueId === null || String(assignedVenueId).trim() === '' ? null : String(assignedVenueId).trim();
    if (!rid) throw new Error('WTW routing requires a request id.');
    if (!pid) throw new Error('WTW routing requires a partner id.');
    const { client } = await getAuthenticatedClientOrThrow();
    const { data, error } = await client.rpc('route_request_to_partner', {
      p_request_type: rt,
      p_request_id: rid,
      p_partner_id: pid,
      p_assigned_venue_id: vid
    });
    if (error) throw error;
    return data;
  }

  async function respondToPartnerAssignment(assignmentId, action, alternativeNote) {
    const id = String(assignmentId || '').trim();
    const act = String(action || '').trim().toLowerCase();
    const note = alternativeNote === undefined || alternativeNote === null ? null : String(alternativeNote).trim();
    if (!id) throw new Error('WTW partner response requires an assignment id.');
    if (!act) throw new Error('WTW partner response requires an action.');
    const allowed = new Set(['accept', 'decline', 'suggest_alternative', 'update_alternative', 'mark_completed']);
    if (!allowed.has(act)) {
      throw new Error('WTW partner response action is not allowed.');
    }
    const { client } = await getAuthenticatedClientOrThrow();
    const { data, error } = await client.rpc('respond_to_partner_assignment', {
      p_assignment_id: id,
      p_action: act,
      p_alternative_note: note && note.length ? note : null
    });
    if (error) throw error;
    return data;
  }

  async function fetchPartnerByApplication(applicationId) {
    const id = String(applicationId || '').trim();
    if (!id) throw new Error('WTW partner lookup requires an application id.');
    const { client } = await getAuthenticatedClientOrThrow();
    const { data, error } = await client
      .from(TABLES.partners)
      .select('id,business_name,business_type,market,website,instagram,partner_level,status,source_application_id,created_at,updated_at')
      .eq('source_application_id', id)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  async function convertPartnerApplication(applicationId) {
    const id = String(applicationId || '').trim();
    if (!id) throw new Error('WTW partner conversion requires an application id.');
    const { client } = await getAuthenticatedClientOrThrow();
    const { data, error } = await client.rpc('convert_partner_application', { p_application_id: id });
    if (error) throw error;
    return data;
  }

  async function fetchPartnerRoutedRequests() {
    const { client } = await getAuthenticatedClientOrThrow();
    const { data, error } = await client.rpc('get_partner_routed_requests');
    if (error) throw error;
    return data || [];
  }

  async function createPartnerApplication(payload) {
    return insert(TABLES.partnerApplications, payload);
  }

  async function createWavePassRequest(payload) {
    return insert(TABLES.wavePassRequests, payload);
  }

  async function fetchInternalNotes(recordType, recordId) {
    const rt = assertRecordType(recordType);
    const rid = String(recordId || '').trim();
    if (!rid) throw new Error('WTW internal notes require a record id.');
    const { client } = await getAuthenticatedClientOrThrow();
    const { data, error } = await client
      .from('internal_notes')
      .select('id,record_type,record_id,body,created_by,created_at')
      .eq('record_type', rt)
      .eq('record_id', rid)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async function createInternalNote(recordType, recordId, body) {
    const rt = assertRecordType(recordType);
    const rid = String(recordId || '').trim();
    const note = String(body || '').trim();
    if (!rid) throw new Error('WTW internal notes require a record id.');
    if (!note) throw new Error('WTW internal notes cannot be empty.');
    const { client, user } = await getAuthenticatedClientOrThrow();
    const { data, error } = await client
      .from('internal_notes')
      .insert({
        record_type: rt,
        record_id: rid,
        body: note,
        created_by: user.id
      })
      .select('id,record_type,record_id,body,created_by,created_at')
      .single();
    if (error) throw error;
    return data;
  }

  async function fetchActivityLog(recordType, recordId) {
    const rt = assertRecordType(recordType);
    const rid = String(recordId || '').trim();
    if (!rid) throw new Error('WTW activity log requires a record id.');
    const { client } = await getAuthenticatedClientOrThrow();
    const { data, error } = await client
      .from('activity_log')
      .select('id,record_type,record_id,action,from_status,to_status,metadata,created_by,created_at')
      .eq('record_type', rt)
      .eq('record_id', rid)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async function createActivityLog(recordType, recordId, action, fromStatus, toStatus, metadata) {
    const rt = assertRecordType(recordType);
    const rid = String(recordId || '').trim();
    const act = String(action || '').trim();
    if (!rid) throw new Error('WTW activity log requires a record id.');
    if (!act) throw new Error('WTW activity log requires an action.');
    const meta = metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {};
    const { client, user } = await getAuthenticatedClientOrThrow();
    const { data, error } = await client
      .from('activity_log')
      .insert({
        record_type: rt,
        record_id: rid,
        action: act,
        from_status: fromStatus === undefined || fromStatus === null || fromStatus === '' ? null : String(fromStatus),
        to_status: toStatus === undefined || toStatus === null || toStatus === '' ? null : String(toStatus),
        metadata: meta,
        created_by: user.id
      })
      .select('id,record_type,record_id,action,from_status,to_status,metadata,created_by,created_at')
      .single();
    if (error) throw error;
    return data;
  }

  async function confirmCustomerRequest(requestType, requestId, assignmentId, confirmedDate, confirmedTime, customerMessage, accessInstructions, supportNotes) {
    const rt = assertRoutableRequestType(requestType);
    const rid = String(requestId || '').trim();
    const aid = assignmentId === undefined || assignmentId === null || String(assignmentId).trim() === '' ? null : String(assignmentId).trim();
    if (!rid) throw new Error('WTW customer confirmation requires a request id.');
    if (aid && !isUuidLike(aid)) {
      throw new Error('WTW customer confirmation assignment id must be a valid UUID.');
    }
    const { client } = await getAuthenticatedClientOrThrow();
    const { data, error } = await client.rpc('confirm_customer_request', {
      p_request_type: rt,
      p_request_id: rid,
      p_assignment_id: aid,
      p_confirmed_date: confirmedDate === undefined || confirmedDate === null || String(confirmedDate).trim() === '' ? null : String(confirmedDate).trim(),
      p_confirmed_time: normalizeConfirmationTimeInput(confirmedTime),
      p_customer_message: customerMessage === undefined || customerMessage === null || String(customerMessage).trim() === '' ? null : String(customerMessage).trim(),
      p_access_instructions: accessInstructions === undefined || accessInstructions === null || String(accessInstructions).trim() === '' ? null : String(accessInstructions).trim(),
      p_support_notes: supportNotes === undefined || supportNotes === null || String(supportNotes).trim() === '' ? null : String(supportNotes).trim()
    });
    if (error) throw error;
    return Array.isArray(data) ? (data[0] || null) : (data || null);
  }

  async function fetchCustomerConfirmationForRequest(requestType, requestId) {
    const rt = assertRoutableRequestType(requestType);
    const rid = String(requestId || '').trim();
    if (!rid) return null;
    const { client } = await getAuthenticatedClientOrThrow();
    const { data, error } = await client
      .from(TABLES.customerConfirmations)
      .select('id,confirmation_reference,access_token,request_type,request_id,assignment_id,customer_name,customer_email,customer_phone,market,venue_name,event_title,confirmed_date,confirmed_time,party_size,quantity,ticket_type,total_amount,confirmation_status,customer_message,access_instructions,support_notes,confirmed_by,confirmed_at,cancelled_at,created_at,updated_at')
      .eq('request_type', rt)
      .eq('request_id', rid)
      .order('updated_at', { ascending: false })
      .limit(1);
    if (error) throw error;
    return data && data[0] ? data[0] : null;
  }

  async function fetchConfirmationDeliveries(confirmationId) {
    const cid = String(confirmationId || '').trim();
    if (!isUuidLike(cid)) return [];
    const { client } = await getAuthenticatedClientOrThrow();
    const { data, error } = await client
      .from(TABLES.confirmationDeliveries)
      .select('id,confirmation_id,channel,provider,destination,delivery_status,provider_message_id,attempt_count,last_attempt_at,sent_at,delivered_at,failed_at,failure_code,failure_message,metadata,created_at,updated_at')
      .eq('confirmation_id', cid)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async function sendConfirmationEmail(confirmationId, resend) {
    const cid = String(confirmationId || '').trim();
    if (!isUuidLike(cid)) {
      throw new Error('WTW confirmation id must be a valid UUID.');
    }
    const { client } = await getAuthenticatedClientOrThrow();
    const { data, error } = await client.functions.invoke('send-confirmation-email', {
      body: {
        confirmation_id: cid,
        resend: !!resend
      }
    });
    if (error) throw error;
    return data || null;
  }

  async function sendConfirmationSms(confirmationId, resend) {
    const cid = String(confirmationId || '').trim();
    if (!isUuidLike(cid)) {
      throw new Error('WTW confirmation id must be a valid UUID.');
    }
    const { client } = await getAuthenticatedClientOrThrow();
    const { data, error } = await client.functions.invoke('send-confirmation-sms', {
      body: {
        confirmation_id: cid,
        resend: !!resend
      }
    });
    if (error) throw error;
    return data || null;
  }

  async function getCustomerConfirmation(accessToken) {
    const token = String(accessToken || '').trim();
    if (!isUuidLike(token)) return null;
    const client = getClientOrThrow();
    const { data, error } = await client.rpc('get_customer_confirmation', { p_access_token: token });
    if (error) throw error;
    const record = Array.isArray(data) ? (data[0] || null) : (data || null);
    if (!record) return null;
    return Object.assign({}, record, {
      confirmed_time: formatConfirmationTimeForDisplay(record.confirmed_time)
    });
  }

  async function fetchAdminSnapshot() {
    const client = getClientOrThrow();
    const [events, venues, reservations, tickets, guestLists, partners, wavePass, permanentPartners, requestAssignments] = await Promise.all([
      client.from(TABLES.events).select('id,title,market,status,created_at').order('created_at', { ascending: false }).limit(20),
      client.from(TABLES.venues).select('id,name,market,status,created_at').order('created_at', { ascending: false }).limit(20),
      client.from(TABLES.reservationRequests).select('id,user_name,market,status,created_at').order('created_at', { ascending: false }).limit(20),
      client.from(TABLES.ticketRequests).select('id,user_name,user_email,phone,event_id,event_title,ticket_type,quantity,total_amount,status,created_at').order('created_at', { ascending: false }),
      client.from(TABLES.guestListRequests).select('id,user_name,event_title,status,created_at').order('created_at', { ascending: false }).limit(20),
      client.from(TABLES.partnerApplications).select('id,business_name,business_type,market,website,instagram,contact_name,contact_role,email,phone,wave_member_offer,partner_level,notes,status,created_at').order('created_at', { ascending: false }).limit(20),
      client.from(TABLES.wavePassRequests).select('id,full_name,market,status,created_at').order('created_at', { ascending: false }).limit(20),
      client.from(TABLES.partners).select('id,business_name,business_type,market,website,instagram,partner_level,status,source_application_id,created_at,updated_at').order('created_at', { ascending: false }),
      client.from(TABLES.requestAssignments).select('id,request_type,request_id,partner_id,assigned_venue_id,routed_at,routed_by,internal_status,partner_status,partner_response_at,partner_response_by,metadata,created_at,updated_at').order('routed_at', { ascending: false })
    ]);

    return {
      events: events.data || [],
      venues: venues.data || [],
      reservations: reservations.data || [],
      ticketRequests: tickets.data || [],
      guestLists: guestLists.data || [],
      partnerApplications: partners.data || [],
      wavePassRequests: wavePass.data || [],
      partners: permanentPartners.data || [],
      requestAssignments: requestAssignments.data || [],
      errors: [events.error, venues.error, reservations.error, tickets.error, guestLists.error, partners.error, wavePass.error, permanentPartners.error, requestAssignments.error].filter(Boolean)
    };
  }

  global.WTWBackend = Object.freeze({
    TABLES,
    getConfig,
    createClient,
    getSession,
    getPartnerSession,
    signInAdmin,
    signInPartner,
    signOutAdmin,
    signOutPartner,
    isWtwAdmin,
    isWtwPartnerUser,
    createReservationRequest,
    createTicketRequest,
    createGuestListRequest,
    updateRequestStatus,
    updatePartnerLevel,
    fetchPartners,
    fetchCurrentPartnerMemberships,
    fetchCurrentPartnerProfiles,
    fetchPartnerUsers,
    addPartnerUser,
    fetchPartnerByApplication,
    convertPartnerApplication,
    fetchRequestAssignments,
    fetchAssignmentsForRequest,
    routeRequestToPartner,
    respondToPartnerAssignment,
    fetchPartnerRoutedRequests,
    fetchPartnersForRouting,
    fetchInternalNotes,
    createInternalNote,
    fetchActivityLog,
    createActivityLog,
    confirmCustomerRequest,
    fetchCustomerConfirmationForRequest,
    fetchConfirmationDeliveries,
    sendConfirmationEmail,
    sendConfirmationSms,
    getCustomerConfirmation,
    createPartnerApplication,
    createWavePassRequest,
    RECORD_TYPES,
    fetchAdminSnapshot
  });
})(window);
