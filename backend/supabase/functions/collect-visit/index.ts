import{createClient}from'npm:@supabase/supabase-js@2.119.2';import{isIP}from'node:net';import{classifyDevice}from'./device.ts';
const publicKey='sb_publishable_KrEo1iWfTSU5aJ5YUzn99w_tFL80WMV',origin='https://eliabemartinsart.github.io';
const headers={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST,OPTIONS','Access-Control-Allow-Headers':'content-type,apikey','Cache-Control':'no-store','Vary':'Origin','X-Content-Type-Options':'nosniff','Content-Type':'application/json'};
async function readBody(request:Request,max:number){const reader=request.body?.getReader();if(!reader)return '';const decoder=new TextDecoder();let n=0,text='';try{for(;;){const r=await reader.read();if(r.done)break;n+=r.value.length;if(n>max)throw new Error('Body too large');text+=decoder.decode(r.value,{stream:true})}return text+decoder.decode()}finally{await reader.cancel().catch(()=>{})}}
Deno.serve(async(request:Request)=>{
 if(request.headers.get('origin')!==origin)return new Response(null,{status:403});
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(request.method!=='POST')return new Response(null,{status:405,headers});
 if(request.headers.get('apikey')!==publicKey)return new Response(null,{status:401,headers});
 if(Number(request.headers.get('content-length')||0)>256)return new Response(null,{status:413,headers});
 const ip=(request.headers.get('cf-connecting-ip')||'').trim();if(!isIP(ip))return new Response(null,{status:503,headers});
 try{const body=JSON.parse((await readBody(request,256))||'{}');if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>k!=='source')||(body.source!==undefined&&typeof body.source!=='string'))return new Response(null,{status:400,headers});
 const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}}),device=classifyDevice(request.headers.get('user-agent')),token=crypto.randomUUID();
 if(body.source===undefined){const legacy=await db.rpc('record_site_visit_details',{p_ip:ip,p_device:device.device,p_os:device.os,p_browser:device.browser});return new Response(null,{status:legacy.error?503:204,headers})}
 const{data,error}=await db.rpc('begin_site_visit',{p_ip:ip,p_device:device.device,p_os:device.os,p_browser:device.browser,p_source:body.source||null,p_token:token});
 if(error)return new Response(null,{status:503,headers});return data===true?new Response(JSON.stringify({token}),{status:200,headers}):new Response(null,{status:204,headers});
 }catch{return new Response(null,{status:400,headers})}
});
