import assert from 'node:assert/strict';
import {projectVisits} from './project-visits.js';
class Element{
 constructor(tag='div'){this.tag=tag;this.children=[];this.handlers={};this.hidden=false;this.disabled=false;this.textContent=''}
 append(...items){for(const item of items){if(item.tag==='fragment')this.children.push(...item.children);else this.children.push(item)}}
 replaceChildren(...items){this.children=[];this.append(...items)}
 addEventListener(name,fn){this.handlers[name]=fn}
 scrollIntoView(){}focus(){}click(){this.handlers.click?.()}
}
const elements=new Map();
globalThis.document={getElementById:id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id)},createElement:tag=>new Element(tag),createDocumentFragment:()=>new Element('fragment')};
const $=document.getElementById;
const data={total_visits:2,unique_ips:1,opens:3,active_seconds:90,unmeasured_visits:1,next_cursor:null,visits:[{visit_id:1,ip:'198.51.100.7',first_at:'2026-11-20T12:00:00Z',last_at:'2026-11-20T12:01:30Z',city:'Tarrafas',region:'Ceará',country:'Brasil',device:'mobile',os:'Android',browser:'Chrome',source:'Instagram',opens:2,clicks:1,active_seconds:90},{visit_id:2,ip:'198.51.100.7',first_at:'2026-11-21T12:00:00Z',last_at:'2026-11-21T12:00:00Z',device:'computer',os:'Linux',browser:'Firefox',opens:1,clicks:0,active_seconds:null}]};
let active=true,requestHandler=async()=>({data}),calls=[];
const client={rpc(name,args){calls.push({name,args});return requestHandler(args)}};
const ui=projectVisits(()=>client,()=>active);
await ui.open({id:'babacu',title:'Babaçu'},30);
assert.equal($('project-access-panel').hidden,false);assert.equal($('project-access-rows').children.length,2);
const first=$('project-access-rows').children[0].children;
assert.equal(first[1].textContent,'198.51.100.7');assert.equal(first[2].textContent,'Tarrafas');assert.equal(first[6].textContent,'Android');assert.equal(first[13].textContent,'1 min 30 s');
assert.equal($('project-access-rows').children[1].children[13].textContent,'Não medido');
assert.match($('project-access-summary').textContent,/1 IPs distintos/);
assert.equal(calls[0].name,'admin_project_visits');assert.equal(calls[0].args.p_project_id,'babacu');
await ui.refresh(7);assert.equal(calls.at(-1).args.p_days,7);
requestHandler=async args=>({data:{...data,next_cursor:args.p_before_visit_id===null?10:null}});
await ui.refresh(7);assert.equal($('project-access-next').disabled,false);
$('project-access-next').click();await new Promise(setImmediate);assert.equal(calls.at(-1).args.p_before_visit_id,10);assert.equal($('project-access-previous').disabled,false);
$('project-access-previous').click();await new Promise(setImmediate);assert.equal(calls.at(-1).args.p_before_visit_id,null);
let finishOld;requestHandler=()=>new Promise(resolve=>{finishOld=resolve});
const old=ui.open({id:'babacu',title:'Babaçu'},30);
requestHandler=async()=>({data:{...data,visits:[],total_visits:0,unique_ips:0}});
await ui.open({id:'escuta',title:'Escuta'},30);finishOld({data});await old;
assert.equal($('project-access-title').textContent,'Acessos a Escuta');assert.equal($('project-access-rows').children.length,0);assert.equal($('project-access-empty').hidden,false);
requestHandler=()=>new Promise(resolve=>{finishOld=resolve});const pending=ui.open({id:'babacu',title:'Babaçu'},30);ui.clear();active=false;finishOld({data});await pending;
assert.equal($('project-access-panel').hidden,true);assert.equal($('project-access-rows').children.length,0);
console.log('PASS: project detail fields, per-visit time, unknown time, paging, period changes, stale-response isolation and private data cleanup after logout.');
