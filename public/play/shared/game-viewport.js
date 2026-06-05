(function () {
  var isCoarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  var hasTouch = 'ontouchstart' in window;
  var canvas = document.getElementById('canvas');
  var body = document.body;

  if (isCoarse || hasTouch) body.classList.add('mobile-touch');

  function addBodyClass(name) {
    if (name) body.classList.add(name);
  }
  function removeBodyClass(name) {
    if (name) body.classList.remove(name);
  }

  function fitCanvas() {
    if (!canvas) return;
    var cw = canvas.width;
    var ch = canvas.height;
    if (cw < 10 || ch < 10) return;

    var vv = window.visualViewport || window;
    var vw = vv.width;
    var vh = vv.height;
    if (vw < 100 || vh < 100) return;

    var scale = Math.min(vw / cw, vh / ch);
    var cssW = Math.round(cw * scale);
    var cssH = Math.round(ch * scale);

    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    canvas.style.position = 'absolute';
    canvas.style.left = Math.round((vw - cssW) / 2) + 'px';
    canvas.style.top = Math.round((vh - cssH) / 2) + 'px';
    canvas.style.margin = '0';

    // Expose canvas bounds as CSS custom properties for mobile controls
    var canvasLeft = Math.round((vw - cssW) / 2);
    var canvasTop = Math.round((vh - cssH) / 2);
    var canvasRight = canvasLeft + cssW;
    var canvasBottom = canvasTop + cssH;
    
    document.documentElement.style.setProperty('--game-canvas-left', canvasLeft + 'px');
    document.documentElement.style.setProperty('--game-canvas-top', canvasTop + 'px');
    document.documentElement.style.setProperty('--game-canvas-width', cssW + 'px');
    document.documentElement.style.setProperty('--game-canvas-height', cssH + 'px');
    document.documentElement.style.setProperty('--game-canvas-right', canvasRight + 'px');
    document.documentElement.style.setProperty('--game-canvas-bottom', canvasBottom + 'px');
    
    // Also expose as window property for tests
    window.__paCanvasLayout = {
      left: canvasLeft,
      top: canvasTop,
      width: cssW,
      height: cssH,
      right: canvasRight,
      bottom: canvasBottom
    };
  }

  var resizeTimer = null;
  function scheduleFit() {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(fitCanvas, 100);
  }

  var bootCheck = setInterval(function () {
    if (!canvas) {
      canvas = document.getElementById('canvas');
      if (!canvas) return;
    }
    var cw = canvas.width, ch = canvas.height;
    if (cw > 10 && ch > 10) {
      clearInterval(bootCheck);
      // Do NOT hide the loading overlay here — the input bridge
      // manages that via PirateArcadeLoading.ready().
      // Just fit the canvas and mark the body ready for CSS.
      addBodyClass('game-ready');
      removeBodyClass('game-loading');
      fitCanvas();
    }
  }, 300);

  // Observe canvas attribute changes (Pygbag sets width/height)
  if (window.MutationObserver && canvas) {
    var observer = new MutationObserver(function () {
      var cw = canvas.width, ch = canvas.height;
      if (cw > 10 && ch > 10) {
        if (!body.classList.contains('game-ready')) {
          addBodyClass('game-ready');
          removeBodyClass('game-loading');
        }
        scheduleFit();
      }
    });
    observer.observe(canvas, { attributes: true, attributeFilter: ['width', 'height'] });
  }

  // VisualViewport API (mobile Safari)
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', scheduleFit);
    window.visualViewport.addEventListener('scroll', scheduleFit);
  }
  window.addEventListener('resize', scheduleFit);
  window.addEventListener('orientationchange', function () {
    setTimeout(scheduleFit, 300);
  });

  setTimeout(fitCanvas, 500);
  setTimeout(fitCanvas, 1500);
  setTimeout(fitCanvas, 3000);
})();
