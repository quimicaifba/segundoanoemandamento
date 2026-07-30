/* ================================================================
   SIRAD — scrpitradioatividade.js | mecânica e casco do simulador
   de Radioatividade
   ================================================================
   Mesmo casco da família do 2º ano (receptor de acessibilidade,
   kit de desenho, App, gaveta mobile e alças de redimensionar).
   A classe Mech implementa: emissões α/β/γ com barreiras e campo
   elétrico, meia-vida com amostra de 100 núcleos e fissão em
   cadeia com barras de controle. Requer dadosradioatividade.js.
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
// MECÂNICA — SIRAD · Radioatividade
// Emissões: trajetórias de α, β e γ contra barreiras (papel, alumínio,
// chumbo) ou entre placas eletrizadas. Meia-vida: N = N₀·(1/2)^(t/t½)
// numa grade de 100 átomos com ordem de decaimento pré-sorteada.
// Cadeia: nêutrons móveis fissionam U-235 e liberam 3 nêutrons,
// filtrados pelas barras de controle (k = 3·(1 − controle)).
// ══════════════════════════════════════════════════════════════════
class Mech {
  constructor(D) {
    this.D = D;
    this.mode = 'emissoes';
    this.em = { cenario: 'barreiras', fase: 1.2, pulso: 0 };
    this.mv = { iso: D.ISOTOPOS[0], m0: 100, t: 0, ordem: this._shuffle100() };
    this.cd = { nucleos: [], neutrons: [], ctrl: 50, fissoes: 0, emitidos: 0, flashes: [], iniciado: false };
    this._cdInit();
  }

  _shuffle100() {
    const a = Array.from({ length: 100 }, (_, i) => i);
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  _cdInit() {
    const C = this.cd;
    C.nucleos = [];
    for (let r = 0; r < 6; r++) for (let c = 0; c < 9; c++) {
      C.nucleos.push({ gx: c, gy: r, vivo: true });
    }
    C.neutrons = []; C.fissoes = 0; C.emitidos = 0; C.flashes = []; C.iniciado = false;
  }

  build() {
    fillOptGrid('meia-grid', this.D.ISOTOPOS.map(i => ({
      value: i.id, nome: `${i.nome} ${i.simb}`, dot: i.cor, extra: `t½ ${i.meia}`,
      aria: `${i.nome}, meia-vida de ${i.meia}. Uso: ${i.uso}`,
    })), this.mv.iso.id);
  }

  setMode(id) { this.mode = id; }

  setParam(k, v) {
    const E = this.em, M = this.mv, C = this.cd;
    switch (k) {
      case 'cenario': {
        E.cenario = v; E.fase = 0;
        return { say: v === 'barreiras'
          ? 'Cenário: barreiras de papel, alumínio e chumbo.'
          : 'Cenário: campo elétrico entre placas positiva e negativa.' };
      }
      case 'isotopo': {
        M.iso = this.D.ISOTOPOS.find(i => i.id === v) || M.iso;
        return { say: `${M.iso.nome} selecionado. Meia-vida: ${M.iso.meia}. ${M.iso.uso}.` };
      }
      case 'mvM0': M.m0 = v; return;
      case 'mvT': M.t = v; return;
      case 'cadCtrl': C.ctrl = v; return;
    }
  }

  action(name) {
    const E = this.em, M = this.mv, C = this.cd;
    if (name === 'emitir') {
      E.fase = 0; E.pulso++;
      if (isReduced()) E.fase = 1.2;
      playTone(700, .08, .06);
      announce(E.cenario === 'barreiras'
        ? 'Pulso emitido: alfa para no papel, beta no alumínio e gama atravessa até o chumbo.'
        : 'Pulso emitido: alfa desvia para a placa negativa, beta para a positiva e gama segue reto.');
    } else if (name === 'mv-sortear') {
      M.ordem = this._shuffle100();
      playTone(660, .08, .05);
      const r = this._mvCalc();
      announce(`Novo sorteio da amostra. Restam ${fmt(r.frac * 100, 1)} por cento dos núcleos após ${fmt(M.t, 1)} meias-vidas.`);
    } else if (name === 'mv-reset') {
      M.t = 0; M.m0 = 100;
      this.app.syncSlider('mv-t', 0); this.app.syncSlider('mv-m0', 100);
      playTone(440, .07, .05); announce('Amostra restaurada: 100 gramas, tempo zero.');
    } else if (name === 'disparar') {
      C.iniciado = true;
      C.neutrons.push({ x: 0, y: .5 + (Math.random() - .5) * .3, vx: .34, vy: (Math.random() - .5) * .12 });
      playTone(700, .08, .06);
      announce('Nêutron disparado contra o combustível de urânio-235.');
    } else if (name === 'cad-reset') {
      this._cdInit();
      playTone(440, .07, .05); announce('Combustível novo: todos os núcleos de urânio restaurados.');
    }
  }

  /* ── contas ── */
  _mvCalc() {
    const M = this.mv, frac = Math.pow(.5, M.t);
    return { frac, resto: M.m0 * frac, vivos: Math.round(100 * frac) };
  }
  _cdK() { return this.D.FISSAO.neutronsPorFissao * (1 - this.cd.ctrl / 100); }
  _cdRegime() {
    const k = this._cdK();
    if (k < .92) return { rot: 'subcrítica', cor: '--accent-endo', det: 'a reação se apaga' };
    if (k <= 1.12) return { rot: 'crítica', cor: '--accent-ok', det: 'reator estável' };
    return { rot: 'supercrítica', cor: '--accent-exo', det: 'crescimento explosivo' };
  }

  update(dt) {
    const E = this.em, C = this.cd;
    if (E.fase < 1.2) E.fase = Math.min(1.2, E.fase + dt * .55);
    // fissão em cadeia (coordenadas normalizadas 0..1)
    if (C.neutrons.length) {
      const vivos = C.nucleos.filter(n => n.vivo);
      for (let i = C.neutrons.length - 1; i >= 0; i--) {
        const n = C.neutrons[i];
        n.x += n.vx * dt; n.y += n.vy * dt;
        if (n.y < .04 || n.y > .96) n.vy *= -1;
        if (n.x < -.05 || n.x > 1.05) { C.neutrons.splice(i, 1); continue; }
        for (const u of vivos) {
          if (!u.vivo) continue;
          const ux = .14 + u.gx * .09, uy = .12 + u.gy * .15;
          if (Math.hypot(n.x - ux, n.y - uy) < .035) {
            u.vivo = false; C.fissoes++;
            C.flashes.push({ x: ux, y: uy, ttl: .5 });
            C.neutrons.splice(i, 1);
            for (let e = 0; e < this.D.FISSAO.neutronsPorFissao; e++) {
              C.emitidos++;
              if (Math.random() * 100 >= C.ctrl && C.neutrons.length < 90) {
                const a = Math.random() * Math.PI * 2;
                C.neutrons.push({ x: ux, y: uy, vx: Math.cos(a) * .3, vy: Math.sin(a) * .3 });
              }
            }
            playTone(520 + Math.random() * 240, .05, .03);
            break;
          }
        }
      }
      if (C.iniciado && !C.neutrons.length && C.fissoes) {
        C.iniciado = false;
        announce(`Reação encerrada: ${C.fissoes} fissões. Regime ${this._cdRegime().rot}.`, 'assertive');
      }
    }
    C.flashes.forEach(f => f.ttl -= dt);
    C.flashes = C.flashes.filter(f => f.ttl > 0);
  }

  /* ── desenho ── */
  draw(ctx, W, H, app) {
    if (this.mode === 'emissoes') this._dEmis(ctx, W, H, app);
    else if (this.mode === 'meiavida') this._dMeia(ctx, W, H);
    else this._dCadeia(ctx, W, H);
  }

  _fonte(ctx, x, y) {
    ctx.save();
    ctx.fillStyle = cssVar('--bg-hover'); ctx.strokeStyle = cssVar('--border-glow'); ctx.lineWidth = 2;
    kRound(ctx, x - 22, y - 30, 44, 60, 8); ctx.fill(); ctx.stroke();
    // trifólio
    ctx.fillStyle = cssVar('--accent-main');
    for (let i = 0; i < 3; i++) {
      const a0 = -Math.PI / 2 + i * 2 * Math.PI / 3 - .5, a1 = a0 + 1;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, 13, a0, a1); ctx.closePath(); ctx.fill();
    }
    ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    kLabel(ctx, 'fonte', x, y + 42, { size: 10, color: cssVar('--text-secondary') });
  }

  _dEmis(ctx, W, H, app) {
    const E = this.em, D = this.D.EMISSOES;
    const x0 = W * .13, y0 = H * .5;
    this._fonte(ctx, x0, y0);
    const prog = clamp(E.fase, 0, 1);
    if (E.cenario === 'barreiras') {
      const bx = [W * .38, W * .6, W * .82];
      const nomes = ['papel', 'alumínio', 'chumbo'];
      const esp = [3, 7, 16];
      bx.forEach((x, i) => {
        ctx.save(); ctx.fillStyle = cssVar('--glass');
        ctx.fillRect(x - esp[i] / 2, H * .16, esp[i], H * .68); ctx.restore();
        kLabel(ctx, nomes[i], x, H * .1, { size: 11, color: cssVar('--text-secondary'), bold: true });
      });
      const ys = [y0 - H * .18, y0, y0 + H * .18];
      const fim = [bx[0], bx[1], W * .94];   // onde cada emissão para
      D.forEach((e, i) => {
        const xEnd = x0 + 26 + (fim[i] - x0 - 26) * prog;
        ctx.save(); ctx.strokeStyle = e.cor; ctx.lineWidth = i === 0 ? 4 : i === 1 ? 2.4 : 2;
        if (i === 2) ctx.setLineDash([7, 5]);
        ctx.globalAlpha = .9;
        ctx.beginPath(); ctx.moveTo(x0 + 26, ys[i]);
        if (i === 2) { // gama ondulada
          for (let x = x0 + 26; x <= xEnd; x += 6) ctx.lineTo(x, ys[i] + Math.sin(x * .12 + app.time * 6) * 4);
        } else ctx.lineTo(xEnd, ys[i]);
        ctx.stroke(); ctx.setLineDash([]);
        // partícula na frente
        ctx.fillStyle = e.cor;
        ctx.beginPath(); ctx.arc(Math.min(xEnd, fim[i]), ys[i] + (i === 2 ? Math.sin(xEnd * .12 + app.time * 6) * 4 : 0), i === 0 ? 5 : 3.4, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        kLabel(ctx, `${e.nome} ${e.simb}`, x0 + 52, ys[i] - 14, { size: 11, color: e.cor, bold: true, align: 'left' });
        if (prog >= (fim[i] - x0) / (W * .94 - x0) || prog >= .99) {
          if (i < 2) kChip(ctx, 'barrada', fim[i] + 4, ys[i] + 18, { fg: e.cor, size: 10 });
          else kChip(ctx, 'atenuada, atravessa', W * .86, ys[i] + 20, { fg: e.cor, size: 10 });
        }
      });
    } else {
      // campo elétrico: placa + em cima, − embaixo
      ctx.save();
      ctx.fillStyle = cssVar('--accent-exo'); ctx.fillRect(W * .32, H * .12, W * .5, 6);
      ctx.fillStyle = cssVar('--accent-endo'); ctx.fillRect(W * .32, H * .86, W * .5, 6);
      ctx.restore();
      kLabel(ctx, 'placa positiva (+)', W * .57, H * .08, { size: 11, color: cssVar('--accent-exo'), bold: true });
      kLabel(ctx, 'placa negativa (−)', W * .57, H * .93, { size: 11, color: cssVar('--accent-endo'), bold: true });
      const curvas = [
        { e: D[0], k: .22 },   // alfa: desvio pequeno p/ baixo (placa −)
        { e: D[2], k: 0 },     // gama: reto
        { e: D[1], k: -.62 },  // beta: desvio grande p/ cima (placa +)
      ];
      curvas.forEach(c => {
        ctx.save(); ctx.strokeStyle = c.e.cor; ctx.lineWidth = c.e.id === 'alfa' ? 4 : 2.4;
        if (c.e.id === 'gama') ctx.setLineDash([7, 5]);
        ctx.beginPath();
        const steps = 40;
        for (let s = 0; s <= steps * prog; s++) {
          const t = s / steps, x = x0 + 26 + t * (W * .68);
          const y = y0 + c.k * t * t * H * .5;
          s ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke(); ctx.setLineDash([]);
        const t = prog, fx = x0 + 26 + t * (W * .68), fy = y0 + c.k * t * t * H * .5;
        ctx.fillStyle = c.e.cor;
        ctx.beginPath(); ctx.arc(fx, fy, c.e.id === 'alfa' ? 5 : 3.4, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        kLabel(ctx, c.e.nome, fx + 8, fy - 10, { size: 11, color: c.e.cor, bold: true, align: 'left' });
      });
      kLabel(ctx, 'β é ~7.000× mais leve que α: mesmo com carga −1, desvia muito mais', W * .55, H * .78, { size: 10, color: cssVar('--text-secondary') });
    }
  }

  _dMeia(ctx, W, H) {
    const M = this.mv, r = this._mvCalc();
    // grade 10×10 de átomos à esquerda
    const gx0 = W * .07, gy0 = H * .14, cell = Math.min(W * .38, H * .7) / 10;
    const decaidos = new Set(M.ordem.slice(0, 100 - r.vivos));
    for (let i = 0; i < 100; i++) {
      const x = gx0 + (i % 10) * cell + cell / 2, y = gy0 + Math.floor(i / 10) * cell + cell / 2;
      const morto = decaidos.has(i);
      ctx.save();
      ctx.fillStyle = morto ? cssVar('--text-muted') : M.iso.cor;
      ctx.globalAlpha = morto ? .38 : .95;
      ctx.beginPath(); ctx.arc(x, y, cell * .3, 0, Math.PI * 2); ctx.fill();
      if (morto) {
        ctx.strokeStyle = cssVar('--text-muted'); ctx.lineWidth = 1.4; ctx.globalAlpha = .8;
        ctx.beginPath(); ctx.moveTo(x - cell * .18, y - cell * .18); ctx.lineTo(x + cell * .18, y + cell * .18);
        ctx.moveTo(x + cell * .18, y - cell * .18); ctx.lineTo(x - cell * .18, y + cell * .18); ctx.stroke();
      }
      ctx.restore();
    }
    kLabel(ctx, `${r.vivos} de 100 núcleos ativos`, gx0 + cell * 5, gy0 + cell * 10 + 16, { size: 11, color: M.iso.cor, bold: true });
    // curva exponencial à direita
    const m = kAxes(ctx, {
      x: W * .56, y: H * .12, w: W * .38, h: H * .62,
      xmin: 0, xmax: 6, ymin: 0, ymax: 100,
      xticks: [0, 1, 2, 3, 4, 5, 6], yticks: [0, 25, 50, 75, 100],
      xlab: 'tempo (meias-vidas)', ylab: '% restante',
    });
    const pts = []; for (let t = 0; t <= 6.001; t += .1) pts.push([t, Math.pow(.5, t) * 100]);
    kLine(ctx, pts, m.px, m.py, { color: M.iso.cor, w: 2.6 });
    [1, 2, 3].forEach(n => kLabel(ctx, `${fmt(100 / Math.pow(2, n), 1)}%`, m.px(n) + 4, m.py(100 / Math.pow(2, n)) - 9, { size: 9, color: cssVar('--text-muted'), mono: true, align: 'left' }));
    ctx.save(); ctx.fillStyle = cssVar('--accent-amber');
    ctx.beginPath(); ctx.arc(m.px(M.t), m.py(r.frac * 100), 6, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    kChip(ctx, `${fmt(r.frac * 100, 1)} % · ${fmt(r.resto, 1)} g`, m.px(M.t), m.py(r.frac * 100) - 20, { fg: cssVar('--accent-amber'), bold: true, size: 11, border: cssVar('--accent-amber') });
    kLabel(ctx, `${M.iso.nome} · t½ = ${M.iso.meia} · t = ${fmt(M.t, 1)} t½`, W / 2, H * .93, { size: 11, color: cssVar('--text-secondary') });
  }

  _dCadeia(ctx, W, H) {
    const C = this.cd, reg = this._cdRegime();
    // caixa do combustível
    ctx.save(); ctx.strokeStyle = cssVar('--glass'); ctx.lineWidth = 2.4;
    ctx.strokeRect(W * .05, H * .05, W * .9, H * .82); ctx.restore();
    // barras de controle (opacidade ∝ controle)
    ctx.save(); ctx.globalAlpha = .1 + .55 * C.ctrl / 100; ctx.fillStyle = cssVar('--text-muted');
    for (let i = 1; i <= 4; i++) ctx.fillRect(W * (.05 + i * .18) - 4, H * .05, 8, H * .82 * (C.ctrl / 100));
    ctx.restore();
    // núcleos
    C.nucleos.forEach(u => {
      const x = W * (.05 + .9 * (.14 + u.gx * .09)), y = H * (.05 + .82 * (.12 + u.gy * .15));
      ctx.save();
      if (u.vivo) {
        ctx.fillStyle = cssVar('--accent-main'); ctx.globalAlpha = .92;
        ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#000'; ctx.globalAlpha = .5;
      } else {
        ctx.fillStyle = cssVar('--text-muted'); ctx.globalAlpha = .5;
        ctx.beginPath(); ctx.arc(x - 5, y + 3, 4.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + 5, y - 3, 4.5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    });
    // flashes de fissão
    C.flashes.forEach(f => {
      ctx.save(); ctx.strokeStyle = cssVar('--accent-amber'); ctx.globalAlpha = f.ttl * 1.6; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(W * (.05 + .9 * f.x), H * (.05 + .82 * f.y), (1 - f.ttl) * 26 + 8, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    });
    // nêutrons
    ctx.save(); ctx.fillStyle = '#ffffff';
    C.neutrons.forEach(n => { ctx.beginPath(); ctx.arc(W * (.05 + .9 * n.x), H * (.05 + .82 * n.y), 3, 0, Math.PI * 2); ctx.fill(); });
    ctx.restore();
    kChip(ctx, `k ≈ ${fmt(this._cdK(), 1)} · reação ${reg.rot}`, W / 2, H * .93, { fg: cssVar(reg.cor), bold: true, size: 12, border: cssVar(reg.cor) });
  }

  getResults() {
    if (this.mode === 'emissoes') {
      const rows = [];
      this.D.EMISSOES.forEach(e => {
        rows.push({ l: `${e.nome} — natureza`, v: e.natureza });
        rows.push({ l: `${e.nome} — barrada por`, v: e.barrada, cls: e.id === 'gama' ? 'val-exo' : '' });
      });
      return rows;
    }
    if (this.mode === 'meiavida') {
      const M = this.mv, r = this._mvCalc();
      return [
        { l: 'Isótopo', v: `${M.iso.nome} ${M.iso.simb}` },
        { l: 'Meia-vida t½', v: M.iso.meia },
        { l: 'Tempo decorrido', v: `${fmt(M.t, 1)} meias-vidas` },
        { l: 'Fração restante', v: `${fmt(r.frac * 100, 1)} %`, cls: 'val-ok' },
        { l: 'Massa inicial', v: `${fmt(M.m0, 0)} g` },
        { l: 'Massa restante', v: `${fmt(r.resto, 1)} g`, cls: 'val-ok' },
        { l: 'Já decaiu', v: `${fmt(M.m0 - r.resto, 1)} g`, cls: 'val-exo' },
        { l: 'Aplicação', v: M.iso.uso },
      ];
    }
    const C = this.cd, reg = this._cdRegime();
    return [
      { l: 'Combustível', v: this.D.FISSAO.alvo },
      { l: 'Barras de controle', v: `${fmt(C.ctrl, 0)} % de absorção` },
      { l: 'k (nêutrons úteis/fissão)', v: fmt(this._cdK(), 1), cls: 'val-ok' },
      { l: 'Regime', v: `${reg.rot} — ${reg.det}`, cls: reg.rot === 'supercrítica' ? 'val-exo' : reg.rot === 'crítica' ? 'val-ok' : 'val-endo' },
      { l: 'Fissões ocorridas', v: String(C.fissoes) },
      { l: 'Nêutrons em voo', v: String(C.neutrons.length) },
      { l: 'Núcleos restantes', v: `${C.nucleos.filter(n => n.vivo).length} de 54` },
    ];
  }

  getOverlay() {
    if (this.mode === 'emissoes') return this.em.cenario === 'barreiras' ? 'α β γ · barreiras' : 'α β γ · campo elétrico';
    if (this.mode === 'meiavida') { const r = this._mvCalc(); return `${this.mv.iso.simb} · ${fmt(r.frac * 100, 0)} %`; }
    return `fissão · ${this._cdRegime().rot}`;
  }

  onArrow(dx) {
    if (this.mode !== 'meiavida' || !dx) return false;
    this.mv.t = clamp(this.mv.t + dx * .1, 0, 6);
    this.app.syncSlider('mv-t', this.mv.t);
    return true;
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
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';

    var storeKey = 'radioatividade-w-' + cfg.cssVar.replace(/^--/, '');
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
