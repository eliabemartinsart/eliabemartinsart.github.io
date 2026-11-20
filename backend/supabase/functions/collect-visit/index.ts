import {createClient} from 'npm:@supabase/supabase-js@2.119.2';
import {isIP} from 'node:net';
const publicKey="sb_publishable_KrEo1iWfTSU5aJ5YUzn99w_tFL80WMV";
const origin='https://eliabemartinsart.github.io';
const headers={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST,OPTIONS','Access-Control-Allow-Headers':'content-type,apikey','Cache-Control':'no-store','Vary':'Origin','X-Content-Type-Options':'nosniff'};
Deno.serve(async(request:Request)=>{
 if(request.headers.get('origin')!==origin)return new Response(null,{status:403});
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(request.method!=='POST')return new Response(null,{status:405,headers});
 if(request.headers.get('apikey')!==publicKey)return new Response(null,{status:401,headers});
 if(Number(request.headers.get('content-length')||0)>128)return new Response(null,{status:413,headers});
 // Cloudflare supplies this single client-IP header to the managed origin.
 // Never accept IP addresses from the request body or arbitrary X-Forwarded-For.
 const ip=(request.headers.get('cf-connecting-ip')||'').trim();
 if(!isIP(ip))return new Response(null,{status:503,headers});
 try{
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  const {error}=await db.rpc('record_site_visit',{p_ip:ip});
  return new Response(null,{status:error?503:204,headers});
 }catch{return new Response(null,{status:503,headers});}
});