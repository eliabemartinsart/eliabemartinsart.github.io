import { createClient } from '@supabase/supabase-js';
import config from '../../admin/config.js';
if (window.self !== window.top) { document.body.replaceChildren(document.createTextNode('Abra o painel diretamente no navegador.')); throw new Error('Framed access is disabled'); }
const $ = (id) => document.getElementById(id);
let client, factorId, cursor = null, nextCursor = null, history = [], loading = false, generation = 0;
const format = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium', timeZone: 'America/Fortaleza' });
const status = (message) => { $('auth-status').textContent = message; };
const configured = /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.url) && config.publishableKey.length > 20;
const cleanView = () => { $('dashboard').hidden = true; $('auth-view').hidden = false; $('mfa-form').hidden = true; $('login-form').hidden = false; $('visits').replaceChildren(); $('password').value = ''; $('mfa-code').value = ''; $('mfa-qr').hidden = true; $('mfa-qr').removeAttribute('src'); factorId = null; cursor = null; history = []; };
async function leave() { generation++; cleanView(); for (const id of ['total','unique','latest']) $(id).textContent = '—'; try { if (client) await client.auth.signOut({ scope: 'local' }); } finally { status('Você saiu do painel.'); } }
async function secondFactor() {
  const { data, error } = await client.auth.mfa.listFactors();
  if (error) throw error;
  const verified = data.totp.find(f => f.status === 'verified');
  if (verified) {
    factorId = verified.id;
    $('mfa-instructions').textContent = 'Digite o código do seu aplicativo autenticador.';
  } else {
    for (const f of data.totp.filter(f => f.status === 'unverified')) await client.auth.mfa.unenroll({ factorId: f.id });
    const { data: enrollment, error: enrollError } = await client.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Painel Eliabe' });
    if (enrollError) throw enrollError;
    factorId = enrollment.id;
    $('mfa-qr').src = enrollment.totp.qr_code.startsWith('data:') ? enrollment.totp.qr_code : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(enrollment.totp.qr_code)}`;
    $('mfa-qr').hidden = false;
    $('mfa-instructions').textContent = 'Adicione este QR code ao seu autenticador e digite o código para ativar a segunda verificação.';
  }
  $('login-form').hidden = true; $('mfa-form').hidden = false; status(''); $('mfa-code').focus();
}
$('login-form').addEventListener('submit', async (event) => {
  event.preventDefault(); if (!client || loading) return;
  loading = true; $('login-fields').disabled = true; status('Verificando acesso…');
  try {
    const { error } = await client.auth.signInWithPassword({ email: $('email').value.trim(), password: $('password').value });
    if (error) throw error;
    await secondFactor();
  } catch (error) {
    await client.auth.signOut({ scope: 'local' }); cleanView();
    status(error?.status === 429 ? 'Muitas tentativas. Aguarde antes de tentar novamente.' : 'Não foi possível entrar. Confira os dados ou tente novamente mais tarde.');
  } finally { $('password').value = ''; loading = false; $('login-fields').disabled = false; }
});
$('mfa-form').addEventListener('submit', async (event) => {
  event.preventDefault(); if (!factorId || loading) return;
  loading = true; const button = $('mfa-form').querySelector('[type=submit]'); button.disabled = true; status('Verificando código…');
  try {
    const { error } = await client.auth.mfa.challengeAndVerify({ factorId, code: $('mfa-code').value.trim() });
    if (error) throw error;
    await loadVisits();
    $('mfa-qr').removeAttribute('src'); $('auth-view').hidden = true; $('dashboard').hidden = false;
  } catch { status('Não foi possível autorizar o acesso. Confira o código ou tente novamente mais tarde.'); }
  finally { $('mfa-code').value = ''; loading = false; button.disabled = false; }
});
async function loadVisits() {
  const requestGeneration = generation;
  $('data-status').textContent = 'Carregando registros…';
  const { data, error } = await client.rpc('admin_visit_report', { p_days: Number($('period').value), p_before_id: cursor });
  if (requestGeneration !== generation) throw new Error('Session changed');
  if (error) { $('visits').replaceChildren(); $('data-status').textContent = 'Acesso não autorizado ou sessão expirada.'; throw error; }
  $('total').textContent = String(data.total); $('unique').textContent = String(data.unique_ips); $('latest').textContent = data.latest ? format.format(new Date(data.latest)) : 'Sem registros';
  const fragment = document.createDocumentFragment();
  for (const visit of data.visits) {
    const row = document.createElement('tr'); const date = document.createElement('td'); const ip = document.createElement('td');
    date.textContent = format.format(new Date(visit.at)); ip.textContent = visit.ip; row.append(date, ip); fragment.append(row);
  }
  $('visits').replaceChildren(fragment); $('empty').hidden = data.visits.length !== 0;
  nextCursor = data.next_cursor; $('previous').disabled = history.length === 0; $('next').disabled = nextCursor === null;
  $('data-status').textContent = `Atualizado em ${format.format(new Date())}.`;
}
async function refresh() { if (loading) return; loading = true; try { await loadVisits(); } catch { await leave(); status('Sessão expirada ou acesso não autorizado. Entre novamente.'); } finally { loading = false; } }
$('period').addEventListener('change', () => { cursor = null; history = []; refresh(); });
$('refresh').addEventListener('click', refresh);
$('next').addEventListener('click', () => { if (loading || nextCursor === null) return; history.push(cursor); cursor = nextCursor; refresh(); });
$('previous').addEventListener('click', () => { if (loading || !history.length) return; cursor = history.pop(); refresh(); });
$('logout').addEventListener('click', leave); $('mfa-cancel').addEventListener('click', leave);
if (configured) {
  client = createClient(config.url, config.publishableKey, { auth: { persistSession: false, autoRefreshToken: true, detectSessionInUrl: false } });
  $('login-fields').disabled = false; status('');
}
