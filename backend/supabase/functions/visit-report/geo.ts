import { isIP } from 'node:net';

const clean = (value: unknown): string | null => typeof value === 'string'
  ? value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 120) || null : null;

export async function enrichLocation(db: { rpc: Function }, ip: string, fetcher: typeof fetch = fetch) {
  if (!isIP(ip)) return;
  const claim = await db.rpc('claim_ip_location', { p_ip: ip });
  if (claim.error || claim.data !== true) return;
  let fields = { p_city: null as string | null, p_region: null as string | null, p_country: null as string | null, p_country_code: null as string | null };
  try {
    const response = await fetcher(`https://ipwho.is/${encodeURIComponent(ip)}?lang=pt-BR&fields=success,city,region,country,country_code`, {
      signal: AbortSignal.timeout(2500), redirect: 'error', headers: { Accept: 'application/json' }
    });
    if (response.ok) {
      const text = await response.text();
      if (text.length > 16000) throw new Error('Oversized response');
      const data = JSON.parse(text);
      if (data?.success === true) {
        fields = { p_city: clean(data.city), p_region: clean(data.region), p_country: clean(data.country),
          p_country_code: typeof data.country_code === 'string' && /^[A-Z]{2}$/.test(data.country_code) ? data.country_code : null };
      }
    }
  } catch { /* The original visit must remain available if geolocation fails. */ }
  await db.rpc('finish_ip_location', { p_ip: ip, ...fields });
}

export async function enrichReport(db: { rpc: Function }, visits: { ip: string }[], fetcher: typeof fetch = fetch) {
  const ips = [...new Set(visits.slice(0, 50).map(v => v.ip))];
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(5, ips.length) }, async () => {
    while (next < ips.length) {
      const ip = ips[next++];
      try { await enrichLocation(db, ip, fetcher); } catch { /* Keep failures private and return the visit. */ }
    }
  }));
}
