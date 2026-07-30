/* ================================================================
   SIEQ — scrpitequilibrio.js | mecânicas e casco do simulador de
   Equilíbrio Químico e Iônico (fusão SIEQ + SIPH)
   ================================================================
   MechA: atingir o equilíbrio, Le Chatelier e Q×K. MechB: escala de
   pH, ácidos/bases fortes × fracos e titulação. A classe Mech, no
   fim, é uma FACHADA que direciona cada modo à mecânica dona dele —
   o casco App continua idêntico ao da família. Requer
   dadosequilibrio.js.
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
// MECÂNICA A — Equilíbrio Químico (origem: SIEQ)
// Modos: atingir equilíbrio · Le Chatelier · quociente Q contra K
// ══════════════════════════════════════════════════════════════════
class MechA {
  constructor(D) {
    this.D = D;
    this.modo = 'atingir';
    // modo 1
    this.h2i = 1; this.i2i = 1; this.hii = 0;
    this.h2 = 1; this.i2 = 1; this.hi = 0;
    this.hist = []; this.trel = 0;
    // modo 2
    this.T = 25; this.V = 1;
    this.nN2O4 = 0.05; this.nNO2 = 0.02;
    this.strip = [];
    this.perturb = '—';
    // modo 3
    this.qh2 = 0.5; this.qi2 = 0.5; this.qhi = 1;
    this.fase = 0;
    this._equilibrar();
  }

  setMode(id) { this.modo = id; }

  setParam(k, v) {
    switch (k) {
      case 'h2i': this.h2i = v; this._reset(); break;
      case 'i2i': this.i2i = v; this._reset(); break;
      case 'hii': this.hii = v; this._reset(); break;
      case 'qh2': this.qh2 = v; break;
      case 'qi2': this.qi2 = v; break;
      case 'qhi': this.qhi = v; break;
    }
    return {};
  }

  action(name) {
    if (name === 'eq-reset') { this._reset(); return announce('Reação reiniciada no tempo zero.'); }
    if (name === 'qk-status') {
      const q = this._Q();
      const K = this.D.HI.kc;
      const s = q < K * 0.98 ? 'Q menor que Kc: a reação caminha para a direita, formando mais iodeto de hidrogênio.'
        : q > K * 1.02 ? 'Q maior que Kc: a reação caminha para a esquerda, regenerando hidrogênio e iodo.'
          : 'Q praticamente igual a Kc: o sistema já está em equilíbrio.';
      return announce(`Quociente Q igual a ${fmt(q, 2)} contra Kc igual a ${K}. ${s}`);
    }
    if (name === 'lch-reset') {
      this.T = 25; this.V = 1; this.nN2O4 = 0.05; this.nNO2 = 0.02;
      this.strip = []; this.perturb = '—';
      this._equilibrar();
      return announce('Frasco reiniciado a 25 graus e volume normal.');
    }
    const P = {
      'add-n2o4': () => { this.nN2O4 += 0.03; this.perturb = 'adição de N₂O₄'; },
      'add-no2':  () => { this.nNO2 += 0.03; this.perturb = 'adição de NO₂'; },
      'aquecer':  () => { this.T = Math.min(120, this.T + 10); this.perturb = 'aquecimento'; },
      'resfriar': () => { this.T = Math.max(-20, this.T - 10); this.perturb = 'resfriamento'; },
      'comprimir': () => { this.V = Math.max(0.25, this.V / 2); this.perturb = 'redução de volume'; },
      'expandir': () => { this.V = Math.min(4, this.V * 2); this.perturb = 'aumento de volume'; },
    };
    if (P[name]) {
      const antes = this._concNO2();
      P[name]();
      const dir = this._equilibrar();
      const depois = this._concNO2();
      const sentido = dir > 0 ? 'para a direita, formando mais NO₂ castanho'
        : dir < 0 ? 'para a esquerda, formando mais N₂O₄ incolor'
          : 'permanece onde estava';
      announce(`Perturbação: ${this.perturb}. O equilíbrio se desloca ${sentido}. Concentração de NO₂ vai de ${fmt(antes, 4)} para ${fmt(depois, 4)} mol por litro.`);
    }
  }

  /* ── modelo HI ── */
  _reset() {
    this.h2 = this.h2i; this.i2 = this.i2i; this.hi = this.hii;
    this.hist = []; this.trel = 0;
  }
  _Q() { return (this.qhi * this.qhi) / Math.max(1e-6, this.qh2 * this.qi2); }

  /* ── modelo N₂O₄ ⇌ 2 NO₂ ── */
  _K(T) {
    const D = this.D.NO2;
    return D.kc25 * Math.exp(-D.dh / D.r * (1 / (T + 273.15) - 1 / 298.15));
  }
  _concN2O4() { return this.nN2O4 / this.V; }
  _concNO2() { return this.nNO2 / this.V; }

  /** Reequilibra por bisseção no avanço x (mol/L de N₂O₄ consumido). */
  _equilibrar() {
    const K = this._K(this.T);
    const a = this._concN2O4(), b = this._concNO2();
    const f = x => {
      const na = a - x, nb = b + 2 * x;
      if (na <= 1e-12 || nb < 0) return NaN;
      return nb * nb / na - K;
    };
    let lo = -b / 2 + 1e-9, hi = a - 1e-9;
    if (hi <= lo) return 0;
    let flo = f(lo);
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2, fm = f(mid);
      if (isNaN(fm)) { hi = mid; continue; }
      if ((flo < 0) === (fm < 0)) { lo = mid; flo = fm; } else hi = mid;
    }
    const x = (lo + hi) / 2;
    this.nN2O4 = (a - x) * this.V;
    this.nNO2 = (b + 2 * x) * this.V;
    this.strip.push({ n2o4: a - x, no2: b + 2 * x, T: this.T });
    if (this.strip.length > 120) this.strip.shift();
    return Math.sign(x);
  }

  update(dt, app) {
    this.fase += dt;
    if (this.modo !== 'atingir') return;
    const K = this.D.HI.kc, kf = 0.6, kr = kf / K;
    // integra em passos pequenos para estabilidade
    const passos = 8, h = Math.min(dt, .05) / passos;
    for (let i = 0; i < passos; i++) {
      const v = kf * this.h2 * this.i2 - kr * this.hi * this.hi;
      this.h2 = Math.max(0, this.h2 - v * h);
      this.i2 = Math.max(0, this.i2 - v * h);
      this.hi = Math.max(0, this.hi + 2 * v * h);
    }
    this.trel += dt;
    this.hist.push([this.trel, this.h2, this.i2, this.hi]);
    if (this.hist.length > 900) this.hist.shift();
  }

  draw(ctx, W, H, app) {
    if (this.modo === 'atingir') this._drawAtg(ctx, W, H);
    else if (this.modo === 'lechatelier') this._drawLch(ctx, W, H);
    else this._drawQk(ctx, W, H);
  }

  _drawAtg(ctx, W, H) {
    const tmax = Math.max(10, Math.ceil(this.trel / 10) * 10);
    const cmax = Math.max(1, this.h2i, this.i2i, this.hii, this.hi) * 1.15;
    const gw = Math.min(W - 130, 470), gh = Math.min(H - 100, 280);
    const A = kAxes(ctx, {
      x: 72, y: 40, w: gw, h: gh, xmin: 0, xmax: tmax, ymin: 0, ymax: cmax,
      xticks: [0, tmax / 4, tmax / 2, tmax * 3 / 4, tmax],
      yticks: [0, cmax / 3, cmax * 2 / 3, cmax],
      fmtx: v => fmt(v, 0), fmty: v => fmt(v, 2),
      xlab: 'Tempo (u.a.)', ylab: 'Concentração (mol/L)',
    });

    const series = [
      { idx: 1, cor: cssVar('--accent-cyan', '#22d3ee'), rot: '[H₂]' },
      { idx: 2, cor: cssVar('--accent-secondary', '#a78bfa'), rot: '[I₂]' },
      { idx: 3, cor: cssVar('--accent-main', '#a78bfa'), rot: '[HI]' },
    ];
    series.forEach(s => {
      const pts = this.hist.map(h => [h[0], h[s.idx]]);
      if (pts.length > 1) kLine(ctx, pts, A.px, A.py, { color: s.cor, w: 2.4 });
      const last = pts[pts.length - 1];
      if (last) kChip(ctx, `${s.rot} ${fmt(last[1], 3)}`, A.px(last[0]) - 46, A.py(last[1]),
        { fg: s.cor, size: 10, bold: true });
    });

    const Q = (this.hi * this.hi) / Math.max(1e-6, this.h2 * this.i2);
    const perto = Math.abs(Q - this.D.HI.kc) / this.D.HI.kc < .03;
    kChip(ctx, `Q = ${fmt(Q, 1)}  ·  Kc = ${this.D.HI.kc}`, W / 2, 22,
      { fg: perto ? cssVar('--accent-ok', '#4ade80') : cssVar('--accent-amber', '#fbbf24'), size: 12, bold: true });
    if (perto) kChip(ctx, 'EQUILÍBRIO ATINGIDO', W / 2, H - 20,
      { fg: cssVar('--accent-ok'), size: 11, bold: true });
  }

  _drawLch(ctx, W, H) {
    const no2 = this._concNO2(), n2o4 = this._concN2O4();
    const K = this._K(this.T);
    const cx = Math.min(W * .3, 200), cy = H / 2 - 10;

    // frasco: largura acompanha o volume
    const fw = clamp(70 * Math.sqrt(this.V), 44, 130), fh = 170;
    const tint = clamp(no2 / 0.12, 0, 1);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = kMix('#f8fafc', '#a1541c', tint);
    ctx.globalAlpha = .18 + tint * .72;
    kRound(ctx, -fw / 2, -fh / 2, fw, fh, 10); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = cssVar('--glass', 'rgba(148,163,184,.38)');
    ctx.lineWidth = 2.4;
    kRound(ctx, -fw / 2, -fh / 2, fw, fh, 10); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-9, -fh / 2); ctx.lineTo(-9, -fh / 2 - 22);
    ctx.lineTo(9, -fh / 2 - 22); ctx.lineTo(9, -fh / 2); ctx.stroke();

    // moléculas
    const nA = Math.round(clamp(n2o4 * 240, 0, 30)), nB = Math.round(clamp(no2 * 240, 0, 40));
    for (let i = 0; i < nA; i++) {
      const a = i * 2.399 + this.fase * .2;
      const x = Math.cos(a) * (fw / 2 - 14), y = Math.sin(a * 1.7) * (fh / 2 - 16);
      ctx.fillStyle = cssVar('--text-secondary', '#94a3b8');
      ctx.beginPath(); ctx.arc(x - 3, y, 3.4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + 3, y, 3.4, 0, Math.PI * 2); ctx.fill();
    }
    for (let i = 0; i < nB; i++) {
      const a = i * 1.618 + this.fase * .35;
      ctx.fillStyle = '#b45309';
      ctx.beginPath();
      ctx.arc(Math.cos(a) * (fw / 2 - 12), Math.cos(a * 2.1) * (fh / 2 - 14), 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    kChip(ctx, `${fmt(this.T, 0)} °C  ·  V = ${fmt(this.V, 2)} L`, cx, cy + fh / 2 + 26, { size: 11, bold: true });
    kLabel(ctx, this.D.NO2.eq, cx, cy - fh / 2 - 40, { size: 12, bold: true, color: cssVar('--text-primary') });
    if (this.T > 25) kFlame(ctx, cx, cy + fh / 2 + 52, 16, this.fase);

    // strip-chart histórico
    const gx = cx + Math.max(fw, 110), gw = W - gx - 40, gh = Math.min(H - 110, 230);
    if (gw > 150) {
      const cmax = Math.max(0.02, ...this.strip.map(s => Math.max(s.n2o4, s.no2))) * 1.2;
      const A = kAxes(ctx, {
        x: gx, y: 46, w: gw, h: gh, xmin: 0, xmax: Math.max(20, this.strip.length), ymin: 0, ymax: cmax,
        xticks: [], yticks: [0, cmax / 2, cmax],
        fmty: v => v.toExponential(1),
        xlab: 'perturbações →', ylab: 'mol/L',
      });
      const s1 = this.strip.map((s, i) => [i, s.n2o4]);
      const s2 = this.strip.map((s, i) => [i, s.no2]);
      if (s1.length > 1) {
        kLine(ctx, s1, A.px, A.py, { color: cssVar('--text-secondary'), w: 2.2 });
        kLine(ctx, s2, A.px, A.py, { color: '#c2410c', w: 2.2 });
      }
      kChip(ctx, '[N₂O₄]', gx + 42, 34, { fg: cssVar('--text-secondary'), size: 10 });
      kChip(ctx, '[NO₂]', gx + 110, 34, { fg: '#c2410c', size: 10 });
      kChip(ctx, `K(T) = ${K.toExponential(2)}`, gx + gw / 2, 46 + gh + 34,
        { fg: cssVar('--accent-main'), size: 10, bold: true });
    }
  }

  _drawQk(ctx, W, H) {
    const q = this._Q(), K = this.D.HI.kc;
    const cx = W / 2, cy = H / 2;
    const lq = Math.log10(Math.max(1e-4, q)), lk = Math.log10(K);
    const bw = Math.min(W - 120, 460);
    const x0 = cx - bw / 2, y = cy + 10;

    // régua log
    ctx.save();
    ctx.strokeStyle = cssVar('--border', '#1c2e44');
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + bw, y); ctx.stroke();
    ctx.restore();
    const pos = v => x0 + clamp((v + 4) / 8, 0, 1) * bw;

    [-4, -2, 0, 2, 4].forEach(t => {
      kLabel(ctx, `10${t < 0 ? '⁻' : ''}${Math.abs(t)}`, pos(t), y + 24, { size: 10, color: cssVar('--text-muted'), mono: true });
      ctx.strokeStyle = cssVar('--text-muted');
      ctx.beginPath(); ctx.moveTo(pos(t), y + 7); ctx.lineTo(pos(t), y + 12); ctx.stroke();
    });

    // marcador de K
    ctx.save();
    ctx.strokeStyle = cssVar('--accent-ok', '#4ade80');
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(pos(lk), y - 26); ctx.lineTo(pos(lk), y + 12); ctx.stroke();
    ctx.restore();
    kChip(ctx, `Kc = ${K}`, pos(lk), y - 40, { fg: cssVar('--accent-ok'), size: 11, bold: true });

    // marcador de Q
    const cQ = Math.abs(lq - lk) < .02 ? cssVar('--accent-ok', '#4ade80') : cssVar('--accent-amber', '#fbbf24');
    ctx.save();
    ctx.fillStyle = cQ;
    ctx.beginPath();
    ctx.moveTo(pos(lq), y - 8); ctx.lineTo(pos(lq) - 8, y - 22); ctx.lineTo(pos(lq) + 8, y - 22);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    kChip(ctx, `Q = ${fmt(q, 2)}`, pos(lq), y + 52, { fg: cQ, size: 11, bold: true });

    // seta do sentido
    const dif = lk - lq;
    if (Math.abs(dif) > .02) {
      const dir = Math.sign(dif);
      kArrow(ctx, cx - dir * 60, cy - 86, cx + dir * 60, cy - 86, { color: cQ, w: 2.6, head: 10 });
      kLabel(ctx, dir > 0 ? 'reação caminha para a DIREITA (forma HI)' : 'reação caminha para a ESQUERDA (forma H₂ e I₂)',
        cx, cy - 110, { size: 12, bold: true, color: cQ });
    } else {
      kLabel(ctx, 'sistema em EQUILÍBRIO', cx, cy - 96, { size: 13, bold: true, color: cssVar('--accent-ok') });
    }

    kLabel(ctx, this.D.HI.eq, cx, 30, { size: 13, bold: true, color: cssVar('--text-primary') });
    kLabel(ctx, `Q = [HI]² / ([H₂]·[I₂]) = ${fmt(this.qhi, 2)}² / (${fmt(this.qh2, 2)} × ${fmt(this.qi2, 2)})`,
      cx, H - 24, { size: 11, color: cssVar('--text-secondary'), mono: true });
  }

  getResults() {
    if (this.modo === 'atingir') {
      const Q = (this.hi * this.hi) / Math.max(1e-6, this.h2 * this.i2);
      return [
        { l: '[H₂]', v: fmt(this.h2, 3) + ' mol/L' },
        { l: '[I₂]', v: fmt(this.i2, 3) + ' mol/L' },
        { l: '[HI]', v: fmt(this.hi, 3) + ' mol/L' },
        { l: 'Quociente Q', v: fmt(Q, 2) },
        { l: 'Kc (448 °C)', v: String(this.D.HI.kc), cls: 'val-ok' },
        { l: 'Estado', v: Math.abs(Q - this.D.HI.kc) / this.D.HI.kc < .03 ? 'em equilíbrio' : 'caminhando', cls: 'val-ok' },
      ];
    }
    if (this.modo === 'lechatelier') {
      return [
        { l: 'Temperatura', v: fmt(this.T, 0) + ' °C' },
        { l: 'Volume', v: fmt(this.V, 2) + ' L' },
        { l: '[N₂O₄]', v: this._concN2O4().toExponential(3) + ' mol/L' },
        { l: '[NO₂]', v: this._concNO2().toExponential(3) + ' mol/L', cls: 'val-exo' },
        { l: 'Kc na T atual', v: this._K(this.T).toExponential(3) },
        { l: 'ΔH', v: '+' + this.D.NO2.dh + ' kJ/mol', cls: 'val-endo' },
        { l: 'Última perturbação', v: this.perturb },
      ];
    }
    const q = this._Q(), K = this.D.HI.kc;
    return [
      { l: '[H₂]', v: fmt(this.qh2, 2) + ' mol/L' },
      { l: '[I₂]', v: fmt(this.qi2, 2) + ' mol/L' },
      { l: '[HI]', v: fmt(this.qhi, 2) + ' mol/L' },
      { l: 'Quociente Q', v: fmt(q, 3) },
      { l: 'Kc', v: String(K), cls: 'val-ok' },
      { l: 'Q / Kc', v: fmt(q / K, 3) },
      {
        l: 'Sentido', cls: 'val-ok',
        v: q < K * .98 ? '→ forma HI' : q > K * 1.02 ? '← forma H₂ e I₂' : 'equilíbrio',
      },
    ];
  }

  getOverlay() {
    if (this.modo === 'atingir') return `H₂ + I₂ ⇌ 2 HI · t = ${fmt(this.trel, 1)}`;
    if (this.modo === 'lechatelier') return `${fmt(this.T, 0)} °C · V ${fmt(this.V, 2)} L · ${this.perturb}`;
    return `Q = ${fmt(this._Q(), 2)} · Kc = ${this.D.HI.kc}`;
  }
}

