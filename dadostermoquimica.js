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
     combustão CH₄ −890 kJ/mol; glicose −2808 kJ/mol). Conferido em
     jul/2026 no NIST Chemistry WebBook (webbook.nist.gov): ΔfH°(CH₄,g)
     = −74,87 kJ/mol (Chase, 1998); ΔcH°(CH₄,g) = −890,7 kJ/mol
     (Pittam & Pilcher, 1972) — o valor usado aqui está dentro da
     faixa aceita pela literatura.
   · Energias médias de ligação: Atkins, Príncípios de Química
     (H–H 436; O=O 495; O–H 463; C–H 413; C=O(CO₂) 799 kJ/mol...).
   · Calores específicos e latentes: CRC Handbook (água 4,186 J/g°C;
     L fusão 334 J/g; L vaporização 2260 J/g).
   · Entalpia de dissolução do NH₄NO₃: +25,7 kJ/mol (Chemistry
     LibreTexts, tabela de entalpias de solução — mesmo princípio das
     compressas frias instantâneas).
   · Massas molares (p/ conversão kJ/mol → kJ/g): massas atômicas
     padrão da IUPAC/CIAAW (C 12,011; H 1,008; O 15,999; N 14,007;
     Ca 40,078 g/mol).
   · Energias de ativação: valores ILUSTRATIVOS, escolhidos apenas
     para o traçado correto dos diagramas (Ea > máx(0, ΔH)).
   ================================================================ */
'use strict';

