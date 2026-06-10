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

function safeText(value: unknown) {
  return String(value === undefined || value === null ? '' : value);
}

function isUuidLike(value: unknown) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim());
}

async function readJson(req: Request) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

function normalizeChannelResult(channel: 'email' | 'sms', responseStatus: number, payload: unknown, fetchError?: string) {
  const envelope = payload && typeof payload === 'object' ? (payload as Record<string, unknown>)[channel] || payload : {};
  const rawStatus = safeText((envelope as Record<string, unknown>).status || (envelope as Record<string, unknown>).delivery_status || '').trim().toLowerCase();
  const reason = safeText((envelope as Record<string, unknown>).reason || (envelope as Record<string, unknown>).error || fetchError || '').trim();
  const providerMessageId = safeText((envelope as Record<string, unknown>).provider_message_id || '').trim();

  let status: 'sent' | 'skipped' | 'failed' = 'failed';
  if (rawStatus === 'sent' || rawStatus === 'delivered') {
    status = 'sent';
  } else if (rawStatus === 'skipped' || rawStatus === 'blocked' || rawStatus === 'not_configured') {
    status = 'skipped';
  } else if (rawStatus === 'failed') {
    status = 'failed';
  } else if (responseStatus >= 200 && responseStatus < 300) {
    status = 'failed';
  }

  const result: Record<string, unknown> = { status };
  if (reason) result.reason = reason;
  if (providerMessageId) result.provider_message_id = providerMessageId;
  return result;
}

async function invokeDeliveryFunction(
  supabaseUrl: string,
  supabaseAnonKey: string,
  authHeader: string,
  functionName: 'send-confirmation-email' | 'send-confirmation-sms',
  confirmationId: string
) {
  const endpoint = `${supabaseUrl.replace(/\/+$/, '')}/functions/v1/${functionName}`;
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        apikey: supabaseAnonKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ confirmation_id: confirmationId, resend: false })
    });
    const payload = await response.json().catch(() => null);
    const channel = functionName === 'send-confirmation-email' ? 'email' : 'sms';
    return normalizeChannelResult(channel, response.status, payload, response.ok ? '' : `HTTP ${response.status}`);
  } catch (err) {
    console.error(`WTW ${functionName} failed:`, err);
    const channel = functionName === 'send-confirmation-email' ? 'email' : 'sms';
    return normalizeChannelResult(channel, 500, null, 'Automatic delivery request failed.');
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const authHeader = req.headers.get('Authorization') || '';
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return json({ error: 'Supabase environment is not configured.' }, 500);
  }

  const payload = await readJson(req);
  const confirmationId = String(payload.confirmation_id || '').trim();
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
    .select('id,confirmation_reference')
    .eq('id', confirmationId)
    .maybeSingle();
  if (confirmationError) {
    return json({ error: 'Could not load customer confirmation.' }, 500);
  }
  if (!confirmation) {
    return json({ error: 'Customer confirmation not found.' }, 404);
  }

  const attemptedAt = new Date().toISOString();
  const [emailSettled, smsSettled] = await Promise.allSettled([
    invokeDeliveryFunction(supabaseUrl, supabaseAnonKey, authHeader, 'send-confirmation-email', confirmationId),
    invokeDeliveryFunction(supabaseUrl, supabaseAnonKey, authHeader, 'send-confirmation-sms', confirmationId)
  ]);

  const email = emailSettled.status === 'fulfilled'
    ? emailSettled.value
    : normalizeChannelResult('email', 500, null, 'Automatic email delivery failed.');
  const sms = smsSettled.status === 'fulfilled'
    ? smsSettled.value
    : normalizeChannelResult('sms', 500, null, 'Automatic SMS delivery failed.');

  return json({
    confirmation_reference: confirmation.confirmation_reference,
    attempted_at: attemptedAt,
    email,
    sms
  });
});