// ══════════════════════════════════════════════════════════════════
// MECÂNICA B — pH e Equilíbrio Iônico (origem: SIPH)
// Modos: escala de pH · cálculo com Ka/Kb · titulação
// ══════════════════════════════════════════════════════════════════
class MechB {
  constructor(D) {
    this.D = D;
    this.modo = 'escala';
    this.ph = 7;
    this.substancia = null;
    // modo 2
    this.eletrolito = D.ELETROLITOS[0];
    this.conc = -1;
    // modo 3
    this.indicador = D.INDICADORES[0];
    this.vb = 0;
    this.auto = false;
    this.gotas = [];
    this.fase = 0;
  }

  build(app) {
    fillOptGrid('esc-grid', this.D.SUBSTANCIAS.map(s => ({
      value: s.id, nome: s.nome, dot: s.cor, extra: fmt(s.ph, 1),
      aria: `${s.nome}, pH ${fmt(s.ph, 1)}`,
    })), null);
    fillOptGrid('calc-grid', this.D.ELETROLITOS.map(e => ({
      value: e.id, nome: e.nome, dot: e.dot, extra: e.forte ? 'forte' : 'fraco',
      aria: `${e.nome}, ${e.desc}`,
    })), this.eletrolito.id);
    fillOptGrid('tit-grid', this.D.INDICADORES.map(i => ({
      value: i.id, nome: i.nome, dot: i.c2, extra: `${fmt(i.a, 1)}–${fmt(i.b, 1)}`,
      aria: `${i.nome}, vira de ${i.r1} para ${i.r2} entre pH ${fmt(i.a, 1)} e ${fmt(i.b, 1)}`,
    })), this.indicador.id);
  }

