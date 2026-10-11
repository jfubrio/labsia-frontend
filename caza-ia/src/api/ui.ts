/**
 * Página mínima del operador: lista propuestas pendientes y permite aprobar o rechazar.
 * El token se pide una vez y se guarda en sessionStorage. Es una herramienta interna de fase 5, no la UI final.
 */
export function operatorPage(): string {
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>CAZA IA — propuestas</title>
<style>
  :root { color-scheme: light dark; --fg: #1a1a1a; --bg: #fafafa; --card: #fff; --muted: #666; --ok: #1b7f3b; --no: #a3261f; --line: #ddd; }
  @media (prefers-color-scheme: dark) { :root { --fg: #eee; --bg: #111; --card: #1c1c1c; --muted: #aaa; --line: #333; } }
  body { margin: 0; padding: 16px; font: 15px/1.45 system-ui, sans-serif; color: var(--fg); background: var(--bg); }
  h1 { font-size: 20px; margin: 0 0 4px; } .sub { color: var(--muted); margin-bottom: 16px; }
  .card { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 14px; margin-bottom: 12px; }
  .row { display: flex; flex-wrap: wrap; gap: 8px 18px; margin: 6px 0; } .k { color: var(--muted); font-size: 13px; }
  .big { font-size: 22px; font-weight: 600; } button { font: inherit; padding: 8px 14px; border-radius: 8px; border: 1px solid var(--line); cursor: pointer; background: var(--card); color: var(--fg); }
  button.ok { border-color: var(--ok); color: var(--ok); } button.no { border-color: var(--no); color: var(--no); }
  input { font: inherit; padding: 6px 8px; border-radius: 6px; border: 1px solid var(--line); background: var(--card); color: var(--fg); max-width: 100%; }
  .msg { margin: 8px 0; color: var(--muted); } .warn { color: var(--no); }
</style></head><body>
<h1>CAZA IA — propuestas pendientes</h1>
<div class="sub">Aprobar no compra: habilita al ejecutor (fase 6, deshabilitado) a crear una orden mientras la autorización esté vigente.</div>
<div class="row"><label>Operador <input id="who" placeholder="tu@correo" /></label><label>Token <input id="tok" type="password" /></label><button id="reload">Actualizar</button></div>
<div id="msg" class="msg"></div>
<div id="list"></div>
<script>
const $ = (s) => document.querySelector(s);
$('#who').value = sessionStorage.getItem('caza.who') || ''; $('#tok').value = sessionStorage.getItem('caza.tok') || '';
const headers = () => ({ 'content-type': 'application/json', 'x-caza-token': $('#tok').value });
// Todo texto que viene de la base de datos puede venir de una tienda o de la ingesta externa: se escapa siempre.
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const safeUrl = (u) => /^https?:/i.test(String(u ?? '')) ? esc(u) : '';
const fmt = (n, c) => Number(n).toLocaleString('es-MX', { style: 'currency', currency: c.trim() });
async function load() {
  sessionStorage.setItem('caza.who', $('#who').value); sessionStorage.setItem('caza.tok', $('#tok').value);
  $('#msg').textContent = 'Cargando…';
  const r = await fetch('/api/v1/caza/proposals?estado=pendiente', { headers: headers() });
  if (!r.ok) { $('#msg').innerHTML = '<span class="warn">' + (r.status === 401 ? 'Token inválido' : 'Error ' + r.status) + '</span>'; return; }
  const rows = await r.json(); $('#msg').textContent = rows.length ? rows.length + ' pendiente(s)' : 'Sin propuestas pendientes';
  $('#list').innerHTML = rows.map(p => \`
    <div class="card" data-id="\${esc(p.id)}">
      <div class="row"><span class="big">\${esc(fmt(p.precio, p.moneda))}</span><span>\${esc(p.product_nombre)}</span><span class="k">\${esc(p.tienda)}</span></div>
      <div class="row"><span><span class="k">aterrizado</span> \${esc(fmt(p.precio_aterrizado_base, p.moneda_base))}\${p.buzon ? ' vía ' + esc(p.buzon) : ''}</span>
        <span><span class="k">objetivo</span> \${esc(fmt(p.precio_objetivo, p.moneda_base))}\${p.objetivo_derivado ? ' (derivado)' : ''}</span>
        <span><span class="k">veredicto</span> \${esc(p.veredicto)} · \${esc(p.confianza)}</span>
        <span><span class="k">expira</span> \${esc(new Date(p.expira_en).toLocaleString('es-MX'))}</span></div>
      <div class="k">\${esc(p.motivo)}</div>
      \${safeUrl(p.url) ? '<div><a href="' + safeUrl(p.url) + '" target="_blank" rel="noopener noreferrer">ver oferta</a></div>' : ''}
      <div class="row"><button class="ok" data-act="approve">Aprobar</button><button class="no" data-act="reject">Rechazar</button></div>
    </div>\`).join('');
}
$('#list').addEventListener('click', async (e) => {
  const b = e.target.closest('button[data-act]'); if (!b) return;
  const id = b.closest('.card').dataset.id, act = b.dataset.act;
  const who = $('#who').value.trim(); if (!who) { $('#msg').innerHTML = '<span class="warn">Indica el operador</span>'; return; }
  const motivo = act === 'reject' ? (prompt('Motivo del rechazo (opcional)') || undefined) : undefined;
  if (!confirm((act === 'approve' ? 'Aprobar' : 'Rechazar') + ' esta propuesta como ' + who + '?')) return;
  const r = await fetch('/api/v1/caza/proposals/' + id + '/' + act, { method: 'POST', headers: headers(), body: JSON.stringify({ decididoPor: who, motivo }) });
  const j = await r.json(); $('#msg').innerHTML = r.ok ? 'Propuesta ' + esc(j.proposal.estado) : '<span class="warn">' + esc(j.error || 'Error') + '</span>';
  if (r.ok) load();
});
$('#reload').addEventListener('click', load); if ($('#tok').value) load();
</script></body></html>`
}
