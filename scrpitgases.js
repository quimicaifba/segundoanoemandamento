/* ================================================================
   SIGAS — scrpitgases.js | mecânica e casco do simulador de Gases
   ================================================================
   Mesmo casco da família do 2º ano (receptor de acessibilidade,
   kit de desenho, App, gaveta mobile e alças de redimensionar).
   A classe Mech implementa 4 modos: transformações gasosas no
   pistão, equação de Clapeyron, difusão (Lei de Graham) e Teoria
   Cinética — este último com um motor de partículas de verdade
   (classe KinEngine): colisões elásticas via grade espacial,
   velocidades sorteadas pela distribuição de Maxwell-Boltzmann e
   pressão MEDIDA pelo impulso dos choques nas paredes (não por
   fórmula pronta). Requer dadosgases.js carregado antes.
   ================================================================ */
'use strict';

// ══════════════════════════════════════════════════════════════════
// RECEPTOR DE ACESSIBILIDADE — Central de Simuladores
// (injeta os filtros SVG de daltonismo e o widget VLibras via JS —
//  o HTML não contém nenhum desses dois blocos, só o overlay/placeholder
//  vazios que servem de âncora)
// ══════════════════════════════════════════════════════════════════
(function injectColorblindFilters() {
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.style.position = 'absolute';
  svg.setAttribute('aria-hidden', 'true');
  const defs = document.createElementNS(svgNS, 'defs');
  // Matrizes calibradas para cada tipo de CVD (Wong 2011 / Machado et al. 2009).
  const filtros = {
    'f-protanopia':   '0.567 0.433 0 0 0  0.558 0.442 0 0 0  0 0.242 0.758 0 0  0 0 0 1 0',
    'f-deuteranopia': '0.625 0.375 0 0 0  0.7 0.3 0 0 0  0 0.3 0.7 0 0  0 0 0 1 0',
    'f-tritanopia':   '0.95 0.05 0 0 0  0 0.433 0.567 0 0  0 0.475 0.525 0 0  0 0 0 1 0',
    'f-acromatopsia': '0.299 0.587 0.114 0 0  0.299 0.587 0.114 0 0  0.299 0.587 0.114 0 0  0 0 0 1 0',
  };
  Object.entries(filtros).forEach(([id, values]) => {
    const filter = document.createElementNS(svgNS, 'filter');
    filter.setAttribute('id', id);
    const feColorMatrix = document.createElementNS(svgNS, 'feColorMatrix');
    feColorMatrix.setAttribute('type', 'matrix');
    feColorMatrix.setAttribute('values', values);
    filter.appendChild(feColorMatrix);
    defs.appendChild(filter);
  });
  svg.appendChild(defs);
  document.body.insertBefore(svg, document.body.firstChild);
})();

(function initVLibras() {
  const script = document.createElement('script');
  script.src = 'https://vlibras.gov.br/app/vlibras-plugin.js';
  script.onload = function () {
    try { new window.VLibras.Widget('https://vlibras.gov.br/app'); } catch (e) {}
  };
  document.body.appendChild(script);
})();

(function () {
  const root = document.documentElement;
  const CVD_CYCLE = ['none', 'protanopia', 'deuteranopia', 'tritanopia', 'acromatopsia'];

  function applyFontScale(scale) {
    const fs = Math.min(1.5, Math.max(0.75, scale));
    root.style.setProperty('--font-scale', fs);
  }

  function applyPayload(payload) {
    if (!payload) return;
    if (payload.theme) document.body.classList.toggle('light-mode', payload.theme === 'light');
    if (typeof payload.contrast !== 'undefined') document.body.classList.toggle('high-contrast', !!payload.contrast);
    if (typeof payload.colorblind !== 'undefined' && payload.colorblind !== null && CVD_CYCLE.includes(payload.colorblind)) {
      // Técnica do hub: filtro SVG via backdrop-filter num overlay
      // fixo (pointer-events:none), nunca diretamente no body/html —
      // senão elementos position:fixed do simulador quebram.
      applyColorblindOverlay(payload.colorblind);
    }
    if (payload.reading) {
      const simples = payload.reading === 'on';
      document.body.classList.toggle('simple-read', simples);
      root.classList.toggle('simple-read', simples); // espelha no <html> p/ escala rem da leitura simples
    }
    if (typeof payload.motion !== 'undefined') document.body.classList.toggle('reduce-motion', !!payload.motion);
    if (typeof payload.spacing !== 'undefined') document.body.classList.toggle('wide-spacing', !!payload.spacing);
    if (payload.fontScale) applyFontScale(payload.fontScale);
  }

  function applyColorblindOverlay(type) {
    const overlay = document.getElementById('colorblindOverlay');
    if (!overlay) return;
    const value = (!type || type === 'none') ? 'none' : `url(#f-${type})`;
    overlay.style.backdropFilter = value;
    overlay.style.webkitBackdropFilter = value;
  }

  (function applyFromUrl() {
    const p = new URLSearchParams(window.location.search);
    if (![...p.keys()].length) return;
    applyPayload({
      theme: p.get('theme'),
      contrast: p.get('contrast') === 'true',
      colorblind: p.get('colorblind'),
      reading: p.get('reading'),
      motion: p.get('motion') === 'true',
      spacing: p.get('spacing') === 'true',
      fontScale: parseFloat(p.get('fontscale')) || 1.0,
    });
  })();

  window.addEventListener('message', (e) => {
    if (!e.data || e.data.source !== 'central-simuladores' || e.data.type !== 'a11y-update') return;
    applyPayload(e.data.payload);
  });
})();

// ══════════════════════════════════════════════════════════════════
// UTILITÁRIOS
// ══════════════════════════════════════════════════════════════════
function announce(msg, priority = 'polite') {
  const el = document.getElementById(priority === 'assertive' ? 'sr-live-assertive' : 'sr-live');
  if (!el) return;
  el.textContent = '';
  requestAnimationFrame(() => { el.textContent = msg; });
}

let _audioCtx = null;
function playTone(freq = 880, dur = 0.08, vol = 0.07) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!_audioCtx) _audioCtx = new Ctx();
    if (_audioCtx.state === 'suspended') _audioCtx.resume();
    const osc = _audioCtx.createOscillator();
    const gain = _audioCtx.createGain();
    osc.connect(gain); gain.connect(_audioCtx.destination);
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, _audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, _audioCtx.currentTime + dur);
    osc.start(); osc.stop(_audioCtx.currentTime + dur);
  } catch (e) {}
}

/** Formata número no padrão pt-BR com sinal − tipográfico. */
function fmt(v, casas = 1) {
  const s = Number(v).toLocaleString('pt-BR', {
    minimumFractionDigits: 0, maximumFractionDigits: casas,
  });
  return s.replace('-', '−');
}
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp  = (a, b, t) => a + (b - a) * t;
const easeIO = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const isReduced = () => document.body.classList.contains('reduce-motion');

/** Lê uma variável de cor do CSS (fonte única de cores do simulador). */
function cssVar(name, fallback = '#fb923c') {
  const v = getComputedStyle(document.body).getPropertyValue(name).trim();
  return v || fallback;
}