  setMode(id) { this.modo = id; this.auto = false; }

  setParam(k, v) {
    switch (k) {
      case 'ph': this.ph = v; this.substancia = null; break;
      case 'substancia': {
        const s = this.D.SUBSTANCIAS.find(x => x.id === v);
        if (s) {
          this.substancia = s; this.ph = s.ph;
          this.app.syncSlider('esc-ph', s.ph);
          return { say: `${s.nome}: pH ${fmt(s.ph, 1)}, meio ${this._classe(s.ph)}.` };
        }
        break;
      }
      case 'eletrolito': {
        this.eletrolito = this.D.ELETROLITOS.find(e => e.id === v) || this.eletrolito;
        return { say: `${this.eletrolito.nome}: ${this.eletrolito.desc}.` };
      }
      case 'conc': this.conc = v; break;
      case 'indicador': {
        this.indicador = this.D.INDICADORES.find(i => i.id === v) || this.indicador;
        const i = this.indicador;
        return { say: `${i.nome}: vira de ${i.r1} para ${i.r2} entre pH ${fmt(i.a, 1)} e ${fmt(i.b, 1)}.` };
      }
      case 'vb': this.vb = v; this.auto = false; break;
    }
    return {};
  }

  action(name) {
    if (name === 'esc-status') {
      const h = Math.pow(10, -this.ph), oh = this.D.KW / h;
      return announce(`pH ${fmt(this.ph, 1)}, meio ${this._classe(this.ph)}. Concentração de hidrônio ${h.toExponential(2)} e de hidróxido ${oh.toExponential(2)} mol por litro. pOH igual a ${fmt(14 - this.ph, 1)}.`);
    }
    if (name === 'calc-status') {
      const r = this._calc();
      return announce(`${this.eletrolito.nome} a ${r.C.toExponential(2)} mol por litro: pH igual a ${fmt(r.ph, 2)}, pOH ${fmt(14 - r.ph, 2)}, grau de ionização ${fmt(r.alpha * 100, 2)} por cento.`);
    }
    if (name === 'gotejar') {
      this.vb = Math.min(50, this.vb + 0.5);
      this.app.syncSlider('tit-v', this.vb);
      this.gotas.push({ t: 0 });
      const p = this._phTit(this.vb);
      announce(`${fmt(this.vb, 1)} mililitros de base adicionados. pH ${fmt(p, 2)}.`);
    }
    if (name === 'tit-auto') {
      this.auto = !this.auto;
      announce(this.auto ? 'Titulação automática iniciada.' : 'Titulação pausada.');
    }
    if (name === 'tit-reset') {
      this.vb = 0; this.auto = false; this.gotas = [];
      this.app.syncSlider('tit-v', 0);
      announce('Titulação reiniciada com zero mililitro de base.');
    }
  }

