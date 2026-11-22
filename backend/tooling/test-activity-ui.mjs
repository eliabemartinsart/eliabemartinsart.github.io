import assert from 'node:assert/strict';
import {projectVisits} from './project-visits.js';
import {visitTimeline} from './visit-timeline.js';
import {renderAnalytics} from './dashboard.js';
class Element{
 constructor(tag='div'){this.tag=tag;this.children=[];this.handlers={};this.attrs={};this.hidden=false;this.disabled=false;this.textContent=''}
 append(...items){for(const item of items)item.tag==='fragment'?this.children.push(...item.children):this.children.push(item)}
 replaceChildren(...items){this.children=[];this.append(...items)}
 addEventListener(name,fn){this.handlers[name]=fn}setAttribute(k,v){this.attrs[k]=v}
 scrollIntoView(){}focus(){}click(){return this.handlers.click?.()}
}
const elements=new Map();
globalThis.document={getElementById:id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id)},createElement:tag=>new Element(tag),createElementNS:(ns,tag)=>new Element(tag),createDocumentFragment:()=>new Element('fragment')};
const $=document.getElementById,walk=(node,tag)=>node.children.flatMap(child=>[...(child.tag===tag?[child]:[]),...walk(child,tag)]);
let filter;
renderAnalytics({total:1,analytics:{average_active_seconds:20,contacts:{email:1,whatsapp:0},tracked_visits:1,previous_visits:0,measurement_started_at:'2026-11-20T00:00:00Z',daily:[{date:'2026-11-22',visits:1}],hourly:[{hour:12,visits:1}],sources:[{source:'Instagram',visits:1}],projects:[],sections:[{id:'sobre',views:1,seconds:20}]}},()=>{},f=>filter=f);
walk($('section-ranking'),'button')[0].click();assert.deepEqual(filter,{kind:'section',id:'sobre',title:'Seção: Sobre'});
walk($('source-ranking'),'button')[0].click();assert.equal(filter.kind,'source');assert.equal(filter.id,'Instagram');
walk($('daily-chart'),'button')[0].click();assert.equal(filter.kind,'day');assert.equal(filter.id,'2026-11-22');
walk($('hourly-chart'),'rect')[0].handlers.keydown({key:'Enter',preventDefault(){}});assert.equal(filter.kind,'hour');assert.equal(filter.id,'12');
let active=true,calls=[],handler=async()=>({data:{total_visits:1,unique_ips:1,views:1,opens:0,clicks:0,active_seconds:20,unmeasured_visits:0,next_cursor:null,visits:[{visit_id:42,ip:'198.51.100.42',first_at:'2026-11-22T12:00:00Z',last_at:'2026-11-22T12:00:20Z',device:'mobile',os:'Android',browser:'Chrome',views:1,opens:0,clicks:0,active_seconds:20}]}});
const client={rpc(name,args){calls.push({name,args});return handler(args)}};
let chosen;
const visits=projectVisits(()=>client,()=>active,v=>chosen=v);
await visits.open({kind:'section',id:'sobre',title:'Seção: Sobre'},7);
assert.equal(calls.at(-1).name,'admin_activity_visits');assert.equal(calls.at(-1).args.p_kind,'section');assert.equal(calls.at(-1).args.p_subject,'sobre');
assert.equal($('project-access-rows').children[0].children[10].textContent,'1');assert.equal($('project-access-rows').children[0].children[13].textContent,'20 s');
walk($('project-access-rows'),'button')[0].click();assert.equal(chosen.visit_id,42);
const timeline=visitTimeline(()=>client,()=>active);timeline.setProjects([{id:'babacu',title:'Babaçu'}]);
handler=async args=>({data:{visit:{visit_id:42,ip:'198.51.100.42',device:'mobile',os:'Android',browser:'Chrome'},total_events:3,next_cursor:args.p_before_event_id===null?1:null,events:[{id:3,at:'2026-11-22T12:00:20Z',kind:'engagement',subject:'section:sobre',seconds:20},{id:2,at:'2026-11-22T12:00:01Z',kind:'project_open',subject:'babacu',seconds:null},{id:1,at:'2026-11-22T12:00:00Z',kind:'contact_click',subject:'whatsapp',seconds:null}]}});
await timeline.open(chosen,7);assert.equal(calls.at(-1).name,'admin_visit_events');assert.equal(calls.at(-1).args.p_visit_id,42);
const rows=$('visit-timeline-rows').children;
assert.equal(rows[0].children[2].textContent,'Sobre');assert.equal(rows[0].children[3].textContent,'20 s');assert.equal(rows[1].children[2].textContent,'Babaçu');assert.equal(rows[1].children[3].textContent,'—');assert.equal(rows[2].children[2].textContent,'WhatsApp');
$('visit-timeline-next').click();await new Promise(setImmediate);assert.equal(calls.at(-1).args.p_before_event_id,1);
let resolveOld;handler=()=>new Promise(resolve=>resolveOld=resolve);const pending=timeline.refresh(1);timeline.clear();active=false;resolveOld({data:{events:[],total_events:0}});await pending;
assert.equal($('visit-timeline-panel').hidden,true);assert.equal($('visit-timeline-rows').children.length,0);
console.log('PASS: section/source/day/hour filter actions, keyboard chart access, generic per-IP rows, visit timeline labels/time/paging and logout cleanup.');
