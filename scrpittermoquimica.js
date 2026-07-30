/* ================================================================
   SITQ — scrpittermoquimica.js | Simulador Interativo de Termoquímica
   ================================================================
   APENAS MECÂNICAS. Todos os dados fixos vivem em
   dadostermoquimica.js (window.SITQ_DATA), carregado antes deste
   arquivo — mesmo contrato dadossima.js → scriptsima.js do SIMA.

   FÍSICA POR MODO (fontes citadas em dadostermoquimica.js):

   CALORÍMETRO — calor sensível Q = m·c·ΔT; a agitação das
     partículas desenhadas cresce com a temperatura (modelo
     cinético-molecular); Q>0 = amostra absorve (setas azuis
     entrando ficam laranja quando aquecendo, azuis ao resfriar).

   CURVA DE AQUECIMENTO — gelo→água→vapor com Q = m·c·ΔT nos
     trechos inclinados e Q = m·L nos patamares (T constante em
     0 °C e 100 °C a 1 atm); L_fus = 334 J/g, L_vap = 2260 J/g.

   ENDO × EXO — diagrama de entalpia H × caminho da reação:
     Hr, complexo ativado (pico, Ea) e Hp; ΔH = Hp − Hr.
     Catalisador reduz Ea (fator ilustrativo) sem alterar ΔH.

   LEI DE HESS — entalpia é função de estado: as etapas são
     tratadas algebricamente (inverter ⇒ −ΔH; ×n ⇒ n·ΔH) e o
     diagrama de níveis mostra que ΔH(0→1) = ΔH(0→2) − ΔH(1→2).

   ENERGIA DE LIGAÇÃO — ΔH ≈ ΣE(rompidas) − ΣE(formadas), com
     as moléculas (geometrias VSEPR reais) desenhadas por
     PROJEÇÃO 3D em perspectiva: rotação Rx·Ry, ordenação por
     profundidade (algoritmo do pintor) e escala f/(f−z).
   ================================================================
   ACESSIBILIDADE:
   Este simulador NÃO tem controles próprios de tema/contraste/
   daltonismo/leitura simples/fonte/animação/espaçamento — quem
   controla é a Central de Simuladores (menu), que envia o estado
   via parâmetros de URL e postMessage. O receptor logo abaixo
   traduz esse estado pras MESMAS classes (body.light-mode/
   .high-contrast/.simple-read/.reduce-motion/.wide-spacing) e
   variável (--font-scale) que o CSS deste simulador já usa.
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
// DADOS ESTÁTICOS — vêm de dadostermoquimica.js (window.SITQ_DATA)
// ══════════════════════════════════════════════════════════════════
const {
  PHYS, SUBSTANCIAS, CURVA_SUBSTANCIAS, REACOES_PERFIL, CATALISADOR_FATOR,
  HESS, HESS_MULTS, ENERGIA_LIGACAO, REACOES_LIGACAO,
  ATOMO_3D, MOLECULAS_3D, MODO_NOME, MODO_INFO, FORMULAS, CURIOSIDADES, MODO_EXTRA,
} = window.SITQ_DATA;

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

/** Clareia (amt>0) ou escurece (amt<0) uma cor hex — usado nos brilhos/sombras metálicos e de vidro. */
function shadeColor(hex, amt) {
  const c = hex.replace('#', '');
  const r = clamp(parseInt(c.substr(0, 2), 16) + amt, 0, 255);
  const g = clamp(parseInt(c.substr(2, 2), 16) + amt, 0, 255);
  const b = clamp(parseInt(c.substr(4, 2), 16) + amt, 0, 255);
  return `rgb(${r},${g},${b})`;
}

/**
 * Escala massa→"quanto aparece no béquer" usando o VOLUME real
 * (volume = massa/densidade), não a massa pura — por isso 500 g de
 * chumbo (denso) desenham um bloco bem menor que 500 g de água.
 * Escala logarítmica: a faixa de volumes possíveis (chumbo denso a
 * etanol leve, 10–1000 g) varia ~1400×, e um mapeamento linear
 * deixaria quase tudo "cheio" ou "vazio". fracMin/fracMax evitam que
 * o desenho suma (fração 0) ou estoure o béquer (fração 1).
 */
const VOL_MIN = Math.min(...SUBSTANCIAS.map(s => PHYS.MASSA_MIN / s.densidade));
const VOL_MAX = Math.max(...SUBSTANCIAS.map(s => PHYS.MASSA_MAX / s.densidade));
function fracVolume(massa, sub, fracMin = 0.07, fracMax = 0.94) {
  const vol = massa / sub.densidade;
  const t = clamp((Math.log(vol) - Math.log(VOL_MIN)) / (Math.log(VOL_MAX) - Math.log(VOL_MIN)), 0, 1);
  return fracMin + (fracMax - fracMin) * t;
}

/**
 * Monta os trechos sólido→(fusão)→líquido→(vaporização)→vapor entre Ti e
 * Tf para uma substância com dados de mudança de fase (cSolido/cLiquido/
 * cVapor/Lfusao/Lvap/Tfusao/Tebulicao — ver CURVA_SUBSTANCIAS). Reaproveitada
 * pela Curva de Aquecimento E pelo Calorímetro (quando a substância
 * escolhida tem esses dados): a física de sensível+latente é a MESMA nos
 * dois modos, só muda onde e como o resultado é desenhado.
 * Só aceita Tf > Ti (aquecimento) — resfriamento atravessando uma mudança
 * de fase não é suportado (ver aviso na mecânica que chama esta função).
 */
function construirSegmentosFase(sub, massa, Ti, Tf) {
  const { cSolido, cLiquido, cVapor, Lfusao, Lvap, Tfusao, Tebulicao, fases } = sub;
  let T = Ti;
  const segs = [];
  const sens = (c, T0, T1, fase, nome) =>
    segs.push({ tipo: 's', fase, nome, T0, T1, Q: massa * c * (T1 - T0) });
  if (T < Tfusao) { const T1 = Math.min(Tf, Tfusao); sens(cSolido, T, T1, 'gelo', 'Aquecer o sólido'); T = T1; }
  if (T === Tfusao && Tf > Tfusao) { segs.push({ tipo: 'l', fase: 'fusao', nome: `Fusão (${fmt(Tfusao, 1)} °C)`, T0: T, T1: T, Q: massa * Lfusao }); }
  if (Tf > Tfusao && T < Tebulicao) { const T0 = Math.max(T, Tfusao); const T1 = Math.min(Tf, Tebulicao); sens(cLiquido, T0, T1, 'agua', 'Aquecer o líquido'); T = T1; }
  if (T === Tebulicao && Tf > Tebulicao) { segs.push({ tipo: 'l', fase: 'vapor', nome: `Vaporização (${fmt(Tebulicao, 1)} °C)`, T0: T, T1: T, Q: massa * Lvap }); }
  if (Tf > Tebulicao) { const T0 = Math.max(T, Tebulicao); sens(cVapor, T0, Tf, 'vaporS', 'Aquecer o vapor'); }
  return { segs, totalQ: segs.reduce((s, g) => s + g.Q, 0), fasesTxt: fases };
}

/**
 * Encontra a posição (T, fase, fracSeg) para um calor acumulado q dentro
 * de uma lista de segmentos (ver construirSegmentosFase). fracSeg = 0→1
 * é o progresso dentro do trecho/patamar atual — essencial pra misturar
 * as fases nos patamares em vez de trocar de textura de uma vez.
 * "<" (não "<=") por design: na fronteira EXATA entre dois trechos, isso
 * escolhe sempre o INÍCIO do próximo (fracSeg=0), nunca o fim do anterior.
 */
function pontoNosSegmentos(segs, fasesTxt, q) {
  let acc = 0;
  for (const s of segs) {
    if (q < acc + s.Q || s === segs[segs.length - 1]) {
      const f = s.Q ? clamp((q - acc) / s.Q, 0, 1) : 1;
      const T = lerp(s.T0, s.T1, f);
      const rot = s.tipo === 'l'
        ? `${s.nome} — T constante!`
        : (s.fase === 'gelo' ? fasesTxt.gelo : s.fase === 'vaporS' ? fasesTxt.vapor : fasesTxt.agua);
      return { T, rotulo: rot, seg: s, fracSeg: f };
    }
    acc += s.Q;
  }
  return { T: segs[0] ? segs[0].T0 : 0, rotulo: fasesTxt.gelo, seg: segs[0], fracSeg: 0 };
}

// ══════════════════════════════════════════════════════════════════
// MOTOR DE PROJEÇÃO 3D (modo Energia de Ligação)
// Rotação Rx·Ry → perspectiva sx = x·f/(f−z) → pintor (sort por z).
// ══════════════════════════════════════════════════════════════════
const FOV = 5.2; // distância focal em "Å visuais"

function rot3(p, rx, ry) {
  // Ry (eixo vertical) e depois Rx (eixo horizontal)
  const cy = Math.cos(ry), sy = Math.sin(ry);
  const cx = Math.cos(rx), sx = Math.sin(rx);
  const x1 = p.x * cy + p.z * sy;
  const z1 = -p.x * sy + p.z * cy;
  const y2 = p.y * cx - z1 * sx;
  const z2 = p.y * sx + z1 * cx;
  return { x: x1, y: y2, z: z2 };
}
function proj3(p, cx, cy, ppa) {
  const persp = FOV / (FOV - p.z);          // z cresce PARA a câmera
  return { x: cx + p.x * ppa * persp, y: cy - p.y * ppa * persp, s: persp, z: p.z };
}

/**
 * Desenha uma molécula em projeção 3D no ponto (cx,cy).
 * ppa = pixels por Å; rx/ry = rotação; labels = letras dos elementos.
 */
function drawMolecule(ctx, mol, cx, cy, ppa, rx, ry, labels) {
  const pts = mol.atoms.map(a => proj3(rot3(a, rx, ry), cx, cy, ppa));
  const bondCol = cssVar('--text-secondary', '#7a9ab8');

  // Itens (ligações + átomos) ordenados por profundidade média
  const items = [];
  mol.bonds.forEach(([i, j, ordem]) => items.push({ z: (pts[i].z + pts[j].z) / 2, tipo: 'b', i, j, ordem }));
  mol.atoms.forEach((a, i) => items.push({ z: pts[i].z, tipo: 'a', i }));
  items.sort((m, n) => m.z - n.z); // mais fundo primeiro

  for (const it of items) {
    if (it.tipo === 'b') {
      const A = pts[it.i], B = pts[it.j];
      const dx = B.x - A.x, dy = B.y - A.y;
      const len = Math.hypot(dx, dy) || 1;
      // recua as pontas para dentro dos átomos
      const rA = ATOMO_3D[mol.atoms[it.i].el].r * ppa * A.s * 0.8;
      const rB = ATOMO_3D[mol.atoms[it.j].el].r * ppa * B.s * 0.8;
      const ax = A.x + dx / len * rA, ay = A.y + dy / len * rA;
      const bx = B.x - dx / len * rB, by = B.y - dy / len * rB;
      const nx = -dy / len, ny = dx / len; // normal p/ ligações múltiplas
      const offs = it.ordem === 1 ? [0] : it.ordem === 2 ? [-2.6, 2.6] : [-3.6, 0, 3.6];
      ctx.strokeStyle = bondCol;
      ctx.lineWidth = Math.max(1.6, 2.6 * (A.s + B.s) / 2);
      ctx.lineCap = 'round';
      offs.forEach(o => {
        ctx.beginPath();
        ctx.moveTo(ax + nx * o, ay + ny * o);
        ctx.lineTo(bx + nx * o, by + ny * o);
        ctx.stroke();
      });
    } else {
      const P = pts[it.i];
      const el = mol.atoms[it.i].el;
      const st = ATOMO_3D[el];
      const r = st.r * ppa * P.s;
      const g = ctx.createRadialGradient(P.x - r * .35, P.y - r * .35, r * .15, P.x, P.y, r);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(.25, st.cor);
      g.addColorStop(1, st.cor);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(P.x, P.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.35)';
      ctx.lineWidth = 1;
      ctx.stroke();
      if (labels) {
        ctx.fillStyle = getContrastColor(st.cor);
        ctx.font = `700 ${Math.max(8, r * 0.95)}px Consolas, monospace`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(el, P.x, P.y + 0.5);
      }
    }
  }
}

// ══════════════════════════════════════════════════════════════════
// FÍSICA/RENDERIZAÇÃO — classe ThermoSim (um canvas, cinco modos)
// ══════════════════════════════════════════════════════════════════
class ThermoSim {
  constructor(canvas, onEvent) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onEvent = onEvent || (() => {});
    this.mode = 'calor';
    this.paused = false;
    this.time = 0;
    this.dpr = 1; this.W = 0; this.H = 0;

    // ── estado: calorímetro ──
    this.calor = {
      sub: SUBSTANCIAS[0], massa: 200, Ti: 20, Tf: 80,
      Tcur: 20, phase: 1, running: false, fired: false,
      // multifase: preenchidos só quando a substância tem dados de mudança
      // de fase (água, etanol) — ver _syncCalorFaixa() e construirSegmentosFase().
      fasesDados: null, segs: [], totalQ: 0, Qcur: 0,
      parts: Array.from({ length: 26 }, () => ({ x: Math.random(), y: Math.random(), f: Math.random() * 6.28 })),
    };
    // ── estado: curva de aquecimento ──
    this.curva = { sub: CURVA_SUBSTANCIAS[0], massa: 100, Ti: CURVA_SUBSTANCIAS[0].faixaPadrao[0], Tf: CURVA_SUBSTANCIAS[0].faixaPadrao[1], segs: [], totalQ: 0, Qcur: 0, running: false, done: false };
    this.buildCurva();
    // ── estado: perfil endo/exo ──
    this.perfil = { r: REACOES_PERFIL[0], cat: false, playing: false, t: 0, done: false, burst: [] };
    // ── estado: Lei de Hess ──
    this.hess = { ex: HESS[0], soma: 0, solved: false, flash: 0 };
    // ── estado: energia de ligação 3D ──
    this.lig = { r: REACOES_LIGACAO[0], inverted: false, auto: true, labels: true, rx: -0.32, ry: 0.55 };

