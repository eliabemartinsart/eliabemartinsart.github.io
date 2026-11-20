// Anonymous writes only. Reading visitor IPs is never exposed by this endpoint.
import { createClient } from 'npm:@supabase/supabase-js@2.119.2';
import { isIP } from 'node:net';

const origin = 'https://eliabemartinsart.github.io';
const headers = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'content-type', 'Cache-Control': 'no-store', 'Vary': 'Origin', 'X-Content-Type-Options': 'nosniff' };

Deno.serve(async (request: Request) => {
  if (request.headers.get('origin') !== origin) return new Response(null,{status:403});
  if (request.method === 'OPTIONS') return new Response(null,{status:204,headers});
  if (request.method !== 'POST') return new Response(null,{status:405,headers});
  // Fail closed until the hosted gateway's trusted client-IP header has been verified.
  const trustedHeader = Deno.env.get('VERIFIED_CLIENT_IP_HEADER');
  const position = Deno.env.get('VERIFIED_CLIENT_IP_POSITION');
  if (!trustedHeader || !['first','last'].includes(position || '')) return new Response(null,{status:503,headers});
  const values = (request.headers.get(trustedHeader) || '').split(',').map(v=>v.trim());
  const ip = position === 'last' ? values.at(-1) : values[0];
  if (!ip || !isIP(ip)) return new Response(null,{status:400,headers});
  // Ignore the request body entirely: clients cannot submit IPs or other visitor fields.
  try {
    const db = createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
    const { error } = await db.rpc('record_site_visit',{p_ip:ip});
    if (error) return new Response(null,{status:503,headers});
    return new Response(null,{status:204,headers});
  } catch { return new Response(null,{status:503,headers}); }
});
