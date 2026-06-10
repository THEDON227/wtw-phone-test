import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
  });
}

function isUuidLike(value: unknown) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim());
}

function safeText(value: unknown) {
  return String(value === undefined || value === null ? '' : value);
}

function formatDate(value: unknown) {
  const raw = safeText(value).trim();
  if (!raw) return '';
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return raw;
  const dt = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (Number.isNaN(dt.getTime())) return raw;
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(dt);
}

function formatTime12(value: unknown) {
  const raw = safeText(value).trim();
  if (!raw) return '';
  const match = raw.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return raw;
  let hour = Number(match[1]);
  const minute = match[2];
  const period = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12 || 12;
  return `${hour}:${minute} ${period}`;
}

function buildConfirmationUrl(baseUrl: string, token: string) {
  const base = new URL(baseUrl);
  return new URL(`/confirmation.html?token=${encodeURIComponent(token)}`, base).toString();
}

function normalizeSmsPhone(value: unknown) {
  const raw = safeText(value).trim();
  if (!raw) {
    return {
      kind: 'missing' as const,
      normalized: '',
      display: '',
      reason: 'No customer phone number available.',
      failureCode: 'missing_customer_phone'
    };
  }

  const cleaned = raw.replace(/[\s().-]/g, '');
  if (cleaned.startsWith('+')) {
    if (!/^\+[1-9]\d{7,14}$/.test(cleaned)) {
      return {
        kind: 'invalid' as const,
        normalized: '',
        display: raw,
        reason: 'Customer phone number needs review.',
        failureCode: 'invalid_phone_number'
      };
    }
    return {
      kind: 'valid' as const,
      normalized: cleaned,
      display: cleaned,
      reason: '',
      failureCode: ''
    };
  }

  if (/^\d{10}$/.test(cleaned)) {
    return {
      kind: 'valid' as const,
      normalized: `+1${cleaned}`,
      display: `+1${cleaned}`,
      reason: '',
      failureCode: ''
    };
  }

  if (/^\d{11}$/.test(cleaned) && cleaned.startsWith('1')) {
    return {
      kind: 'valid' as const,
      normalized: `+${cleaned}`,
      display: `+${cleaned}`,
      reason: '',
      failureCode: ''
    };
  }

  return {
    kind: 'invalid' as const,
    normalized: '',
    display: raw,
    reason: 'Customer phone number needs review.',
    failureCode: 'invalid_phone_number'
  };
}

