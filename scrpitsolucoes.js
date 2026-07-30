/* ================================================================
   SISOL — scrpitsolucoes.js | mecânicas e casco do simulador de
   Soluções e Propriedades Coligativas (fusão SISOL + SIPC)
   ================================================================
   Duas mecânicas completas convivem neste arquivo: MechA (preparo,
   diluição e curvas de solubilidade) e MechB (pressão de vapor,
   ebulioscopia/crioscopia e osmose). A classe Mech, no fim, é uma
   FACHADA que direciona cada modo à mecânica dona dele — o casco
   App continua idêntico ao da família. Requer dadossolucoes.js.
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

/** Gotas caindo de um ponto de origem até uma altura-alvo (efeito "despejando água"). */
function kDrops(arr, dt, o) {
  if (!isReduced() && Math.random() < (o.rate || 6) * dt) {
    arr.push({ x: o.x + (Math.random() - .5) * (o.spread || 4), y: o.y, r: 1.5 + Math.random() * 1.5, v: 95 + Math.random() * 40 });
  }
  for (let i = arr.length - 1; i >= 0; i--) {
    const d = arr[i];
    d.y += d.v * dt;
    if (d.y > o.targetY) arr.splice(i, 1);
  }
}
function kDrawDrops(ctx, arr, color) {
  ctx.save(); ctx.fillStyle = color || 'rgba(147,197,253,.85)';
  arr.forEach(d => { ctx.beginPath(); ctx.ellipse(d.x, d.y, d.r * .6, d.r, 0, 0, Math.PI * 2); ctx.fill(); });
  ctx.restore();
}

/** Floco de gelo simples (asterisco de 3 traços) — sinaliza congelamento. */
function kSnowflake(ctx, x, y, s, color) {
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = 1.4; ctx.globalAlpha = .9;
  for (let a = 0; a < 3; a++) {
    const ang = a * Math.PI / 3;
    const dx = Math.cos(ang) * s, dy = Math.sin(ang) * s;
    ctx.beginPath(); ctx.moveTo(x - dx, y - dy); ctx.lineTo(x + dx, y + dy); ctx.stroke();
  }
  ctx.restore();
}

/** Fiapos de vapor ondulando para cima — sinaliza fervura/ebulição. */
function kSteam(ctx, x, y, phase, color) {
  ctx.save();
  ctx.strokeStyle = color; ctx.globalAlpha = .5; ctx.lineWidth = 1.6;
  for (let i = 0; i < 2; i++) {
    const ox = x + (i - .5) * 11;
    ctx.beginPath();
    ctx.moveTo(ox, y);
    ctx.quadraticCurveTo(ox + Math.sin(phase * 3 + i * 2) * 6, y - 14, ox, y - 27);
    ctx.stroke();
  }
  ctx.restore();
}

/** Torneira simples: cano + bico + alavanca que gira quando aberta.
 *  x,y = ponto do bico (onde a gota nasce). */
function kTap(ctx, x, y, aberta, cor) {
  ctx.save();
  ctx.strokeStyle = cssVar('--glass'); ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x - 18, y - 10); ctx.lineTo(x, y - 10); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x, y - 10); ctx.lineTo(x, y); ctx.stroke();
  ctx.save();
  ctx.translate(x - 18, y - 10);
  ctx.rotate(aberta ? -0.95 : 0);
  ctx.strokeStyle = cor || cssVar('--accent-amber'); ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -11); ctx.stroke();
  ctx.restore();
  ctx.restore();
}

// ══════════════════════════════════════════════════════════════════
// MECÂNICA A — Soluções (origem: SISOL)
// Preparo: C = m/V e M = C/MM com limite de solubilidade a 25 °C
// (excesso → corpo de fundo). Diluição: C₁V₁ = C₂V₂ (massa de soluto
// conservada). Mistura (mesmo soluto): C_f = (C₁V₁+C₂V₂)/(V₁+V₂).
// Curvas: interpolação linear nas tabelas reais (dados no arquivo de
// dados) — abaixo da curva insaturada, sobre a curva saturada, acima
// corpo de fundo.
// ══════════════════════════════════════════════════════════════════
class MechA {
  constructor(D) {
    this.D = D;
    this.mode = 'preparo';
    this.mix = { item: D.MISTURAS[0], resposta: null, acertos: 0, tentativas: 0, feedback: null, particulas: [], lente: false };
    this.prep = { sol: D.SOLUTOS[0], massa: 30, vol: 250, temp: 25, p: 0, dissolving: false, done: false, erro: 0, part: [] };
    this.dil = { op: 'diluir', c1: 1.2, v1: 200, vagua: 200, c2: .4, v2: 200, q: 0, running: false, done: false, droplets: [], ripples: [], droplets2: [], ripples2: [] };
    this.cur = { sal: D.SOLUBILIDADE[0], T: 20, m: 60, resposta: null, acertos: 0, tentativas: 0, feedback: null, zoom: false };
    this.fase = 0;
  }

  build() {
    fillOptGrid('mix-grid', this.D.MISTURAS.map(s => ({
      value: s.id, nome: s.nome, dot: s.dot || s.cor,
    })), this.mix.item.id);
    fillOptGrid('preparo-grid', this.D.SOLUTOS.map(s => ({
      value: s.id, nome: s.nome, dot: s.dot, extra: `${fmt(s.M, 2)} g/mol`,
      aria: `${s.nome}, massa molar ${fmt(s.M, 2)} gramas por mol`,
    })), this.prep.sol.id);
    fillOptGrid('curvas-grid', this.D.SOLUBILIDADE.map(s => ({
      value: s.id, nome: s.nome, dot: s.cor,
      extra: s.g[10] > s.g[0] + 2 ? '↑ com T' : (s.g[10] < s.g[0] - 2 ? '↓ com T' : '≈ estável'),
    })), this.cur.sal.id);
    this._syncPrepMassaMax();
    this._initMixParticulas();
  }

  /** (Re)popula as partículas visuais da mistura selecionada, com posições
   *  iniciais espalhadas — a física de sedimentação/Browniano acontece no
   *  update(). */
  _initMixParticulas() {
    const item = this.mix.item;
    const n = item.tipo === 'solucao' ? 0 : (item.tipo === 'coloide' ? 26 : 16);
    this.mix.particulas = Array.from({ length: n }, (_, i) => ({
      x: (Math.sin(i * 12.9) * .5 + .5), y: (Math.cos(i * 7.3) * .5 + .5) * .7,
      assentada: false,
    }));
  }

  /** Solubilidade do soluto do PREPARO na temperatura atual (interpolada
   *  na mesma curva de 11 pontos usada no modo Curvas). */
  _solTPrep() {
    const c = this.prep.sol.curva;
    return kInterp(c.map((y, i) => [i * 10, y]), this.prep.temp);
  }

  /** O limite de solubilidade depende do soluto, do volume E AGORA TAMBÉM
   *  da temperatura ao mesmo tempo (limite = sol(T) · vol / 100) — por
   *  isso o teto do slider de massa é recalculado sempre que qualquer um
   *  dos três mudar, e não fica travado num valor fixo. */
  _syncPrepMassaMax() {
    const P = this.prep;
    const limite = this._solTPrep() * P.vol / 100;
    const novoMax = Math.max(60, Math.ceil(limite * 1.8 / 10) * 10);
    const inp = document.getElementById('prep-massa');
    if (inp && Number(inp.max) !== novoMax) {
      inp.max = novoMax;
      if (P.massa > novoMax) { P.massa = novoMax; this.app.syncSlider('prep-massa', novoMax); }
    }
  }

  setMode(id) { this.mode = id; }

  setParam(k, v) {
    const P = this.prep, L = this.dil, C = this.cur, X = this.mix;
    switch (k) {
      case 'mixItem': {
        X.item = this.D.MISTURAS.find(s => s.id === v); X.resposta = null; X.feedback = null;
        this._initMixParticulas();
        return { say: `Observando: ${X.item.nome}. Repare no feixe de luz e se as partículas sedimentam.` };
      }
      case 'soluto': {
        P.sol = this.D.SOLUTOS.find(s => s.id === v); P.p = 0; P.done = false; P.part.length = 0;
        this._syncPrepMassaMax();
        return { say: `${P.sol.nome} selecionado. Solubilidade a ${fmt(P.temp, 0)} graus: ${fmt(this._solTPrep(), 1)} gramas por 100 gramas de água.` };
      }
      case 'massa': P.massa = v; P.done = false; return;
      case 'vol': P.vol = v; P.done = false; this._syncPrepMassaMax(); return;
      case 'temp': {
        P.temp = v; P.done = false; this._syncPrepMassaMax();
        return { say: `Temperatura ajustada para ${fmt(v, 0)} graus. Nova solubilidade: ${fmt(this._solTPrep(), 1)} gramas por 100 gramas de água.` };
      }
      case 'op': {
        L.op = v; L.q = 0; L.done = false;
        document.getElementById('row-dil-agua').hidden = v !== 'diluir';
        document.getElementById('row-dil-c2').hidden = v !== 'misturar';
        return { say: v === 'diluir' ? 'Operação: diluir com água pela torneira.' : 'Operação: misturar duas soluções de KMnO₄ pelas torneiras.' };
      }
      case 'c1': L.c1 = v; L.q = 0; return;
      case 'v1': L.v1 = v; L.q = 0; return;
      case 'vagua': L.vagua = v; L.q = 0; return;
      case 'c2': L.c2 = v; L.q = 0; return;
      case 'v2': L.v2 = v; L.q = 0; return;
      case 'sal': {
        C.sal = this.D.SOLUBILIDADE.find(s => s.id === v);
        C.resposta = null; C.feedback = null;
        const maxSal = Math.max(...C.sal.g);
        const novoMax = maxSal > 230 ? Math.ceil(maxSal * 1.15 / 50) * 50 : 250;
        const inpMassa = document.getElementById('cur-massa');
        if (inpMassa && Number(inpMassa.max) !== novoMax) {
          inpMassa.max = novoMax;
          if (C.m > novoMax) { C.m = novoMax; this.app.syncSlider('cur-massa', novoMax); }
        }
        return { say: `${C.sal.nome} selecionado. Solubilidade a ${fmt(C.T, 0)} graus: ${fmt(this._solT(), 1)} gramas por 100 gramas de água. Compare com a massa escolhida.` };
      }
      case 't': C.T = v; C.resposta = null; return;
      case 'mcur': C.m = v; C.resposta = null; return;
    }
  }

  action(name) {
    const P = this.prep, L = this.dil, C = this.cur, X = this.mix;
    if (name === 'dica-mix') {
      announce('Dica: se o feixe de luz não aparece, é solução. Se aparece mas nada sedimenta, é colóide. Se sedimenta com o tempo, é suspensão.');
    } else if (name === 'toggle-lente') {
      X.lente = !X.lente;
      announce(X.lente ? 'Lente de observação ligada.' : 'Lente de observação desligada.');
    } else if (name === 'resp-solucao' || name === 'resp-coloide' || name === 'resp-suspensao') {
      const mapa = { 'resp-solucao': 'solucao', 'resp-coloide': 'coloide', 'resp-suspensao': 'suspensao' };
      const nomes = { solucao: 'solução verdadeira', coloide: 'colóide', suspensao: 'suspensão' };
      const escolha = mapa[name], certo = escolha === X.item.tipo;
      X.tentativas++; if (certo) X.acertos++;
      X.resposta = escolha; X.feedback = { ok: certo, t: this.fase };
      playTone(certo ? 880 : 300, .12, .07);
      announce(certo
        ? `Certo! ${X.item.nome} é ${nomes[X.item.tipo]} — ${X.item.contexto}`
        : `Não foi dessa vez — ${X.item.nome} é, na verdade, ${nomes[X.item.tipo]}. ${X.item.contexto}`, 'assertive');
    } else if (name === 'dissolver') {
      P.p = 0; P.done = false; P.dissolving = true;
      // margem de erro experimental (±3%), como aconteceria com vidraria e
      // balança reais — sorteada de novo a cada tentativa de dissolução
      P.erro = (Math.random() * 2 - 1) * 0.03;
      if (isReduced()) P.p = 1;
      playTone(700, .08, .06);
      announce(`Dissolvendo ${fmt(P.massa, 0)} gramas de ${P.sol.nome} em ${fmt(P.vol, 0)} mililitros de água a ${fmt(P.temp, 0)} graus.`);
    } else if (name === 'prep-reset') {
      P.massa = 30; P.vol = 250; P.temp = 25; P.p = 0; P.done = false; P.dissolving = false; P.erro = 0; P.part.length = 0;
      this.app.syncSlider('prep-massa', 30); this.app.syncSlider('prep-vol', 250); this.app.syncSlider('prep-temp', 25);
      this._syncPrepMassaMax();
      playTone(440, .07, .05); announce('Preparo reiniciado: 30 gramas em 250 mililitros, 25 graus — resultados zerados.');
    } else if (name === 'aplicar') {
      L.q = 0; L.done = false; L.running = true;
      if (isReduced()) L.q = 1;
      playTone(700, .08, .06);
      announce(L.op === 'diluir' ? 'Torneiras abertas: solução e água escoando para o béquer maior.' : 'Torneiras abertas: as duas soluções escoando para o béquer maior.');
    } else if (name === 'dil-reset') {
      Object.assign(L, { c1: 1.2, v1: 200, vagua: 200, c2: .4, v2: 200, q: 0, running: false, done: false });
      L.droplets.length = 0; L.ripples.length = 0; L.droplets2.length = 0; L.ripples2.length = 0;
      ['dil-c1', 'dil-v1', 'dil-vagua', 'dil-c2', 'dil-v2'].forEach((id, i) => this.app.syncSlider(id, [1.2, 200, 200, .4, 200][i]));
      playTone(440, .07, .05); announce('Diluição reiniciada.');
    } else if (name === 'dica') {
      announce('Dica: compare a linha pontilhada (massa escolhida) com a altura da curva na temperatura marcada — está acima, sobre, ou abaixo dela?');
    } else if (name === 'toggle-zoom-curvas') {
      C.zoom = !C.zoom;
      announce(C.zoom ? 'Lente de perto ligada.' : 'Lente de perto desligada.');
    } else if (name === 'resp-insat' || name === 'resp-sat' || name === 'resp-corpo') {
      const mapa = { 'resp-insat': 'insat', 'resp-sat': 'sat', 'resp-corpo': 'corpo' };
      const nomes = { insat: 'insaturada', sat: 'saturada', corpo: 'com corpo de fundo' };
      const escolha = mapa[name], r = this._classe(), certo = escolha === r.tipo;
      C.tentativas++; if (certo) C.acertos++;
      C.resposta = escolha; C.feedback = { ok: certo, t: this.fase };
      playTone(certo ? 880 : 300, .12, .07);
      announce(certo
        ? `Certo! A solução está ${r.nome}. ${r.det}`
        : `Não foi dessa vez — na verdade está ${nomes[r.tipo]}. ${r.det}`, 'assertive');
    }
  }

  /* ── contas ── */
  _prepCalc() {
    const P = this.prep, e = easeIO(clamp(P.p, 0, 1));
    const limite = this._solTPrep() * P.vol / 100;      // g dissolvíveis nesse volume E temperatura
    const dissMax = Math.min(P.massa, limite);
    const diss = dissMax * e;
    const corpo = P.massa - diss;
    const VL = P.vol / 1000;
    const err = 1 + (P.erro || 0);
    const C = diss / VL, M = C / P.sol.M;
    return { limite, dissMax, diss, corpo, Cnom: P.massa / VL, C, Cexp: C * err, M, Mexp: M * err, satFrac: limite > 0 ? diss / limite : 0 };
  }
  _dilCalc() {
    const L = this.dil, e = easeIO(clamp(L.q, 0, 1));
    if (L.op === 'diluir') {
      const V2 = L.v1 + L.vagua, C2 = L.c1 * L.v1 / V2;
      return { e, V2, C2, Cnow: L.c1 * L.v1 / (L.v1 + L.vagua * e), Vnow: L.v1 + L.vagua * e, fator: V2 / L.v1 };
    }
    const Vf = L.v1 + L.v2, Cf = (L.c1 * L.v1 + L.c2 * L.v2) / Vf;
    return { e, Vf, Cf, m1: L.c1 * L.v1 / 1000, m2: L.c2 * L.v2 / 1000 };
  }
  _solT() { const g = this.cur.sal.g; return kInterp(g.map((y, i) => [i * 10, y]), this.cur.T); }
  _classe() {
    const s = this._solT(), m = this.cur.m, d = m - s;
    if (d > 0.5) return { tipo: 'corpo', nome: 'saturada com corpo de fundo', det: `Excesso não dissolvido: ${fmt(d, 1)} g.` };
    if (d >= -0.5) return { tipo: 'sat', nome: 'saturada', det: 'A massa coincide com o coeficiente de solubilidade.' };
    return { tipo: 'insat', nome: 'insaturada', det: `Ainda cabem ${fmt(-d, 1)} g até saturar.` };
  }

