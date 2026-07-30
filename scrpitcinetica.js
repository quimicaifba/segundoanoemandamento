/* ================================================================
   SICIN — scrpitcinetica.js | mecânicas do simulador
   ================================================================
   Somente lógica: acessibilidade, utilitários de desenho, a classe
   Mech (física e química do módulo) e o casco App, comum a toda a
   família de simuladores do 2º ano. Os dados fixos ficam em
   dadoscinetica.js e as cores em stylecinetica.css.
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
// MECÂNICA — SICIN · Cinética Química
// Modos: teoria das colisões · curva [A]×t · energia de ativação
// ══════════════════════════════════════════════════════════════════
class Mech {
  constructor(D) {
    this.D = D;
    this.modo = 'colisoes';
    // modo 1
    this.tcol = 25; this.na = 18; this.nb = 18; this.cat = 0;
    this.A = []; this.B = []; this.C = []; this.flashes = [];
    this.efetivas = 0; this.janela = 0; this.taxa = 0;
    this._semear();
    // modo 2
    this.a0 = 1; this.tcur = 25; this.catcur = 0;
    this.t1 = 5; this.t2 = 25; this.trel = 0;
    // modo 3
    this.caminho = D.CAMINHOS[0]; this.tene = 25;
    this.fase = 0;
  }

  build(app) {
    fillOptGrid('ene-grid', this.D.CAMINHOS.map(c => ({
      value: c.id, nome: c.nome, dot: c.dot, extra: `Ea ${c.ea} kJ/mol`,
      aria: `${c.nome}, ${c.nota}, energia de ativação ${c.ea} quilojoules por mol`,
    })), this.caminho.id);
  }

  setMode(id) { this.modo = id; if (id === 'curva') this.trel = 0; }

  setParam(k, v) {
    switch (k) {
      case 'tcol': this.tcol = v; break;
      case 'na': this.na = v; this._semear(); break;
      case 'nb': this.nb = v; this._semear(); break;
      case 'cat':
        this.cat = +v;
        return { say: this.cat ? 'Catalisador adicionado: fração de colisões efetivas multiplicada por quatro.' : 'Catalisador removido.' };
      case 'a0': this.a0 = v; this.trel = 0; break;
      case 'tcur': this.tcur = v; this.trel = 0; break;
      case 'catcur':
        this.catcur = +v; this.trel = 0;
        return { say: this.catcur ? 'Catalisador adicionado à corrida: constante de velocidade triplicada.' : 'Catalisador removido da corrida.' };
      case 't1':
        this.t1 = v;
        if (this.t2 <= this.t1) { this.t2 = Math.min(60, this.t1 + 2); this.app.syncSlider('cur-t2', this.t2); }
        break;
      case 't2':
        this.t2 = v;
        if (this.t1 >= this.t2) { this.t1 = Math.max(0, this.t2 - 2); this.app.syncSlider('cur-t1', this.t1); }
        break;
      case 'caminho': {
        this.caminho = this.D.CAMINHOS.find(c => c.id === v) || this.caminho;
        return { say: `${this.caminho.nome}: energia de ativação de ${this.caminho.ea} quilojoules por mol.` };
      }
      case 'tene': this.tene = v; break;
    }
    return {};
  }

  action(name) {
    if (name === 'col-reset') { this._semear(); this.efetivas = 0; announce('Mistura reiniciada.'); }
    if (name === 'cur-reset') { this.trel = 0; announce('Corrida reiniciada no tempo zero.'); }
    if (name === 'ene-status') {
      const sem = this.D.CAMINHOS[0], c = this.caminho;
      const f0 = this._fracao(sem.ea), f1 = this._fracao(c.ea);
      announce(`${c.nome}: energia de ativação ${c.ea} contra ${sem.ea} quilojoules por mol sem catalisador. A ${fmt(this.tene, 0)} graus a fração de moléculas capazes de reagir passa de ${f0.toExponential(2)} para ${f1.toExponential(2)}. O delta H continua igual a menos 98 quilojoules por mol.`);
    }
  }

  /* ── modelo ── */
  _pEf() { return clamp(0.02 * Math.pow(2, (this.tcol - 20) / 10) * (this.cat ? 4 : 1), 0, 0.9); }
  _k() { return 0.05 * Math.pow(2, (this.tcur - 20) / 10) * (this.catcur ? 3 : 1); }
  _conc(t) { return this.a0 * Math.exp(-this._k() * t); }
  _fracao(ea) { return Math.exp(-ea / (this.D.R_KJ * (this.tene + 273.15))); }

  _semear() {
    const mk = n => Array.from({ length: n }, () => ({
      x: (Math.random() - .5) * 300, y: (Math.random() - .5) * 200,
      vx: (Math.random() - .5) * 2, vy: (Math.random() - .5) * 2,
    }));
    this.A = mk(this.na); this.B = mk(this.nb); this.C = []; this.flashes = [];
  }

  update(dt, app) {
    this.fase += dt;
    if (this.modo === 'colisoes') this._updCol(dt);
    else if (this.modo === 'curva') this.trel = Math.min(60, this.trel + dt * 2.5);
  }

  _updCol(dt) {
    const vel = isReduced() ? 0 : 34 * Math.pow(1.03, this.tcol - 25);
    const box = { x: -155, y: -105, w: 310, h: 210 };
    const mover = arr => arr.forEach(p => {
      p.x += p.vx * vel * dt; p.y += p.vy * vel * dt;
      if (p.x < box.x || p.x > box.x + box.w) { p.vx *= -1; p.x = clamp(p.x, box.x, box.x + box.w); }
      if (p.y < box.y || p.y > box.y + box.h) { p.vy *= -1; p.y = clamp(p.y, box.y, box.y + box.h); }
    });
    mover(this.A); mover(this.B); mover(this.C);

    const pEf = this._pEf();
    this.janela += dt;
    for (let i = this.A.length - 1; i >= 0; i--) {
      for (let j = this.B.length - 1; j >= 0; j--) {
        const a = this.A[i], b = this.B[j];
        if (Math.hypot(a.x - b.x, a.y - b.y) < 11) {
          if (Math.random() < pEf) {
            this.flashes.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, t: 0 });
            this.C.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, vx: (Math.random() - .5) * 2, vy: (Math.random() - .5) * 2 });
            this.A.splice(i, 1); this.B.splice(j, 1);
            this.efetivas++;
          } else {
            a.vx *= -1; a.vy *= -1; b.vx *= -1; b.vy *= -1;
          }
          break;
        }
      }
    }
    if (this.janela >= 1) { this.taxa = this.efetivas / this.janela; this.efetivas = 0; this.janela = 0; }
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      this.flashes[i].t += dt;
      if (this.flashes[i].t > .5) this.flashes.splice(i, 1);
    }
  }

  draw(ctx, W, H, app) {
    if (this.modo === 'colisoes') this._drawCol(ctx, W, H);
    else if (this.modo === 'curva') this._drawCur(ctx, W, H);
    else this._drawEne(ctx, W, H);
  }

  _drawCol(ctx, W, H) {
    ctx.save();
    ctx.translate(W / 2, H / 2 - 10);
    // recipiente
    ctx.strokeStyle = cssVar('--glass', 'rgba(148,163,184,.38)');
    ctx.lineWidth = 2.2;
    kRound(ctx, -158, -108, 316, 216, 8); ctx.stroke();

    const cA = cssVar('--accent-cyan', '#22d3ee');
    const cB = cssVar('--accent-amber', '#fbbf24');
    const cC = cssVar('--accent-ok', '#4ade80');
    this.A.forEach(p => { ctx.fillStyle = cA; ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fill(); });
    this.B.forEach(p => { ctx.fillStyle = cB; ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fill(); });
    this.C.forEach(p => {
      ctx.fillStyle = cC;
      ctx.beginPath(); ctx.arc(p.x - 3, p.y, 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(p.x + 3, p.y, 4.5, 0, Math.PI * 2); ctx.fill();
    });
    this.flashes.forEach(f => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - f.t / .5);
      ctx.strokeStyle = cC; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(f.x, f.y, 6 + f.t * 26, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    });

    if (this.cat) {
      ctx.save();
      ctx.globalAlpha = .16;
      ctx.fillStyle = cssVar('--accent-main', '#4ade80');
      kRound(ctx, -158, -108, 316, 216, 8); ctx.fill();
      ctx.restore();
      kChip(ctx, 'catalisador presente', 0, -122, { fg: cssVar('--accent-main'), size: 10, bold: true });
    }
    ctx.restore();

    // legenda
    const ly = H - 26;
    const leg = [['A', cA], ['B', cB], ['C (produto)', cC]];
    leg.forEach((l, i) => {
      const x = W / 2 - 110 + i * 105;
      ctx.fillStyle = l[1];
      ctx.beginPath(); ctx.arc(x - 12, ly, 5, 0, Math.PI * 2); ctx.fill();
      kLabel(ctx, l[0], x + 22, ly, { size: 11, align: 'right' });
    });
    kChip(ctx, `fração efetiva ≈ ${fmt(this._pEf() * 100, 1)} %`, W / 2, 22,
      { fg: cssVar('--accent-main'), size: 11, bold: true });
  }

  _drawCur(ctx, W, H) {
    const gw = Math.min(W - 130, 460), gh = Math.min(H - 100, 280);
    const A = kAxes(ctx, {
      x: 70, y: 40, w: gw, h: gh, xmin: 0, xmax: 60, ymin: 0, ymax: 2,
      xticks: [0, 15, 30, 45, 60], yticks: [0, .5, 1, 1.5, 2],
      fmty: v => fmt(v, 1),
      xlab: 'Tempo (s)', ylab: '[A] (mol/L)',
    });

    // curva completa até o tempo corrido
    const pts = [];
    for (let t = 0; t <= this.trel; t += .5) pts.push([t, this._conc(t)]);
    if (pts.length > 1) kLine(ctx, pts, A.px, A.py, { color: cssVar('--accent-main', '#4ade80'), w: 2.6 });

    // curva prevista (tracejada) até 60 s
    const fut = [];
    for (let t = 0; t <= 60; t += 1) fut.push([t, this._conc(t)]);
    kLine(ctx, fut, A.px, A.py, { color: cssVar('--accent-main'), w: 1.2, dash: [4, 4], alpha: .35 });

    // secante entre t1 e t2
    const c1 = this._conc(this.t1), c2 = this._conc(this.t2);
    ctx.save();
    ctx.strokeStyle = cssVar('--accent-amber', '#fbbf24');
    ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(A.px(this.t1), A.py(c1)); ctx.lineTo(A.px(this.t2), A.py(c2)); ctx.stroke();
    ctx.restore();
    [[this.t1, c1], [this.t2, c2]].forEach(p => {
      ctx.fillStyle = cssVar('--accent-amber');
      ctx.beginPath(); ctx.arc(A.px(p[0]), A.py(p[1]), 4.5, 0, Math.PI * 2); ctx.fill();
    });
    const vm = (c1 - c2) / (this.t2 - this.t1);
    kChip(ctx, `v_m = ${fmt(vm, 4)} mol/L·s`, (A.px(this.t1) + A.px(this.t2)) / 2, A.py((c1 + c2) / 2) - 18,
      { fg: cssVar('--accent-amber'), size: 10, bold: true });

    // meia-vida
    const th = Math.log(2) / this._k();
    if (th <= 60) {
      ctx.save();
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = cssVar('--accent-secondary', '#a78bfa');
      ctx.beginPath(); ctx.moveTo(A.px(th), A.py(0)); ctx.lineTo(A.px(th), A.py(this.a0 / 2)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(A.px(0), A.py(this.a0 / 2)); ctx.lineTo(A.px(th), A.py(this.a0 / 2)); ctx.stroke();
      ctx.restore();
      kChip(ctx, `t½ ${fmt(th, 1)} s`, A.px(th), A.py(0) + 22, { fg: cssVar('--accent-secondary'), size: 10 });
    }

    // ponto atual correndo
    ctx.fillStyle = cssVar('--accent-ok', '#4ade80');
    ctx.beginPath(); ctx.arc(A.px(this.trel), A.py(this._conc(this.trel)), 5.5, 0, Math.PI * 2); ctx.fill();
  }

  _drawEne(ctx, W, H) {
    const D = this.D;
    const gw = Math.min(W * .58, 400), gh = Math.min(H - 130, 240);
    const gx = 66, gy = 44;
    const emax = 110, emin = -120;
    const A = kAxes(ctx, {
      x: gx, y: gy, w: gw, h: gh, xmin: 0, xmax: 100, ymin: emin, ymax: emax,
      yticks: [-100, -50, 0, 50, 100], xticks: [],
      fmty: v => fmt(v, 0),
      xlab: 'Caminho da reação', ylab: 'Energia (kJ/mol)',
    });

    const perfil = (ea) => {
      const p = [];
      for (let x = 0; x <= 100; x += 2) {
        let e;
        if (x < 20) e = 0;
        else if (x > 80) e = D.DH;
        else {
          const u = (x - 20) / 60;
          const pico = Math.sin(u * Math.PI);
          e = lerp(0, D.DH, u) + ea * pico;
        }
        p.push([x, e]);
      }
      return p;
    };

    // caminho sem catalisador em fundo + caminho ativo em destaque
    const sem = D.CAMINHOS[0];
    if (this.caminho.id !== sem.id) {
      kLine(ctx, perfil(sem.ea), A.px, A.py, { color: sem.dot, w: 1.6, dash: [5, 4], alpha: .55 });
    }
    kLine(ctx, perfil(this.caminho.ea), A.px, A.py, { color: this.caminho.dot, w: 2.8 });

    // marcações de Ea e ΔH
    const ytop = A.py(this.caminho.ea), y0 = A.py(0), yf = A.py(D.DH);
    ctx.save();
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = cssVar('--text-muted');
    [y0, ytop, yf].forEach(y => { ctx.beginPath(); ctx.moveTo(A.px(0), y); ctx.lineTo(A.px(100), y); ctx.stroke(); });
    ctx.restore();
    kArrow(ctx, A.px(14), y0, A.px(14), ytop, { color: this.caminho.dot, w: 1.8 });
    kChip(ctx, `Ea ${this.caminho.ea} kJ/mol`, A.px(14) + 52, (y0 + ytop) / 2, { fg: this.caminho.dot, size: 10, bold: true });
    kArrow(ctx, A.px(92), y0, A.px(92), yf, { color: cssVar('--accent-exo', '#f87171'), w: 1.8 });
    kChip(ctx, `ΔH ${D.DH} kJ/mol`, A.px(92) - 48, (y0 + yf) / 2, { fg: cssVar('--accent-exo'), size: 10, bold: true });
    kLabel(ctx, 'reagentes', A.px(8), y0 - 12, { size: 10 });
    kLabel(ctx, 'produtos', A.px(92), yf + 14, { size: 10 });

    // inset de Maxwell-Boltzmann
    const ix = gx + gw + 40, iw = W - ix - 24, ih = 130;
    if (iw > 130) {
      const iy = gy + 20;
      const B = kAxes(ctx, {
        x: ix, y: iy, w: iw, h: ih, xmin: 0, xmax: 120, ymin: 0, ymax: 1.05,
        xticks: [0, 40, 80, 120], yticks: [],
        xlab: 'Energia (kJ/mol)',
      });
      const T = this.tene + 273.15, RT = D.R_KJ * T;
      const f = E => Math.sqrt(E) * Math.exp(-E / (RT * 12));
      let ymax = 0;
      for (let E = 0; E <= 120; E += 2) ymax = Math.max(ymax, f(E));
      const curva = [];
      for (let E = 0; E <= 120; E += 2) curva.push([E, f(E) / ymax]);
      // área acima de Ea
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(B.px(this.caminho.ea), B.py(0));
      curva.filter(p => p[0] >= this.caminho.ea).forEach(p => ctx.lineTo(B.px(p[0]), B.py(p[1])));
      ctx.lineTo(B.px(120), B.py(0));
      ctx.closePath();
      ctx.fillStyle = this.caminho.dot; ctx.globalAlpha = .3; ctx.fill();
      ctx.restore();
      kLine(ctx, curva, B.px, B.py, { color: cssVar('--text-secondary'), w: 1.8 });
      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = this.caminho.dot;
      ctx.beginPath(); ctx.moveTo(B.px(this.caminho.ea), B.py(0)); ctx.lineTo(B.px(this.caminho.ea), B.py(1)); ctx.stroke();
      ctx.restore();
      kLabel(ctx, 'Maxwell-Boltzmann', ix + iw / 2, iy - 12, { size: 11, bold: true, color: cssVar('--text-primary') });
      kChip(ctx, `fração ≈ ${this._fracao(this.caminho.ea).toExponential(1)}`, ix + iw / 2, iy + ih + 34,
        { fg: this.caminho.dot, size: 10, bold: true });
    }
  }

  getResults() {
    if (this.modo === 'colisoes') {
      return [
        { l: 'Temperatura', v: fmt(this.tcol, 0) + ' °C' },
        { l: 'Catalisador', v: this.cat ? 'presente' : 'ausente', cls: this.cat ? 'val-ok' : '' },
        { l: 'Partículas A', v: String(this.A.length) },
        { l: 'Partículas B', v: String(this.B.length) },
        { l: 'Produto C', v: String(this.C.length), cls: 'val-ok' },
        { l: 'Fração efetiva', v: fmt(this._pEf() * 100, 1) + ' %' },
        { l: 'Choques efetivos', v: fmt(this.taxa, 1) + ' /s' },
      ];
    }
    if (this.modo === 'curva') {
      const k = this._k(), c1 = this._conc(this.t1), c2 = this._conc(this.t2);
      return [
        { l: '[A]₀', v: fmt(this.a0, 2) + ' mol/L' },
        { l: 'Constante k', v: fmt(k, 4) + ' s⁻¹' },
        { l: 'Meia-vida t½', v: fmt(Math.log(2) / k, 1) + ' s' },
        { l: 'Tempo corrido', v: fmt(this.trel, 1) + ' s' },
        { l: '[A] atual', v: fmt(this._conc(this.trel), 3) + ' mol/L' },
        { l: `[A] em ${fmt(this.t1, 0)} s`, v: fmt(c1, 3) + ' mol/L' },
        { l: `[A] em ${fmt(this.t2, 0)} s`, v: fmt(c2, 3) + ' mol/L' },
        { l: 'Velocidade média', v: fmt((c1 - c2) / (this.t2 - this.t1), 4) + ' mol/L·s', cls: 'val-ok' },
      ];
    }
    const sem = this.D.CAMINHOS[0];
    return [
      { l: 'Caminho', v: this.caminho.nome },
      { l: 'Ea', v: this.caminho.ea + ' kJ/mol', cls: 'val-ok' },
      { l: 'Ea sem catálise', v: sem.ea + ' kJ/mol' },
      { l: 'Redução da Ea', v: fmt(sem.ea - this.caminho.ea, 0) + ' kJ/mol' },
      { l: 'ΔH da reação', v: this.D.DH + ' kJ/mol', cls: 'val-exo' },
      { l: 'Temperatura', v: fmt(this.tene, 0) + ' °C' },
      { l: 'Fração ativada', v: this._fracao(this.caminho.ea).toExponential(2) },
      { l: 'Ganho vs. sem cat.', v: fmt(this._fracao(this.caminho.ea) / this._fracao(sem.ea), 1) + '×' },
    ];
  }

  getOverlay() {
    if (this.modo === 'colisoes') return `${fmt(this.tcol, 0)} °C · ${this.cat ? 'com' : 'sem'} catalisador`;
    if (this.modo === 'curva') return `k = ${fmt(this._k(), 4)} s⁻¹ · t = ${fmt(this.trel, 1)} s`;
    return `${this.caminho.nome} · Ea ${this.caminho.ea} kJ/mol`;
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

    var storeKey = 'cinetica-w-' + cfg.cssVar.replace(/^--/, '');
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
