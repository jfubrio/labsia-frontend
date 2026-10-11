/**
 * Dashboard en tiempo real. Se conecta a /api/v1/caza/metrics/stream (SSE) y repinta con cada evento.
 * Sin dependencias externas: SVG dibujado a mano. Paleta validada (dataviz): serie MX azul, serie US naranja;
 * estados con icono + etiqueta, nunca solo color. Una gráfica por mercado (monedas distintas: nunca dos ejes).
 */
export function dashboardPage(): string {
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>CAZA IA — tablero</title>
<style>
  :root { color-scheme: light; --surface-1:#fcfcfb; --surface-2:#f0efec; --text-primary:#0b0b0b; --text-secondary:#52514e; --text-muted:#86847e; --line:#dddcd7;
          --series-mx:#2a78d6; --series-us:#eb6834; --good:#0ca30c; --warning:#fab219; --serious:#ec835a; --critical:#d03b3b; }
  @media (prefers-color-scheme: dark) { :root:where(:not([data-theme="light"])) { color-scheme: dark; --surface-1:#1a1a19; --surface-2:#242423; --text-primary:#f0efec; --text-secondary:#c3c2b7; --text-muted:#8f8e86; --line:#383835; --series-mx:#3987e5; --series-us:#d95926; } }
  :root[data-theme="dark"] { color-scheme: dark; --surface-1:#1a1a19; --surface-2:#242423; --text-primary:#f0efec; --text-secondary:#c3c2b7; --text-muted:#8f8e86; --line:#383835; --series-mx:#3987e5; --series-us:#d95926; }
  * { box-sizing: border-box; }
  body { margin:0; padding:16px; font:15px/1.45 system-ui,sans-serif; color:var(--text-primary); background:var(--surface-1); }
  header { display:flex; flex-wrap:wrap; align-items:baseline; gap:8px 16px; margin-bottom:12px; }
  h1 { font-size:20px; margin:0; } h2 { font-size:16px; margin:18px 0 8px; } h3 { font-size:14px; margin:0 0 4px; color:var(--text-secondary); font-weight:600; }
  .sub { color:var(--text-secondary); } .muted { color:var(--text-muted); font-size:13px; }
  .live { display:inline-flex; align-items:center; gap:6px; font-size:13px; color:var(--text-secondary); } .dot { width:8px; height:8px; border-radius:50%; background:var(--text-muted); }
  .dot.on { background:var(--good); } .dot.off { background:var(--critical); }
  .tiles { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:10px; }
  .tile { background:var(--surface-2); border:1px solid var(--line); border-radius:10px; padding:12px 14px; min-height:84px; }
  .tile .k { font-size:12px; color:var(--text-secondary); text-transform:uppercase; letter-spacing:.03em; }
  .tile .v { font-size:28px; font-weight:600; line-height:1.15; margin-top:4px; font-variant-numeric:tabular-nums; }
  .tile .s { font-size:12px; color:var(--text-muted); margin-top:2px; }
  .status { display:inline-flex; align-items:center; gap:5px; font-size:13px; font-weight:600; }
  .status .i { width:10px; height:10px; border-radius:2px; display:inline-block; }
  .status.good .i { background:var(--good); } .status.warning .i { background:var(--warning); } .status.critical .i { background:var(--critical); } .status.serious .i { background:var(--serious); }
  .cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(320px,1fr)); gap:12px; }
  .card { background:var(--surface-2); border:1px solid var(--line); border-radius:10px; padding:12px 14px; }
  .row { display:flex; flex-wrap:wrap; gap:4px 14px; font-size:13px; color:var(--text-secondary); margin:4px 0 8px; }
  .row b { color:var(--text-primary); font-variant-numeric:tabular-nums; font-weight:600; }
  .chart { position:relative; width:100%; }
  .chart svg { width:100%; height:180px; display:block; overflow:visible; }
  .axis { stroke:var(--line); stroke-width:1; } .grid { stroke:var(--line); stroke-width:1; stroke-dasharray:2 4; }
  .lbl { font-size:11px; fill:var(--text-muted); } .ref { stroke-width:1.5; stroke-dasharray:4 4; } .reflbl { font-size:11px; fill:var(--text-secondary); }
  .line { fill:none; stroke-width:2; stroke-linejoin:round; stroke-linecap:round; }
  .mx .line, .mx .mark { stroke:var(--series-mx); } .us .line, .us .mark { stroke:var(--series-us); }
  .mark { fill:var(--surface-2); stroke-width:2; } .endlbl { font-size:12px; font-weight:600; fill:var(--text-primary); }
  .hair { stroke:var(--text-muted); stroke-width:1; display:none; } .hit { fill:transparent; }
  .tip { position:absolute; pointer-events:none; background:var(--surface-1); border:1px solid var(--line); border-radius:6px; padding:6px 8px; font-size:12px; color:var(--text-primary); display:none; white-space:nowrap; box-shadow:0 2px 8px rgba(0,0,0,.12); }
  table { width:100%; border-collapse:collapse; font-size:13px; } th, td { text-align:left; padding:5px 6px; border-bottom:1px solid var(--line); } th { color:var(--text-secondary); font-weight:600; } td.n { text-align:right; font-variant-numeric:tabular-nums; }
  details summary { cursor:pointer; color:var(--text-secondary); font-size:13px; margin-top:6px; }
  input { font:inherit; padding:6px 8px; border-radius:6px; border:1px solid var(--line); background:var(--surface-2); color:var(--text-primary); }
  button { font:inherit; padding:6px 12px; border-radius:6px; border:1px solid var(--line); background:var(--surface-2); color:var(--text-primary); cursor:pointer; }
  .warn { color:var(--critical); }
</style></head><body>
<header>
  <h1>CAZA IA — tablero</h1>
  <span class="live"><span id="dot" class="dot"></span><span id="livetxt">sin conexión</span></span>
  <span class="sub" id="gen"></span>
  <span style="margin-left:auto"><label class="muted">Token <input id="tok" type="password" size="18"></label> <button id="go">Conectar</button></span>
</header>
<div id="msg" class="muted"></div>
<section id="tiles" class="tiles"></section>
<h2>Productos vigilados</h2>
<section id="products" class="cards"></section>
<div class="cards" style="margin-top:12px">
  <section class="card"><h3>Últimas propuestas</h3><div id="proposals"></div></section>
  <section class="card"><h3>Últimas alertas</h3><div id="alerts"></div></section>
</div>
<script>
const $ = (s) => document.querySelector(s);
const fmtMoney = (n, c) => n == null ? '—' : Number(n).toLocaleString('es-MX', { style: 'currency', currency: c, maximumFractionDigits: 0 });
const fmtTime = (iso) => iso ? new Date(iso).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }) : '—';
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
const status = (kind, label) => '<span class="status ' + kind + '"><span class="i"></span>' + esc(label) + '</span>';
$('#tok').value = sessionStorage.getItem('caza.tok') || '';
let es = null;
function connect() {
  const tok = $('#tok').value.trim(); if (!tok) { $('#msg').innerHTML = '<span class="warn">Indica el token de la API</span>'; return; }
  sessionStorage.setItem('caza.tok', tok); if (es) es.close();
  es = new EventSource('/api/v1/caza/metrics/stream?token=' + encodeURIComponent(tok));
  es.onopen = () => { $('#dot').className = 'dot on'; $('#livetxt').textContent = 'en vivo'; $('#msg').textContent = ''; };
  es.onerror = () => { $('#dot').className = 'dot off'; $('#livetxt').textContent = 'reconectando…'; };
  es.addEventListener('metrics', (e) => render(JSON.parse(e.data)));
}
$('#go').addEventListener('click', connect); if ($('#tok').value) connect();

function render(m) {
  $('#gen').textContent = 'actualizado ' + fmtTime(m.generadoEn);
  const g = m.gasto;
  const comprasSt = m.compras.habilitadasEnDb ? status('critical', 'compras HABILITADAS') : status('good', 'compras deshabilitadas');
  const vigSt = m.vigilancia.errores24h > 0 ? status('critical', m.vigilancia.errores24h + ' error(es) 24 h') : m.vigilancia.corridas24h > 0 ? status('good', 'sin errores 24 h') : status('warning', 'sin corridas 24 h');
  const alSt = m.alertas.fallidas24h > 0 ? status('serious', m.alertas.fallidas24h + ' fallida(s)') : status('good', 'todas enviadas');
  const gastoPct = g ? Math.min(100, Math.round(g.comprometidoMes / g.presupuestoMensual * 100)) : 0;
  const gastoSt = !g ? status('warning', 'sin límite') : gastoPct >= 90 ? status('critical', gastoPct + '% del presupuesto') : gastoPct >= 60 ? status('warning', gastoPct + '% del presupuesto') : status('good', gastoPct + '% del presupuesto');
  $('#tiles').innerHTML = [
    tile('Propuestas pendientes', m.propuestas.pendientes, m.propuestas.aprobadas30d + ' aprobadas · ' + m.propuestas.rechazadas30d + ' rechazadas · ' + m.propuestas.expiradas30d + ' expiradas (30 d)', m.propuestas.pendientes > 0 ? status('warning', 'requieren approve') : status('good', 'nada por decidir')),
    tile('Productos vigilados', m.productos.vigilados + ' / ' + m.productos.total, 'con vigilancia activa', m.productos.vigilados ? status('good', 'vigilando') : status('warning', 'vigilancia apagada')),
    tile('Corridas 24 h', m.vigilancia.corridas24h, m.vigilancia.observaciones24h + ' observaciones · última ' + fmtTime(m.vigilancia.ultimaCorrida), vigSt),
    tile('Alertas 24 h', m.alertas.enviadas24h, 'enviadas', alSt),
    tile('Presupuesto disponible', g ? fmtMoney(g.disponible, g.monedaBase) : '—', g ? fmtMoney(g.comprometidoMes, g.monedaBase) + ' comprometido de ' + fmtMoney(g.presupuestoMensual, g.monedaBase) + ' · ' + g.compromisosMes + '/' + g.maxOrdenesMes + ' compras' : '', gastoSt),
    tile('Órdenes activas', m.compras.ordenesActivas, m.compras.ordenesTotales + ' en total', comprasSt),
  ].join('');
  $('#products').innerHTML = m.porProducto.map(productCard).join('') || '<div class="muted">Sin productos</div>';
  m.porProducto.forEach((p) => p.mercados.forEach((mk) => drawChart(p, mk)));
  $('#proposals').innerHTML = table(['Cuándo','Producto','Tienda','Precio','Aterrizado','Veredicto','Estado'], m.propuestas.ultimas.map((p) => [fmtTime(p.creadoEn), p.producto, p.tienda || '', fmtMoney(p.precio, p.moneda), fmtMoney(p.precioAterrizadoBase, p.monedaBase), p.veredicto || '', p.estado]), [3,4]);
  $('#alerts').innerHTML = table(['Cuándo','Canal','Evento','Estado'], m.alertas.ultimas.map((a) => [fmtTime(a.enviadoEn), a.canal, a.evento, a.estado]), []);
}
function tile(k, v, s, st) { return '<div class="tile"><div class="k">' + esc(k) + '</div><div class="v">' + esc(v) + '</div><div class="s">' + esc(s) + '</div><div style="margin-top:6px">' + st + '</div></div>'; }
function table(h, rows, numCols) {
  if (!rows.length) return '<div class="muted">Sin registros</div>';
  return '<table><thead><tr>' + h.map((x) => '<th>' + esc(x) + '</th>').join('') + '</tr></thead><tbody>' + rows.map((r) => '<tr>' + r.map((c, i) => '<td class="' + (numCols.includes(i) ? 'n' : '') + '">' + esc(c) + '</td>').join('') + '</tr>').join('') + '</tbody></table>';
}
function productCard(p) {
  const vig = p.vigilanciaActiva ? status('good', 'vigilancia cada ' + p.intervaloMinutos + ' min') : status('warning', 'vigilancia apagada');
  return '<div class="card"><h3>' + esc(p.nombre) + '</h3><div class="row">' + vig + '<span>objetivo <b>' + fmtMoney(p.precioObjetivoEfectivo, p.monedaBase) + '</b>' + (p.objetivoDerivado ? ' <span class="muted">(derivado)</span>' : '') + '</span><span>tope <b>' + fmtMoney(p.precioMaximo, p.monedaBase) + '</b></span><span>pendientes <b>' + p.propuestasPendientes + '</b></span><span>última corrida <b>' + fmtTime(p.ultimaCorrida) + '</b></span></div>'
    + (p.mercados.length ? p.mercados.map((mk) => marketBlock(p, mk)).join('') : '<div class="muted">Sin perfil de mercado todavía: corre un ciclo de vigilancia.</div>') + '</div>';
}
function marketBlock(p, mk) {
  const id = 'c-' + p.slug + '-' + mk.mercado;
  const reg = mk.regimen === 'bajando' ? '↓ bajando' : mk.regimen === 'subiendo' ? '↑ subiendo' : '→ estable';
  const conf = mk.confianza === 'alta' ? status('good', 'confianza alta') : mk.confianza === 'media' ? status('warning', 'confianza media') : status('serious', 'confianza ' + mk.confianza);
  return '<div class="' + mk.mercado.toLowerCase() + '"><div class="row" style="margin-top:8px"><span><b>' + esc(mk.mercado) + '</b> precio real <b>' + fmtMoney(mk.precioReal, mk.moneda) + '</b></span><span>piso <b>' + fmtMoney(mk.piso, mk.moneda) + '</b></span><span>' + esc(reg) + (mk.tendenciaPct != null ? ' ' + mk.tendenciaPct + '%' : '') + '</span>' + conf + '<span class="muted">' + mk.tiendas.length + ' tiendas · ' + mk.diasObservados + ' días</span></div>'
    + '<div class="chart" id="' + id + '"><svg role="img" aria-label="Precio competitivo diario ' + esc(mk.mercado) + '"></svg><div class="tip"></div></div>'
    + '<details><summary>Ver como tabla</summary>' + table(['Día','Precio competitivo','Tienda'], mk.serie.slice(-30).reverse().map((s) => [s.day, fmtMoney(s.precioMinimo, mk.moneda), s.tienda]), [1]) + '</details></div>';
}
function drawChart(p, mk) {
  const root = document.getElementById('c-' + p.slug + '-' + mk.mercado); if (!root) return;
  const svg = root.querySelector('svg'), tip = root.querySelector('.tip');
  const W = root.clientWidth || 320, H = 180, L = 52, R = 72, T = 12, B = 24;
  const pts = mk.serie; if (!pts.length) { svg.innerHTML = ''; return; }
  const refs = [['precio real', mk.precioReal]]; if (mk.moneda === p.monedaBase && p.precioObjetivoEfectivo != null) refs.push(['objetivo', p.precioObjetivoEfectivo]);
  const ys = pts.map((s) => s.precioMinimo).concat(refs.map((r) => r[1]).filter((v) => v != null));
  let y0 = Math.min(...ys), y1 = Math.max(...ys); const pad = (y1 - y0 || y0 * 0.1) * 0.12; y0 -= pad; y1 += pad;
  const x = (i) => L + (i / Math.max(1, pts.length - 1)) * (W - L - R), y = (v) => T + (1 - (v - y0) / (y1 - y0)) * (H - T - B);
  const ticks = 3; let s = '';
  for (let k = 0; k <= ticks; k++) { const v = y0 + (k / ticks) * (y1 - y0); s += '<line class="grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '"/><text class="lbl" x="' + (L - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + Math.round(v).toLocaleString('es-MX') + '</text>'; }
  s += '<line class="axis" x1="' + L + '" x2="' + (W - R) + '" y1="' + (H - B) + '" y2="' + (H - B) + '"/>';
  [0, Math.floor(pts.length / 2), pts.length - 1].forEach((i) => { s += '<text class="lbl" x="' + x(i) + '" y="' + (H - 6) + '" text-anchor="' + (i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle') + '">' + pts[i].day.slice(5) + '</text>'; });
  const refYs = [];
  refs.forEach((r) => { if (r[1] == null) return; const ry = y(r[1]); refYs.push(ry); s += '<line class="ref" stroke="var(--text-muted)" x1="' + L + '" x2="' + (W - R) + '" y1="' + ry + '" y2="' + ry + '"/><text class="reflbl" x="' + (W - R + 4) + '" y="' + (ry + 4) + '">' + r[0] + '</text>'; });
  s += '<path class="line" d="' + pts.map((pt, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(pt.precioMinimo).toFixed(1)).join(' ') + '"/>';
  const last = pts[pts.length - 1], ly = y(last.precioMinimo);
  // La etiqueta del último valor va encima del punto; si choca con una referencia, baja debajo del punto.
  const labelAbove = !refYs.some((ry) => Math.abs((ly - 10) - ry) < 12);
  s += '<circle class="mark" r="4" cx="' + x(pts.length - 1) + '" cy="' + ly + '"/><text class="endlbl" x="' + x(pts.length - 1) + '" y="' + (labelAbove ? ly - 10 : ly + 18) + '" text-anchor="end">' + fmtMoney(last.precioMinimo, mk.moneda) + '</text>';
  s += '<line class="hair" x1="0" x2="0" y1="' + T + '" y2="' + (H - B) + '"/><circle class="mark hover" r="4" cx="-10" cy="-10" style="display:none"/><rect class="hit" x="' + L + '" y="0" width="' + (W - L - R) + '" height="' + H + '"/>';
  svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.innerHTML = s;
  const hair = svg.querySelector('.hair'), hov = svg.querySelector('.hover'), hit = svg.querySelector('.hit');
  hit.addEventListener('mousemove', (e) => {
    const rect = svg.getBoundingClientRect(); const px = (e.clientX - rect.left) * (W / rect.width);
    const i = Math.max(0, Math.min(pts.length - 1, Math.round((px - L) / (W - L - R) * (pts.length - 1)))); const pt = pts[i];
    hair.style.display = 'block'; hair.setAttribute('x1', x(i)); hair.setAttribute('x2', x(i));
    hov.style.display = 'block'; hov.setAttribute('cx', x(i)); hov.setAttribute('cy', y(pt.precioMinimo));
    tip.style.display = 'block'; tip.innerHTML = '<b>' + esc(pt.day) + '</b><br>' + fmtMoney(pt.precioMinimo, mk.moneda) + ' · ' + esc(pt.tienda);
    const tx = (x(i) / W) * rect.width; tip.style.left = Math.min(rect.width - tip.offsetWidth - 4, Math.max(0, tx + 10)) + 'px'; tip.style.top = Math.max(0, (y(pt.precioMinimo) / H) * rect.height - 36) + 'px';
  });
  hit.addEventListener('mouseleave', () => { hair.style.display = 'none'; hov.style.display = 'none'; tip.style.display = 'none'; });
}
window.addEventListener('resize', () => { if (window.__last) render(window.__last); });
const _render = render; render = (m) => { window.__last = m; _render(m); };
</script></body></html>`
}
