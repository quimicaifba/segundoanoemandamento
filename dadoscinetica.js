/* ================================================================
   SICIN — dadoscinetica.js | dados fixos de Cinética Química
   ================================================================
   FONTES: energias de ativação da decomposição do peróxido de
   hidrogênio — Atkins & de Paula, Físico-Química; Chang, Química
   Geral (valores didáticos típicos). ΔH da reação: −196 kJ para
   2 H₂O₂ → 2 H₂O + O₂ (−98 kJ por mol de H₂O₂).
   Regra de van 't Hoff (Q₁₀ ≈ 2) usada como modelo didático.
   ================================================================ */
'use strict';

window.SIM_DATA = {
  ACRO: 'SICIN',
  TITLE: 'Simulador Interativo de Cinética Química',

  /* ── Caminhos de reação da decomposição do H₂O₂ ── */
  CAMINHOS: [
    { id: 'sem',      nome: 'Sem catalisador',   ea: 75, dot: '#94a3b8', nota: 'reação lenta à temperatura ambiente' },
    { id: 'iodeto',   nome: 'Iodeto (I⁻)',       ea: 57, dot: '#a78bfa', nota: 'catálise homogênea' },
    { id: 'catalase', nome: 'Catalase (enzima)', ea: 23, dot: '#4ade80', nota: 'catálise enzimática — a mais eficiente' },
  ],
  DH: -98,          // kJ por mol de H₂O₂
  EQ_TXT: '2 H₂O₂(aq) → 2 H₂O(l) + O₂(g)',
  R_KJ: 0.008314,   // kJ·mol⁻¹·K⁻¹

  MODES: [
    {
      id: 'colisoes', sigla: 'A + B', nome: 'Teoria das Colisões', sub: 'Choques efetivos',
      hint: 'Ajuste temperatura, número de partículas e catalisador e observe quais colisões são efetivas e formam produto.',
      info: 'Para reagir, as partículas precisam colidir com energia suficiente e orientação favorável — é a colisão efetiva. Aumentar a temperatura, a concentração ou usar catalisador aumenta a frequência ou a eficácia dos choques.',
      formula: 'v ∝ (frequência de colisões) × (fração efetiva)',
      formulaNote: 'Colisões brancas são ineficazes; os flashes verdes marcam choques efetivos que geram produto C.',
      hintCanvas: 'Enter/Espaço reinicia a mistura',
      icon: '🎯',
      def: 'Pra reagir, as partículas precisam colidir com energia suficiente e orientação favorável — é a colisão efetiva.',
      fatos: [
        { l: 'Fórmula',     v: 'v∝freq.colisões×fração efetiva' },
        { l: 'Aumenta v',   v: 'T↑, concentração↑, catalisador' },
        { l: 'Colisão branca', v: 'ineficaz' },
        { l: 'Flash verde', v: 'colisão efetiva' },
      ],
      canvasInteracao: 'Ajuste temperatura, número de partículas e catalisador e veja quais colisões formam produto.',
      overlay: 'Colisões', panels: ['panel-colisoes'], primary: 'col-reset',
    },
    {
      id: 'curva', sigla: '[A] × t', nome: 'Velocidade da Reação', sub: 'Média e instantânea',
      hint: 'Acompanhe o consumo do reagente ao longo do tempo e calcule a velocidade média entre dois instantes.',
      info: 'A velocidade média é a variação da concentração dividida pelo intervalo de tempo. Na curva, ela é a inclinação da reta secante entre dois pontos; a instantânea é a tangente. Aumentar T ou usar catalisador torna a queda mais rápida.',
      formula: 'v_m = −Δ[A]/Δt   ·   [A] = [A]₀·e^(−k·t)',
      formulaNote: 'Modelo de 1ª ordem. t½ = ln2/k é o tempo de meia-vida — independe da concentração inicial.',
      hintCanvas: 'Enter/Espaço reinicia a corrida',
      icon: '📉',
      def: 'A velocidade média é a variação da concentração dividida pelo tempo — a inclinação da reta secante na curva.',
      fatos: [
        { l: 'Fórmula', v: 'v_m = −Δ[A]/Δt' },
        { l: 'Modelo',  v: '[A]=[A]₀·e^(−kt)' },
        { l: 't½',      v: 'ln2 / k' },
        { l: 'Ordem',   v: '1ª ordem' },
      ],
      canvasInteracao: 'Acompanhe o consumo do reagente ao longo do tempo e calcule a velocidade média entre dois instantes.',
      overlay: 'Curva cinética', panels: ['panel-curva'], primary: 'cur-reset',
    },
    {
      id: 'energia', sigla: 'Ea', nome: 'Energia de Ativação', sub: 'Diagrama e catálise',
      hint: 'Compare os caminhos com e sem catalisador no diagrama de energia e veja a fração de moléculas capaz de reagir.',
      info: 'O catalisador oferece um caminho alternativo com energia de ativação menor — ele NÃO muda o ΔH nem o rendimento, só a velocidade. A distribuição de Maxwell-Boltzmann mostra quantas moléculas têm energia acima de Ea.',
      formula: 'k = A·e^(−Ea/RT)',
      formulaNote: 'A área sombreada da curva de Maxwell-Boltzmann à direita de Ea é a fração de moléculas com energia suficiente.',
      hintCanvas: 'Enter/Espaço anuncia a comparação dos caminhos',
      icon: '⛰️',
      def: 'O catalisador oferece um caminho com Ea menor — não muda o ΔH nem o rendimento, só a velocidade.',
      fatos: [
        { l: 'Fórmula',          v: 'k = A·e^(−Ea/RT)' },
        { l: 'Sem catalisador',  v: 'Ea = 75 kJ/mol' },
        { l: 'Catalase (enzima)', v: 'Ea = 23 kJ/mol' },
        { l: 'Modelo',           v: 'Maxwell-Boltzmann' },
      ],
      canvasInteracao: 'Compare os caminhos com e sem catalisador no diagrama de energia e veja a fração de moléculas capazes de reagir.',
      recomendados: ['Sem catalisador', 'Iodeto (I⁻)', 'Catalase (enzima)'],
      overlay: 'Energia de ativação', panels: ['panel-energia'], primary: 'ene-status',
    },
  ],

  CURIOSIDADES: [
    'A regra de van \'t Hoff diz que cada 10 °C a mais costuma dobrar a velocidade de uma reação — por isso a geladeira conserva alimentos.',
    'A catalase do fígado decompõe peróxido de hidrogênio milhões de vezes mais rápido que a reação sem catalisador: é a espuma da água oxigenada no machucado.',
    'O catalisador não é consumido: ele participa do mecanismo e é regenerado no fim.',
    'Palha de aço enferruja mais rápido que um prego porque a superfície de contato é muito maior.',
    'Catalisadores automotivos de platina e ródio convertem CO e NOₓ em CO₂ e N₂ antes da saída do escapamento.',
    'A explosão de pó de farinha em silos acontece porque partículas finíssimas reagem com o oxigênio quase instantaneamente.',
    'Enzimas são catalisadores biológicos tão seletivos que costumam agir sobre um único substrato.',
  ],
};