  _classe(p) { return p < 6.9 ? 'ácido' : p > 7.1 ? 'básico' : 'neutro'; }

  /* ── cálculo de pH de ácido/base ── */
  _calc() {
    const C = Math.pow(10, this.conc), E = this.eletrolito;
    let h, alpha;
    if (E.forte) {
      alpha = 1;
      h = E.tipo === 'acido' ? C : this.D.KW / C;
    } else {
      const K = E.k;
      const x = (-K + Math.sqrt(K * K + 4 * K * C)) / 2; // [H⁺] ou [OH⁻]
      alpha = x / C;
      h = E.tipo === 'acido' ? x : this.D.KW / x;
    }
    return { C, h, alpha, ph: -Math.log10(h) };
  }

  /* ── curva de titulação ácido forte × base forte ── */
  _phTit(vb) {
    const { va, ca, cb } = this.D.TIT;
    const na = ca * va, nb = cb * vb, vt = va + vb;
    const d = na - nb;
    if (Math.abs(d) < 1e-9) return 7;
    if (d > 0) return -Math.log10(d / vt);
    return 14 + Math.log10(-d / vt);
  }

  _corInd(ph) {
    const i = this.indicador;
    const t = clamp((ph - i.a) / (i.b - i.a), 0, 1);
    return kMix(i.c1, i.c2, t);
  }

