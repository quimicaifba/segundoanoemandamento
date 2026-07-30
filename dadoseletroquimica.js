/* ================================================================
   SIELQ — dadoseletroquimica.js | dados fixos de Eletroquímica
   ================================================================
   FONTES: potenciais padrão de redução (25 °C, 1 mol/L, 1 atm) —
   CRC Handbook (97ª ed.); Atkins & de Paula. Massas molares —
   IUPAC/CRC. F = 96.485 C/mol arredondado a 96.500 (praxe do EM).
   Filas de descarga — Usberco & Salvador; Feltre.
   ================================================================ */
'use strict';

window.SIM_DATA = {
  ACRO: 'SIELQ',
  TITLE: 'Simulador Interativo de Eletroquímica',

  /* ── Metais e seus potenciais padrão de redução (V) ── */
  METAIS: [
    { id: 'mg', nome: 'Magnésio',  simb: 'Mg', ion: 'Mg²⁺', n: 2, e0: -2.37, cor: '#cbd5e1', sol: null },
    { id: 'al', nome: 'Alumínio',  simb: 'Al', ion: 'Al³⁺', n: 3, e0: -1.66, cor: '#e2e8f0', sol: null },
    { id: 'zn', nome: 'Zinco',     simb: 'Zn', ion: 'Zn²⁺', n: 2, e0: -0.76, cor: '#94a3b8', sol: null },
    { id: 'fe', nome: 'Ferro',     simb: 'Fe', ion: 'Fe²⁺', n: 2, e0: -0.44, cor: '#78716c', sol: '#86a17a' },
    { id: 'ni', nome: 'Níquel',    simb: 'Ni', ion: 'Ni²⁺', n: 2, e0: -0.25, cor: '#a8a29e', sol: '#5fa06a' },
    { id: 'pb', nome: 'Chumbo',    simb: 'Pb', ion: 'Pb²⁺', n: 2, e0: -0.13, cor: '#9ca3af', sol: null },
    { id: 'h2', nome: 'Hidrogênio', simb: 'H₂', ion: 'H⁺',  n: 2, e0: 0.00,  cor: '#e5e7eb', sol: null, ref: true },
    { id: 'cu', nome: 'Cobre',     simb: 'Cu', ion: 'Cu²⁺', n: 2, e0: 0.34,  cor: '#c2703a', sol: '#2f7fd6' },
    { id: 'ag', nome: 'Prata',     simb: 'Ag', ion: 'Ag⁺',  n: 1, e0: 0.80,  cor: '#d4d4d8', sol: null },
    { id: 'au', nome: 'Ouro',      simb: 'Au', ion: 'Au³⁺', n: 3, e0: 1.50,  cor: '#eab308', sol: null },
  ],

  F: 96500,

  /* ── Eletrólise ígnea (sal fundido) ── */
  IGNEA: [
    { id: 'nacl', nome: 'NaCl fundido', cation: 'Na⁺', anion: 'Cl⁻',
      cat: 'Na(l)', an: 'Cl₂(g)', corCat: '#cbd5e1', corAn: '#a3e635', gasAn: true, gasCat: false,
      semiCat: '2 Na⁺ + 2 e⁻ → 2 Na(l)', semiAn: '2 Cl⁻ → Cl₂(g) + 2 e⁻', tfusao: 801 },
    { id: 'ki', nome: 'KI fundido', cation: 'K⁺', anion: 'I⁻',
      cat: 'K(l)', an: 'I₂(g)', corCat: '#e2e8f0', corAn: '#a855f7', gasAn: true, gasCat: false,
      semiCat: '2 K⁺ + 2 e⁻ → 2 K(l)', semiAn: '2 I⁻ → I₂ + 2 e⁻', tfusao: 681 },
    { id: 'cacl2', nome: 'CaCl₂ fundido', cation: 'Ca²⁺', anion: 'Cl⁻',
      cat: 'Ca(l)', an: 'Cl₂(g)', corCat: '#f1f5f9', corAn: '#a3e635', gasAn: true, gasCat: false,
      semiCat: 'Ca²⁺ + 2 e⁻ → Ca(l)', semiAn: '2 Cl⁻ → Cl₂(g) + 2 e⁻', tfusao: 772 },
  ],

  /* ── Eletrólise aquosa ── */
  AQUOSA: [
    { id: 'nacl', nome: 'NaCl(aq)', corSol: '#bae6fd',
      cat: 'H₂(g)', an: 'Cl₂(g)', gasCat: true, gasAn: true,
      semiCat: '2 H₂O + 2 e⁻ → H₂(g) + 2 OH⁻', semiAn: '2 Cl⁻ → Cl₂(g) + 2 e⁻',
      resta: 'sobra NaOH em solução (soda cáustica)', corCat: '#e2e8f0', corAn: '#a3e635' },
    { id: 'cuso4', nome: 'CuSO₄(aq)', corSol: '#2f7fd6',
      cat: 'Cu(s)', an: 'O₂(g)', gasCat: false, gasAn: true,
      semiCat: 'Cu²⁺ + 2 e⁻ → Cu(s)', semiAn: '2 H₂O → O₂(g) + 4 H⁺ + 4 e⁻',
      resta: 'a cor azul desaparece à medida que o cobre deposita', corCat: '#c2703a', corAn: '#60a5fa' },
    { id: 'ki', nome: 'KI(aq)', corSol: '#fde68a',
      cat: 'H₂(g)', an: 'I₂(aq)', gasCat: true, gasAn: false,
      semiCat: '2 H₂O + 2 e⁻ → H₂(g) + 2 OH⁻', semiAn: '2 I⁻ → I₂ + 2 e⁻',
      resta: 'o iodo formado tinge a solução de castanho', corCat: '#e2e8f0', corAn: '#a855f7' },
    { id: 'na2so4', nome: 'Na₂SO₄(aq)', corSol: '#e0f2fe',
      cat: 'H₂(g)', an: 'O₂(g)', gasCat: true, gasAn: true,
      semiCat: '2 H₂O + 2 e⁻ → H₂(g) + 2 OH⁻', semiAn: '2 H₂O → O₂(g) + 4 H⁺ + 4 e⁻',
      resta: 'na prática é a eletrólise da água: 2 H₂ para 1 O₂', corCat: '#e2e8f0', corAn: '#60a5fa' },
    { id: 'agno3', nome: 'AgNO₃(aq)', corSol: '#f1f5f9',
      cat: 'Ag(s)', an: 'O₂(g)', gasCat: false, gasAn: true,
      semiCat: 'Ag⁺ + e⁻ → Ag(s)', semiAn: '2 H₂O → O₂(g) + 4 H⁺ + 4 e⁻',
      resta: 'prata metálica espelha o cátodo — base da prataria eletrolítica', corCat: '#d4d4d8', corAn: '#60a5fa' },
    { id: 'hcl', nome: 'HCl(aq)', corSol: '#fecaca',
      cat: 'H₂(g)', an: 'Cl₂(g)', gasCat: true, gasAn: true,
      semiCat: '2 H⁺ + 2 e⁻ → H₂(g)', semiAn: '2 Cl⁻ → Cl₂(g) + 2 e⁻',
      resta: 'ambos os produtos são gasosos', corCat: '#e2e8f0', corAn: '#a3e635' },
  ],

  /* ── Filas de descarga (prioridade de descarregamento) ── */
  FILA_CATIONS: 'Au³⁺ > Ag⁺ > Cu²⁺ > H⁺  ‖  Al³⁺, Mg²⁺, Na⁺, K⁺ (não descarregam em meio aquoso)',
  FILA_ANIONS:  'I⁻ > Br⁻ > Cl⁻  ‖  OH⁻  ‖  F⁻, NO₃⁻, SO₄²⁻ (não descarregam em meio aquoso)',

  /* ── Metais da galvanoplastia (Lei de Faraday) ── */
  GALVANO: [
    { id: 'ag', nome: 'Prata (Ag)',   M: 107.87, n: 1, cor: '#d4d4d8' },
    { id: 'cu', nome: 'Cobre (Cu)',   M: 63.55,  n: 2, cor: '#c2703a' },
    { id: 'ni', nome: 'Níquel (Ni)',  M: 58.69,  n: 2, cor: '#a8a29e' },
    { id: 'cr', nome: 'Cromo (Cr)',   M: 52.00,  n: 3, cor: '#93c5fd' },
    { id: 'au', nome: 'Ouro (Au)',    M: 196.97, n: 3, cor: '#eab308' },
  ],

  /* ── ids de modo atendidos pela SEGUNDA mecânica (fachada Mech) ── */
  MECH_B: ['ignea', 'aquosa', 'faraday'],

  MODES: [
    {
      id: 'montar', sigla: 'ΔE°', nome: 'Montar a Pilha', sub: 'Duas meias-células',
      hint: 'Escolha dois eletrodos, descubra qual sofre oxidação e qual sofre redução e calcule a diferença de potencial.',
      info: 'Numa pilha, o metal de MENOR potencial de redução sofre oxidação e é o ânodo (polo negativo); o de maior potencial sofre redução e é o cátodo (polo positivo). Os elétrons saem do ânodo pelo fio; a ponte salina fecha o circuito.',
      formula: 'ΔE° = E°(cátodo) − E°(ânodo)',
      formulaNote: 'ΔE° positivo indica processo espontâneo. Notação: ânodo(s) | ânodoⁿ⁺ ‖ cátodoᵐ⁺ | cátodo(s).',
      hintCanvas: 'Enter/Espaço anuncia a pilha montada',
      icon: '🔋',
      def: 'O metal de menor potencial de redução oxida (ânodo, polo −); o de maior potencial reduz (cátodo, polo +).',
      fatos: [
        { l: 'Fórmula',  v: 'ΔE° = E°cátodo − E°ânodo' },
        { l: 'ΔE° > 0',  v: 'processo espontâneo' },
        { l: 'Ânodo',    v: 'menor E° (oxida)' },
        { l: 'Cátodo',   v: 'maior E° (reduz)' },
      ],
      canvasInteracao: 'Escolha dois eletrodos e veja qual oxida (ânodo) e qual reduz (cátodo), com o ΔE° calculado.',
      recomendados: ['Zinco', 'Cobre', 'Magnésio'],
      overlay: 'Pilha', panels: ['panel-montar'], primary: 'pilha-status',
    },
    {
      id: 'espontaneidade', sigla: 'reage?', nome: 'Espontaneidade', sub: 'Fita metálica na solução',
      hint: 'Mergulhe uma fita de metal numa solução de sal de outro metal e descubra se a reação de deslocamento acontece.',
      info: 'Um metal desloca da solução outro metal MENOS reativo, ou seja, de maior potencial de redução. Zinco mergulhado em sulfato de cobre escurece: deposita cobre metálico e a solução azul empalidece. O contrário não ocorre.',
      formula: 'ΔE° = E°(íon) − E°(fita) > 0 → reage',
      formulaNote: 'A fila de reatividade decorre diretamente dos potenciais padrão de redução.',
      hintCanvas: 'Enter/Espaço mergulha a fita',
      icon: '🧪',
      def: 'Um metal desloca da solução outro metal menos reativo (maior potencial de redução) — o inverso não ocorre.',
      fatos: [
        { l: 'Regra',      v: 'ΔE°=E°(íon)−E°(fita)' },
        { l: 'Reage se',   v: 'ΔE° > 0' },
        { l: 'Clássico',   v: 'Zn em CuSO₄' },
        { l: 'Base',       v: 'fila de reatividade' },
      ],
      canvasInteracao: 'Mergulhe uma fita de metal numa solução de sal de outro metal e veja se o deslocamento acontece.',
      recomendados: ['Zinco', 'Cobre', 'Magnésio'],
      overlay: 'Deslocamento', panels: ['panel-espont'], primary: 'mergulhar',
    },
    {
      id: 'tabela', sigla: 'E° (V)', nome: 'Tabela de Potenciais', sub: 'Régua de reatividade',
      hint: 'Percorra a régua de potenciais padrão e compare a força oxidante e redutora dos pares metálicos.',
      info: 'Quanto mais negativo o potencial de redução, maior o poder redutor do metal (mais fácil ele se oxida). Quanto mais positivo, maior o poder oxidante do seu íon. O eletrodo de hidrogênio, definido como 0,00 V, é a referência da escala.',
      formula: 'referência: 2 H⁺ + 2 e⁻ ⇌ H₂   E° = 0,00 V',
      formulaNote: 'Todos os potenciais são medidos a 25 °C, soluções 1 mol/L e gases a 1 atm.',
      hintCanvas: 'Setas ↑ ↓ percorrem os metais',
      icon: '📏',
      def: 'Quanto mais negativo o potencial, maior o poder redutor do metal; quanto mais positivo, maior o poder oxidante do íon.',
      fatos: [
        { l: 'Referência',     v: 'H⁺/H₂ = 0,00 V' },
        { l: 'Mais redutor',   v: 'Mg (−2,37 V)' },
        { l: 'Mais oxidante',  v: 'Au³⁺ (+1,50 V)' },
        { l: 'Condições',      v: '25 °C, 1 mol/L' },
      ],
      canvasInteracao: 'Percorra a régua de potenciais padrão e compare a força oxidante e redutora dos pares metálicos.',
      overlay: 'Potenciais padrão', panels: ['panel-tabela'], primary: 'tab-status',
    },
    {
      id: 'ignea', sigla: 'fundido', nome: 'Eletrólise Ígnea', sub: 'Sal fundido, sem água',
      hint: 'Funda um sal, ligue a fonte e veja os cátions migrarem ao cátodo e os ânions ao ânodo.',
      info: 'Na eletrólise ígnea o sal está fundido, sem água: só existem os íons do próprio sal. Os cátions vão ao cátodo (polo negativo) e viram metal; os ânions vão ao ânodo (polo positivo) e viram não metal. É assim que se obtém sódio e alumínio metálicos na indústria.',
      formula: 'cátodo (−): redução   ·   ânodo (+): oxidação',
      formulaNote: 'Ao contrário da pilha, aqui a corrente é IMPOSTA por uma fonte externa: o processo é forçado, não espontâneo.',
      hintCanvas: 'Enter/Espaço liga e desliga a fonte',
      icon: '🔥',
      def: 'Sem água, só existem os íons do sal fundido: cátions viram metal no cátodo, ânions viram não metal no ânodo.',
      fatos: [
        { l: 'Cátodo (−)', v: 'redução' },
        { l: 'Ânodo (+)',  v: 'oxidação' },
        { l: 'Processo',   v: 'forçado, não espontâneo' },
        { l: 'Exemplo',    v: 'Al metálico (Hall-Héroult)' },
      ],
      canvasInteracao: 'Funda um sal, ligue a fonte e veja os cátions migrarem ao cátodo e os ânions ao ânodo.',
      recomendados: ['NaCl fundido', 'KI fundido', 'CaCl₂ fundido'],
      overlay: 'Eletrólise ígnea', panels: ['panel-ignea'], primary: 'toggle-fonte',
    },
    {
      id: 'aquosa', sigla: 'H₂O', nome: 'Eletrólise Aquosa', sub: 'Filas de descarga',
      hint: 'Com água presente, escolha o eletrólito e descubra quais íons realmente descarregam nos eletrodos.',
      info: 'Em solução aquosa, a água compete com os íons do sal. Vale a fila de descarga: quem descarrega é a espécie com maior facilidade. Por isso NaCl(aq) produz H₂ e Cl₂ — e não sódio metálico — deixando NaOH na solução.',
      formula: 'compete: íon do sal × H₂O',
      formulaNote: 'Cátions de metais alcalinos e alcalinoterrosos não descarregam em água; ânions oxigenados como SO₄²⁻ e NO₃⁻ também não.',
      hintCanvas: 'Enter/Espaço liga e desliga a fonte',
      icon: '💧',
      def: 'Com água presente, quem descarrega é a espécie com maior facilidade — segue a fila de descarga, não o próprio sal.',
      fatos: [
        { l: 'Não descarregam', v: 'alcalinos, SO₄²⁻, NO₃⁻' },
        { l: 'Exemplo',         v: 'NaCl(aq) → H₂ + Cl₂' },
        { l: 'Sobra',           v: 'NaOH em solução' },
        { l: 'Eletrólitos',     v: '6 disponíveis' },
      ],
      canvasInteracao: 'Escolha o eletrólito e descubra quais íons realmente descarregam nos eletrodos, com a água competindo.',
      recomendados: ['NaCl(aq)', 'CuSO₄(aq)', 'AgNO₃(aq)'],
      overlay: 'Eletrólise aquosa', panels: ['panel-aquosa'], primary: 'toggle-fonte-aq',
    },
    {
      id: 'faraday', sigla: 'm = MIt/nF', nome: 'Leis de Faraday', sub: 'Galvanoplastia',
      hint: 'Ajuste corrente e tempo para calcular quanta massa de metal se deposita no cátodo durante a galvanoplastia.',
      info: 'A massa depositada é proporcional à carga que passa pelo circuito. Como cada mol de elétrons transporta 96.500 C, basta dividir a carga por n·F para saber quantos mols de metal se formaram.',
      formula: 'm = (M · i · t) / (n · F)',
      formulaNote: 'M = massa molar (g/mol), i = corrente (A), t = tempo (s), n = elétrons por íon, F = 96.500 C/mol.',
      hintCanvas: 'Enter/Espaço inicia a deposição',
      icon: '⚡',
      def: 'A massa depositada no cátodo é proporcional à carga elétrica: cada mol de elétrons transporta 96.500 coulombs.',
      fatos: [
        { l: 'Fórmula',    v: 'm = (M·i·t)/(n·F)' },
        { l: 'F',          v: '96.500 C/mol' },
        { l: 'Aplicação',  v: 'galvanoplastia' },
        { l: 'Cientista',  v: 'Faraday, 1834' },
      ],
      canvasInteracao: 'Ajuste corrente e tempo e veja quanta massa de metal se deposita no cátodo durante a galvanoplastia.',
      recomendados: ['Prata (Ag)', 'Cobre (Cu)', 'Cromo (Cr)'],
      overlay: 'Lei de Faraday', panels: ['panel-faraday'], primary: 'depositar',
    },
  ],

  CURIOSIDADES: [
    'A pilha de Daniell (zinco e cobre) fornece 1,10 V — foi a primeira fonte de corrente contínua confiável, em 1836.',
    'O zinco protege o casco de navios como "ânodo de sacrifício": ele se oxida no lugar do ferro.',
    'Ferro galvanizado é ferro coberto de zinco; mesmo com a camada arranhada, o zinco continua protegendo.',
    'A ponte salina impede que as soluções se misturem, mas mantém a neutralidade elétrica das meias-células.',
    'Os elétrons sempre saem do ânodo e vão para o cátodo pelo fio externo — na pilha, o ânodo é o polo negativo.',
    'Uma bateria de carro de 12 V é formada por seis pilhas de chumbo-ácido de cerca de 2 V ligadas em série.',
    'O ouro não enferruja porque seu potencial de redução, +1,50 V, é altíssimo: ele quase nunca se oxida.',
    'O alumínio só ficou barato depois do processo Hall-Héroult, de 1886, que o obtém por eletrólise ígnea da alumina.',
    'Cerca de 5 % de toda a eletricidade produzida no Brasil vai para reduzir alumínio eletroliticamente.',
    'Na eletrólise, ânodo é o polo POSITIVO — o inverso da pilha, onde o ânodo é negativo. A oxidação é que continua no ânodo.',
    'Cromar um para-choque é galvanoplastia: a peça é o cátodo e recebe uma camada finíssima de cromo metálico.',
    'A eletrólise da água precisa de um eletrólito de apoio, porque água puríssima conduz muito mal a corrente.',
    'Michael Faraday enunciou suas leis da eletrólise em 1834, muito antes de o elétron ser descoberto.',
    'A soda cáustica industrial vem do processo cloro-álcali: eletrólise de salmoura que gera NaOH, Cl₂ e H₂ juntos.',
  ],
};