async function readJson(req: Request) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const authHeader = req.headers.get('Authorization') || '';
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID') || '';
  const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN') || '';
  const twilioMessagingServiceSid = Deno.env.get('TWILIO_MESSAGING_SERVICE_SID') || '';
  const twilioFromNumber = Deno.env.get('TWILIO_FROM_NUMBER') || '';
  const publicBaseUrl = Deno.env.get('WTW_PUBLIC_BASE_URL') || '';
  const fromInfo = twilioFromNumber ? normalizeSmsPhone(twilioFromNumber) : null;

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return json({ error: 'Supabase environment is not configured.' }, 500);
  }

  const payload = await readJson(req);
  const confirmationId = String(payload.confirmation_id || '').trim();
  const resend = !!payload.resend;
  if (!isUuidLike(confirmationId)) {
    return json({ error: 'confirmation_id must be a valid UUID.' }, 400);
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  });
  const { data: userData, error: userError } = await authClient.auth.getUser();
  if (userError || !userData?.user) {
    return json({ error: 'WTW admin session required.' }, 401);
  }
  const { data: isAdmin, error: adminError } = await authClient.rpc('is_wtw_admin');
  if (adminError || !isAdmin) {
    return json({ error: 'WTW admin session required.' }, 403);
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);
  const { data: confirmation, error: confirmationError } = await adminClient
    .from('customer_confirmations')
    .select('id,confirmation_reference,access_token,customer_phone,venue_name,event_title,confirmed_date,confirmed_time,party_size,quantity,request_type')
    .eq('id', confirmationId)
    .maybeSingle();

  if (confirmationError) {
    return json({ error: 'Could not load customer confirmation.' }, 500);
  }
  if (!confirmation) {
    return json({ error: 'Customer confirmation not found.' }, 404);
  }

  const phoneInfo = normalizeSmsPhone(confirmation.customer_phone);
  const destinationPhone = phoneInfo.kind === 'valid'
    ? phoneInfo.normalized
    : phoneInfo.kind === 'invalid'
      ? phoneInfo.display || null
      : null;
  const venueOrEvent = safeText(confirmation.venue_name || confirmation.event_title || 'Your WTW Night').trim();
  const confirmedDate = formatDate(confirmation.confirmed_date);
  const confirmedTime = formatTime12(confirmation.confirmed_time);
  const secureLink = buildConfirmationUrl(publicBaseUrl, safeText(confirmation.access_token).trim());
  const smsBody = [
    `Your WTW night at ${venueOrEvent} is confirmed for ${confirmedDate} at ${confirmedTime}.`,
    `Reference: ${safeText(confirmation.confirmation_reference).trim()}`,
    `View: ${secureLink}`
  ].join('\n');

  const { data: existingDelivery, error: deliveryLoadError } = await adminClient
    .from('confirmation_deliveries')
    .select('id,confirmation_id,channel,provider,destination,delivery_status,provider_message_id,attempt_count,last_attempt_at,sent_at,delivered_at,failed_at,failure_code,failure_message,metadata,created_at,updated_at')
    .eq('confirmation_id', confirmationId)
    .eq('channel', 'sms')
    .maybeSingle();

  if (deliveryLoadError) {
    return json({ error: 'Could not load SMS delivery state.' }, 500);
  }

  let deliveryRow = existingDelivery || null;
  const now = new Date().toISOString();

  async function upsertDelivery(patch: Record<string, unknown>) {
    const base = {
      confirmation_id: confirmationId,
      channel: 'sms',
      provider: null,
      destination: destinationPhone,
      delivery_status: 'pending',
      provider_message_id: null,
      attempt_count: 0,
      last_attempt_at: null,
      sent_at: null,
      delivered_at: null,
      failed_at: null,
      failure_code: null,
      failure_message: null,
      metadata: { source: 'send-confirmation-sms' },
      ...patch
    };

    if (!deliveryRow) {
      const { data, error } = await adminClient
        .from('confirmation_deliveries')
        .insert(base)
        .select('id,confirmation_id,channel,provider,destination,delivery_status,provider_message_id,attempt_count,last_attempt_at,sent_at,delivered_at,failed_at,failure_code,failure_message,metadata,created_at,updated_at')
        .single();
      if (error) throw error;
      deliveryRow = data;
      return data;
    }

    const { data, error } = await adminClient
      .from('confirmation_deliveries')
      .update(base)
      .eq('id', deliveryRow.id)
      .select('id,confirmation_id,channel,provider,destination,delivery_status,provider_message_id,attempt_count,last_attempt_at,sent_at,delivered_at,failed_at,failure_code,failure_message,metadata,created_at,updated_at')
      .single();
    if (error) throw error;
    deliveryRow = data;
    return data;
  }

  async function recordEvent(eventType: string, metadata: Record<string, unknown>) {
    const { error } = await adminClient.from('confirmation_delivery_events').insert({
      confirmation_id: confirmationId,
      delivery_id: deliveryRow?.id || null,
      channel: 'sms',
      event_type: eventType,
      metadata
    });
    if (error) throw error;
  }

  if (phoneInfo.kind === 'missing' || phoneInfo.kind === 'invalid') {
    await upsertDelivery({
      delivery_status: 'skipped',
      provider: null,
      destination: destinationPhone,
      provider_message_id: null,
      failure_code: phoneInfo.failureCode,
      failure_message: phoneInfo.reason,
      metadata: {
        source: 'send-confirmation-sms',
        reason: phoneInfo.failureCode
      }
    });
    await recordEvent('skipped', { reason: phoneInfo.failureCode });
    return json({
      confirmation_reference: confirmation.confirmation_reference,
      sms: {
        status: 'skipped',
        destination: destinationPhone,
        reason: phoneInfo.reason
      }
    });
  }

  const normalizedStatus = safeText(deliveryRow?.delivery_status).trim().toLowerCase();
  if (!resend && ['sent', 'delivered', 'processing'].includes(normalizedStatus)) {
    return json({
      confirmation_reference: confirmation.confirmation_reference,
      sms: {
        status: 'blocked',
        destination: destinationPhone,
        reason: 'SMS already sent. Use resend to intentionally send another copy.'
      }
    });
  }

  if (normalizedStatus === 'processing') {
    return json({
      confirmation_reference: confirmation.confirmation_reference,
      sms: {
        status: 'blocked',
        destination: destinationPhone,
        reason: 'SMS delivery is already processing.'
      }
    });
  }

  if (!twilioAccountSid || !twilioAuthToken || !publicBaseUrl || (!twilioMessagingServiceSid && (!fromInfo || fromInfo.kind !== 'valid'))) {
    await upsertDelivery({
      delivery_status: 'not_configured',
      provider: null,
      destination: destinationPhone,
      failure_code: 'missing_sms_environment',
      failure_message: 'SMS delivery is not configured.',
      metadata: {
        source: 'send-confirmation-sms',
        reason: 'missing_sms_environment'
      }
    });
    await recordEvent('not_configured', { reason: 'missing_sms_environment' });
    return json({
      confirmation_reference: confirmation.confirmation_reference,
      sms: {
        status: 'not_configured',
        destination: destinationPhone,
        reason: 'SMS delivery is not configured.'
      }
    });
  }

  if (!deliveryRow && !resend) {
    await upsertDelivery({
      delivery_status: 'pending',
      destination: destinationPhone,
      metadata: { source: 'send-confirmation-sms' }
    });
  }

  const senderBody = new URLSearchParams();
  senderBody.set('To', destinationPhone);
  senderBody.set('Body', smsBody);
  if (twilioMessagingServiceSid) {
    senderBody.set('MessagingServiceSid', twilioMessagingServiceSid);
  } else {
    senderBody.set('From', fromInfo?.normalized || twilioFromNumber);
  }

  await upsertDelivery({
    delivery_status: 'processing',
    provider: 'twilio',
    destination: destinationPhone,
    attempt_count: Number(deliveryRow?.attempt_count || 0) + 1,
    last_attempt_at: now,
    failure_code: null,
    failure_message: null,
    metadata: {
      ...(deliveryRow?.metadata && typeof deliveryRow.metadata === 'object' && !Array.isArray(deliveryRow.metadata) ? deliveryRow.metadata : {}),
      source: 'send-confirmation-sms',
      resend: !!resend
    }
  });
  await recordEvent('processing', { resend: !!resend });

  const twilioResponse = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(twilioAccountSid)}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
    },
    body: senderBody.toString()
  });

  if (!twilioResponse.ok) {
    let failureCode = `twilio_${twilioResponse.status}`;
    let safeFailure = 'SMS provider request failed.';
    try {
      const body = await twilioResponse.json();
      if (body && typeof body === 'object') {
        const code = Number((body as any).code || 0);
        if (code) failureCode = `twilio_${code}`;
      }
    } catch {
      // ignore parse errors
    }
    await upsertDelivery({
      delivery_status: 'failed',
      provider: 'twilio',
      destination: destinationPhone,
      failed_at: new Date().toISOString(),
      failure_code: failureCode,
      failure_message: safeFailure,
      metadata: {
        ...(deliveryRow?.metadata && typeof deliveryRow.metadata === 'object' && !Array.isArray(deliveryRow.metadata) ? deliveryRow.metadata : {}),
        source: 'send-confirmation-sms',
        resend: !!resend
      }
    });
    await recordEvent('failed', { reason: safeFailure, failure_code: failureCode, resend: !!resend });
    return json({
      confirmation_reference: confirmation.confirmation_reference,
      sms: {
        status: 'failed',
        destination: destinationPhone,
        reason: safeFailure
      }
    });
  }

  const twilioData = await twilioResponse.json().catch(() => ({}));
  const providerMessageId = safeText((twilioData as any)?.sid || '').trim() || null;
  const { data: sentRow, error: sentError } = await adminClient
    .from('confirmation_deliveries')
    .update({
      provider: 'twilio',
      provider_message_id: providerMessageId,
      delivery_status: 'sent',
      sent_at: new Date().toISOString(),
      last_attempt_at: new Date().toISOString(),
      failure_code: null,
      failure_message: null,
      destination: destinationPhone,
      metadata: {
        ...(deliveryRow?.metadata && typeof deliveryRow.metadata === 'object' && !Array.isArray(deliveryRow.metadata) ? deliveryRow.metadata : {}),
        source: 'send-confirmation-sms',
        resend: !!resend,
        provider_message_id: providerMessageId
      }
    })
    .eq('confirmation_id', confirmationId)
    .eq('channel', 'sms')
    .select('id,confirmation_id,channel,provider,destination,delivery_status,provider_message_id,attempt_count,last_attempt_at,sent_at,delivered_at,failed_at,failure_code,failure_message,metadata,created_at,updated_at')
    .single();

  if (sentError) {
    return json({
      confirmation_reference: confirmation.confirmation_reference,
      sms: {
        status: 'sent',
        destination: destinationPhone,
        provider_message_id: providerMessageId,
        sent_at: new Date().toISOString(),
        attempt_count: Number(deliveryRow?.attempt_count || 0) + 1,
        warning: 'SMS was sent, but the delivery record update needs attention.'
      }
    });
  }

  deliveryRow = sentRow;
  await recordEvent('sent', {
    provider: 'twilio',
    provider_message_id: providerMessageId,
    resend: !!resend
  });

  return json({
    confirmation_reference: confirmation.confirmation_reference,
    sms: {
      status: 'sent',
      destination: destinationPhone,
      provider_message_id: providerMessageId,
      sent_at: sentRow.sent_at,
      attempt_count: sentRow.attempt_count
    }
  });
});
