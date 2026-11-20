// Activate only after the collector and private admin access pass live checks.
// No cookies, local storage, names, emails, fingerprinting or third-party IP lookup.
export function recordVisit(collectorUrl, publishableKey) {
  if (navigator.globalPrivacyControl === true) return;
  const url = new URL(collectorUrl);
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.supabase.co') || !url.pathname.endsWith('/functions/v1/collect-visit')) throw new Error('Invalid collector');
  return fetch(url.href,{method:'POST',headers:{apikey:publishableKey},credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',keepalive:true,body:''}).catch(()=>{});
}