    this._bindPointer();
  }

  // ── Curva: monta os trechos sólido→líquido→vapor entre Ti e Tf ──
  buildCurva() {
    const r = construirSegmentosFase(this.curva.sub, this.curva.massa, this.curva.Ti, this.curva.Tf);
    this.curva.segs = r.segs;
    this.curva.totalQ = r.totalQ;
    this.curva.fasesTxt = r.fasesTxt;
  }

  // ── redimensionamento com devicePixelRatio ──────────────────────
  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.max(1, Math.round(r.width * this.dpr));
    this.canvas.height = Math.max(1, Math.round(r.height * this.dpr));
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.W = r.width; this.H = r.height;
  }

  // ── ATUALIZAÇÃO FÍSICA ──────────────────────────────────────────
  update(dt) {
    this.time += dt;

    if (this.mode === 'calor' && this.calor.running) {
      if (this.calor.segs.length) {
        // multifase (água/etanol atravessando fusão/ebulição): anima Qcur
        // linearmente, como na Curva — um simples lerp de T "pularia" os
        // patamares de calor latente num instante, o que seria errado.
        const dur = isReduced() ? 0.01 : 6;
        this.calor.Qcur = Math.min(this.calor.totalQ, this.calor.Qcur + this.calor.totalQ * dt / dur);
        this.calor.Tcur = pontoNosSegmentos(this.calor.segs, this.calor.fasesDados.fases, this.calor.Qcur).T;
        if (this.calor.Qcur >= this.calor.totalQ) {
          this.calor.running = false;
          this.onEvent('calor-done');
        }
      } else {
        const dur = isReduced() ? 0.01 : 2.6;
        this.calor.phase = Math.min(1, this.calor.phase + dt / dur);
        const e = easeIO(this.calor.phase);
        this.calor.Tcur = lerp(this.calor.Ti, this.calor.Tf, e);
        if (this.calor.phase >= 1) {
          this.calor.running = false;
          this.onEvent('calor-done');
        }
      }
    }

    if (this.mode === 'curva' && this.curva.running) {
      const dur = isReduced() ? 0.01 : 6;
      this.curva.Qcur = Math.min(this.curva.totalQ, this.curva.Qcur + this.curva.totalQ * dt / dur);
      if (this.curva.Qcur >= this.curva.totalQ) {
        this.curva.running = false; this.curva.done = true;
        this.onEvent('curva-done');
      }
    }

    if (this.mode === 'perfil') {
      if (this.perfil.playing) {
        const dur = isReduced() ? 0.01 : 3.2;
        this.perfil.t = Math.min(1, this.perfil.t + dt / dur);
        if (this.perfil.t >= 1) {
          this.perfil.playing = false; this.perfil.done = true;
          this._spawnBurst();
          this.onEvent('perfil-done');
        }
      }
      this.perfil.burst.forEach(p => {
        p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; p.life -= dt;
      });
      this.perfil.burst = this.perfil.burst.filter(p => p.life > 0);
    }

    if (this.mode === 'hess' && this.hess.flash > 0) this.hess.flash -= dt;

    if (this.mode === 'ligacao' && this.lig.auto && !this.lig.dragging && !isReduced()) {
      this.lig.ry += dt * 0.5;
    }
  }

  _spawnBurst() {
    const exo = this.perfil.r.dH < 0;
    const g = this._perfilGeom();
    const px = g.xb, py = g.yOf(this.perfil.r.dH);
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = exo ? 60 + Math.random() * 120 : 40 + Math.random() * 60;
      this.perfil.burst.push(exo
        ? { x: px, y: py, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, g: 60, life: .9 + Math.random() * .5, exo }
        : { x: px + Math.cos(a) * 90, y: py + Math.sin(a) * 90, vx: -Math.cos(a) * v, vy: -Math.sin(a) * v, g: 0, life: .9 + Math.random() * .4, exo });
    }
  }

  // ── DESENHO ─────────────────────────────────────────────────────
  draw() {
    const { ctx, W, H } = this;
    ctx.clearRect(0, 0, W, H);
    if (W < 40 || H < 40) return;
    switch (this.mode) {
      case 'calor':   this.drawCalor();   break;
      case 'curva':   this.drawCurva();   break;
      case 'perfil':  this.drawPerfil();  break;
      case 'hess':    this.drawHess();    break;
      case 'ligacao': this.drawLigacao(); break;
    }
  }

  /* ═══════════ MODO 1 — CALORÍMETRO ═══════════ */
  drawCalor() {
    const { ctx, W, H, time } = this;
    const st = this.calor;
    const T = st.Tcur;
    const heating = st.Tf > st.Ti, active = st.running;
    const multifase = st.segs.length > 0;
    // fase atual: tanto faz se veio de uma transição ANIMADA em curso
    // (segs.length>0, fracSeg real) quanto de um estado PARADO de
    // água/etanol fora de qualquer patamar (fracSeg não se aplica) —
    // nos dois casos, o desenho tem que refletir a fase REAL da T atual,
    // não ficar preso na textura "padrão" (líquida) da substância.
    let faseAtual = null, fracSegAtual = 0;
    if (multifase) {
      const pos = pontoNosSegmentos(st.segs, st.fasesDados.fases, st.Qcur);
      faseAtual = pos.seg.fase; fracSegAtual = pos.fracSeg;
    } else if (st.fasesDados) {
      faseAtual = this._faseEstaticaDeT(st.fasesDados, T);
    }

    const bw = clamp(W * .30, 130, 240);          // largura do béquer
    const bh = clamp(H * .46, 150, 300);
    const bx = W * .40 - bw / 2, by = H * .56 - bh / 2;

    // nível de preenchimento ∝ volume real (massa/densidade) — não a massa pura
    const frac = fracVolume(st.massa, st.sub);
    const lvl = by + bh * (1 - frac);

    let vaporFora = 0;
    ctx.save();
    this._clipRecipiente(bx, by, bw, bh);
    if (faseAtual !== null) {
      const r = this._desenharFaseAtual(bx, by, bw, bh, lvl, st.sub.cor, faseAtual, fracSegAtual, time);
      vaporFora = r.vapor;
    } else {
      this._drawAmostra(st.sub.textura, bx, by, bw, bh, lvl, st.sub.cor, time);
    }

    // partículas: agitação térmica ∝ T (modelo cinético-molecular).
    // Redes sólidas cristalinas (metal/gelo/vidro, ou a fase atual "gelo"
    // numa transição) vibram em posições fixas de grade; líquidos e o
    // granular (areia) usam disposição livre — mais fiel ao que cada
    // estado físico realmente faz. Sem partículas quando virou vapor puro
    // (nada "dentro" do béquer pra vibrar).
    if (faseAtual !== 'vaporS') {
      const cristalino = faseAtual !== null
        ? (faseAtual === 'gelo' || faseAtual === 'fusao')
        : (st.sub.textura === 'metal' || st.sub.textura === 'gelo' || st.sub.textura === 'vidro');
      // amplitude de vibração ∝ T dentro da ESCALA REAL desta substância
      // (não mais fixa em -20..120 — água/etanol alcançam bem mais que isso)
      const [ampMin, ampMax] = st.fasesDados ? st.fasesDados.faixaPadrao : [PHYS.T_MIN, PHYS.T_MAX];
      const amp = isReduced() ? 0 : lerp(0.5, 3.4, clamp((T - ampMin) / (ampMax - ampMin), 0, 1));
      const ampP = cristalino ? Math.min(amp, 1.5) : amp; // rede sólida vibra menos que um líquido agitado
      const cols = 6, rows = Math.ceil(st.parts.length / cols);
      ctx.fillStyle = getContrastColor(st.sub.cor) === '#ffffff' ? 'rgba(255,255,255,.8)' : 'rgba(17,24,39,.75)';
      st.parts.forEach((p, i) => {
        const gx = cristalino ? (i % cols + .5) / cols : p.x;
        const gy = cristalino ? (Math.floor(i / cols) + .5) / rows : p.y;
        const px = bx + bw * (.14 + gx * .72) + Math.sin(time * (3 + ampP) + p.f) * ampP;
        const py = lvl + 14 + Math.max(0, (by + bh - lvl - 14)) * gy + Math.cos(time * (3 + ampP) + p.f * 2 + i) * ampP;
        if (py < lvl - 2) return; // partícula "acima" do nível preenchido: não desenha
        ctx.beginPath(); ctx.arc(px, py, 2.4, 0, 6.29); ctx.fill();
      });
    }
    ctx.restore();

    // vapor sobe por FORA do recipiente (não pode ficar clipado pelo béquer)
    if (vaporFora > 0) this._texturaVapor(bx + bw / 2, by - 4, vaporFora, time);

    // vidro do béquer
    this._contornoRecipiente(bx, by, bw, bh);

    // rótulo da amostra
    ctx.fillStyle = cssVar('--text-secondary');
    ctx.font = '11px Consolas, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(`${st.sub.nome} · ${fmt(st.massa, 0)} g`, bx + bw / 2, by + bh + 26);
    if (faseAtual !== null) {
      ctx.fillStyle = cssVar('--accent-amber'); ctx.font = '700 10px Consolas, monospace';
      const NOMES = { gelo: 'Sólido', fusao: 'Sólido + líquido', agua: 'Líquido', vapor: 'Líquido + vapor', vaporS: 'Vapor' };
      ctx.fillText(NOMES[faseAtual] || '', bx + bw / 2, by + bh + 40);
    }

    // fonte de calor / gelo
    if (active) {
      if (heating) this._flame(bx + bw / 2, by + bh + 4, 1 + Math.abs(st.Tf - st.Ti) / 140);
      else this._iceCubes(bx + bw / 2, by + bh + 12);
      this._heatArrows(bx, by, bw, bh, heating);
    }

    // termômetro — escala própria (mais ampla) pra água/etanol, com
    // marcos de P.F./P.E. em vez da banda de fase única (que não faz
    // mais sentido quando a faixa toda é alcançável).
    if (st.fasesDados) {
      const marcos = [
        { t: st.fasesDados.Tfusao, label: 'P.F.' },
        { t: st.fasesDados.Tebulicao, label: 'P.E.' },
      ];
      this._thermometer(W * .78, H * .16, H * .62, T, null, marcos, st.fasesDados.faixaPadrao);
    } else {
      this._thermometer(W * .78, H * .16, H * .62, T, st.sub.faixa, null, null);
    }

    // leitura de Q após a troca
    if (st.fired && !st.running && st.Tf !== st.Ti) {
      let Q;
      if (multifase) {
        Q = st.totalQ;
      } else if (st.fasesDados) {
        // parado numa fase só (sem cruzar patamar): usa o c DA FASE
        // atual, não sempre o do líquido (que é o que sub.c representa)
        const cEf = faseAtual === 'gelo' ? st.fasesDados.cSolido : faseAtual === 'vaporS' ? st.fasesDados.cVapor : st.fasesDados.cLiquido;
        Q = st.massa * cEf * (st.Tf - st.Ti);
      } else {
        Q = st.massa * st.sub.c * (st.Tf - st.Ti);
      }
      const abs = Q > 0;
      ctx.fillStyle = abs ? cssVar('--accent-endo') : cssVar('--accent-exo');
      ctx.font = '700 15px Consolas, monospace'; ctx.textAlign = 'center';
      ctx.fillText(`Q = ${fmt(Q / 1000, 2)} kJ ${abs ? '(absorvido)' : '(liberado)'}`, W * .40, by - 26);
    }
  }

  /** Recorte com o contorno arredondado do fundo do recipiente (béquer). */
  _clipRecipiente(bx, by, bw, bh) {
    const { ctx } = this;
    ctx.beginPath();
    ctx.moveTo(bx, by); ctx.lineTo(bx, by + bh - 12);
    ctx.quadraticCurveTo(bx, by + bh, bx + 12, by + bh);
    ctx.lineTo(bx + bw - 12, by + bh);
    ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw, by + bh - 12);
    ctx.lineTo(bx + bw, by);
    ctx.clip();
  }

  /** Contorno de vidro do recipiente (traço) — mesmo desenho usado no Calorímetro e na mini-cena da Curva. */
  _contornoRecipiente(bx, by, bw, bh) {
    const { ctx } = this;
    ctx.strokeStyle = cssVar('--glass', 'rgba(148,163,184,.38)');
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(bx - 8, by - 6);
    ctx.lineTo(bx, by); ctx.lineTo(bx, by + bh - 12);
    ctx.quadraticCurveTo(bx, by + bh, bx + 12, by + bh);
    ctx.lineTo(bx + bw - 12, by + bh);
    ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw, by + bh - 12);
    ctx.lineTo(bx + bw, by); ctx.lineTo(bx + bw + 8, by - 6);
    ctx.stroke();
  }

  /** Despacha para o desenho da textura certa; 'vapor' é usado só pela mini-cena da Curva. */
  _drawAmostra(textura, bx, by, bw, bh, lvl, cor, time) {
    if (lvl >= by + bh) return; // fração ~0: nada visível (evita desenhar "negativo")
    switch (textura) {
      case 'gelo':     this._texturaGelo(bx, by, bw, bh, lvl, cor); break;
      case 'metal':    this._texturaMetal(bx, by, bw, bh, lvl, cor); break;
      case 'vidro':    this._texturaVidro(bx, by, bw, bh, lvl, cor); break;
      case 'granular': this._texturaGranular(bx, by, bw, bh, lvl, cor); break;
      default:         this._texturaLiquido(bx, by, bw, bh, lvl, cor, time);
    }
  }

  /** Líquido: superfície ondulada + brilho — água, etanol, óleo. */
  _texturaLiquido(bx, by, bw, bh, lvl, cor, time) {
    const { ctx } = this;
    const onda = x => lvl + Math.sin(time * 2 + x * .08) * (isReduced() ? 0 : 2.4);
    ctx.fillStyle = cor + 'B8';
    ctx.beginPath(); ctx.moveTo(bx, onda(0));
    for (let x = 0; x <= bw; x += 8) ctx.lineTo(bx + x, onda(x));
    ctx.lineTo(bx + bw, by + bh); ctx.lineTo(bx, by + bh); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(bx, onda(0));
    for (let x = 0; x <= bw; x += 8) ctx.lineTo(bx + x, onda(x));
    ctx.stroke();
  }

  /** Gelo: blocos translúcidos irregulares empilhados (não uma superfície lisa). */
  _texturaGelo(bx, by, bw, bh, lvl, cor) {
    const { ctx } = this;
    const fillH = (by + bh) - lvl;
    if (fillH <= 1) return;
    const cols = Math.max(2, Math.round(bw / 26));
    const rows = Math.max(1, Math.round(fillH / 20));
    const cw = bw / cols, ch = fillH / rows;
    let seed = 811;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const jx = (rnd() - .5) * 4, jy = (rnd() - .5) * 3;
        const x = bx + c * cw + 2 + jx, y = lvl + r * ch + 2 + jy;
        const w = Math.max(2, cw - 4), h = Math.max(2, ch - 4);
        ctx.fillStyle = cor + 'D0';
        ctx.beginPath(); ctx.roundRect(x, y, w, h, 3); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1; ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,.65)';
        ctx.beginPath(); ctx.moveTo(x + 2, y + h * .35); ctx.lineTo(x + w * .5, y + 2); ctx.stroke();
      }
    }
  }

  /** Metal: bloco sólido opaco com faixa de brilho metálico (gradiente linear). */
  _texturaMetal(bx, by, bw, bh, lvl, cor) {
    const { ctx } = this;
    const h = (by + bh) - lvl;
    if (h <= 1) return;
    const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    g.addColorStop(0, shadeColor(cor, -45));
    g.addColorStop(.32, shadeColor(cor, 55));
    g.addColorStop(.5, cor);
    g.addColorStop(.72, shadeColor(cor, -20));
    g.addColorStop(1, shadeColor(cor, -50));
    ctx.fillStyle = g;
    ctx.fillRect(bx, lvl, bw, h);
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.fillRect(bx, lvl, bw, 2);
  }

  /** Vidro: bloco translúcido com reflexo diagonal, deixa entrever o fundo. */
  _texturaVidro(bx, by, bw, bh, lvl, cor) {
    const { ctx } = this;
    const h = (by + bh) - lvl;
    if (h <= 1) return;
    ctx.fillStyle = cor + '55';
    ctx.fillRect(bx, lvl, bw, h);
    ctx.strokeStyle = cor + 'AA'; ctx.lineWidth = 1;
    ctx.strokeRect(bx, lvl, bw, h);
    ctx.fillStyle = 'rgba(255,255,255,.4)';
    ctx.beginPath();
    ctx.moveTo(bx + bw * .16, lvl); ctx.lineTo(bx + bw * .3, lvl);
    ctx.lineTo(bx + bw * .12, by + bh); ctx.lineTo(bx, by + bh);
    ctx.closePath(); ctx.fill();
  }

  /** Granular: monte com topo irregular e textura de grãos — areia. */
  _texturaGranular(bx, by, bw, bh, lvl, cor) {
    const { ctx } = this;
    const h = (by + bh) - lvl;
    if (h <= 1) return;
    ctx.fillStyle = cor + 'E8';
    ctx.beginPath(); ctx.moveTo(bx, by + bh); ctx.lineTo(bx, lvl + 6);
    for (let x = 0; x <= bw; x += 8) {
      const yy = lvl + Math.sin(x * .3) * 3 + Math.sin(x * .7 + 1) * 2;
      ctx.lineTo(bx + x, yy);
    }
    ctx.lineTo(bx + bw, by + bh); ctx.closePath(); ctx.fill();
    let seed = 271;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    ctx.fillStyle = shadeColor(cor, -45) + 'AA';
    const n = Math.floor((bw * h) / 34);
    for (let i = 0; i < n; i++) {
      const x = bx + rnd() * bw, yy = lvl + 6 + rnd() * h;
      ctx.beginPath(); ctx.arc(x, yy, 1.1, 0, 6.29); ctx.fill();
    }
  }

  /** Vapor: ondinhas translúcidas subindo e dissipando — só a mini-cena da Curva usa isto. */
  _texturaVapor(cx, topY, intensidade, time) {
    const { ctx } = this;
    for (let i = 0; i < 6; i++) {
      const off = (time * 46 + i * 33) % 150;
      const alpha = Math.max(0, 1 - off / 150) * .55 * intensidade;
      const x = cx + Math.sin(time * 1.3 + i) * 12 + (i - 2.5) * 14;
      const y = topY - off;
      ctx.strokeStyle = `rgba(226,236,246,${alpha})`;
      ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.quadraticCurveTo(x, y - 9, x + 6, y); ctx.stroke();
    }
  }

  _flame(cx, topY, k) {
    const { ctx, time } = this;
    const w = isReduced() ? 0 : Math.sin(time * 9) * 3;
    const h = 30 * k;
    ctx.save();
    ctx.translate(cx, topY + 34);
    const g = ctx.createLinearGradient(0, 0, 0, -h);
    g.addColorStop(0, cssVar('--flame-a')); g.addColorStop(1, cssVar('--flame-b'));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-12, 0);
    ctx.quadraticCurveTo(-14 + w, -h * .5, 0 + w * .6, -h);
    ctx.quadraticCurveTo(14 + w, -h * .5, 12, 0);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = cssVar('--bg-void');
    ctx.beginPath(); ctx.ellipse(0, -2, 6, 9, 0, 0, 6.29); ctx.fill();
    ctx.restore();
  }

  _iceCubes(cx, y) {
    const { ctx } = this;
    ctx.fillStyle = cssVar('--ice') + 'CC';
    ctx.strokeStyle = cssVar('--ice');
    [[-26, 0], [0, 4], [26, 0]].forEach(([dx, dy]) => {
      ctx.fillRect(cx + dx - 9, y + dy, 18, 18);
      ctx.strokeRect(cx + dx - 9, y + dy, 18, 18);
    });
  }

  _heatArrows(bx, by, bw, bh, entering) {
    // setas de fluxo de calor: entram (aquecer, Q>0) ou saem (resfriar, Q<0)
    const { ctx, time } = this;
    const col = entering ? cssVar('--flame-a') : cssVar('--accent-endo');
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 2.2;
    const off = isReduced() ? 0 : (time * 34) % 22;
    for (let i = 0; i < 3; i++) {
      const y = by + bh * (.3 + i * .22);
      const dir = entering ? 1 : -1;
      const x0 = entering ? bx - 46 + off : bx - 24 - off;
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + 20, y); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x0 + (dir > 0 ? 20 : 0), y);
      ctx.lineTo(x0 + (dir > 0 ? 13 : 7), y - 4);
      ctx.lineTo(x0 + (dir > 0 ? 13 : 7), y + 4);
      ctx.closePath(); ctx.fill();
    }
  }

  /**
   * faixa: banda única destacada (substâncias de 1 fase só, ex. gelo).
   * marcos: array de {t, label} — linhas de referência p/ substâncias
   * com dados de mudança de fase (P.F./P.E. de água e etanol), já que
   * pra elas não existe mais "uma faixa válida", e sim pontos de
   * transição dentro de uma escala bem mais ampla.
   * escala: [Tmin,Tmax] do PRÓPRIO termômetro — o normal é −20..120
   * (PHYS.T_MIN/T_MAX), mas água/etanol alcançam valores bem fora
   * disso (etanol chega a −114 °C), então a régua precisa se adaptar
   * ou a coluna de líquido é desenhada fora do tubo.
   */
  _thermometer(x, top, len, T, faixa, marcos, escala) {
    const { ctx } = this;
    const [Tmin, Tmax] = escala || [PHYS.T_MIN, PHYS.T_MAX];
    const yOf = t => top + len * (1 - (clamp(t, Tmin, Tmax) - Tmin) / (Tmax - Tmin));
    // tubo
    ctx.strokeStyle = cssVar('--glass'); ctx.lineWidth = 2;
    ctx.fillStyle = cssVar('--bg-panel2');
    const tw = 14;
    ctx.beginPath();
    ctx.roundRect(x - tw / 2, top - 8, tw, len + 16, 7);
    ctx.fill(); ctx.stroke();
    // faixa de fase válida (se a substância tiver uma): banda destacada
    // no tubo mostrando onde ela é REALMENTE a fase escolhida a 1 atm.
    if (faixa) {
      const yHi = yOf(clamp(faixa[1], Tmin, Tmax)), yLo = yOf(clamp(faixa[0], Tmin, Tmax));
      const bandCol = cssVar('--accent-ok');
      ctx.fillStyle = bandCol + '26';
      ctx.fillRect(x - tw / 2, yHi, tw, yLo - yHi);
      ctx.strokeStyle = bandCol + '90';
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(x - tw / 2 - 4, yHi); ctx.lineTo(x + tw / 2 + 4, yHi); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - tw / 2 - 4, yLo); ctx.lineTo(x + tw / 2 + 4, yLo); ctx.stroke();
    }
    // marcos de transição de fase (P.F./P.E.) — só quando a substância
    // tem dados de mudança de fase (água, etanol)
    if (marcos) {
      marcos.forEach(m => {
        const y = yOf(m.t);
        ctx.strokeStyle = cssVar('--accent-amber'); ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(x - tw / 2 - 5, y); ctx.lineTo(x + tw / 2 + 5, y); ctx.stroke();
        ctx.fillStyle = cssVar('--accent-amber'); ctx.font = '700 8px Consolas, monospace';
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(m.label, x + tw / 2 + 9, y - 8);
      });
    }
    // escala
    ctx.font = '9px Consolas, monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    const passo = Math.max(10, Math.round((Tmax - Tmin) / 8 / 10) * 10);
    for (let t = Math.ceil(Tmin / passo) * passo; t <= Tmax; t += passo) {
      const y = yOf(t);
      ctx.strokeStyle = cssVar('--text-muted');
      ctx.beginPath(); ctx.moveTo(x + tw / 2, y); ctx.lineTo(x + tw / 2 + 6, y); ctx.stroke();
      ctx.fillStyle = cssVar('--text-muted');
      ctx.fillText(`${fmt(t, 0)}°`, x + tw / 2 + 9, y);
    }
    // coluna de líquido: cor fria→quente
    const k = clamp((T - Tmin) / (Tmax - Tmin), 0, 1);
    const col = k < .5 ? cssVar('--accent-endo') : cssVar('--flame-a');
    ctx.fillStyle = col;
    const yT = yOf(T);
    ctx.beginPath();
    ctx.roundRect(x - 3.5, yT, 7, Math.max(0, yOf(Tmin) - yT) + 6, 3.5);
    ctx.fill();
    ctx.beginPath(); ctx.arc(x, yOf(Tmin) + 14, 11, 0, 6.29); ctx.fill();
    ctx.strokeStyle = cssVar('--glass');
    ctx.beginPath(); ctx.arc(x, yOf(Tmin) + 14, 11, 0, 6.29); ctx.stroke();
    // leitura
    ctx.fillStyle = cssVar('--accent-amber');
    ctx.font = '700 13px Consolas, monospace'; ctx.textAlign = 'center';
    ctx.fillText(`${fmt(T, 1)} °C`, x, top - 22);
  }

  /* ═══════════ MODO 2 — CURVA DE AQUECIMENTO ═══════════ */
  drawCurva() {
    const { ctx, W, H } = this;
    const st = this.curva;
    const padL = 58, padR = 30, padT = 34, padB = 64;
    const gx = padL, gy = padT, gw = W - padL - padR, gh = H - padT - padB;
    const Tlo = Math.min(-30, st.Ti - 5), Thi = Math.max(130, st.Tf + 5);
    const xOf = q => gx + gw * (st.totalQ ? q / st.totalQ : 0);
    const yOf = t => gy + gh * (1 - (t - Tlo) / (Thi - Tlo));

    // eixos
    ctx.strokeStyle = cssVar('--text-muted'); ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx, gy + gh); ctx.lineTo(gx + gw, gy + gh); ctx.stroke();
    ctx.fillStyle = cssVar('--text-secondary');
    ctx.font = '10px Consolas, monospace';
    ctx.textAlign = 'center'; ctx.fillText('Calor fornecido Q (kJ) →', gx + gw / 2, gy + gh + 30);
    ctx.save(); ctx.translate(gx - 40, gy + gh / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillText('Temperatura (°C) →', 0, 0); ctx.restore();

    // linhas-guia de 0 °C e 100 °C
    ctx.setLineDash([4, 5]); ctx.strokeStyle = cssVar('--border');
    [0, 100].forEach(t => {
      ctx.beginPath(); ctx.moveTo(gx, yOf(t)); ctx.lineTo(gx + gw, yOf(t)); ctx.stroke();
      ctx.fillStyle = cssVar('--text-muted'); ctx.textAlign = 'right';
      ctx.fillText(`${t} °C`, gx - 6, yOf(t) + 3);
    });
    ctx.setLineDash([]);
    ctx.textAlign = 'right';
    ctx.fillText(`${fmt(st.Ti, 0)} °C`, gx - 6, yOf(st.Ti) + 3);
    ctx.fillText(`${fmt(st.Tf, 0)} °C`, gx - 6, yOf(st.Tf) + 3);

    // segmentos coloridos por fase
    const segCol = { gelo: cssVar('--ice'), fusao: cssVar('--accent-endo'), agua: cssVar('--accent-cyan'), vapor: cssVar('--accent-endo'), vaporS: cssVar('--flame-a') };
    let q0 = 0;
    ctx.lineWidth = 3.4; ctx.lineCap = 'round';
    st.segs.forEach(s => {
      ctx.strokeStyle = segCol[s.fase] || cssVar('--accent-main');
      ctx.beginPath();
      ctx.moveTo(xOf(q0), yOf(s.T0));
      ctx.lineTo(xOf(q0 + s.Q), yOf(s.T1));
      ctx.stroke();
      q0 += s.Q;
    });

    // marcador animado
    const pos = this._curvaPoint(st.Qcur);
    ctx.fillStyle = cssVar('--accent-main');
    ctx.beginPath(); ctx.arc(xOf(st.Qcur), yOf(pos.T), 7, 0, 6.29); ctx.fill();
    ctx.strokeStyle = cssVar('--bg-void'); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(xOf(st.Qcur), yOf(pos.T), 7, 0, 6.29); ctx.stroke();

    // etiqueta do estado atual
    ctx.fillStyle = cssVar('--accent-amber');
    ctx.font = '700 12px Consolas, monospace'; ctx.textAlign = 'center';
    const lx = clamp(xOf(st.Qcur), gx + 70, gx + gw - 70);
    ctx.fillText(pos.rotulo, lx, yOf(pos.T) - 16);
    ctx.fillStyle = cssVar('--text-secondary');
    ctx.font = '10px Consolas, monospace';
    ctx.fillText(`Q = ${fmt(st.Qcur / 1000, 1)} kJ · T = ${fmt(pos.T, 1)} °C`, lx, yOf(pos.T) - 32);

    // barra inferior: energia por etapa
    let bq = 0; const by = gy + gh + 40, bh2 = 8;
    st.segs.forEach(s => {
      const x0 = xOf(bq), x1 = xOf(bq + s.Q);
      ctx.fillStyle = (segCol[s.fase] || cssVar('--accent-main')) + 'CC';
      ctx.fillRect(x0, by, Math.max(1, x1 - x0), bh2);
      if (x1 - x0 > 64) {
        ctx.fillStyle = cssVar('--text-muted'); ctx.font = '9px Consolas, monospace';
        ctx.fillText(`${fmt(s.Q / 1000, 0)} kJ`, (x0 + x1) / 2, by + bh2 + 10);
      }
      bq += s.Q;
    });
  }

  /**
   * Desenha o CONTEÚDO do recipiente (dentro do clip) para uma FASE dada
   * (e, se for 'fusao'/'vapor', o progresso fracSeg 0–1 dentro do
   * patamar) — incluindo a COEXISTÊNCIA de fases nos patamares (fusão e
   * vaporização não são trocas instantâneas: parte já virou a fase
   * seguinte, parte ainda não). Serve tanto para uma transição ANIMADA
   * em curso quanto para o estado PARADO de água/etanol fora de uma
   * transição (fracSeg irrelevante nesse caso — fase já é só
   * 'gelo'/'agua'/'vaporS', nunca 'fusao'/'vapor').
   * Retorna {vapor} — intensidade (0–1) de vapor a desenhar por FORA do
   * clip (chame _texturaVapor após o ctx.restore() do clip do chamador).
   */
  _desenharFaseAtual(bx, by, bw, bh, lvl, cor, fase, fracSeg, time) {
    const CORLIQ = cor, CORSOL = shadeColor(cor, 70);
    if (fase === 'vaporS') {
      return { vapor: 1 }; // virou gás por completo: nada "dentro"
    }
    if (fase === 'fusao') {
      // COEXISTÊNCIA no P.F.: começa quase só sólido, termina quase só
      // líquido — nunca uma troca instantânea, como é a fusão de verdade.
      this._drawAmostra('liquido', bx, by, bw, bh, lvl, CORLIQ, time);
      this._texturaGeloParcial(bx, by, bw, bh, lvl, CORSOL, 1 - fracSeg);
      return { vapor: 0 };
    }
    if (fase === 'vapor') {
      // COEXISTÊNCIA no P.E.: o líquido vai sumindo aos poucos enquanto o
      // vapor sobe cada vez mais forte — não é uma troca instantânea.
      const lvlFerv = lvl + ((by + bh) - lvl) * (fracSeg * .55);
      this._drawAmostra('liquido', bx, by, bw, bh, lvlFerv, CORLIQ, time);
      return { vapor: .3 + .65 * fracSeg };
    }
    const textura = fase === 'gelo' ? 'gelo' : 'liquido';
    this._drawAmostra(textura, bx, by, bw, bh, lvl, fase === 'gelo' ? CORSOL : CORLIQ, time);
    return { vapor: 0 };
  }

  /** Fase de uma substância com dados de mudança de fase a uma dada T,
   *  quando NÃO há transição animada em curso (fora dos patamares —
   *  aqui não existe "coexistência", só uma fase de cada vez). */
  _faseEstaticaDeT(fasesDados, T) {
    if (T < fasesDados.Tfusao) return 'gelo';
    if (T > fasesDados.Tebulicao) return 'vaporS';
    return 'agua';
  }

  /** Como _texturaGelo, mas desenha só uma FRAÇÃO dos blocos (0–1) — usada
   *  durante a fusão, para o sólido ir "sumindo" aos poucos sobre o líquido,
   *  em vez de trocar de textura de um instante para o outro. */
  _texturaGeloParcial(bx, by, bw, bh, lvl, cor, proporcao) {
    const { ctx } = this;
    const fillH = (by + bh) - lvl;
    if (fillH <= 1 || proporcao <= .02) return;
    const cols = Math.max(2, Math.round(bw / 26));
    const rows = Math.max(1, Math.round(fillH / 20));
    const total = cols * rows;
    const manter = Math.round(total * clamp(proporcao, 0, 1));
    let seed = 811;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    const cw = bw / cols, ch = fillH / rows;
    let idx = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++, idx++) {
        const jx = (rnd() - .5) * 4, jy = (rnd() - .5) * 3;
        if (idx >= manter) continue; // este bloco já "derreteu"
        const x = bx + c * cw + 2 + jx, y = lvl + r * ch + 2 + jy;
        const w = Math.max(2, cw - 4), h = Math.max(2, ch - 4);
        ctx.fillStyle = cor + 'D0';
        ctx.beginPath(); ctx.roundRect(x, y, w, h, 3); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1; ctx.stroke();
      }
    }
  }

  /** Posição (T, fase) na curva para um calor acumulado q. fracSeg = progresso 0→1 dentro do trecho/patamar atual. */
  _curvaPoint(q) {
    return pontoNosSegmentos(this.curva.segs, this.curva.fasesTxt, q);
  }

  /* ═══════════ MODO 3 — DIAGRAMA ENDO × EXO ═══════════ */
  _perfilGeom() {
    const { W, H } = this;
    const r = this.perfil.r;
    const padL = 64, padR = 96, padT = 44, padB = 56;
    const xa = padL + 26, xb = W - padR - 26, xm = (xa + xb) / 2;
    const hi = Math.max(r.Ea, r.dH, 0), lo = Math.min(0, r.dH);
    const span = (hi - lo) || 1;
    const yOf = h => padT + (H - padT - padB) * (1 - (h - lo) / span);
    return { xa, xb, xm, yOf, padL, padT, padB };
  }

  drawPerfil() {
    const { ctx, W, H } = this;
    const st = this.perfil, r = st.r;
    const g = this._perfilGeom();
    const y0 = g.yOf(0), yP = g.yOf(r.dH), yEa = g.yOf(r.Ea);
    const exo = r.dH < 0;
    const cEXO = cssVar('--accent-exo'), cENDO = cssVar('--accent-endo');

    // eixos
    ctx.strokeStyle = cssVar('--text-muted'); ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(g.padL - 20, g.padT - 14); ctx.lineTo(g.padL - 20, H - g.padB + 8);
    ctx.lineTo(W - 30, H - g.padB + 8); ctx.stroke();
    ctx.fillStyle = cssVar('--text-secondary'); ctx.font = '10px Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Caminho da reação →', (g.padL + W - 30) / 2, H - g.padB + 30);
    ctx.save(); ctx.translate(g.padL - 44, H / 2 - 10); ctx.rotate(-Math.PI / 2);
    ctx.fillText('Entalpia H →', 0, 0); ctx.restore();

    // patamares Hr / Hp
    ctx.setLineDash([5, 5]); ctx.strokeStyle = cssVar('--border-active');
    ctx.beginPath(); ctx.moveTo(g.padL - 10, y0); ctx.lineTo(g.xm, y0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(g.xm, yP); ctx.lineTo(W - 34, yP); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = cssVar('--text-primary'); ctx.font = '700 11px Consolas, monospace';
    ctx.textAlign = 'left';
    ctx.fillText('Reagentes (Hr)', g.padL - 10, y0 - 8);
    ctx.textAlign = 'right';
    ctx.fillText('Produtos (Hp)', W - 34, yP - 8);

    // curva com catalisador (tracejada) — mesma altura de chegada!
    const eaCat = exo ? r.Ea * CATALISADOR_FATOR
                      : r.dH + (r.Ea - r.dH) * CATALISADOR_FATOR;
    if (st.cat) {
      ctx.setLineDash([6, 5]);
      this._perfilCurve(g, g.yOf(eaCat), cssVar('--accent-ok'), 2);
      ctx.setLineDash([]);
      ctx.fillStyle = cssVar('--accent-ok'); ctx.font = '10px Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`Ea(cat) = ${fmt(eaCat, 0)} kJ`, g.xm, g.yOf(eaCat) + 16);
    }

    // curva principal
    this._perfilCurve(g, yEa, exo ? cEXO : cENDO, 3.2);

    // complexo ativado
    ctx.fillStyle = cssVar('--accent-main');
    ctx.beginPath(); ctx.arc(g.xm, yEa, 4, 0, 6.29); ctx.fill();
    ctx.font = '10px Consolas, monospace'; ctx.textAlign = 'center';
    ctx.fillText('Complexo ativado', g.xm, yEa - 12);

    // seta de Ea (dos reagentes ao pico)
    this._vArrow(g.xa + 34, y0, yEa, cssVar('--accent-main'), `Ea = ${fmt(r.Ea, 0)} kJ`, 'left');
    // seta de ΔH (Hr → Hp), à direita
    this._vArrow(W - 62, y0, yP, exo ? cEXO : cENDO, `ΔH = ${fmt(r.dH, 1)} kJ`, 'right');

    // bola da reação percorrendo a curva
    if (st.playing || st.t > 0) {
      const p = this._perfilPoint(g, yEa, easeIO(st.t));
      const grad = ctx.createRadialGradient(p.x - 2, p.y - 2, 1, p.x, p.y, 8);
      grad.addColorStop(0, '#fff'); grad.addColorStop(1, cssVar('--accent-amber'));
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(p.x, p.y, 8, 0, 6.29); ctx.fill();
    }
    // explosão exo / sucção endo ao final
    st.burst.forEach(p => {
      ctx.globalAlpha = clamp(p.life, 0, 1);
      ctx.fillStyle = p.exo ? cEXO : cENDO;
      ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, 6.29); ctx.fill();
      ctx.globalAlpha = 1;
    });

    // legenda da equação
    ctx.fillStyle = cssVar('--text-secondary'); ctx.font = '11px Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(r.eq, W / 2, g.padT - 24 + 14);
    ctx.fillStyle = exo ? cEXO : cENDO;
    ctx.font = '700 11px Consolas, monospace';
    ctx.fillText(exo ? 'EXOTÉRMICA · libera calor' : 'ENDOTÉRMICA · absorve calor', W / 2, H - 16);
  }

  _perfilCurve(g, yPeak, color, w) {
    const { ctx } = this;
    const y0 = g.yOf(0), yP = g.yOf(this.perfil.r.dH);
    ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(g.xa, y0);
    ctx.bezierCurveTo(g.xa + (g.xm - g.xa) * .55, y0, g.xm - (g.xm - g.xa) * .5, yPeak, g.xm, yPeak);
    ctx.bezierCurveTo(g.xm + (g.xb - g.xm) * .5, yPeak, g.xb - (g.xb - g.xm) * .55, yP, g.xb, yP);
    ctx.stroke();
  }

  _perfilPoint(g, yPeak, s) {
    const y0 = g.yOf(0), yP = g.yOf(this.perfil.r.dH);
    const bez = (p0, p1, p2, p3, t) => {
      const u = 1 - t;
      return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
    };
    if (s <= .5) {
      const t = s * 2;
      return {
        x: bez(g.xa, g.xa + (g.xm - g.xa) * .55, g.xm - (g.xm - g.xa) * .5, g.xm, t),
        y: bez(y0, y0, yPeak, yPeak, t),
      };
    }
    const t = (s - .5) * 2;
    return {
      x: bez(g.xm, g.xm + (g.xb - g.xm) * .5, g.xb - (g.xb - g.xm) * .55, g.xb, t),
      y: bez(yPeak, yPeak, yP, yP, t),
    };
  }

  _vArrow(x, y1, y2, color, label, side) {
    const { ctx } = this;
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, y1); ctx.lineTo(x, y2); ctx.stroke();
    const dir = y2 < y1 ? -1 : 1;
    ctx.beginPath();
    ctx.moveTo(x, y2); ctx.lineTo(x - 4, y2 - 7 * dir); ctx.lineTo(x + 4, y2 - 7 * dir);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - 5, y1); ctx.lineTo(x + 5, y1); ctx.stroke();
    ctx.font = '700 10px Consolas, monospace';
    ctx.textAlign = side === 'left' ? 'left' : 'right';
    ctx.fillText(label, side === 'left' ? x + 8 : x - 8, (y1 + y2) / 2);
  }

  /* ═══════════ MODO 4 — LEI DE HESS (níveis de entalpia) ═══════ */
  drawHess() {
    const { ctx, W, H } = this;
    const ex = this.hess.ex;
    const padT = 52, padB = 78, padX = 40;
    const Hs = ex.niveis.map(n => n.H);
    const hi = Math.max(...Hs), lo = Math.min(...Hs);
    const span = (hi - lo) || 1;
    const yOf = h => padT + (H - padT - padB) * (1 - (h - lo) / span);
    const laneW = (W - padX * 2) / ex.niveis.length;
    const xOf = i => padX + laneW * i + laneW / 2;
    const half = clamp(laneW * .34, 44, 92);

    // níveis
    ex.niveis.forEach((n, i) => {
      const y = yOf(n.H), x = xOf(i);
      ctx.strokeStyle = cssVar('--text-primary'); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x - half, y); ctx.lineTo(x + half, y); ctx.stroke();
      ctx.fillStyle = cssVar('--text-secondary');
      ctx.font = '11px Consolas, monospace'; ctx.textAlign = 'center';
      ctx.fillText(n.label, x, y - 22);
      ctx.fillStyle = cssVar('--accent-amber');
      ctx.font = '700 10px Consolas, monospace';
      ctx.fillText(`H = ${fmt(n.H, 1)} kJ`, x, y - 9);
    });

    // setas do caminho (função de estado): 0→2 e depois 2→1 (ou 1→2)
    const cAr = cssVar('--text-secondary');
    this._hessArrow(xOf(0) + half * .5, yOf(ex.niveis[0].H), xOf(2) - half * .5, yOf(ex.niveis[2].H), cAr,
      `${fmt(ex.niveis[2].H - ex.niveis[0].H, 1)} kJ`);
    this._hessArrow(xOf(2) - half * .2, yOf(ex.niveis[2].H), xOf(1) + half * .4, yOf(ex.niveis[1].H), cAr,
      `${fmt(ex.niveis[1].H - ex.niveis[2].H, 1)} kJ`);

    // seta-alvo 0→1 (tracejada até resolver; verde depois)
    const solved = this.hess.solved;
    const alvoCol = solved ? cssVar('--accent-ok')
      : (this.hess.flash > 0 ? cssVar('--accent-exo') : cssVar('--accent-main'));
    ctx.setLineDash(solved ? [] : [6, 5]);
    this._hessArrow(xOf(0) - half * .2, yOf(ex.niveis[0].H), xOf(1) - half * .4, yOf(ex.niveis[1].H), alvoCol,
      solved ? `ΔH alvo = ${fmt(ex.resposta, 1)} kJ` : 'ΔH alvo = ?', true);
    ctx.setLineDash([]);

    // Σ atual do estudante
    ctx.fillStyle = cssVar('--text-secondary'); ctx.font = '11px Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('H é função de estado: o caminho não importa — só o início e o fim.', W / 2, H - 44);
    ctx.fillStyle = solved ? cssVar('--accent-ok') : cssVar('--accent-amber');
    ctx.font = '700 13px Consolas, monospace';
    ctx.fillText(`Σ das suas etapas = ${fmt(this.hess.soma, 1)} kJ` + (solved ? '  ✔' : ''), W / 2, H - 22);
  }

  _hessArrow(x1, y1, x2, y2, color, label, big) {
    const { ctx } = this;
    ctx.strokeStyle = color; ctx.fillStyle = color;
    ctx.lineWidth = big ? 2.6 : 1.8;
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 - 26;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(mx, my, x2, y2); ctx.stroke();
    const ang = Math.atan2(y2 - my, x2 - mx);
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - 9 * Math.cos(ang - .4), y2 - 9 * Math.sin(ang - .4));
    ctx.lineTo(x2 - 9 * Math.cos(ang + .4), y2 - 9 * Math.sin(ang + .4));
    ctx.closePath(); ctx.fill();
    ctx.font = `${big ? '700 ' : ''}10px Consolas, monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(label, mx, my - 6);
  }

  /* ═══════════ MODO 5 — ENERGIA DE LIGAÇÃO (projeção 3D) ═══════ */
  drawLigacao() {
    const { ctx, W, H } = this;
    const st = this.lig, r = st.r;
    const dH = this._ligDH();
    const exo = dH < 0;
    const midX = W / 2;
    const ppa = clamp(Math.min(W, H) / 10.5, 16, 46);

    // títulos das metades (trocam de papel quando a reação é invertida)
    ctx.font = '700 11px Consolas, monospace'; ctx.textAlign = 'center';
    ctx.fillStyle = cssVar('--text-secondary');
    ctx.fillText(st.inverted ? 'Produtos' : 'Reagentes', W * .25, 26);
    ctx.fillText(st.inverted ? 'Reagentes' : 'Produtos', W * .75, 26);

    this._ligGroup(r.reagentes, W * .25, H * .46, W * .44, H * .6, ppa);
    this._ligGroup(r.produtos,  W * .75, H * .46, W * .44, H * .6, ppa);

    // seta central (inverte o sentido junto com a reação)
    const aw = clamp(W * .07, 34, 64);
    ctx.strokeStyle = cssVar('--accent-main'); ctx.fillStyle = cssVar('--accent-main');
    ctx.lineWidth = 3;
    const ay = H * .46;
    const x1 = st.inverted ? midX + aw / 2 : midX - aw / 2;
    const x2 = st.inverted ? midX - aw / 2 : midX + aw / 2;
    const dir = st.inverted ? -1 : 1;
    ctx.beginPath(); ctx.moveTo(x1, ay); ctx.lineTo(x2, ay); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x2 + 6 * dir, ay);
    ctx.lineTo(x2 - 6 * dir, ay - 6); ctx.lineTo(x2 - 6 * dir, ay + 6);
    ctx.closePath(); ctx.fill();

    // setas onduladas de calor: saindo (exo) ou entrando (endo)
    this._heatWaves(midX, ay + 40, exo);

    // barras comparando Σ E(rompidas) × Σ E(formadas) — o "porquê" visual do ΔH
    this._ligBars(H - 60);

    // resultado
    ctx.fillStyle = exo ? cssVar('--accent-exo') : cssVar('--accent-endo');
    ctx.font = '700 15px Consolas, monospace'; ctx.textAlign = 'center';
    ctx.fillText(`ΔH ≈ ${fmt(dH, 0)} kJ · ${exo ? 'EXOTÉRMICA' : 'ENDOTÉRMICA'}`, midX, H - 20);
  }

  /** Soma de energia das ligações rompidas/formadas, já considerando inversão. */
  _ligSums() {
    const st = this.lig, r = st.r;
    const romp = st.inverted ? r.formadas : r.rompidas;
    const form = st.inverted ? r.rompidas : r.formadas;
    const soma = l => l.reduce((s, [b, n]) => s + n * ENERGIA_LIGACAO[b], 0);
    return { romp: soma(romp), form: soma(form) };
  }

  /** Duas barrinhas horizontais comparando ΣE(rompidas) e ΣE(formadas) —
   *  a maior das duas "decide" se a reação é exo ou endotérmica. */
  _ligBars(y) {
    const { ctx, W } = this;
    const { romp, form } = this._ligSums();
    const maxV = Math.max(romp, form) || 1;
    const barW = clamp(W * .3, 90, 190);
    const barH = 8, passo = 16;
    const x0 = W / 2 - barW / 2;
    const linhas = [
      { label: 'Romper (+)', val: romp, col: cssVar('--accent-endo') },
      { label: 'Formar (−)', val: form, col: cssVar('--accent-exo') },
    ];
    ctx.textBaseline = 'middle';
    linhas.forEach((ln, i) => {
      const yy = y + i * passo;
      ctx.fillStyle = cssVar('--bg-void');
      ctx.strokeStyle = cssVar('--border');
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(x0, yy, barW, barH, 4); ctx.fill(); ctx.stroke();
      const w = barW * clamp(ln.val / maxV, 0, 1);
      ctx.fillStyle = ln.col;
      ctx.beginPath(); ctx.roundRect(x0, yy, Math.max(4, w), barH, 4); ctx.fill();
      ctx.fillStyle = cssVar('--text-secondary'); ctx.font = '9px Consolas, monospace'; ctx.textAlign = 'right';
      ctx.fillText(ln.label, x0 - 8, yy + barH / 2);
      ctx.fillStyle = cssVar('--text-primary'); ctx.font = '700 9px Consolas, monospace'; ctx.textAlign = 'left';
      ctx.fillText(`${fmt(ln.val, 0)} kJ`, x0 + barW + 8, yy + barH / 2);
    });
  }

  _ligDH() {
    const r = this.lig.r;
    const soma = lista => lista.reduce((s, [b, n]) => s + n * ENERGIA_LIGACAO[b], 0);
    const dh = soma(r.rompidas) - soma(r.formadas);
    return this.lig.inverted ? -dh : dh;
  }

  _ligGroup(especies, cx, cy, boxW, boxH, ppa) {
    const { ctx } = this;
    const st = this.lig;
    // expande contagens em instâncias individuais
    const inst = [];
    especies.forEach(e => { for (let i = 0; i < e.n; i++) inst.push(e.mol); });
    const cols = Math.ceil(Math.sqrt(inst.length));
    const rows = Math.ceil(inst.length / cols);
    const dx = boxW / cols, dy = boxH / rows;
    inst.forEach((molId, i) => {
      const c = i % cols, rw = Math.floor(i / cols);
      const x = cx - boxW / 2 + dx * (c + .5);
      const y = cy - boxH / 2 + dy * (rw + .5);
      const spin = st.ry + i * 0.9; // defasagem para cada cópia
      drawMolecule(ctx, MOLECULAS_3D[molId], x, y, Math.min(ppa, dx / 3.4, dy / 3.4), st.rx, spin, st.labels);
    });
    // legenda química do grupo
    ctx.fillStyle = cssVar('--text-muted');
    ctx.font = '10px Consolas, monospace'; ctx.textAlign = 'center';
    const rotulo = especies.map(e => `${e.n > 1 ? e.n + ' ' : ''}${MOLECULAS_3D[e.mol].formula}`).join(' + ');
    ctx.fillText(rotulo, cx, cy + boxH / 2 + 18);
  }

  _heatWaves(cx, y, exo) {
    const { ctx, time } = this;
    const col = exo ? cssVar('--accent-exo') : cssVar('--accent-endo');
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 2;
    const t = isReduced() ? 0 : time * 2.2;
    for (let k = -1; k <= 1; k++) {
      const x0 = cx + k * 22;
      ctx.beginPath();
      for (let i = 0; i <= 26; i += 2) {
        const yy = exo ? y + i : y + 26 - i;      // exo desce (sai), endo sobe (entra)
        const xx = x0 + Math.sin(i * .5 + t + k) * 4;
        i === 0 ? ctx.moveTo(xx, yy) : ctx.lineTo(xx, yy);
      }
      ctx.stroke();
      const tipY = exo ? y + 30 : y - 4;
      const d = exo ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(x0, tipY + 4 * d);
      ctx.lineTo(x0 - 4, tipY - 3 * d); ctx.lineTo(x0 + 4, tipY - 3 * d);
      ctx.closePath(); ctx.fill();
    }
  }

  // ── ponteiro: arrastar gira as moléculas 3D ─────────────────────
  _bindPointer() {
    const cv = this.canvas;
    let lastX = 0, lastY = 0;
    cv.addEventListener('pointerdown', e => {
      if (this.mode !== 'ligacao') return;
      this.lig.dragging = true;
      lastX = e.clientX; lastY = e.clientY;
      try { cv.setPointerCapture(e.pointerId); } catch (err) {}
    });
    cv.addEventListener('pointermove', e => {
      if (!this.lig.dragging) return;
      this.lig.ry += (e.clientX - lastX) * 0.008;
      this.lig.rx = clamp(this.lig.rx + (e.clientY - lastY) * 0.008, -1.25, 1.25);
      lastX = e.clientX; lastY = e.clientY;
    });
    const end = () => { this.lig.dragging = false; };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
  }
}

// ══════════════════════════════════════════════════════════════════
// APLICAÇÃO — classe ThermoApp (liga o DOM à ThermoSim)
// ══════════════════════════════════════════════════════════════════
const MODOS_ORDEM = ['calor', 'curva', 'perfil', 'hess', 'ligacao'];
const PAINEIS_POR_MODO = {
  calor:   ['panel-calor', 'panel-controles'],
  curva:   ['panel-curva'],
  perfil:  ['panel-perfil'],
  hess:    ['panel-hess'],
  ligacao: ['panel-ligacao', 'panel-tabela'],
};
const HINT_CANVAS = {
  calor:   'Enter/Espaço: trocar calor',
  curva:   'Enter/Espaço: aquecer',
  perfil:  'Enter/Espaço: reproduzir a reação',
  hess:    'Enter/Espaço: somar as equações',
  ligacao: 'Arraste (ou setas ←→↑↓) para girar em 3D',
};

class ThermoApp {
  constructor() {
    this.canvas = document.getElementById('sim-canvas');
    this.sim = new ThermoSim(this.canvas, ev => this._onSimEvent(ev));
    this.mode = 'calor';

    // Lei de Hess — operações do estudante sobre cada etapa
    this.hessIdx = 0;
    this.hessOps = [];
    this.hessSolved = false;

    this._buildSubstancias();
    this._syncCalorFaixa(SUBSTANCIAS[0]);
    this._buildCurvaSubstancias();
    this._syncCurvaFaixa(CURVA_SUBSTANCIAS[0], true);
    this._buildPerfilList();
    this._buildLigacaoList();
    this._buildBondTable();
    this._buildHessSelect();
    this._renderHess(0);

    this._bindPanels();
    this._bindModes();
    this._bindCalor();
    this._bindCurva();
    this._bindPerfil();
    this._bindHess();
    this._bindLigacao();
    this._bindGlobal();

    // ── Estado inicial: NENHUM modo ativo — nada é desenhado no canvas
    //    até o usuário clicar em "Ativar" no painel do modo desejado
    //    (mesmo contrato do SILQ: canvas em branco por padrão). ──
    this.started = false;
    document.querySelectorAll('[data-mode]').forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-selected', 'false');
    });
    Object.values(PAINEIS_POR_MODO).flat().forEach(id => {
      const p = document.getElementById(id);
      if (p) p.hidden = true;
    });
    document.querySelectorAll('.panel[data-mode-card]').forEach(panel => {
      const header = panel.querySelector('.panel-header');
      if (header) { header.removeAttribute('aria-current'); header.setAttribute('aria-expanded', 'false'); }
      const body = panel.querySelector('.panel-body');
      if (body) body.classList.add('collapsed');
    });
    const hint0 = document.getElementById('canvas-hint');
    if (hint0) hint0.textContent = 'Escolha um modo ao lado e clique em "Ativar" para iniciar a simulação.';
    const ov0 = document.getElementById('overlay-label');
    if (ov0) ov0.textContent = 'SITQ';
    this.refreshResults();

    this.sim.resize();
    window.addEventListener('resize', () => this.sim.resize());

    announce('SITQ carregado. Nenhum modo ativo. Escolha um modo à esquerda e ative-o para começar.');
    this._frames = 0; this._fpsT = 0; this._last = performance.now();
    requestAnimationFrame(() => this._loop());
  }

  /* ── construção das listas a partir dos DADOS ────────────────── */
  _buildSubstancias() {
    const grid = document.getElementById('subst-grid');
    SUBSTANCIAS.forEach((s, i) => {
      const b = document.createElement('button');
      b.className = 'subst-btn' + (i === 0 ? ' active' : '');
      b.setAttribute('role', 'option');
      b.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
      b.style.setProperty('--dot', s.cor);
      b.innerHTML = `<span class="subst-dot" aria-hidden="true"></span>` +
        `<span class="subst-nome">${s.nome}</span>` +
        `<span class="subst-c">${fmt(s.c, 3)}</span>`;
      b.setAttribute('aria-label', `${s.nome}, calor específico ${fmt(s.c, 3)} joules por grama grau Celsius`);
      b.addEventListener('click', () => {
        grid.querySelectorAll('.subst-btn').forEach(x => { x.classList.remove('active'); x.setAttribute('aria-selected', 'false'); });
        b.classList.add('active'); b.setAttribute('aria-selected', 'true');
        this.sim.calor.sub = s;
        this.sim.calor.fired = false;
        this._syncCalorFaixa(s);
        playTone(760, .06, .05);
        this._syncOverlay();
        this.refreshResults();
        announce(`${s.nome} selecionada. Calor específico: ${fmt(s.c, 3)} joule por grama grau Celsius.` +
          (s.faixa ? ` Controles de temperatura ajustados para ${fmt(s.faixa[0], 0)} a ${fmt(s.faixa[1], 0)} graus, faixa onde essa fase existe a 1 atmosfera.` : ''));
      });
      grid.appendChild(b);
    });
  }

  /**
   * Ajusta min/max dos sliders T inicial/final à faixa onde a
   * substância escolhida REALMENTE está na fase indicada (a 1 atm) —
   * evita, por exemplo, "esfriar água líquida" a −20 °C. Sem faixa
   * definida (metais, vidro, areia, óleo), os controles usam o
   * intervalo padrão do simulador (PHYS.T_MIN…T_MAX).
   *
   * Água e etanol têm dados COMPLETOS de mudança de fase (ver
   * CURVA_SUBSTANCIAS) — para essas duas, os controles liberam a
   * faixa AMPLA (faixaPadrao) em vez da faixa de uma única fase, e o
   * béquer passa a mostrar a transição de verdade (sólido↔líquido↔
   * vapor, com coexistência nos patamares) em vez de ficar travado
   * numa fase só. As demais substâncias continuam exatamente como
   * antes (uma fase só, sem dados de calor latente disponíveis).
   */
  _syncCalorFaixa(sub) {
    const fasesDados = CURVA_SUBSTANCIAS.find(c => c.id === sub.id) || null;
    const [fmin, fmax] = fasesDados ? fasesDados.faixaPadrao : (sub.faixa || [PHYS.T_MIN, PHYS.T_MAX]);
    const tiEl = document.getElementById('calor-ti');
    const tfEl = document.getElementById('calor-tf');
    const outTi = document.getElementById('out-calor-ti');
    const outTf = document.getElementById('out-calor-tf');
    tiEl.min = fmin; tiEl.max = fmax;
    tfEl.min = fmin; tfEl.max = fmax;
    const ti = clamp(+tiEl.value, fmin, fmax);
    const tf = clamp(+tfEl.value, fmin, fmax);
    tiEl.value = ti; tfEl.value = tf;
    if (outTi) outTi.textContent = `${fmt(ti, 0)} °C`;
    if (outTf) outTf.textContent = `${fmt(tf, 0)} °C`;
    const st = this.sim.calor;
    st.sub = sub; // esta função agora é autossuficiente: define a substância ela mesma
    st.fasesDados = fasesDados;
    st.Ti = ti; st.Tf = tf; st.Tcur = ti;
    st.fired = false; st.running = false; st.phase = 1; st.Qcur = 0; st.segs = [];
  }

  /** Botões de substância do modo Curva (por ora, água e etanol — cada uma com seu próprio P.F./P.E.). */
  _buildCurvaSubstancias() {
    const grid = document.getElementById('curva-subst-grid');
    if (!grid) return;
    CURVA_SUBSTANCIAS.forEach((s, i) => {
      const b = document.createElement('button');
      b.className = 'subst-btn' + (i === 0 ? ' active' : '');
      b.setAttribute('role', 'option');
      b.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
      b.style.setProperty('--dot', s.cor);
      b.innerHTML = `<span class="subst-dot" aria-hidden="true"></span>` +
        `<span class="subst-nome">${s.nome}</span>` +
        `<span class="subst-c">${fmt(s.Tfusao, 0)}…${fmt(s.Tebulicao, 0)} °C</span>`;
      b.setAttribute('aria-label', `${s.nome}: funde a ${fmt(s.Tfusao, 0)} graus, ferve a ${fmt(s.Tebulicao, 0)} graus`);
      b.addEventListener('click', () => {
        grid.querySelectorAll('.subst-btn').forEach(x => { x.classList.remove('active'); x.setAttribute('aria-selected', 'false'); });
        b.classList.add('active'); b.setAttribute('aria-selected', 'true');
        playTone(760, .06, .05);
        this._syncCurvaFaixa(s);
        this._syncOverlay();
        announce(`${s.nome} selecionada na curva de aquecimento. Funde a ${fmt(s.Tfusao, 0)} graus, ferve a ${fmt(s.Tebulicao, 0)} graus Celsius.`);
      });
      grid.appendChild(b);
    });
  }

  /**
   * Ajusta min/max dos sliders T inicial/final à faixaPadrao da
   * substância escolhida na Curva — cada uma tem P.F./P.E. bem
   * diferentes (água: 0/100 °C; etanol: −114/78 °C), então uma faixa
   * fixa de slider não serve pras duas. Ao contrário do Calorímetro,
   * aqui a faixa inclui DE PROPÓSITO os dois pontos de transição, já
   * que o objetivo do modo é justamente atravessá-los.
   */
  _syncCurvaFaixa(sub, inicial) {
    const [fmin, fmax] = sub.faixaPadrao;
    const tiEl = document.getElementById('curva-ti');
    const tfEl = document.getElementById('curva-tf');
    const outTi = document.getElementById('out-curva-ti');
    const outTf = document.getElementById('out-curva-tf');
    tiEl.min = fmin; tiEl.max = fmax;
    tfEl.min = fmin; tfEl.max = fmax;
    const ti = inicial ? fmin : clamp(+tiEl.value, fmin, fmax);
    const tf = inicial ? fmax : clamp(+tfEl.value, fmin, fmax);
    tiEl.value = ti; tfEl.value = tf;
    if (outTi) outTi.textContent = `${fmt(ti, 0)} °C`;
    if (outTf) outTf.textContent = `${fmt(tf, 0)} °C`;
    const st = this.sim.curva;
    st.sub = sub; st.Ti = ti; st.Tf = tf;
    st.Qcur = 0; st.running = false; st.done = false;
    this.sim.buildCurva();
    if (!inicial) { this.refreshResults(); }
    const hint = document.getElementById('curva-hint');
    if (hint) {
      hint.textContent = `Aqueça ${sub.nome.toLowerCase()} do sólido ao vapor e observe os dois patamares — fusão (${fmt(sub.Tfusao, 0)} °C) e ebulição (${fmt(sub.Tebulicao, 0)} °C) — onde a temperatura não muda, mas as duas fases coexistem.`;
    }
  }

  _buildPerfilList() {
    const list = document.getElementById('perfil-list');
    REACOES_PERFIL.forEach((r, i) => {
      const b = document.createElement('button');
      b.className = 'model-btn' + (i === 0 ? ' active' : '');
      b.setAttribute('role', 'option');
      b.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
      b.innerHTML =
        `<span class="model-year" aria-hidden="true">${r.tipo === 'exo' ? 'EXO' : 'ENDO'}<br>${fmt(r.dH, 0)} kJ</span>` +
        `<span class="model-name">${r.nome}</span>` +
        `<span class="model-sub">${r.eq}</span>`;
      b.setAttribute('aria-label', `${r.nome}. ${r.tipo === 'exo' ? 'Exotérmica' : 'Endotérmica'}, delta H ${fmt(r.dH, 1)} quilojoules.`);
      b.addEventListener('click', () => {
        list.querySelectorAll('.model-btn').forEach(x => { x.classList.remove('active'); x.setAttribute('aria-selected', 'false'); });
        b.classList.add('active'); b.setAttribute('aria-selected', 'true');
        this.sim.perfil.r = r;
        this.sim.perfil.t = 0; this.sim.perfil.playing = false;
        this.sim.perfil.done = false; this.sim.perfil.burst = [];
        playTone(r.tipo === 'exo' ? 620 : 980, .07, .06);
        this._syncOverlay();
        document.getElementById('perfil-desc').textContent = r.desc;
        this.refreshResults();
        announce(`${r.nome} selecionada. ${r.desc}`);
      });
      list.appendChild(b);
    });
    document.getElementById('perfil-desc').textContent = REACOES_PERFIL[0].desc;
  }

  _buildLigacaoList() {
    const list = document.getElementById('ligacao-list');
    REACOES_LIGACAO.forEach((r, i) => {
      const b = document.createElement('button');
      b.className = 'model-btn' + (i === 0 ? ' active' : '');
      b.setAttribute('role', 'option');
      b.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
      b.innerHTML =
        `<span class="model-year" aria-hidden="true">3D</span>` +
        `<span class="model-name">${r.nome}</span>` +
        `<span class="model-sub">${r.sub}</span>`;
      b.addEventListener('click', () => {
        list.querySelectorAll('.model-btn').forEach(x => { x.classList.remove('active'); x.setAttribute('aria-selected', 'false'); });
        b.classList.add('active'); b.setAttribute('aria-selected', 'true');
        this.sim.lig.r = r;
        playTone(880, .07, .06);
        this._syncOverlay();
        document.getElementById('ligacao-obs').textContent = r.obs;
        this.refreshResults();
        announce(`${r.nome} selecionada: ${r.sub}. ${r.obs}`);
      });
      list.appendChild(b);
    });
    document.getElementById('ligacao-obs').textContent = REACOES_LIGACAO[0].obs;
  }

  _buildBondTable() {
    const tb = document.getElementById('bond-table');
    Object.entries(ENERGIA_LIGACAO).forEach(([lig, e]) => {
      const s = document.createElement('span');
      s.innerHTML = `${lig} <b>${e}</b>`;
      tb.appendChild(s);
    });
  }

  _buildHessSelect() {
    const wrap = document.getElementById('hess-select');
    HESS.forEach((ex, i) => {
      const b = document.createElement('button');
      b.className = 'shell-btn';
      b.textContent = ex.titulo;
      b.setAttribute('aria-pressed', i === 0 ? 'true' : 'false');
      b.addEventListener('click', () => {
        wrap.querySelectorAll('.shell-btn').forEach(x => x.setAttribute('aria-pressed', 'false'));
        b.setAttribute('aria-pressed', 'true');
        playTone(700, .06, .05);
        this._renderHess(i);
        announce(`Exercício: ${ex.titulo}. Alvo: ${ex.alvo}. ${ex.dica}`);
      });
      wrap.appendChild(b);
    });
  }

  /* ── Lei de Hess: montagem/estado do exercício atual ─────────── */
  _renderHess(i) {
    this.hessIdx = i;
    const ex = HESS[i];
    this.hessOps = ex.passos.map(() => ({ inv: false, mult: 1 }));
    this.hessSolved = false;
    this.sim.hess.ex = ex;
    this.sim.hess.solved = false;
    this.sim.hess.flash = 0;
    this.canvas.classList.remove('sim-canvas--ok');
    document.getElementById('hess-dica').textContent = '💡 ' + ex.dica;
    this._setHessStatus('aguardando', '');
    this._renderHessAlvo();

    const cont = document.getElementById('hess-steps');
    cont.innerHTML = '';
    ex.passos.forEach((p, idx) => {
      const card = document.createElement('div');
      card.className = 'hess-step';

      const eq = document.createElement('p');
      eq.className = 'hess-eq';
      eq.innerHTML = `<span class="rot">${p.rot}.</span>${p.eq}   <span class="dh">ΔH = ${fmt(p.dH, 1)} kJ</span>`;
      card.appendChild(eq);

      const ops = document.createElement('div');
      ops.className = 'hess-ops';

      const inv = document.createElement('button');
      inv.className = 'shell-btn';
      inv.textContent = '⇄ inverter';
      inv.setAttribute('aria-pressed', 'false');
      inv.setAttribute('aria-label', `Inverter a equação ${p.rot} (troca o sinal do delta H)`);
      inv.addEventListener('click', () => {
        this.hessOps[idx].inv = !this.hessOps[idx].inv;
        inv.setAttribute('aria-pressed', String(this.hessOps[idx].inv));
        card.classList.add('tocada');
        playTone(this.hessOps[idx].inv ? 500 : 640, .06, .05);
        this._hessChanged();
      });
      ops.appendChild(inv);

      const lbl = document.createElement('span');
      lbl.className = 'op-label';
      lbl.textContent = '×';
      ops.appendChild(lbl);

      const seg = document.createElement('div');
      seg.className = 'seg';
      seg.setAttribute('role', 'group');
      seg.setAttribute('aria-label', `Multiplicador da equação ${p.rot}`);
      HESS_MULTS.forEach(m => {
        const sb = document.createElement('button');
        sb.className = 'seg-btn';
        sb.textContent = m === 0.5 ? '½' : String(m);
        sb.setAttribute('aria-pressed', m === 1 ? 'true' : 'false');
        sb.addEventListener('click', () => {
          this.hessOps[idx].mult = m;
          seg.querySelectorAll('.seg-btn').forEach(x => x.setAttribute('aria-pressed', 'false'));
          sb.setAttribute('aria-pressed', 'true');
          card.classList.add('tocada');
          playTone(760, .05, .05);
          this._hessChanged();
        });
        seg.appendChild(sb);
      });
      ops.appendChild(seg);

      const contrib = document.createElement('span');
      contrib.className = 'hess-contrib';
      contrib.id = `hess-contrib-${idx}`;
      ops.appendChild(contrib);

      card.appendChild(ops);
      cont.appendChild(card);
    });
    this._hessChanged(true);
    this.refreshResults();
    this._syncOverlay();
  }

  _hessContribui(idx) {
    const ex = HESS[this.hessIdx];
    const op = this.hessOps[idx];
    return ex.passos[idx].dH * op.mult * (op.inv ? -1 : 1);
  }
  _hessSoma() {
    return this.hessOps.reduce((s, _, i) => s + this._hessContribui(i), 0);
  }
  _hessChanged(silencioso) {
    const soma = this._hessSoma();
    this.sim.hess.soma = soma;
    this.hessOps.forEach((_, i) => {
      const el = document.getElementById(`hess-contrib-${i}`);
      if (el) el.textContent = `→ ${fmt(this._hessContribui(i), 1)} kJ`;
    });
    document.getElementById('hess-sum-val').textContent = `${fmt(soma, 1)} kJ`;
    // qualquer alteração invalida os marcadores ✓/✗ da última conferência
    document.querySelectorAll('#hess-steps .hess-step').forEach(c => c.classList.remove('passo-ok', 'passo-errado'));
    if (!silencioso && this.hessSolved) {
      // mexeu depois de acertar: volta ao estado de montagem
      this.hessSolved = false;
      this.sim.hess.solved = false;
      this.canvas.classList.remove('sim-canvas--ok');
      this._setHessStatus('aguardando', '');
      this._renderHessAlvo();
    }
    this.refreshResults();
  }
  _renderHessAlvo() {
    const ex = HESS[this.hessIdx];
    const el = document.getElementById('hess-alvo-eq');
    el.innerHTML = '';
    el.append(ex.alvo + '   ');
    const b = document.createElement('b');
    b.textContent = this.hessSolved ? `ΔH = ${fmt(ex.resposta, 1)} kJ` : 'ΔH = ?';
    el.appendChild(b);
  }
  _setHessStatus(txt, cls) {
    const el = document.getElementById('hess-status');
    el.textContent = txt;
    el.className = 'status-badge' + (cls ? ' ' + cls : '');
  }
  _hessCheck() {
    const ex = HESS[this.hessIdx];
    const passoOk = ex.solucao.map((s, i) =>
      s.inv === this.hessOps[i].inv && Math.abs(s.mult - this.hessOps[i].mult) < 1e-9);
    const ok = passoOk.every(Boolean);
    const cards = document.querySelectorAll('#hess-steps .hess-step');
    cards.forEach((card, i) => {
      card.classList.remove('passo-ok', 'passo-errado');
      if (!ok) card.classList.add(passoOk[i] ? 'passo-ok' : 'passo-errado');
    });
    if (ok) {
      this.hessSolved = true;
      this.sim.hess.solved = true;
      this._setHessStatus('correto ✔', 'ok');
      this._renderHessAlvo();
      this.canvas.classList.add('sim-canvas--ok');
      clearTimeout(this._okT);
      this._okT = setTimeout(() => this.canvas.classList.remove('sim-canvas--ok'), 2600);
      playTone(660, .09, .07); setTimeout(() => playTone(880, .12, .07), 110);
      announce(`Correto! Pela Lei de Hess, o ΔH da reação-alvo é ${fmt(ex.resposta, 1)} quilojoules.`, 'assertive');
    } else {
      this.sim.hess.flash = 1.2;
      this._setHessStatus('ainda não', 'err');
      playTone(300, .12, .06);
      const revisar = passoOk.map((k, i) => k ? null : ex.passos[i].rot).filter(Boolean);
      const msgPassos = revisar.length ? ` Revise a etapa ${revisar.join(', ')} (marcada em vermelho).` : '';
      announce(`A combinação ainda não reproduz a equação-alvo. Σ atual: ${fmt(this._hessSoma(), 1)} kJ.${msgPassos} Dica: ${ex.dica}`, 'assertive');
    }
    this.refreshResults();
  }
  _hessSolucao() {
    const ex = HESS[this.hessIdx];
    this._renderHess(this.hessIdx);
    ex.solucao.forEach((s, i) => { this.hessOps[i] = { inv: s.inv, mult: s.mult }; });
    // reflete nos controles
    const cards = document.querySelectorAll('#hess-steps .hess-step');
    cards.forEach((card, i) => {
      card.classList.add('tocada');
      card.querySelector('.shell-btn').setAttribute('aria-pressed', String(ex.solucao[i].inv));
      const segs = card.querySelectorAll('.seg-btn');
      segs.forEach((sb, k) => sb.setAttribute('aria-pressed', String(HESS_MULTS[k] === ex.solucao[i].mult)));
    });
    this._hessChanged(true);
    this.hessSolved = true;
    this.sim.hess.solved = true;
    this._setHessStatus('solução aplicada', 'ok');
    this._renderHessAlvo();
    this.refreshResults();
    announce(`Solução aplicada. ${ex.dica} Resultado: ΔH = ${fmt(ex.resposta, 1)} quilojoules.`);
  }

  /* ── vínculos de interface ───────────────────────────────────── */
  _bindPanels() {
    document.querySelectorAll('.panel-header').forEach(btn => {
      btn.addEventListener('click', () => {
        const expanded = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', String(!expanded));
        const body = document.getElementById(btn.getAttribute('aria-controls'));
        if (body) body.classList.toggle('collapsed', expanded);
        playTone(expanded ? 500 : 750, .06, .04);
      });
    });
  }

  _bindModes() {
    document.querySelectorAll('[data-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        playTone(880, .08, .07);
        this.setMode(btn.dataset.mode);
      });
    });
  }

  setMode(mode, inicial) {
    this.mode = mode;
    this.sim.mode = mode;
    this.started = true;
    document.querySelectorAll('[data-mode]').forEach(b => {
      const on = b.dataset.mode === mode;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', String(on));
      const panel = b.closest('.panel[data-mode-card]');
      if (panel) {
        const header = panel.querySelector('.panel-header');
        if (on) {
          header?.setAttribute('aria-current', 'true');
          header?.setAttribute('aria-expanded', 'true');
          panel.querySelector('.panel-body')?.classList.remove('collapsed');
        } else {
          header?.removeAttribute('aria-current');
        }
      }
    });
    // painéis exclusivos do modo
    const visiveis = PAINEIS_POR_MODO[mode];
    Object.values(PAINEIS_POR_MODO).flat().forEach(id => {
      const p = document.getElementById(id);
      if (p) p.hidden = !visiveis.includes(id);
    });
    document.getElementById('canvas-hint').textContent = HINT_CANVAS[mode];
    this._syncOverlay();
    this.refreshResults();
    if (!inicial) {
      announce(`Modo ${MODO_NOME[mode]} selecionado. ${MODO_INFO[mode].split('.')[0]}.`);
    }
  }

  /**
   * Q correto do Calorímetro no estado atual — centraliza a lógica pra
   * não repetir (e arriscar desalinhar) em refreshResults() e no anúncio
   * de conclusão: soma dos segmentos quando atravessa fusão/ebulição;
   * senão, m·c·ΔT com o c DA FASE REAL (não sempre o do líquido).
   */
  _calorQ() {
    const st = this.sim.calor;
    if (st.segs.length > 0) return st.totalQ;
    if (st.fasesDados) {
      const fase = this.sim._faseEstaticaDeT(st.fasesDados, st.Tcur);
      const cEf = fase === 'gelo' ? st.fasesDados.cSolido : fase === 'vaporS' ? st.fasesDados.cVapor : st.fasesDados.cLiquido;
      return st.massa * cEf * (st.Tf - st.Ti);
    }
    return st.massa * st.sub.c * (st.Tf - st.Ti);
  }

  _syncOverlay() {
    const el = document.getElementById('overlay-label');
    const m = this.mode, s = this.sim;
    let extra = '';
    if (m === 'calor') extra = `${s.calor.sub.nome} (c = ${fmt(s.calor.sub.c, 3)} J/g·°C)`;
    if (m === 'curva') extra = `${s.curva.sub.nome} · ${fmt(s.curva.massa, 0)} g`;
    if (m === 'perfil') extra = s.perfil.r.nome;
    if (m === 'hess') extra = s.hess.ex.titulo;
    if (m === 'ligacao') extra = s.lig.r.nome + (s.lig.inverted ? ' (invertida)' : '');
    el.textContent = `${MODO_NOME[m]} · ${extra}`;
  }

  _slider(id, outId, unidade, cb) {
    const inp = document.getElementById(id);
    const out = document.getElementById(outId);
    const upd = () => {
      out.textContent = `${fmt(+inp.value, 0)} ${unidade}`;
      cb(+inp.value);
    };
    inp.addEventListener('input', upd);
    upd();
  }

  _bindCalor() {
    const st = this.sim.calor;
    const reset = () => {
      st.fired = false; st.running = false; st.phase = 1; st.Tcur = st.Ti;
      st.segs = []; st.Qcur = 0;
      this.refreshResults();
    };
    this._slider('calor-massa', 'out-calor-massa', 'g', v => { st.massa = v; reset(); });
    this._slider('calor-ti', 'out-calor-ti', '°C', v => { st.Ti = v; reset(); });
    this._slider('calor-tf', 'out-calor-tf', '°C', v => { st.Tf = v; reset(); });
    document.getElementById('btn-calor-run').addEventListener('click', () => {
      if (st.Ti === st.Tf) {
        announce('T inicial e T final são iguais: sem variação de temperatura, Q = 0.', 'assertive');
        return;
      }
      // a faixa [Ti,Tf] atravessa fusão ou ebulição desta substância?
      // (só faz sentido perguntar pra água/etanol, que têm esses dados)
      const lo = Math.min(st.Ti, st.Tf), hi = Math.max(st.Ti, st.Tf);
      const cruzaFase = !!st.fasesDados && construirSegmentosFase(st.fasesDados, 1, lo, hi).segs.some(s => s.tipo === 'l');
      if (cruzaFase && st.Tf < st.Ti) {
        announce('Para atravessar uma mudança de fase, a temperatura final precisa ser maior que a inicial — como na Curva de Aquecimento.', 'assertive');
        return;
      }
      if (cruzaFase) {
        const r = construirSegmentosFase(st.fasesDados, st.massa, st.Ti, st.Tf);
        st.segs = r.segs; st.totalQ = r.totalQ; st.Qcur = 0;
      } else {
        st.segs = []; st.phase = 0;
      }
      st.running = true; st.fired = true; st.Tcur = st.Ti;
      playTone(st.Tf > st.Ti ? 520 : 420, .1, .06);
      announce(`Trocando calor: de ${fmt(st.Ti, 0)} para ${fmt(st.Tf, 0)} graus Celsius.` +
        (cruzaFase ? ' Atravessando mudança de fase: acompanhe as duas fases coexistindo no béquer.' : ''));
    });
    document.getElementById('btn-calor-reset').addEventListener('click', () => {
      document.getElementById('calor-massa').value = 200;
      document.getElementById('calor-ti').value = 20;
      document.getElementById('calor-tf').value = 80;
      ['calor-massa', 'calor-ti', 'calor-tf'].forEach(id =>
        document.getElementById(id).dispatchEvent(new Event('input')));
      playTone(440, .07, .05);
      announce('Calorímetro reiniciado: 200 gramas, de 20 a 80 graus Celsius.');
    });
  }

  _bindCurva() {
    const st = this.sim.curva;
    const rebuild = () => {
      st.Qcur = 0; st.running = false; st.done = false;
      this.sim.buildCurva();
      this.refreshResults(); this._syncOverlay();
    };
    this._slider('curva-massa', 'out-curva-massa', 'g', v => { st.massa = v; rebuild(); });
    this._slider('curva-ti', 'out-curva-ti', '°C', v => { st.Ti = v; rebuild(); });
    this._slider('curva-tf', 'out-curva-tf', '°C', v => { st.Tf = v; rebuild(); });
    document.getElementById('btn-curva-run').addEventListener('click', () => {
      if (st.Tf <= st.Ti) {
        announce('Neste modo de aquecimento, a temperatura final precisa ser maior que a inicial.', 'assertive');
        return;
      }
      st.Qcur = 0; st.done = false; st.running = true;
      playTone(520, .1, .06);
      announce(`Aquecendo ${fmt(st.massa, 0)} gramas de ${st.sub.nome.toLowerCase()} de ${fmt(st.Ti, 0)} a ${fmt(st.Tf, 0)} graus Celsius.`);
    });
    document.getElementById('btn-curva-reset').addEventListener('click', () => {
      const [fmin, fmax] = st.sub.faixaPadrao;
      document.getElementById('curva-massa').value = 100;
      document.getElementById('curva-ti').value = fmin;
      document.getElementById('curva-tf').value = fmax;
      ['curva-massa', 'curva-ti', 'curva-tf'].forEach(id =>
        document.getElementById(id).dispatchEvent(new Event('input')));
      playTone(440, .07, .05);
      announce(`Curva reiniciada: 100 gramas de ${st.sub.nome.toLowerCase()}, de ${fmt(fmin, 0)} a ${fmt(fmax, 0)} graus Celsius.`);
    });
  }

  _bindPerfil() {
    document.getElementById('btn-perfil-cat').addEventListener('click', e => {
      const b = e.currentTarget;
      this.sim.perfil.cat = !this.sim.perfil.cat;
      b.setAttribute('aria-pressed', String(this.sim.perfil.cat));
      playTone(this.sim.perfil.cat ? 900 : 600, .07, .05);
      this.refreshResults();
      announce(this.sim.perfil.cat
        ? 'Catalisador adicionado: a energia de ativação diminui, mas o ΔH permanece o mesmo.'
        : 'Catalisador removido.');
    });
    document.getElementById('btn-perfil-run').addEventListener('click', () => this._perfilRun());
  }
  _perfilRun() {
    const p = this.sim.perfil;
    if (p.playing) return;
    p.t = 0; p.playing = true; p.done = false; p.burst = [];
    playTone(700, .08, .06);
    announce(`Reproduzindo: ${p.r.nome}. Subindo a barreira de ativação de ${fmt(p.r.Ea, 0)} quilojoules.`);
  }

  _bindHess() {
    document.getElementById('btn-hess-check').addEventListener('click', () => this._hessCheck());
    document.getElementById('btn-hess-sol').addEventListener('click', () => this._hessSolucao());
    document.getElementById('btn-hess-reset').addEventListener('click', () => {
      playTone(440, .07, .05);
      this._renderHess(this.hessIdx);
      announce('Exercício reiniciado: todas as etapas voltaram a ×1, sem inversão.');
    });
  }

  _bindLigacao() {
    const st = this.sim.lig;
    const toggle = (id, prop, msgOn, msgOff) => {
      document.getElementById(id).addEventListener('click', e => {
        st[prop] = !st[prop];
        e.currentTarget.setAttribute('aria-pressed', String(st[prop]));
        playTone(st[prop] ? 860 : 560, .06, .05);
        this._syncOverlay();
        this.refreshResults();
        announce(st[prop] ? msgOn : msgOff);
      });
    };
    toggle('btn-lig-inverter', 'inverted',
      'Reação invertida: o sinal do ΔH troca — o que rompia agora se forma.',
      'Reação no sentido direto.');
    toggle('btn-lig-girar', 'auto',
      'Rotação automática ligada.', 'Rotação automática desligada.');
    toggle('btn-lig-rotulos', 'labels',
      'Rótulos dos elementos visíveis.', 'Rótulos ocultos.');
  }

  _bindGlobal() {
    // pausa (Alt+P e botão)
    document.getElementById('btn-pause').addEventListener('click', () => {
      this.sim.paused = !this.sim.paused;
      const btn = document.getElementById('btn-pause');
      document.getElementById('pause-icon').textContent = this.sim.paused ? '▶' : '⏸';
      btn.setAttribute('aria-pressed', String(this.sim.paused));
      btn.setAttribute('aria-label', this.sim.paused ? 'Retomar animação' : 'Pausar animação');
      playTone(this.sim.paused ? 400 : 800, .07, .05);
      announce(this.sim.paused ? 'Animação pausada.' : 'Animação retomada.');
    });

    // atalhos globais
    document.addEventListener('keydown', e => {
      if (e.altKey && e.key >= '1' && e.key <= '5') {
        e.preventDefault();
        const alvo = MODOS_ORDEM[+e.key - 1];
        document.querySelector(`[data-mode="${alvo}"]`)?.click();
      }
      if (e.altKey && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        document.getElementById('btn-pause')?.click();
      }
    });

    // teclado dentro do canvas
    this.canvas.addEventListener('keydown', e => {
      if (this.mode === 'ligacao' &&
          ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault();
        const st = this.sim.lig, passo = 0.14;
        if (e.key === 'ArrowLeft') st.ry -= passo;
        if (e.key === 'ArrowRight') st.ry += passo;
        if (e.key === 'ArrowUp') st.rx = clamp(st.rx - passo, -1.25, 1.25);
        if (e.key === 'ArrowDown') st.rx = clamp(st.rx + passo, -1.25, 1.25);
      }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const acao = {
          calor: 'btn-calor-run', curva: 'btn-curva-run',
          perfil: 'btn-perfil-run', hess: 'btn-hess-check',
          ligacao: 'btn-lig-girar',
        }[this.mode];
        document.getElementById(acao)?.click();
      }
    });

    // logo → curiosidade termoquímica (mesmo espírito do logo do SIMA)
    let ci = 0;
    document.getElementById('btn-app-logo').addEventListener('click', () => {
      playTone(660, .09, .06);
      const fato = CURIOSIDADES[ci % CURIOSIDADES.length]; ci++;
      announce('Você sabia? ' + fato);
    });
  }

  /* ── eventos vindos da simulação ─────────────────────────────── */
  _onSimEvent(ev) {
    if (ev === 'calor-done') {
      const st = this.sim.calor;
      const Q = this._calorQ();
      const abs = Q > 0;
      playTone(abs ? 920 : 380, .12, .06);
      this.refreshResults();
      announce(`Troca concluída. Q = ${fmt(Q / 1000, 2)} quilojoules ${abs ? 'absorvidos pela amostra' : 'liberados pela amostra'}.`, 'assertive');
    }
    if (ev === 'curva-done') {
      playTone(880, .12, .06);
      this.refreshResults();
      announce(`Aquecimento concluído. Calor total fornecido: ${fmt(this.sim.curva.totalQ / 1000, 1)} quilojoules.`, 'assertive');
    }
    if (ev === 'perfil-done') {
      const r = this.sim.perfil.r;
      if (r.dH < 0) { playTone(700, .1, .07); setTimeout(() => playTone(460, .16, .07), 120); }
      else { playTone(460, .1, .07); setTimeout(() => playTone(760, .16, .07), 120); }
      announce(`Reação concluída: ${r.tipo === 'exo' ? 'exotérmica, liberou' : 'endotérmica, absorveu'} ${fmt(Math.abs(r.dH), 1)} quilojoules.`, 'assertive');
    }
  }

  /* ── grade de Resultados (por modo) ──────────────────────────── */
  refreshResults() {
    const grid = document.getElementById('result-grid');
    grid.innerHTML = '';
    const resultPanel = grid.closest('.panel');
    if (resultPanel) resultPanel.classList.toggle('panel--waiting', !this.started);
    if (!this.started) {
      const p = document.createElement('p');
      p.className = 'hint-text';
      p.textContent = 'Ative um modo à esquerda para ver aqui a análise dos resultados.';
      grid.appendChild(p);
      return;
    }
    const row = (label, value, cls) => {
      const d = document.createElement('div'); d.className = 'data-row';
      const dt = document.createElement('dt'); dt.className = 'data-label'; dt.textContent = label;
      const dd = document.createElement('dd'); dd.className = 'data-value' + (cls ? ' ' + cls : '');
      dd.textContent = value;
      d.append(dt, dd); grid.appendChild(d);
    };

    if (this.mode === 'calor') {
      const st = this.sim.calor;
      const dT = st.Tf - st.Ti;
      const multifase = st.segs.length > 0;
      // parado numa fase só (sem cruzar patamar) de água/etanol: usa o c
      // DA FASE atual — sub.c só representa o valor líquido, e mostrar
      // isso pra um estado sólido/vapor estaria errado.
      const faseParada = (st.fasesDados && !multifase) ? this.sim._faseEstaticaDeT(st.fasesDados, st.Tcur) : null;
      const NOME_FASE_C = { gelo: 'sólida', agua: 'líquida', vaporS: 'vapor' };
      const cAtual = faseParada
        ? (faseParada === 'gelo' ? st.fasesDados.cSolido : faseParada === 'vaporS' ? st.fasesDados.cVapor : st.fasesDados.cLiquido)
        : st.sub.c;
      row('Substância', st.sub.nome);
      row('c (calor específico)', `${fmt(cAtual, 3)} J/g·°C` + (faseParada ? ` · fase ${NOME_FASE_C[faseParada]}` : ''));
      if (st.sub.pf !== null && st.sub.pf !== undefined) {
        row('Ponto de fusão', `${fmt(st.sub.pf, 1)} °C`);
      }
      if (st.sub.pe !== null && st.sub.pe !== undefined) {
        row('Ponto de ebulição', `${fmt(st.sub.pe, 1)} °C`);
      }
      row('Massa (m)', `${fmt(st.massa, 0)} g`);
      row('ΔT = Tf − Ti', `${fmt(dT, 0)} °C`);

      if (multifase) {
        // atravessando fusão/ebulição: Q é a SOMA dos trechos (sensível +
        // latente), não m·c·ΔT simples — essa conta ficaria errada porque
        // ignoraria a energia gasta na própria mudança de fase.
        const ICONE_FASE = { gelo: '❄', fusao: '❄→💧', agua: '💧', vapor: '💧→💨', vaporS: '💨' };
        st.segs.forEach(s => row(`${ICONE_FASE[s.fase] || ''} ${s.nome}`, `${fmt(s.Q / 1000, 1)} kJ`, s.tipo === 'l' ? 'val-endo' : ''));
        row('Q total (sensível + latente)', `${fmt(st.totalQ / 1000, 2)} kJ`, 'val-endo');
        row('Q em calorias', `${fmt(st.totalQ / PHYS.CAL_J, 0)} cal`);
        const latente = st.segs.filter(s => s.tipo === 'l').reduce((a, s) => a + s.Q, 0);
        const sensivel = st.totalQ - latente;
        row('Calor sensível (ΔT)', `${fmt(sensivel / 1000, 1)} kJ · ${fmt(100 * sensivel / st.totalQ, 0)}%`);
        row('Calor latente (mudança de fase)', `${fmt(latente / 1000, 1)} kJ · ${fmt(100 * latente / st.totalQ, 0)}%`, 'val-endo');
        const atual = pontoNosSegmentos(st.segs, st.fasesDados.fases, st.Qcur);
        if (atual.seg.fase === 'fusao' || atual.seg.fase === 'vapor') {
          const pct = atual.fracSeg * 100;
          const rotFase = atual.seg.fase === 'fusao' ? 'sólido / líquido' : 'líquido / vapor';
          row(`Coexistência agora (${rotFase})`, `${fmt(100 - pct, 0)}% / ${fmt(pct, 0)}%`, 'val-endo');
        }
        row('Processo', 'Absorve calor (Q > 0)', 'val-endo');
      } else {
        const Q = this._calorQ(); // já usa o c da fase real — ver método
        row('Q = m·c·ΔT', `${fmt(Q / 1000, 2)} kJ`, Q > 0 ? 'val-endo' : Q < 0 ? 'val-exo' : '');
        row('Q em calorias', `${fmt(Q / PHYS.CAL_J, 0)} cal`);
        row('Processo', dT > 0 ? 'Absorve calor (Q > 0)' : dT < 0 ? 'Libera calor (Q < 0)' : '—',
          dT > 0 ? 'val-endo' : dT < 0 ? 'val-exo' : '');
      }
      // comparação direta com a água — mesma energia, quanto varia a T°?
      const agua = SUBSTANCIAS.find(x => x.id === 'agua');
      if (st.sub.id !== 'agua') {
        const razao = agua.c / st.sub.c;
        row('Comparado à água (c)', `${fmt(razao, 1)}× mais fácil de aquecer/esfriar`);
      }
    }

    if (this.mode === 'curva') {
      const st = this.sim.curva;
      const ICONE_FASE = { gelo: '❄', fusao: '❄→💧', agua: '💧', vapor: '💧→💨', vaporS: '💨' };
      row('Substância', `${st.sub.nome} (P.F. ${fmt(st.sub.Tfusao, 0)} °C · P.E. ${fmt(st.sub.Tebulicao, 0)} °C)`);
      st.segs.forEach(s => row(`${ICONE_FASE[s.fase] || ''} ${s.nome}`, `${fmt(s.Q / 1000, 1)} kJ`, s.tipo === 'l' ? 'val-endo' : ''));
      row('Q total', `${fmt(st.totalQ / 1000, 1)} kJ`, 'val-ok');
      // quanto da energia foi só p/ mudar de fase (latente) vs. mudar de T° (sensível)?
      if (st.totalQ > 0) {
        const latente = st.segs.filter(s => s.tipo === 'l').reduce((a, s) => a + s.Q, 0);
        const sensivel = st.totalQ - latente;
        row('Calor sensível (ΔT)', `${fmt(sensivel / 1000, 1)} kJ · ${fmt(100 * sensivel / st.totalQ, 0)}%`);
        row('Calor latente (mudança de fase)', `${fmt(latente / 1000, 1)} kJ · ${fmt(100 * latente / st.totalQ, 0)}%`,
          latente > 0 ? 'val-endo' : '');
      }
      const atual = this.sim._curvaPoint(st.Qcur);
      if (atual.seg.fase === 'fusao' || atual.seg.fase === 'vapor') {
        const pct = atual.fracSeg * 100;
        const rotFase = atual.seg.fase === 'fusao' ? 'sólido / líquido' : 'líquido / vapor';
        row(`Coexistência agora (${rotFase})`, `${fmt(100 - pct, 0)}% / ${fmt(pct, 0)}%`, 'val-endo');
      }
      const fim = this.sim._curvaPoint(st.totalQ);
      row('Estado em Tf', fim.rotulo);
    }

    if (this.mode === 'perfil') {
      const r = this.sim.perfil.r;
      const exo = r.dH < 0;
      const eaCat = exo ? r.Ea * CATALISADOR_FATOR : r.dH + (r.Ea - r.dH) * CATALISADOR_FATOR;
      row('Reação', r.nome);
      row('ΔH = Hp − Hr', `${fmt(r.dH, 1)} kJ`, exo ? 'val-exo' : 'val-endo');
      if (r.massaMolar) row('ΔH por grama', `${fmt(r.dH / r.massaMolar, 1)} kJ/g`, exo ? 'val-exo' : 'val-endo');
      row('Ea (sem catalisador)', `${fmt(r.Ea, 0)} kJ`);
      row('Ea (com catalisador)', this.sim.perfil.cat ? `${fmt(eaCat, 0)} kJ` : '—',
        this.sim.perfil.cat ? 'val-ok' : '');
      row('Classificação', exo ? 'Exotérmica' : 'Endotérmica', exo ? 'val-exo' : 'val-endo');
    }

    if (this.mode === 'hess') {
      const ex = HESS[this.hessIdx];
      row('Exercício', ex.titulo);
      row('Σ das etapas', `${fmt(this._hessSoma(), 1)} kJ`);
      row('ΔH alvo', this.hessSolved ? `${fmt(ex.resposta, 1)} kJ` : '?',
        this.hessSolved ? 'val-ok' : '');
      row('Situação', this.hessSolved ? 'Correto ✔' : 'Montando as etapas…',
        this.hessSolved ? 'val-ok' : '');
    }

    if (this.mode === 'ligacao') {
      const st = this.sim.lig, r = st.r;
      const romp = st.inverted ? r.formadas : r.rompidas;
      const form = st.inverted ? r.rompidas : r.formadas;
      romp.forEach(([b, n]) =>
        row(`Romper ${n} × ${b}`, `+${fmt(n * ENERGIA_LIGACAO[b], 0)} kJ`, 'val-endo'));
      form.forEach(([b, n]) =>
        row(`Formar ${n} × ${b}`, `−${fmt(n * ENERGIA_LIGACAO[b], 0)} kJ`, 'val-exo'));
      const { romp: somaRomp, form: somaForm } = this.sim._ligSums();
      row('Σ E(rompidas)', `+${fmt(somaRomp, 0)} kJ`, 'val-endo');
      row('Σ E(formadas)', `−${fmt(somaForm, 0)} kJ`, 'val-exo');
      const dH = somaRomp - somaForm;
      row('ΔH estimado', `${fmt(dH, 0)} kJ`, dH < 0 ? 'val-exo' : 'val-endo');
      row('Classificação', dH < 0 ? 'Exotérmica' : 'Endotérmica', dH < 0 ? 'val-exo' : 'val-endo');
    }
  }

  /* ── laço principal ──────────────────────────────────────────── */
  _loop() {
    const now = performance.now();
    const dt = clamp((now - this._last) / 1000, 0, .05);
    this._last = now;
    if (this.started) {
      if (!this.sim.paused) this.sim.update(dt);
      this.sim.draw();
    } else if (this.sim.ctx) {
      // Nenhum modo ativo: canvas permanece em branco.
      this.sim.ctx.clearRect(0, 0, this.sim.W, this.sim.H);
    }
    this._frames++; this._fpsT += dt;
    if (this._fpsT >= 1) {
      const el = document.getElementById('fps-counter');
      if (el) el.textContent = `${this._frames} fps`;
      this._frames = 0; this._fpsT = 0;
    }
    requestAnimationFrame(() => this._loop());
  }
}

window.addEventListener('DOMContentLoaded', () => new ThermoApp());

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
      if (e.target.closest('.model-btn, .opt-btn, .mode-activate-btn') && window.innerWidth <= 1100) {
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

    var storeKey = 'sitq-w-' + cfg.cssVar.replace(/^--/, '');
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