/** Contraste preto/branco por luminância YIQ — réplica do SIMA/SILQ. */
function getContrastColor(hex) {
  const c = hex.replace('#', '');
  if (c.length < 6) return '#111827';
  const r = parseInt(c.substr(0, 2), 16), g = parseInt(c.substr(2, 2), 16), b = parseInt(c.substr(4, 2), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 >= 145 ? '#111827' : '#ffffff';
}

// ══════════════════════════════════════════════════════════════════
// KIT DE DESENHO — helpers de canvas compartilhados pela família de
// simuladores do 2º ano (mesma linguagem visual do SIMA/SITQ).
// Todas as cores vêm de cssVar() → variáveis do CSS (fonte única).
// ══════════════════════════════════════════════════════════════════
function kRound(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function kLabel(ctx, text, x, y, o = {}) {
  ctx.save();
  ctx.font = `${o.bold ? '700 ' : ''}${o.size || 12}px ${o.mono ? "'Consolas','Monaco',monospace" : "'Segoe UI',system-ui,sans-serif"}`;
  ctx.fillStyle = o.color || cssVar('--text-secondary', '#7a9ab8');
  ctx.textAlign = o.align || 'center';
  ctx.textBaseline = o.baseline || 'middle';
  if (o.maxW) ctx.fillText(text, x, y, o.maxW); else ctx.fillText(text, x, y);
  ctx.restore();
}

/** Pílula de texto (legenda flutuante). */
function kChip(ctx, text, x, y, o = {}) {
  ctx.save();
  ctx.font = `${o.size || 11}px 'Segoe UI',system-ui,sans-serif`;
  const w = ctx.measureText(text).width + 14, h = (o.size || 11) + 10;
  kRound(ctx, x - w / 2, y - h / 2, w, h, h / 2);
  ctx.fillStyle = o.bg || 'rgba(0,0,0,.45)';
  ctx.fill();
  if (o.border) { ctx.strokeStyle = o.border; ctx.lineWidth = 1; ctx.stroke(); }
  kLabel(ctx, text, x, y + .5, { size: o.size || 11, color: o.fg || '#fff', bold: o.bold });
  ctx.restore();
}

function kArrow(ctx, x1, y1, x2, y2, o = {}) {
  const head = o.head || 7, ang = Math.atan2(y2 - y1, x2 - x1);
  ctx.save();
  ctx.strokeStyle = ctx.fillStyle = o.color || cssVar('--text-secondary');
  ctx.lineWidth = o.w || 1.6;
  if (o.dash) ctx.setLineDash(o.dash);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - head * Math.cos(ang - .45), y2 - head * Math.sin(ang - .45));
  ctx.lineTo(x2 - head * Math.cos(ang + .45), y2 - head * Math.sin(ang + .45));
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

/**
 * Eixos cartesianos com grade e ticks. Retorna {px, py, area} onde
 * px(v)/py(v) mapeiam valores de dados → pixels.
 */
function kAxes(ctx, cfg) {
  const { x, y, w, h, xmin, xmax, ymin, ymax } = cfg;
  const px = v => x + (v - xmin) / (xmax - xmin) * w;
  const py = v => y + h - (v - ymin) / (ymax - ymin) * h;
  const grid = cssVar('--border', '#1c2e44'), txt = cssVar('--text-muted', '#3d566e');
  ctx.save();
  ctx.lineWidth = 1;
  (cfg.xticks || []).forEach(t => {
    ctx.strokeStyle = grid; ctx.globalAlpha = .5;
    ctx.beginPath(); ctx.moveTo(px(t), y); ctx.lineTo(px(t), y + h); ctx.stroke();
    ctx.globalAlpha = 1;
    kLabel(ctx, cfg.fmtx ? cfg.fmtx(t) : fmt(t, 0), px(t), y + h + 11, { size: 10, color: txt, mono: true });
  });
  (cfg.yticks || []).forEach(t => {
    ctx.strokeStyle = grid; ctx.globalAlpha = .5;
    ctx.beginPath(); ctx.moveTo(x, py(t)); ctx.lineTo(x + w, py(t)); ctx.stroke();
    ctx.globalAlpha = 1;
    kLabel(ctx, cfg.fmty ? cfg.fmty(t) : fmt(t, 0), x - 6, py(t), { size: 10, color: txt, align: 'right', mono: true });
  });
  ctx.strokeStyle = cssVar('--text-muted');
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + h); ctx.lineTo(x + w, y + h); ctx.stroke();
  if (cfg.xlab) kLabel(ctx, cfg.xlab, x + w / 2, y + h + 26, { size: 11, color: cssVar('--text-secondary'), bold: true });
  if (cfg.ylab) {
    ctx.save(); ctx.translate(x - 40, y + h / 2); ctx.rotate(-Math.PI / 2);
    kLabel(ctx, cfg.ylab, 0, 0, { size: 11, color: cssVar('--text-secondary'), bold: true });
    ctx.restore();
  }
  ctx.restore();
  return { px, py };
}

/** Polilinha suave sobre eixos já mapeados. */
function kLine(ctx, pts, px, py, o = {}) {
  if (!pts.length) return;
  ctx.save();
  ctx.strokeStyle = o.color || cssVar('--accent-main');
  ctx.lineWidth = o.w || 2.2;
  if (o.dash) ctx.setLineDash(o.dash);
  ctx.globalAlpha = o.alpha != null ? o.alpha : 1;
  ctx.beginPath();
  pts.forEach((p, i) => i ? ctx.lineTo(px(p[0]), py(p[1])) : ctx.moveTo(px(p[0]), py(p[1])));
  ctx.stroke();
  ctx.restore();
}

/**
 * Béquer de vidro com líquido. level 0..1. Retorna o retângulo interno
 * do líquido (para posicionar partículas).
 */
function kBeaker(ctx, cx, topY, w, h, level, liquidColor, o = {}) {
  const x = cx - w / 2, glass = cssVar('--glass', 'rgba(148,163,184,.38)');
  const lh = Math.max(0, Math.min(1, level)) * (h - 10);
  const ly = topY + h - lh;
  if (lh > 1) {
    ctx.save();
    const g = ctx.createLinearGradient(0, ly, 0, topY + h);
    g.addColorStop(0, liquidColor);
    g.addColorStop(1, liquidColor);
    ctx.fillStyle = g;
    ctx.globalAlpha = o.alpha != null ? o.alpha : .85;
    kRound(ctx, x + 3, ly, w - 6, lh, 4);
    ctx.fill();
    // menisco
    ctx.globalAlpha = .5;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(x + 4, ly + 1.5); ctx.lineTo(x + w - 4, ly + 1.5); ctx.stroke();
    ctx.restore();
  }
  ctx.save();
  ctx.strokeStyle = glass;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(x - 4, topY - 4);
  ctx.lineTo(x, topY);
  ctx.lineTo(x, topY + h - 6);
  ctx.quadraticCurveTo(x, topY + h, x + 6, topY + h);
  ctx.lineTo(x + w - 6, topY + h);
  ctx.quadraticCurveTo(x + w, topY + h, x + w, topY + h - 6);
  ctx.lineTo(x + w, topY);
  ctx.lineTo(x + w + 4, topY - 4);
  ctx.stroke();
  if (o.rotulo) kLabel(ctx, o.rotulo, cx, topY + h + 14, { size: 11, color: cssVar('--text-secondary') });
  ctx.restore();
  return { x: x + 4, y: ly, w: w - 8, h: lh, surfaceY: ly };
}

/** Termômetro vertical com escala. */
function kThermo(ctx, x, topY, h, t, tmin, tmax, o = {}) {
  const frac = Math.max(0, Math.min(1, (t - tmin) / (tmax - tmin)));
  const bulbR = 8, tubeW = 7;
  const tubeTop = topY, tubeBot = topY + h - bulbR * 2;
  const merc = o.color || cssVar('--accent-exo', '#f87171');
  ctx.save();
  ctx.fillStyle = cssVar('--bg-void', '#080c14');
  ctx.strokeStyle = cssVar('--glass');
  ctx.lineWidth = 2;
  kRound(ctx, x - tubeW / 2, tubeTop, tubeW, h - bulbR, tubeW / 2);
  ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(x, tubeBot + bulbR, bulbR, 0, Math.PI * 2);
  ctx.fillStyle = merc; ctx.fill(); ctx.stroke();
  const mh = frac * (tubeBot - tubeTop - 4);
  ctx.fillStyle = merc;
  kRound(ctx, x - 2.2, tubeBot - mh, 4.4, mh + bulbR, 2.2);
  ctx.fill();
  for (let i = 0; i <= 4; i++) {
    const yy = tubeBot - i / 4 * (tubeBot - tubeTop - 4);
    ctx.strokeStyle = cssVar('--text-muted');
    ctx.beginPath(); ctx.moveTo(x + tubeW / 2 + 2, yy); ctx.lineTo(x + tubeW / 2 + 6, yy); ctx.stroke();
    if (o.escala !== false) kLabel(ctx, fmt(tmin + i / 4 * (tmax - tmin), 0), x + tubeW / 2 + 9, yy, { size: 9, color: cssVar('--text-muted'), align: 'left', mono: true });
  }
  if (o.rotulo !== false) kChip(ctx, `${fmt(t, o.casas != null ? o.casas : 0)} °C`, x, tubeTop - 14, { bg: 'rgba(0,0,0,.45)', fg: merc, size: 11, bold: true });
  ctx.restore();
}

/** Chama de bico de Bunsen (t = relógio da animação). */
function kFlame(ctx, x, y, s, time) {
  const flu = isReduced() ? 0 : Math.sin(time * 9) * s * .06;
  ctx.save();
  const g = ctx.createRadialGradient(x, y - s * .5, s * .1, x, y - s * .5, s);
  g.addColorStop(0, cssVar('--flame-b', '#fde047'));
  g.addColorStop(1, cssVar('--flame-a', '#f97316'));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - s * .45, y);
  ctx.quadraticCurveTo(x - s * .5, y - s * .8, x + flu, y - s * 1.5);
  ctx.quadraticCurveTo(x + s * .5, y - s * .8, x + s * .45, y);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

/** Mantém n partículas quicando dentro de box; vel escala com speed. */
function kParticles(arr, n, box, speed, dt) {
  while (arr.length < n) arr.push({ x: box.x + Math.random() * box.w, y: box.y + Math.random() * box.h, vx: (Math.random() - .5), vy: (Math.random() - .5) });
  if (arr.length > n) arr.length = n;
  const v = isReduced() ? 0 : speed;
  arr.forEach(p => {
    p.x += p.vx * v * dt; p.y += p.vy * v * dt;
    if (p.x < box.x) { p.x = box.x; p.vx = Math.abs(p.vx); }
    if (p.x > box.x + box.w) { p.x = box.x + box.w; p.vx = -Math.abs(p.vx); }
    if (p.y < box.y) { p.y = box.y; p.vy = Math.abs(p.vy); }
    if (p.y > box.y + box.h) { p.y = box.y + box.h; p.vy = -Math.abs(p.vy); }
  });
}
function kDrawParticles(ctx, arr, r, color, alpha) {
  ctx.save();
  ctx.fillStyle = color; ctx.globalAlpha = alpha != null ? alpha : .9;
  arr.forEach(p => { ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill(); });
  ctx.restore();
}

/** Bolhas de gás subindo a partir de srcY dentro de box. */
function kBubbles(arr, dt, box, rate, o = {}) {
  if (!isReduced() && Math.random() < rate * dt) {
    arr.push({ x: (o.x != null ? o.x : box.x + Math.random() * box.w) + (Math.random() - .5) * (o.spread || 10), y: o.y != null ? o.y : box.y + box.h - 4, r: 1.5 + Math.random() * 2.5, v: 26 + Math.random() * 30 });
  }
  for (let i = arr.length - 1; i >= 0; i--) {
    const b = arr[i];
    b.y -= b.v * dt; b.x += Math.sin(b.y * .12) * .25;
    if (b.y < (o.topo != null ? o.topo : box.y) + 3) arr.splice(i, 1);
  }
}
function kDrawBubbles(ctx, arr, color) {
  ctx.save();
  ctx.strokeStyle = color || 'rgba(255,255,255,.65)';
  ctx.lineWidth = 1.1;
  arr.forEach(b => { ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.stroke(); });
  ctx.restore();
}

/** Elétrons (pontos) correndo ao longo de uma polilinha; t avança externamente. */
function kFlowDots(ctx, pts, phase, n, color, o = {}) {
  const segs = []; let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const dx = pts[i + 1][0] - pts[i][0], dy = pts[i + 1][1] - pts[i][1];
    const L = Math.hypot(dx, dy); segs.push({ p: pts[i], dx, dy, L }); total += L;
  }
  ctx.save(); ctx.fillStyle = color;
  for (let k = 0; k < n; k++) {
    let d = (((phase + k / n) % 1) + 1) % 1 * total;
    for (const s of segs) {
      if (d <= s.L) {
        const t = d / s.L;
        ctx.beginPath(); ctx.arc(s.p[0] + s.dx * t, s.p[1] + s.dy * t, o.r || 2.6, 0, Math.PI * 2); ctx.fill();
        if (o.rotulo && k === 0) kLabel(ctx, 'e⁻', s.p[0] + s.dx * t, s.p[1] + s.dy * t - 9, { size: 9, color, mono: true });
        break;
      }
      d -= s.L;
    }
  }
  ctx.restore();
}

/** Interpola duas cores hex → 'rgb(r,g,b)'. */
function kMix(h1, h2, t) {
  const p = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const a = p(h1), b = p(h2);
  return `rgb(${Math.round(lerp(a[0], b[0], t))},${Math.round(lerp(a[1], b[1], t))},${Math.round(lerp(a[2], b[2], t))})`;
}

