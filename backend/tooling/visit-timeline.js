import {sectionNames,duration,downloadCsv} from './dashboard.js?v=20261122-activity1';
import {deviceLabel} from './visit-labels.js?v=20261120-complete2';
const format=new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'medium',timeZone:'America/Fortaleza'});
const kinds={section_view:'Visualização de seção',project_open:'Abertura de projeto',project_link:'Clique no link do projeto',contact_click:'Clique em contato',engagement:'Tempo ativo registrado'};
const cell=text=>{const e=document.createElement('td');e.textContent=String(text??'');return e};
export function visitTimeline(getClient,isActive){
 const $=id=>document.getElementById(id),panel=$('visit-timeline-panel');
 let visit=null,days=30,before=null,next=null,history=[],version=0,busy=false,report=null,projects=new Map();
 const current=(request,owner)=>request===version&&owner===getClient()&&isActive();
 const subject=e=>e.kind==='contact_click'?(e.subject==='whatsapp'?'WhatsApp':'E-mail'):e.kind==='section_view'?sectionNames[e.subject]||e.subject:e.subject.startsWith('section:')?sectionNames[e.subject.slice(8)]||e.subject:projects.get(e.subject)||e.subject;
 const seconds=e=>e.seconds===null?'—':duration(e.seconds);
 const controls=()=>{
  $('visit-timeline-previous').disabled=busy||!history.length;
  $('visit-timeline-next').disabled=busy||next===null;
  $('visit-timeline-export').disabled=busy||!report?.total_events;
  $('visit-timeline-retry').disabled=busy;
 };
 const query=(owner,cursor)=>owner.rpc('admin_visit_events',{p_visit_id:visit.visit_id,p_days:days,p_before_event_id:cursor});
 async function load(){
  const request=++version,owner=getClient();busy=true;report=null;controls();
  $('visit-timeline-rows').replaceChildren();$('visit-timeline-empty').hidden=true;
  $('visit-timeline-summary').textContent='';$('visit-timeline-status').textContent='Carregando atividade desta visita…';
  try{
   const {data,error}=await query(owner,before);
   if(!current(request,owner))return;
   if(error||!Array.isArray(data?.events))throw Error('Unavailable');
   report=data;next=data.next_cursor;
   const v=data.visit;
   $('visit-timeline-summary').textContent=v?`${v.ip} · Visita ${v.visit_id} · ${deviceLabel(v).label} · ${v.os==='unknown'?'Sistema não identificado':v.os} · ${v.browser==='unknown'?'Navegador não identificado':v.browser} · ${v.source||'Origem não registrada'} · ${data.total_events} eventos no período.`:'Visita indisponível neste período.';
   const fragment=document.createDocumentFragment();
   for(const e of data.events){const row=document.createElement('tr');row.append(cell(format.format(new Date(e.at))),cell(kinds[e.kind]||e.kind),cell(subject(e)),cell(seconds(e)));fragment.append(row)}
   $('visit-timeline-rows').replaceChildren(fragment);$('visit-timeline-empty').hidden=data.events.length!==0;
   $('visit-timeline-status').textContent='Eventos mais recentes primeiro. Tempos aproximados; horários indicam o recebimento dos registros.';
  }catch{if(current(request,owner)){$('visit-timeline-status').textContent='Não foi possível carregar a atividade. Tente novamente ou entre no painel novamente.';next=null}}
  finally{if(request===version){busy=false;controls()}}
 }
 function clear(){version++;visit=null;before=null;next=null;history=[];busy=false;report=null;panel.hidden=true;$('visit-timeline-rows').replaceChildren();for(const id of ['visit-timeline-title','visit-timeline-summary','visit-timeline-status'])$(id).textContent='';controls()}
 $('visit-timeline-close').addEventListener('click',()=>{clear();$('project-ranking-title').focus()});
 $('visit-timeline-retry').addEventListener('click',()=>{if(!busy&&visit)load()});
 $('visit-timeline-next').addEventListener('click',()=>{if(busy||next===null)return;history.push(before);before=next;load()});
 $('visit-timeline-previous').addEventListener('click',()=>{if(busy||!history.length)return;before=history.pop();load()});
 $('visit-timeline-export').addEventListener('click',async()=>{
  if(busy||!visit||!report)return;
  const request=++version,owner=getClient(),selected={...visit};busy=true;controls();
  const rows=[['Visita','IP','Horário (Brasília)','Evento','Item','Tempo ativo (segundos)']];let cursor=null;
  try{
   for(let page=0;page<201;page++){
    const {data,error}=await query(owner,cursor);if(!current(request,owner))return;
    if(error||!Array.isArray(data?.events))throw Error('Não foi possível exportar esta atividade.');
    if(page===200&&data.events.length)throw Error('Selecione um período menor para exportar.');
    for(const e of data.events)rows.push([selected.visit_id,data.visit?.ip||selected.ip,format.format(new Date(e.at)),kinds[e.kind]||e.kind,subject(e),e.seconds]);
    cursor=data.next_cursor;if(cursor===null)break;
   }
   if(current(request,owner)){downloadCsv(`portfolio-visita-${selected.visit_id}-atividade.csv`,rows);$('visit-timeline-status').textContent=`CSV preparado com ${rows.length-1} eventos.`}
  }catch(e){if(current(request,owner))$('visit-timeline-status').textContent=e.message}
  finally{if(request===version){busy=false;controls()}}
 });
 clear();
 return{
  clear,
  setProjects(items){projects=new Map(items.map(p=>[p.id,p.title]))},
  open(selected,period){visit={visit_id:selected.visit_id,ip:selected.ip};days=period;before=null;next=null;history=[];$('visit-timeline-title').textContent='Atividade da visita · '+selected.ip;panel.hidden=false;panel.scrollIntoView({behavior:'smooth',block:'start'});$('visit-timeline-title').focus({preventScroll:true});return load()},
  refresh(period){if(!visit)return;days=period;before=null;next=null;history=[];return load()}
 };
}
