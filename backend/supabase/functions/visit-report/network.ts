import { isIP } from 'node:net';
const SOURCES = {
  vpn4: 'https://raw.githubusercontent.com/X4BNet/lists_vpn/main/output/vpn/ipv4.txt',
  vpn6: 'https://raw.githubusercontent.com/X4BNet/lists_vpn/main/output/vpn/ipv6.txt',
  tor: 'https://check.torproject.org/torbulkexitlist',
  proxy: 'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies.json'
};
type Range = { start: bigint; end: bigint };
type Data = { vpn4: Range[] | null; vpn6: Range[] | null; tor: Set<string> | null; proxy: Set<string> | null };
type Signal = { ip: string; vpn: boolean | null; proxy: boolean | null; tor: boolean | null };

export function ipNumber(ip: string): { version: number; value: bigint } | null {
  const version = isIP(ip);
  if (version === 4) return { version, value: ip.split('.').reduce((n, part) => (n << 8n) | BigInt(part), 0n) };
  if (version !== 6) return null;
  let text = ip.toLowerCase().split('%')[0];
  if (text.includes('.')) {
    const last = text.lastIndexOf(':');
    const tail = ipNumber(text.slice(last + 1))!;
    text = text.slice(0, last + 1) + (tail.value >> 16n).toString(16) + ':' + (tail.value & 65535n).toString(16);
  }
  const [left, right] = text.split('::');
  const a = left ? left.split(':') : [], b = right ? right.split(':') : [];
  const parts = right === undefined ? a : [...a, ...Array(8 - a.length - b.length).fill('0'), ...b];
  const value = parts.reduce((n, part) => (n << 16n) | BigInt('0x' + part), 0n);
  if ((value >> 32n) === 65535n) return { version: 4, value: value & 0xffffffffn };
  return { version, value };
}
const key = (ip: string) => { const n = ipNumber(ip); return n ? `${n.version}:${n.value}` : null; };
export function parseRanges(text: string, version: number): Range[] {
  const ranges: Range[] = [];
  for (const raw of text.split(/\r?\n/).slice(0, 200000)) {
    const line = raw.split('#')[0].trim();
    if (!line) continue;
    const [ip, prefix, extra] = line.split('/');
    const n = ipNumber(ip), bits = version === 4 ? 32 : 128;
    const length = prefix === undefined ? bits : Number(prefix);
    if (!n || n.version !== version || extra !== undefined || !Number.isInteger(length) || length < 1 || length > bits) continue;
    const span = 1n << BigInt(bits - length), start = n.value / span * span;
    ranges.push({ start, end: start + span - 1n });
  }
  ranges.sort((a, b) => a.start < b.start ? -1 : a.start > b.start ? 1 : 0);
  const merged: Range[] = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end + 1n) last.end = range.end > last.end ? range.end : last.end;
    else merged.push({ ...range });
  }
  return merged;
}
export function contains(ranges: Range[], value: bigint) {
  let low = 0, high = ranges.length - 1;
  while (low <= high) { const mid = (low + high) >> 1, range = ranges[mid];
    if (value < range.start) high = mid - 1; else if (value > range.end) low = mid + 1; else return true;
  }
  return false;
}
async function download(url: string, fetcher: typeof fetch) {
  const response = await fetcher(url, { signal: AbortSignal.timeout(4500), redirect: 'error', headers: { Accept: 'text/plain,application/json' } });
  if (!response.ok || !response.body || Number(response.headers.get('content-length') || 0) > 8000000) throw new Error('Source unavailable');
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let bytes = 0, text = '';
  try { for (;;) { const { done, value } = await reader.read(); if (done) break;
    bytes += value.length; if (bytes > 8000000) throw new Error('Oversized source'); text += decoder.decode(value, { stream: true });
  } } finally { await reader.cancel().catch(() => {}); }
  return text + decoder.decode();
}
export async function fetchLists(fetcher: typeof fetch = fetch): Promise<Data> {
  const values = await Promise.allSettled(Object.values(SOURCES).map(url => download(url, fetcher)));
  const get = (i: number) => values[i].status === 'fulfilled' ? (values[i] as PromiseFulfilledResult<string>).value : null;
  const range = (i: number, version: number) => { const text = get(i); if (text === null) return null; const result = parseRanges(text, version); return result.length ? result : null; };
  let tor: Set<string> | null = null, proxy: Set<string> | null = null;
  const torText = get(2); if (torText !== null) { const ips = torText.split(/\s+/).map(key).filter(Boolean) as string[]; if (ips.length) tor = new Set(ips); }
  try { const rows = JSON.parse(get(3) || 'null'); if (Array.isArray(rows) && rows.length <= 50000) {
    // Use only public proxy exit IPs; ignore credentials, ASN and geolocation metadata.
    const ips = rows.map(row => typeof row?.exit_ip === 'string' ? key(row.exit_ip) : null).filter(Boolean) as string[];
    if (ips.length) proxy = new Set(ips);
  } } catch { /* Invalid list means not verified, never a clean result. */ }
  return { vpn4: range(0, 4), vpn6: range(1, 6), tor, proxy };
}
let cache: Data | null = null, nextFetch = 0, pending: Promise<Data> | null = null;
async function lists() {
  if (cache && Date.now() < nextFetch) return cache;
  if (!pending) pending = fetchLists().then(data => {
    cache = data; nextFetch = Date.now() + (Object.values(data).every(v => v !== null) ? 3600000 : 60000); return data;
  }).finally(() => { pending = null; });
  return pending;
}
export function classifyNetwork(ip: string, data: Data): Signal {
  const n = ipNumber(ip), id = key(ip);
  if (!n || !id) return { ip, vpn: null, proxy: null, tor: null };
  const ranges = n.version === 4 ? data.vpn4 : data.vpn6;
  return { ip, vpn: ranges ? contains(ranges, n.value) : null, proxy: data.proxy ? data.proxy.has(id) : null, tor: data.tor ? data.tor.has(id) : null };
}
export async function enrichNetworks(db: { rpc: Function }, visits: { ip: string; network_checked_at?: string; vpn?: boolean | null; proxy?: boolean | null; tor?: boolean | null }[], loader = lists) {
  const ips = [...new Set(visits.slice(0, 50).filter(v => !v.network_checked_at || Date.now() - Date.parse(v.network_checked_at) > 3600000 || [v.vpn, v.proxy, v.tor].some(x => x === null || x === undefined)).map(v => v.ip))];
  if (!ips.length) return;
  const data = await loader();
  await db.rpc('save_network_signals', { p_records: ips.map(ip => classifyNetwork(ip, data)) });
}