window.SITQ_DATA = {

  /* ── Constantes físicas ─────────────────────────────────────── */
  PHYS: {
    CAL_J: 4.184,          // 1 cal = 4,184 J (caloria termoquímica)
    T_MIN: -20, T_MAX: 120, // faixa dos termômetros do simulador (°C)
    MASSA_MIN: 10, MASSA_MAX: 1000, // faixa do slider de massa do Calorímetro (g)
  },

  /* ══════════════════════════════════════════════════════════════
     MODO 1 — CALORÍMETRO (Q = m·c·ΔT)
     Calores específicos médios a 25 °C (CRC Handbook).
     cor: usada no líquido/bloco desenhado no canvas.
     faixa: [Tmin,Tmax] °C onde a substância É REALMENTE a fase
       indicada em `estado`, a 1 atm — usada pela mecânica para
       impedir T fora da fase (sem isso, dava pra "esfriar" água
       líquida a −20 °C, o que é fisicamente errado neste modo, que
       não simula mudança de fase). Ausente = sem transição de fase
       relevante dentro de −20…120 °C (metais e vidro fundem bem
       acima disso; o óleo vegetal não tem um único ponto fixo).
     fato: comparação curta e verificável a partir dos PRÓPRIOS
       valores de c da tabela — mostrada no painel "Sobre o Modo".
     densidade (g/cm³, 20–25 °C): define o VOLUME real de cada
       massa (volume = massa/densidade), usada para desenhar a
       amostra em tamanho proporcional à quantidade escolhida —
       não só à massa, já que a mesma massa ocupa volumes bem
       diferentes conforme a substância. Metais/água/etanol: valores-
       -padrão de referência (CRC Handbook). Óleo vegetal: 0,91–0,93
       g/cm³ (típico à temperatura ambiente). Areia seca: densidade
       aparente (grãos + ar) ≈ 1,55 g/cm³, não a do quartzo maciço
       (2,65). Vidro sódico-cálcico (o vidro comum): ≈ 2,5 g/cm³.
     textura: estilo de desenho da amostra no béquer —
       'liquido' (superfície ondulada), 'gelo' (blocos translúcidos
       irregulares), 'metal' (bloco sólido com brilho metálico),
       'vidro' (bloco translúcido com reflexo) ou 'granular' (monte
       com grãos visíveis, como areia).
     pf/pe: ponto de fusão / ebulição a 1 atm (°C) — a MESMA
       substância química por trás de cada entrada (ex.: água e gelo
       são os dois H₂O). null onde não existe um ponto único bem
       definido (misturas como óleo/areia; vidro é amorfo e amolece
       numa faixa, não funde num ponto; diamante e grafite não fundem
       a 1 atm — sublimam/grafitizam em temperaturas extremas).
     Fontes dos 8 itens novos (conferidas em jul/2026): Engineering
     ToolBox "Specific Heat of Metals" e CRC Handbook (prata 0,235;
     ouro 0,129; mercúrio 0,140; zinco 0,388; níquel 0,444 J/g·°C;
     densidades e P.F./P.E. padrão de tabela periódica). Diamante
     (0,509) e grafite (0,710 J/g·°C) e sal de cozinha/NaCl (0,864):
     valores padrão de referência físico-química geral.
     ══════════════════════════════════════════════════════════════ */
  SUBSTANCIAS: [
    { id:'agua',     nome:'Água líquida',  c:4.186, estado:'liquido', cor:'#38bdf8', faixa:[0,100], densidade:1.00, textura:'liquido', pf:0, pe:100,
      fato:'Maior calor específico da lista. Para aquecer a mesma massa em 1 °C, a água precisa de mais que o dobro da energia do etanol e mais de 30 vezes a energia do chumbo — por isso mares e lagos suavizam a temperatura das regiões costeiras.' },
    { id:'gelo',     nome:'Gelo (H₂O s)',  c:2.090, estado:'solido',  cor:'#bae6fd', faixa:[-20,0], densidade:0.917, textura:'gelo', pf:0, pe:100,
      fato:'Quase metade do calor específico da água líquida (2,09 contra 4,186 J/g·°C): para a mesma quantidade de calor, a temperatura do gelo varia cerca do dobro — mesmo antes de qualquer fusão começar.' },
    { id:'etanol',   nome:'Etanol',        c:2.440, estado:'liquido', cor:'#c4b5fd', faixa:[-20,78], densidade:0.789, textura:'liquido', pf:-114.1, pe:78.3,
      fato:'Calor específico bem menor que o da água (2,44 contra 4,186 J/g·°C): a mesma energia recebida produz uma variação de temperatura bem maior no etanol. Acima de 78 °C (1 atm) ele já teria virado vapor.' },
    { id:'oleo',     nome:'Óleo vegetal',  c:1.960, estado:'liquido', cor:'#fbbf24', densidade:0.92, textura:'liquido', pf:null, pe:null,
      fato:'Menos da metade do calor específico da água: por isso o óleo de fritura dispara de temperatura muito mais rápido que a água, na mesma panela e na mesma chama.' },
    { id:'vidro',    nome:'Vidro',         c:0.840, estado:'solido',  cor:'#7dd3fc', densidade:2.50, textura:'vidro', pf:null, pe:null,
      fato:'Calor específico baixo: uma troca pequena de calor já muda bastante a temperatura da superfície — um dos fatores por trás do choque térmico que racha um copo ao receber líquido quente de repente.' },
    { id:'areia',    nome:'Areia seca',    c:0.800, estado:'solido',  cor:'#f59e0b', densidade:1.55, textura:'granular', pf:null, pe:null,
      fato:'Calor específico mais de 5 vezes menor que o da água: sob o mesmo sol, a areia da praia queima os pés enquanto o mar continua agradável.' },
    { id:'sal',      nome:'Sal de cozinha', c:0.864, estado:'solido', cor:'#f1f5f9', densidade:2.16, textura:'granular', pf:801, pe:1465,
      fato:'Calor específico parecido com o do vidro (0,864 contra 0,840 J/g·°C): o sal de cozinha (NaCl) é um sólido iônico, estruturalmente bem diferente do vidro, mas aquece de forma parecida.' },
    { id:'aluminio', nome:'Alumínio',      c:0.897, estado:'solido',  cor:'#cbd5e1', densidade:2.70, textura:'metal', pf:660.3, pe:2470,
      fato:'O maior calor específico entre os metais desta lista: para a mesma variação de temperatura, absorve quase o dobro de calor por grama que o ferro e mais que o dobro do cobre.' },
    { id:'grafite',  nome:'Grafite',       c:0.710, estado:'solido',  cor:'#374151', densidade:2.267, textura:'metal', pf:null, pe:null,
      fato:'Carbono puro, mas bem acima do calor específico do diamante (0,710 contra 0,509 J/g·°C) — mesmo elemento, estrutura em camadas que deslizam entre si, comportamento térmico diferente.' },
    { id:'diamante', nome:'Diamante',      c:0.509, estado:'solido',  cor:'#f8fafc', densidade:3.51, textura:'metal', pf:null, pe:null,
      fato:'Calor específico bem menor que o do grafite — a OUTRA forma do carbono puro (0,509 contra 0,710 J/g·°C): mesmo elemento químico, redes cristalinas diferentes.' },
    { id:'niquel',   nome:'Níquel',        c:0.444, estado:'solido',  cor:'#e4e4e7', densidade:8.90, textura:'metal', pf:1455, pe:2913,
      fato:'Calor específico quase igual ao do ferro (0,444 contra 0,449 J/g·°C) — os dois estão próximos na tabela periódica e compartilham várias propriedades.' },
    { id:'ferro',    nome:'Ferro',         c:0.449, estado:'solido',  cor:'#a8a29e', densidade:7.87, textura:'metal', pf:1538, pe:2862,
      fato:'Calor específico bem menor que o do alumínio: com menos energia por grama a temperatura já varia bastante — por isso peças de ferro esquentam rápido perto do fogo.' },
    { id:'zinco',    nome:'Zinco',         c:0.388, estado:'solido',  cor:'#9ca3af', densidade:7.14, textura:'metal', pf:419.5, pe:907,
      fato:'Calor específico quase idêntico ao do cobre (0,388 contra 0,385 J/g·°C) — os dois formam o latão quando misturados em liga.' },
    { id:'cobre',    nome:'Cobre',         c:0.385, estado:'solido',  cor:'#fb923c', densidade:8.96, textura:'metal', pf:1085, pe:2562,
      fato:'Um dos menores calores específicos da lista: pouca energia já provoca grande variação de temperatura — um dos motivos de panelas com fundo de cobre reagirem tão rápido a mudanças na chama.' },
    { id:'prata',    nome:'Prata',         c:0.235, estado:'solido',  cor:'#e5e7eb', densidade:10.49, textura:'metal', pf:961.8, pe:2162,
      fato:'Menos de 1/17 do calor específico da água (0,235 J/g·°C): muda de temperatura quase tão rápido quanto o mercúrio líquido, outro metal desta lista.' },
    { id:'mercurio', nome:'Mercúrio',      c:0.140, estado:'liquido', cor:'#d4d4d8', densidade:13.53, textura:'liquido', pf:-38.8, pe:356.7,
      fato:'O único metal líquido à temperatura ambiente: calor específico baixo (0,140 J/g·°C), próximo ao do chumbo e do ouro — muda de temperatura tão rápido quanto eles, só que já nasce derretido.' },
    { id:'chumbo',   nome:'Chumbo',        c:0.128, estado:'solido',  cor:'#94a3b8', densidade:11.34, textura:'metal', pf:327.5, pe:1749,
      fato:'O menor calor específico da lista — mais de 30 vezes menor que o da água. Pouquíssima energia já muda bastante sua temperatura, uma das razões de ligas de chumbo aquecerem e esfriarem tão depressa em processos de solda.' },
    { id:'ouro',     nome:'Ouro',          c:0.129, estado:'solido',  cor:'#eab308', densidade:19.32, textura:'metal', pf:1064, pe:2856,
      fato:'Quase empatado com o chumbo pelo menor calor específico da lista (0,129 contra 0,128 J/g·°C) — dois metais densos que mudam de temperatura com grande facilidade.' },
  ],

  /* ══════════════════════════════════════════════════════════════
     MODO 2 — CURVA DE AQUECIMENTO (calor sensível + latente)
     Q = m·c·ΔT nos trechos inclinados; Q = m·L nos patamares.
     cSolido/cLiquido/cVapor: calor específico em cada fase (J/g·°C).
     Lfusao/Lvap: calor latente de fusão/vaporização (J/g).
     Tfusao/Tebulicao: ponto de fusão/ebulição a 1 atm (°C) — nos
       PATAMARES (Tfusao e Tebulicao), duas fases COEXISTEM ao mesmo
       tempo (ex.: gelo + água derretendo juntos): a mecânica de
       desenho mistura as duas texturas na proporção certa em vez de
       trocar de uma vez, o que seria fisicamente errado.
     faixaPadrao: faixa sugerida dos sliders Ti/Tf para essa
       substância (cada uma tem P.F./P.E. bem diferentes).
     Fontes: água — CRC Handbook/NIST (já usado no modo Calorímetro).
       Etanol — ΔH_fus 5,02 kJ/mol e ΔH_vap 38,56 kJ/mol convertidos
       por massa molar (46,07 g/mol) → 109 e 837 J/g; calores
       específicos e P.F./P.E. (−114,1/78,3 °C) conferidos em jul/2026
       (ChemTeam "Thermochemistry Problems" e problemas-padrão de
       livro-texto — Brown, Chemistry: The Central Science).
     ══════════════════════════════════════════════════════════════ */
  CURVA_SUBSTANCIAS: [
    { id:'agua', nome:'Água', cor:'#38bdf8',
      cSolido:2.09, cLiquido:4.186, cVapor:2.00,
      Lfusao:334, Lvap:2260,
      Tfusao:0, Tebulicao:100,
      fases:{ gelo:'Sólido (gelo)', agua:'Líquido (água)', vapor:'Gasoso (vapor)' },
      faixaPadrao:[-30,130] },
    { id:'etanol', nome:'Etanol', cor:'#c4b5fd',
      cSolido:0.97, cLiquido:2.44, cVapor:1.80,
      Lfusao:109, Lvap:837,
      Tfusao:-114.1, Tebulicao:78.3,
      fases:{ gelo:'Sólido (etanol)', agua:'Líquido (etanol)', vapor:'Gasoso (etanol)' },
      faixaPadrao:[-130,95] },
  ],

  /* ══════════════════════════════════════════════════════════════
     MODO 3 — DIAGRAMAS DE ENERGIA (endo × exo)
     dH em kJ (por "mol de reação" tal como escrita).
     Ea ilustrativa (kJ), sempre > máx(0, dH) p/ o pico existir.
     massaMolar (g/mol): massa da espécie em destaque na equação —
       usada só para calcular kJ/g e comparar "densidade energética"
       entre reações (ex.: metano vs. etanol). Massas atômicas IUPAC.
     ══════════════════════════════════════════════════════════════ */
  CATALISADOR_FATOR: 0.45,   // Ea com catalisador ≈ 45% da original (ilustrativo)
  REACOES_PERFIL: [
    { id:'metano',  nome:'Combustão do metano',      eq:'CH₄(g) + 2 O₂(g) → CO₂(g) + 2 H₂O(l)',
      dH:-890.4, Ea:180, tipo:'exo', massaMolar:16.04,
      desc:'Queima do gás natural: libera 890 kJ por mol de CH₄ — base de fogões e termelétricas.' },
    { id:'etanol',  nome:'Combustão do etanol',      eq:'C₂H₅OH(l) + 3 O₂(g) → 2 CO₂(g) + 3 H₂O(l)',
      dH:-1367, Ea:210, tipo:'exo', massaMolar:46.07,
      desc:'Combustível renovável brasileiro: 1367 kJ liberados por mol de etanol queimado.' },
    { id:'neutra',  nome:'Neutralização forte',      eq:'H⁺(aq) + OH⁻(aq) → H₂O(l)',
      dH:-57.7, Ea:20, tipo:'exo', massaMolar:18.02,
      desc:'Ácido forte + base forte: ΔH praticamente constante (−57,7 kJ/mol de H₂O formada).' },
    { id:'caco3',   nome:'Decomposição do calcário', eq:'CaCO₃(s) → CaO(s) + CO₂(g)',
      dH:+178, Ea:240, tipo:'endo', massaMolar:100.09,
      desc:'Calcinação em fornos de cal: absorve 178 kJ/mol — por isso exige aquecimento contínuo.' },
    { id:'no',      nome:'Formação de NO (raios)',   eq:'N₂(g) + O₂(g) → 2 NO(g)',
      dH:+180.6, Ea:315, tipo:'endo', massaMolar:28.01,
      desc:'Só ocorre com a energia de relâmpagos ou motores: N≡N é muito difícil de romper.' },
    { id:'fotossintese', nome:'Fotossíntese',        eq:'6 CO₂(g) + 6 H₂O(l) → C₆H₁₂O₆(s) + 6 O₂(g)',
      dH:+2808, Ea:3100, tipo:'endo', massaMolar:180.16,
      desc:'A planta armazena 2808 kJ (por mol de glicose) vindos da luz solar — o inverso da respiração.' },
    { id:'nh4no3', nome:'Dissolução do nitrato de amônio', eq:'NH₄NO₃(s) → NH₄⁺(aq) + NO₃⁻(aq)',
      dH:+25.7, Ea:38, tipo:'endo', massaMolar:80.04,
      desc:'A química das compressas frias instantâneas: ao dissolver o sal, o sistema retira calor da água ao redor e a temperatura despenca — sem nenhuma reação de combustão envolvida.' },
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
    {
      id:'etanolform', titulo:'Formação do Etanol', resposta:-277.4,
      alvo:'2 C(grafite) + 3 H₂(g) + ½ O₂(g) → C₂H₅OH(l)',
      passos:[
        { rot:'I',   eq:'C(grafite) + O₂(g) → CO₂(g)',                      dH:-393.5 },
        { rot:'II',  eq:'H₂(g) + ½ O₂(g) → H₂O(l)',                         dH:-285.8 },
        { rot:'III', eq:'C₂H₅OH(l) + 3 O₂(g) → 2 CO₂(g) + 3 H₂O(l)',        dH:-1367  },
      ],
      solucao:[ {inv:false, mult:2}, {inv:false, mult:3}, {inv:true, mult:1} ],
      dica:'A combustão do etanol (III) é a mesma do modo Endo × Exo. 2 carbonos e 3 H₂ no alvo → dobre I e triplique II. O etanol precisa "sobrar" como produto → inverta III.',
      niveis:[
        { label:'2 C + 3 H₂ + 7/2 O₂', H:0       },
        { label:'C₂H₅OH + 3 O₂',       H:-277.4  },
        { label:'2 CO₂ + 3 H₂O',       H:-1644.4 },
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
    'A compressa fria instantânea não tem nada congelado: é só nitrato de amônio se dissolvendo na água, absorvendo calor.',
  ],
};
