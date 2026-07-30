/* ================================================================
   SIELQ — scrpiteletroquimica.js | mecânicas e casco do simulador
   de Eletroquímica (fusão SIPIL + SIELE)
   ================================================================
   MechA: montar a pilha, espontaneidade e tabela de potenciais.
   MechB: eletrólise ígnea, aquosa e leis de Faraday. A classe Mech,
   no fim, é uma FACHADA que direciona cada modo à mecânica dona
   dele — o casco App continua idêntico ao da família. Requer
   dadoseletroquimica.js.
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
// MECÂNICA A — Pilhas e potenciais (origem: SIPIL)
// Modos: montar pilha · espontaneidade · tabela de potenciais
// ══════════════════════════════════════════════════════════════════
class MechA {
  constructor(D) {
    this.D = D;
    this.M = D.METAIS.filter(m => !m.ref);
    this.modo = 'montar';
    this.esq = this._get('zn');
    this.dir = this._get('cu');
    this.fita = this._get('zn');
    this.solucao = this._get('cu');
    this.destaque = this._get('cu');
    this.mergulhado = 0;   // 0…1 progresso da deposição
    this.imerso = false;
    this.fase = 0;
    this.massaAn = 1; this.massaCat = 1;
  }

  _get(id) { return this.D.METAIS.find(m => m.id === id); }

  build(app) {
    const encher = (selId, sel) => {
      const el = document.getElementById(selId);
      if (!el) return;
      el.innerHTML = '';
      this.M.forEach(m => {
        const o = document.createElement('option');
        o.value = m.id;
        o.textContent = `${m.simb} · ${m.nome} (${fmt(m.e0, 2)} V)`;
        if (m.id === sel.id) o.selected = true;
        el.appendChild(o);
      });
    };
    encher('sel-esq', this.esq);
    encher('sel-dir', this.dir);
    encher('sel-fita', this.fita);
    encher('sel-sol', this.solucao);

    fillOptGrid('tab-grid', this.D.METAIS.map(m => ({
      value: m.id, nome: `${m.simb} / ${m.ion}`, dot: m.cor, extra: fmt(m.e0, 2) + ' V',
      aria: `${m.nome}, potencial padrão de redução ${fmt(m.e0, 2)} volts`,
    })), this.destaque.id);
  }

  setMode(id) { this.modo = id; }

  setParam(k, v) {
    if (k === 'esq' || k === 'dir') {
      this[k] = this._get(v) || this[k];
      if (this.esq.id === this.dir.id) {
        return { warn: 'Os dois eletrodos são do mesmo metal: não há diferença de potencial e a pilha não funciona.' };
      }
      const p = this._pilha();
      return { say: `${p.anodo.nome} é o ânodo e ${p.catodo.nome} é o cátodo. Diferença de potencial de ${fmt(p.de, 2)} volts.` };
    }
    if (k === 'fita' || k === 'solucao') {
      this[k] = this._get(v) || this[k];
      this.mergulhado = 0; this.imerso = false;
      const e = this._espont();
      return { say: e.reage
        ? `Fita de ${this.fita.nome} em solução de ${this.solucao.ion}: a reação é espontânea, delta E igual a ${fmt(e.de, 2)} volts.`
        : `Fita de ${this.fita.nome} em solução de ${this.solucao.ion}: não há reação, delta E igual a ${fmt(e.de, 2)} volts.` };
    }
    if (k === 'destaque') {
      this.destaque = this.D.METAIS.find(m => m.id === v) || this.destaque;
      return { say: `${this.destaque.nome}: potencial padrão de ${fmt(this.destaque.e0, 2)} volts.` };
    }
    return {};
  }

  action(name) {
    if (name === 'pilha-status') {
      const p = this._pilha();
      if (!p.valida) return announce('Selecione dois metais diferentes para montar a pilha.');
      return announce(`Pilha de ${p.anodo.nome} e ${p.catodo.nome}. No ânodo, polo negativo, ${p.anodo.simb} sólido se oxida a ${p.anodo.ion}, liberando elétrons. No cátodo, polo positivo, ${p.catodo.ion} recebe elétrons e deposita ${p.catodo.simb} sólido. Diferença de potencial padrão de ${fmt(p.de, 2)} volts.`);
    }
    if (name === 'mergulhar') {
      this.imerso = true;
      const e = this._espont();
      announce(e.reage
        ? `Fita mergulhada. A reação acontece: ${this.fita.simb} se oxida e ${this.solucao.simb} se deposita sobre a fita.`
        : 'Fita mergulhada. Nada acontece: o metal da fita é menos reativo que o íon da solução.');
    }
    if (name === 'esp-reset') {
      this.imerso = false; this.mergulhado = 0;
      announce('Fita retirada da solução.');
    }
    if (name === 'tab-status') {
      const m = this.destaque;
      const forca = m.e0 < 0 ? 'bom agente redutor: oxida-se com facilidade'
        : 'seu íon é bom agente oxidante: reduz-se com facilidade';
      announce(`${m.nome}, par ${m.ion} barra ${m.simb}, potencial padrão de redução ${fmt(m.e0, 2)} volts. É um ${forca}.`);
    }
  }

  onArrow(dx, dy) {
    if (this.modo !== 'tabela' || !dy) return false;
    const i = this.D.METAIS.indexOf(this.destaque);
    const j = clamp(i + dy, 0, this.D.METAIS.length - 1);
    if (j === i) return false;
    this.destaque = this.D.METAIS[j];
    fillOptGrid('tab-grid', this.D.METAIS.map(m => ({
      value: m.id, nome: `${m.simb} / ${m.ion}`, dot: m.cor, extra: fmt(m.e0, 2) + ' V',
      aria: `${m.nome}, potencial padrão de redução ${fmt(m.e0, 2)} volts`,
    })), this.destaque.id);
    announce(`${this.destaque.nome}, ${fmt(this.destaque.e0, 2)} volts.`);
    return true;
  }

  /* ── modelos ── */
  _pilha() {
    const a = this.esq, b = this.dir;
    if (a.id === b.id) return { valida: false, de: 0, anodo: a, catodo: b };
    const catodo = a.e0 > b.e0 ? a : b;
    const anodo = a.e0 > b.e0 ? b : a;
    return { valida: true, anodo, catodo, de: catodo.e0 - anodo.e0, anodoEsq: anodo === a };
  }

  _espont() {
    const de = this.solucao.e0 - this.fita.e0;
    return { de, reage: de > 0.001 && this.fita.id !== this.solucao.id };
  }

  update(dt, app) {
    this.fase += dt;
    if (this.modo === 'espontaneidade' && this.imerso && this._espont().reage) {
      this.mergulhado = Math.min(1, this.mergulhado + dt * 0.28);
    }
    if (this.modo === 'montar') {
      const p = this._pilha();
      if (p.valida) {
        this.massaAn = clamp(this.massaAn - dt * 0.02 * p.de, 0.25, 1);
        this.massaCat = clamp(this.massaCat + dt * 0.02 * p.de, 1, 1.7);
      }
    }
  }

  draw(ctx, W, H, app) {
    if (this.modo === 'montar') this._drawPilha(ctx, W, H);
    else if (this.modo === 'espontaneidade') this._drawEsp(ctx, W, H);
    else this._drawTab(ctx, W, H);
  }

  _drawPilha(ctx, W, H) {
    const p = this._pilha();
    const cx = W / 2, cy = H / 2 + 20;
    const bw = 118, bh = 130, gap = Math.min(W * .22, 130);
    const xl = cx - gap - bw / 2, xr = cx + gap - bw / 2;
    const top = cy - bh / 2;

    if (!p.valida) {
      kLabel(ctx, 'Escolha dois metais diferentes', cx, cy, { size: 14, bold: true, color: cssVar('--accent-amber', '#fbbf24') });
      return;
    }
    const esqM = this.esq, dirM = this.dir;
    const esqEhAnodo = esqM === p.anodo;

    // béqueres
    const cor = m => m.sol || cssVar('--accent-cyan', '#22d3ee');
    ctx.save(); ctx.translate(xl + bw / 2, 0);
    kBeaker(ctx, 0, top, bw, bh, .68, cor(esqM), { alpha: .4, rotulo: `${esqM.ion} 1 mol/L` });
    ctx.restore();
    ctx.save(); ctx.translate(xr + bw / 2, 0);
    kBeaker(ctx, 0, top, bw, bh, .68, cor(dirM), { alpha: .4, rotulo: `${dirM.ion} 1 mol/L` });
    ctx.restore();

    // eletrodos (largura acompanha a massa)
    const placa = (x, m, anodo) => {
      const larg = 15 * (anodo ? this.massaAn : this.massaCat);
      ctx.save();
      ctx.fillStyle = m.cor;
      kRound(ctx, x - larg / 2, top - 26, larg, bh - 8, 2); ctx.fill();
      ctx.strokeStyle = cssVar('--border', '#1c2e44'); ctx.lineWidth = 1; ctx.stroke();
      ctx.restore();
      kLabel(ctx, m.simb, x, top + bh - 24, { size: 13, bold: true, color: '#0b1220' });
      kChip(ctx, anodo ? 'ÂNODO −' : 'CÁTODO +', x, top + bh + 30,
        { fg: anodo ? cssVar('--accent-cyan', '#22d3ee') : cssVar('--accent-main', '#facc15'), size: 10, bold: true });
      kLabel(ctx, anodo ? `${m.simb} → ${m.ion} + ${m.n} e⁻` : `${m.ion} + ${m.n} e⁻ → ${m.simb}`,
        x, top + bh + 50, { size: 10, color: cssVar('--text-secondary'), mono: true });
    };
    placa(xl + bw / 2, esqM, esqEhAnodo);
    placa(xr + bw / 2, dirM, !esqEhAnodo);

    // fio externo + lâmpada
    const yFio = top - 62;
    const fio = [[xl + bw / 2, top - 26], [xl + bw / 2, yFio], [xr + bw / 2, yFio], [xr + bw / 2, top - 26]];
    ctx.save();
    ctx.strokeStyle = cssVar('--text-secondary', '#94a3b8');
    ctx.lineWidth = 2;
    ctx.beginPath();
    fio.forEach((p2, i) => i ? ctx.lineTo(p2[0], p2[1]) : ctx.moveTo(p2[0], p2[1]));
    ctx.stroke();
    ctx.restore();

    // elétrons do ânodo para o cátodo
    const rota = esqEhAnodo ? fio : fio.slice().reverse();
    kFlowDots(ctx, rota, (this.fase * 0.25 * Math.max(.3, p.de)) % 1, 9,
      cssVar('--accent-cyan', '#22d3ee'), { rotulo: true });

    // lâmpada
    const brilho = clamp(p.de / 2.5, .1, 1);
    ctx.save();
    const g = ctx.createRadialGradient(cx, yFio, 2, cx, yFio, 26);
    g.addColorStop(0, `rgba(250,204,21,${brilho})`);
    g.addColorStop(1, 'rgba(250,204,21,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, yFio, 26, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = cssVar('--accent-main', '#facc15');
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, yFio, 11, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    kChip(ctx, `ΔE° = ${fmt(p.de, 2)} V`, cx, yFio - 34,
      { fg: cssVar('--accent-main'), size: 12, bold: true });

    // ponte salina
    const yP = top + 18;
    ctx.save();
    ctx.strokeStyle = cssVar('--accent-secondary', '#a78bfa');
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.globalAlpha = .55;
    ctx.beginPath();
    ctx.moveTo(xl + bw - 12, yP);
    ctx.quadraticCurveTo(cx, yP - 34, xr + 12, yP);
    ctx.stroke();
    ctx.restore();
    kLabel(ctx, 'ponte salina (KCl)', cx, yP - 34, { size: 10, color: cssVar('--accent-secondary') });

    // notação de pilha
    kLabel(ctx, `${p.anodo.simb}(s) | ${p.anodo.ion} ‖ ${p.catodo.ion} | ${p.catodo.simb}(s)`,
      cx, H - 18, { size: 12, bold: true, mono: true, color: cssVar('--text-primary') });
  }

  _drawEsp(ctx, W, H) {
    const e = this._espont();
    const cx = W / 2, cy = H / 2;
    const bw = 150, bh = 170, top = cy - bh / 2 + 10;

    // solução: cor esmaece à medida que o íon é consumido
    const base = this.solucao.sol || '#7dd3fc';
    const corSol = e.reage ? kMix(base, '#dbeafe', this.mergulhado * .8) : base;
    ctx.save(); ctx.translate(cx, 0);
    kBeaker(ctx, 0, top, bw, bh, .7, corSol, { alpha: .55, rotulo: `solução de ${this.solucao.ion}` });
    ctx.restore();

    // fita metálica
    const fy = this.imerso ? top - 20 : top - 70;
    ctx.save();
    ctx.fillStyle = this.fita.cor;
    kRound(ctx, cx - 11, fy, 22, 130, 3); ctx.fill();
    // depósito do outro metal sobre a fita
    if (e.reage && this.mergulhado > 0.02) {
      ctx.globalAlpha = clamp(this.mergulhado, 0, 1);
      ctx.fillStyle = this.solucao.cor;
      const dh = 100 * this.mergulhado;
      kRound(ctx, cx - 12, fy + 130 - dh, 24, dh, 3); ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = cssVar('--border', '#1c2e44'); ctx.lineWidth = 1;
    kRound(ctx, cx - 11, fy, 22, 130, 3); ctx.stroke();
    ctx.restore();
    kLabel(ctx, this.fita.simb, cx, fy - 12, { size: 13, bold: true, color: this.fita.cor });

    // veredito
    const cor = e.reage ? cssVar('--accent-ok', '#4ade80') : cssVar('--accent-exo', '#f87171');
    kChip(ctx, e.reage ? 'REAÇÃO ESPONTÂNEA' : 'NÃO HÁ REAÇÃO', cx, 30, { fg: cor, size: 12, bold: true });
    kLabel(ctx, `ΔE° = E°(${this.solucao.ion}) − E°(${this.fita.ion}) = ${fmt(this.solucao.e0, 2)} − (${fmt(this.fita.e0, 2)}) = ${fmt(e.de, 2)} V`,
      cx, H - 40, { size: 11, mono: true, color: cssVar('--text-secondary') });
    if (e.reage) {
      kLabel(ctx, `${this.fita.simb}(s) + ${this.solucao.ion} → ${this.fita.ion} + ${this.solucao.simb}(s)`,
        cx, H - 20, { size: 12, bold: true, color: cor, mono: true });
    } else {
      kLabel(ctx, `${this.fita.simb} é menos reativo que ${this.solucao.simb}: não desloca`,
        cx, H - 20, { size: 11, color: cor });
    }
  }

  _drawTab(ctx, W, H) {
    const M = this.D.METAIS;
    const x = W / 2, top = 46, alt = Math.min(H - 110, 300);
    const emin = -2.6, emax = 1.7;
    const py = v => top + alt - (v - emin) / (emax - emin) * alt;

    // régua
    ctx.save();
    ctx.strokeStyle = cssVar('--border', '#1c2e44');
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, top + alt); ctx.stroke();
    ctx.restore();

    M.forEach(m => {
      const y = py(m.e0);
      const on = m.id === this.destaque.id;
      ctx.save();
      ctx.strokeStyle = on ? cssVar('--accent-main', '#facc15') : cssVar('--text-muted', '#64748b');
      ctx.lineWidth = on ? 2.4 : 1.2;
      ctx.beginPath(); ctx.moveTo(x - 14, y); ctx.lineTo(x + 14, y); ctx.stroke();
      ctx.fillStyle = m.cor;
      ctx.beginPath(); ctx.arc(x, y, on ? 6.5 : 4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      kLabel(ctx, `${m.simb} / ${m.ion}`, x - 24, y,
        { size: on ? 12 : 11, align: 'right', bold: on, color: on ? cssVar('--accent-main') : cssVar('--text-secondary') });
      kLabel(ctx, fmt(m.e0, 2) + ' V', x + 24, y,
        { size: on ? 12 : 11, align: 'left', bold: on, mono: true, color: on ? cssVar('--accent-main') : cssVar('--text-secondary') });
      if (m.ref) kChip(ctx, 'referência', x + 96, y, { fg: cssVar('--accent-secondary', '#a78bfa'), size: 9 });
    });

    kArrow(ctx, x - 150, top + alt, x - 150, top, { color: cssVar('--accent-cyan', '#22d3ee'), w: 2 });
    kLabel(ctx, 'poder oxidante do íon →', x - 150, top - 16, { size: 10, color: cssVar('--accent-cyan') });
    kArrow(ctx, x + 150, top, x + 150, top + alt, { color: cssVar('--accent-exo', '#f87171'), w: 2 });
    kLabel(ctx, 'poder redutor do metal →', x + 150, top + alt + 18, { size: 10, color: cssVar('--accent-exo') });
    kLabel(ctx, 'Potenciais padrão de redução (25 °C, 1 mol/L)', W / 2, 22,
      { size: 12, bold: true, color: cssVar('--text-primary') });
  }

  getResults() {
    if (this.modo === 'montar') {
      const p = this._pilha();
      if (!p.valida) return [{ l: 'Situação', v: 'metais iguais', cls: 'val-amber' }];
      return [
        { l: 'Ânodo (oxidação)', v: `${p.anodo.simb} · ${fmt(p.anodo.e0, 2)} V` },
        { l: 'Cátodo (redução)', v: `${p.catodo.simb} · ${fmt(p.catodo.e0, 2)} V` },
        { l: 'Semirreação anódica', v: `${p.anodo.simb} → ${p.anodo.ion} + ${p.anodo.n} e⁻` },
        { l: 'Semirreação catódica', v: `${p.catodo.ion} + ${p.catodo.n} e⁻ → ${p.catodo.simb}` },
        { l: 'ΔE° da pilha', v: fmt(p.de, 2) + ' V', cls: 'val-ok' },
        { l: 'Espontânea?', v: p.de > 0 ? 'sim' : 'não', cls: 'val-ok' },
        { l: 'Notação', v: `${p.anodo.simb}|${p.anodo.ion}‖${p.catodo.ion}|${p.catodo.simb}` },
      ];
    }
    if (this.modo === 'espontaneidade') {
      const e = this._espont();
      return [
        { l: 'Fita', v: `${this.fita.simb} · ${fmt(this.fita.e0, 2)} V` },
        { l: 'Íon da solução', v: `${this.solucao.ion} · ${fmt(this.solucao.e0, 2)} V` },
        { l: 'ΔE°', v: fmt(e.de, 2) + ' V', cls: e.reage ? 'val-ok' : 'val-exo' },
        { l: 'Reage?', v: e.reage ? 'sim, espontânea' : 'não', cls: e.reage ? 'val-ok' : 'val-exo' },
        { l: 'Deposição', v: fmt(this.mergulhado * 100, 0) + ' %' },
        { l: 'Fita imersa', v: this.imerso ? 'sim' : 'não' },
      ];
    }
    const m = this.destaque;
    return [
      { l: 'Metal', v: m.nome },
      { l: 'Par redox', v: `${m.ion} / ${m.simb}` },
      { l: 'Elétrons (n)', v: String(m.n) },
      { l: 'E° de redução', v: fmt(m.e0, 2) + ' V', cls: 'val-ok' },
      { l: 'E° de oxidação', v: fmt(-m.e0, 2) + ' V' },
      { l: 'Caráter', v: m.e0 < 0 ? 'bom redutor' : 'íon bom oxidante' },
      { l: 'Posição na fila', v: `${this.D.METAIS.indexOf(m) + 1} de ${this.D.METAIS.length}` },
    ];
  }

  getOverlay() {
    if (this.modo === 'montar') {
      const p = this._pilha();
      return p.valida ? `${p.anodo.simb} ‖ ${p.catodo.simb} · ΔE° ${fmt(p.de, 2)} V` : 'Metais iguais';
    }
    if (this.modo === 'espontaneidade') {
      const e = this._espont();
      return `${this.fita.simb} em ${this.solucao.ion} · ${e.reage ? 'reage' : 'não reage'}`;
    }
    return `${this.destaque.simb} · ${fmt(this.destaque.e0, 2)} V`;
  }
}

// ══════════════════════════════════════════════════════════════════
// MECÂNICA B — Eletrólise e Faraday (origem: SIELE)
// Modos: ígnea (sal fundido) · aquosa (filas de descarga) · Faraday
// ══════════════════════════════════════════════════════════════════
class MechB {
  constructor(D) {
    this.D = D;
    this.modo = 'ignea';
    // modo 1
    this.sal = D.IGNEA[0];
    this.iign = 2;
    this.ligada = true;
    this.ions = [];
    this.bolhasAn = []; this.bolhasCat = [];
    // modo 2
    this.eletrolito = D.AQUOSA[0];
    this.iaq = 2;
    this.ligadaAq = true;
    this.bAn = []; this.bCat = [];
    // modo 3
    this.metal = D.GALVANO[0];
    this.ifar = 2; this.tfar = 1800;
    this.prog = 0; this.depositando = false;
    this.fase = 0;
    this._semear();
  }

  build(app) {
    fillOptGrid('ignea-grid', this.D.IGNEA.map(s => ({
      value: s.id, nome: s.nome, dot: s.corAn, extra: `${s.cation} / ${s.anion}`,
      aria: `${s.nome}, cátion ${s.cation}, ânion ${s.anion}, funde a ${s.tfusao} graus`,
    })), this.sal.id);
    fillOptGrid('aquosa-grid', this.D.AQUOSA.map(e => ({
      value: e.id, nome: e.nome, dot: e.corSol, extra: `${e.cat} + ${e.an}`,
      aria: `${e.nome} produz ${e.cat} no cátodo e ${e.an} no ânodo`,
    })), this.eletrolito.id);
    fillOptGrid('far-grid', this.D.GALVANO.map(m => ({
      value: m.id, nome: m.nome, dot: m.cor, extra: `${fmt(m.M, 2)} · n=${m.n}`,
      aria: `${m.nome}, massa molar ${fmt(m.M, 2)} gramas por mol, ${m.n} elétrons por íon`,
    })), this.metal.id);
  }

  setMode(id) { this.modo = id; }

  setParam(k, v) {
    switch (k) {
      case 'sal':
        this.sal = this.D.IGNEA.find(s => s.id === v) || this.sal;
        this._semear();
        return { say: `${this.sal.nome}. No cátodo forma-se ${this.sal.cat}; no ânodo, ${this.sal.an}.` };
      case 'iign': this.iign = v; break;
      case 'eletrolito':
        this.eletrolito = this.D.AQUOSA.find(e => e.id === v) || this.eletrolito;
        this.bAn = []; this.bCat = [];
        return { say: `${this.eletrolito.nome}: no cátodo ${this.eletrolito.cat}, no ânodo ${this.eletrolito.an}. ${this.eletrolito.resta}.` };
      case 'iaq': this.iaq = v; break;
      case 'metal':
        this.metal = this.D.GALVANO.find(m => m.id === v) || this.metal;
        this.prog = 0;
        return { say: `${this.metal.nome}: massa molar ${fmt(this.metal.M, 2)} e ${this.metal.n} elétrons por íon.` };
      case 'ifar': this.ifar = v; this.prog = 0; break;
      case 'tfar': this.tfar = v; this.prog = 0; break;
    }
    return {};
  }

  action(name) {
    if (name === 'toggle-fonte') {
      this.ligada = !this.ligada;
      announce(this.ligada
        ? `Fonte ligada. Cátions ${this.sal.cation} migram ao cátodo e ânions ${this.sal.anion} ao ânodo.`
        : 'Fonte desligada: os íons param de migrar.');
    }
    if (name === 'toggle-fonte-aq') {
      this.ligadaAq = !this.ligadaAq;
      announce(this.ligadaAq
        ? `Fonte ligada. Cátodo produz ${this.eletrolito.cat} e ânodo produz ${this.eletrolito.an}.`
        : 'Fonte desligada.');
    }
    if (name === 'depositar') {
      this.depositando = true; this.prog = 0;
      const r = this._faraday();
      announce(`Deposição iniciada. Ao fim de ${fmt(this.tfar, 0)} segundos serão depositados ${fmt(r.m, 4)} gramas de ${this.metal.nome}.`);
    }
    if (name === 'far-reset') {
      this.depositando = false; this.prog = 0;
      announce('Cuba reiniciada.');
    }
  }

  _semear() {
    this.ions = [];
    for (let i = 0; i < 26; i++) {
      this.ions.push({
        x: (Math.random() - .5) * 210, y: (Math.random() - .5) * 90,
        cat: i % 2 === 0, ph: Math.random(),
      });
    }
  }

  _faraday() {
    const M = this.metal, Q = this.ifar * this.tfar;
    const mole = Q / (M.n * this.D.F);
    return { Q, mole, m: mole * M.M, molE: Q / this.D.F };
  }

  update(dt, app) {
    this.fase += dt;
    if (this.modo === 'ignea' && this.ligada) {
      const v = isReduced() ? 0 : 26 * clamp(this.iign / 4, .3, 2.2);
      this.ions.forEach(io => {
        io.x += (io.cat ? -1 : 1) * v * dt;
        if (io.x < -105) io.x = 105;
        if (io.x > 105) io.x = -105;
      });
      const boxA = { x: 78, y: -46, w: 22, h: 84 };
      if (this.sal.gasAn) kBubbles(this.bolhasAn, dt, boxA, 12 * this.iign, {});
    }
    if (this.modo === 'aquosa' && this.ligadaAq) {
      const E = this.eletrolito;
      const boxA = { x: 74, y: -46, w: 22, h: 84 };
      const boxC = { x: -96, y: -46, w: 22, h: 84 };
      if (E.gasAn) kBubbles(this.bAn, dt, boxA, 12 * this.iaq, {});
      if (E.gasCat) kBubbles(this.bCat, dt, boxC, 12 * this.iaq, {});
    }
    if (this.modo === 'faraday' && this.depositando) {
      this.prog = Math.min(1, this.prog + dt * .35);
      if (this.prog >= 1) this.depositando = false;
    }
  }

  draw(ctx, W, H, app) {
    if (this.modo === 'ignea') this._drawCuba(ctx, W, H, false);
    else if (this.modo === 'aquosa') this._drawCuba(ctx, W, H, true);
    else this._drawFar(ctx, W, H);
  }

  _drawCuba(ctx, W, H, aquosa) {
    const E = aquosa ? this.eletrolito : this.sal;
    const on = aquosa ? this.ligadaAq : this.ligada;
    const corr = aquosa ? this.iaq : this.iign;
    const cx = W / 2, cy = H / 2 + 26;
    const bw = 250, bh = 130;

    // cuba
    const corLiq = aquosa ? E.corSol : '#f59e0b';
    ctx.save(); ctx.translate(cx, 0);
    kBeaker(ctx, 0, cy - bh / 2, bw, bh, .82, corLiq,
      { alpha: aquosa ? .45 : .6, rotulo: aquosa ? E.nome + ' — solução' : E.nome });
    ctx.restore();
    if (!aquosa) kFlame(ctx, cx, cy + bh / 2 + 30, 18, this.fase);

    // eletrodos
    const ey = cy - bh / 2 - 26, eh = bh - 6;
    const ex1 = cx - 86, ex2 = cx + 86;
    const placa = (x, pos, rot) => {
      ctx.save();
      ctx.fillStyle = cssVar('--text-secondary', '#94a3b8');
      kRound(ctx, x - 8, ey, 16, eh, 2); ctx.fill();
      ctx.restore();
      kChip(ctx, rot, x, cy + bh / 2 + 20,
        { fg: pos ? cssVar('--accent-exo', '#f87171') : cssVar('--accent-cyan', '#22d3ee'), size: 10, bold: true });
    };
    placa(ex1, false, 'CÁTODO (−)');
    placa(ex2, true, 'ÂNODO (+)');

    // fonte externa e fio
    const yTop = ey - 56;
    const fio = [[ex1, ey], [ex1, yTop], [cx - 26, yTop], [cx + 26, yTop], [ex2, yTop], [ex2, ey]];
    ctx.save();
    ctx.strokeStyle = cssVar('--text-secondary');
    ctx.lineWidth = 2;
    ctx.beginPath();
    fio.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
    ctx.stroke();
    // símbolo da fonte
    ctx.strokeStyle = on ? cssVar('--accent-main', '#f87171') : cssVar('--text-muted', '#64748b');
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(cx - 8, yTop - 12); ctx.lineTo(cx - 8, yTop + 12); ctx.stroke();
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(cx + 8, yTop - 7); ctx.lineTo(cx + 8, yTop + 7); ctx.stroke();
    ctx.restore();
    kChip(ctx, on ? `fonte ligada · ${fmt(corr, 1)} A` : 'fonte desligada', cx, yTop - 28,
      { fg: on ? cssVar('--accent-main') : cssVar('--text-muted'), size: 11, bold: true });

    // elétrons no fio externo: da fonte para o cátodo
    if (on) {
      kFlowDots(ctx, [[cx - 26, yTop], [ex1, yTop], [ex1, ey]], (this.fase * .3) % 1, 4,
        cssVar('--accent-cyan', '#22d3ee'), { rotulo: true });
      kFlowDots(ctx, [[ex2, ey], [ex2, yTop], [cx + 26, yTop]], (this.fase * .3) % 1, 4,
        cssVar('--accent-cyan', '#22d3ee'), {});
    }

    if (!aquosa) {
      // íons migrando
      ctx.save(); ctx.translate(cx, cy);
      this.ions.forEach(io => {
        ctx.fillStyle = io.cat ? this.sal.corCat : this.sal.corAn;
        ctx.beginPath(); ctx.arc(io.x, io.y, 4.4, 0, Math.PI * 2); ctx.fill();
        kLabel(ctx, io.cat ? '+' : '−', io.x, io.y, { size: 8, color: '#0b1220', bold: true });
      });
      ctx.restore();
      // bolhas de gás no ânodo
      ctx.save(); ctx.translate(cx, cy);
      kDrawBubbles(ctx, this.bolhasAn, 'rgba(255,255,255,.7)');
      ctx.restore();
      // metal líquido acumulando no cátodo
      ctx.save();
      ctx.fillStyle = this.sal.corCat;
      ctx.globalAlpha = .8;
      kRound(ctx, ex1 - 14, cy + bh / 2 - 16, 28, 12, 3); ctx.fill();
      ctx.restore();
    } else {
      ctx.save(); ctx.translate(cx, cy);
      kDrawBubbles(ctx, this.bAn, 'rgba(255,255,255,.75)');
      kDrawBubbles(ctx, this.bCat, 'rgba(255,255,255,.75)');
      ctx.restore();
      if (!E.gasCat) {
        ctx.save();
        ctx.fillStyle = E.corCat;
        kRound(ctx, ex1 - 10, ey + 12, 20, eh - 18, 2); ctx.fill();
        ctx.restore();
      }
    }

    // semirreações
    kLabel(ctx, E.semiCat, ex1, cy + bh / 2 + 44, { size: 10, mono: true, color: cssVar('--accent-cyan', '#22d3ee'), maxW: 220 });
    kLabel(ctx, E.semiAn, ex2, cy + bh / 2 + 44, { size: 10, mono: true, color: cssVar('--accent-exo', '#f87171'), maxW: 220 });
    kLabel(ctx, aquosa ? E.resta : `funde a ${E.tfusao} °C`, cx, H - 16,
      { size: 11, color: cssVar('--text-secondary'), maxW: W - 40 });
  }

  _drawFar(ctx, W, H) {
    const r = this._faraday();
    const cx = W / 2, cy = H / 2 + 20;
    const bw = 230, bh = 140;

    ctx.save(); ctx.translate(cx, 0);
    kBeaker(ctx, 0, cy - bh / 2, bw, bh, .8, '#7dd3fc', { alpha: .35, rotulo: `banho de ${this.metal.nome}` });
    ctx.restore();

    // peça a ser revestida (cátodo) com camada crescendo
    const px = cx - 66, ey = cy - bh / 2 - 22, eh = bh - 4;
    ctx.save();
    ctx.fillStyle = cssVar('--text-secondary', '#94a3b8');
    kRound(ctx, px - 16, ey, 32, eh, 3); ctx.fill();
    const cam = 12 * this.prog;
    if (cam > .5) {
      ctx.fillStyle = this.metal.cor;
      kRound(ctx, px - 16 - cam, ey - cam / 2, 32 + cam * 2, eh + cam, 3); ctx.fill();
    }
    ctx.restore();
    kChip(ctx, 'peça — CÁTODO (−)', px, cy + bh / 2 + 20, { fg: cssVar('--accent-cyan', '#22d3ee'), size: 10, bold: true });

    // ânodo do metal puro
    const ax = cx + 76;
    ctx.save();
    ctx.fillStyle = this.metal.cor;
    kRound(ctx, ax - 9, ey, 18, eh * (1 - this.prog * .18), 3); ctx.fill();
    ctx.restore();
    kChip(ctx, `${this.metal.nome} — ÂNODO (+)`, ax, cy + bh / 2 + 20, { fg: cssVar('--accent-exo', '#f87171'), size: 10, bold: true });

    // circuito
    const yTop = ey - 50;
    ctx.save();
    ctx.strokeStyle = cssVar('--text-secondary');
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px, ey); ctx.lineTo(px, yTop); ctx.lineTo(ax, yTop); ctx.lineTo(ax, ey);
    ctx.stroke();
    ctx.restore();
    if (this.depositando) {
      kFlowDots(ctx, [[ax, ey], [ax, yTop], [px, yTop], [px, ey]], (this.fase * .35) % 1, 7,
        cssVar('--accent-cyan', '#22d3ee'), { rotulo: true });
    }
    kChip(ctx, `${fmt(this.ifar, 1)} A durante ${fmt(this.tfar, 0)} s`, cx, yTop - 24,
      { fg: cssVar('--accent-main', '#f87171'), size: 11, bold: true });

    // cálculo passo a passo
    const lin = [
      `Q = i · t = ${fmt(this.ifar, 1)} × ${fmt(this.tfar, 0)} = ${fmt(r.Q, 0)} C`,
      `mol de e⁻ = Q / F = ${fmt(r.Q, 0)} / 96500 = ${fmt(r.molE, 5)} mol`,
      `mol de ${this.metal.nome.split(' ')[0]} = ${fmt(r.molE, 5)} / ${this.metal.n} = ${fmt(r.mole, 5)} mol`,
      `m = ${fmt(r.mole, 5)} × ${fmt(this.metal.M, 2)} = ${fmt(r.m, 4)} g`,
    ];
    lin.forEach((t, i) => kLabel(ctx, t, cx, 30 + i * 18,
      { size: 11, mono: true, color: i === 3 ? this.metal.cor : cssVar('--text-secondary'), bold: i === 3 }));

    // barra de progresso
    if (this.prog > 0) {
      const barW = Math.min(W - 80, 300);
      ctx.save();
      ctx.fillStyle = cssVar('--border', '#1c2e44');
      kRound(ctx, cx - barW / 2, H - 26, barW, 8, 4); ctx.fill();
      ctx.fillStyle = this.metal.cor;
      kRound(ctx, cx - barW / 2, H - 26, Math.max(4, barW * this.prog), 8, 4); ctx.fill();
      ctx.restore();
    }
  }

  getResults() {
    if (this.modo === 'ignea') {
      const s = this.sal;
      return [
        { l: 'Sal fundido', v: s.nome },
        { l: 'Fusão', v: s.tfusao + ' °C' },
        { l: 'Cátodo (−)', v: s.semiCat, cls: 'val-endo' },
        { l: 'Ânodo (+)', v: s.semiAn, cls: 'val-exo' },
        { l: 'Produto catódico', v: s.cat },
        { l: 'Produto anódico', v: s.an },
        { l: 'Corrente', v: fmt(this.iign, 1) + ' A' },
        { l: 'Fonte', v: this.ligada ? 'ligada' : 'desligada', cls: this.ligada ? 'val-ok' : '' },
      ];
    }
    if (this.modo === 'aquosa') {
      const E = this.eletrolito;
      return [
        { l: 'Eletrólito', v: E.nome },
        { l: 'Cátodo (−)', v: E.semiCat, cls: 'val-endo' },
        { l: 'Ânodo (+)', v: E.semiAn, cls: 'val-exo' },
        { l: 'Produtos', v: `${E.cat} + ${E.an}` },
        { l: 'Observação', v: E.resta },
        { l: 'Fila de cátions', v: this.D.FILA_CATIONS },
        { l: 'Fila de ânions', v: this.D.FILA_ANIONS },
        { l: 'Fonte', v: this.ligadaAq ? 'ligada' : 'desligada', cls: this.ligadaAq ? 'val-ok' : '' },
      ];
    }
    const r = this._faraday(), M = this.metal;
    return [
      { l: 'Metal', v: M.nome },
      { l: 'Massa molar', v: fmt(M.M, 2) + ' g/mol' },
      { l: 'Elétrons (n)', v: String(M.n) },
      { l: 'Corrente', v: fmt(this.ifar, 1) + ' A' },
      { l: 'Tempo', v: fmt(this.tfar, 0) + ' s (' + fmt(this.tfar / 60, 1) + ' min)' },
      { l: 'Carga Q = i·t', v: fmt(r.Q, 0) + ' C' },
      { l: 'mol de elétrons', v: fmt(r.molE, 5) + ' mol' },
      { l: 'mol de metal', v: fmt(r.mole, 5) + ' mol' },
      { l: 'Massa depositada', v: fmt(r.m, 4) + ' g', cls: 'val-ok' },
    ];
  }

  getOverlay() {
    if (this.modo === 'ignea') return `${this.sal.nome} · ${this.ligada ? fmt(this.iign, 1) + ' A' : 'desligada'}`;
    if (this.modo === 'aquosa') return `${this.eletrolito.nome} · ${this.eletrolito.cat} + ${this.eletrolito.an}`;
    return `${this.metal.nome} · ${fmt(this._faraday().m, 4)} g`;
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

    var storeKey = 'eletroquimica-w-' + cfg.cssVar.replace(/^--/, '');
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