/** Interpolação linear em tabela de pontos [[x,y],...] ordenada por x. */
function kInterp(pts, x) {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (x <= pts[i][0]) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
    }
  }
  return pts[pts.length - 1][1];
}
// ══════════════════════════════════════════════════════════════════
// MOTOR CINÉTICO — KinEngine: partículas com velocidade sorteada pela
// distribuição de Maxwell-Boltzmann (Box-Muller), colisões elásticas
// (grade espacial) e pressão MEDIDA pelo impulso nos choques com as
// paredes (não por fórmula) — calibrada honestamente para atm via
// fração relativa a um valor de referência estatístico.
// ══════════════════════════════════════════════════════════════════
const KIN = { VSCALE: 13 }; // px·s⁻¹ por unidade de √(K/(g/mol)) — escala visual, não SI
// v ∝ √(T/M): constante calibrada para que, a 300 K, o comportamento
// da corrida coincida com a calibração visual original (fração do
// tubo por segundo ≈ 1,1/√M a 300 K).
const GRAHAM_K = 1.1 / Math.sqrt(300);

/** Normaliza hex de 3 dígitos (#0ff) para 6 dígitos, exigido por kMix. */
function hex6(h) {
  if (!h) return '#000000';
  h = h.trim();
  if (h[0] !== '#') return h;
  if (h.length === 4) { const r = h[1], g = h[2], b = h[3]; return `#${r}${r}${g}${g}${b}${b}`; }
  return h;
}

/** Cor por rapidez normalizada (0..1): ciano → âmbar → vermelho. */
function speedColor(t) {
  t = clamp(t, 0, 1);
  const c1 = hex6(cssVar('--accent-cyan', '#38bdf8'));
  const c2 = hex6(cssVar('--accent-amber', '#fbbf24'));
  const c3 = hex6(cssVar('--accent-exo', '#f87171'));
  return t < .5 ? kMix(c1, c2, t * 2) : kMix(c2, c3, (t - .5) * 2);
}

/** Converte hex (3 ou 6 dígitos) + alfa em 'rgba(r,g,b,a)'. */
function toRgba(hex, a) {
  hex = hex6(hex);
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

/** v_rms tridimensional real: √(3·R·T/M), M em kg/mol → v em m/s. */
function vrms3D(T, M, RSI) { return Math.sqrt(3 * RSI * T / (M / 1000)); }

class KinEngine {
  constructor() {
    this.parts = [];
    this.T = 300; this.M = 28; this.r = 3.2;
    this.box = { x: 0, y: 0, w: 100, h: 100 };
    this.collisions = true;
    this._pFrac = 0;
    this._collRate = 0;
  }

  get sigmaT() { return KIN.VSCALE * Math.sqrt(Math.max(1, this.T) / Math.max(0.1, this.M)); }
  get collRate() { return this._collRate; }
  get pressureFrac() { return this._pFrac; }

  config(o) {
    if (o.T != null) this.T = o.T;
    if (o.M != null) this.M = o.M;
    if (o.r != null) this.r = o.r;
  }

  setBox(b) {
    this.box = b;
    const r = this.r;
    this.parts.forEach(p => {
      p.x = clamp(p.x, b.x + r, Math.max(b.x + r, b.x + b.w - r));
      p.y = clamp(p.y, b.y + r, Math.max(b.y + r, b.y + b.h - r));
    });
  }

  _spawnOne() {
    const s = this.sigmaT, b = this.box, r = this.r;
    const u1 = Math.random() || 1e-6, u2 = Math.random();
    const mag = Math.sqrt(-2 * Math.log(u1));
    const vx = mag * Math.cos(Math.PI * 2 * u2) * s;
    const vy = mag * Math.sin(Math.PI * 2 * u2) * s;
    return {
      x: b.x + r + Math.random() * Math.max(1, b.w - 2 * r),
      y: b.y + r + Math.random() * Math.max(1, b.h - 2 * r),
      vx, vy,
    };
  }

  setN(n) {
    n = Math.max(1, Math.round(n));
    while (this.parts.length < n) this.parts.push(this._spawnOne());
    if (this.parts.length > n) this.parts.length = n;
  }

  /** Redistribui as velocidades pela curva de Maxwell-Boltzmann (mantém posições). */
  resample() {
    this.parts.forEach(p => { const np = this._spawnOne(); p.vx = np.vx; p.vy = np.vy; });
  }

  /** Todas as partículas com a MESMA rapidez, direções aleatórias — para a demo pedagógica. */
  uniform() {
    const s = this.sigmaT * Math.SQRT2;
    this.parts.forEach(p => { const a = Math.random() * Math.PI * 2; p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s; });
  }

  meanV2() {
    if (!this.parts.length) return 0;
    let s = 0; this.parts.forEach(p => { s += p.vx * p.vx + p.vy * p.vy; });
    return s / this.parts.length;
  }

  /** Razão entre energia cinética atual e a esperada para T alvo (1 = equilíbrio). */
  tRatio() {
    const s = this.sigmaT;
    if (s <= 0) return 1;
    return this.meanV2() / (2 * s * s);
  }

  histo(bins) {
    const vmax = this.sigmaT * 3.4;
    const bw = vmax / bins;
    const counts = new Array(bins).fill(0);
    this.parts.forEach(p => {
      const v = Math.hypot(p.vx, p.vy);
      let idx = Math.floor(v / bw);
      if (idx >= bins) idx = bins - 1;
      if (idx < 0) idx = 0;
      counts[idx]++;
    });
    return { counts, binWidth: bw, vmax };
  }

  step(dt) {
    if (!this.parts.length || dt <= 0) return;
    const subN = clamp(Math.ceil(dt / 0.008), 1, 5);
    const sdt = dt / subN;
    for (let s = 0; s < subN; s++) this._substep(sdt);
  }

  _substep(dt) {
    const b = this.box, r = this.r;
    let impulseSum = 0;
    const perim = Math.max(1, 2 * (b.w + b.h));
    for (const p of this.parts) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.x < b.x + r) { p.x = b.x + r; if (p.vx < 0) { impulseSum += 2 * this.M * Math.abs(p.vx); p.vx = -p.vx; } }
      else if (p.x > b.x + b.w - r) { p.x = b.x + b.w - r; if (p.vx > 0) { impulseSum += 2 * this.M * Math.abs(p.vx); p.vx = -p.vx; } }
      if (p.y < b.y + r) { p.y = b.y + r; if (p.vy < 0) { impulseSum += 2 * this.M * Math.abs(p.vy); p.vy = -p.vy; } }
      else if (p.y > b.y + b.h - r) { p.y = b.y + b.h - r; if (p.vy > 0) { impulseSum += 2 * this.M * Math.abs(p.vy); p.vy = -p.vy; } }
    }

    // pressão 2D medida pelo impulso → fração relativa a um valor de referência estatístico
    const sigma = this.sigmaT, area = Math.max(1, b.w * b.h);
    const pRef = this.parts.length * this.M * sigma * sigma / area;
    const p2d = impulseSum / (Math.max(dt, 1e-6) * perim);
    const instFrac = pRef > 0 ? p2d / pRef : 0;
    const kSm = 1 - Math.exp(-dt / 0.5);
    this._pFrac = lerp(this._pFrac, instFrac, kSm);

    let collCount = 0;
    if (this.collisions && this.parts.length > 1) collCount = this._collideGrid();
    const collRateInst = collCount / Math.max(dt, 1e-6);
    this._collRate = lerp(this._collRate, collRateInst, kSm);

    // termostato suave (tipo Berendsen): relaxa a energia cinética rumo ao alvo sem "teleportar"
    const ratio = this.tRatio();
    if (ratio > 0) {
      const tau = 0.6;
      const scale = Math.sqrt(1 + (dt / tau) * (1 / ratio - 1));
      const sc = clamp(scale, 0.9, 1.1);
      this.parts.forEach(p => { p.vx *= sc; p.vy *= sc; });
    }
  }

  /** Colisões partícula-partícula via grade espacial (célula ≈ 2,2·r). */
  _collideGrid() {
    const r = this.r, cell = 2.2 * r, b = this.box;
    const cols = Math.max(1, Math.floor(b.w / cell)), rows = Math.max(1, Math.floor(b.h / cell));
    const buckets = new Map();
    const cellOf = p => {
      let cx = Math.floor((p.x - b.x) / cell), cy = Math.floor((p.y - b.y) / cell);
      cx = clamp(cx, 0, cols - 1); cy = clamp(cy, 0, rows - 1);
      return cy * cols + cx;
    };
    this.parts.forEach((p, i) => {
      const k = cellOf(p);
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k).push(i);
    });
    const offsets = [[0, 0], [1, 0], [0, 1], [1, 1], [-1, 1]];
    const r2 = (2 * r) * (2 * r);
    let count = 0;
    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        const list0 = buckets.get(cy * cols + cx);
        if (!list0) continue;
        offsets.forEach(([ox, oy]) => {
          const nx = cx + ox, ny = cy + oy;
          if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) return;
          const list1 = buckets.get(ny * cols + nx);
          if (!list1) return;
          const same = (ox === 0 && oy === 0);
          for (let a = 0; a < list0.length; a++) {
            const startB = same ? a + 1 : 0;
            for (let bI = startB; bI < list1.length; bI++) {
              const i = list0[a], j = list1[bI];
              if (i === j) continue;
              const p1 = this.parts[i], p2 = this.parts[j];
              const dx = p2.x - p1.x, dy = p2.y - p1.y;
              const d2 = dx * dx + dy * dy;
              if (d2 > 0 && d2 < r2) {
                const d = Math.sqrt(d2) || .001;
                const nx1 = dx / d, ny1 = dy / d;
                const overlap = (2 * r - d) / 2;
                p1.x -= nx1 * overlap; p1.y -= ny1 * overlap;
                p2.x += nx1 * overlap; p2.y += ny1 * overlap;
                const v1n = p1.vx * nx1 + p1.vy * ny1, v2n = p2.vx * nx1 + p2.vy * ny1;
                if (v2n - v1n < 0) {
                  const v1tx = p1.vx - v1n * nx1, v1ty = p1.vy - v1n * ny1;
                  const v2tx = p2.vx - v2n * nx1, v2ty = p2.vy - v2n * ny1;
                  p1.vx = v1tx + v2n * nx1; p1.vy = v1ty + v2n * ny1;
                  p2.vx = v2tx + v1n * nx1; p2.vy = v2ty + v1n * ny1;
                  count++;
                }
              }
            }
          }
        });
      }
    }
    return count;
  }
}

/** Preenche um <select> com opções a partir de itens dos dados. */
function fillSelect(selectId, items, selValue) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  sel.innerHTML = '';
  items.forEach(it => {
    const o = document.createElement('option');
    o.value = it.value; o.textContent = it.nome;
    if (String(it.value) === String(selValue)) o.selected = true;
    sel.appendChild(o);
  });
}