  update(dt) {
    const P = this.prep, L = this.dil;
    this.fase += dt;
    // sedimentação real das partículas de uma SUSPENSÃO (colóides e soluções
    // não sedimentam — colóide só balança com o movimento Browniano, feito
    // direto no desenho; solução não tem partículas visíveis)
    if (this.mix.item.tipo === 'suspensao') {
      this.mix.particulas.forEach(p => {
        if (!p.assentada) { p.y += dt * 0.12; if (p.y >= 0.92) { p.y = 0.92; p.assentada = true; } }
      });
    }
    if (P.dissolving) {
      P.p = Math.min(1, P.p + dt / 1.6);
      if (P.p >= 1 && !P.done) {
        P.done = true; P.dissolving = false;
        const c = this._prepCalc();
        playTone(c.corpo > 0.2 ? 420 : 880, .12, .06);
        announce(c.corpo > 0.2
          ? `Saturou! Dissolveram ${fmt(c.diss, 1)} g; ${fmt(c.corpo, 1)} g ficaram como corpo de fundo. Concentração real: ${fmt(c.C, 1)} g/L.`
          : `Tudo dissolvido. C = ${fmt(c.C, 1)} g/L; molaridade = ${fmt(c.M, 3)} mol/L.`, 'assertive');
      }
    }
    if (L.running) {
      L.q = Math.min(1, L.q + dt / 1.8);
      if (L.q >= 1 && !L.done) {
        L.done = true; L.running = false;
        const d = this._dilCalc();
        playTone(880, .12, .06);
        announce(L.op === 'diluir'
          ? `Diluição concluída: C₂ = ${fmt(d.C2, 2)} g/L em ${fmt(d.V2, 0)} mL (diluiu ${fmt(d.fator, 1)} vez).`
          : `Mistura concluída: C final = ${fmt(d.Cf, 2)} g/L em ${fmt(d.Vf, 0)} mL.`, 'assertive');
      }
    }
    if (this.mode === 'preparo' && P.box) {
      const c = this._prepCalc();
      kParticles(P.part, Math.round(clamp(c.diss * 1.1, 0, 64)), P.box, 26, dt);
    }
    // gotas caindo + ondulações nas DUAS torneiras enquanto o líquido escoa
    // para o béquer maior — vale tanto para diluir (soluto + água) quanto
    // para misturar (solução A + solução B)
    if (this.mode === 'diluicao' && L.running && !isReduced()) {
      if (L.dropX != null) kDrops(L.droplets, dt, { x: L.dropX, y: L.dropY0, targetY: L.dropTarget, rate: 14 });
      if (L.drop2X != null) kDrops(L.droplets2, dt, { x: L.drop2X, y: L.drop2Y0, targetY: L.drop2Target, rate: 14 });
      if (Math.random() < 7 * dt) L.ripples.push({ r: 2, a: .55 });
      if (Math.random() < 7 * dt) L.ripples2.push({ r: 2, a: .55 });
    }
    L.ripples.forEach(r => { r.r += 46 * dt; r.a -= dt * 0.75; });
    L.ripples = L.ripples.filter(r => r.a > 0.02);
    L.ripples2.forEach(r => { r.r += 46 * dt; r.a -= dt * 0.75; });
    L.ripples2 = L.ripples2.filter(r => r.a > 0.02);
  }

  /* ── desenho ── */
  draw(ctx, W, H, app) {
    if (this.mode === 'classificacao') this._drawMix(ctx, W, H);
    else if (this.mode === 'preparo') this._dPreparo(ctx, W, H, app);
    else if (this.mode === 'diluicao') this._dDil(ctx, W, H, app);
    else this._dCurvas(ctx, W, H);
  }

