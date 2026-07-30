/* ================================================================
   SIRAD — dadosradioatividade.js | dados fixos de Radioatividade
   ================================================================
   FONTES: meias-vidas — CRC Handbook (97ª ed.) e IAEA Live Chart of
   Nuclides. Propriedades das emissões α, β e γ e poder de penetração
   — Chang, Química Geral; Usberco & Salvador. Fissão do U-235 com
   emissão média de 2–3 nêutrons por evento — literatura didática.
   ================================================================ */
'use strict';

window.SIM_DATA = {
  ACRO: 'SIRAD',
  TITLE: 'Simulador Interativo de Radioatividade',

  /* ── As três emissões naturais ── */
  EMISSOES: [
    { id: 'alfa', nome: 'Alfa (α)', simb: '₂⁴α', cor: '#f4522d',
      natureza: 'núcleo de hélio (2 p + 2 n)', carga: '+2', massa: '4 u',
      penetra: 'baixa', barrada: 'folha de papel / pele',
      efeito: 'o núcleo perde 2 prótons e 4 de massa (1ª Lei de Soddy)' },
    { id: 'beta', nome: 'Beta (β⁻)', simb: '₋₁⁰β', cor: '#38bdf8',
      natureza: 'elétron emitido pelo núcleo', carga: '−1', massa: '≈ 0',
      penetra: 'média', barrada: 'lâmina de alumínio (mm)',
      efeito: 'um nêutron vira próton: Z sobe 1, massa não muda (2ª Lei de Soddy)' },
    { id: 'gama', nome: 'Gama (γ)', simb: '₀⁰γ', cor: '#4ade80',
      natureza: 'onda eletromagnética', carga: '0', massa: '0',
      penetra: 'altíssima', barrada: 'só ATENUADA por chumbo/concreto espessos',
      efeito: 'não altera Z nem A — apenas libera o excesso de energia do núcleo' },
  ],

  /* ── Isótopos do modo Meia-vida ── */
  ISOTOPOS: [
    { id: 'tc99m', nome: 'Tecnécio-99m', simb: '⁹⁹ᵐTc', meia: '6,01 horas', cor: '#38bdf8',
      uso: 'traçador em exames de cintilografia (medicina nuclear)' },
    { id: 'i131', nome: 'Iodo-131', simb: '¹³¹I', meia: '8,02 dias', cor: '#a78bfa',
      uso: 'diagnóstico e tratamento de tireoide' },
    { id: 'co60', nome: 'Cobalto-60', simb: '⁶⁰Co', meia: '5,27 anos', cor: '#fbbf24',
      uso: 'radioterapia e esterilização de materiais' },
    { id: 'cs137', nome: 'Césio-137', simb: '¹³⁷Cs', meia: '30,2 anos', cor: '#f87171',
      uso: 'fontes industriais — protagonista do acidente de Goiânia (1987)' },
    { id: 'c14', nome: 'Carbono-14', simb: '¹⁴C', meia: '5.730 anos', cor: '#4ade80',
      uso: 'datação de fósseis e artefatos arqueológicos' },
    { id: 'u238', nome: 'Urânio-238', simb: '²³⁸U', meia: '4,5 bilhões de anos', cor: '#94a3b8',
      uso: 'datação geológica — idade da própria Terra' },
  ],

  /* ── Fissão em cadeia (modo 3) ── */
  FISSAO: { alvo: 'U-235', neutronsPorFissao: 3, eq: '²³⁵U + n → ⁹²Kr + ¹⁴¹Ba + 3 n + energia' },

  MODES: [
    {
      id: 'emissoes', sigla: 'α β γ', nome: 'Emissões Radioativas', sub: 'Penetração e desvio',
      hint: 'Emita os três tipos de radiação contra barreiras de papel, alumínio e chumbo, ou entre placas eletrizadas, e compare os comportamentos.',
      info: 'A radiação alfa é um núcleo de hélio: pesada, com carga +2, é barrada por uma folha de papel. A beta é um elétron veloz, barrado por alumínio. A gama é onda eletromagnética sem carga nem massa — a mais penetrante, só atenuada por chumbo. Num campo elétrico, α desvia para a placa negativa, β (muito leve) desvia bastante para a positiva e γ segue reto.',
      formula: 'α = ₂⁴He²⁺ · β⁻ = ₋₁⁰e · γ = fóton',
      formulaNote: 'Leis de Soddy: emitir α → Z−2 e A−4; emitir β → Z+1 e A constante; γ não muda o elemento.',
      hintCanvas: 'Enter/Espaço emite um novo pulso de radiação',
      icon: '☢️',
      def: 'Alfa é pesada e barrada por papel; beta é mais penetrante, barrada por alumínio; gama é a mais penetrante de todas.',
      fatos: [
        { l: 'Alfa',  v: 'núcleo de He²⁺' },
        { l: 'Beta',  v: 'elétron (β⁻)' },
        { l: 'Gama',  v: 'fóton, sem carga' },
        { l: 'Regra', v: 'Leis de Soddy' },
      ],
      canvasInteracao: 'Emita os três tipos de radiação contra barreiras de papel, alumínio e chumbo, ou entre placas eletrizadas.',
      recomendados: ['Alfa (α)', 'Beta (β⁻)', 'Gama (γ)'],
      overlay: 'Emissões α, β, γ', panels: ['panel-emis'], primary: 'emitir',
    },
    {
      id: 'meiavida', sigla: 't½', nome: 'Meia-vida', sub: 'Decaimento exponencial',
      hint: 'Escolha um isótopo real, avance o tempo em meias-vidas e acompanhe a amostra decair átomo a átomo sobre a curva exponencial.',
      info: 'Meia-vida é o tempo para METADE dos núcleos de uma amostra decair — uma propriedade fixa de cada isótopo, que não depende de temperatura, pressão ou massa. Após n meias-vidas resta N₀/2ⁿ. É impossível prever qual átomo decai, mas a estatística do conjunto é exata: essa é a base da datação por carbono-14.',
      formula: 'N = N₀ · (1/2)^(t/t½)',
      formulaNote: 'Após 1 t½ resta 50 %; após 2, 25 %; após 3, 12,5 %… A atividade cai na mesma proporção.',
      hintCanvas: 'Enter/Espaço sorteia quais átomos decaem',
      icon: '⏳',
      def: 'Meia-vida é o tempo pra metade dos núcleos decair — fixa pra cada isótopo, não depende de temperatura ou pressão.',
      fatos: [
        { l: 'Fórmula',    v: 'N=N₀·(1/2)^(t/t½)' },
        { l: 'Após 1 t½',  v: '50% resta' },
        { l: 'Após 3 t½',  v: '12,5% resta' },
        { l: 'Isótopos',   v: '6 disponíveis' },
      ],
      canvasInteracao: 'Escolha um isótopo real, avance o tempo em meias-vidas e veja a amostra decair átomo a átomo.',
      recomendados: ['Carbono-14', 'Cobalto-60', 'Urânio-238'],
      overlay: 'Meia-vida', panels: ['panel-meia'], primary: 'mv-sortear',
    },
    {
      id: 'cadeia', sigla: 'n → 3n', nome: 'Fissão em Cadeia', sub: 'U-235 e barras de controle',
      hint: 'Dispare um nêutron contra núcleos de urânio-235 e regule as barras de controle para manter a reação subcrítica, crítica ou supercrítica.',
      info: 'Ao capturar um nêutron, o U-235 se parte em dois núcleos menores e libera cerca de 3 novos nêutrons e muita energia. Se cada fissão provocar em média mais de uma nova fissão (k > 1), a reação cresce em cadeia — é a bomba. Num reator, as barras de controle absorvem nêutrons para segurar k ≈ 1: reação crítica e estável.',
      formula: '²³⁵U + n → fragmentos + 3 n + energia',
      formulaNote: 'k = nêutrons úteis por fissão: k < 1 subcrítica (apaga) · k = 1 crítica (reator) · k > 1 supercrítica (explosiva).',
      hintCanvas: 'Enter/Espaço dispara um nêutron',
      icon: '💥',
      def: 'Se cada fissão gerar mais de uma nova fissão (k>1) a reação cresce em cadeia; as barras de controle mantêm k≈1 no reator.',
      fatos: [
        { l: 'Reação',  v: '²³⁵U+n→fragmentos+3n' },
        { l: 'k < 1',   v: 'subcrítica (apaga)' },
        { l: 'k = 1',   v: 'crítica (reator)' },
        { l: 'k > 1',   v: 'supercrítica (explosiva)' },
      ],
      canvasInteracao: 'Dispare um nêutron contra núcleos de U-235 e regule as barras de controle para manter a reação sob controle.',
      overlay: 'Fissão em cadeia', panels: ['panel-cadeia'], primary: 'disparar',
    },
  ],

  CURIOSIDADES: [
    'Becquerel descobriu a radioatividade em 1896 por acaso, com sais de urânio velando chapas fotográficas na gaveta.',
    'Marie Curie ganhou dois prêmios Nobel (Física e Química); seus cadernos de anotações continuam radioativos até hoje.',
    'A datação por carbono-14 só funciona até uns 50 mil anos: depois disso resta ¹⁴C de menos para medir.',
    'O acidente de Goiânia (1987) começou com uma cápsula de césio-137 aberta num ferro-velho — o pó azul brilhante encantou e contaminou.',
    'Bananas são levemente radioativas por causa do potássio-40 — existe até a "dose equivalente de banana" para comparar exposições.',
    'Angra 1 e 2 usam a fissão do urânio para ferver água: no fim, uma usina nuclear é uma gigantesca máquina a vapor.',
    'A radiação gama esteriliza seringas, alimentos e até obras de arte sem aquecer nem molhar nada.',
  ],
};
