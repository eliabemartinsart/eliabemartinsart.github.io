import{createClient}from'npm:@supabase/supabase-js@2.119.2';import{isIP}from'node:net';
const publicKey='sb_publishable_KrEo1iWfTSU5aJ5YUzn99w_tFL80WMV',origin='https://eliabemartinsart.github.io';
const headers={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST,OPTIONS','Access-Control-Allow-Headers':'content-type,apikey','Cache-Control':'no-store','Vary':'Origin','X-Content-Type-Options':'nosniff'};
async function readBody(request:Request,max:number){const reader=request.body?.getReader();if(!reader)return '';const decoder=new TextDecoder();let n=0,text='';try{for(;;){const r=await reader.read();if(r.done)break;n+=r.value.length;if(n>max)throw new Error('Body too large');text+=decoder.decode(r.value,{stream:true})}return text+decoder.decode()}finally{await reader.cancel().catch(()=>{})}}
Deno.serve(async(request:Request)=>{
 if(request.headers.get('origin')!==origin)return new Response(null,{status:403});
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(request.method!=='POST')return new Response(null,{status:405,headers});
 if(request.headers.get('apikey')!==publicKey)return new Response(null,{status:401,headers});
 if(Number(request.headers.get('content-length')||0)>12000)return new Response(null,{status:413,headers});
 const ip=(request.headers.get('cf-connecting-ip')||'').trim();if(!isIP(ip))return new Response(null,{status:503,headers});
 try{const body=JSON.parse(await readBody(request,12000));if(!body||Object.keys(body).some(k=>!['token','events'].includes(k))||typeof body.token!=='string'||!/^[0-9a-f-]{36}$/i.test(body.token)||!Array.isArray(body.events)||body.events.length>20)return new Response(null,{status:400,headers});
 const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
 const{error}=await db.rpc('record_site_events',{p_ip:ip,p_token:body.token,p_events:body.events});return new Response(null,{status:error?400:204,headers});
 }catch{return new Response(null,{status:400,headers})}
});
