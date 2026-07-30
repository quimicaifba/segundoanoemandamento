/* ================================================================
   SIEQ — dadosequilibrio.js | dados de Equilíbrio Químico e Iônico
   ================================================================
   FONTES: H₂ + I₂ ⇌ 2 HI (Kc ≈ 50 a 448 °C, Bodenstein) e
   N₂O₄ ⇌ 2 NO₂ (ΔH = +57,2 kJ/mol) — Chang; Atkins. Constantes de
   ionização Ka/Kb a 25 °C — CRC Handbook (97ª ed.). Faixas de
   viragem dos indicadores — Vogel. Kw = 1,0·10⁻¹⁴ a 25 °C.
   ================================================================ */
'use strict';

window.SIM_DATA = {
  ACRO: 'SIEQ',
  TITLE: 'Simulador Interativo de Equilíbrio Químico e Iônico',

  HI:  { kc: 50, eq: 'H₂(g) + I₂(g) ⇌ 2 HI(g)', temp: 448 },
  NO2: { kc25: 4.6e-3, dh: 57.2, eq: 'N₂O₄(g) ⇌ 2 NO₂(g)', r: 0.008314 },

  PERTURBACOES: [
    { id: 'add-n2o4', rot: 'Adicionar N₂O₄' },
    { id: 'add-no2',  rot: 'Adicionar NO₂' },
    { id: 'aquecer',  rot: 'Aquecer +10 °C' },
    { id: 'resfriar', rot: 'Resfriar −10 °C' },
    { id: 'comprimir', rot: 'Reduzir volume' },
    { id: 'expandir', rot: 'Aumentar volume' },
  ],

  KW: 1e-14,

  /* ── Substâncias do cotidiano (pH médio a 25 °C) ── */
  SUBSTANCIAS: [
    { id: 'gastrico', nome: 'Suco gástrico',     ph: 2.0,  cor: '#dc2626' },
    { id: 'limao',    nome: 'Suco de limão',     ph: 2.3,  cor: '#ea580c' },
    { id: 'vinagre',  nome: 'Vinagre',           ph: 2.9,  cor: '#f97316' },
    { id: 'refri',    nome: 'Refrigerante cola', ph: 3.0,  cor: '#f59e0b' },
    { id: 'cafe',     nome: 'Café',              ph: 5.0,  cor: '#facc15' },
    { id: 'chuva',    nome: 'Chuva natural',     ph: 5.6,  cor: '#d9f99d' },
    { id: 'leite',    nome: 'Leite',             ph: 6.6,  cor: '#a3e635' },
    { id: 'agua',     nome: 'Água pura',         ph: 7.0,  cor: '#4ade80' },
    { id: 'sangue',   nome: 'Sangue',            ph: 7.4,  cor: '#34d399' },
    { id: 'marinha',  nome: 'Água do mar',       ph: 8.0,  cor: '#22d3ee' },
    { id: 'magnesia', nome: 'Leite de magnésia', ph: 10.5, cor: '#3b82f6' },
    { id: 'amoniaco', nome: 'Amoníaco caseiro',  ph: 11.5, cor: '#6366f1' },
    { id: 'soda',     nome: 'Soda cáustica',     ph: 13.5, cor: '#8b5cf6' },
  ],

  /* ── Ácidos e bases do modo Cálculo ── */
  ELETROLITOS: [
    { id: 'hcl',   nome: 'HCl',        tipo: 'acido', forte: true,  k: null,    dot: '#f87171', desc: 'ácido forte (100 % ionizado)' },
    { id: 'hf',    nome: 'HF',         tipo: 'acido', forte: false, k: 6.8e-4,  dot: '#fb923c', desc: 'ácido fraco, Ka = 6,8·10⁻⁴' },
    { id: 'hac',   nome: 'CH₃COOH',    tipo: 'acido', forte: false, k: 1.8e-5,  dot: '#fbbf24', desc: 'ácido acético, Ka = 1,8·10⁻⁵' },
    { id: 'naoh',  nome: 'NaOH',       tipo: 'base',  forte: true,  k: null,    dot: '#60a5fa', desc: 'base forte (100 % dissociada)' },
    { id: 'nh3',   nome: 'NH₃',        tipo: 'base',  forte: false, k: 1.8e-5,  dot: '#a78bfa', desc: 'amônia, Kb = 1,8·10⁻⁵' },
  ],

  /* ── Indicadores: faixa de viragem e cores ── */
  INDICADORES: [
    { id: 'fenol',  nome: 'Fenolftaleína',          a: 8.2, b: 10.0, c1: '#e2e8f0', c2: '#e91e8c', r1: 'incolor', r2: 'rosa' },
    { id: 'metila', nome: 'Alaranjado de metila',   a: 3.1, b: 4.4,  c1: '#e53e3e', c2: '#f6e05e', r1: 'vermelho', r2: 'amarelo' },
    { id: 'bromo',  nome: 'Azul de bromotimol',     a: 6.0, b: 7.6,  c1: '#eab308', c2: '#2563eb', r1: 'amarelo', r2: 'azul' },
    { id: 'tornas', nome: 'Tornassol',              a: 4.5, b: 8.3,  c1: '#dc2626', c2: '#2563eb', r1: 'vermelho', r2: 'azul' },
  ],

  /* ── Titulação padrão: 25,0 mL de HCl 0,100 M com NaOH 0,100 M ── */
  TIT: { va: 25.0, ca: 0.100, cb: 0.100 },

  /* ── ids de modo atendidos pela SEGUNDA mecânica (fachada Mech) ── */
  MECH_B: ['escala', 'calculo', 'titulacao'],

  MODES: [
    {
      id: 'atingir', sigla: 'v→v', nome: 'Atingindo o Equilíbrio', sub: 'H₂ + I₂ ⇌ 2 HI',
      hint: 'Parta de hidrogênio e iodo e acompanhe as concentrações até o platô, quando as velocidades direta e inversa se igualam.',
      info: 'O equilíbrio é dinâmico: as reações direta e inversa continuam acontecendo, mas com velocidades iguais, e as concentrações param de mudar. Qualquer que seja o ponto de partida, a mesma temperatura leva ao mesmo Kc.',
      formula: 'Kc = [HI]² / ([H₂]·[I₂]) ≈ 50 (448 °C)',
      formulaNote: 'No equilíbrio v_direta = v_inversa. As concentrações ficam constantes, não iguais.',
      hintCanvas: 'Enter/Espaço reinicia a reação',
      icon: '⚖️',
      def: 'O equilíbrio é dinâmico: as reações direta e inversa não param, só passam a ter a mesma velocidade.',
      fatos: [
        { l: 'Reação',  v: 'H₂ + I₂ ⇌ 2 HI' },
        { l: 'Kc',      v: '≈ 50 (448 °C)' },
        { l: 'Tipo',    v: 'Equilíbrio homogêneo' },
        { l: 'Fonte',   v: 'Bodenstein' },
      ],
      canvasInteracao: 'Acompanhe [H₂], [I₂] e [HI] mudarem até o platô, onde as concentrações param de variar.',
      overlay: 'Rumo ao equilíbrio', panels: ['panel-atingir'], primary: 'eq-reset',
    },
    {
      id: 'lechatelier', sigla: 'Le Chatelier', nome: 'Princípio de Le Chatelier', sub: 'N₂O₄ ⇌ 2 NO₂',
      hint: 'Perturbe o equilíbrio incolor-castanho adicionando gases, mudando a temperatura ou o volume e veja o sistema reagir.',
      info: 'Perturbado, o equilíbrio se desloca no sentido que atenua a perturbação. Como a reação é endotérmica, aquecer desloca para NO₂ (castanho) e resfriar para N₂O₄ (incolor). Comprimir favorece o lado com menos mols de gás.',
      formula: 'Q vs. Kc decide o sentido do deslocamento',
      formulaNote: 'Q < K desloca para a direita; Q > K desloca para a esquerda; Q = K é o equilíbrio.',
      hintCanvas: 'Enter/Espaço aquece o frasco em 10 °C',
      icon: '↔️',
      def: 'Perturbado, o equilíbrio se desloca no sentido que atenua a perturbação — é o princípio de Le Chatelier.',
      fatos: [
        { l: 'Reação', v: 'N₂O₄ ⇌ 2 NO₂' },
        { l: 'ΔH',     v: '+57,2 kJ/mol (endo)' },
        { l: 'Cores',  v: 'incolor ↔ castanho' },
        { l: 'Ano',    v: 'Le Chatelier, 1884' },
      ],
      canvasInteracao: 'Adicione gás, aqueça, resfrie ou mude o volume e veja o frasco mudar de cor com o deslocamento.',
      recomendados: ['Adicionar N₂O₄', 'Aquecer +10 °C', 'Reduzir volume'],
      overlay: 'Le Chatelier', panels: ['panel-lechatelier'], primary: 'aquecer',
    },
    {
      id: 'qk', sigla: 'Q ⋛ K', nome: 'Quociente Q e Constante K', sub: 'Prever o sentido',
      hint: 'Escolha concentrações arbitrárias, compare o quociente Q com a constante Kc e descubra para que lado a reação caminha.',
      info: 'O quociente de reação Q tem a mesma expressão de Kc, mas vale para qualquer instante. Comparando Q com Kc é possível prever se ainda faltam produtos, se falta reagente, ou se o sistema já está em equilíbrio.',
      formula: 'Q = [HI]² / ([H₂]·[I₂])',
      formulaNote: 'Q < Kc: consome reagentes. Q > Kc: consome produtos. Q = Kc: equilíbrio.',
      hintCanvas: 'Enter/Espaço anuncia a comparação',
      icon: '🔍',
      def: 'Comparando Q com Kc dá pra prever se a reação ainda vai formar produto, reagente, ou já está no equilíbrio.',
      fatos: [
        { l: 'Expressão', v: '[HI]²/([H₂][I₂])' },
        { l: 'Q < Kc',    v: 'forma produto' },
        { l: 'Q > Kc',    v: 'forma reagente' },
        { l: 'Q = Kc',    v: 'equilíbrio' },
      ],
      canvasInteracao: 'Escolha concentrações livres e veja o veredito: pra qual lado a reação caminha.',
      overlay: 'Q contra K', panels: ['panel-qk'], primary: 'qk-status',
    },
    {
      id: 'escala', sigla: '0–14', nome: 'Escala de pH', sub: 'Substâncias do dia a dia',
      hint: 'Percorra a escala de pH, escolha substâncias do cotidiano e veja as concentrações de íons hidrônio e hidróxido.',
      info: 'O pH é o cologaritmo da concentração de H₃O⁺. Cada unidade de pH representa uma mudança de dez vezes na acidez. Como Kw = [H₃O⁺]·[OH⁻] = 10⁻¹⁴ a 25 °C, sempre vale pH + pOH = 14.',
      formula: 'pH = −log[H₃O⁺]   ·   pH + pOH = 14',
      formulaNote: 'Kw = [H₃O⁺]·[OH⁻] = 1,0·10⁻¹⁴ a 25 °C. pH < 7 ácido, = 7 neutro, > 7 básico.',
      hintCanvas: 'Setas ← → movem o pH; Enter/Espaço anuncia a leitura',
      icon: '💧',
      def: 'Cada unidade de pH representa dez vezes mais ou menos acidez — a escala é logarítmica, não linear.',
      fatos: [
        { l: 'Fórmula', v: 'pH = −log[H₃O⁺]' },
        { l: 'Kw',      v: '1,0×10⁻¹⁴ (25 °C)' },
        { l: 'Neutro',  v: 'pH = 7' },
        { l: 'Faixa',   v: '0 a 14' },
      ],
      canvasInteracao: 'Mova o pH pela escala e veja [H₃O⁺]/[OH⁻] e qual substância do dia a dia tem aquele valor.',
      recomendados: ['Suco gástrico', 'Água pura', 'Soda cáustica'],
      overlay: 'Escala de pH', panels: ['panel-escala'], primary: 'esc-status',
    },
    {
      id: 'calculo', sigla: 'Ka, Kb', nome: 'Ácidos e Bases', sub: 'Fortes × fracos',
      hint: 'Compare a ionização de ácidos e bases fortes e fracos na mesma concentração e calcule o pH e o grau de ionização.',
      info: 'Eletrólito forte ioniza praticamente por completo; o fraco estabelece equilíbrio governado por Ka ou Kb. Por isso HCl 0,1 mol/L tem pH 1, enquanto ácido acético na mesma concentração fica perto de pH 2,9.',
      formula: '[H⁺] = (−Ka + √(Ka² + 4·Ka·C)) / 2',
      formulaNote: 'Solução exata do equilíbrio do ácido fraco. Grau de ionização α = [H⁺]/C.',
      hintCanvas: 'Enter/Espaço anuncia o pH calculado',
      icon: '⚗️',
      def: 'Ácido ou base forte ioniza quase 100%; o fraco estabelece um equilíbrio próprio, regido por Ka ou Kb.',
      fatos: [
        { l: 'HCl (forte)',     v: 'pH = 1' },
        { l: 'CH₃COOH (fraco)', v: 'Ka = 1,8×10⁻⁵' },
        { l: 'Grau α',          v: '[H⁺]/C' },
        { l: 'Fonte',           v: 'CRC Handbook' },
      ],
      canvasInteracao: 'Escolha um eletrólito forte ou fraco e compare o pH e o grau de ionização na mesma concentração.',
      recomendados: ['HCl', 'CH₃COOH', 'NH₃'],
      overlay: 'Cálculo de pH', panels: ['panel-calculo'], primary: 'calc-status',
    },
    {
      id: 'titulacao', sigla: 'V×pH', nome: 'Titulação', sub: 'HCl com NaOH',
      hint: 'Goteje base sobre o ácido, acompanhe a curva de titulação e observe a virada do indicador no ponto de equivalência.',
      info: 'Na titulação ácido forte–base forte, o pH sobe devagar até quase 25 mL e então salta bruscamente: é o ponto de equivalência, em pH 7. O indicador deve ter faixa de viragem dentro desse salto.',
      formula: 'no ponto de equivalência: n_ácido = n_base',
      formulaNote: '25,0 mL de HCl 0,100 mol/L exigem 25,0 mL de NaOH 0,100 mol/L. Antes: excesso de ácido. Depois: excesso de base.',
      hintCanvas: 'Enter/Espaço goteja base',
      icon: '🧪',
      def: 'Perto do ponto de equivalência o pH salta bruscamente — é aí que o indicador precisa mudar de cor.',
      fatos: [
        { l: 'Ácido',       v: 'HCl 25,0 mL 0,100 M' },
        { l: 'Base',        v: 'NaOH 0,100 M' },
        { l: 'Equivalência', v: 'pH = 7' },
        { l: 'Indicador',   v: 'vira dentro do salto' },
      ],
      canvasInteracao: 'Goteje base sobre o ácido e acompanhe a curva de titulação subir, com o salto na equivalência.',
      recomendados: ['Fenolftaleína', 'Azul de bromotimol', 'Tornassol'],
      overlay: 'Titulação', panels: ['panel-titulacao'], primary: 'gotejar',
    },
  ],

  CURIOSIDADES: [
    'A seta dupla ⇌ indica equilíbrio dinâmico: nada para, as velocidades apenas se igualam.',
    'Kc depende só da temperatura — mudar concentração ou pressão desloca o equilíbrio, mas não altera K.',
    'O processo Haber-Bosch usa alta pressão para deslocar N₂ + 3 H₂ ⇌ 2 NH₃ para o lado com menos mols de gás.',
    'O NO₂ castanho da poluição urbana está sempre em equilíbrio com o N₂O₄ incolor: dia quente deixa o ar mais amarelado.',
    'No sangue, CO₂ + H₂O ⇌ H₂CO₃ ⇌ H⁺ + HCO₃⁻ mantém o pH perto de 7,4; hiperventilar desloca esse equilíbrio.',
    'Catalisador não desloca equilíbrio: ele acelera as duas reações igualmente e só faz chegar mais rápido ao mesmo ponto.',
    'A formação de cáries envolve o equilíbrio da hidroxiapatita do esmalte; o flúor desloca-o para um mineral mais resistente.',
    'Cada unidade de pH vale dez vezes: pH 3 é cem vezes mais ácido que pH 5.',
    'O sangue humano fica entre 7,35 e 7,45; fora dessa faixa estreita o organismo entra em acidose ou alcalose.',
    'Chuva natural já é levemente ácida (pH ≈ 5,6) por causa do CO₂ dissolvido; chuva ácida tem pH abaixo de 5.',
    'O repolho roxo é um indicador natural: vermelho em meio ácido, verde-amarelado em meio muito básico.',
    'O suco gástrico chega a pH 1,5: a mucosa se protege com uma camada de bicarbonato e muco.',
    'Antiácidos são bases fracas — hidróxido de magnésio ou bicarbonato — que neutralizam o excesso de HCl estomacal.',
    'A água pura tem pH 7 só a 25 °C; a 100 °C o Kw aumenta e a água neutra tem pH próximo de 6,1.',
  ],
};