  update(dt, app) {
    this.fase += dt;
    if (this.modo === 'titulacao') {
      if (this.auto && this.vb < 50) {
        const perto = Math.abs(this.vb - 25) < 1.5;
        this.vb = Math.min(50, this.vb + dt * (perto ? 0.6 : 3.5));
        this.app.syncSlider('tit-v', Math.round(this.vb * 10) / 10);
        if (Math.random() < dt * 8) this.gotas.push({ t: 0 });
        if (this.vb >= 50) this.auto = false;
      }
      for (let i = this.gotas.length - 1; i >= 0; i--) {
        this.gotas[i].t += dt;
        if (this.gotas[i].t > .55) this.gotas.splice(i, 1);
      }
    }
  }

  onArrow(dx) {
    if (this.modo !== 'escala' || !dx) return false;
    this.ph = clamp(Math.round((this.ph + dx * 0.1) * 10) / 10, 0, 14);
    this.substancia = null;
    this.app.syncSlider('esc-ph', this.ph);
    return true;
  }

  draw(ctx, W, H, app) {
    if (this.modo === 'escala') this._drawEsc(ctx, W, H);
    else if (this.modo === 'calculo') this._drawCalc(ctx, W, H);
    else this._drawTit(ctx, W, H);
  }

  _corPh(ph) {
    const S = this.D.SUBSTANCIAS;
    let a = S[0], b = S[S.length - 1];
    for (let i = 1; i < S.length; i++) {
      if (ph <= S[i].ph) { a = S[i - 1]; b = S[i]; break; }
      if (ph > S[S.length - 1].ph) { a = b = S[S.length - 1]; }
    }
    const t = b.ph === a.ph ? 0 : clamp((ph - a.ph) / (b.ph - a.ph), 0, 1);
    return kMix(a.cor, b.cor, t);
  }

