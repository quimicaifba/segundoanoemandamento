/* ================================================================
   SIGAS — dadosgases.js | dados fixos do simulador de Gases
   ================================================================
   FONTES OFICIAIS DOS DADOS
   · Massas molares (M): pesos atômicos padrão IUPAC 2021
     (Pure Appl. Chem. 93, 573–600, 2021), abreviados a 2 casas.
   · Pontos de ebulição (Teb, 1 atm): NIST Chemistry WebBook
     (webbook.nist.gov). CO₂ e SF₆ SUBLIMAM a 1 atm (flag sub).
   · Constantes de van der Waals (a, b): CRC Handbook of
     Chemistry & Physics, convertidas para atm·L²·mol⁻² e L·mol⁻¹.
   · R = 0,082 atm·L·mol⁻¹·K⁻¹ (praxe do Ensino Médio; valor
     CODATA/NIST: 0,082057) · RSI = 8,314 J·mol⁻¹·K⁻¹ (CODATA 2018).
   · Lei de Graham: v₁/v₂ = √(M₂/M₁) — Atkins & de Paula; Chang.
   · Teoria cinética: v_rms = √(3RT/M) — postulados de Maxwell
     e Boltzmann; distribuição de rapidez de Maxwell-Boltzmann.
   ================================================================ */
'use strict';

