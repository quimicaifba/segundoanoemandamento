(function(){

  /* ============================================================
     CONTRATO DE ACESSIBILIDADE PARA SIMULADORES INTEGRADOS
     ------------------------------------------------------------
     Estrutura "flat": todos os arquivos (hub + simuladores) ficam
     na MESMA pasta, sem subpastas — por isso cada simulador tem um
     nome de arquivo próprio (indexsolucoes.html, indextermoquimica.html,
     indexph.html, indexeletrolise.html...) em vez de "pasta/index.html".

     Ao abrir um simulador, este hub navega a própria aba até o
     arquivo correspondente (sem nova aba e sem modal), acrescentando
     o estado atual de acessibilidade na URL:

          ?theme=dark|light
          &reading=on|off
          &colorblind=none|protanopia|deuteranopia|tritanopia|acromatopsia
          &contrast=true|false
          &fontscale=0.75–1.5
          &spacing=true|false
          &motion=true|false

     Cada simulador (SISOL, SIPC, SITQ, SICIN, SIEQ, SIPH,
     SIPIL, SIELE) deve ler esses
     parâmetros da própria URL no carregamento e aplicá-los aos
     seus próprios estilos/classes de tema, contraste, daltonismo,
     leitura simples, escala de fonte e espaçamento/redução de
     animações. Isso garante que qualquer novo simulador integrado
     já nasça compatível, sem precisar de nada além de ler a URL ao
     abrir — nenhum simulador deve ter controles de acessibilidade
     próprios: a escolha é sempre feita aqui, no menu.

     DALTONISMO — ATENÇÃO: nunca aplicar o filtro (`filter: url(#f-...)`)
     direto em <body>/<html>. Isso faz o elemento virar "containing
     block" de qualquer descendente com position:fixed/absolute, o que
     quebra peças arrastáveis, painéis flutuantes e tooltips (muito
     comuns em simuladores interativos) e "trava" a página. A técnica
     correta, replicada por este hub, é: um <div id="colorblindOverlay">
     fixo cobrindo a tela (ver #colorblindOverlay no CSS) com
     `backdrop-filter: url(#f-...)` e `pointer-events:none`. Cada
     simulador precisa ter seu próprio <svg><defs><filter id="f-..."></filter></defs></svg>
     (copiar do hub) e seu próprio #colorblindOverlay + a mesma função
     applyColorblindFilter() lendo o parâmetro ?colorblind= da URL.

     VLibras é a ÚNICA exceção a esse contrato: por ser um script
     pequeno e independente, cada página (este hub e cada simulador)
     carrega o seu próprio, direto no HTML, sem depender de parâmetro
     de URL nem de nenhum estado centralizado. Isso evita o problema
     de carregar/descarregar o widget dinamicamente (que dava erro)
     e mantém cada página autossuficiente.

     MEMÓRIA: as escolhas feitas aqui ficam salvas em localStorage
     (chave "central_a11y_prefs"). Assim, voltar pelo botão "← Central"
     de qualquer simulador não reseta nada — o menu reabre exatamente
     como o usuário deixou.
     ============================================================ */

  var state = {
    theme: 'dark',
    reading: 'off',
    colorblind: 'none',
    contrast: false,
    fontScale: 1,
    spacing: false,
    motion: false
  };

  /* ---------- memória: lembra as escolhas entre visitas ao menu ---------- */
  // Sem isso, clicar em "← Central" para voltar de um simulador reseta
  // tudo para o padrão de fábrica, perdendo a escolha do usuário.
  var STORAGE_KEY = 'central_a11y_prefs';

  function savePrefs(){
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch(e) {}
  }
  function loadPrefs(){
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch(e) { return null; }
  }
  var saved = loadPrefs();
  if (saved){
    state.theme = saved.theme === 'light' ? 'light' : 'dark';
    state.reading = saved.reading === 'on' ? 'on' : 'off';
    state.colorblind = ['protanopia','deuteranopia','tritanopia','acromatopsia'].indexOf(saved.colorblind) !== -1 ? saved.colorblind : 'none';
    state.contrast = !!saved.contrast;
    state.fontScale = (typeof saved.fontScale === 'number' && saved.fontScale >= 0.75 && saved.fontScale <= 1.5) ? saved.fontScale : 1;
    state.spacing = !!saved.spacing;
    state.motion = !!saved.motion;
  }

  var html = document.documentElement;
  var grid = document.getElementById('grid');

  /* ---------- aplica o estado restaurado (ou padrão) imediatamente ---------- */
  html.setAttribute('data-theme', state.theme);
  html.setAttribute('data-contrast', state.contrast ? 'on' : 'off');
  html.setAttribute('data-reading', state.reading);
  html.setAttribute('data-spacing', state.spacing ? 'on' : 'off');
  html.setAttribute('data-motion', state.motion ? 'on' : 'off');
  html.style.setProperty('--font-scale', state.fontScale);
  applyColorblindFilter();

  /* ---------- daltonismo: aplicado numa camada separada, não no body ---------- */
  // IMPORTANTE: nunca aplicar o filtro direto em document.body/html. A
  // propriedade `filter` faz o elemento virar "containing block" de
  // qualquer descendente com position:fixed (e absolute), então peças
  // arrastáveis, painéis flutuantes e tooltips dos simuladores saem do
  // lugar e passam a capturar clique/arraste no ponto errado — travando
  // a simulação. Por isso usamos um overlay fixo, sem conteúdo, com
  // backdrop-filter (que filtra visualmente o que está atrás dele sem
  // "envolver" ninguém no DOM) e pointer-events:none (para o clique
  // atravessar normalmente até o simulador). Qualquer simulador que
  // reproduzir esse contrato deve usar a mesma técnica.
  function applyColorblindFilter(){
    var overlay = document.getElementById('colorblindOverlay');
    if (!overlay) return;
    var value = (state.colorblind === 'none') ? 'none' : 'url(#f-' + state.colorblind + ')';
    overlay.style.backdropFilter = value;
    overlay.style.webkitBackdropFilter = value;
  }

  /* ---------- liga cada módulo de simulador já presente no HTML ---------- */
  // Cada módulo já é um <a href="..."> real: funciona mesmo sem JS
  // (abre a página do simulador na mesma aba, só sem os parâmetros de
  // acessibilidade). Com JS, reescrevemos a URL com o estado atual
  // antes de navegar, para o simulador já abrir no tema/contraste/
  // leitura/fonte/daltonismo escolhidos aqui no menu.
  grid.querySelectorAll('.tile[data-file]').forEach(function(tile){
    tile.addEventListener('click', function(e){
      e.preventDefault();
      openSimulator(tile.dataset.file);
    });
  });

  /* ---------- saudação por horário ---------- */
  function setGreeting(){
    var h = new Date().getHours();
    var txt;
    if (h >= 5 && h < 12) txt = 'Bom dia, qual assunto deseja aprender hoje?';
    else if (h >= 12 && h < 18) txt = 'Boa tarde, qual assunto deseja aprender hoje?';
    else txt = 'Boa noite, qual assunto deseja aprender hoje?';
    document.getElementById('greetingText').textContent = txt;
  }
  setGreeting();

  /* ---------- painel de acessibilidade ---------- */
  var a11yToggle = document.getElementById('a11yToggle');
  var a11yPanel = document.getElementById('a11yPanel');

  function closePanel(){
    a11yPanel.classList.remove('open');
    a11yToggle.setAttribute('aria-expanded', 'false');
  }
  a11yToggle.addEventListener('click', function(){
    var open = a11yPanel.classList.toggle('open');
    a11yToggle.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('click', function(e){
    if (!a11yPanel.contains(e.target) && e.target !== a11yToggle && !a11yToggle.contains(e.target)){
      closePanel();
    }
  });
  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape') closePanel();
  });

  /* ---------- tema claro/escuro ---------- */
  var themeToggle = document.getElementById('themeToggle');
  themeToggle.checked = (state.theme === 'dark');
  themeToggle.addEventListener('change', function(){
    state.theme = themeToggle.checked ? 'dark' : 'light';
    html.setAttribute('data-theme', state.theme);
    savePrefs();
  });

  /* ---------- alto contraste ---------- */
  var contrastToggle = document.getElementById('contrastToggle');
  contrastToggle.checked = state.contrast;
  contrastToggle.addEventListener('change', function(){
    state.contrast = contrastToggle.checked;
    html.setAttribute('data-contrast', state.contrast ? 'on' : 'off');
    savePrefs();
  });

  /* ---------- tamanho da fonte ---------- */
  var fontDec = document.getElementById('fontDec');
  var fontInc = document.getElementById('fontInc');
  var fontPct = document.getElementById('fontPct');
  function setFontScale(value){
    state.fontScale = Math.min(1.5, Math.max(0.75, Math.round(value * 10) / 10));
    html.style.setProperty('--font-scale', state.fontScale);
    fontPct.textContent = Math.round(state.fontScale * 100) + '%';
    savePrefs();
  }
  fontPct.textContent = Math.round(state.fontScale * 100) + '%';
  fontDec.addEventListener('click', function(){ setFontScale(state.fontScale - 0.1); });
  fontInc.addEventListener('click', function(){ setFontScale(state.fontScale + 0.1); });

  /* ---------- leitura simples ---------- */
  var readingToggle = document.getElementById('readingToggle');
  readingToggle.checked = (state.reading === 'on');
  readingToggle.addEventListener('change', function(){
    state.reading = readingToggle.checked ? 'on' : 'off';
    html.setAttribute('data-reading', state.reading);
    savePrefs();
  });

  /* ---------- espaçamento de letras ---------- */
  var spacingToggle = document.getElementById('spacingToggle');
  spacingToggle.checked = state.spacing;
  spacingToggle.addEventListener('change', function(){
    state.spacing = spacingToggle.checked;
    html.setAttribute('data-spacing', state.spacing ? 'on' : 'off');
    savePrefs();
  });

  /* ---------- reduzir animações ---------- */
  var motionToggle = document.getElementById('motionToggle');
  motionToggle.checked = state.motion;
  motionToggle.addEventListener('change', function(){
    state.motion = motionToggle.checked;
    html.setAttribute('data-motion', state.motion ? 'on' : 'off');
    savePrefs();
  });

  /* ---------- daltonismo ---------- */
  var colorblindSelect = document.getElementById('colorblindSelect');
  colorblindSelect.value = state.colorblind;
  colorblindSelect.addEventListener('change', function(){
    state.colorblind = colorblindSelect.value;
    applyColorblindFilter();
    savePrefs();
  });

  /* ---------- VLibras ---------- */
  // Sempre ativo — sem botão. Carrega o script oficial assim que a
  // página abre; o próprio widget (ver markup #vlibrasWidget) já fica
  // visível por padrão (não há classe condicional para escondê-lo).
  function loadVLibrasScript(){
    var s = document.createElement('script');
    s.src = 'https://vlibras.gov.br/app/vlibras-plugin.js';
    s.onload = function(){
      try {
        new window.VLibras.Widget('https://vlibras.gov.br/app');
      } catch(err){ /* segue mesmo se o widget não inicializar */ }
    };
    s.onerror = function(){
      var note = document.createElement('div');
      note.style.cssText = 'position:fixed;bottom:16px;right:16px;max-width:260px;font-size:12px;background:var(--surface);border:1px solid var(--border);color:var(--muted);padding:10px 12px;border-radius:10px;z-index:400;';
      note.textContent = 'O serviço do VLibras não pôde ser carregado agora. Verifique a conexão ou tente novamente mais tarde.';
      document.body.appendChild(note);
      setTimeout(function(){ note.remove(); }, 6000);
    };
    document.body.appendChild(s);
  }
  loadVLibrasScript();

  /* ---------- navegação para o simulador, na mesma aba ---------- */
  // Estrutura "flat": cada simulador é um arquivo .html na MESMA pasta
  // do hub (ex.: indexsolucoes.html, indexpilhas.html), sem subpastas. Por
  // isso aqui só acrescentamos a query string de acessibilidade ao
  // nome do arquivo, em vez de montar caminhos como "./pasta/index.html".
  function buildUrl(file){
    if (!file) return '#';
    var fileUrl = encodeURI(file);
    return fileUrl + '?' +
      'theme=' + encodeURIComponent(state.theme) +
      '&reading=' + encodeURIComponent(state.reading) +
      '&colorblind=' + encodeURIComponent(state.colorblind) +
      '&contrast=' + encodeURIComponent(state.contrast) +
      '&fontscale=' + encodeURIComponent(state.fontScale) +
      '&spacing=' + encodeURIComponent(state.spacing) +
      '&motion=' + encodeURIComponent(state.motion);
  }

  function openSimulator(file){
    if (!file) return;
    window.location.href = buildUrl(file);
  }

})();
