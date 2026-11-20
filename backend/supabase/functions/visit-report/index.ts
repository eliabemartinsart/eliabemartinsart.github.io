import { createClient } from 'npm:@supabase/supabase-js@2.119.2';
import { enrichReport } from './geo.ts';
import { enrichNetworks } from './network.ts';
const publicKey = 'sb_publishable_KrEo1iWfTSU5aJ5YUzn99w_tFL80WMV';
const origin = 'https://eliabemartinsart.github.io';
const headers = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'content-type,apikey,authorization,x-client-info', 'Cache-Control': 'no-store',
  'Vary': 'Origin', 'X-Content-Type-Options': 'nosniff', 'Content-Type': 'application/json' };
const response = (status: number, data: unknown = { error: 'Acesso não autorizado ou indisponível.' }) => new Response(JSON.stringify(data), { status, headers });
Deno.serve(async (request: Request) => {
  if (request.headers.get('origin') !== origin) return response(403);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return response(405);
  if (request.headers.get('apikey') !== publicKey) return response(401);
  const authorization = request.headers.get('authorization') || '';
  if (!/^Bearer \S+$/.test(authorization) || authorization.length > 8192) return response(401);
  if (Number(request.headers.get('content-length') || 0) > 512) return response(413);
  try {
    const text = await request.text();
    if (text.length > 512) return response(413);
    const body = JSON.parse(text || '{}');
    if (!body || Object.keys(body).some(k => !['p_days', 'p_before_id'].includes(k))) return response(400);
    const days = body.p_days ?? 30;
    const before = body.p_before_id ?? null;
    if (![1, 7, 30].includes(days) || (before !== null && (!Number.isSafeInteger(before) || before <= 0))) return response(400);
    const url = Deno.env.get('SUPABASE_URL')!;
    const client = createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: authorization } } });
    const user = await client.auth.getUser(authorization.slice(7));
    if (user.error || !user.data.user) return response(401);
    const params = { p_days: days, p_before_id: before };
    const first = await client.rpc('admin_visit_report', params);
    if (first.error) return response(403);
    // IPs come only from the authorized database report, never from a client-supplied lookup list.
    const server = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
    await Promise.allSettled([enrichReport(server, first.data.visits), enrichNetworks(server, first.data.visits)]);
    const [final,summary] = await Promise.all([client.rpc('admin_visit_report',params),client.rpc('admin_analytics_summary',{p_days:days})]);
    if (final.error || summary.error) return response(403);
    return response(200, {...final.data,analytics:summary.data});
  } catch { return response(503); }
});