// ══════════════════════════════════════════════════════════════════
// MECÂNICA — SIGAS · Gases
// Transformações: P = nRT/V (isotérmica/isocórica) e V = nRT/P
// (isobárica), sempre com n = 1 mol e T em kelvin. Clapeyron:
// PV = nRT com d = PM/RT — ficha do gás com Teb, densidade nas CNTP,
// v_rms e van der Waals. Graham: v₁/v₂ = √(M₂/M₁) — dois gases
// soltos nas pontas de um tubo se encontram no ponto que divide as
// distâncias na razão das velocidades (anel de NH₄Cl). Teoria
// Cinética: motor de partículas com colisões elásticas reais e
// pressão medida pelos choques nas paredes (classe KinEngine acima).
// ══════════════════════════════════════════════════════════════════
class Mech {
  constructor(D) {
    this.D = D;
    this.mode = 'transform';
    const gN2 = D.GASES.find(g => g.id === 'n2') || D.GASES[0];
    const gNH3 = D.GASES.find(g => g.id === 'nh3') || D.GASES[0];
    const gHCl = D.GASES.find(g => g.id === 'hcl') || D.GASES[1] || D.GASES[0];
    this.tr = { tipo: 'isotermica', n: 1, T: 300, V: 20, P: 1, eng: new KinEngine() };
    this.cl = { gas: gN2, n: 1.0, T: 300, V: 24.6, eng: new KinEngine() };
    this.gr = { a: gNH3, b: gHCl, T: 300, fa: 0, fb: 0, run: false, done: false, ta: 0, seed: [] };
    this.kin = { gas: gN2, N: 80, T: 300, V: 24.6, r: 3, collisions: true, colorMode: 'gas', histOn: true, eng: new KinEngine() };
    this._grReset();
  }

  build() {
    const D = this.D;
    fillOptGrid('clape-grid', D.GASES.map(g => ({
      value: g.id, nome: g.nome, dot: g.cor, extra: `${fmt(g.M, 2)} g/mol`,
      aria: `${g.nome}, massa molar ${fmt(g.M, 2)} gramas por mol`,
    })), this.cl.gas.id);
    const selItems = D.GASES.map(g => ({ value: g.id, nome: `${g.f} — ${g.nome} (${fmt(g.M, 2)} g/mol)` }));
    fillSelect('graham-a', selItems, this.gr.a.id);
    fillSelect('graham-b', selItems, this.gr.b.id);
    fillSelect('kin-gas', selItems, this.kin.gas.id);
    this._buildPares();
  }

