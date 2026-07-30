/* ================================================================
   SITQ — dadostermoquimica.js | Simulador Interativo de Termoquímica
   ================================================================
   DADOS FIXOS usados para compor os simuladores. Nenhuma mecânica
   vive aqui — apenas constantes físico-químicas, textos didáticos e
   geometrias moleculares. Tudo é exposto em window.SITQ_DATA e
   desestruturado no topo de scrpittermoquimica.js (mesmo contrato
   dadossima.js → scriptsima.js do SIMA).
 
   FONTES DOS VALORES (25 °C, 1 atm, arredondados p/ uso didático):
   · Entalpias-padrão de formação/combustão: CRC Handbook / NIST
     WebBook (CO₂ −393,5; H₂O(l) −285,8; CH₄ −74,8 kJ/mol;
     combustão CH₄ −890 kJ/mol; glicose −2808 kJ/mol).
   · Energias médias de ligação: Atkins, Príncípios de Química
     (H–H 436; O=O 495; O–H 463; C–H 413; C=O(CO₂) 799 kJ/mol...).
   · Calores específicos e latentes: CRC Handbook (água 4,186 J/g°C;
     L fusão 334 J/g; L vaporização 2260 J/g).
   · Energias de ativação: valores ILUSTRATIVOS, escolhidos apenas
     para o traçado correto dos diagramas (Ea > máx(0, ΔH)).
   ================================================================ */
'use strict';
 
