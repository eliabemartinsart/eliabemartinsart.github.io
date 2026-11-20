export function networkLabel(visit) {
  const found = [];
  if (visit.vpn === true) found.push('Possível VPN');
  if (visit.proxy === true) found.push('Possível proxy');
  if (visit.tor === true) found.push('Saída Tor listada');
  if (found.length) return { label: found.join(' · '), suspected: true };
  const signals = [visit.vpn, visit.proxy, visit.tor];
  if (signals.every(value => value === false)) return { label: 'Sem indícios nas listas', suspected: false };
  if (signals.some(value => value === false)) return { label: 'Verificação parcial', suspected: false };
  return { label: 'Não verificado', suspected: false };
}
export function deviceLabel(visit) {
  const types = { computer: 'Computador', mobile: 'Celular', tablet: 'Tablet', bot: 'Automação', unknown: 'Não identificado' };
  return { label: Object.hasOwn(types, visit.device) ? types[visit.device] : 'Não registrado',
    detail: [visit.os, visit.browser].filter(value => typeof value === 'string' && value !== 'unknown' && value.length <= 32).join(' · ') };
}