  _buildPares() {
    const row = document.getElementById('pares-row');
    if (!row) return;
    row.innerHTML = '';
    (this.D.PARES || []).forEach(p => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip-btn';
      b.dataset.action = 'par';
      b.dataset.a = p.a; b.dataset.b = p.b;
      b.textContent = p.rot;
      b.title = p.tag;
      b.setAttribute('aria-label', `${p.rot} — ${p.tag}`);
      row.appendChild(b);
    });
  }

  setMode(id) { this.mode = id; }

  setParam(k, v) {
    const T = this.tr, C = this.cl, G = this.gr, K = this.kin, D = this.D;
    switch (k) {
      case 'trtipo': {
        T.tipo = v;
        document.getElementById('row-tr-v').hidden = (v === 'isobarica');
        document.getElementById('row-tr-p').hidden = (v !== 'isobarica');
        const t = D.TRANSFORMACOES[v];
        return { say: `Transformação ${t.nome} (${t.lei}). ${t.frase}` };
      }
      case 'trN': T.n = v; return;
      case 'trT': T.T = v; return;
      case 'trV': T.V = v; return;
      case 'trP': T.P = v; return;
      case 'gas': {
        C.gas = D.GASES.find(g => g.id === v) || C.gas;
        return { say: `${C.gas.nome} selecionado. Massa molar ${fmt(C.gas.M, 2)} gramas por mol.` };
      }
      case 'claN': C.n = v; return;
      case 'claT': C.T = v; return;
      case 'claV': C.V = v; return;
      case 'gasa': {
        G.a = D.GASES.find(g => g.id === v) || G.a; this._grReset();
        return { say: `Gás da esquerda: ${G.a.nome}.` };
      }
      case 'gasb': {
        G.b = D.GASES.find(g => g.id === v) || G.b; this._grReset();
        return { say: `Gás da direita: ${G.b.nome}.` };
      }
      case 'grT': G.T = v; return;
      case 'kinGas': {
        K.gas = D.GASES.find(g => g.id === v) || K.gas;
        K.eng.resample();
        return { say: `${K.gas.nome} selecionado no motor cinético.` };
      }
      case 'kinN': K.N = v; return;
      case 'kinT': K.T = v; return;
      case 'kinV': K.V = v; return;
      case 'kinR': K.r = v; return;
      case 'kincol': K.collisions = (v === 'on'); return { say: K.collisions ? 'Colisões entre partículas ligadas.' : 'Colisões entre partículas desligadas.' };
      case 'kinview': K.colorMode = v; return;
      case 'kinhist': K.histOn = (v === 'on'); return;
    }
  }

  action(name, el) {
    const T = this.tr, G = this.gr, K = this.kin;
    if (name === 'tr-reset') {
      Object.assign(T, { n: 1, T: 300, V: 20, P: 1 });
      this.app.syncSlider('tr-n', 1); this.app.syncSlider('tr-t', 300); this.app.syncSlider('tr-v', 20); this.app.syncSlider('tr-p', 1);
      playTone(440, .07, .05);
      announce('Transformação reiniciada: 1 mol, 300 kelvin, 20 litros, 1 atmosfera de referência.');
    } else if (name === 'cla-status') {
      const c = this._claCalc();
      playTone(700, .08, .06);
      announce(`${this.cl.gas.nome}: pressão de ${fmt(c.P, 2)} atmosferas e densidade de ${fmt(c.d, 2)} gramas por litro.`, 'assertive');
    } else if (name === 'liberar') {
      this._grReset(); G.run = true;
      if (isReduced()) { G.fa = this._grMeet(); G.fb = 1 - G.fa; G.run = false; G.done = true; }
      playTone(700, .08, .06);
      announce(`${G.a.nome} e ${G.b.nome} liberados nas pontas do tubo.`);
    } else if (name === 'gr-reset') {
      this._grReset();
      playTone(440, .07, .05); announce('Tubo limpo. Escolha os gases e libere novamente.');
    } else if (name === 'par') {
      const a = el && el.dataset.a, b = el && el.dataset.b;
      if (a && b) {
        G.a = this.D.GASES.find(g => g.id === a) || G.a;
        G.b = this.D.GASES.find(g => g.id === b) || G.b;
        this._grReset();
        const selA = document.getElementById('graham-a'), selB = document.getElementById('graham-b');
        if (selA) selA.value = G.a.id; if (selB) selB.value = G.b.id;
        playTone(600, .07, .05);
        announce(`Dupla selecionada: ${G.a.nome} e ${G.b.nome}. Clique em Liberar gases.`);
      }
    } else if (name === 'kin-mb') {
      K.eng.resample();
      playTone(700, .08, .06);
      announce('Velocidades redistribuídas pela distribuição de Maxwell-Boltzmann.');
    } else if (name === 'kin-uni') {
      K.eng.uniform();
      playTone(500, .08, .06);
      announce('Todas as partículas com a mesma rapidez agora — repare que a distribuição deixa de ser Maxwell-Boltzmann.');
    } else if (name === 'kin-reset') {
      Object.assign(K, { N: 80, T: 300, V: 24.6, r: 3, collisions: true });
      this.app.syncSlider('kin-n', 80); this.app.syncSlider('kin-t', 300); this.app.syncSlider('kin-v', 24.6); this.app.syncSlider('kin-r', 3);
      this.app._syncSeg && this.app._syncSeg('kincol', 'on');
      K.eng.resample();
      playTone(440, .07, .05);
      announce('Motor cinético reiniciado: 80 partículas, 300 kelvin, 24,6 litros.');
    }
  }

  /* ── setas do teclado no canvas ── */
  onArrow(dx, dy) {
    if (this.mode === 'cinetica') {
      const K = this.kin;
      if (dy) { K.T = clamp(K.T - dy * 10, 0, 1000); this.app.syncSlider('kin-t', K.T); }
      if (dx) { K.V = clamp(K.V + dx * 0.5, 10, 50); this.app.syncSlider('kin-v', K.V); }
      return !!(dx || dy);
    }
    if (this.mode === 'transform') {
      const T = this.tr;
      if (dy) { T.T = clamp(T.T - dy * 5, 0, 600); this.app.syncSlider('tr-t', T.T); }
      if (dx) {
        if (T.tipo === 'isobarica') { T.P = clamp(T.P + dx * 0.05, 0.5, 3); this.app.syncSlider('tr-p', T.P); }
        else { T.V = clamp(T.V + dx * 1, 5, 50); this.app.syncSlider('tr-v', T.V); }
      }
      return !!(dx || dy);
    }
    return false;
  }

  /* ── contas ── */
  _trCalc() {
    const T = this.tr, R = this.D.R, n = T.n;
    if (T.tipo === 'isobarica') {
      const V = n * R * T.T / T.P;
      return { P: T.P, V, T: T.T, n, inv: T.tipo };
    }
    const P = n * R * T.T / T.V;
    return { P, V: T.V, T: T.T, n, inv: T.tipo };
  }
  _claCalc() {
    const C = this.cl, R = this.D.R;
    const P = C.n * R * C.T / C.V;
    return { P, d: P * C.gas.M / (R * C.T), massa: C.n * C.gas.M };
  }
  _grV(g) { return GRAHAM_K * Math.sqrt(Math.max(1, this.gr.T)) / Math.sqrt(g.M); } // fração do tubo por segundo
  _grMeet() { const va = this._grV(this.gr.a), vb = this._grV(this.gr.b); return va / (va + vb); }
  _grReset() {
    Object.assign(this.gr, { fa: 0, fb: 0, run: false, done: false, ta: 0 });
    const seed = [];
    for (let i = 0; i < 44; i++) seed.push({ s: Math.pow(Math.random(), .7), y: Math.random(), ph: Math.random() * Math.PI * 2, sp: .6 + Math.random() * .8 });
    this.gr.seed = seed;
  }
  _kinPressure() {
    const K = this.kin, D = this.D;
    const Pideal = (K.N / D.PART_PER_MOL) * D.R * K.T / K.V;
    return K.eng.pressureFrac * Pideal;
  }

  update(dt, app) {
    const G = this.gr;
    if (G.run) {
      G.ta += dt;
      G.fa = Math.min(1, G.fa + this._grV(G.a) * dt);
      G.fb = Math.min(1, G.fb + this._grV(G.b) * dt);
      if (G.fa + G.fb >= 1 && !G.done) {
        G.done = true; G.run = false;
        const m = this._grMeet();
        playTone(880, .12, .06);
        announce(`Encontro! ${G.a.nome} percorreu ${fmt(m * 100, 0)} por cento do tubo e ${G.b.nome}, ${fmt((1 - m) * 100, 0)} por cento — razão de velocidades ${fmt(Math.sqrt(G.b.M / G.a.M), 2)}.`, 'assertive');
        if (app) app.refresh();
      }
    }
    if (!isReduced()) {
      if (this.mode === 'transform') this.tr.eng.step(dt);
      else if (this.mode === 'clapeyron') this.cl.eng.step(dt);
      else if (this.mode === 'cinetica') this.kin.eng.step(dt);
    }
  }

  /* ── desenho ── */
  draw(ctx, W, H, app) {
    if (this.mode === 'transform') this._dTransform(ctx, W, H, app);
    else if (this.mode === 'clapeyron') this._dClape(ctx, W, H, app);
    else if (this.mode === 'graham') this._dGraham(ctx, W, H, app);
    else this._dKinetic(ctx, W, H, app);
  }

  _gauge(ctx, cx, cy, r, P, pmax, cor) {
    ctx.save();
    ctx.strokeStyle = cssVar('--glass'); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI * .75, Math.PI * 2.25); ctx.stroke();
    for (let i = 0; i <= 4; i++) {
      const a = Math.PI * .75 + i / 4 * Math.PI * 1.5;
      ctx.strokeStyle = cssVar('--text-muted'); ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * (r - 6), cy + Math.sin(a) * (r - 6));
      ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); ctx.stroke();
      kLabel(ctx, fmt(pmax * i / 4, 0), cx + Math.cos(a) * (r + 11), cy + Math.sin(a) * (r + 11), { size: 9, color: cssVar('--text-muted'), mono: true });
    }
    const a = Math.PI * .75 + clamp(P / pmax, 0, 1) * Math.PI * 1.5;
    ctx.strokeStyle = cor; ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * (r - 9), cy + Math.sin(a) * (r - 9)); ctx.stroke();
    ctx.fillStyle = cor; ctx.beginPath(); ctx.arc(cx, cy, 3.4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  /** Manômetro de duas marcas: agulha = pressão medida, traço verde = pressão ideal. */
  _gauge2(ctx, cx, cy, r, Pmedida, Pideal, pmax, cor) {
    ctx.save();
    ctx.strokeStyle = cssVar('--glass'); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI * .75, Math.PI * 2.25); ctx.stroke();
    for (let i = 0; i <= 4; i++) {
      const a = Math.PI * .75 + i / 4 * Math.PI * 1.5;
      ctx.strokeStyle = cssVar('--text-muted'); ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * (r - 6), cy + Math.sin(a) * (r - 6));
      ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); ctx.stroke();
      kLabel(ctx, fmt(pmax * i / 4, 0), cx + Math.cos(a) * (r + 11), cy + Math.sin(a) * (r + 11), { size: 9, color: cssVar('--text-muted'), mono: true });
    }
    const ai = Math.PI * .75 + clamp(Pideal / pmax, 0, 1) * Math.PI * 1.5;
    ctx.strokeStyle = cssVar('--accent-ok'); ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(ai) * (r - 10), cy + Math.sin(ai) * (r - 10));
    ctx.lineTo(cx + Math.cos(ai) * (r + 2), cy + Math.sin(ai) * (r + 2));
    ctx.stroke();
    const am = Math.PI * .75 + clamp(Pmedida / pmax, 0, 1) * Math.PI * 1.5;
    ctx.strokeStyle = cor; ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(am) * (r - 9), cy + Math.sin(am) * (r - 9)); ctx.stroke();
    ctx.fillStyle = cor; ctx.beginPath(); ctx.arc(cx, cy, 3.4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  /** Brilho térmico ambiente: azulado quando resfria, avermelhado quando aquece
   *  (referência em 300 K), com leve cintilação. Substitui indicadores textuais. */
  _thermalGlow(ctx, cx, cy, w, h, T, time) {
    const dev = clamp((T - 300) / 300, -1, 1);
    if (Math.abs(dev) < .04) return;
    const hot = dev > 0;
    const cor = hex6(cssVar(hot ? '--accent-exo' : '--accent-cyan'));
    const flick = isReduced() ? 0 : Math.sin(time * (hot ? 5 : 2.4)) * .03;
    const alpha = clamp(Math.abs(dev) * .3 + flick, .02, .38);
    const spread = Math.max(w, h) * .95;
    ctx.save();
    const g = ctx.createRadialGradient(cx, cy, spread * .1, cx, cy, spread);
    g.addColorStop(0, toRgba(cor, alpha));
    g.addColorStop(1, toRgba(cor, 0));
    ctx.fillStyle = g;
    ctx.fillRect(cx - spread, cy - spread, spread * 2, spread * 2);
    ctx.restore();
  }

  _cylinder(ctx, cx, topY, w, h, V, vmax, T, app, corGas) {
    const frac = clamp(V / vmax, .12, 1);
    const gasH = frac * (h - 26), gasY = topY + h - gasH;
    this._thermalGlow(ctx, cx, topY + h / 2, w, h, T, app.time);
    ctx.save();
    ctx.strokeStyle = cssVar('--glass'); ctx.lineWidth = 2.6;
    ctx.strokeRect(cx - w / 2, topY, w, h);
    ctx.fillStyle = cssVar('--bg-hover');
    ctx.strokeStyle = cssVar('--border-glow'); ctx.lineWidth = 1.6;
    kRound(ctx, cx - w / 2 + 3, gasY - 14, w - 6, 14, 3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = cssVar('--text-muted');
    ctx.fillRect(cx - 3, topY - 16, 6, gasY - topY + 2);
    ctx.restore();
    const box = { x: cx - w / 2 + 6, y: gasY, w: w - 12, h: gasH - 6 };
    const eng = this.tr.eng;
    eng.config({ T, M: 28, r: 3.2 });
    eng.setBox(box);
    eng.setN(26);
    ctx.save();
    ctx.fillStyle = corGas; ctx.globalAlpha = .9;
    eng.parts.forEach(p => { ctx.beginPath(); ctx.arc(p.x, p.y, 3.2, 0, Math.PI * 2); ctx.fill(); });
    ctx.restore();
    return box;
  }

  _dTransform(ctx, W, H, app) {
    const c = this._trCalc();
    const cw = clamp(W * .26, 130, 190), ch = H * .58, top = H * .16, cx = W * .34;
    this._cylinder(ctx, cx, top, cw, ch, c.V, 50, c.T, app, cssVar('--accent-main'));
    kThermo(ctx, W * .11, top + 8, ch * .8, c.T - 273, -273, 327, { escala: false, casas: 0, rotulo: false });
    this._gauge(ctx, W * .72, H * .34, clamp(W * .09, 40, 60), c.P, 4, cssVar('--accent-amber'));
  }

  _dClape(ctx, W, H, app) {
    const C = this.cl, c = this._claCalc(), g = C.gas;
    const cw = clamp(W * .3, 150, 220), ch = H * .56, top = H * .16, cx = W * .32;
    const frac = clamp(C.V / 50, .15, 1), gasH = frac * ch, gasY = top + ch - gasH;
    this._thermalGlow(ctx, cx, top + ch / 2, cw, ch, C.T, app.time);
    ctx.save();
    ctx.strokeStyle = cssVar('--glass'); ctx.lineWidth = 2.6;
    ctx.strokeRect(cx - cw / 2, gasY, cw, gasH);
    ctx.restore();
    const box = { x: cx - cw / 2 + 6, y: gasY + 6, w: cw - 12, h: gasH - 12 };
    const eng = this.cl.eng, r = clamp(2.6 + Math.sqrt(g.M) * .16, 3, 4.6);
    eng.config({ T: C.T, M: g.M, r });
    eng.setBox(box);
    eng.setN(clamp(Math.round(C.n * 24), 5, 80));
    ctx.save();
    ctx.fillStyle = g.cor; ctx.globalAlpha = .92;
    eng.parts.forEach(p => { ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill(); });
    ctx.restore();
    this._gauge(ctx, W * .74, H * .3, clamp(W * .09, 40, 60), c.P, 6, cssVar('--accent-amber'));
  }

  _dGraham(ctx, W, H, app) {
    const G = this.gr;
    const tx = W * .1, tw = W * .8, ty = H * .42, th = clamp(H * .12, 34, 56);
    ctx.save();
    ctx.strokeStyle = cssVar('--glass'); ctx.lineWidth = 2.6;
    kRound(ctx, tx, ty, tw, th, th / 2); ctx.stroke();
    const xa = tx + G.fa * tw, xb = tx + (1 - G.fb) * tw;
    ctx.globalAlpha = .34; ctx.fillStyle = G.a.cor;
    kRound(ctx, tx + 2, ty + 2, Math.max(0, xa - tx - 4), th - 4, th / 2 - 2); ctx.fill();
    ctx.fillStyle = G.b.cor;
    kRound(ctx, Math.min(tx + tw - 2, xb + 2), ty + 2, Math.max(0, tx + tw - xb - 4), th - 4, th / 2 - 2); ctx.fill();
    ctx.globalAlpha = 1; ctx.restore();
    // "chumaços de algodão" coloridos nas pontas — identificam os gases sem texto
    ctx.save();
    ctx.fillStyle = G.a.cor; ctx.globalAlpha = .95;
    kRound(ctx, tx - 9, ty - 3, 10, th + 6, 4); ctx.fill();
    ctx.fillStyle = G.b.cor;
    kRound(ctx, tx + tw - 1, ty - 3, 10, th + 6, 4); ctx.fill();
    ctx.restore();
    if (!isReduced() && (G.run || G.done) && G.seed.length) {
      ctx.save();
      G.seed.forEach(sd => {
        const jitter = Math.sin(app.time * sd.sp + sd.ph) * 3;
        const ay = ty + 6 + sd.y * (th - 12);
        const ax = tx + sd.s * (xa - tx) + jitter;
        if (ax >= tx && ax <= xa) { ctx.fillStyle = G.a.cor; ctx.globalAlpha = .85; ctx.beginPath(); ctx.arc(ax, ay, 2.4, 0, Math.PI * 2); ctx.fill(); }
        const bx = xb + sd.s * (tx + tw - xb) + jitter;
        if (bx >= xb && bx <= tx + tw) { ctx.fillStyle = G.b.cor; ctx.beginPath(); ctx.arc(bx, ay, 2.4, 0, Math.PI * 2); ctx.fill(); }
      });
      ctx.restore();
    }
    if (G.done) {
      const mx = tx + this._grMeet() * tw;
      ctx.save(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.globalAlpha = .9;
      ctx.beginPath(); ctx.moveTo(mx, ty - 6); ctx.lineTo(mx, ty + th + 6); ctx.stroke(); ctx.restore();
    }
  }

  _kinHisto(ctx, eng, g, W, H) {
    const bins = 22;
    const { counts, binWidth, vmax } = eng.histo(bins);
    const topCount = Math.max(1, Math.max(...counts));
    const ax = kAxes(ctx, {
      x: W * .08, y: H * .58, w: W * .84, h: H * .28,
      xmin: 0, xmax: Math.max(1, vmax), ymin: 0, ymax: topCount * 1.15,
      xticks: [0, vmax * .25, vmax * .5, vmax * .75, vmax], yticks: [],
      xlab: 'rapidez (escala do motor)', fmtx: v => fmt(v, 0),
    });
    ctx.save();
    ctx.fillStyle = g.cor; ctx.globalAlpha = .75;
    counts.forEach((c, i) => {
      const x0 = ax.px(i * binWidth), x1 = ax.px((i + 1) * binWidth);
      const y0 = ax.py(0), y1 = ax.py(c);
      ctx.fillRect(x0 + 1, y1, Math.max(1, x1 - x0 - 2), y0 - y1);
    });
    ctx.restore();
    const N = eng.parts.length, sigma = Math.max(.001, eng.sigmaT);
    const pts = [];
    for (let v = 0; v <= vmax; v += vmax / 60) {
      const f = N * binWidth * (v / (sigma * sigma)) * Math.exp(-v * v / (2 * sigma * sigma));
      pts.push([v, f]);
    }
    kLine(ctx, pts, ax.px, ax.py, { color: cssVar('--accent-ok'), w: 2 });
    const vrms2d = sigma * Math.SQRT2;
    ctx.save();
    ctx.strokeStyle = cssVar('--text-primary'); ctx.setLineDash([4, 3]); ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(ax.px(vrms2d), ax.py(0)); ctx.lineTo(ax.px(vrms2d), ax.py(topCount * 1.1)); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  _dKinetic(ctx, W, H, app) {
    const K = this.kin, D = this.D, g = K.gas, eng = K.eng;
    const boxX = W * .05, boxY = H * .10, boxW = clamp(W * .5, 200, 380), boxH = clamp(H * .4, 140, 230);
    const frac = clamp(K.V / 50, .2, 1), w = Math.max(30, boxW * frac);
    ctx.save();
    ctx.strokeStyle = cssVar('--glass'); ctx.lineWidth = 2.6;
    ctx.strokeRect(boxX, boxY, boxW, boxH);
    ctx.fillStyle = cssVar('--bg-hover');
    ctx.strokeStyle = cssVar('--border-glow'); ctx.lineWidth = 1.6;
    kRound(ctx, boxX + w - 6, boxY - 4, 12, boxH + 8, 3); ctx.fill(); ctx.stroke();
    ctx.restore();
    const box = { x: boxX + 4, y: boxY + 4, w: Math.max(20, w - 10), h: boxH - 8 };
    eng.config({ T: K.T, M: g.M, r: K.r });
    eng.setBox(box);
    eng.setN(Math.round(K.N));
    eng.collisions = K.collisions;
    ctx.save();
    eng.parts.forEach(p => {
      let color;
      if (K.colorMode === 'vel') {
        const speed = Math.hypot(p.vx, p.vy);
        const t = clamp(speed / (Math.max(1, eng.sigmaT) * 3.4), 0, 1);
        color = speedColor(t);
      } else color = g.cor;
      ctx.fillStyle = color; ctx.globalAlpha = .88;
      ctx.beginPath(); ctx.arc(p.x, p.y, K.r, 0, Math.PI * 2); ctx.fill();
    });
    ctx.restore();

    const Pideal = (K.N / D.PART_PER_MOL) * D.R * K.T / K.V;
    const Pm = eng.pressureFrac * Pideal;
    const pmaxList = [2, 3, 4, 6, 8, 10, 15, 20];
    const pmax = pmaxList.find(m => m >= Math.max(Pm, Pideal) * 1.05) || 20;
    this._gauge2(ctx, W * .80, H * .22, clamp(W * .075, 34, 52), Pm, Pideal, pmax, g.cor);

    if (K.histOn) this._kinHisto(ctx, eng, g, W, H);
  }

  getResults() {
    if (this.mode === 'transform') {
      const c = this._trCalc(), t = this.tr.tipo, zeroAbs = c.T <= 0;
      return [
        { l: 'Transformação', v: this.D.TRANSFORMACOES[t].nome },
        { l: 'Quantidade n', v: `${fmt(c.n, 1)} mol` },
        { l: 'Pressão P', v: `${fmt(c.P, 2)} atm`, cls: t === 'isobarica' ? '' : 'val-ok' },
        { l: 'Volume V', v: `${fmt(c.V, 1)} L`, cls: t === 'isobarica' ? 'val-ok' : '' },
        { l: 'Temperatura T', v: `${fmt(c.T, 0)} K (${fmt(c.T - 273, 0)} °C)` },
        { l: 'P·V', v: `${fmt(c.P * c.V, 1)} atm·L`, cls: t === 'isotermica' ? 'val-ok' : '' },
        { l: 'V/T', v: zeroAbs ? 'indefinido (T = 0)' : `${fmt(c.V / c.T, 4)} L/K`, cls: t === 'isobarica' ? 'val-ok' : '' },
        { l: 'P/T', v: zeroAbs ? 'indefinido (T = 0)' : `${fmt(c.P / c.T, 4)} atm/K`, cls: t === 'isocorica' ? 'val-ok' : '' },
      ];
    }
    if (this.mode === 'clapeyron') {
      const C = this.cl, c = this._claCalc(), g = C.gas, D = this.D, zeroAbs = C.T <= 0;
      const dCNTP = g.M / 22.4, vr298 = vrms3D(298, g.M, D.RSI);
      return [
        { l: 'Gás', v: `${g.f} — ${g.nome}` },
        { l: 'Massa molar M', v: `${fmt(g.M, 2)} g/mol` },
        { l: 'Ponto de ebulição', v: `${fmt(g.Teb, 1)} °C${g.sub ? ' (sublima)' : ''}` },
        { l: 'Densidade nas CNTP', v: `${fmt(dCNTP, 3)} g/L` },
        { l: 'v_rms a 298 K', v: `${fmt(vr298, 0)} m/s` },
        { l: 'van der Waals (a · b)', v: `${fmt(g.a, 2)} atm·L²/mol² · ${fmt(g.b, 4)} L/mol` },
        { l: 'Quantidade n', v: `${fmt(C.n, 1)} mol` },
        { l: 'Temperatura', v: `${fmt(C.T, 0)} K` },
        { l: 'Volume', v: `${fmt(C.V, 1)} L` },
        { l: 'Pressão P = nRT/V', v: `${fmt(c.P, 2)} atm`, cls: 'val-ok' },
        { l: 'Massa do gás', v: `${fmt(c.massa, 1)} g` },
        { l: 'Densidade d = PM/RT', v: zeroAbs ? 'indefinido (T = 0)' : `${fmt(c.d, 2)} g/L`, cls: 'val-endo' },
      ];
    }
    if (this.mode === 'graham') {
      const G = this.gr, m = this._grMeet();
      const tPrevisto = 1 / (this._grV(G.a) + this._grV(G.b));
      const anel = (G.a.id === 'nh3' && G.b.id === 'hcl') || (G.a.id === 'hcl' && G.b.id === 'nh3');
      return [
        { l: 'Gás A (esquerda)', v: G.a.nome },
        { l: 'Gás B (direita)', v: G.b.nome },
        { l: 'Temperatura', v: `${fmt(G.T, 0)} K` },
        { l: 'v_A / v_B', v: `√(${fmt(G.b.M, 1)}/${fmt(G.a.M, 1)}) = ${fmt(Math.sqrt(G.b.M / G.a.M), 2)}`, cls: 'val-ok' },
        { l: 'Progresso atual de A', v: `${fmt(G.fa * 100, 0)} % do tubo` },
        { l: 'Progresso atual de B', v: `${fmt(G.fb * 100, 0)} % do tubo` },
        { l: 'Trajeto previsto de A', v: `${fmt(m * 100, 0)} % do tubo` },
        { l: 'Trajeto previsto de B', v: `${fmt((1 - m) * 100, 0)} % do tubo` },
        { l: 'Tempo até o encontro', v: G.done ? `${fmt(G.ta, 1)} s` : `${fmt(tPrevisto, 1)} s (previsto)` },
        { l: 'Situação', v: G.done ? (anel ? 'anel branco de NH₄Cl formado' : 'encontro registrado') : (G.run ? 'difundindo…' : 'aguardando'), cls: G.done ? 'val-ok' : '' },
      ];
    }
    const K = this.kin, eng = K.eng, g = K.gas, D = this.D;
    const nMol = K.N / D.PART_PER_MOL;
    const Pideal = nMol * D.R * K.T / K.V;
    const Pm = this._kinPressure();
    const Tk = K.T * eng.tRatio();
    const vr = vrms3D(K.T, g.M, D.RSI);
    return [
      { l: 'Gás', v: `${g.f} — ${g.nome}` },
      { l: 'Partículas', v: `${K.N} ≙ ${fmt(nMol, 2)} mol` },
      { l: 'Temperatura alvo', v: `${fmt(K.T, 0)} K` },
      { l: 'Temperatura cinética', v: `${fmt(Tk, 0)} K`, cls: 'val-endo' },
      { l: 'Volume', v: `${fmt(K.V, 1)} L` },
      { l: 'Pressão ideal (P = nRT/V)', v: `${fmt(Pideal, 2)} atm` },
      { l: 'Pressão medida (choques)', v: `${fmt(Pm, 2)} atm`, cls: 'val-ok' },
      { l: 'v_rms (3D)', v: `${fmt(vr, 0)} m/s` },
      { l: 'Colisões/s', v: `${fmt(eng.collRate, 0)}` },
    ];
  }

  getOverlay() {
    if (this.mode === 'transform') { const c = this._trCalc(); return `${this.D.TRANSFORMACOES[this.tr.tipo].nome} · ${fmt(c.P, 2)} atm`; }
    if (this.mode === 'clapeyron') { const c = this._claCalc(); return `${this.cl.gas.nome.split(' ')[0]} · ${fmt(c.P, 2)} atm`; }
    if (this.mode === 'graham') return `${this.gr.a.nome.split(' ')[0]} × ${this.gr.b.nome.split(' ')[0]}`;
    const Pm = this._kinPressure();
    return `${this.kin.gas.f} · ${fmt(Pm, 2)} atm`;
  }
}

// ══════════════════════════════════════════════════════════════════
// APP — casco genérico da família de simuladores do 2º ano.
// Mesma usabilidade do SIMA/SITQ: acordeões, Alt+1–N, Alt+P,
// Enter/Espaço no canvas, gaveta mobile, resultados ao vivo.
// A mecânica específica vive na classe Mech (definida acima).
// ══════════════════════════════════════════════════════════════════
/** Preenche uma .opt-grid com botões a partir de itens dos dados. */
function fillOptGrid(gridId, items, selValue) {
  const grid = document.getElementById(gridId);
  if (!grid) return;
  grid.innerHTML = '';
  items.forEach(it => {
    const b = document.createElement('button');
    b.className = 'opt-btn' + (String(it.value) === String(selValue) ? ' active' : '');
    b.dataset.value = it.value;
    b.setAttribute('role', 'option');
    b.setAttribute('aria-selected', String(String(it.value) === String(selValue)));
    if (it.dot) { const d = document.createElement('span'); d.className = 'opt-dot'; d.style.setProperty('--dot', it.dot); b.appendChild(d); }
    const n = document.createElement('span'); n.className = 'opt-nome'; n.textContent = it.nome; b.appendChild(n);
    if (it.extra) { const x = document.createElement('span'); x.className = 'opt-c'; x.textContent = it.extra; b.appendChild(x); }
    if (it.aria) b.setAttribute('aria-label', it.aria);
    grid.appendChild(b);
  });
}

class App {
  constructor(mech) {
    this.mech = mech;
    mech.app = this;
    this.D = window.SIM_DATA;
    this.paused = false;
    this.time = 0;
    this._curio = 0;
    this._fpsN = 0; this._fpsT = 0;

    this.canvas = document.getElementById('sim-canvas');
    this.ctx = this.canvas.getContext('2d');
    this._resize();
    window.addEventListener('resize', () => this._resize());

    this._buildModes();
    this._bindSidebar();
    this._bindHeader();
    this._bindCanvasKeys();
    if (typeof mech.build === 'function') mech.build(this);

    // ── Estado inicial: NENHUM modo ativo — nada é desenhado no canvas
    //    até o usuário clicar em "Ativar" no painel do modo desejado
    //    (mesmo contrato do SILQ: canvas em branco por padrão). ──
    this.mode = null;
    document.querySelectorAll('.panel[data-owner]').forEach(p => { p.hidden = true; });
    const hint0 = document.getElementById('canvas-hint');
    if (hint0) hint0.textContent = 'Escolha um modo ao lado e clique em "Ativar" para iniciar a simulação.';
    this.refresh();
    announce(`${this.D.ACRO} carregado. Nenhum modo ativo. Escolha um modo à esquerda e ative-o para começar.`);

    this._last = performance.now();
    requestAnimationFrame(() => this._loop());
  }

  /* ── canvas responsivo com devicePixelRatio ── */
  _resize() {
    const dpr = window.devicePixelRatio || 1;
    const r = this.canvas.getBoundingClientRect();
    this.W = Math.max(80, r.width);
    this.H = Math.max(80, r.height);
    this.canvas.width = this.W * dpr;
    this.canvas.height = this.H * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* ── painéis individuais por modo, gerados de SIM_DATA.MODES ──
     cada modo é um .panel padrão, igual a "Sobre o Modo"/"Resultados":
     cabeçalho ícone+nome+sigla+seta (expande/recolhe sozinho, cuidado
     por _bindPanelArea) + corpo com botão "Ativar", definição, fatos-
     chave, interação do canvas e itens recomendados ── */
  _buildModes() {
    const list = document.getElementById('model-list');
    this.D.MODES.forEach((m, i) => {
      const headerId = 'hdr-mode-' + m.id, bodyId = 'body-mode-' + m.id;

      const section = document.createElement('section');
      section.className = 'panel';
      section.dataset.modeCard = m.id;
      section.setAttribute('aria-labelledby', headerId);

      const header = document.createElement('button');
      header.type = 'button';
      header.id = headerId;
      header.className = 'panel-header';
      header.setAttribute('aria-expanded', 'false');
      header.setAttribute('aria-controls', bodyId);
      header.innerHTML = `<span class="panel-icon" aria-hidden="true">${m.icon || '🔹'}</span>
        <span class="panel-label">${m.nome}</span>
        <span class="panel-badge">${m.sigla}</span>
        <span class="mode-active-tag">Ativo</span>
        <span class="chevron" aria-hidden="true">▾</span>`;

      const body = document.createElement('div');
      body.id = bodyId;
      body.className = 'panel-body collapsed';

      const activateBtn = document.createElement('button');
      activateBtn.type = 'button';
      activateBtn.className = 'action-btn mode-activate-btn';
      activateBtn.innerHTML = `<span aria-hidden="true">▶</span> Ativar ${m.nome}`;
      activateBtn.addEventListener('click', () => this.setMode(m.id));
      body.appendChild(activateBtn);

      if (m.def) {
        const def = document.createElement('p');
        def.className = 'mode-define';
        def.textContent = m.def;
        body.appendChild(def);
      }

      if (m.fatos && m.fatos.length) {
        const grid = document.createElement('div');
        grid.className = 'fact-grid';
        m.fatos.forEach(ft => {
          const cell = document.createElement('div');
          cell.className = 'fact-cell';
          cell.innerHTML = `<span class="fact-label">${ft.l}</span><span class="fact-value">${ft.v}</span>`;
          grid.appendChild(cell);
        });
        body.appendChild(grid);
      }

      if (m.canvasInteracao) {
        const box = document.createElement('div');
        box.className = 'canvas-interactions';
        box.innerHTML = `<p class="canvas-interactions-title">Interações do canvas</p><p>${m.canvasInteracao}</p>`;
        body.appendChild(box);
      }

      if (m.recomendados && m.recomendados.length) {
        const rec = document.createElement('div');
        rec.className = 'recommended';
        rec.innerHTML = `<p class="recommended-title">Recomendados</p>
          <div class="chip-row">${m.recomendados.map(r => `<span class="chip">${r}</span>`).join('')}</div>`;
        body.appendChild(rec);
      }

      const hint = document.createElement('p');
      hint.className = 'hint-text';
      hint.textContent = m.hint;
      body.appendChild(hint);

      section.appendChild(header);
      section.appendChild(body);
      list.appendChild(section);
    });
  }

  setMode(id, silent) {
    const m = this.D.MODES.find(x => x.id === id);
    if (!m) return;
    this.mode = m;
    document.querySelectorAll('.panel[data-mode-card]').forEach(panel => {
      const on = panel.dataset.modeCard === id;
      panel.classList.toggle('active', on);
      const header = panel.querySelector('.panel-header');
      if (header) {
        if (on) header.setAttribute('aria-current', 'true'); else header.removeAttribute('aria-current');
      }
      if (on) {
        if (header) header.setAttribute('aria-expanded', 'true');
        const body = panel.querySelector('.panel-body');
        if (body) body.classList.remove('collapsed');
      }
    });
    document.querySelectorAll('.panel[data-owner]').forEach(p => {
      p.hidden = !(m.panels || []).includes(p.id);
    });
    const hint = document.getElementById('canvas-hint');
    if (hint) hint.textContent = m.hintCanvas || '';
    this.mech.setMode(id);
    this.refresh();
    if (!silent) {
      playTone(760, .06, .05);
      announce(`Modo ${m.nome} selecionado. ${(m.info || '').split('.')[0]}.`);
    }
  }

  /* ── delegação de controles declarativos nas duas sidebars ──
     esquerda: menus/listagens e informativos · direita: controles */
  _bindSidebar() {
    ['sidebar-left', 'sidebar-right'].forEach(id => {
      const el = document.getElementById(id);
      if (el) this._bindPanelArea(el);
    });
  }

  _bindPanelArea(sb) {

    sb.addEventListener('click', (e) => {
      const hdr = e.target.closest('.panel-header');
      if (hdr) {
        const exp = hdr.getAttribute('aria-expanded') === 'true';
        hdr.setAttribute('aria-expanded', String(!exp));
        const body = document.getElementById(hdr.getAttribute('aria-controls'));
        if (body) body.classList.toggle('collapsed', exp);
        playTone(exp ? 500 : 750, .06, .04);
        return;
      }
      const opt = e.target.closest('.opt-btn');
      if (opt) {
        const grid = opt.closest('[data-group]');
        grid.querySelectorAll('.opt-btn').forEach(b => {
          const on = b === opt;
          b.classList.toggle('active', on);
          b.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        this._param(grid.dataset.group, opt.dataset.value);
        return;
      }
      const seg = e.target.closest('.seg-btn');
      if (seg) {
        seg.closest('.seg').querySelectorAll('.seg-btn').forEach(b => b.setAttribute('aria-pressed', String(b === seg)));
        this._param(seg.closest('.seg').dataset.group, seg.dataset.value);
        return;
      }
      const act = e.target.closest('[data-action]');
      if (act) {
        this.mech.action(act.dataset.action, act);
        this.refresh();
      }
    });

    sb.addEventListener('input', (e) => {
      const t = e.target;
      if (t.matches('input[type="range"][data-bind]')) {
        const v = parseFloat(t.value);
        const out = document.getElementById('out-' + t.id);
        if (out) out.textContent = this.fmtOut(t, v);
        this._param(t.dataset.bind, v);
      }
    });
    sb.addEventListener('change', (e) => {
      if (e.target.matches('select[data-bind]')) this._param(e.target.dataset.bind, e.target.value);
    });
  }

  fmtOut(inp, v) {
    const casas = inp.dataset.fmt === 'f2' ? 2 : inp.dataset.fmt === 'f1' ? 1 : 0;
    const val = inp.dataset.pow ? Math.pow(10, v) : v;
    const txt = inp.dataset.pow ? `10^${fmt(v, 1)}` : fmt(val, casas);
    return txt + (inp.dataset.unit ? ' ' + inp.dataset.unit : '');
  }

  _param(k, v) {
    const r = this.mech.setParam(k, v) || {};
    if (r.warn) announce(r.warn, 'assertive');
    if (r.say) announce(r.say);
    this.refresh();
  }

  /** Sincroniza um slider programaticamente (valor + output). */
  syncSlider(id, v) {
    const inp = document.getElementById(id);
    if (!inp) return;
    inp.value = v;
    const out = document.getElementById('out-' + id);
    if (out) out.textContent = this.fmtOut(inp, parseFloat(inp.value));
  }

  /** Sincroniza visualmente um grupo .seg (data-group) para o valor dado, sem re-disparar o parâmetro. */
  _syncSeg(group, value) {
    const grid = document.querySelector(`.seg[data-group="${group}"]`);
    if (!grid) return;
    grid.querySelectorAll('.seg-btn').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.value === value)));
  }

  /* ── resultados + rótulo flutuante ── */
  refresh() {
    const grid = document.getElementById('result-grid');
    const resultPanel = grid ? grid.closest('.panel') : null;
    if (grid) {
      grid.innerHTML = '';
      if (!this.mode) {
        // Nenhum modo ativo: painel de Análise fica com aviso neutro,
        // igual ao "Clique em elementos..." do SILQ antes de qualquer ação.
        const p = document.createElement('p');
        p.className = 'hint-text';
        p.textContent = 'Ative um modo à esquerda para ver aqui a análise dos resultados.';
        grid.appendChild(p);
      } else {
        (this.mech.getResults() || []).forEach(r => {
          const row = document.createElement('div'); row.className = 'data-row';
          const dt = document.createElement('dt'); dt.className = 'data-label'; dt.textContent = r.l;
          const dd = document.createElement('dd'); dd.className = 'data-value' + (r.cls ? ' ' + r.cls : '');
          dd.textContent = r.v;
          row.append(dt, dd); grid.appendChild(row);
        });
      }
    }
    if (resultPanel) resultPanel.classList.toggle('panel--waiting', !this.mode);
    const ov = document.getElementById('overlay-label');
    if (ov) ov.textContent = this.mode ? ((this.mech.getOverlay && this.mech.getOverlay()) || this.mode.overlay || this.mode.nome) : this.D.ACRO;
  }

  /* ── header: pausa + curiosidades ── */
  _bindHeader() {
    const pb = document.getElementById('btn-pause');
    if (pb) pb.addEventListener('click', () => this.togglePause());
    const logo = document.getElementById('btn-app-logo');
    if (logo) logo.addEventListener('click', () => {
      const c = this.D.CURIOSIDADES;
      if (!c || !c.length) return;
      const fato = c[this._curio++ % c.length];
      playTone(660, .09, .06);
      announce('Você sabia? ' + fato);
    });
    document.addEventListener('keydown', (e) => {
      if (!e.altKey) return;
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= this.D.MODES.length) { e.preventDefault(); this.setMode(this.D.MODES[n - 1].id); }
      else if (e.key.toLowerCase() === 'p') { e.preventDefault(); this.togglePause(); }
    });
  }

  togglePause() {
    this.paused = !this.paused;
    const pb = document.getElementById('btn-pause'), ic = document.getElementById('pause-icon');
    if (pb) { pb.setAttribute('aria-pressed', String(this.paused)); pb.setAttribute('aria-label', this.paused ? 'Retomar animação' : 'Pausar animação'); }
    if (ic) ic.textContent = this.paused ? '▶' : '⏸';
    playTone(this.paused ? 400 : 800, .07, .05);
    announce(this.paused ? 'Animação pausada.' : 'Animação retomada.');
  }

  /* ── teclado no canvas: Enter/Espaço = ação primária; setas → mech ── */
  _bindCanvasKeys() {
    this.canvas.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (this.mode && this.mode.primary) { this.mech.action(this.mode.primary); this.refresh(); }
      } else if (this.mode && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key) && this.mech.onArrow) {
        const dx = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
        const dy = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0;
        if (this.mech.onArrow(dx, dy)) { e.preventDefault(); this.refresh(); }
      }
    });
    if (this.mech.onDrag) {
      let drag = false, lx = 0, ly = 0;
      this.canvas.addEventListener('pointerdown', e => { drag = true; lx = e.clientX; ly = e.clientY; this.canvas.setPointerCapture(e.pointerId); });
      this.canvas.addEventListener('pointermove', e => {
        if (!drag) return;
        this.mech.onDrag(e.clientX - lx, e.clientY - ly); lx = e.clientX; ly = e.clientY;
      });
      const up = () => { drag = false; };
      this.canvas.addEventListener('pointerup', up);
      this.canvas.addEventListener('pointercancel', up);
    }
  }

  /* ── loop rAF ── */
  _loop() {
    const now = performance.now();
    const dt = clamp((now - this._last) / 1000, 0, .05);
    this._last = now;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.W, this.H);

    // Sem modo ativo → canvas permanece em branco (nada é desenhado
    // "sozinho"; exige ativação explícita do usuário no painel).
    if (this.mode) {
      if (!this.paused) {
        this.time += dt;
        this.mech.update(dt, this);
      }
      this.mech.draw(ctx, this.W, this.H, this);

      this._fpsN++;
      if (now - this._fpsT > 500) {
        const el = document.getElementById('fps-counter');
        if (el) el.textContent = Math.round(this._fpsN * 1000 / (now - this._fpsT)) + ' fps';
        this._fpsN = 0; this._fpsT = now;
      }
      // Modo Cinética tem grandezas MEDIDAS (pressão, temperatura, colisões/s) e o
      // modo Graham tem progresso ao vivo durante a corrida — ambos evoluem
      // sozinhos durante a animação, então os Resultados são atualizados a cada
      // ~300ms sem precisar de interação do usuário (evita reflow a cada quadro).
      if (!this.paused && (this.mode.id === 'cinetica' || (this.mode.id === 'graham' && this.mech.gr.run))) {
        if (now - (this._kinRefT || 0) > 300) { this._kinRefT = now; this.refresh(); }
      }
    }
    requestAnimationFrame(() => this._loop());
  }
}