window.SIM_DATA = {
  ACRO: 'SIGAS',
  TITLE: 'Simulador Interativo de Gases',

  R:   0.082,  // atm·L·mol⁻¹·K⁻¹ (Clapeyron, convenção escolar)
  RSI: 8.314,  // J·mol⁻¹·K⁻¹ (CODATA 2018 / NIST) — para v_rms em m/s
  PART_PER_MOL: 80, // no Motor Cinético, 80 partículas ≙ 1 mol

  /* ── Biblioteca de gases (ordem crescente de massa molar) ──
     id · f (fórmula) · nome · M (g/mol, IUPAC 2021) ·
     Teb (°C a 1 atm, NIST; sub = sublima) ·
     a (atm·L²·mol⁻²) e b (L·mol⁻¹) de van der Waals (CRC) ·
     cat (categoria) · cor das partículas · desc (1 linha) ── */
  GASES: [
    { id: 'h2',  f: 'H₂',  nome: 'hidrogênio', M: 2.016,  Teb: -252.9,
      a: 0.244,  b: 0.0266, cat: 'simples', cor: '#38bdf8',
      desc: 'O gás mais leve que existe: combustível de foguetes e candidato a vetor energético limpo.' },
    { id: 'he',  f: 'He',  nome: 'hélio', M: 4.003,  Teb: -268.9,
      a: 0.0341, b: 0.0238, cat: 'nobre', cor: '#f9a8d4',
      desc: 'Inerte e leve: enche balões, resfria ímãs de ressonância magnética e brilha rosado em tubos de descarga.' },
    { id: 'ch4', f: 'CH₄', nome: 'metano', M: 16.04,  Teb: -161.5,
      a: 2.25,   b: 0.0428, cat: 'org', cor: '#2dd4bf',
      desc: 'Principal componente do gás natural e do biogás; potente gás de efeito estufa.' },
    { id: 'nh3', f: 'NH₃', nome: 'amônia', M: 17.03,  Teb: -33.3,
      a: 4.17,   b: 0.0371, cat: 'comp', cor: '#fbbf24',
      desc: 'Base dos fertilizantes (processo Haber-Bosch); pungente e muito solúvel em água.' },
    { id: 'ne',  f: 'Ne',  nome: 'neônio', M: 20.18,  Teb: -246.0,
      a: 0.211,  b: 0.0171, cat: 'nobre', cor: '#fb7185',
      desc: 'O gás nobre dos letreiros: brilha vermelho-alaranjado quando eletrizado.' },
    { id: 'n2',  f: 'N₂',  nome: 'nitrogênio', M: 28.01,  Teb: -195.8,
      a: 1.35,   b: 0.0387, cat: 'simples', cor: '#a78bfa',
      desc: '78% do ar; a ligação tripla o torna tão estável que vira atmosfera inerte de alimentos.' },
    { id: 'co',  f: 'CO',  nome: 'monóxido de carbono', M: 28.01,  Teb: -191.5,
      a: 1.45,   b: 0.0395, cat: 'comp', cor: '#9ca3af',
      desc: 'Incolor e inodoro, liga-se à hemoglobina ~250× melhor que o O₂ — o “assassino silencioso”.' },
    { id: 'o2',  f: 'O₂',  nome: 'oxigênio', M: 32.00,  Teb: -183.0,
      a: 1.36,   b: 0.0319, cat: 'simples', cor: '#f87171',
      desc: '21% do ar; comburente da respiração celular e das combustões.' },
    { id: 'h2s', f: 'H₂S', nome: 'sulfeto de hidrogênio', M: 34.08,  Teb: -60.3,
      a: 4.48,   b: 0.0434, cat: 'comp', cor: '#eab308',
      desc: 'O gás do ovo podre: tóxico e traiçoeiro, pois anestesia o olfato em concentrações altas.' },
    { id: 'hcl', f: 'HCl', nome: 'cloreto de hidrogênio', M: 36.46,  Teb: -85.0,
      a: 3.67,   b: 0.0408, cat: 'comp', cor: '#4ade80',
      desc: 'Fumega em ar úmido; dissolvido em água forma o ácido clorídrico (muriático).' },
    { id: 'ar',  f: 'Ar',  nome: 'argônio', M: 39.95,  Teb: -185.8,
      a: 1.34,   b: 0.0320, cat: 'nobre', cor: '#c084fc',
      desc: '0,93% do ar: protege soldas, enche lâmpadas e brilha lilás em tubos de descarga.' },
    { id: 'co2', f: 'CO₂', nome: 'dióxido de carbono', M: 44.01,  Teb: -78.5, sub: true,
      a: 3.61,   b: 0.0429, cat: 'comp', cor: '#94a3b8',
      desc: 'Gás das bebidas e da fotossíntese; a 1 atm sublima a −78,5 °C — é o gelo-seco.' },
    { id: 'n2o', f: 'N₂O', nome: 'óxido nitroso', M: 44.01,  Teb: -88.5,
      a: 3.78,   b: 0.0442, cat: 'comp', cor: '#f0abfc',
      desc: 'O gás hilariante: anestésico odontológico e propelente do chantili.' },
    { id: 'o3',  f: 'O₃',  nome: 'ozônio', M: 48.00,  Teb: -112.0,
      a: 3.52,   b: 0.0487, cat: 'simples', cor: '#60a5fa',
      desc: 'Azul-pálido: na estratosfera filtra o UV; ao nível do solo é poluente oxidante.' },
    { id: 'so2', f: 'SO₂', nome: 'dióxido de enxofre', M: 64.06,  Teb: -10.0,
      a: 6.77,   b: 0.0568, cat: 'comp', cor: '#fdba74',
      desc: 'De vulcões e da queima de combustíveis com enxofre; precursor da chuva ácida.' },
    { id: 'cl2', f: 'Cl₂', nome: 'cloro', M: 70.90,  Teb: -34.0,
      a: 6.26,   b: 0.0542, cat: 'simples', cor: '#a3e635',
      desc: 'Amarelo-esverdeado, denso e tóxico; trata a água das cidades e das piscinas.' },
    { id: 'kr',  f: 'Kr',  nome: 'criptônio', M: 83.80,  Teb: -153.4,
      a: 2.32,   b: 0.0398, cat: 'nobre', cor: '#86efac',
      desc: 'Gás nobre raro de lâmpadas de flash; brilha branco-esverdeado na descarga elétrica.' },
    { id: 'xe',  f: 'Xe',  nome: 'xenônio', M: 131.29, Teb: -108.1,
      a: 4.14,   b: 0.0516, cat: 'nobre', cor: '#93c5fd',
      desc: 'Dos faróis automotivos aos propulsores iônicos de sondas espaciais.' },
    { id: 'sf6', f: 'SF₆', nome: 'hexafluoreto de enxofre', M: 146.06, Teb: -63.8, sub: true,
      a: 7.75,   b: 0.0879, cat: 'comp', cor: '#67e8f9',
      desc: 'Isolante elétrico ~5× mais denso que o ar; deixa a voz grave (efeito oposto ao do hélio).' },
  ],

  CATEGORIAS: {
    simples: 'Substância simples',
    nobre:   'Gás nobre',
    comp:    'Composto inorgânico',
    org:     'Hidrocarboneto',
  },

  /* ── Duplas clássicas para a corrida de Graham ── */
  PARES: [
    { a: 'nh3', b: 'hcl', rot: 'NH₃ × HCl', tag: 'O clássico anel branco de NH₄Cl' },
    { a: 'h2',  b: 'sf6', rot: 'H₂ × SF₆',  tag: 'Maior contraste da biblioteca: razão √(146/2) ≈ 8,5' },
    { a: 'he',  b: 'o2',  rot: 'He × O₂',   tag: 'Por que o balão de festa murcha antes do ar entrar' },
    { a: 'n2',  b: 'co',  rot: 'N₂ × CO',   tag: 'Empate técnico: massas molares praticamente iguais (28 g/mol)' },
  ],

  /* ── Transformações do modo 1 (rótulos e leis históricas) ── */
  TRANSFORMACOES: {
    isotermica: { nome: 'Isotérmica', lei: 'Lei de Boyle (1662)',
      inv: 'P·V', frase: 'T constante: pressão e volume são inversamente proporcionais.' },
    isobarica:  { nome: 'Isobárica',  lei: 'Lei de Charles (1787)',
      inv: 'V/T', frase: 'P constante: o volume cresce na mesma proporção da temperatura absoluta.' },
    isocorica:  { nome: 'Isocórica',  lei: 'Lei de Gay-Lussac (1802)',
      inv: 'P/T', frase: 'V constante: a pressão cresce na mesma proporção da temperatura absoluta.' },
  },

  MODES: [
    {
      id: 'transform', sigla: 'P·V/T', nome: 'Transformações Gasosas', sub: 'Pistão e as três leis',
      hint: 'Escolha uma transformação, mova temperatura, volume ou pressão e acompanhe o pistão e o manômetro responderem.',
      info: 'Cada transformação mantém uma grandeza constante: na isotérmica (Boyle), P e V são inversamente proporcionais; na isobárica (Charles), V cresce com T; na isocórica (Gay-Lussac), P cresce com T. As três se resumem na equação geral P₁V₁/T₁ = P₂V₂/T₂, agora com a quantidade de gás n também ajustável. As partículas do pistão rodam no motor cinético: colidem entre si e com as paredes, e ficam mais rápidas quando T sobe.',
      formula: 'P·V = n·R·T',
      formulaNote: 'Temperatura SEMPRE em kelvin: T(K) = t(°C) + 273 (0 K = −273 °C é o zero absoluto). Isotérmica: P·V constante · Isobárica: V/T constante · Isocórica: P/T constante.',
      icon: '🔄',
      def: 'Três leis clássicas dos gases — cada uma mantém uma grandeza constante (T, P ou V) enquanto as outras duas variam juntas.',
      fatos: [
        { l: 'Leis',          v: 'Boyle · Charles · Gay-Lussac' },
        { l: 'Período',       v: '1662 – 1802' },
        { l: 'Fórmula geral', v: 'P₁V₁/T₁ = P₂V₂/T₂' },
        { l: 'Variáveis',     v: 'n, T, V, P' },
      ],
      canvasInteracao: 'O pistão e o manômetro respondem ao vivo: escolha isotérmica, isobárica ou isocórica e mova n, T, V ou P.',
      recomendados: ['Isotérmica', 'Isobárica', 'Isocórica'],
      overlay: 'Transformações', panels: ['panel-transf-tipo', 'panel-transf-param', 'panel-transf-acoes'], primary: 'tr-reset',
    },
    {
      id: 'clapeyron', sigla: 'PV = nRT', nome: 'Equação de Clapeyron', sub: 'Gás ideal e a biblioteca',
      hint: 'Escolha um gás da biblioteca, ajuste n, T e V e calcule pressão e densidade — a ficha completa aparece em Resultados.',
      info: 'A equação de Clapeyron PV = nRT reúne todas as leis dos gases numa só: conhecendo três grandezas, a quarta fica determinada. Nas CNTP (0 °C e 1 atm), 1 mol de qualquer gás ideal ocupa 22,4 L. A densidade sai de d = PM/RT — gases de maior massa molar são mais densos nas mesmas condições. Ao escolher um gás, o painel Resultados mostra sua ficha: ponto de ebulição, densidade nas CNTP, velocidade média das moléculas e as constantes de van der Waals, que corrigem a equação para gases reais.',
      formula: 'P·V = n·R·T   ·   d = P·M/(R·T)',
      formulaNote: 'R = 0,082 atm·L·mol⁻¹·K⁻¹ · P em atm, V em L, T em K, n em mol, M em g/mol → d em g/L. Ficha do gás: M pela IUPAC 2021, Teb pelo NIST WebBook, a (atm·L²·mol⁻²) e b (L·mol⁻¹) de van der Waals pelo CRC Handbook.',
      icon: '🧮',
      def: 'A equação PV = nRT reúne todas as leis dos gases numa só relação entre pressão, volume, quantidade de matéria e temperatura.',
      fatos: [
        { l: 'Fórmula',    v: 'PV = nRT' },
        { l: 'Constante R', v: '0,082 atm·L/mol·K' },
        { l: 'Nas CNTP',   v: '1 mol = 22,4 L' },
        { l: 'Biblioteca', v: '19 gases' },
      ],
      canvasInteracao: 'Escolha um gás da biblioteca e ajuste n, T e V: a pressão calculada aparece no manômetro e a ficha completa em Resultados.',
      recomendados: ['H₂', 'SF₆', 'CO₂', 'He'],
      overlay: 'Clapeyron', panels: ['panel-clape-gas', 'panel-clape-param', 'panel-clape-acoes'], primary: 'cla-status',
    },
    {
      id: 'graham', sigla: 'v ∝ 1/√M', nome: 'Difusão de Graham', sub: 'Corrida no tubo',
      hint: 'Solte dois gases nas pontas opostas de um tubo e veja o mais leve avançar mais rápido — como no anel de NH₄Cl.',
      info: 'Pela teoria cinética, a velocidade média de um gás é proporcional a √(T/M): quanto maior a temperatura e menor a massa molar, mais rápido o gás se move. Por isso, para dois gases na mesma temperatura, v₁/v₂ = √(M₂/M₁) — a Lei de Graham. No experimento clássico, NH₃ e HCl liberados nas pontas de um tubo formam o anel branco de NH₄Cl mais perto do lado do HCl, o gás mais pesado e mais lento. Experimente também N₂ × CO (empate: mesma massa molar), H₂ × SF₆ (o maior contraste da biblioteca) e mude a temperatura para ver as duas frentes acelerarem ou desacelerarem juntas. Foi por efusão que o urânio foi enriquecido como UF₆ gasoso no Projeto Manhattan.',
      formula: 'v ∝ √(T/M)   ·   v₁/v₂ = √(M₂/M₁)',
      formulaNote: 'Mesma temperatura → mesma energia cinética média: ½m₁v₁² = ½m₂v₂². O gás leve compensa a massa com velocidade; subir a temperatura acelera os dois gases proporcionalmente. Massas molares: IUPAC 2021.',
      icon: '🏁',
      def: 'Gases mais leves se espalham mais rápido: a velocidade de difusão é inversamente proporcional à raiz quadrada da massa molar.',
      fatos: [
        { l: 'Lei',            v: 'v₁/v₂ = √(M₂/M₁)' },
        { l: 'Cientista',      v: 'Thomas Graham' },
        { l: 'Uso histórico',  v: 'Enriquecimento de urânio' },
        { l: 'Dupla clássica', v: 'NH₃ × HCl' },
      ],
      canvasInteracao: 'Solte dois gases nas pontas do tubo: o mais leve avança mais rápido, formando o anel de NH₄Cl mais perto do lado mais pesado.',
      recomendados: ['NH₃ × HCl', 'H₂ × SF₆', 'He × O₂', 'N₂ × CO'],
      overlay: 'Lei de Graham', panels: ['panel-graham-gases', 'panel-graham-param', 'panel-graham-pares', 'panel-graham-acoes'], primary: 'liberar',
    },
    {
      id: 'cinetica', sigla: '½m·v²', nome: 'Teoria Cinética', sub: 'Motor de partículas',
      hint: 'Um motor físico de verdade: partículas com colisões elásticas, distribuição de Maxwell-Boltzmann e pressão medida pelos choques nas paredes.',
      info: 'A teoria cinético-molecular explica os gases pelo movimento: partículas em movimento caótico, colisões elásticas e energia cinética média proporcional à temperatura. Aqui cada partícula é simulada individualmente por um motor físico — as velocidades são sorteadas pela distribuição de Maxwell-Boltzmann (mais rápidas quanto maior T e menor M) e a pressão do manômetro NÃO vem de fórmula: é medida somando o impulso de cada choque contra as paredes, e mesmo assim converge para P = nRT/V. Desligue as colisões, iguale as velocidades e religue-as para ver a distribuição de Maxwell-Boltzmann emergir sozinha no histograma.',
      formula: 'v_rms = √(3RT/M)   ·   Ec média = (3/2)·(R/N_A)·T',
      formulaNote: 'R = 8,314 J·mol⁻¹·K⁻¹ (CODATA/NIST) e M em kg/mol → v_rms em m/s. No manômetro, a pressão é medida pelo impulso 2m·v⊥ dos choques nas paredes (teoria cinética 2D) e calibrada para atm; 80 partículas ≙ 1 mol.',
      icon: '⚛️',
      def: 'Explica os gases pelo movimento caótico das partículas: a energia cinética média é proporcional à temperatura absoluta.',
      fatos: [
        { l: 'Fórmula',    v: 'v_rms = √(3RT/M)' },
        { l: 'Modelo',     v: 'Maxwell-Boltzmann' },
        { l: 'Pressão',    v: 'Medida, não calculada' },
        { l: 'Partículas', v: '10 a 240 simuladas' },
      ],
      canvasInteracao: 'Um motor físico real: partículas com colisões elásticas, cor por gás ou velocidade, e histograma de Maxwell-Boltzmann.',
      recomendados: ['H₂', 'SF₆'],
      overlay: 'Teoria Cinética', panels: ['panel-kin-gas', 'panel-kin-param', 'panel-kin-exibicao', 'panel-kin-acoes'], primary: 'kin-mb',
    },
  ],

  CURIOSIDADES: [
    'Nas CNTP, 1 mol de qualquer gás ideal ocupa os mesmos 22,4 L — seja hidrogênio, seja hexafluoreto de enxofre.',
    'Balões de festa com hélio murcham em poucos dias: o átomo é tão pequeno que efunde pelos poros da borracha (Graham em ação).',
    'N₂ e CO têm praticamente a mesma massa molar (28 g/mol): na corrida de Graham eles empatam — e por isso o CO é tão difícil de separar do ar.',
    'Foi com a efusão de Graham que o urânio foi enriquecido no Projeto Manhattan: o UF₆ com ²³⁵U atravessa barreiras porosas só 0,4% mais rápido que o com ²³⁸U — foram precisos milhares de estágios.',
    'Inalar SF₆ (146 g/mol) deixa a voz grave e hélio (4 g/mol) deixa fina: a velocidade do som varia com 1/√M.',
    'Pneus calibrados de manhã ganham pressão ao longo de uma viagem: o atrito aquece o ar e, a volume quase constante, P sobe com T.',
    'A panela de pressão é uma transformação isocórica: o vapor preso eleva a pressão e a água só ferve perto de 120 °C.',
    'Mergulhadores sobem devagar por causa de Boyle: o ar nos pulmões expande quando a pressão externa cai.',
    'O CO₂ é mais denso que o ar (44 g/mol contra ≈ 29): por isso se acumula no fundo de poços, silos e caixas de fermentação.',
    'A 1 atm o gelo-seco (CO₂) sublima a −78,5 °C: passa direto de sólido a gás, sem virar líquido.',
    'Cada gás nobre tem cor própria na descarga elétrica: neônio vermelho-alaranjado, argônio lilás, hélio rosado, criptônio branco-esverdeado.',
    'A 25 °C, uma molécula de H₂ voa em média a mais de 1900 m/s — quase 7000 km/h; a de SF₆, a “apenas” 225 m/s.',
    'Aerossóis avisam para não aquecer a lata: a volume constante, aquecer dispara a pressão interna (Gay-Lussac).',
  ],
};