  _drawEsc(ctx, W, H) {
    const bw = Math.min(W - 90, 480), x0 = (W - bw) / 2, y = 70, bh = 34;

    // faixa gradiente 0–14
    const g = ctx.createLinearGradient(x0, 0, x0 + bw, 0);
    for (let i = 0; i <= 14; i++) g.addColorStop(i / 14, this._corPh(i));
    ctx.save();
    kRound(ctx, x0, y, bw, bh, 6);
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = cssVar('--border', '#1c2e44'); ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();

    for (let i = 0; i <= 14; i += 2) {
      const x = x0 + i / 14 * bw;
      kLabel(ctx, String(i), x, y + bh + 14, { size: 10, color: cssVar('--text-muted'), mono: true });
    }
    kLabel(ctx, 'ÁCIDO', x0 + bw * .16, y - 16, { size: 11, bold: true, color: cssVar('--accent-exo', '#f87171') });
    kLabel(ctx, 'NEUTRO', x0 + bw * .5, y - 16, { size: 11, bold: true, color: cssVar('--accent-ok', '#4ade80') });
    kLabel(ctx, 'BÁSICO', x0 + bw * .84, y - 16, { size: 11, bold: true, color: cssVar('--accent-cyan', '#22d3ee') });

    // marcador
    const mx = x0 + this.ph / 14 * bw;
    ctx.save();
    ctx.fillStyle = cssVar('--text-primary', '#e6f0fa');
    ctx.beginPath();
    ctx.moveTo(mx, y - 4); ctx.lineTo(mx - 7, y - 16); ctx.lineTo(mx + 7, y - 16);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(mx, y); ctx.lineTo(mx, y + bh); ctx.stroke();
    ctx.restore();
    kChip(ctx, `pH ${fmt(this.ph, 1)}${this.substancia ? ' · ' + this.substancia.nome : ''}`,
      clamp(mx, x0 + 60, x0 + bw - 60), y + bh + 38,
      { fg: this._corPh(this.ph), size: 12, bold: true });

    // barras logarítmicas de H₃O⁺ e OH⁻
    const h = Math.pow(10, -this.ph), oh = this.D.KW / h;
    const by = y + bh + 76, bwid = bw, bhh = 22;
    const desenha = (rot, val, cor, yy) => {
      const f = clamp((14 + Math.log10(val)) / 14, 0, 1);
      ctx.save();
      ctx.fillStyle = cssVar('--border', '#1c2e44');
      kRound(ctx, x0, yy, bwid, bhh, 5); ctx.fill();
      ctx.fillStyle = cor;
      kRound(ctx, x0, yy, Math.max(4, bwid * f), bhh, 5); ctx.fill();
      ctx.restore();
      kLabel(ctx, rot, x0 - 8, yy + bhh / 2, { size: 11, align: 'right', color: cor, bold: true });
      kLabel(ctx, val.toExponential(2) + ' mol/L', x0 + bwid - 8, yy + bhh / 2,
        { size: 10, align: 'right', color: '#fff', mono: true });
    };
    if (by + 60 < H) {
      desenha('[H₃O⁺]', h, cssVar('--accent-exo', '#f87171'), by);
      desenha('[OH⁻]', oh, cssVar('--accent-cyan', '#22d3ee'), by + bhh + 14);
      kLabel(ctx, `pOH = ${fmt(14 - this.ph, 1)}   ·   pH + pOH = 14`, W / 2, by + bhh * 2 + 44,
        { size: 11, color: cssVar('--text-secondary'), mono: true });
    }
  }