window.addEventListener('DOMContentLoaded', () => new App(new Mech(window.SIM_DATA)));

// ══════════════════════════════════════════════════════════════════
// MOBILE OFF-CANVAS — as duas sidebars viram gavetas em telas
// estreitas: a esquerda (menus e informações) desliza da esquerda e
// a direita (controles) desliza da direita. Botões próprios no
// header, backdrop compartilhado, Escape fecha, abrir uma fecha a
// outra. (Mesmo padrão do SIMA/SITQ, estendido para dois lados.)
// ══════════════════════════════════════════════════════════════════
function initMobileSidebar() {
  const backdrop = document.getElementById('mobile-backdrop');
  if (!backdrop) return;

  const gavetas = [
    { btn: document.getElementById('mobile-info-btn'), el: document.getElementById('sidebar-left') },
    { btn: document.getElementById('mobile-menu-btn'), el: document.getElementById('sidebar-right') },
  ].filter(g => g.btn && g.el);
  if (!gavetas.length) return;

  function fecharTodas() {
    gavetas.forEach(g => {
      g.el.classList.remove('mobile-open');
      g.btn.setAttribute('aria-expanded', 'false');
    });
    backdrop.hidden = true;
  }
  function abrir(g) {
    fecharTodas();
    g.el.classList.add('mobile-open');
    g.btn.setAttribute('aria-expanded', 'true');
    backdrop.hidden = false;
  }

  gavetas.forEach(g => {
    g.btn.addEventListener('click', () => {
      g.el.classList.contains('mobile-open') ? fecharTodas() : abrir(g);
    });
    // Fecha a gaveta ao escolher um modo/opção em telas estreitas
    g.el.addEventListener('click', (e) => {
      if (e.target.closest('.mode-activate-btn, .opt-btn') && window.innerWidth <= 1100) {
        setTimeout(fecharTodas, 150);
      }
    });
  });
  backdrop.addEventListener('click', fecharTodas);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fecharTodas(); });

  window._closeSidebar = fecharTodas;
}
window.addEventListener('DOMContentLoaded', initMobileSidebar);