window.SITQ_DATA = {
 
  /* ── Constantes físicas ─────────────────────────────────────── */
  PHYS: {
    CAL_J: 4.184,          // 1 cal = 4,184 J (caloria termoquímica)
    T_MIN: -20, T_MAX: 120 // faixa dos termômetros do simulador (°C)
  },
 
  /* ══════════════════════════════════════════════════════════════
     MODO 1 — CALORÍMETRO (Q = m·c·ΔT)
     Calores específicos médios a 25 °C (CRC Handbook).
     cor: usada no líquido/bloco desenhado no canvas.
     ══════════════════════════════════════════════════════════════ */
  SUBSTANCIAS: [
    { id:'agua',     nome:'Água líquida',  c:4.186, estado:'liquido', cor:'#38bdf8' },
    { id:'gelo',     nome:'Gelo (H₂O s)',  c:2.090, estado:'solido',  cor:'#bae6fd' },
    { id:'etanol',   nome:'Etanol',        c:2.440, estado:'liquido', cor:'#c4b5fd' },
    { id:'oleo',     nome:'Óleo vegetal',  c:1.960, estado:'liquido', cor:'#fbbf24' },
    { id:'vidro',    nome:'Vidro',         c:0.840, estado:'solido',  cor:'#7dd3fc' },
    { id:'areia',    nome:'Areia seca',    c:0.800, estado:'solido',  cor:'#f59e0b' },
    { id:'aluminio', nome:'Alumínio',      c:0.897, estado:'solido',  cor:'#cbd5e1' },
    { id:'ferro',    nome:'Ferro',         c:0.449, estado:'solido',  cor:'#a8a29e' },
    { id:'cobre',    nome:'Cobre',         c:0.385, estado:'solido',  cor:'#fb923c' },
    { id:'chumbo',   nome:'Chumbo',        c:0.128, estado:'solido',  cor:'#94a3b8' },
  ],
 
  /* ══════════════════════════════════════════════════════════════
     MODO 2 — CURVA DE AQUECIMENTO DA ÁGUA (calor sensível + latente)
     Q = m·c·ΔT nos trechos inclinados; Q = m·L nos patamares.
     ══════════════════════════════════════════════════════════════ */
  CURVA_AGUA: {
    cGelo: 2.09, cAgua: 4.186, cVapor: 2.00,   // J/(g·°C)
    Lfusao: 334, Lvap: 2260,                    // J/g
    Tfusao: 0,  Tebulicao: 100,                 // °C (1 atm)
    fases: { gelo:'Sólido (gelo)', agua:'Líquido (água)', vapor:'Gasoso (vapor)' }
  },
 
  /* ══════════════════════════════════════════════════════════════
     MODO 3 — DIAGRAMAS DE ENERGIA (endo × exo)
     dH em kJ (por "mol de reação" tal como escrita).
     Ea ilustrativa (kJ), sempre > máx(0, dH) p/ o pico existir.
     ══════════════════════════════════════════════════════════════ */
  CATALISADOR_FATOR: 0.45,   // Ea com catalisador ≈ 45% da original (ilustrativo)
  REACOES_PERFIL: [
    { id:'metano',  nome:'Combustão do metano',      eq:'CH₄(g) + 2 O₂(g) → CO₂(g) + 2 H₂O(l)',
      dH:-890.4, Ea:180, tipo:'exo',
      desc:'Queima do gás natural: libera 890 kJ por mol de CH₄ — base de fogões e termelétricas.' },
    { id:'etanol',  nome:'Combustão do etanol',      eq:'C₂H₅OH(l) + 3 O₂(g) → 2 CO₂(g) + 3 H₂O(l)',
      dH:-1367, Ea:210, tipo:'exo',
      desc:'Combustível renovável brasileiro: 1367 kJ liberados por mol de etanol queimado.' },
    { id:'neutra',  nome:'Neutralização forte',      eq:'H⁺(aq) + OH⁻(aq) → H₂O(l)',
      dH:-57.7, Ea:20, tipo:'exo',
      desc:'Ácido forte + base forte: ΔH praticamente constante (−57,7 kJ/mol de H₂O formada).' },
    { id:'caco3',   nome:'Decomposição do calcário', eq:'CaCO₃(s) → CaO(s) + CO₂(g)',
      dH:+178, Ea:240, tipo:'endo',
      desc:'Calcinação em fornos de cal: absorve 178 kJ/mol — por isso exige aquecimento contínuo.' },
    { id:'no',      nome:'Formação de NO (raios)',   eq:'N₂(g) + O₂(g) → 2 NO(g)',
      dH:+180.6, Ea:315, tipo:'endo',
      desc:'Só ocorre com a energia de relâmpagos ou motores: N≡N é muito difícil de romper.' },
    { id:'fotossintese', nome:'Fotossíntese',        eq:'6 CO₂(g) + 6 H₂O(l) → C₆H₁₂O₆(s) + 6 O₂(g)',
      dH:+2808, Ea:3100, tipo:'endo',
      desc:'A planta armazena 2808 kJ (por mol de glicose) vindos da luz solar — o inverso da respiração.' },
  ],
 
  /* ══════════════════════════════════════════════════════════════
     MODO 4 — LEI DE HESS
     Cada exercício: equação-alvo, etapas dadas (com ΔH), a operação
     correta de cada etapa (inv = inverter; mult ∈ {0.5, 1, 2, 3}) e
     os níveis de entalpia usados no diagrama do canvas.
     ══════════════════════════════════════════════════════════════ */
  HESS_MULTS: [0.5, 1, 2, 3],
  HESS: [
    {
      id:'co', titulo:'Formação do CO', resposta:-110.5,
      alvo:'C(grafite) + ½ O₂(g) → CO(g)',
      passos:[
        { rot:'I',  eq:'C(grafite) + O₂(g) → CO₂(g)', dH:-393.5 },
        { rot:'II', eq:'CO(g) + ½ O₂(g) → CO₂(g)',    dH:-283.0 },
      ],
      solucao:[ {inv:false, mult:1}, {inv:true, mult:1} ],
      dica:'A combustão do carbono nunca para no CO. Mantenha I e inverta II para o CO “sobrar” como produto.',
      niveis:[
        { label:'C(gr) + O₂',  H:0      },
        { label:'CO + ½ O₂',   H:-110.5 },
        { label:'CO₂',         H:-393.5 },
      ],
    },
    {
      id:'ch4', titulo:'Formação do CH₄', resposta:-74.7,
      alvo:'C(grafite) + 2 H₂(g) → CH₄(g)',
      passos:[
        { rot:'I',   eq:'C(grafite) + O₂(g) → CO₂(g)',          dH:-393.5 },
        { rot:'II',  eq:'H₂(g) + ½ O₂(g) → H₂O(l)',             dH:-285.8 },
        { rot:'III', eq:'CH₄(g) + 2 O₂(g) → CO₂(g) + 2 H₂O(l)', dH:-890.4 },
      ],
      solucao:[ {inv:false, mult:1}, {inv:false, mult:2}, {inv:true, mult:1} ],
      dica:'São 2 H₂ no alvo → dobre a etapa II. O CH₄ precisa virar produto → inverta III.',
      niveis:[
        { label:'C + 2 H₂ + 2 O₂', H:0      },
        { label:'CH₄ + 2 O₂',      H:-74.7  },
        { label:'CO₂ + 2 H₂O',     H:-965.1 },
      ],
    },
    {
      id:'c2h2', titulo:'Formação do acetileno', resposta:+226.8,
      alvo:'2 C(grafite) + H₂(g) → C₂H₂(g)',
      passos:[
        { rot:'I',   eq:'C(grafite) + O₂(g) → CO₂(g)',            dH:-393.5  },
        { rot:'II',  eq:'H₂(g) + ½ O₂(g) → H₂O(l)',               dH:-285.8  },
        { rot:'III', eq:'C₂H₂(g) + 5/2 O₂(g) → 2 CO₂(g) + H₂O(l)', dH:-1299.6 },
      ],
      solucao:[ {inv:false, mult:2}, {inv:false, mult:1}, {inv:true, mult:1} ],
      dica:'2 carbonos no alvo → dobre I. Inverta III: o resultado dá POSITIVO — o acetileno “estoca” energia.',
      niveis:[
        { label:'2 C + H₂ + 5/2 O₂', H:0       },
        { label:'C₂H₂ + 5/2 O₂',     H:+226.8  },
        { label:'2 CO₂ + H₂O',       H:-1072.8 },
      ],
    },
    {
      id:'diamante', titulo:'Grafite → Diamante', resposta:+1.9,
      alvo:'C(grafite) → C(diamante)',
      passos:[
        { rot:'I',  eq:'C(grafite) + O₂(g) → CO₂(g)',  dH:-393.5 },
        { rot:'II', eq:'C(diamante) + O₂(g) → CO₂(g)', dH:-395.4 },
      ],
      solucao:[ {inv:false, mult:1}, {inv:true, mult:1} ],
      dica:'Impossível medir direto no laboratório! Queime o grafite (I) e “desqueime” o diamante (II invertida).',
      niveis:[
        { label:'C(grafite) + O₂', H:0      },
        { label:'C(diamante) + O₂',H:+1.9   },
        { label:'CO₂',             H:-393.5 },
      ],
    },
  ],
 
  /* ══════════════════════════════════════════════════════════════
     MODO 5 — ENERGIA DE LIGAÇÃO (com projeção 3D das moléculas)
     ΔH ≈ Σ E(ligações rompidas) − Σ E(ligações formadas)
     Energias MÉDIAS de ligação (kJ/mol), fase gasosa.
     ══════════════════════════════════════════════════════════════ */
  ENERGIA_LIGACAO: {
    'H–H':436, 'O=O':495, 'O–H':463, 'C–H':413, 'C–C':348,
    'C=C':614, 'C≡C':839, 'C=O':799, 'C–O':358,
    'Cl–Cl':243, 'H–Cl':431, 'N≡N':945, 'N–H':391,
    'F–F':155, 'H–F':565,
  },
 
  REACOES_LIGACAO: [
    { id:'ch4', nome:'Combustão do metano', sub:'CH₄ + 2 O₂ → CO₂ + 2 H₂O',
      reagentes:[ {mol:'CH4', n:1}, {mol:'O2', n:2} ],
      produtos: [ {mol:'CO2', n:1}, {mol:'H2O', n:2} ],
      rompidas: [ ['C–H',4], ['O=O',2] ],
      formadas: [ ['C=O',2], ['O–H',4] ],
      obs:'Com energias médias, ΔH ≈ −808 kJ; o valor experimental (H₂O gasosa) é −802 kJ — médias são estimativas.' },
    { id:'hcl', nome:'Síntese do HCl', sub:'H₂ + Cl₂ → 2 HCl',
      reagentes:[ {mol:'H2', n:1}, {mol:'Cl2', n:1} ],
      produtos: [ {mol:'HCl', n:2} ],
      rompidas: [ ['H–H',1], ['Cl–Cl',1] ],
      formadas: [ ['H–Cl',2] ],
      obs:'Clássico de vestibular: 436 + 243 − 2·431 = −183 kJ (experimental: −184,6 kJ).' },
    { id:'nh3', nome:'Síntese da amônia', sub:'N₂ + 3 H₂ → 2 NH₃ (Haber-Bosch)',
      reagentes:[ {mol:'N2', n:1}, {mol:'H2', n:3} ],
      produtos: [ {mol:'NH3', n:2} ],
      rompidas: [ ['N≡N',1], ['H–H',3] ],
      formadas: [ ['N–H',6] ],
      obs:'A tripla N≡N (945 kJ) explica por que o processo exige catalisador, ~450 °C e ~200 atm.' },
    { id:'h2o', nome:'Síntese da água', sub:'2 H₂ + O₂ → 2 H₂O',
      reagentes:[ {mol:'H2', n:2}, {mol:'O2', n:1} ],
      produtos: [ {mol:'H2O', n:2} ],
      rompidas: [ ['H–H',2], ['O=O',1] ],
      formadas: [ ['O–H',4] ],
      obs:'Dá −485 kJ (−242,5 por mol de H₂O gasosa) — idêntico ao ΔHf° tabelado da água vapor.' },
  ],
 
  /* Estilo CPK dos átomos (raio relativo em Å visuais + cor). */
  ATOMO_3D: {
    H:  { r:0.32, cor:'#e2e8f0' },
    C:  { r:0.48, cor:'#475569' },
    O:  { r:0.44, cor:'#ef4444' },
    N:  { r:0.46, cor:'#3b82f6' },
    Cl: { r:0.58, cor:'#22c55e' },
  },
 
  /* Geometrias 3D (coordenadas em Å aproximados; bonds = [i, j, ordem]).
     CH₄ tetraédrico (109,5°), H₂O angular (104,5°), CO₂ linear,
     NH₃ piramidal (107°) — geometrias VSEPR reais. */
  MOLECULAS_3D: {
    CH4: { formula:'CH₄',
      atoms:[ {el:'C',x:0,y:0,z:0},
              {el:'H',x: .63,y: .63,z: .63}, {el:'H',x: .63,y:-.63,z:-.63},
              {el:'H',x:-.63,y: .63,z:-.63}, {el:'H',x:-.63,y:-.63,z: .63} ],
      bonds:[ [0,1,1],[0,2,1],[0,3,1],[0,4,1] ] },
    O2:  { formula:'O₂',
      atoms:[ {el:'O',x:-.60,y:0,z:0}, {el:'O',x:.60,y:0,z:0} ],
      bonds:[ [0,1,2] ] },
    CO2: { formula:'CO₂',
      atoms:[ {el:'O',x:-1.16,y:0,z:0}, {el:'C',x:0,y:0,z:0}, {el:'O',x:1.16,y:0,z:0} ],
      bonds:[ [0,1,2],[1,2,2] ] },
    H2O: { formula:'H₂O',
      atoms:[ {el:'O',x:0,y:.20,z:0}, {el:'H',x:.76,y:-.39,z:0}, {el:'H',x:-.76,y:-.39,z:0} ],
      bonds:[ [0,1,1],[0,2,1] ] },
    H2:  { formula:'H₂',
      atoms:[ {el:'H',x:-.37,y:0,z:0}, {el:'H',x:.37,y:0,z:0} ],
      bonds:[ [0,1,1] ] },
    Cl2: { formula:'Cl₂',
      atoms:[ {el:'Cl',x:-.99,y:0,z:0}, {el:'Cl',x:.99,y:0,z:0} ],
      bonds:[ [0,1,1] ] },
    HCl: { formula:'HCl',
      atoms:[ {el:'H',x:-.74,y:0,z:0}, {el:'Cl',x:.54,y:0,z:0} ],
      bonds:[ [0,1,1] ] },
    N2:  { formula:'N₂',
      atoms:[ {el:'N',x:-.55,y:0,z:0}, {el:'N',x:.55,y:0,z:0} ],
      bonds:[ [0,1,3] ] },
    NH3: { formula:'NH₃',
      atoms:[ {el:'N',x:0,y:.22,z:0},
              {el:'H',x:.94,y:-.19,z:0}, {el:'H',x:-.47,y:-.19,z:.81}, {el:'H',x:-.47,y:-.19,z:-.81} ],
      bonds:[ [0,1,1],[0,2,1],[0,3,1] ] },
  },
 
  /* ══════════════════════════════════════════════════════════════
     TEXTOS DIDÁTICOS POR MODO (painel "Sobre o Modo", fórmulas e
     rótulo do canvas) — mesmo papel do MODEL_INFO do SIMA.
     ══════════════════════════════════════════════════════════════ */
  MODO_NOME: {
    calor:'Calorímetro', curva:'Curva de Aquecimento',
    perfil:'Endo × Exo', hess:'Lei de Hess', ligacao:'Energia de Ligação',
  },
  MODO_INFO: {
    calor:'Calorimetria mede o calor SENSÍVEL trocado sem mudança de estado: Q = m·c·ΔT. O calor específico (c) é a “identidade térmica” de cada material — a água (4,186 J/g·°C) resiste a mudar de temperatura ~33× mais que o chumbo. Q > 0: a amostra absorve calor; Q < 0: libera.',
    curva:'Durante a fusão e a ebulição a temperatura TRAVA: toda a energia (calor LATENTE, Q = m·L) vai para desmontar as interações entre moléculas, não para agitá-las. Por isso a curva da água tem dois patamares — a vaporização (2260 J/g) consome quase 7× mais energia que a fusão (334 J/g).',
    perfil:'O diagrama de entalpia conta a história da reação: reagentes sobem a barreira Ea até o complexo ativado e descem até os produtos. Se Hp < Hr, ΔH < 0 e a reação é EXOTÉRMICA (libera calor); se Hp > Hr, ΔH > 0, ENDOTÉRMICA. O catalisador abaixa Ea, mas NUNCA muda o ΔH.',
    hess:'Germain Hess (1840): a entalpia é função de ESTADO — ΔH depende só do início e do fim, não do caminho. Logo, equações termoquímicas podem ser somadas como equações algébricas: inverter troca o sinal do ΔH; multiplicar por n multiplica o ΔH por n.',
    ligacao:'Romper ligação sempre ABSORVE energia (+); formar ligação sempre LIBERA (−). Assim: ΔH ≈ Σ E(rompidas) − Σ E(formadas). Como as energias tabeladas são MÉDIAS entre muitas moléculas, o resultado é uma estimativa — arraste as moléculas 3D para investigar cada ligação.',
  },
  FORMULAS: {
    calor:   { f:'Q = m · c · ΔT', nota:'Q em joules (÷4,184 → cal); m em g; c em J/(g·°C); ΔT = T_final − T_inicial. Válida enquanto não há mudança de estado.' },
    curva:   { f:'Q = m·c·ΔT  (trechos)   ·   Q = m·L  (patamares)', nota:'L_fusão = 334 J/g e L_vaporização = 2260 J/g para a água a 1 atm. Nos patamares, ΔT = 0.' },
    perfil:  { f:'ΔH = H_produtos − H_reagentes', nota:'Ea é medida dos reagentes até o topo (complexo ativado). Catalisador: reduz Ea, não altera ΔH. Ea deste modo: valores ilustrativos.' },
    hess:    { f:'ΔH_alvo = Σ (±n · ΔH_etapa)', nota:'Inverter equação ⇒ trocar sinal do ΔH. Multiplicar coeficientes por n ⇒ multiplicar ΔH por n. Some as etapas ajustadas.' },
    ligacao: { f:'ΔH ≈ Σ E(lig. rompidas) − Σ E(lig. formadas)', nota:'Todas as espécies em fase gasosa. Energias médias (Atkins) ⇒ resultado aproximado do valor experimental.' },
  },
  /* Curiosidades exibidas ao acionar o logo do cabeçalho. */
  CURIOSIDADES: [
    'Lavoisier e Laplace já mediam calor de reações em 1780 — com um calorímetro de gelo!',
    'A caloria dos rótulos de alimento é, na verdade, a quilocaloria: 1 kcal = 4184 J.',
    'O suor resfria você graças ao enorme calor latente de vaporização da água (2260 J/g).',
    'Hess publicou sua lei em 1840 — 25 anos ANTES do conceito moderno de entalpia existir.',
    'Airbags usam uma reação exotérmica ultrarrápida: NaN₃ vira N₂ em ~30 milissegundos.',
  ],
};