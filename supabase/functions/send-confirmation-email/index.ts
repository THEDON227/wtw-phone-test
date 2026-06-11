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

function escapeHtml(value: unknown) {
  const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return safeText(value).replace(/[&<>"']/g, (ch) => map[ch] || ch);
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
  const base = new URL(baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
  return new URL(`confirmation.html?token=${encodeURIComponent(token)}`, base).toString();
}

function safeBaseUrl() {
  const value = Deno.env.get('WTW_PUBLIC_BASE_URL') || '';
  if (!value.trim()) {
    throw new Error('WTW_PUBLIC_BASE_URL must be configured for confirmation email delivery.');
  }
  return value.trim().replace(/\/+$/, '');
}

function buildSubject(confirmation: any) {
  const venueOrEvent = safeText(confirmation.venue_name || confirmation.event_title || 'Your WTW Night').trim();
  return `Your WTW Night Is Confirmed — ${venueOrEvent.replace(/[\r\n]+/g, ' ')}`;
}

async function buildEmailHtml(payload: {
  confirmation_reference: string;
  customer_name: string;
  venue_or_event: string;
  confirmed_date: string;
  confirmed_time: string;
  amount_label: string;
  amount_value: string;
  customer_message: string;
  access_instructions: string;
  secure_link: string;
  support_email: string;
  logo_url: string;
}) {
  const supportLink = payload.support_email
    ? `<a href="mailto:${escapeHtml(payload.support_email)}" style="color:#00C2D1;text-decoration:none;">WTW Concierge</a>`
    : 'WTW Concierge';
  const customerMessage = safeText(payload.customer_message).trim();
  const accessInstructions = safeText(payload.access_instructions).trim();
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background-color:#070a0e;color:#f0ede8;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#070a0e;font-size:1px;line-height:1px;">
      Your WTW access at ${escapeHtml(payload.venue_or_event || 'your venue')} is confirmed for ${escapeHtml(payload.confirmed_date || 'today')} at ${escapeHtml(payload.confirmed_time || 'the scheduled time')}.
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background-color:#070a0e;width:100%;">
      <tr>
        <td align="center" style="padding:18px 12px 24px;background-color:#070b10;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;max-width:600px;width:100%;">
            <tr>
              <td style="padding:0 0 12px;text-align:center;">
                ${payload.logo_url ? `<img src="${escapeHtml(payload.logo_url)}" width="240" alt="Where's The Wave" style="display:block;width:100%;max-width:240px;height:auto;margin:0 auto;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;" />` : `<div style="margin:0 auto;max-width:240px;text-align:center;"><div style="font-size:30px;line-height:1;font-weight:900;letter-spacing:4px;color:#00C2D1;">WTW</div><div style="margin-top:6px;font-size:11px;line-height:1.3;font-weight:800;letter-spacing:3px;text-transform:uppercase;color:#00C2D1;">Where's The Wave</div></div>`}
              </td>
            </tr>
            <tr>
              <td style="padding:0 0 10px;text-align:center;">
                <div style="display:inline-block;padding:6px 11px;border:1px solid rgba(0,194,209,.45);background-color:rgba(7,16,24,.42);font-size:10px;line-height:1.4;font-weight:900;letter-spacing:3px;text-transform:uppercase;color:#00C2D1;">ACCESS CONFIRMED</div>
              </td>
            </tr>
            <tr>
              <td style="padding:0 0 18px;text-align:center;">
                <div style="font-family:Georgia,'Times New Roman',serif;font-size:38px;line-height:1.05;font-weight:700;letter-spacing:-0.2px;color:#f0ede8;">Your Night Is Confirmed</div>
                <div style="margin:10px auto 0;max-width:470px;font-size:15px;line-height:1.7;color:rgba(240,237,232,.84);">Your access details are verified. Keep this confirmation available when you arrive.</div>
              </td>
            </tr>
            <tr>
              <td style="padding:0 0 14px;text-align:center;">
                <div style="width:54px;height:54px;margin:0 auto;border:1px solid rgba(0,194,209,.8);border-radius:999px;background-color:#0a0d12;color:#00C2D1;font-size:22px;line-height:54px;font-weight:900;text-align:center;">&#10003;</div>
              </td>
            </tr>
            <tr>
              <td style="padding:0 0 8px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background-color:#0a0d12;border:1px solid rgba(0,194,209,.35);">
                  <tr>
                    <td style="padding:14px 16px 10px;text-align:center;">
                      <div style="font-size:10px;line-height:1.4;font-weight:900;letter-spacing:2.5px;text-transform:uppercase;color:#00C2D1;">Confirmation Details</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0 16px 14px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                        <tr>
                          <td style="padding:12px 0;border-top:1px solid rgba(255,255,255,.08);">
                            <div style="font-size:9px;line-height:1.4;font-weight:900;letter-spacing:2px;text-transform:uppercase;color:#6feaf0;">Confirmation Reference</div>
                            <div style="margin-top:5px;font-size:14px;line-height:1.5;font-weight:700;color:#f0ede8;">${escapeHtml(payload.confirmation_reference)}</div>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding:12px 0;border-top:1px solid rgba(255,255,255,.08);">
                            <div style="font-size:9px;line-height:1.4;font-weight:900;letter-spacing:2px;text-transform:uppercase;color:#6feaf0;">Venue / Event</div>
                            <div style="margin-top:5px;font-size:14px;line-height:1.5;font-weight:700;color:#f0ede8;">${escapeHtml(payload.venue_or_event || '—')}</div>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding:12px 0;border-top:1px solid rgba(255,255,255,.08);">
                            <div style="font-size:9px;line-height:1.4;font-weight:900;letter-spacing:2px;text-transform:uppercase;color:#6feaf0;">Date</div>
                            <div style="margin-top:5px;font-size:14px;line-height:1.5;font-weight:700;color:#f0ede8;">${escapeHtml(payload.confirmed_date || '—')}</div>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding:12px 0;border-top:1px solid rgba(255,255,255,.08);">
                            <div style="font-size:9px;line-height:1.4;font-weight:900;letter-spacing:2px;text-transform:uppercase;color:#6feaf0;">Time</div>
                            <div style="margin-top:5px;font-size:14px;line-height:1.5;font-weight:700;color:#f0ede8;">${escapeHtml(payload.confirmed_time || '—')}</div>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding:12px 0 0;border-top:1px solid rgba(255,255,255,.08);">
                            <div style="font-size:9px;line-height:1.4;font-weight:900;letter-spacing:2px;text-transform:uppercase;color:#6feaf0;">${escapeHtml(payload.amount_label || 'Party Size')}</div>
                            <div style="margin-top:5px;font-size:14px;line-height:1.5;font-weight:700;color:#f0ede8;">${escapeHtml(payload.amount_value || '—')}</div>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  ${customerMessage ? `
                  <tr>
                    <td style="padding:0 16px 12px;">
                      <div style="font-size:10px;line-height:1.4;font-weight:900;letter-spacing:2px;text-transform:uppercase;color:#6feaf0;">Message from WTW</div>
                      <div style="margin-top:4px;font-size:13px;line-height:1.6;color:rgba(240,237,232,.78);">${escapeHtml(customerMessage)}</div>
                    </td>
                  </tr>` : ''}
                  ${accessInstructions ? `
                  <tr>
                    <td style="padding:0 16px 12px;">
                      <div style="font-size:10px;line-height:1.4;font-weight:900;letter-spacing:2px;text-transform:uppercase;color:#6feaf0;">Access Instructions</div>
                      <div style="margin-top:4px;font-size:13px;line-height:1.6;color:rgba(240,237,232,.78);">${escapeHtml(accessInstructions)}</div>
                    </td>
                  </tr>` : ''}
                  <tr>
                    <td style="padding:0 16px 16px;text-align:center;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;">
                        <tr>
                          <td align="center" style="padding-top:6px;">
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;">
                              <tr>
                                <td align="center" style="background-color:#00C2D1;">
                                  <a href="${escapeHtml(payload.secure_link)}" style="display:block;padding:16px 24px;font-size:12px;line-height:1.2;font-weight:900;letter-spacing:1.7px;text-transform:uppercase;color:#020406;text-decoration:none;text-align:center;">View Your Confirmation</a>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 10px 0;text-align:center;">
                <div style="font-size:15px;line-height:1.5;font-weight:700;color:#f0ede8;">Exclusive access. Unforgettable nights.</div>
                <div style="margin-top:6px;font-size:13px;line-height:1.7;color:rgba(240,237,232,.76);">You&rsquo;re on the list. We&rsquo;ll see you there.</div>
                <div style="margin-top:12px;font-size:11px;line-height:1.7;color:rgba(240,237,232,.68);">Need assistance? Reply to this email or contact ${supportLink}.</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function buildEmailText(payload: {
  confirmation_reference: string;
  customer_name: string;
  venue_or_event: string;
  confirmed_date: string;
  confirmed_time: string;
  amountLabel: string;
  amountValue: string;
  customer_message: string;
  access_instructions: string;
  secure_link: string;
  support_email: string;
}) {
  const lines = [
    'Your WTW Night Is Confirmed',
    '',
    `Hello ${payload.customer_name || 'Guest'},`,
    '',
    `Your access at ${payload.venue_or_event || '—'} is confirmed.`,
    '',
    `Reference: ${payload.confirmation_reference}`,
    `Date: ${payload.confirmed_date || '—'}`,
    `Time: ${payload.confirmed_time || '—'}`,
    `${payload.amountLabel || 'Party Size / Quantity'}: ${payload.amountValue || '—'}`,
    payload.customer_message ? `Customer Message: ${payload.customer_message}` : '',
    payload.access_instructions ? `Access Instructions: ${payload.access_instructions}` : '',
    '',
    `View Confirmation: ${payload.secure_link}`,
    '',
    'Need help? Reply to this email or contact WTW Concierge.',
    '',
    'Where’s The Wave',
    'Private Nightlife Access',
    `Confirmation Reference: ${payload.confirmation_reference}`
  ];
  return lines.filter((line, idx) => line !== '' || idx < 5).join('\n');
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
  const resendApiKey = Deno.env.get('RESEND_API_KEY') || '';
  const from = Deno.env.get('WTW_EMAIL_FROM') || '';
  const supportEmail = Deno.env.get('WTW_SUPPORT_EMAIL') || '';
  const publicBaseUrl = Deno.env.get('WTW_PUBLIC_BASE_URL') || '';
  const logoUrl = Deno.env.get('WTW_LOGO_URL') || '';

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
    .select('id,confirmation_reference,access_token,request_type,request_id,assignment_id,customer_name,customer_email,customer_phone,market,venue_name,event_title,confirmed_date,confirmed_time,party_size,quantity,ticket_type,total_amount,confirmation_status,customer_message,access_instructions,support_notes,confirmed_by,confirmed_at,cancelled_at,created_at,updated_at')
    .eq('id', confirmationId)
    .maybeSingle();

  if (confirmationError) {
    return json({ error: 'Could not load customer confirmation.' }, 500);
  }
  if (!confirmation) {
    return json({ error: 'Customer confirmation not found.' }, 404);
  }

  const customerEmail = safeText(confirmation.customer_email).trim();
  const destination = customerEmail || null;
  const eventLabel = safeText(confirmation.venue_name || confirmation.event_title || 'Your WTW Night').trim();
  const confirmedDate = formatDate(confirmation.confirmed_date);
  const confirmedTime = formatTime12(confirmation.confirmed_time);
  const amountLabel = safeText(confirmation.request_type).trim().toLowerCase() === 'ticket' ? 'Quantity' : 'Party Size';
  const amountValue = safeText(confirmation.request_type).trim().toLowerCase() === 'ticket'
    ? safeText(confirmation.quantity).trim()
    : safeText(confirmation.party_size).trim();
  const existingDeliveryQuery = adminClient
    .from('confirmation_deliveries')
    .select('id,confirmation_id,channel,provider,destination,delivery_status,provider_message_id,attempt_count,last_attempt_at,sent_at,delivered_at,failed_at,failure_code,failure_message,metadata,created_at,updated_at')
    .eq('confirmation_id', confirmationId)
    .eq('channel', 'email')
    .maybeSingle();
  const { data: existingDelivery, error: deliveryLoadError } = await existingDeliveryQuery;
  if (deliveryLoadError) {
    return json({ error: 'Could not load email delivery state.' }, 500);
  }

  const now = new Date().toISOString();
  let deliveryRow = existingDelivery || null;

  async function upsertDelivery(patch: Record<string, unknown>) {
    const base = {
      confirmation_id: confirmationId,
      channel: 'email',
      provider: null,
      destination,
      delivery_status: 'pending',
      provider_message_id: null,
      attempt_count: 0,
      last_attempt_at: null,
      sent_at: null,
      delivered_at: null,
      failed_at: null,
      failure_code: null,
      failure_message: null,
      metadata: { source: 'send-confirmation-email' },
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
      channel: 'email',
      event_type: eventType,
      metadata
    });
    if (error) throw error;
  }

  const normalizedStatus = safeText(deliveryRow?.delivery_status).trim().toLowerCase();
  if (!customerEmail) {
    await upsertDelivery({
      delivery_status: 'skipped',
      provider: null,
      destination: null,
      provider_message_id: null,
      failure_code: 'missing_customer_email',
      failure_message: 'No customer email available.',
      metadata: { source: 'send-confirmation-email', reason: 'missing_customer_email' }
    });
    await recordEvent('skipped', { reason: 'missing_customer_email' });
    return json({
      confirmation_reference: confirmation.confirmation_reference,
      email: {
        status: 'skipped',
        destination: null,
        reason: 'No customer email available.'
      }
    });
  }

  if (!resend && ['sent', 'delivered', 'processing'].includes(normalizedStatus)) {
    return json({
      confirmation_reference: confirmation.confirmation_reference,
      email: {
        status: 'blocked',
        destination: destination,
        reason: 'Email already sent. Use resend to intentionally send another copy.'
      }
    });
  }

  if (!resend && !deliveryRow) {
    await upsertDelivery({
      delivery_status: 'pending',
      destination,
      metadata: { source: 'send-confirmation-email' }
    });
  }

  if (!resend && deliveryRow && normalizedStatus === 'not_configured') {
    // Fall through to try again only when config now exists.
  }

  if (!resendApiKey || !from || !supportEmail || !publicBaseUrl) {
    const reason = !resendApiKey ? 'missing_resend_api_key' : 'missing_email_environment';
    await upsertDelivery({
      delivery_status: 'not_configured',
      destination,
      provider: null,
      failure_code: reason,
      failure_message: 'Email delivery is not configured.',
      metadata: {
        source: 'send-confirmation-email',
        reason
      }
    });
    await recordEvent('not_configured', { reason });
    return json({
      confirmation_reference: confirmation.confirmation_reference,
      email: {
        status: 'not_configured',
        destination,
        reason: 'Email delivery is not configured.'
      }
    });
  }

  const secureLink = buildConfirmationUrl(publicBaseUrl, safeText(confirmation.access_token).trim());
  const existingAttempts = Number(deliveryRow?.attempt_count || 0);
  await upsertDelivery({
    delivery_status: 'processing',
    provider: 'resend',
    destination,
    attempt_count: existingAttempts + 1,
    last_attempt_at: now,
    failure_code: null,
    failure_message: null,
    metadata: {
      ...(deliveryRow?.metadata && typeof deliveryRow.metadata === 'object' && !Array.isArray(deliveryRow.metadata) ? deliveryRow.metadata : {}),
      source: 'send-confirmation-email',
      resend: !!resend
    }
  });
  await recordEvent('processing', { resend: !!resend });

  const html = await buildEmailHtml({
    confirmation_reference: safeText(confirmation.confirmation_reference).trim(),
    customer_name: safeText(confirmation.customer_name).trim() || 'Guest',
    venue_or_event: eventLabel,
    confirmed_date: confirmedDate,
    confirmed_time: confirmedTime,
    amount_label: amountLabel,
    amount_value: amountValue,
    customer_message: safeText(confirmation.customer_message).trim(),
    access_instructions: safeText(confirmation.access_instructions).trim(),
    secure_link: secureLink,
    support_email: supportEmail,
    logo_url: logoUrl
  });
  const text = buildEmailText({
    confirmation_reference: safeText(confirmation.confirmation_reference).trim(),
    customer_name: safeText(confirmation.customer_name).trim() || 'Guest',
    venue_or_event: eventLabel,
    confirmed_date: confirmedDate,
    confirmed_time: confirmedTime,
    amountLabel,
    amountValue,
    customer_message: safeText(confirmation.customer_message).trim(),
    access_instructions: safeText(confirmation.access_instructions).trim(),
    secure_link: secureLink,
    support_email: supportEmail
  });
  const subject = buildSubject(confirmation);

  const resendResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from,
      to: [destination],
      subject,
      html,
      text
    })
  });

  if (!resendResponse.ok) {
    const failureCode = `resend_${resendResponse.status}`;
    const safeFailure = 'Email provider request failed.';
    await upsertDelivery({
      delivery_status: 'failed',
      provider: 'resend',
      destination,
      failed_at: new Date().toISOString(),
      failure_code: failureCode,
      failure_message: safeFailure,
      metadata: {
        ...(deliveryRow?.metadata && typeof deliveryRow.metadata === 'object' && !Array.isArray(deliveryRow.metadata) ? deliveryRow.metadata : {}),
        source: 'send-confirmation-email',
        resend: !!resend
      }
    });
    await recordEvent('failed', { reason: safeFailure, failure_code: failureCode });
    return json({
      confirmation_reference: confirmation.confirmation_reference,
      email: {
        status: 'failed',
        destination,
        reason: safeFailure
      }
    });
  }

  const resendData = await resendResponse.json();
  const providerMessageId = safeText(resendData?.id || resendData?.data?.id || '').trim() || null;
  const { data: sentRow, error: sentError } = await adminClient
    .from('confirmation_deliveries')
    .update({
      provider: 'resend',
      provider_message_id: providerMessageId,
      delivery_status: 'sent',
      sent_at: new Date().toISOString(),
      last_attempt_at: new Date().toISOString(),
      failure_code: null,
      failure_message: null,
      destination,
      metadata: {
        ...(deliveryRow?.metadata && typeof deliveryRow.metadata === 'object' && !Array.isArray(deliveryRow.metadata) ? deliveryRow.metadata : {}),
        source: 'send-confirmation-email',
        resend: !!resend,
        provider_message_id: providerMessageId
      }
    })
    .eq('confirmation_id', confirmationId)
    .eq('channel', 'email')
    .select('id,confirmation_id,channel,provider,destination,delivery_status,provider_message_id,attempt_count,last_attempt_at,sent_at,delivered_at,failed_at,failure_code,failure_message,metadata,created_at,updated_at')
    .single();

  if (sentError) {
    return json({
      confirmation_reference: confirmation.confirmation_reference,
      email: {
        status: 'sent',
        destination,
        provider_message_id: providerMessageId,
        sent_at: new Date().toISOString(),
        attempt_count: existingAttempts + 1,
        warning: 'Email was sent, but the delivery record update needs attention.'
      }
    });
  }

  deliveryRow = sentRow;
  await recordEvent('sent', {
    provider: 'resend',
    provider_message_id: providerMessageId,
    resend: !!resend
  });

  return json({
    confirmation_reference: confirmation.confirmation_reference,
    email: {
      status: 'sent',
      destination,
      provider_message_id: providerMessageId,
      sent_at: sentRow.sent_at,
      attempt_count: sentRow.attempt_count
    }
  });
});