// ══════════════════════════════════════════════════════════════════
// SIDEBARS REDIMENSIONÁVEIS
// Alça (.sidebar-resizer) na borda interna de cada sidebar; arrastar
// ajusta --swl (esquerda) ou --swr (direita) em tempo real; a largura
// escolhida persiste em localStorage. Ignorada no modo gaveta mobile
// (position:fixed). (Mesmo contrato do SIMA — chaves deste simulador.)
// ══════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', function () {
  var targets = [
    { id: 'sidebar-left', side: 'left', cssVar: '--swl', min: 250, max: 480 },
    { id: 'sidebar-right', side: 'right', cssVar: '--swr', min: 250, max: 480 },
  ];
  var root = document.documentElement;
  var rafPending = false;

  function fireResize() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(function () {
      rafPending = false;
      window.dispatchEvent(new Event('resize'));
    });
  }

  targets.forEach(function (cfg) {
    var el = document.getElementById(cfg.id);
    if (!el) return;

    var storeKey = 'gases-w-' + cfg.cssVar.replace(/^--/, '');
    try {
      var saved = parseInt(localStorage.getItem(storeKey), 10);
      if (saved && saved >= cfg.min && saved <= cfg.max) {
        root.style.setProperty(cfg.cssVar, saved + 'px');
      }
    } catch (e) { /* localStorage indisponível — segue sem persistência */ }

    var handle = document.createElement('div');
    handle.className = 'sidebar-resizer sidebar-resizer--' + cfg.side;
    handle.setAttribute('aria-hidden', 'true');
    el.appendChild(handle);

    var dragging = false, startX = 0, startW = 0;

    handle.addEventListener('pointerdown', function (e) {
      if (getComputedStyle(el).position === 'fixed') return; // gaveta mobile
      dragging = true;
      startX = e.clientX;
      startW = el.getBoundingClientRect().width;
      handle.classList.add('dragging');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      try { handle.setPointerCapture(e.pointerId); } catch (err) {}
      e.preventDefault();
    });

    handle.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var delta = e.clientX - startX;
      var w = cfg.side === 'left' ? startW + delta : startW - delta;
      w = Math.max(cfg.min, Math.min(cfg.max, Math.round(w)));
      root.style.setProperty(cfg.cssVar, w + 'px');
      fireResize();
    });

    function endDrag() {
      if (!dragging) return;
      dragging = false;
      handle.classList.remove('dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      try {
        localStorage.setItem(storeKey, Math.round(el.getBoundingClientRect().width));
      } catch (e) { /* sem persistência */ }
      fireResize();
    }
    handle.addEventListener('pointerup', endDrag);
    handle.addEventListener('pointercancel', endDrag);
  });
});