  /** Béquer + feixe de luz atravessando (efeito Tyndall) + partículas —
   *  a chave visual para diferenciar solução (feixe invisível, sem
   *  partículas), colóide (feixe visível, partículas suspensas com
   *  tremor Browniano) e suspensão (partículas sedimentando com o tempo). */
  _drawMix(ctx, W, H) {
    const X = this.mix, item = X.item;
    const estreito = W < 620;
    // margem reservada pro feixe+lanterna à ESQUERDA do béquer — cresce e
    // encolhe com o canvas, nunca fixa, pra nunca sair da área visível
    const margemFeixe = clamp(W * .13, 34, 66);
    // sem a lente (padrão), o béquer fica mais centralizado e maior; com a
    // lente ligada, ele volta pra esquerda pra abrir espaço pra ela
    const bw = clamp(W * (X.lente ? .24 : .3), estreito ? 120 : 170, X.lente ? 280 : 340);
    const bh = estreito ? Math.min(H * .38, 240) : Math.min(H * .7, 420);
    const cxPadrao = X.lente ? (estreito ? W * .34 : W * .24) : W * .38;
    const cx = Math.max(cxPadrao, margemFeixe + bw / 2 + 20);
    const top = estreito ? H * .07 : H * .12;
    const box = kBeaker(ctx, cx, top, bw, bh, .82, item.cor, { alpha: item.tipo === 'suspensao' ? .5 : .28, rotulo: item.nome });

    // feixe de luz entrando pela lateral esquerda do béquer
    const ly = top + bh * .42;
    const temFeixeVisivel = item.tipo !== 'solucao';
    ctx.save();
    ctx.strokeStyle = cssVar('--accent-amber', '#fbbf24');
    ctx.lineWidth = temFeixeVisivel ? (item.tipo === 'suspensao' ? 5 : 3) : 1;
    ctx.globalAlpha = item.tipo === 'solucao' ? .06 : (item.tipo === 'suspensao' ? .35 : .8);
    ctx.beginPath(); ctx.moveTo(cx - bw / 2 - margemFeixe, ly); ctx.lineTo(cx + bw / 2 - 6, ly); ctx.stroke();
    ctx.restore();
    // lanterna
    ctx.save(); ctx.fillStyle = cssVar('--text-muted');
    ctx.fillRect(cx - bw / 2 - margemFeixe - 20, ly - 10, 22, 20);
    ctx.restore();
    kLabel(ctx, temFeixeVisivel ? 'feixe visível (Tyndall)' : 'feixe invisível', cx - bw / 2 - margemFeixe, ly - 16,
      { size: 9, align: 'left', color: cssVar('--text-secondary') });

    // partículas: paradas+Brownianas (colóide) ou sedimentando (suspensão)
    ctx.save();
    X.particulas.forEach((p, i) => {
      const jitterX = item.tipo === 'coloide' && !isReduced() ? Math.sin(this.fase * 1.6 + i * 3.1) * 3 : 0;
      const px = cx - bw / 2 + 10 + p.x * (bw - 20) + jitterX;
      const py = top + bh * .12 + p.y * (bh * .8);
      ctx.fillStyle = item.dot || item.cor;
      ctx.globalAlpha = .85;
      ctx.beginPath(); ctx.arc(px, py, item.tipo === 'suspensao' ? 3.2 : 1.6, 0, Math.PI * 2); ctx.fill();
    });
    ctx.restore();
    if (item.tipo === 'suspensao' && X.particulas.some(p => p.assentada)) {
      kLabel(ctx, 'sedimentando no fundo', cx, top + bh + 22, { size: 10, color: cssVar('--text-secondary') });
    }

    // confirmação visual simples: um X/✓ grande junto ao béquer — sem placar,
    // só a confirmação de acerto do ponto (tipo) escolhido
    if (X.resposta) {
      const certo = X.resposta === item.tipo;
      const nomes = { solucao: 'solução verdadeira', coloide: 'colóide', suspensao: 'suspensão' };
      ctx.save();
      ctx.fillStyle = certo ? cssVar('--accent-ok', '#4ade80') : cssVar('--accent-exo', '#f87171');
      ctx.font = 'bold 30px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(certo ? '✓' : '✗', cx, Math.max(26, top - 26));
      ctx.restore();
      if (!certo) kLabel(ctx, `era ${nomes[item.tipo]}`, cx, Math.max(26, top - 26) + 20, { size: 10, color: cssVar('--accent-exo') });
    }
    if (X.feedback && this.fase - X.feedback.t < 1.2 && !isReduced()) {
      const alpha = 1 - (this.fase - X.feedback.t) / 1.2;
      ctx.save(); ctx.globalAlpha = alpha * .5; ctx.lineWidth = 4;
      ctx.strokeStyle = X.feedback.ok ? cssVar('--accent-ok') : cssVar('--accent-exo');
      ctx.beginPath(); ctx.arc(cx, top + bh / 2, bw / 2 + 10 + (1 - alpha) * 12, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    // ── lente de observação: alternativa OPCIONAL (botão "Ver de perto" na
    // barra lateral) — ao LADO em telas largas, EMBAIXO em telas estreitas ──
    if (!X.lente) return;
    const lx = estreito ? W * .5 : W * .68;
    const lyC = estreito ? top + bh + Math.min(H * .2, 100) + 30 : H * .46;
    const lr = estreito
      ? clamp(Math.min(W * .34, (H - lyC) * .8), 46, 100)
      : Math.min(W * .26, H * .38, 260);
    ctx.save();
    ctx.beginPath(); ctx.arc(lx, lyC, lr, 0, Math.PI * 2);
    ctx.fillStyle = cssVar('--bg-panel2', '#101c2b'); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = cssVar('--border'); ctx.stroke();
    ctx.clip();
    if (item.tipo === 'solucao') {
      // nada visível: só o fundo liso, feixe invisível
      ctx.globalAlpha = .05; ctx.strokeStyle = cssVar('--accent-amber'); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(lx - lr, lyC); ctx.lineTo(lx + lr, lyC); ctx.stroke();
    } else if (item.tipo === 'coloide') {
      // feixe brilhante espalhado, com pontinhos de luz ao redor do trajeto
      ctx.globalAlpha = .9; ctx.strokeStyle = cssVar('--accent-amber'); ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(lx - lr, lyC); ctx.lineTo(lx + lr, lyC); ctx.stroke();
      ctx.fillStyle = cssVar('--accent-amber');
      for (let i = 0; i < 22; i++) {
        const t = (i / 22 + (isReduced() ? 0 : this.fase * .05)) % 1;
        const px = lx - lr + t * lr * 2, py = lyC + Math.sin(this.fase * 2 + i) * 5;
        ctx.globalAlpha = .5; ctx.beginPath(); ctx.arc(px, py, 2, 0, Math.PI * 2); ctx.fill();
      }
    } else {
      // suspensão: praticamente opaca, feixe curto e absorvido logo na entrada
      ctx.globalAlpha = .85; ctx.fillStyle = item.dot || item.cor;
      ctx.beginPath(); ctx.arc(lx, lyC, lr, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = .8; ctx.strokeStyle = cssVar('--accent-amber'); ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(lx - lr, lyC); ctx.lineTo(lx - lr * .35, lyC); ctx.stroke();
    }
    ctx.restore();
    kLabel(ctx, 'de perto', lx, lyC - lr - 12, { size: 10, color: cssVar('--text-secondary') });

  }

  _corSolucao(sol, satFrac) {
    if (sol.cor) return { cor: sol.cor, alpha: .10 + .70 * clamp(satFrac, 0, 1) };
    return { cor: cssVar('--accent-endo', '#38bdf8'), alpha: .13 };
  }

  _dPreparo(ctx, W, H, app) {
    const P = this.prep, c = this._prepCalc();
    const bw = clamp(W * .34, 150, 250), bh = H * .56, top = H * .16, cx = W * .36;
    const tint = this._corSolucao(P.sol, c.satFrac);
    const box = kBeaker(ctx, cx, top, bw, bh, P.vol / 1000, tint.cor, { alpha: tint.alpha, rotulo: `${fmt(P.vol, 0)} mL de água` });
    P.box = { x: box.x + 6, y: box.y + 6, w: box.w - 12, h: Math.max(10, box.h - 12) };
    kDrawParticles(ctx, P.part, 2.3, P.sol.dot, .85);

    if (c.corpo > 0.15 && box.h > 4) {
      // corpo de fundo como pilha granular (não mais uma única blob lisa)
      const nGraos = clamp(Math.round(6 + c.corpo * 0.5), 6, 42);
      const baseY = top + bh - 4, spanX = bw * 0.36;
      const pilha = clamp(c.corpo / 35, 0.15, 1);
      ctx.save(); ctx.fillStyle = P.sol.dot;
      for (let i = 0; i < nGraos; i++) {
        const seed = i * 12.9898;
        const rx = Math.sin(seed) * 0.94;
        const rr = 2 + (Math.cos(seed * 1.7) * .5 + .5) * 3;
        const gx = cx + rx * spanX;
        const gy = baseY - Math.abs(Math.sin(seed * 2.3)) * (6 + pilha * 12) * (1 - Math.abs(rx) * .4);
        ctx.globalAlpha = .8 + .18 * Math.sin(seed);
        ctx.beginPath(); ctx.ellipse(gx, gy, rr, rr * .78, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
      kChip(ctx, `corpo de fundo · ${fmt(c.corpo, 1)} g`, cx, top + bh + 30, { fg: cssVar('--accent-exo'), size: 10 });
    }
    // pó caindo + redemoinho de agitação durante a dissolução
    if (P.dissolving && !isReduced()) {
      ctx.save(); ctx.fillStyle = P.sol.dot;
      for (let i = 0; i < 8; i++) {
        const yy = top - 14 + ((app.time * 90 + i * 23) % (box.y - top + 18));
        ctx.globalAlpha = .8; ctx.fillRect(cx - 16 + (i % 5) * 8, yy, 2.6, 2.6);
      }
      ctx.restore();
      ctx.save();
      ctx.translate(cx, box.surfaceY + 14);
      ctx.rotate(app.time * 2.4);
      ctx.strokeStyle = cssVar('--accent-endo'); ctx.lineWidth = 1.6; ctx.globalAlpha = .5;
      ctx.beginPath(); ctx.arc(0, 0, 11, 0.3, Math.PI * 1.5); ctx.stroke();
      ctx.restore();
    }

    // painel-medidor: massa × limite de solubilidade — agora com as DUAS
    // zonas da barra rotuladas diretamente (dissolvido / corpo de fundo),
    // pra a equivalência "passou do limite → vira corpo de fundo" ficar
    // óbvia olhando só a barra, sem precisar ler o texto de baixo.
    const gx = W * .58, gw = clamp(W * .36, 200, 320), gy = H * .3, barH = 24;
    const maxG = Math.max(150, c.limite * 1.15);
    const wOK = clamp(Math.min(P.massa, c.limite) / maxG, 0, 1) * gw;
    const wExcesso = P.massa > c.limite ? clamp((P.massa - c.limite) / maxG, 0, 1) * gw : 0;

    kLabel(ctx, `Saturação a ${fmt(P.temp, 0)} °C`, gx + gw / 2, gy - 32, { size: 13, bold: true, color: cssVar('--text-primary') });

    ctx.save();
    ctx.fillStyle = cssVar('--bg-panel2', '#101c2b'); kRound(ctx, gx, gy, gw, barH, 10); ctx.fill();
    ctx.fillStyle = cssVar('--accent-ok'); kRound(ctx, gx, gy, Math.max(wOK, 2), barH, wExcesso > 0 ? 0 : 10); ctx.fill();
    if (wExcesso > 0) { ctx.fillStyle = cssVar('--accent-exo'); kRound(ctx, gx + wOK, gy, wExcesso, barH, 10); ctx.fill(); }
    // linha tracejada exatamente no limite de solubilidade
    const xl = gx + clamp(c.limite / maxG, 0, 1) * gw;
    ctx.strokeStyle = cssVar('--accent-amber'); ctx.lineWidth = 2; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(xl, gy - 9); ctx.lineTo(xl, gy + barH + 9); ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
    kLabel(ctx, `limite: ${fmt(c.limite, 1)} g`, xl, gy - 15, { size: 10, color: cssVar('--accent-amber'), mono: true, bold: true });

    // rótulos de zona, cada um centrado embaixo do próprio pedaço da barra
    if (wOK > 34) kLabel(ctx, `dissolvido · ${fmt(Math.min(P.massa, c.limite), 1)} g`, gx + wOK / 2, gy + barH + 16,
      { size: 10, color: cssVar('--accent-ok'), bold: true });
    if (wExcesso > 34) kLabel(ctx, `corpo de fundo · ${fmt(P.massa - c.limite, 1)} g`, gx + wOK + wExcesso / 2, gy + barH + 16,
      { size: 10, color: cssVar('--accent-exo'), bold: true });
    else if (wExcesso > 0) kLabel(ctx, `+ corpo de fundo: ${fmt(P.massa - c.limite, 1)} g`, gx + gw + 6, gy + barH / 2,
      { size: 10, align: 'left', color: cssVar('--accent-exo'), bold: true });

    let yy = gy + barH + 40;
    kChip(ctx, `C real = ${fmt(c.C, 1)} g/L`, gx + gw / 2, yy, { fg: cssVar('--accent-amber'), bold: true, size: 12 }); yy += 28;
    kChip(ctx, `M = ${fmt(c.M, 3)} mol/L`, gx + gw / 2, yy, { fg: cssVar('--text-primary'), size: 11 }); yy += 30;
    kLabel(ctx, c.corpo > .2 ? 'solução SATURADA + corpo de fundo' : (c.satFrac > .98 ? 'solução SATURADA' : 'solução insaturada'),
      gx + gw / 2, yy, { size: 11, color: c.corpo > .2 ? cssVar('--accent-exo') : cssVar('--accent-ok'), bold: true });
  }

  _dDil(ctx, W, H, app) {
    const L = this.dil, d = this._dilCalc(), roxo = this.D.DIL.corMax, cRef = this.D.DIL.cRef;
    const bwSrc = clamp(W * .16, 86, 130), bhSrc = H * .19, topSrc = H * .08;
    const bwDest = clamp(W * .42, 220, 340), bhDest = H * .44, topDest = H * .42, cxDest = W * .5;
    const lx = cxDest - bwDest * .3, rx = cxDest + bwDest * .3;

    // béquer de destino MAIOR — para onde as duas torneiras escoam
    const nivelDest = L.op === 'diluir' ? d.Vnow / 1000 : (L.v1 + L.v2) * d.e / 1000;
    const cAtual = L.op === 'diluir' ? d.Cnow : (d.e > 0 ? d.Cf : 0);
    const rotuloDest = L.op === 'diluir'
      ? `${fmt(d.Vnow, 0)} mL`
      : `${fmt((L.v1 + L.v2) * d.e, 0)} mL`;
    const destino = kBeaker(ctx, cxDest, topDest, bwDest, bhDest, nivelDest, roxo,
      { alpha: .08 + .72 * clamp(cAtual / cRef, 0, 1), rotulo: rotuloDest });

    // os béqueres de ORIGEM esvaziam de verdade conforme a animação avança
    // (e: 0 → cheios, 1 → vazios) — antes o reservatório de água era só um
    // contorno estático que nunca mudava, então "verter" não parecia nada
    const nivelOrigem = .74 * (1 - d.e);
    if (L.op === 'diluir') {
      // torneira esquerda: solução concentrada C₁V₁, esvaziando
      kBeaker(ctx, lx, topSrc, bwSrc, bhSrc, nivelOrigem, roxo,
        { alpha: .1 + .7 * clamp(L.c1 / cRef, 0, 1), rotulo: `${fmt(L.c1, 2)} g/L · ${fmt(L.v1 * (1 - d.e), 0)} mL restantes` });
      // torneira direita: reservatório de água, também esvaziando
      kBeaker(ctx, rx, topSrc, bwSrc, bhSrc, nivelOrigem, cssVar('--accent-endo', '#38bdf8'),
        { alpha: .32, rotulo: `Água · ${fmt(L.vagua * (1 - d.e), 0)} mL restantes` });

      L.dropX = lx; L.dropY0 = topSrc + bhSrc + 6; L.dropTarget = destino.surfaceY;
      L.drop2X = rx; L.drop2Y0 = topSrc + bhSrc + 6; L.drop2Target = destino.surfaceY;
      kTap(ctx, lx, topSrc + bhSrc + 4, L.running, roxo);
      kTap(ctx, rx, topSrc + bhSrc + 4, L.running, cssVar('--accent-endo'));
    } else {
      kBeaker(ctx, lx, topSrc, bwSrc, bhSrc, nivelOrigem, roxo,
        { alpha: .1 + .7 * clamp(L.c1 / cRef, 0, 1), rotulo: `A: ${fmt(L.c1, 2)} g/L · ${fmt(L.v1 * (1 - d.e), 0)} mL restantes` });
      kBeaker(ctx, rx, topSrc, bwSrc, bhSrc, nivelOrigem, roxo,
        { alpha: .1 + .7 * clamp(L.c2 / cRef, 0, 1), rotulo: `B: ${fmt(L.c2, 2)} g/L · ${fmt(L.v2 * (1 - d.e), 0)} mL restantes` });
      L.dropX = lx; L.dropY0 = topSrc + bhSrc + 6; L.dropTarget = destino.surfaceY;
      L.drop2X = rx; L.drop2Y0 = topSrc + bhSrc + 6; L.drop2Target = destino.surfaceY;
      kTap(ctx, lx, topSrc + bhSrc + 4, L.running, roxo);
      kTap(ctx, rx, topSrc + bhSrc + 4, L.running, roxo);
    }

    if (L.running && !isReduced()) {
      // cor das gotas de cada torneira: na diluição, a 1ª é solução (roxo) e
      // a 2ª é água (azul); na mistura, AS DUAS são solução (roxo) — antes a
      // 1ª saía sempre azul por engano, mesmo representando KMnO₄
      const cor1 = roxo, cor2 = L.op === 'diluir' ? cssVar('--accent-endo') : roxo;
      kDrawDrops(ctx, L.droplets, cor1);
      kDrawDrops(ctx, L.droplets2, cor2);
      [[L.dropX, L.ripples, cor1], [L.drop2X, L.ripples2, cor2]].forEach(([x, arr, cor]) => {
        ctx.save(); ctx.strokeStyle = cor; ctx.lineWidth = 1.4;
        arr.forEach(r => { ctx.globalAlpha = r.a; ctx.beginPath(); ctx.ellipse(x, destino.surfaceY, r.r, r.r * .32, 0, 0, Math.PI * 2); ctx.stroke(); });
        ctx.restore();
      });
    }

    // identificação rápida de cada fonte, sem precisar ler o rótulo inteiro
    if (L.op === 'misturar') {
      kChip(ctx, 'A', lx, topSrc - 14, { fg: roxo, bold: true, size: 11, border: roxo });
      kChip(ctx, 'B', rx, topSrc - 14, { fg: roxo, bold: true, size: 11, border: roxo });
    }

    kLabel(ctx, L.op === 'diluir' ? 'C₁V₁ = C₂V₂ — massa de soluto se conserva' : 'Cf = (C₁V₁ + C₂V₂)/(V₁+V₂)', cxDest, topDest + bhDest + 40,
      { size: 11, color: cssVar('--text-secondary') });
  }

  _dCurvas(ctx, W, H) {
    const C = this.cur;
    const maxSel = Math.max(...C.sal.g);
    const ymax = maxSel > 230 ? Math.ceil(maxSel * 1.12 / 100) * 100 : 260;
    const passo = ymax > 500 ? 200 : (ymax > 260 ? 100 : 50);
    const yticks = []; for (let v = 0; v <= ymax; v += passo) yticks.push(v);
    const m = kAxes(ctx, {
      x: 58, y: 24, w: W - 104, h: H - 88, xmin: 0, xmax: 100, ymin: 0, ymax,
      xticks: [0, 20, 40, 60, 80, 100], yticks,
      xlab: 'Temperatura (°C)', ylab: 'Solubilidade (g/100 g H₂O)',
    });

    // zonas de fundo relativas ao sal SELECIONADO: abaixo da curva = insaturada,
    // acima = corpo de fundo — torna o significado físico do gráfico visível
    // de cara, não só uma linha abstrata.
    const curvaSel = C.sal.g.map((y, i) => [i * 10, y]);
    ctx.save();
    ctx.beginPath();
    curvaSel.forEach((p, i) => i ? ctx.lineTo(m.px(p[0]), m.py(p[1])) : ctx.moveTo(m.px(p[0]), m.py(p[1])));
    ctx.lineTo(m.px(100), m.py(0)); ctx.lineTo(m.px(0), m.py(0)); ctx.closePath();
    ctx.fillStyle = cssVar('--accent-ok'); ctx.globalAlpha = .08; ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    curvaSel.forEach((p, i) => i ? ctx.lineTo(m.px(p[0]), m.py(p[1])) : ctx.moveTo(m.px(p[0]), m.py(p[1])));
    ctx.lineTo(m.px(100), m.py(ymax)); ctx.lineTo(m.px(0), m.py(ymax)); ctx.closePath();
    ctx.fillStyle = cssVar('--accent-exo'); ctx.globalAlpha = .07; ctx.fill();
    ctx.restore();
    kLabel(ctx, 'insaturada', m.px(6), m.py(0) - 12, { size: 9, align: 'left', color: cssVar('--accent-ok') });
    kLabel(ctx, 'corpo de fundo', m.px(6), m.py(ymax) + 14, { size: 9, align: 'left', color: cssVar('--accent-exo') });

    const rotulosCurva = this.D.SOLUBILIDADE.map(s => {
      const sel = s.id === C.sal.id;
      kLine(ctx, s.g.map((y, i) => [i * 10, y]), m.px, m.py, { color: s.cor, w: sel ? 3.2 : 1.6, alpha: sel ? 1 : .3 });
      return { s, sel, x: m.px(100) + 6, y: m.py(Math.min(s.g[10], ymax)) };
    });
    // anti-colisão: com muitos sais, vários acabam com solubilidade parecida
    // a 100 °C — sem isso, os rótulos empilhavam ilegíveis uns sobre os outros
    rotulosCurva.sort((a, b) => a.y - b.y);
    for (let pass = 0; pass < 5; pass++) {
      for (let i = 0; i < rotulosCurva.length; i++) {
        for (let j = 0; j < rotulosCurva.length; j++) {
          if (i === j) continue;
          const dy = rotulosCurva[i].y - rotulosCurva[j].y;
          if (Math.abs(dy) < 13 && dy >= 0) rotulosCurva[i].y = rotulosCurva[j].y + 13;
        }
      }
    }
    rotulosCurva.forEach(r => kLabel(ctx, r.s.nome, r.x, r.y, { size: 10, color: r.s.cor, align: 'left', bold: r.sel, mono: true }));
    const sT = this._solT();
    ctx.save(); ctx.setLineDash([4, 4]); ctx.strokeStyle = cssVar('--text-muted'); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(m.px(C.T), m.py(0)); ctx.lineTo(m.px(C.T), m.py(Math.max(C.m, sT))); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
    ctx.save(); ctx.strokeStyle = C.sal.cor; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(m.px(C.T), m.py(sT), 5.5, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    // marcador da massa atual — cor NEUTRA (não entrega a classificação!) até
    // o estudante responder ao quiz; pulsa suavemente para chamar atenção
    const pulso = isReduced() ? 0 : Math.sin(this.fase * 3) * 1.6;
    const corMarcador = C.resposta ? (C.feedback && C.feedback.ok ? cssVar('--accent-ok') : cssVar('--accent-exo')) : cssVar('--text-primary');
    ctx.save(); ctx.fillStyle = corMarcador;
    ctx.beginPath(); ctx.arc(m.px(C.T), m.py(C.m), 6 + pulso, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    // confirmação visual simples: ✓/✗ grande junto ao marcador, sem placar
    if (C.resposta) {
      const real = this._classe(), certo = C.resposta === real.tipo;
      const nomes = { insat: 'insaturada', sat: 'saturada', corpo: 'corpo de fundo' };
      ctx.save();
      ctx.fillStyle = certo ? cssVar('--accent-ok', '#4ade80') : cssVar('--accent-exo', '#f87171');
      ctx.font = 'bold 26px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(certo ? '✓' : '✗', m.px(C.T), m.py(C.m) - 24);
      ctx.restore();
      if (!certo) kLabel(ctx, `era ${nomes[real.tipo]}`, m.px(C.T), m.py(C.m) - 42, { size: 10, color: cssVar('--accent-exo') });
    }
    // flash de feedback: anel que aparece e esmaece por ~1,2 s após responder
    if (C.feedback && this.fase - C.feedback.t < 1.2 && !isReduced()) {
      const alpha = 1 - (this.fase - C.feedback.t) / 1.2;
      ctx.save(); ctx.globalAlpha = alpha * .6; ctx.lineWidth = 3;
      ctx.strokeStyle = C.feedback.ok ? cssVar('--accent-ok') : cssVar('--accent-exo');
      ctx.beginPath(); ctx.arc(m.px(C.T), m.py(C.m), 14 + (1 - alpha) * 10, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    kLabel(ctx, `curva: ${fmt(sT, 1)} g/100 g a ${fmt(C.T, 0)} °C`, m.px(C.T), m.py(0) + 26, { size: 10, color: C.sal.cor, mono: true });

    // ── lente "de perto": alternativa OPCIONAL que amplia a vizinhança do
    // ponto (T, massa) contra a curva — útil quando os dois estão bem perto
    // e é difícil ver a olho nu se passou ou não da linha ──
    if (!C.zoom) return;
    const estreito = W < 620;
    const lx = estreito ? W * .5 : W * .78;
    const lyC = estreito ? H - Math.min(H * .22, 120) : H * .28;
    const lr = estreito ? clamp(Math.min(W * .3, 90), 50, 100) : Math.min(W * .16, H * .22, 130);
    const janela = Math.max(6, ymax * .12); // faixa de massa mostrada na lente, centrada no ponto
    ctx.save();
    ctx.beginPath(); ctx.arc(lx, lyC, lr, 0, Math.PI * 2);
    ctx.fillStyle = cssVar('--bg-panel2', '#101c2b'); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = cssVar('--border'); ctx.stroke();
    ctx.clip();
    // reconstrói um mini-eixo Y só com a faixa próxima ao ponto, mesmo eixo X
    const zMin = Math.max(0, C.m - janela), zMax = C.m + janela;
    const zPy = v => lyC + lr - (v - zMin) / (zMax - zMin) * (lr * 2);
    const zPx = t => lx - lr + (t - Math.max(0, C.T - 15)) / 30 * (lr * 2);
    kLine(ctx, curvaSel.map(p => p), zPx, zPy, { color: C.sal.cor, w: 3 });
    ctx.save(); ctx.fillStyle = corMarcador;
    ctx.beginPath(); ctx.arc(zPx(C.T), zPy(C.m), 7, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.restore();
    kLabel(ctx, 'de perto', lx, lyC - lr - 12, { size: 10, color: cssVar('--text-secondary') });
  }

  getResults() {
    if (this.mode === 'classificacao') {
      const X = this.mix;
      const rows = [
        { l: 'Mistura em observação', v: X.item.nome },
      ];
      if (X.resposta) {
        const nomes = { solucao: 'solução verdadeira', coloide: 'colóide', suspensao: 'suspensão' };
        const certo = X.resposta === X.item.tipo;
        rows.push({ l: 'Sua resposta', v: `${nomes[X.resposta]}${certo ? ' ✓' : ' ✗ (era ' + nomes[X.item.tipo] + ')'}`, cls: certo ? 'val-ok' : 'val-exo' });
        rows.push({ l: 'Por quê', v: X.item.contexto });
      }
      return rows;
    }
    if (this.mode === 'preparo') {
      const P = this.prep;
      if (!P.done && !P.dissolving) {
        return [
          { l: 'Soluto', v: P.sol.nome.split(' (')[0] },
          { l: 'Massa pesada', v: `${fmt(P.massa, 0)} g` },
          { l: 'Volume de água', v: `${fmt(P.vol, 0)} mL` },
          { l: 'Temperatura', v: `${fmt(P.temp, 0)} °C` },
          { l: 'Estado', v: 'aguardando o experimento — pressione "Dissolver"' },
        ];
      }
      const c = this._prepCalc(), cl = c.corpo > .2 ? 'val-exo' : 'val-ok';
      return [
        { l: 'Soluto', v: P.sol.nome.split(' (')[0] },
        { l: 'C teórica (cálculo exato)', v: `${fmt(c.C, 1)} g/L` },
        { l: 'C real (medida)', v: `${fmt(c.Cexp, 1)} g/L`, cls: 'val-ok' },
        { l: 'Molaridade (medida)', v: `${fmt(c.Mexp, 3)} mol/L` },
        { l: 'Incerteza experimental', v: `± ${fmt(Math.abs(P.erro * 100), 1)} %` },
        { l: `Limite a ${fmt(P.temp, 0)} °C`, v: `${fmt(c.limite, 1)} g` },
        { l: 'Corpo de fundo', v: `${fmt(Math.max(0, c.corpo), 1)} g`, cls: cl },
      ];
    }
    if (this.mode === 'diluicao') {
      const L = this.dil, d = this._dilCalc();
      if (L.op === 'diluir') return [
        { l: 'Massa de KMnO₄', v: `${fmt(L.c1 * L.v1 / 1000, 2)} g` },
        { l: 'C₁ · V₁', v: `${fmt(L.c1, 2)} g/L · ${fmt(L.v1, 0)} mL` },
        { l: 'V₂ = V₁ + água', v: `${fmt(d.V2, 0)} mL` },
        { l: 'C₂ = C₁V₁/V₂', v: `${fmt(d.C2, 2)} g/L`, cls: 'val-ok' },
        { l: 'Fator de diluição', v: `${fmt(d.fator, 1)}×` },
      ];
      return [
        { l: 'Soluto em A', v: `${fmt(d.m1, 2)} g` },
        { l: 'Soluto em B', v: `${fmt(d.m2, 2)} g` },
        { l: 'V final', v: `${fmt(d.Vf, 0)} mL` },
        { l: 'C_f', v: `${fmt(d.Cf, 2)} g/L`, cls: 'val-ok' },
      ];
    }
    const C = this.cur, sT = this._solT();
    const rows = [
      { l: 'Sal', v: C.sal.nome },
      { l: `Solubilidade a ${fmt(C.T, 0)} °C`, v: `${fmt(sT, 1)} g/100 g` },
      { l: 'Massa adicionada', v: `${fmt(C.m, 0)} g/100 g` },
    ];
    if (C.resposta) {
      const nomes = { insat: 'insaturada', sat: 'saturada', corpo: 'corpo de fundo' };
      const real = this._classe(), certo = C.resposta === real.tipo;
      rows.push({ l: 'Sua resposta', v: `${nomes[C.resposta]}${certo ? ' ✓' : ' ✗ (era ' + nomes[real.tipo] + ')'}`, cls: certo ? 'val-ok' : 'val-exo' });
    }
    return rows;
  }

  getOverlay() {
    if (this.mode === 'classificacao') return this.mix.item.nome;
    if (this.mode === 'preparo') {
      const P = this.prep;
      if (!P.done && !P.dissolving) return `${P.sol.nome.split(' (')[0]} · aguardando`;
      const c = this._prepCalc(); return `${P.sol.nome.split(' (')[0]} · ${fmt(c.Cexp, 1)} g/L`;
    }
    if (this.mode === 'diluicao') return `KMnO₄ · ${this.dil.op === 'diluir' ? 'diluição' : 'mistura'}`;
    return `${this.cur.sal.nome} · ${fmt(this.cur.T, 0)} °C`;
  }
}

/** Equação de Antoine: log₁₀(P_mmHg) = A − B/(C+T[°C]) → P em mmHg. */
function antoinePv(coef, T) {
  const Tc = clamp(T, coef.tmin, coef.tmax);
  return Math.pow(10, coef.A - coef.B / (coef.C + Tc));
}
/** Temperatura de ebulição (°C) para uma dada pressão externa, invertendo
 *  Antoine analiticamente: T = B/(A − log₁₀ P) − C. */
function antoineTe(coef, P) {
  const Pc = Math.max(1, P);
  const T = coef.B / (coef.A - Math.log10(Pc)) - coef.C;
  return clamp(T, coef.tmin - 10, coef.tmax + 10);
}
/** Gera pontos [T,P] para desenho da curva de um líquido, via Antoine
 *  (amostragem contínua) ou tabela CRC, conforme o que estiver disponível. */
function liquidCurve(l, xmax) {
  if (l.antoine) {
    const pts = [];
    const tEnd = Math.min(xmax, l.antoine.tmax);
    const tStart = Math.max(0, l.antoine.tmin);
    for (let t = tStart; t < tEnd; t += 5) pts.push([t, antoinePv(l.antoine, t)]);
    pts.push([tEnd, antoinePv(l.antoine, tEnd)]);
    return pts;
  }
  return l.pv;
}

/** Y exato do topo do mercúrio para um valor — mesma matemática do
 *  kThermo — usado para desenhar setas de deslocamento na altura certa. */
function thermoValueY(topY, h, tmin, tmax, t) {
  const bulbR = 8, tubeTop = topY, tubeBot = topY + h - bulbR * 2;
  const frac = Math.max(0, Math.min(1, (t - tmin) / (tmax - tmin)));
  return tubeBot - frac * (tubeBot - tubeTop - 4);
}

// ══════════════════════════════════════════════════════════════════
// MECÂNICA B — Propriedades Coligativas (origem: SIPC)
// Modos: pressão de vapor · ebulioscopia/crioscopia · osmose · Henry
// ══════════════════════════════════════════════════════════════════
class MechB {
  constructor(D) {
    this.D = D;
    this.modo = 'pvap';
    // modo 1
    this.liquido = D.LIQUIDOS[0];
    this.tpv = 25;
    this.patm = 760;
    this.bolhas = [];
    // modo 2 — ebulioscopia/crioscopia: solvente + soluto
    this.solvente = D.SOLVENTES_COLIG[0];
    this.soluto = D.SOLUTOS_COL[0];
    this.w = 1;
    // modo 3 — osmose (dinâmica real: volumes e mols de cada lado)
    this.mesq = 0.2;
    this.mdir = 0.8;
    this.tosm = 25;
    this.osm = { V0: 0.5, Vesq: 0.5, Vdir: 0.5, nesq: 0, ndir: 0, running: false, papl: 0, modoRO: false };
    this.fase = 0;
    // modo 5 — misturas de líquidos voláteis: Lei de Raoult, ideal vs real
    this.raoult = {
      aId: 'etanol', bId: 'agua', desvio: 'positivo', xA: 0.5, T: 60,
      vista: 'grafico', // 'grafico' | 'balao' | 'desafio'
      // Visão Balão: composição construída fisicamente por gotas (mL),
      // convertida pra mol via densidade/massa molar de cada líquido
      volA: 50, volB: 50,
      // Desafio da Destilação
      desafioId: 'etanol-agua', desafioXA: 0.12, ciclos: 0, travado: false, historico: [0.12],
    };
    // modo 4 — Lei de Henry: C = kH(T)·P
    this.henry = { gas: D.GASES_HENRY[0], T: 4, P: 3, aberto: false, C: 0, liberando: false, bolhas: [] };
    this.henry.C = this._henryEq(this.henry.gas, this.henry.T, this.henry.P);
  }

  build(app) {
    fillOptGrid('pvap-grid', this.D.LIQUIDOS.map(l => ({
      value: l.id, nome: l.nome, dot: l.cor, extra: `Te ${fmt(l.te, 1)} °C`,
      aria: `${l.nome}, ebulição a ${fmt(l.te, 1)} graus Celsius ao nível do mar`,
    })), this.liquido.id);
    fillOptGrid('solvente-grid', this.D.SOLVENTES_COLIG.map(s => ({
      value: s.id, nome: s.nome, dot: s.cor, extra: `Kc ${fmt(s.Kc, 2)}`,
      aria: `${s.nome}, constante crioscópica ${fmt(s.Kc, 2)}, ebulioscópica ${fmt(s.Ke, 2)} graus vezes quilo por mol`,
    })), this.solvente.id);
    fillOptGrid('colig-grid', this.D.SOLUTOS_COL.map(s => ({
      value: s.id, nome: s.nome, dot: s.dot, extra: `i = ${s.i}`,
      aria: `${s.nome}, ${s.tipo}, fator de van 't Hoff igual a ${s.i}`,
    })), this.soluto.id);
    this._buildHenryGrid();
    this._syncHenryUI();
    this._buildRaoultGrids();
    fillOptGrid('raoult-desafio-grid', this.D.DESAFIOS_DESTILACAO.map(d => ({
      value: d.id, nome: d.nome, extra: d.desvio === 'ideal' ? 'sem azeótropo' : 'com azeótropo real',
    })), this.raoult.desafioId);
    this._syncRaoultVistaUI();
  }
  /** Só os líquidos com Antoine (não o éter, que só tem tabela) entram no
   *  modo de mistura binária — o cálculo precisa da função contínua P°(T). */
  _liquidosAntoine() { return this.D.LIQUIDOS.filter(l => l.antoine); }
  _buildRaoultGrids() {
    const lst = this._liquidosAntoine();
    fillOptGrid('raoult-a-grid', lst.map(l => ({ value: l.id, nome: l.nome, dot: l.cor })), this.raoult.aId);
    fillOptGrid('raoult-b-grid', lst.map(l => ({ value: l.id, nome: l.nome, dot: l.cor })), this.raoult.bId);
  }
  _buildHenryGrid() {
    fillOptGrid('henry-grid', this.D.GASES_HENRY.map(g => ({
      value: g.id, nome: g.nome, dot: g.cor, extra: `kH ${fmt(g.kH25 * 1000, 2)}×10⁻³`,
      aria: `${g.nome}, constante de Henry ${fmt(g.kH25, 5)} mol por litro por atmosfera a 25 graus`,
    })), this.henry.gas.id);
  }
  /** Com a garrafa aberta a pressão é sempre 1 atm — oculta e desabilita o
   *  slider de pressão para não sugerir um controle sem efeito. */
  _syncHenryUI() {
    const row = document.getElementById('row-henry-p');
    if (row) row.hidden = this.henry.aberto;
    const inp = document.getElementById('henry-p');
    if (inp) inp.disabled = this.henry.aberto;
  }

  setMode(id) { this.modo = id; }

  setParam(k, v) {
    switch (k) {
      case 'liquido': {
        this.liquido = this.D.LIQUIDOS.find(l => l.id === v) || this.liquido;
        this.bolhas.length = 0;
        // cada líquido só tem dados reais numa faixa de temperatura (Antoine
        // ou tabela); sem essa checagem o slider podia continuar mostrando
        // uma T fora da faixa enquanto o cálculo usava, por baixo dos panos,
        // um valor diferente (clampeado) — número exibido ≠ número usado.
        const L = this.liquido;
        const faixa = L.antoine
          ? [L.antoine.tmin, L.antoine.tmax]
          : [L.pv[0][0], L.pv[L.pv.length - 1][0]];
        const tOk = clamp(this.tpv, Math.max(0, faixa[0]), Math.min(110, faixa[1]));
        let aviso = '';
        if (Math.abs(tOk - this.tpv) > 0.5) {
          this.tpv = tOk;
          this.app.syncSlider('pv-t', tOk);
          aviso = ` Temperatura ajustada para ${fmt(tOk, 0)} °C — fora disso não há dados reais para este líquido.`;
        }
        return { say: `${L.nome} selecionado. Ebulição normal a ${fmt(L.te, 1)} graus.${aviso}` };
      }
      case 'tpv': this.tpv = v; break;
      case 'patm': this.patm = v; break;
      case 'solutocol': {
        this.soluto = this.D.SOLUTOS_COL.find(s => s.id === v) || this.soluto;
        return { say: `${this.soluto.nome}, ${this.soluto.tipo}. Fator i igual a ${this.soluto.i}.` };
      }
      case 'solvente': {
        this.solvente = this.D.SOLVENTES_COLIG.find(s => s.id === v) || this.solvente;
        return { say: `${this.solvente.nome} selecionado — Ke = ${fmt(this.solvente.Ke, 2)}, Kc = ${fmt(this.solvente.Kc, 2)} graus vezes quilo por mol. Ferve puro a ${fmt(this.solvente.Te, 1)} graus e congela a ${fmt(this.solvente.Tc, 1)} graus.` };
      }
      case 'w': this.w = v; break;
      case 'mesq': {
        const estava = this.osm.running;
        this.mesq = v; this._osmReset();
        return estava ? { say: 'Concentração alterada — o fluxo osmótico foi reiniciado do zero.' } : {};
      }
      case 'mdir': {
        const estava = this.osm.running;
        this.mdir = v; this._osmReset();
        return estava ? { say: 'Concentração alterada — o fluxo osmótico foi reiniciado do zero.' } : {};
      }
      case 'tosm': this.tosm = v; break;
      case 'modoOsm': {
        const reversa = v === 'reversa';
        this.osm.modoRO = reversa;
        this._osmReset();
        if (reversa) {
          // pressão inicial já acima do Δπ natural, pra reversão ficar
          // visível assim que o estudante iniciar o fluxo
          const o = this._osm();
          const pInicial = Math.max(5, Math.ceil((o.piMax + 3) / 5) * 5);
          this.osm.papl = pInicial; this.app.syncSlider('osm-papl', pInicial);
        } else {
          this.osm.papl = 0; this.app.syncSlider('osm-papl', 0);
        }
        document.getElementById('row-osm-papl').hidden = !reversa;
        const hint = document.getElementById('osm-hint');
        if (hint) hint.innerHTML = reversa
          ? 'Aumente a pressão aplicada: acima de Δπ, o fluxo se <strong>inverte</strong> e água pura sai do lado concentrado — o princípio da dessalinização.'
          : 'A água atravessa sozinha para o lado mais concentrado, até as concentrações se igualarem.';
        return { say: reversa
          ? 'Osmose reversa: uma pressão mecânica é aplicada no lado concentrado, empurrando água pura para fora dele — o princípio da dessalinização.'
          : 'Osmose direta: a água flui sozinha, sem pressão aplicada, do lado menos concentrado para o mais concentrado.' };
      }
      case 'papl': {
        this.osm.papl = v;
        const o = this._osm();
        return { say: v > o.piMax
          ? `Pressão aplicada acima da pressão osmótica: fluxo revertido — água pura sendo extraída do lado mais concentrado, como numa dessalinização.`
          : `Pressão aplicada: ${fmt(v, 1)} atm.` };
      }
      case 'gasHenry': {
        const g = this.D.GASES_HENRY.find(x => x.id === v) || this.henry.gas;
        this.henry.gas = g;
        if (!this.henry.aberto) this.henry.C = this._henryEq(g, this.henry.T, this.henry.P);
        return { say: this.henry.aberto
          ? `${g.nome} selecionado — ${g.ctx}. Com a garrafa aberta, a concentração vai se ajustar aos poucos ao novo gás, não muda de uma vez.`
          : `${g.nome} selecionado — ${g.ctx}.` };
      }
      case 'henryT': {
        this.henry.T = v;
        if (!this.henry.aberto) this.henry.C = this._henryEq(this.henry.gas, v, this.henry.P);
        return;
      }
      case 'henryP': {
        this.henry.P = v;
        if (!this.henry.aberto) this.henry.C = this._henryEq(this.henry.gas, this.henry.T, v);
        return;
      }
      case 'liquidoA': {
        const Ra = this.raoult;
        if (v === Ra.bId) Ra.bId = Ra.aId; // não faz sentido misturar um líquido com ele mesmo — troca
        Ra.aId = v; this._syncRaoultT(); this._buildRaoultGrids();
        return { say: `Líquido A: ${this._liquidosAntoine().find(l => l.id === v).nome}.` };
      }
      case 'liquidoB': {
        const Ra = this.raoult;
        if (v === Ra.aId) Ra.aId = Ra.bId;
        Ra.bId = v; this._syncRaoultT(); this._buildRaoultGrids();
        return { say: `Líquido B: ${this._liquidosAntoine().find(l => l.id === v).nome}.` };
      }
      case 'desvio': {
        this.raoult.desvio = v;
        const nomes = {
          ideal: 'ideal — segue a Lei de Raoult à risca',
          positivo: 'desvio positivo — pressão real ACIMA da reta ideal, pode formar azeótropo de ebulição mínima',
          negativo: 'desvio negativo — pressão real ABAIXO da reta ideal, pode formar azeótropo de ebulição máxima',
        };
        return { say: nomes[v] || '' };
      }
      case 'xA': this.raoult.xA = v; return;
      case 'raoultT': this.raoult.T = v; return;
      case 'vistaRaoult': {
        this.raoult.vista = v;
        this._syncRaoultVistaUI();
        const nomes = { grafico: 'gráfico de pressão de vapor', balao: 'visão balão — evaporação partícula a partícula', desafio: 'desafio da destilação' };
        return { say: `Vista: ${nomes[v] || v}.` };
      }
      case 'desafioSelect': {
        const Ra = this.raoult;
        const desafio = this.D.DESAFIOS_DESTILACAO.find(x => x.id === v) || this.D.DESAFIOS_DESTILACAO[0];
        Ra.desafioId = desafio.id; Ra.desafioXA = desafio.xA0; Ra.ciclos = 0; Ra.travado = false; Ra.historico = [desafio.xA0];
        return { say: `${desafio.nome}. ${desafio.contexto}` };
      }
    }
    return {};
  }

  action(name) {
    if (name === 'pv-status') {
      const s = this._pv();
      return announce(s.fervendo
        ? `${this.liquido.nome} fervendo: pressão de vapor ${fmt(s.pv, 1)} milímetros de mercúrio iguala ou supera a externa de ${fmt(this.patm, 0)}.`
        : `${this.liquido.nome} líquido a ${fmt(this.tpv, 0)} graus. Pressão de vapor ${fmt(s.pv, 1)} contra ${fmt(this.patm, 0)} milímetros de mercúrio externos. Fervura prevista para ${fmt(s.te, 1)} graus.`);
    }
    if (name === 'colig-status') {
      const c = this._colig();
      return announce(`Solução ${fmt(this.w, 2)} molal de ${this.soluto.nome} em ${this.solvente.nome}: ferve a ${fmt(c.te, 2)} graus e congela a ${fmt(c.tc, 2)} graus. Massa molar real ${fmt(c.Mreal, 1)}, aparente (se ignorar i) ${fmt(c.Map, 1)} g/mol.`);
    }
    if (name === 'raoult-exemplo-real') {
      const Ra = this.raoult;
      Ra.aId = 'etanol'; Ra.bId = 'agua'; Ra.desvio = 'positivo'; Ra.T = 78;
      this._buildRaoultGrids();
      this.app.syncSlider('raoult-t', 78);
      const segs = document.querySelectorAll('[data-group="desvio"] .seg-btn');
      segs.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.value === 'positivo')));
      announce('Etanol + água é um caso real bem documentado: forma um azeótropo perto de 89,5% em fração molar de etanol (95,6% em massa), fervendo a 78,2 graus — mova a fração molar de A até achar o pico da curva e compare com esse valor.', 'assertive');
    }
    if (name === 'raoult-status') {
      const r = this._raoult();
      const desvioTxt = r.Am === 0 ? 'comportamento ideal, segue a Lei de Raoult' : (r.Am > 0 ? 'desvio positivo' : 'desvio negativo');
      const azeoTxt = r.azeo ? ` Azeótropo próximo de x igual a ${fmt(r.azeo.x, 2)}, com pressão ${fmt(r.azeo.p, 0)} milímetros de mercúrio.` : '';
      return announce(`${r.A.nome} e ${r.B.nome} a ${fmt(this.raoult.T, 0)} graus: ${desvioTxt}. Pressão ideal ${fmt(r.Pideal, 0)}, pressão real ${fmt(r.Preal, 0)} milímetros de mercúrio.${azeoTxt}`, 'assertive');
    }
    if (name === 'raoult-add-a' || name === 'raoult-add-b') {
      const Ra = this.raoult;
      if (name === 'raoult-add-a') Ra.volA = clamp(Ra.volA + 10, 0, 500);
      else Ra.volB = clamp(Ra.volB + 10, 0, 500);
      const mol = this._raoultMoles();
      announce(`${name === 'raoult-add-a' ? mol.A.nome : mol.B.nome}: +10 mL. Fração molar de ${mol.A.nome} agora ${fmt(mol.xA, 2)}.`);
    }
    if (name === 'raoult-reset-balao') {
      this.raoult.volA = 50; this.raoult.volB = 50;
      announce('Balão reiniciado: 50 mL de cada líquido.');
    }
    if (name === 'raoult-desafio-destilar') {
      const Ra = this.raoult;
      const desafio = this.D.DESAFIOS_DESTILACAO.find(d => d.id === Ra.desafioId);
      const A = this.D.LIQUIDOS.find(l => l.id === desafio.aId), B = this.D.LIQUIDOS.find(l => l.id === desafio.bId);
      const Am = desafio.desvio === 'positivo' ? 1.1 : (desafio.desvio === 'negativo' ? -1.1 : 0);
      const antigo = Ra.desafioXA;
      const yA = this._raoultY(antigo, desafio.T, Am, A, B);
      Ra.desafioXA = yA; Ra.ciclos++; Ra.historico.push(yA);
      const mudou = Math.abs(yA - antigo);
      Ra.travado = mudou < 0.008 && Am !== 0;
      playTone(Ra.travado ? 260 : 760, .12, .07);
      if (Ra.travado) {
        announce(`Travado! Depois de ${Ra.ciclos} ciclos, a composição parou de mudar em ${fmt(yA * 100, 1)}% de ${A.nome} — o vapor tem a MESMA composição do líquido. Esse é o azeótropo: destilação simples não passa daqui.`, 'assertive');
      } else {
        announce(`Ciclo ${Ra.ciclos}: pureza de ${A.nome} subiu de ${fmt(antigo * 100, 1)}% para ${fmt(yA * 100, 1)}%.`);
      }
    }
    if (name === 'raoult-desafio-reset') {
      const Ra = this.raoult;
      const desafio = this.D.DESAFIOS_DESTILACAO.find(d => d.id === Ra.desafioId);
      Ra.desafioXA = desafio.xA0; Ra.ciclos = 0; Ra.travado = false; Ra.historico = [desafio.xA0];
      announce(`Desafio reiniciado: ${fmt(desafio.xA0 * 100, 0)}% de ${this.D.LIQUIDOS.find(l => l.id === desafio.aId).nome}.`);
    }
    if (name === 'osmose-run') {
      const O = this.osm;
      O.Vesq = O.V0; O.Vdir = O.V0;
      O.nesq = this.mesq * O.V0; O.ndir = this.mdir * O.V0;
      O.running = true;
      announce('Fluxo osmótico iniciado. A água atravessa a membrana para o lado mais concentrado, até as concentrações se igualarem.');
    }
    if (name === 'osmose-reset') {
      this._osmReset();
      if (this.osm.modoRO) {
        const o = this._osm();
        const pInicial = Math.max(5, Math.ceil((o.piMax + 3) / 5) * 5);
        this.osm.papl = pInicial; this.app.syncSlider('osm-papl', pInicial);
        announce('Tubo reiniciado com os níveis iguais, pressão aplicada de volta ao padrão de demonstração.');
      } else {
        this.osm.papl = 0; this.app.syncSlider('osm-papl', 0);
        announce('Tubo reiniciado com os níveis iguais e sem pressão aplicada.');
      }
    }
    if (name === 'henry-abrir') {
      const H = this.henry;
      H.aberto = !H.aberto;
      this._syncHenryUI();
      if (!H.aberto) {
        H.C = this._henryEq(H.gas, H.T, H.P);
        H.liberando = false;
        announce(`Garrafa fechada e repressurizada: ${fmt(H.P, 1)} atmosferas, concentração de equilíbrio ${fmt(H.C, 4)} mol por litro.`);
      } else {
        const alvo = this._henryEq(H.gas, H.T, 1);
        announce(H.C > alvo
          ? `Garrafa aberta! A pressão cai para 1 atmosfera e o excesso de ${H.gas.nome} escapa em bolhas até ${fmt(alvo, 4)} mol por litro.`
          : `Garrafa aberta a 1 atmosfera — a concentração já está em equilíbrio, sem bolhas.`);
      }
    }
    if (name === 'henry-reset') {
      const H = this.henry;
      H.gas = this.D.GASES_HENRY[0]; H.T = 4; H.P = 3; H.aberto = false; H.bolhas.length = 0;
      H.liberando = false;
      H.C = this._henryEq(H.gas, H.T, H.P);
      this.app.syncSlider('henry-t', 4); this.app.syncSlider('henry-p', 3);
      this._buildHenryGrid();
      this._syncHenryUI();
      announce('Garrafa reiniciada: CO₂ a 4 graus e 3 atmosferas, fechada.');
    }
  }

  /** Reinicia a dinâmica de osmose (nível igual, sem fluxo em curso). */
  _osmReset() {
    const O = this.osm;
    O.Vesq = O.V0; O.Vdir = O.V0; O.running = false;
  }

  /* ── física ── */
  _pv() {
    const L = this.liquido;
    if (L.antoine) {
      const pv = antoinePv(L.antoine, this.tpv);
      const te = antoineTe(L.antoine, this.patm);
      return { pv, te, fervendo: pv >= this.patm - 0.5 };
    }
    const pv = kInterp(L.pv, clamp(this.tpv, L.pv[0][0], L.pv[L.pv.length - 1][0]));
    // temperatura de ebulição pela pressão externa (inversa da tabela)
    let te = L.pv[L.pv.length - 1][0];
    for (let i = 1; i < L.pv.length; i++) {
      const [t0, p0] = L.pv[i - 1], [t1, p1] = L.pv[i];
      if (this.patm >= p0 && this.patm <= p1) { te = t0 + (this.patm - p0) / (p1 - p0) * (t1 - t0); break; }
    }
    return { pv, te, fervendo: pv >= this.patm - 0.5 };
  }

  _colig() {
    const S = this.solvente, i = this.soluto.i, W = this.w;
    const dte = S.Ke * W * i, dtc = S.Kc * W * i;
    // tonoscopia: fração molar do solvente (Raoult), no ponto de ebulição do solvente puro
    const xs = S.molKg / (S.molKg + W * i);
    // massa molar "aparente" — o que alguém calcularia SE esquecesse de
    // multiplicar pelo fator i (erro clássico de laboratório): como
    // ΔT = K·W·i, ignorar i faz a pessoa inferir W_aparente = i·W_real,
    // logo M_aparente = M_real / i (sai i vezes MENOR que a real).
    const Mreal = this.soluto.M, Map = Mreal / i;
    return {
      dte, dtc, te: S.Te + dte, tc: S.Tc - dtc, p: 760 * xs, dp: 760 * (1 - xs), part: W * i,
      Mreal, Map,
    };
  }

  _osm() {
    const O = this.osm, T = this.tosm + 273.15, R = this.D.R;
    const Me = O.running ? O.nesq / O.Vesq : this.mesq;
    const Md = O.running ? O.ndir / O.Vdir : this.mdir;
    const pe = Me * R * T, pd = Md * R * T;
    const d = Md - Me;
    const dpi = Math.abs(pd - pe);
    const papl = O.papl || 0;
    // pressão aplicada sempre no lado direito, opondo-se ao fluxo natural —
    // é exatamente o princípio da osmose reversa usada em dessalinização:
    // quando papl supera a pressão osmótica natural (dpi), o fluxo de água
    // se INVERTE (água pura é extraída do lado mais concentrado).
    const dEfetivo = d - papl / (R * T);
    const reversed = papl > 0 && Math.abs(d) > 1e-6 && Math.sign(dEfetivo) !== Math.sign(d || 1);
    const rel = Math.abs(dEfetivo) < 0.005 ? 'iso' : (dEfetivo > 0 ? 'dir' : 'esq');
    const desnivel = clamp((O.Vdir - O.Vesq) / (2 * O.V0), -1, 1);
    return { pe, pd, dpi, piMax: dpi, d, dEfetivo, reversed, papl, Me, Md, desnivel, rel };
  }

  _henryKH(gas, T) { return gas.kH25 * Math.exp(-gas.decaiK * (T - 25)); }
  _henryEq(gas, T, P) { return this._henryKH(gas, T) * P; }

  /** Garante que a temperatura escolhida tem dados de Antoine válidos para
   *  os DOIS líquidos ao mesmo tempo (interseção das duas faixas) — mesmo
   *  cuidado já aplicado no modo de pressão de vapor. */
  _syncRaoultT() {
    const Ra = this.raoult, A = this.D.LIQUIDOS.find(l => l.id === Ra.aId), B = this.D.LIQUIDOS.find(l => l.id === Ra.bId);
    const tmin = Math.max(A.antoine.tmin, B.antoine.tmin), tmax = Math.min(A.antoine.tmax, B.antoine.tmax);
    const tOk = clamp(Ra.T, tmin, tmax);
    if (Math.abs(tOk - Ra.T) > 0.5) { Ra.T = tOk; if (this.app) this.app.syncSlider('raoult-t', tOk); }
  }

  /** Mostra só os controles relevantes pra vista atual (gráfico/balão/
   *  desafio) — no desafio, os líquidos/desvio/temperatura ficam ocultos
   *  de propósito, pra o estudante DESCOBRIR o comportamento observando
   *  o gráfico, em vez de já saber a resposta de antemão. */
  _syncRaoultVistaUI() {
    const v = this.raoult.vista;
    const show = (id, cond) => { const el = document.getElementById(id); if (el) el.hidden = !cond; };
    show('row-raoult-exemplo', v === 'grafico');
    show('row-raoult-liquidos', v !== 'desafio');
    show('row-raoult-desvio', v !== 'desafio');
    show('row-raoult-temp', v !== 'desafio');
    show('row-raoult-grafico', v === 'grafico');
    show('row-raoult-balao', v === 'balao');
    show('row-raoult-desafio', v === 'desafio');
  }

  /** Converte as gotas (mL) de A e B da Visão Balão em mol, via
   *  densidade/massa molar de cada líquido — mesma lógica de C=m/V·MM
   *  já usada no modo Preparo, agora aplicada aos dois lados da mistura. */
  _raoultMoles() {
    const Ra = this.raoult;
    const A = this.D.LIQUIDOS.find(l => l.id === Ra.aId), B = this.D.LIQUIDOS.find(l => l.id === Ra.bId);
    const molA = Ra.volA * A.rho / A.M, molB = Ra.volB * B.rho / B.M;
    const total = molA + molB;
    return { molA, molB, xA: total > 0 ? molA / total : .5, A, B };
  }

  /** Lei de Raoult (ideal) vs modelo de Margules de 1 parâmetro (real) —
   *  simplificado para ILUSTRAR a forma do desvio (positivo/negativo) e o
   *  aparecimento de um azeótropo; não reproduz valores exatos de sistemas
   *  reais específicos, que dependem de dados experimentais de cada par. */
  _raoultP(xA, T, Am, A, B) {
    const PA0 = antoinePv(A.antoine, T), PB0 = antoinePv(B.antoine, T);
    const xB = 1 - xA;
    const gA = Math.exp(Am * xB * xB), gB = Math.exp(Am * xA * xA);
    const Preal = xA * gA * PA0 + xB * gB * PB0;
    // YA = composição do VAPOR em equilíbrio com o líquido — é isso que sai
    // primeiro na destilação (Lei de Dalton + Raoult: pA = YA·P_total = xA·γA·P°A)
    const YA = Preal > 0 ? (xA * gA * PA0) / Preal : xA;
    return { PA0, PB0, Pideal: xA * PA0 + xB * PB0, Preal, gA, gB, YA };
  }
  /** Composição do vapor (fração molar de A) em equilíbrio com o líquido —
   *  usada tanto na Visão Balão (cor do vapor) quanto no Desafio da
   *  Destilação (pra onde a composição "salta" a cada ciclo). */
  _raoultY(xA, T, Am, A, B) { return this._raoultP(xA, T, Am, A, B).YA; }
  _raoult() {
    const Ra = this.raoult;
    const A = this.D.LIQUIDOS.find(l => l.id === Ra.aId), B = this.D.LIQUIDOS.find(l => l.id === Ra.bId);
    const Am = Ra.desvio === 'positivo' ? 1.1 : (Ra.desvio === 'negativo' ? -1.1 : 0);
    const atual = this._raoultP(Ra.xA, Ra.T, Am, A, B);
    // varredura pra achar o azeótropo (extremo de Preal no interior do intervalo)
    let azeo = null;
    if (Am !== 0) {
      let best = null;
      for (let x = 0.02; x <= 0.98; x += 0.01) {
        const p = this._raoultP(x, Ra.T, Am, A, B).Preal;
        if (!best || (Am > 0 ? p > best.p : p < best.p)) best = { x, p };
      }
      // só conta como azeótropo se for de fato um extremo interno (não a borda)
      if (best && best.x > 0.03 && best.x < 0.97) azeo = best;
    }
    // referência real documentada: etanol+água forma um azeótropo bem
    // estudado a ≈89,5% em fração molar de etanol (95,6% em massa), a
    // 78,2 °C — usada aqui só como conferência de que o modelo simplificado
    // captura a ORDEM DE GRANDEZA certa, não como dado exato de outros pares
    let realRef = null;
    const parEtanolAgua = (Ra.aId === 'etanol' && Ra.bId === 'agua') || (Ra.aId === 'agua' && Ra.bId === 'etanol');
    if (parEtanolAgua && Am > 0) {
      const xEtanolReal = Ra.aId === 'etanol' ? 0.895 : 1 - 0.895;
      realRef = { xA: xEtanolReal, fonte: 'documentado: ≈95,6% em massa de etanol, ferve a 78,2 °C' };
    }
    return { A, B, Am, xA: Ra.xA, xB: 1 - Ra.xA, ...atual, azeo, realRef };
  }

  /* ── animação ── */
  update(dt, app) {
    this.fase += dt;
    if (this.modo === 'pvap') {
      const s = this._pv();
      const box = { x: -60, y: -110, w: 120, h: 110 };
      const taxa = s.fervendo ? 45 : (s.pv / this.patm) * 8;
      kBubbles(this.bolhas, dt, box, taxa, { vy: s.fervendo ? 70 : 30 });
    } else if (this.modo === 'osmose' && this.osm.running) {
      const O = this.osm;
      const Me = O.nesq / O.Vesq, Md = O.ndir / O.Vdir;
      const T = this.tosm + 273.15, R = this.D.R;
      const kPerm = 0.18;
      // a pressão aplicada (osmose reversa) se opõe ao fluxo natural —
      // convertida para a mesma unidade de concentração via π=MRT
      const dEfetivo = (Md - Me) - (O.papl || 0) / (R * T);
      const fluxo = kPerm * dEfetivo;
      const Vmin = O.V0 * 0.12, Vmax = 2 * O.V0 - Vmin;
      O.Vesq = clamp(O.Vesq - fluxo * dt, Vmin, Vmax);
      O.Vdir = clamp(2 * O.V0 - O.Vesq, Vmin, Vmax);
    } else if (this.modo === 'henry') {
      const H = this.henry;
      const alvo = H.aberto ? this._henryEq(H.gas, H.T, 1) : this._henryEq(H.gas, H.T, H.P);
      const tau = 2.2;
      const antesC = H.C;
      H.C += (alvo - H.C) * (1 - Math.exp(-dt / Math.max(0.05, tau)));
      const taxaLiberacao = Math.max(0, (antesC - H.C) / Math.max(dt, 1e-6));
      H.liberando = H.aberto && taxaLiberacao > 1e-5;
      const box = { x: -46, y: -6, w: 92, h: 6 };
      const taxaBolhas = H.aberto ? clamp(taxaLiberacao * 5200, 0, 55) : 0;
      kBubbles(H.bolhas, dt, box, taxaBolhas, { vy: 46, topo: -150 });
    }
  }

  /* ── desenho ── */
  draw(ctx, W, H, app) {
    if (this.modo === 'pvap') this._drawPv(ctx, W, H);
    else if (this.modo === 'colig') this._drawColig(ctx, W, H);
    else if (this.modo === 'henry') this._drawHenry(ctx, W, H, app);
    else if (this.modo === 'raoult') this._drawRaoult(ctx, W, H);
    else this._drawOsm(ctx, W, H);
  }

  _drawPv(ctx, W, H) {
    const s = this._pv(), L = this.liquido;
    // gráfico ocupando toda a área do canvas — mesma proporção do modo
    // "Curvas de Solubilidade"; o béquer+termômetro foi para a barra lateral.
    const gw = W - 104, gh = H - 88;
    const A = kAxes(ctx, {
      x: 58, y: 24, w: gw, h: gh, xmin: 0, xmax: 110, ymin: 0, ymax: 820,
      xticks: [0, 20, 40, 60, 80, 100], yticks: [0, 200, 400, 600, 760],
      xlab: 'Temperatura (°C)', ylab: 'Pressão de vapor (mmHg)',
    });

    // recorta as curvas à área do gráfico — sem isso, líquidos mais voláteis
    // (cuja pressão de vapor dispara bem acima de 820 mmHg antes dos 110 °C)
    // desenhavam a linha para FORA da área do eixo Y, por cima dos rótulos.
    const gx0 = 58, gy0 = 24;
    ctx.save();
    ctx.beginPath(); ctx.rect(gx0, gy0, gw, gh); ctx.clip();
    this.D.LIQUIDOS.forEach((l, i) => {
      const on = l.id === L.id;
      const curva = liquidCurve(l, 110);
      ctx.globalAlpha = on ? 1 : .3;
      kLine(ctx, curva, A.px, A.py, { color: l.cor, w: on ? 2.6 : 1.4 });
      ctx.globalAlpha = 1;
    });
    ctx.restore();

    // rótulos: posição "natural" no último ponto AINDA dentro da faixa
    // visível do eixo Y (≤800 mmHg) — depois resolve colisões de verdade
    // (ordena por x e empurra pra cima qualquer par que fique perto demais),
    // em vez de um escalonamento fixo que não escala com o número de líquidos
    const rotulos = this.D.LIQUIDOS.map(l => {
      const on = l.id === L.id;
      const curva = liquidCurve(l, 110);
      let labelPt = curva[0];
      for (let k = 0; k < curva.length; k++) if (curva[k][1] <= 800) labelPt = curva[k];
      return { l, on, x: A.px(labelPt[0]) - 4, y: A.py(Math.min(labelPt[1], 800)) - 12 };
    });
    rotulos.sort((a, b) => a.x - b.x);
    // relaxamento em várias passadas: resolve aglomerados de 3+ rótulos
    // próximos, não só pares — o anterior só comparava com um vizinho
    // por vez e podia deixar um terceiro rótulo colidindo.
    for (let pass = 0; pass < 5; pass++) {
      for (let i = 0; i < rotulos.length; i++) {
        for (let j = 0; j < rotulos.length; j++) {
          if (i === j) continue;
          const dx = Math.abs(rotulos[i].x - rotulos[j].x), dy = rotulos[i].y - rotulos[j].y;
          if (dx < 60 && Math.abs(dy) < 20 && dy >= 0) rotulos[i].y = rotulos[j].y - 22;
        }
      }
    }
    rotulos.forEach(r => kLabel(ctx, r.l.nome, r.x, r.y, { size: 10, color: r.l.cor, align: 'right', bold: r.on }));

    // linha da pressão externa
    ctx.save();
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = cssVar('--accent-amber', '#fbbf24');
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(A.px(0), A.py(this.patm)); ctx.lineTo(A.px(110), A.py(this.patm)); ctx.stroke();
    ctx.restore();
    kChip(ctx, `P externa ${fmt(this.patm, 0)} mmHg`, A.px(110) - 66, A.py(this.patm) - 12,
      { fg: cssVar('--accent-amber'), size: 10 });

    // ponto atual + ebulição prevista
    ctx.fillStyle = L.cor;
    ctx.beginPath(); ctx.arc(A.px(this.tpv), A.py(s.pv), 6, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = cssVar('--accent-ok', '#4ade80');
    ctx.beginPath(); ctx.moveTo(A.px(s.te), A.py(this.patm)); ctx.lineTo(A.px(s.te), A.py(0)); ctx.stroke();
    ctx.restore();
    kChip(ctx, `Te ${fmt(s.te, 1)} °C`, A.px(s.te), A.py(0) + 24, { fg: cssVar('--accent-ok'), size: 11, bold: true });
  }

  /** Béquer + termômetro do líquido selecionado — desenhado num CANVAS
   *  separado, na barra lateral (não mais na área central), para deixar
   *  o gráfico de pressão de vapor ocupar o canvas inteiro. */
  _drawPvMini(ctx, w, h) {
    const s = this._pv(), L = this.liquido;
    ctx.clearRect(0, 0, w, h);
    const cx = w * .36, by = h - 18;
    ctx.save(); ctx.translate(cx, by);
    const bw = Math.min(w * .5, 96), bh = Math.min(h * .56, 110);
    const box = kBeaker(ctx, 0, -bh, bw, bh, .72, L.cor, { alpha: .55, rotulo: L.nome });
    kDrawBubbles(ctx, this.bolhas, 'rgba(255,255,255,.7)');
    if (s.fervendo) kFlame(ctx, 0, 6, .8, this.fase);
    const proximidade = clamp(s.pv / this.patm, 0, 1);
    if (!isReduced()) {
      if (s.fervendo) {
        kSteam(ctx, -14, box.surfaceY - 2, this.fase, cssVar('--text-secondary'));
        kSteam(ctx, 14, box.surfaceY - 2, this.fase + 1.1, cssVar('--text-secondary'));
      } else if (proximidade > 0.4) {
        ctx.save(); ctx.globalAlpha = (proximidade - 0.4) / 0.6;
        kSteam(ctx, 0, box.surfaceY - 2, this.fase, cssVar('--text-secondary'));
        ctx.restore();
      }
    }
    ctx.restore();
    kThermo(ctx, cx + bw * .72 + 22, by - bh + 6, bh + 6, this.tpv, 0, 110, { color: L.cor });
    kChip(ctx, s.fervendo ? 'FERVENDO' : 'líquido', cx, by + 16,
      { fg: s.fervendo ? cssVar('--accent-exo', '#f87171') : cssVar('--text-secondary'), bold: true, size: 11 });
  }

  _drawColig(ctx, W, H) {
    const c = this._colig(), S = this.solvente;
    const cx = W / 2;
    // três termômetros: solvente puro, ebulição da solução, congelamento —
    // faixa dinâmica porque cada solvente tem Te/Tc bem diferentes (água:
    // 0–100 °C · cânfora: 176–204 °C). Posições e altura em FRAÇÃO do
    // canvas (não mais pixels fixos), para aproveitar telas largas/altas.
    const y0 = H * .16, hh = clamp(H * .52, 170, 380);
    const tmin = Math.min(-12, S.Tc - 20), tmax = Math.max(112, S.Te + 20);
    kLabel(ctx, `${S.nome} pura × solução`, cx, H * .05, { size: 13, bold: true, color: cssVar('--text-primary') });

    const passo = clamp(W * .13, 90, 190);
    const cols = [
      { x: cx - passo * 1.5, t: S.Te, tmin, tmax, rot: `${S.nome} pura ferve`, cor: cssVar('--accent-exo', '#f87171') },
      { x: cx - passo * .4, t: c.te, tmin, tmax, rot: 'solução ferve', cor: cssVar('--accent-exo', '#f87171') },
      { x: cx + passo * .7, t: S.Tc, tmin, tmax, rot: `${S.nome} pura congela`, cor: cssVar('--accent-cyan', '#22d3ee') },
      { x: cx + passo * 1.8, t: c.tc, tmin, tmax, rot: 'solução congela', cor: cssVar('--accent-cyan', '#22d3ee') },
    ];
    cols.forEach(col => {
      if (col.x < 30 || col.x > W - 30) return;
      kThermo(ctx, col.x, y0, hh, col.t, col.tmin, col.tmax, { color: col.cor, casas: 2, escala: false });
      kLabel(ctx, col.rot, col.x, y0 + hh + 22, { size: 10, color: cssVar('--text-secondary'), maxW: 100 });
      // pistas visuais do estado físico: vapor sobre quem ferve, floco sobre quem congela
      if (col.rot.includes('ferve')) kSteam(ctx, col.x, y0 - 6, isReduced() ? 0 : this.fase, col.cor);
      else kSnowflake(ctx, col.x, y0 - 10, 7, col.cor);
    });

    // setas de deslocamento ligando PURO → SOLUÇÃO, na altura exata do
    // mercúrio de cada um — o "antes/depois" fica visível de cara, não só
    // como números em separado nos dois termômetros
    if (cols[0].x >= 30 && cols[1].x <= W - 30) {
      const y1 = thermoValueY(y0, hh, cols[0].tmin, cols[0].tmax, cols[0].t);
      const y2 = thermoValueY(y0, hh, cols[1].tmin, cols[1].tmax, cols[1].t);
      kArrow(ctx, cols[0].x + 13, y1, cols[1].x - 13, y2, { color: cssVar('--accent-exo', '#f87171'), w: 2.2 });
    }
    if (cols[2].x >= 30 && cols[3].x <= W - 30) {
      const y3 = thermoValueY(y0, hh, cols[2].tmin, cols[2].tmax, cols[2].t);
      const y4 = thermoValueY(y0, hh, cols[3].tmin, cols[3].tmax, cols[3].t);
      kArrow(ctx, cols[2].x + 13, y3, cols[3].x - 13, y4, { color: cssVar('--accent-cyan', '#22d3ee'), w: 2.2 });
    }

    // divisor entre o grupo de ebulição e o de congelamento, com rótulos de grupo
    const midX = (cols[1].x + cols[2].x) / 2;
    if (midX > 30 && midX < W - 30) {
      ctx.save(); ctx.strokeStyle = cssVar('--border'); ctx.setLineDash([3, 4]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(midX, y0 - 22); ctx.lineTo(midX, y0 + hh + 34); ctx.stroke();
      ctx.restore();
    }
    kLabel(ctx, 'PONTO DE EBULIÇÃO', (cols[0].x + cols[1].x) / 2, y0 - 26, { size: 9, bold: true, color: cssVar('--text-muted') });
    kLabel(ctx, 'PONTO DE CONGELAMENTO', (cols[2].x + cols[3].x) / 2, y0 - 26, { size: 9, bold: true, color: cssVar('--text-muted') });

    // faixa de deslocamento
    const yb = y0 + hh + 46;
    kChip(ctx, `ΔTe = +${fmt(c.dte, 2)} °C`, cols[0].x + passo * .55, yb, { fg: cssVar('--accent-exo', '#f87171'), bold: true });
    kChip(ctx, `ΔTc = −${fmt(c.dtc, 2)} °C`, cols[2].x + passo * .55, yb, { fg: cssVar('--accent-cyan', '#22d3ee'), bold: true });

    // partículas do soluto no líquido — béquer maior, também proporcional
    const px = clamp(W * .1, 70, 140);
    if (px > 20 && cols[0].x - px > 50) {
      const bw = clamp(W * .1, 70, 110), bh = clamp(H * .3, 100, 180);
      const n = Math.round(clamp(c.part * 8, 0, 60));
      ctx.save(); ctx.translate(px, y0 + hh * .55);
      kBeaker(ctx, 0, -bh * .9, bw, bh, .7, cssVar('--accent-primary', '#60a5fa'), { alpha: .3, rotulo: 'solução' });
      for (let i = 0; i < n; i++) {
        const a = i * 2.399 + this.fase * .25;
        const rr = (bw * .1) + (i % 7) * (bw * .055);
        ctx.fillStyle = this.soluto.dot;
        ctx.globalAlpha = .85;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * rr, -bh * .42 + Math.sin(a * 1.3) * (bh * .24), 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.restore();
      kChip(ctx, `${fmt(c.part, 2)} mol/kg de partículas`, px, y0 + hh * .55 + 26, { size: 10 });
      kChip(ctx, `M real ${fmt(c.Mreal, 1)} × M aparente ${fmt(c.Map, 1)} g/mol`, px, y0 + hh * .55 + 46,
        { size: 9, fg: this.soluto.i > 1 ? cssVar('--accent-amber') : cssVar('--text-secondary') });
    }
  }

  _drawOsm(ctx, W, H) {
    const o = this._osm();
    // tubo bem maior — usa a maior parte do canvas disponível, em vez de
    // ficar pequeno no meio de uma área vazia
    const cx = W / 2;
    const tw = clamp(W * .1, 76, 150), gap = clamp(W * .04, 32, 70), hcol = Math.min(H - 150, 380);
    const topY = Math.max(56, H * .1);
    const dn = o.desnivel * clamp(hcol * .14, 22, 40);

    // tubo em U
    ctx.save();
    ctx.strokeStyle = cssVar('--glass', 'rgba(148,163,184,.38)');
    ctx.lineWidth = 2.6;
    const lx = cx - gap / 2 - tw, rx = cx + gap / 2;
    const bot = topY + hcol;
    ctx.beginPath();
    ctx.moveTo(lx, topY); ctx.lineTo(lx, bot - 10);
    ctx.quadraticCurveTo(lx, bot, lx + 12, bot);
    ctx.lineTo(rx + tw - 12, bot);
    ctx.quadraticCurveTo(rx + tw, bot, rx + tw, bot - 10);
    ctx.lineTo(rx + tw, topY);
    ctx.stroke();
    ctx.beginPath(); ctx.moveTo(lx + tw, topY); ctx.lineTo(lx + tw, bot - 30); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(rx, topY); ctx.lineTo(rx, bot - 30); ctx.stroke();
    ctx.restore();

    // líquidos
    const nivelBase = topY + hcol * .26;
    const yE = nivelBase + dn, yD = nivelBase - dn;
    const azul = cssVar('--accent-primary', '#60a5fa');
    ctx.save();
    ctx.globalAlpha = .5;
    ctx.fillStyle = kMix(azul, '#ffffff', clamp(1 - o.Me, 0, 1) * .35);
    ctx.fillRect(lx + 2, yE, tw - 4, bot - yE - 2);
    ctx.fillStyle = kMix(azul, '#ffffff', clamp(1 - o.Md, 0, 1) * .35);
    ctx.fillRect(rx + 2, yD, tw - 4, bot - yD - 2);
    ctx.globalAlpha = .5;
    ctx.fillRect(lx + 2, bot - 26, (rx + tw) - lx - 4, 24);
    ctx.restore();

    // membrana no fundo, no centro — com "poros" para reforçar que é semipermeável
    ctx.save();
    ctx.strokeStyle = cssVar('--accent-amber', '#fbbf24');
    ctx.setLineDash([4, 3]);
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(cx, bot - 30); ctx.lineTo(cx, bot - 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth = 1;
    for (let yy = bot - 4; yy >= bot - 28; yy -= 6) {
      ctx.beginPath(); ctx.moveTo(cx - 3, yy); ctx.lineTo(cx + 3, yy); ctx.stroke();
    }
    ctx.restore();

    // partículas de soluto presas de cada lado
    const desenhaSoluto = (x0, m, y) => {
      const n = Math.round(m * 26);
      ctx.fillStyle = cssVar('--accent-secondary', '#a78bfa');
      for (let i = 0; i < n; i++) {
        const a = i * 2.399 + this.fase * .3;
        ctx.beginPath();
        ctx.arc(x0 + tw / 2 + Math.cos(a) * (tw / 2 - 12),
          y + 24 + ((i * 17) % Math.max(10, bot - y - 40)), 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    desenhaSoluto(lx, o.Me, yE);
    desenhaSoluto(rx, o.Md, yD);

    // pistão de pressão aplicada (osmose reversa) — empurra o lado direito
    if (o.papl > 0) {
      const pistonY = topY + 4 + clamp(o.papl / 40, 0, 1) * 12;
      ctx.save();
      ctx.fillStyle = cssVar('--text-muted');
      ctx.fillRect(rx + 4, pistonY, tw - 8, 7);
      ctx.strokeStyle = cssVar('--accent-exo', '#f87171'); ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const px = rx + tw * .22 + i * tw * .28;
        ctx.beginPath(); ctx.moveTo(px, pistonY - 15); ctx.lineTo(px, pistonY - 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(px - 4, pistonY - 7); ctx.lineTo(px, pistonY - 2); ctx.lineTo(px + 4, pistonY - 7); ctx.stroke();
      }
      ctx.restore();
      kChip(ctx, `${fmt(o.papl, 1)} atm aplicada`, rx + tw / 2, pistonY + 20, { size: 10, fg: cssVar('--accent-exo') });
    }
    if (o.reversed) {
      kLabel(ctx, 'OSMOSE REVERSA — água pura sendo extraída do lado concentrado', cx, topY - 32,
        { size: 11, bold: true, color: cssVar('--accent-exo', '#f87171') });
    }

    // fluxo de água atravessando a membrana — pontinhos em movimento contínuo,
    // não uma seta estática, para deixar claro que é um processo em curso
    if (o.rel !== 'iso') {
      const dir = o.rel === 'dir' ? 1 : -1;
      const yFlow = bot - 16;
      const pts = dir === 1 ? [[cx - 26, yFlow], [cx + 26, yFlow]] : [[cx + 26, yFlow], [cx - 26, yFlow]];
      kFlowDots(ctx, pts, isReduced() ? 0 : this.fase * .5, 3, o.reversed ? cssVar('--accent-exo', '#f87171') : cssVar('--accent-ok', '#4ade80'), { r: 2.4 });
    }

    // só UM rótulo por região — o estado geral (isotônico/hipertônico) já
    // aparece no rótulo do canvas (overlay HTML), então aqui ficam só os
    // dados específicos de cada coluna e da membrana, sem repetir a mesma
    // informação duas vezes
    kChip(ctx, `${fmt(o.Me, 2)} mol/L · π ${fmt(o.pe, 2)} atm`, lx + tw / 2, topY - 18, { size: 11 });
    kChip(ctx, `${fmt(o.Md, 2)} mol/L · π ${fmt(o.pd, 2)} atm`, rx + tw / 2, topY - 18, { size: 11 });
    kLabel(ctx, 'membrana semipermeável', cx, bot + 20, { size: 10, color: cssVar('--accent-amber') });
  }

  _drawHenry(ctx, W, H, app) {
    const K = this.henry, g = K.gas;
    // garrafa e gráfico bem maiores — usam proporções do canvas, não mais
    // um tamanho fixo pequeno perdido numa área grande e vazia
    const cx = clamp(W * .24, 100, 190), topY = H * .14, bw = clamp(W * .2, 110, 190), bh = Math.min(H * .62, 320);
    const Patual = K.aberto ? 1 : K.P;
    ctx.save(); ctx.translate(cx, 0);
    const box = kBeaker(ctx, 0, topY, bw, bh, .68, g.cor, { alpha: .18 + .55 * clamp(K.C / (g.kH25 * 10), 0, 1), rotulo: g.nome });
    // gás dissolvido: pontinhos numerosos e praticamente parados (só um leve
    // tremor browniano), com densidade proporcional a C — bem diferente das
    // bolhas grandes que sobem e escapam quando a garrafa está aberta.
    const nMicro = clamp(Math.round(K.C / g.kH25 * 14), 3, 46);
    const fz = isReduced() ? 0 : this.fase;
    ctx.save(); ctx.fillStyle = '#ffffff';
    for (let i = 0; i < nMicro; i++) {
      const seed = i * 7.319;
      const jx = Math.sin(fz * 1.3 + seed) * 2, jy = Math.cos(fz * 1.1 + seed * 1.7) * 2;
      const mx = Math.sin(seed) * (bw * .32) + jx;
      const my = box.y + 6 + (Math.cos(seed * 2.1) * .5 + .5) * (box.h - 12) + jy;
      ctx.globalAlpha = .3 + .25 * Math.sin(seed * 3);
      ctx.beginPath(); ctx.arc(mx, my, 1.3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    kDrawBubbles(ctx, K.bolhas, 'rgba(255,255,255,.75)');
    ctx.save();
    ctx.globalAlpha = clamp(Patual / 6, .08, .5);
    ctx.fillStyle = g.cor;
    ctx.beginPath(); ctx.ellipse(0, topY - 2, bw * .42, 13, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = cssVar('--glass'); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-14, topY - 18); ctx.lineTo(-14, topY - 30); ctx.lineTo(14, topY - 30); ctx.lineTo(14, topY - 18); ctx.stroke();
    if (!K.aberto) { ctx.fillStyle = cssVar('--accent-amber'); ctx.fillRect(-16, topY - 34, 32, 8); }
    ctx.restore();
    ctx.restore();
    kChip(ctx, K.aberto ? 'ABERTA · 1 atm' : `FECHADA · ${fmt(K.P, 1)} atm`, cx, topY + bh + 26,
      { fg: K.aberto ? cssVar('--accent-ok') : cssVar('--accent-amber'), bold: true, size: 11 });
    if (K.liberando) kChip(ctx, 'liberando gás…', cx, topY + bh + 46, { fg: cssVar('--accent-exo'), size: 10 });

    const gx = W * .48, gy = H * .1, gw = Math.min(W * .46, 440), gh = Math.min(H - 130, 340);
    const kH = this._henryKH(g, K.T), pmax = 12;
    const A = kAxes(ctx, {
      x: gx, y: gy, w: gw, h: gh, xmin: 0, xmax: pmax, ymin: 0, ymax: kH * pmax * 1.18,
      xticks: [0, 2, 4, 6, 8, 10, 12], yticks: [0, kH * 4, kH * 8, kH * 12].map(v => Number(v.toFixed(6))),
      xlab: 'Pressão (atm)', ylab: 'C dissolvida (mol/L)', fmty: v => fmt(v * 1000, 1),
    });
    const pts = []; for (let p = 0; p <= pmax; p += .25) pts.push([p, kH * p]);
    kLine(ctx, pts, A.px, A.py, { color: g.cor, w: 2.6 });
    // só o marcador do ponto atual — o valor exato de C já está no painel de
    // resultados e no rótulo do topo do canvas, então não repetimos aqui
    ctx.save(); ctx.fillStyle = g.cor;
    ctx.beginPath(); ctx.arc(A.px(Patual), A.py(K.C), 5.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    kLabel(ctx, `escala do eixo Y ×10⁻³ mol/L · kH a ${fmt(K.T, 0)} °C = ${fmt(kH * 1000, 2)}×10⁻³`, gx + gw / 2, gy + gh + 30,
      { size: 10, color: cssVar('--text-secondary') });
  }

  _drawRaoult(ctx, W, H) {
    if (this.raoult.vista === 'balao') return this._drawRaoultBalao(ctx, W, H);
    if (this.raoult.vista === 'desafio') return this._drawRaoultDesafio(ctx, W, H);
    const r = this._raoult();
    const pmax = Math.max(r.PA0, r.PB0) * 1.35;
    const gw = W - 104, gh = H - 118;

    // legenda explicativa em linguagem simples — muda conforme o tipo de
    // desvio, pra deixar claro ANTES de olhar o gráfico o que está em jogo
    const explicacao = r.Am === 0
      ? `${r.A.nome} e ${r.B.nome} interagem entre si igual a como interagem consigo mesmas — mistura ideal, segue Raoult à risca.`
      : (r.Am > 0
        ? `${r.A.nome} e ${r.B.nome} se atraem MENOS entre si do que consigo mesmas — "preferem" escapar, então a pressão real fica ACIMA do previsto.`
        : `${r.A.nome} e ${r.B.nome} se atraem MAIS entre si do que consigo mesmas — "preferem" ficar líquidas, então a pressão real fica ABAIXO do previsto.`);
    kLabel(ctx, explicacao, W / 2, 16, { size: 11, bold: true, color: cssVar('--text-primary'), maxW: gw + 60 });

    const m = kAxes(ctx, {
      x: 58, y: 46, w: gw, h: gh, xmin: 0, xmax: 1, ymin: 0, ymax: pmax,
      xticks: [0, .25, .5, .75, 1], yticks: [0, pmax * .25, pmax * .5, pmax * .75, pmax],
      xlab: `fração molar de ${r.A.nome} (x)`, ylab: 'Pressão de vapor (mmHg)',
    });

    // reta ideal (Lei de Raoult) — sempre uma linha reta entre P°B (x=0) e P°A (x=1)
    ctx.save(); ctx.setLineDash([5, 4]);
    kLine(ctx, [[0, r.PB0], [1, r.PA0]], m.px, m.py, { color: cssVar('--text-muted'), w: 1.8 });
    ctx.setLineDash([]); ctx.restore();
    kLabel(ctx, 'previsão ideal (Raoult)', m.px(.5), m.py((r.PA0 + r.PB0) / 2) - 10, { size: 10, color: cssVar('--text-muted') });

    // curva real (ideal, positiva ou negativa) — recortada à área do gráfico
    // por segurança, mesmo cuidado do modo de pressão de vapor
    const curvaReal = [];
    for (let x = 0; x <= 1.0001; x += 0.02) curvaReal.push([Math.min(x, 1), this._raoultP(Math.min(x, 1), this.raoult.T, r.Am, r.A, r.B).Preal]);
    ctx.save();
    ctx.beginPath(); ctx.rect(58, 46, gw, gh); ctx.clip();
    kLine(ctx, curvaReal, m.px, m.py, { color: cssVar('--accent-primary', '#60a5fa'), w: 2.8 });
    ctx.restore();
    kLabel(ctx, 'realidade medida', m.px(.5), m.py(this._raoultP(.5, this.raoult.T, r.Am, r.A, r.B).Preal) + (r.Am >= 0 ? 16 : -14),
      { size: 10, color: cssVar('--accent-primary'), bold: true });

    // pontos dos líquidos puros
    kLabel(ctx, `${r.B.nome} pura`, m.px(0) + 4, m.py(r.PB0) - 10, { size: 10, align: 'left', color: r.B.cor, bold: true });
    kLabel(ctx, `${r.A.nome} pura`, m.px(1) - 4, m.py(r.PA0) - 10, { size: 10, align: 'right', color: r.A.cor, bold: true });

    // azeótropo, se existir — caixa de explicação, não só um chip pequeno
    if (r.azeo) {
      ctx.save(); ctx.fillStyle = cssVar('--accent-amber', '#fbbf24');
      ctx.beginPath(); ctx.arc(m.px(r.azeo.x), m.py(r.azeo.p), 6, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      const ladoDir = r.azeo.x > .6;
      const bx = m.px(r.azeo.x) + (ladoDir ? -8 : 8);
      const by = m.py(r.azeo.p) + (r.Am > 0 ? -46 : 34);
      kChip(ctx, `azeótropo em x≈${fmt(r.azeo.x, 2)}`, bx, by, { fg: cssVar('--accent-amber'), bold: true, size: 11, border: cssVar('--accent-amber'), align: ladoDir ? 'right' : 'left' });
      kLabel(ctx, 'aqui destilar não separa mais os líquidos', bx, by + 16,
        { size: 9, color: cssVar('--accent-amber'), align: ladoDir ? 'right' : 'left' });
    }
    // referência real documentada (etanol+água): uma linha fina mostrando
    // onde o azeótropo REAL fica, pra comparar com o previsto pelo modelo
    if (r.realRef) {
      ctx.save(); ctx.setLineDash([2, 3]); ctx.strokeStyle = cssVar('--accent-ok', '#4ade80'); ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(m.px(r.realRef.xA), m.py(0)); ctx.lineTo(m.px(r.realRef.xA), m.py(pmax * .18)); ctx.stroke();
      ctx.setLineDash([]); ctx.restore();
      kLabel(ctx, `valor real: x≈${fmt(r.realRef.xA, 2)}`, m.px(r.realRef.xA), m.py(pmax * .18) + 14,
        { size: 9, color: cssVar('--accent-ok'), bold: true });
    }

    // composição atual — guia pontilhada + marcador
    ctx.save(); ctx.setLineDash([3, 3]); ctx.strokeStyle = cssVar('--text-muted'); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(m.px(r.xA), m.py(0)); ctx.lineTo(m.px(r.xA), m.py(r.Preal)); ctx.stroke();
    ctx.setLineDash([]); ctx.restore();
    ctx.save(); ctx.fillStyle = cssVar('--accent-ok', '#4ade80');
    ctx.beginPath(); ctx.arc(m.px(r.xA), m.py(r.Preal), 6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.save(); ctx.fillStyle = cssVar('--text-secondary');
    ctx.beginPath(); ctx.arc(m.px(r.xA), m.py(r.Pideal), 4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    const desvioTxt = r.Am === 0 ? 'ideal — segue Raoult' : (r.Am > 0 ? 'desvio positivo' : 'desvio negativo');
    kLabel(ctx, `x=${fmt(r.xA, 2)} · P real ${fmt(r.Preal, 0)} mmHg · P ideal ${fmt(r.Pideal, 0)} mmHg · ${desvioTxt}`,
      m.px(.5), m.py(0) + 30, { size: 11, color: cssVar('--text-secondary') });
  }

  /** MECÂNICA 1 — Visão Balão: em vez de olhar só pro gráfico, o estudante
   *  monta a mistura pingando mL de cada líquido (convertidos em mol via
   *  densidade/massa molar) num balão FECHADO, e vê partículas líquidas e
   *  de vapor — a cor do vapor reflete Yₐ, a composição real do vapor em
   *  equilíbrio (o que sairia primeiro numa destilação). */
  _drawRaoultBalao(ctx, W, H) {
    const Ra = this.raoult;
    const mol = this._raoultMoles();
    const Am = Ra.desvio === 'positivo' ? 1.1 : (Ra.desvio === 'negativo' ? -1.1 : 0);
    const r = this._raoultP(mol.xA, Ra.T, Am, mol.A, mol.B);
    const cx = clamp(W * .3, 140, 230), topY = H * .16, bw = clamp(W * .26, 150, 230), bh = Math.min(H * .58, 300);

    kLabel(ctx, `Balão fechado: ${mol.A.nome} + ${mol.B.nome} a ${fmt(Ra.T, 0)} °C`, W / 2, 18,
      { size: 12, bold: true, color: cssVar('--text-primary') });

    ctx.save(); ctx.translate(cx, 0);
    const corLiquido = kMix(mol.A.cor, mol.B.cor, mol.xA);
    const box = kBeaker(ctx, 0, topY, bw, bh, .48, corLiquido, { alpha: .4, rotulo: `x_A = ${fmt(mol.xA, 2)}` });

    // partículas líquidas: nº proporcional aos mols de cada componente
    const nLiq = 46, nLiqA = Math.round(nLiq * mol.xA);
    ctx.save();
    for (let i = 0; i < nLiq; i++) {
      const seed = i * 12.9898;
      const px = Math.sin(seed) * (bw * .38);
      const py = box.y + box.h * .25 + (Math.cos(seed * 2.1) * .5 + .5) * (box.h * .68);
      ctx.fillStyle = i < nLiqA ? mol.A.cor : mol.B.cor;
      ctx.globalAlpha = .8;
      ctx.beginPath(); ctx.arc(px, py, 2.2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    // vapor no espaço selado acima do líquido — quantidade ∝ pressão total,
    // MISTURA de cores ∝ Yₐ (não é a mesma proporção do líquido!)
    const fz = isReduced() ? 0 : this.fase;
    const nVapor = clamp(Math.round(r.Preal / 10), 4, 60);
    const nVaporA = Math.round(nVapor * r.YA);
    ctx.save();
    for (let i = 0; i < nVapor; i++) {
      const seed = i * 7.319 + 100;
      const jx = Math.sin(fz * 1.2 + seed) * 4, jy = Math.cos(fz * 1.4 + seed * 1.6) * 4;
      const px = Math.sin(seed) * (bw * .42) + jx;
      const py = topY + 10 + (Math.cos(seed * 2.3) * .5 + .5) * (box.y - topY - 8) + jy;
      ctx.fillStyle = i < nVaporA ? mol.A.cor : mol.B.cor;
      ctx.globalAlpha = .55;
      ctx.beginPath(); ctx.arc(px, py, 1.8, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    // selo do balão (fechado — nada escapa, só redistribui entre líquido e vapor)
    ctx.save();
    ctx.strokeStyle = cssVar('--glass'); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-14, topY - 4); ctx.lineTo(-14, topY - 20); ctx.lineTo(14, topY - 20); ctx.lineTo(14, topY - 4); ctx.stroke();
    ctx.fillStyle = cssVar('--accent-amber'); ctx.fillRect(-16, topY - 24, 32, 8);
    ctx.restore();
    ctx.restore();

    // legendas de cor + composição do vapor vs líquido, lado a lado
    const gx = W * .62, gy = H * .18;
    kChip(ctx, `${mol.A.nome}`, gx, gy, { fg: mol.A.cor, bold: true, size: 12, border: mol.A.cor });
    kChip(ctx, `${mol.B.nome}`, gx + 130, gy, { fg: mol.B.cor, bold: true, size: 12, border: mol.B.cor });
    kLabel(ctx, `líquido: x_A = ${fmt(mol.xA, 2)}  ·  vapor: Y_A = ${fmt(r.YA, 2)}`, gx + 60, gy + 32,
      { size: 12, bold: true, color: cssVar('--text-primary') });
    const destaque = r.YA > mol.xA + 0.03 ? `${mol.A.nome} é mais volátil — o vapor fica mais rico nele que o líquido.`
      : (r.YA < mol.xA - 0.03 ? `${mol.B.nome} é mais volátil aqui — o vapor fica mais pobre em ${mol.A.nome} que o líquido.`
        : 'Vapor e líquido têm composição parecida nesse ponto.');
    kLabel(ctx, destaque, gx + 60, gy + 54, { size: 10, color: cssVar('--text-secondary'), maxW: 240 });
    kLabel(ctx, `P total = ${fmt(r.Preal, 0)} mmHg`, gx + 60, gy + 78, { size: 11, color: cssVar('--text-secondary') });
  }

  /** MECÂNICA 2 — Desafio da Destilação: a cada clique em "Destilar", a
   *  composição do líquido SALTA para a composição do vapor em equilíbrio
   *  (Yₐ) — simulando um estágio de destilação simples. Repetir isso
   *  aproxima de x=1 (pureza) SE não houver azeótropo no caminho; se
   *  houver (par real: etanol+água), a composição trava exatamente nele. */
  _drawRaoultDesafio(ctx, W, H) {
    const Ra = this.raoult;
    const desafio = this.D.DESAFIOS_DESTILACAO.find(d => d.id === Ra.desafioId);
    const A = this.D.LIQUIDOS.find(l => l.id === desafio.aId), B = this.D.LIQUIDOS.find(l => l.id === desafio.bId);
    const Am = desafio.desvio === 'positivo' ? 1.1 : (desafio.desvio === 'negativo' ? -1.1 : 0);
    const pmax = Math.max(antoinePv(A.antoine, desafio.T), antoinePv(B.antoine, desafio.T)) * 1.35;
    const gw = W - 104, gh = H - 150;

    kLabel(ctx, desafio.nome, W / 2, 16, { size: 13, bold: true, color: cssVar('--text-primary') });
    kLabel(ctx, desafio.contexto, W / 2, 34, { size: 10, color: cssVar('--text-secondary'), maxW: gw });

    const m = kAxes(ctx, {
      x: 58, y: 54, w: gw, h: gh, xmin: 0, xmax: 1, ymin: 0, ymax: pmax,
      xticks: [0, .25, .5, .75, 1], yticks: [0, pmax * .25, pmax * .5, pmax * .75, pmax],
      xlab: `fração molar de ${A.nome} (x)`, ylab: 'Pressão de vapor (mmHg)',
    });
    kLine(ctx, [[0, antoinePv(B.antoine, desafio.T)], [1, antoinePv(A.antoine, desafio.T)]], m.px, m.py, { color: cssVar('--text-muted'), w: 1.6 });
    const curvaReal = [];
    for (let x = 0; x <= 1.0001; x += 0.02) curvaReal.push([Math.min(x, 1), this._raoultP(Math.min(x, 1), desafio.T, Am, A, B).Preal]);
    ctx.save(); ctx.beginPath(); ctx.rect(58, 54, gw, gh); ctx.clip();
    kLine(ctx, curvaReal, m.px, m.py, { color: cssVar('--accent-primary', '#60a5fa'), w: 2.4 });
    ctx.restore();

    // trilha do histórico de composições já visitadas (staircase da destilação)
    ctx.save(); ctx.strokeStyle = cssVar('--text-muted'); ctx.globalAlpha = .5; ctx.lineWidth = 1.4; ctx.setLineDash([2, 2]);
    Ra.historico.forEach((x, i) => {
      if (i === 0) return;
      const pAnt = this._raoultP(Ra.historico[i - 1], desafio.T, Am, A, B).Preal;
      const pAtu = this._raoultP(x, desafio.T, Am, A, B).Preal;
      ctx.beginPath(); ctx.moveTo(m.px(Ra.historico[i - 1]), m.py(pAnt)); ctx.lineTo(m.px(x), m.py(pAtu)); ctx.stroke();
    });
    ctx.setLineDash([]); ctx.restore();
    Ra.historico.forEach((x, i) => {
      const p = this._raoultP(x, desafio.T, Am, A, B).Preal;
      ctx.save(); ctx.fillStyle = cssVar('--text-muted'); ctx.globalAlpha = .35 + .5 * (i / Math.max(1, Ra.historico.length - 1));
      ctx.beginPath(); ctx.arc(m.px(x), m.py(p), 3.5, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    });

    // ponto atual — grande, com pulso se travado
    const pAtual = this._raoultP(Ra.desafioXA, desafio.T, Am, A, B).Preal;
    const pulso = Ra.travado && !isReduced() ? Math.sin(this.fase * 4) * 2 : 0;
    ctx.save(); ctx.fillStyle = Ra.travado ? cssVar('--accent-exo', '#f87171') : cssVar('--accent-ok', '#4ade80');
    ctx.beginPath(); ctx.arc(m.px(Ra.desafioXA), m.py(pAtual), 7 + pulso, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // azeótropo de referência (mesma varredura do modo gráfico)
    if (Am !== 0) {
      let best = null;
      for (let x = 0.02; x <= 0.98; x += 0.01) {
        const p = this._raoultP(x, desafio.T, Am, A, B).Preal;
        if (!best || (Am > 0 ? p > best.p : p < best.p)) best = { x, p };
      }
      if (best.x > 0.03 && best.x < 0.97) {
        ctx.save(); ctx.strokeStyle = cssVar('--accent-amber'); ctx.setLineDash([3, 3]); ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(m.px(best.x), m.py(0)); ctx.lineTo(m.px(best.x), m.py(pmax)); ctx.stroke();
        ctx.setLineDash([]); ctx.restore();
      }
    }

    // status: progresso normal ou travado no azeótropo
    const statusY = H - 46;
    if (Ra.travado) {
      kLabel(ctx, `🔒 TRAVADO NO AZEÓTROPO após ${Ra.ciclos} ciclos — o vapor tem a MESMA composição do líquido: destilação simples não passa daqui.`,
        W / 2, statusY, { size: 12, bold: true, color: cssVar('--accent-exo', '#f87171'), maxW: gw });
    } else {
      kLabel(ctx, `Ciclo ${Ra.ciclos} · pureza de ${A.nome}: ${fmt(Ra.desafioXA * 100, 1)}%`,
        W / 2, statusY, { size: 12, bold: true, color: cssVar('--accent-ok', '#4ade80') });
    }
  }

  /* ── resultados ── */
  getResults() {
    if (this.modo === 'pvap') {
      const s = this._pv();
      return [
        { l: 'Líquido', v: this.liquido.nome },
        { l: 'Temperatura', v: fmt(this.tpv, 0) + ' °C' },
        { l: 'Pressão de vapor', v: fmt(s.pv, 1) + ' mmHg' },
        { l: 'Pressão externa', v: fmt(this.patm, 0) + ' mmHg' },
        { l: 'Ferve a', v: fmt(s.te, 1) + ' °C' },
        { l: 'Estado', v: s.fervendo ? 'em ebulição' : 'líquido', cls: s.fervendo ? 'val-exo' : '' },
      ];
    }
    if (this.modo === 'colig') {
      const c = this._colig(), S = this.solvente;
      return [
        { l: 'Solvente', v: S.nome },
        { l: 'Soluto', v: this.soluto.nome },
        { l: 'Fator i', v: String(this.soluto.i) },
        { l: 'Molalidade W', v: fmt(this.w, 2) + ' mol/kg' },
        { l: 'Partículas W·i', v: fmt(c.part, 2) + ' mol/kg' },
        { l: 'ΔTe', v: '+' + fmt(c.dte, 2) + ' °C' },
        { l: 'Ferve a', v: fmt(c.te, 2) + ' °C', cls: 'val-exo' },
        { l: 'ΔTc', v: '−' + fmt(c.dtc, 2) + ' °C' },
        { l: 'Congela a', v: fmt(c.tc, 2) + ' °C', cls: 'val-endo' },
        { l: `P_vapor (${fmt(S.Te, 0)} °C)`, v: fmt(c.p, 1) + ' mmHg' },
        { l: 'Massa molar REAL', v: fmt(c.Mreal, 1) + ' g/mol' },
        { l: 'Massa molar aparente (se ignorar i)', v: fmt(c.Map, 1) + ' g/mol', cls: this.soluto.i > 1 ? 'val-exo' : '' },
      ];
    }
    if (this.modo === 'osmose') {
      const o = this._osm();
      return [
        { l: 'Modo', v: this.osm.modoRO ? 'osmose reversa' : 'osmose direta' },
        { l: 'M esquerda' + (this.osm.running ? ' (ao vivo)' : ''), v: fmt(o.Me, 2) + ' mol/L' },
        { l: 'M direita' + (this.osm.running ? ' (ao vivo)' : ''), v: fmt(o.Md, 2) + ' mol/L' },
        { l: 'Temperatura', v: fmt(this.tosm, 0) + ' °C' },
        { l: 'π esquerda', v: fmt(o.pe, 2) + ' atm' },
        { l: 'π direita', v: fmt(o.pd, 2) + ' atm' },
        { l: 'Δπ (pressão osmótica)', v: fmt(o.dpi, 2) + ' atm' },
        ...(this.osm.modoRO ? [{ l: 'Pressão aplicada', v: fmt(o.papl, 1) + ' atm', cls: o.reversed ? 'val-exo' : '' }] : []),
        { l: 'Fluxo de água', v: o.rel === 'iso' ? (this.osm.running ? 'equilíbrio atingido' : 'equilíbrio') : (o.rel === 'dir' ? 'esquerda → direita' : 'direita → esquerda') + (o.reversed ? ' (revertido)' : ''), cls: o.reversed ? 'val-exo' : 'val-ok' },
      ];
    }
    if (this.modo === 'raoult') {
      const Ra = this.raoult;
      if (Ra.vista === 'balao') {
        const mol = this._raoultMoles();
        const Am = Ra.desvio === 'positivo' ? 1.1 : (Ra.desvio === 'negativo' ? -1.1 : 0);
        const r = this._raoultP(mol.xA, Ra.T, Am, mol.A, mol.B);
        return [
          { l: 'Vista', v: 'Balão (evaporação partícula a partícula)' },
          { l: `${mol.A.nome} adicionado`, v: `${fmt(Ra.volA, 0)} mL · ${fmt(mol.molA, 3)} mol` },
          { l: `${mol.B.nome} adicionado`, v: `${fmt(Ra.volB, 0)} mL · ${fmt(mol.molB, 3)} mol` },
          { l: 'Fração molar do líquido (x_A)', v: fmt(mol.xA, 3) },
          { l: 'Fração molar do vapor (Y_A)', v: fmt(r.YA, 3), cls: 'val-ok' },
          { l: 'Pressão total', v: fmt(r.Preal, 0) + ' mmHg' },
        ];
      }
      if (Ra.vista === 'desafio') {
        const desafio = this.D.DESAFIOS_DESTILACAO.find(d => d.id === Ra.desafioId);
        return [
          { l: 'Desafio', v: desafio.nome },
          { l: 'Ciclos de destilação', v: String(Ra.ciclos) },
          { l: `Pureza atual de ${this.D.LIQUIDOS.find(l => l.id === desafio.aId).nome}`, v: fmt(Ra.desafioXA * 100, 1) + ' %', cls: Ra.travado ? 'val-exo' : 'val-ok' },
          { l: 'Estado', v: Ra.travado ? 'travado no azeótropo' : 'destilando', cls: Ra.travado ? 'val-exo' : '' },
        ];
      }
      const r = this._raoult();
      const rows = [
        { l: 'Vista', v: 'Gráfico' },
        { l: 'Líquido A', v: r.A.nome },
        { l: 'Líquido B', v: r.B.nome },
        { l: 'Temperatura', v: fmt(this.raoult.T, 0) + ' °C' },
        { l: 'Fração molar de A (x)', v: fmt(r.xA, 2) },
        { l: 'P° de A pura / B pura', v: `${fmt(r.PA0, 0)} / ${fmt(r.PB0, 0)} mmHg` },
        { l: 'P ideal (Raoult)', v: fmt(r.Pideal, 0) + ' mmHg' },
        { l: 'P real (com desvio)', v: fmt(r.Preal, 0) + ' mmHg', cls: r.Am === 0 ? '' : (r.Am > 0 ? 'val-ok' : 'val-exo') },
        { l: 'Tipo de desvio', v: r.Am === 0 ? 'ideal (γ=1)' : (r.Am > 0 ? 'positivo' : 'negativo') },
      ];
      if (r.azeo) rows.push({ l: 'Azeótropo (x, P)', v: `${fmt(r.azeo.x, 2)} · ${fmt(r.azeo.p, 0)} mmHg` });
      if (r.realRef) rows.push({ l: 'Valor real documentado', v: `x≈${fmt(r.realRef.xA, 2)} (${r.realRef.fonte})`, cls: 'val-ok' });
      return rows;
    }
    const K = this.henry, kH = this._henryKH(K.gas, K.T);
    const alvo = K.aberto ? this._henryEq(K.gas, K.T, 1) : this._henryEq(K.gas, K.T, K.P);
    return [
      { l: 'Gás', v: K.gas.nome },
      { l: 'Temperatura', v: fmt(K.T, 0) + ' °C' },
      { l: K.aberto ? 'Pressão (atmosférica)' : 'Pressão (garrafa fechada)', v: fmt(K.aberto ? 1 : K.P, K.aberto ? 0 : 1) + ' atm' },
      { l: 'kH nessa temperatura', v: fmt(kH * 1000, 3) + '×10⁻³ mol/L/atm' },
      { l: 'C dissolvida (ao vivo)', v: fmt(K.C * 1000, 3) + '×10⁻³ mol/L', cls: 'val-ok' },
      { l: 'C de equilíbrio', v: fmt(alvo * 1000, 3) + '×10⁻³ mol/L' },
      { l: 'Estado', v: K.liberando ? 'liberando gás em bolhas' : (K.aberto ? 'aberta, em equilíbrio' : 'fechada, em equilíbrio'), cls: K.liberando ? 'val-exo' : '' },
    ];
  }

  getOverlay() {
    if (this.modo === 'pvap') return `${this.liquido.nome} · ${fmt(this.tpv, 0)} °C`;
    if (this.modo === 'colig') return `${this.soluto.nome} em ${this.solvente.nome} · ${fmt(this.w, 2)} molal`;
    if (this.modo === 'henry') return `${this.henry.gas.nome} · ${fmt(this.henry.C * 1000, 2)}×10⁻³ mol/L`;
    if (this.modo === 'raoult') {
      const Ra = this.raoult;
      if (Ra.vista === 'balao') { const mol = this._raoultMoles(); return `${mol.A.nome}+${mol.B.nome} · x=${fmt(mol.xA, 2)}`; }
      if (Ra.vista === 'desafio') {
        const desafio = this.D.DESAFIOS_DESTILACAO.find(d => d.id === Ra.desafioId);
        return Ra.travado ? `Travado no azeótropo · ciclo ${Ra.ciclos}` : `${desafio.nome.replace(/^Desafio \d: /, '')} · ciclo ${Ra.ciclos}`;
      }
      const r = this._raoult();
      return r.azeo ? `${r.A.nome}+${r.B.nome} · azeótropo x≈${fmt(r.azeo.x, 2)}` : `${r.A.nome}+${r.B.nome} · x=${fmt(r.xA, 2)}`;
    }
    const o = this._osm();
    return o.reversed ? `Osmose REVERSA · ${fmt(o.papl, 1)} atm aplicada`
      : (o.rel === 'iso' ? 'Soluções isotônicas' : 'Osmose · Δπ ' + fmt(o.dpi, 2) + ' atm');
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
    // ResizeObserver acompanha o tamanho REAL do elemento — cobre casos que
    // o evento 'resize' da janela não pega (barra de endereço do celular
    // aparecendo/sumindo, gaveta do menu mobile abrindo por cima do layout,
    // arrastar o redimensionador da sidebar, fontes carregando depois).
    if (typeof ResizeObserver !== 'undefined') {
      this._ro = new ResizeObserver(() => this._resize());
      this._ro.observe(this.canvas.parentElement || this.canvas);
    }

    // mini-canvas do modo 4 (pvap): béquer+termômetro, fora do canvas central
    this.miniCanvas = document.getElementById('pvap-mini');
    this.miniCtx = this.miniCanvas ? this.miniCanvas.getContext('2d') : null;

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

  /* ── modos gerados de SIM_DATA.MODES: um .panel padrão por modo,
     igual a "Resultados" e às demais famílias (SICIN/SITERMO) —
     cabeçalho ícone+nome+sigla+seta que já expande/recolhe sozinho
     via _bindPanelArea, corpo com botão Ativar, definição, fatos-
     chave (incluindo a fórmula, que antes vivia num painel à parte),
     interação do canvas e dica final. #model-list é só o ponto de
     inserção do JS, não é uma caixa visual. ── */
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
      header.innerHTML = `<span class="panel-icon" aria-hidden="true">${m.icon || '🧪'}</span>
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

      // definição curta = primeira frase de m.info; o restante vai pro
      // final do painel (hint-text), então nenhum texto original se perde
      const frases = (m.info || '').split(/(?<=\.)\s+/).filter(Boolean);
      if (frases.length) {
        const def = document.createElement('p');
        def.className = 'mode-define';
        def.textContent = frases[0];
        body.appendChild(def);
      }

      if (m.formula) {
        const grid = document.createElement('div');
        grid.className = 'fact-grid';
        const cells = [{ l: 'Fórmula', v: m.formula }];
        if (m.hintCanvas) cells.push({ l: 'Atalho', v: m.hintCanvas });
        cells.forEach(ft => {
          const cell = document.createElement('div');
          cell.className = 'fact-cell';
          cell.innerHTML = `<span class="fact-label">${ft.l}</span><span class="fact-value">${ft.v}</span>`;
          grid.appendChild(cell);
        });
        body.appendChild(grid);
      }

      if (m.formulaNote) {
        const note = document.createElement('p');
        note.className = 'energy-formula-note';
        note.textContent = m.formulaNote;
        body.appendChild(note);
      }

      if (m.hint) {
        const box = document.createElement('div');
        box.className = 'canvas-interactions';
        box.innerHTML = `<p class="canvas-interactions-title">Interações do canvas</p><p>${m.hint}</p>`;
        body.appendChild(box);
      }

      const resto = frases.slice(1).join(' ');
      const hint = document.createElement('p');
      hint.className = 'hint-text';
      hint.textContent = resto || m.sub || '';
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
    document.querySelectorAll('.panel[data-mode-card]').forEach(p => {
      const on = p.dataset.modeCard === id;
      p.classList.toggle('active', on);
      const h = p.querySelector('.panel-header');
      if (h) h.setAttribute('aria-current', on ? 'true' : 'false');
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

      if (this.mode.id === 'pvap' && this.miniCtx) {
        this.mech.b._drawPvMini(this.miniCtx, this.miniCanvas.width, this.miniCanvas.height);
      }

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

    var storeKey = 'solucoes-w-' + cfg.cssVar.replace(/^--/, '');
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
