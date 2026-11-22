import{SOURCE_LABELS,SECTION_IDS}from'./public-model.js?v=20261120-complete2';
export const EXCLUDE_KEY='eliabe.analytics.exclude';
const VISITOR_KEY='eliabe.analytics.visitor';
export function anonymousVisitorId(storage){try{const store=storage||globalThis.localStorage;const existing=store.getItem(VISITOR_KEY);if(existing&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(existing))return existing;const id=crypto.randomUUID();store.setItem(VISITOR_KEY,id);return id}catch{return null}}

export function isExcluded(storage){try{return(storage||globalThis.localStorage)?.getItem(EXCLUDE_KEY)==='1'}catch{return false}}
export function setExcluded(value,storage){(storage||globalThis.localStorage).setItem(EXCLUDE_KEY,value?'1':'0')}
export function sourceLabel(referrer,href){const u=new URL(href),campaign=(u.searchParams.get('utm_source')||'').toLowerCase(),map={instagram:'Instagram',google:'Google',bing:'Bing',whatsapp:'WhatsApp',facebook:'Facebook',youtube:'YouTube',linkedin:'LinkedIn',tiktok:'TikTok'};if(campaign)return map[campaign]||'Outro link de campanha';if(!referrer)return SOURCE_LABELS[0];try{const h=new URL(referrer).hostname.toLowerCase();if(h===u.hostname)return SOURCE_LABELS[0];if(/^(?:[a-z0-9-]+\.)*google\.(?:com|[a-z]{2}|(?:com|co)\.[a-z]{2})$/.test(h))return'Google';for(const[d,label]of[['instagram.com','Instagram'],['bing.com','Bing'],['whatsapp.com','WhatsApp'],['wa.me','WhatsApp'],['facebook.com','Facebook'],['fb.com','Facebook'],['youtube.com','YouTube'],['youtu.be','YouTube'],['linkedin.com','LinkedIn'],['tiktok.com','TikTok']])if(h===d||h.endsWith('.'+d))return label;return'Outro site'}catch{return SOURCE_LABELS[0]}}
export function activeDelta(last,now,interaction,active){return active&&Number.isFinite(last)&&now>last?Math.max(0,Math.min(now,interaction+60000)-last)/1000:0}
export function startAnalytics(config){
 const disabled=()=>navigator.globalPrivacyControl===true||isExcluded();if(disabled())return{stop(){}};
 const root=new URL(config.url);if(root.protocol!=='https:'||!root.hostname.endsWith('.supabase.co'))throw Error('Invalid collector');
 let token=null,stopped=false,queue=[],sending=false,context='section:inicio',last=performance.now(),interaction=last,seconds=0,visibleSection='inicio',active=document.visibilityState==='visible'&&document.hasFocus();
 const post=(name,body)=>fetch(root.origin+'/functions/v1/'+name,{method:'POST',headers:{apikey:config.publishableKey,'Content-Type':'application/json'},credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',keepalive:true,body:JSON.stringify(body)});
 const enqueue=(kind,subject,duration=0)=>{if(!stopped&&!disabled()&&queue.length<100)queue.push({id:crypto.randomUUID(),kind,subject,seconds:duration})};
 async function flush(force=false){if(disabled()){queue=[];return}if(!token||(sending&&!force)||!queue.length||stopped)return;sending=true;const batch=queue.splice(0,20);try{const r=await post('collect-event',{token,events:batch});if(!r.ok&&r.status>=500)queue.unshift(...batch)}catch{queue.unshift(...batch)}finally{if(queue.length>100)queue.length=100;sending=false}}
 const tick=()=>{const now=performance.now();seconds+=activeDelta(last,now,interaction,active);last=now};
 const commit=()=>{const n=Math.min(30,Math.floor(seconds));if(n){enqueue('engagement',context,n);seconds-=n}};
 const contextTo=value=>{tick();commit();context=value};
 const onActivity=()=>{tick();interaction=performance.now()};
 const onVisibility=()=>{tick();active=document.visibilityState==='visible'&&document.hasFocus();if(!active){commit();flush()}};
 for(const name of['pointerdown','keydown','scroll'])document.addEventListener(name,onActivity,{passive:true});
 document.addEventListener('visibilitychange',onVisibility);window.addEventListener('focus',onVisibility);window.addEventListener('blur',onVisibility);
 document.addEventListener('portfolio:project-open',event=>{const id=event.detail?.id;if(typeof id==='string'&&/^[a-z0-9-]{1,64}$/.test(id)){contextTo(id);enqueue('project_open',id);flush()}});
 document.querySelector('#project-dialog')?.addEventListener('close',()=>contextTo('section:'+visibleSection));
 document.addEventListener('click',event=>{const a=event.target.closest?.('a[href]');if(!a)return;const href=a.getAttribute('href')||'';if(/^mailto:/i.test(href))enqueue('contact_click','email');else if(/^https:\/\/(wa\.me|api\.whatsapp\.com)\//i.test(href))enqueue('contact_click','whatsapp');if(a.matches('[data-dialog-link]')){const id=document.querySelector('#project-dialog')?.dataset.project;if(id)enqueue('project_link',id)}if(a.matches('[data-hero-play]')&&a.dataset.projectId)enqueue('project_link',a.dataset.projectId);flush()});
 const seen=new Set(),ratios=new Map();let observer;
 if('IntersectionObserver'in window){observer=new IntersectionObserver(entries=>{for(const e of entries){ratios.set(e.target.id,e.isIntersecting?e.intersectionRatio:0);if(e.isIntersecting&&e.intersectionRatio>=.25&&!seen.has(e.target.id)){seen.add(e.target.id);enqueue('section_view',e.target.id)}}const top=[...ratios].sort((a,b)=>b[1]-a[1])[0];if(top?.[1]>0&&top[0]!==visibleSection){visibleSection=top[0];if(!document.querySelector('#project-dialog')?.open)contextTo('section:'+visibleSection)}},{threshold:[0,.25,.5,.75,1]});for(const id of SECTION_IDS){const s=document.getElementById(id);if(s)observer.observe(s)}}
 const interval=setInterval(()=>{tick();commit();flush()},15000),onHide=()=>{tick();commit();active=false;flush(true)};window.addEventListener('pagehide',onHide);
 post('collect-visit',{source:sourceLabel(document.referrer,location.href),visitor_id:anonymousVisitorId()}).then(r=>r.ok&&r.status!==204?r.json():null).then(data=>{if(typeof data?.token==='string'){token=data.token;flush()}}).catch(()=>{});
 return{stop(){stopped=true;clearInterval(interval);observer?.disconnect();queue=[];for(const n of['pointerdown','keydown','scroll'])document.removeEventListener(n,onActivity);document.removeEventListener('visibilitychange',onVisibility);window.removeEventListener('focus',onVisibility);window.removeEventListener('blur',onVisibility);window.removeEventListener('pagehide',onHide)}};
}

export function recordVisit(collectorUrl,publishableKey){if(navigator.globalPrivacyControl===true||isExcluded())return;const url=new URL(collectorUrl);if(url.protocol!=='https:'||!url.hostname.endsWith('.supabase.co')||!url.pathname.endsWith('/functions/v1/collect-visit'))throw Error('Invalid collector');return fetch(url.href,{method:'POST',headers:{apikey:publishableKey},credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',keepalive:true,body:''}).catch(()=>{})}
