// Coarse, spoofable classifications only. Never persist the raw User-Agent or device identifiers.
export function classifyDevice(value: string | null) {
  const ua = (value || '').slice(0, 1024);
  let device = 'unknown', os = 'unknown', browser = 'unknown';
  if (!ua) return { device, os, browser };
  const bot = /bot\b|crawler|spider|headless|curl\/|wget\/|python-requests/i.test(ua);
  if (/Windows NT/i.test(ua)) os = 'Windows';
  else if (/CrOS/i.test(ua)) os = 'ChromeOS';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone|iPod/i.test(ua)) os = 'iOS';
  else if (/iPad/i.test(ua)) os = 'iPadOS';
  else if (/Macintosh|Mac OS X/i.test(ua)) os = 'macOS';
  else if (/Linux/i.test(ua)) os = 'Linux';
  if (bot) device = 'bot';
  else if (/iPad|Tablet|PlayBook|Silk\/|Kindle/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) device = 'tablet';
  else if (/iPhone|iPod|Mobile|Windows Phone/i.test(ua)) device = 'mobile';
  else if (['Windows', 'ChromeOS', 'macOS', 'Linux'].includes(os)) device = 'computer';
  if (bot) browser = 'Automação';
  else if (/Edg(?:e|A|iOS)?\//i.test(ua)) browser = 'Edge';
  else if (/OPR\/|Opera|OPiOS\//i.test(ua)) browser = 'Opera';
  else if (/SamsungBrowser\//i.test(ua)) browser = 'Samsung Internet';
  else if (/Firefox\/|FxiOS\//i.test(ua)) browser = 'Firefox';
  else if (/Chrome\/|CriOS\//i.test(ua)) browser = 'Chrome';
  else if (/Safari\//i.test(ua)) browser = 'Safari';
  return { device, os, browser };
}
