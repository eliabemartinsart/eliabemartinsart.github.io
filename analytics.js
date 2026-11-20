import config from './backend/public-config.js';
import { recordVisit } from './backend/tracker.js';

if (location.hostname === 'eliabemartinsart.github.io' && (location.pathname === '/' || location.pathname === '/index.html')) {
  const send = () => {
    try { recordVisit(`${config.url}/functions/v1/collect-visit`, config.publishableKey); } catch { /* Statistics must never interrupt the portfolio. */ }
  };
  if (document.prerendering) document.addEventListener('prerenderingchange',send,{once:true});
  else send();
}