  _drawCalc(ctx, W, H) {
    const r = this._calc(), E = this.eletrolito;
    const cx = W / 2;

    // béquer com cor do pH
    const bx = cx - 150;
    ctx.save();
    ctx.translate(bx, H / 2 + 60);
    kBeaker(ctx, 0, -140, 118, 140, .74, this._corPh(r.ph), { alpha: .55, rotulo: E.nome });
    // partículas: ionizadas × não ionizadas
    const total = 24, ion = Math.round(clamp(r.alpha, 0, 1) * total);
    for (let i = 0; i < total; i++) {
      const a = i * 2.399 + this.fase * .22;
      const x = Math.cos(a) * 42, y = -60 + Math.sin(a * 1.4) * 32;
      const ionizada = i < ion;
      ctx.fillStyle = ionizada ? cssVar('--accent-main', '#f472b6') : cssVar('--text-muted', '#64748b');
      if (ionizada) {
        ctx.beginPath(); ctx.arc(x - 4, y, 3.4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + 4, y + 3, 3.4, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.beginPath(); ctx.arc(x, y, 4.2, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
    kChip(ctx, `α = ${fmt(r.alpha * 100, 2)} % ionizado`, bx, H / 2 + 92,
      { fg: cssVar('--accent-main'), size: 11, bold: true });

    // painel numérico
    const px = cx + 60;
    const linhas = [
      ['Concentração C', r.C.toExponential(2) + ' mol/L'],
      [E.tipo === 'acido' ? '[H₃O⁺]' : '[OH⁻]',
        (E.tipo === 'acido' ? r.h : this.D.KW / r.h).toExponential(2) + ' mol/L'],
      ['pH', fmt(r.ph, 2)],
      ['pOH', fmt(14 - r.ph, 2)],
      ['Grau α', fmt(r.alpha * 100, 2) + ' %'],
      [E.forte ? 'Ionização' : (E.tipo === 'acido' ? 'Ka' : 'Kb'),
        E.forte ? 'total' : E.k.toExponential(1)],
    ];
    linhas.forEach((l, i) => {
      const y = H / 2 - 84 + i * 30;
      kLabel(ctx, l[0], px, y, { size: 11, align: 'left', color: cssVar('--text-secondary') });
      kLabel(ctx, l[1], px + 190, y, { size: 12, align: 'right', bold: true, mono: true, color: cssVar('--text-primary') });
      ctx.save();
      ctx.strokeStyle = cssVar('--border', '#1c2e44');
      ctx.beginPath(); ctx.moveTo(px, y + 13); ctx.lineTo(px + 190, y + 13); ctx.stroke();
      ctx.restore();
    });
    kLabel(ctx, E.desc, cx, 28, { size: 12, bold: true, color: cssVar('--text-primary') });
  }

  _drawTit(ctx, W, H) {
    const ph = this._phTit(this.vb);
    const corInd = this._corInd(ph);

    // ── bureta e erlenmeyer ──
    const bx = Math.min(W * .24, 150);
    const btop = 34, bh = 130;
    ctx.save();
    ctx.strokeStyle = cssVar('--glass', 'rgba(148,163,184,.38)');
    ctx.lineWidth = 2.2;
    kRound(ctx, bx - 11, btop, 22, bh, 3); ctx.stroke();
    const frac = 1 - this.vb / 50;
    ctx.fillStyle = cssVar('--accent-cyan', '#22d3ee');
    ctx.globalAlpha = .5;
    ctx.fillRect(bx - 8, btop + (1 - frac) * (bh - 6) + 3, 16, frac * (bh - 6));
    ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.moveTo(bx - 3, btop + bh); ctx.lineTo(bx - 3, btop + bh + 20);
    ctx.lineTo(bx + 3, btop + bh + 20); ctx.lineTo(bx + 3, btop + bh); ctx.stroke();
    ctx.restore();
    kLabel(ctx, 'NaOH 0,100 M', bx, btop - 14, { size: 10, color: cssVar('--text-secondary') });

    // gotas caindo
    const eTop = btop + bh + 74;
    this.gotas.forEach(g => {
      const t = g.t / .55;
      ctx.fillStyle = cssVar('--accent-cyan', '#22d3ee');
      ctx.beginPath();
      ctx.arc(bx, btop + bh + 22 + t * (eTop - btop - bh - 20), 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // erlenmeyer
    ctx.save();
    ctx.translate(bx, eTop);
    const eh = 108, ew = 96;
    ctx.strokeStyle = cssVar('--glass');
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(-11, 0); ctx.lineTo(-11, 18);
    ctx.lineTo(-ew / 2, eh - 8);
    ctx.quadraticCurveTo(-ew / 2, eh, -ew / 2 + 10, eh);
    ctx.lineTo(ew / 2 - 10, eh);
    ctx.quadraticCurveTo(ew / 2, eh, ew / 2, eh - 8);
    ctx.lineTo(11, 18); ctx.lineTo(11, 0);
    ctx.stroke();
    // líquido com cor do indicador
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-ew / 2 + 6, eh - 4);
    ctx.lineTo(-24, 44); ctx.lineTo(24, 44); ctx.lineTo(ew / 2 - 6, eh - 4);
    ctx.closePath();
    ctx.fillStyle = corInd; ctx.globalAlpha = .78; ctx.fill();
    ctx.restore();
    ctx.restore();
    kLabel(ctx, `25,0 mL HCl + ${fmt(this.vb, 1)} mL`, bx, eTop + 128, { size: 10, color: cssVar('--text-secondary') });

    // ── curva de titulação ──
    const gx = bx + 130, gw = W - gx - 40, gh = Math.min(H - 110, 250);
    if (gw > 160) {
      const A = kAxes(ctx, {
        x: gx, y: 44, w: gw, h: gh, xmin: 0, xmax: 50, ymin: 0, ymax: 14,
        xticks: [0, 10, 20, 25, 30, 40, 50], yticks: [0, 2, 4, 7, 10, 12, 14],
        xlab: 'Volume de NaOH (mL)', ylab: 'pH',
      });

      // faixa de viragem do indicador
      const I = this.indicador;
      ctx.save();
      ctx.fillStyle = I.c2; ctx.globalAlpha = .16;
      ctx.fillRect(A.px(0), A.py(I.b), gw, A.py(I.a) - A.py(I.b));
      ctx.restore();
      kLabel(ctx, `viragem ${I.nome}`, A.px(2), A.py((I.a + I.b) / 2),
        { size: 9, align: 'left', color: I.c2 });

      // curva completa e trecho percorrido
      const total = [], feito = [];
      for (let v = 0; v <= 50; v += .1) {
        const p = [v, this._phTit(v)];
        total.push(p);
        if (v <= this.vb) feito.push(p);
      }
      kLine(ctx, total, A.px, A.py, { color: cssVar('--text-muted'), w: 1.2, dash: [4, 4], alpha: .5 });
      if (feito.length > 1) kLine(ctx, feito, A.px, A.py, { color: cssVar('--accent-main', '#f472b6'), w: 2.6 });

      // ponto de equivalência
      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = cssVar('--accent-ok', '#4ade80');
      ctx.beginPath(); ctx.moveTo(A.px(25), A.py(0)); ctx.lineTo(A.px(25), A.py(14)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(A.px(0), A.py(7)); ctx.lineTo(A.px(50), A.py(7)); ctx.stroke();
      ctx.restore();
      kChip(ctx, 'equivalência · 25 mL · pH 7', A.px(25) + 6, A.py(7) - 22,
        { fg: cssVar('--accent-ok'), size: 10, bold: true });

      // ponto atual
      ctx.fillStyle = cssVar('--accent-main', '#f472b6');
      ctx.beginPath(); ctx.arc(A.px(this.vb), A.py(ph), 5.5, 0, Math.PI * 2); ctx.fill();
      kChip(ctx, `pH ${fmt(ph, 2)}`, A.px(this.vb), A.py(ph) - 20,
        { fg: cssVar('--accent-main'), size: 10, bold: true });
    }
  }

  getResults() {
    if (this.modo === 'escala') {
      const h = Math.pow(10, -this.ph), oh = this.D.KW / h;
      return [
        { l: 'Substância', v: this.substancia ? this.substancia.nome : 'personalizada' },
        { l: 'pH', v: fmt(this.ph, 1), cls: 'val-ok' },
        { l: 'pOH', v: fmt(14 - this.ph, 1) },
        { l: '[H₃O⁺]', v: h.toExponential(2) + ' mol/L', cls: 'val-exo' },
        { l: '[OH⁻]', v: oh.toExponential(2) + ' mol/L', cls: 'val-endo' },
        { l: 'Caráter', v: this._classe(this.ph) },
        { l: 'Kw', v: '1,0·10⁻¹⁴' },
      ];
    }
    if (this.modo === 'calculo') {
      const r = this._calc(), E = this.eletrolito;
      return [
        { l: 'Eletrólito', v: E.nome },
        { l: 'Tipo', v: (E.forte ? 'forte' : 'fraco') + ' · ' + E.tipo },
        { l: 'Concentração', v: r.C.toExponential(2) + ' mol/L' },
        { l: E.forte ? 'Constante' : (E.tipo === 'acido' ? 'Ka' : 'Kb'), v: E.forte ? '—' : E.k.toExponential(1) },
        { l: '[H₃O⁺]', v: r.h.toExponential(2) + ' mol/L' },
        { l: 'pH', v: fmt(r.ph, 2), cls: 'val-ok' },
        { l: 'pOH', v: fmt(14 - r.ph, 2) },
        { l: 'Grau de ionização', v: fmt(r.alpha * 100, 2) + ' %' },
      ];
    }
    const ph = this._phTit(this.vb), I = this.indicador;
    const virou = ph >= I.b, meio = ph > I.a && ph < I.b;
    const { va, ca, cb } = this.D.TIT;
    return [
      { l: 'Volume de NaOH', v: fmt(this.vb, 1) + ' mL' },
      { l: 'mol de HCl', v: fmt(ca * va, 3) + ' mmol' },
      { l: 'mol de NaOH', v: fmt(cb * this.vb, 3) + ' mmol' },
      { l: 'pH atual', v: fmt(ph, 2), cls: 'val-ok' },
      { l: 'Volume total', v: fmt(va + this.vb, 1) + ' mL' },
      { l: 'Indicador', v: virou ? I.r2 : meio ? 'virando' : I.r1 },
      {
        l: 'Situação',
        v: this.vb < 24.95 ? 'excesso de ácido' : this.vb > 25.05 ? 'excesso de base' : 'ponto de equivalência',
        cls: Math.abs(this.vb - 25) < .06 ? 'val-ok' : '',
      },
    ];
  }

  getOverlay() {
    if (this.modo === 'escala') return `pH ${fmt(this.ph, 1)} · meio ${this._classe(this.ph)}`;
    if (this.modo === 'calculo') return `${this.eletrolito.nome} · pH ${fmt(this._calc().ph, 2)}`;
    return `${fmt(this.vb, 1)} mL · pH ${fmt(this._phTit(this.vb), 2)}`;
  }
}

// ══════════════════════════════════════════════════════════════════
// MECH — FACHADA que une as duas mecânicas deste simulador.
// D.MECH_B (no arquivo de dados) lista os ids de modo atendidos pela
// segunda mecânica; todos os demais vão para a primeira. O App
// conversa apenas com esta classe, exatamente como num simulador de
// mecânica única — cada mecânica interna permanece intocada.
// ══════════════════════════════════════════════════════════════════
class Mech {
  constructor(D) {
    this.D = D;
    this.a = new MechA(D);
    this.b = new MechB(D);
    this._bSet = new Set(D.MECH_B || []);
    this.cur = this.a;
  }
  set app(v) { this._app = v; this.a.app = v; this.b.app = v; }
  get app() { return this._app; }
  build(app) {
    if (typeof this.a.build === 'function') this.a.build(app);
    if (typeof this.b.build === 'function') this.b.build(app);
  }
  setMode(id) {
    this.cur = this._bSet.has(id) ? this.b : this.a;
    this.cur.setMode(id);
  }
  setParam(k, v) { return this.cur.setParam(k, v); }
  action(n, el) { return this.cur.action(n, el); }
  update(dt, app) { this.cur.update(dt, app); }
  draw(ctx, W, H, app) { this.cur.draw(ctx, W, H, app); }
  getResults() { return this.cur.getResults(); }
  getOverlay() { return this.cur.getOverlay ? this.cur.getOverlay() : ''; }
  onArrow(dx, dy) { return this.cur.onArrow ? this.cur.onArrow(dx, dy) : false; }
  onDrag(dx, dy) { if (this.cur.onDrag) this.cur.onDrag(dx, dy); }
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

    var storeKey = 'equilibrio-w-' + cfg.cssVar.replace(/^--/, '');
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
