import {deviceLabel,networkLabel} from './visit-labels.js?v=20261120-complete2';
import {duration,downloadCsv} from './dashboard.js?v=20261122-project1';

const format=new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'medium',timeZone:'America/Fortaleza'});
const time=value=>value?format.format(new Date(value)):'Não registrado';
const measured=value=>value===null||value===undefined?'Não medido':duration(value);
const cell=value=>{const td=document.createElement('td');td.textContent=String(value??'Não disponível');return td};

export function projectVisits(getClient,isActive){
 const $=id=>document.getElementById(id),panel=$('project-access-panel');
 let selected=null,days=30,cursor=null,next=null,history=[],version=0,busy=false,report=null;
 const valid=(request,owner)=>request===version&&owner===getClient()&&isActive();
 function controls(){
  $('project-access-previous').disabled=busy||!history.length;
  $('project-access-next').disabled=busy||next===null;
  $('project-access-export').disabled=busy||!report?.total_visits;
  $('project-access-retry').disabled=busy;
 }
 function render(data){
  report=data;next=data.next_cursor;
  $('project-access-summary').textContent=`${data.unique_ips} IPs distintos · ${data.total_visits} visitas ao projeto · ${data.opens} aberturas · Tempo ativo medido: ${measured(data.active_seconds)}.`;
  const fragment=document.createDocumentFragment();
  for(const v of data.visits){
   const row=document.createElement('tr'),device=deviceLabel(v),network=networkLabel(v);
   row.append(cell(time(v.first_at)),cell(v.ip));
   for(const key of ['city','region','country'])row.append(cell(v[key]||'Não disponível'));
   row.append(cell(device.label),cell(v.os==='unknown'?'Não disponível':v.os),cell(v.browser==='unknown'?'Não disponível':v.browser),cell(v.source||'Não registrado'));
   const net=cell(network.label);net.title='Sinais já disponíveis; ausência de indícios não comprova ausência de VPN.';
   row.append(net,cell(v.opens),cell(v.clicks),cell(measured(v.active_seconds)),cell(time(v.last_at)));
   fragment.append(row);
  }
  $('project-access-rows').replaceChildren(fragment);
  $('project-access-empty').hidden=data.visits.length!==0;
  $('project-access-status').textContent=data.unmeasured_visits?`${data.unmeasured_visits} visita(s) sem medição de tempo. Os demais tempos são aproximados.`:'Dados atualizados. Os tempos são aproximados.';
 }
 async function load(){
  const request=++version,owner=getClient();busy=true;report=null;controls();
  $('project-access-rows').replaceChildren();$('project-access-empty').hidden=true;
  $('project-access-summary').textContent='';$('project-access-status').textContent='Carregando acessos deste projeto…';
  try{
   const {data,error}=await owner.rpc('admin_project_visits',{p_project_id:selected.id,p_days:days,p_before_visit_id:cursor});
   if(!valid(request,owner))return;
   if(error||!Array.isArray(data?.visits))throw Error('Report unavailable');
   render(data);
  }catch{
   if(valid(request,owner)){$('project-access-status').textContent='Não foi possível carregar os acessos. Tente novamente ou entre no painel novamente.';next=null;}
  }finally{if(request===version){busy=false;controls()}}
 }
 function clear(){
  version++;selected=null;cursor=null;next=null;history=[];report=null;busy=false;
  panel.hidden=true;$('project-access-rows').replaceChildren();
  for(const id of ['project-access-title','project-access-summary','project-access-status'])$(id).textContent='';
  controls();
 }
 $('project-access-close').addEventListener('click',()=>{clear();$('project-ranking-title').focus()});
 $('project-access-retry').addEventListener('click',()=>{if(!busy&&selected)load()});
 $('project-access-previous').addEventListener('click',()=>{if(busy||!history.length)return;cursor=history.pop();load()});
 $('project-access-next').addEventListener('click',()=>{if(busy||next===null)return;history.push(cursor);cursor=next;load()});
 $('project-access-export').addEventListener('click',async()=>{
  if(busy||!selected||!report)return;
  const request=++version,owner=getClient(),project=selected;busy=true;controls();
  const rows=[['Projeto','Visita','Primeiro registro no projeto (Brasília)','Último registro no projeto (Brasília)','IP','Cidade','Estado / região','País','Aparelho','Sistema','Navegador','Origem','VPN / proxy','Aberturas','Cliques no link','Tempo ativo no projeto (segundos)']];
  let before=null;
  try{
   for(let page=0;page<201;page++){
    const {data,error}=await owner.rpc('admin_project_visits',{p_project_id:project.id,p_days:days,p_before_visit_id:before});
    if(!valid(request,owner))return;
    if(error||!Array.isArray(data?.visits))throw Error('Não foi possível exportar. Tente novamente.');
    if(page===200&&data.visits.length)throw Error('Selecione um período menor para exportar este volume de acessos.');
    for(const v of data.visits)rows.push([project.title,v.visit_id,time(v.first_at),time(v.last_at),v.ip,v.city,v.region,v.country,deviceLabel(v).label,v.os,v.browser,v.source,networkLabel(v).label,v.opens,v.clicks,v.active_seconds]);
    before=data.next_cursor;if(before===null)break;
   }
   if(valid(request,owner)){downloadCsv(`portfolio-${project.id}-acessos-${days}dias.csv`,rows);$('project-access-status').textContent=`CSV preparado com ${rows.length-1} visitas ao projeto.`}
  }catch(error){if(valid(request,owner))$('project-access-status').textContent=error.message}
  finally{if(request===version){busy=false;controls()}}
 });
 clear();
 return {
  clear,
  open(project,period){
   selected={id:project.id,title:project.title};days=period;cursor=null;next=null;history=[];
   $('project-access-title').textContent='Acessos a '+project.title;panel.hidden=false;
   panel.scrollIntoView({behavior:'smooth',block:'start'});$('project-access-title').focus({preventScroll:true});
   return load();
  },
  refresh(period){if(!selected)return;days=period;cursor=null;next=null;history=[];return load()}
 };
}
