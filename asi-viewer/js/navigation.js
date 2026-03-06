// ============================================================
//  NAVIGATION — ASIViewer.navigation
//  Page nav, zoom, view/spread mode, scroll mode, keyboard,
//  fullscreen
// ============================================================
(function () {
  'use strict';

  window.ASIViewer = window.ASIViewer || {};

  var scrollObserver = null; // IntersectionObserver for lazy scroll rendering

  // ---- Page Navigation ----

  function goToPage(num) {
    var state = ASIViewer.state;
    num = Math.max(1, Math.min(state.pageCount, num));
    state.currentPage = num;

    if (state.viewMode === 'flip') {
      // Ensure page is rendered before flipping
      if (!state.pageCanvases[num - 1]) {
        ASIViewer.renderer.ensurePageRendered(state.pdfDoc, num).then(function () {
          ASIViewer.flipbook.updateFlipbookPage(num);
          var fb = ASIViewer.flipbook.getFlipBook();
          if (fb) fb.flip(num - 1);
        });
      } else {
        var fb = ASIViewer.flipbook.getFlipBook();
        if (fb) fb.flip(num - 1);
      }
    } else if (state.viewMode === 'scroll') {
      var el = document.querySelector('.scroll-page[data-page="' + num + '"]');
      if (el) {
        // Ensure page is rendered, then scroll
        if (!state.pageCanvases[num - 1]) {
          ASIViewer.renderer.ensurePageRendered(state.pdfDoc, num).then(function () {
            updateScrollPage(num);
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          });
        } else {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }

    updatePageUI();
  }

  function goToPageInput() {
    var val = parseInt(document.getElementById('pageInput').value, 10);
    if (!isNaN(val)) goToPage(val);
  }

  function prevPage() {
    var state = ASIViewer.state;
    if (state.viewMode === 'flip') {
      var fb = ASIViewer.flipbook.getFlipBook();
      if (fb) fb.flipPrev();
    } else {
      goToPage(state.currentPage - 1);
    }
  }

  function nextPage() {
    var state = ASIViewer.state;
    if (state.viewMode === 'flip') {
      var fb = ASIViewer.flipbook.getFlipBook();
      if (fb) fb.flipNext();
    } else {
      goToPage(state.currentPage + 1);
    }
  }

  function updatePageUI() {
    var state = ASIViewer.state;
    document.getElementById('pageInput').value = state.currentPage;
    document.getElementById('pageTotal').textContent = state.pageCount;

    // Update active thumbnail
    document.querySelectorAll('.thumb-item').forEach(function (el) {
      el.classList.toggle('active', parseInt(el.dataset.page) === state.currentPage);
    });

    // Scroll active thumb into view
    var activeTh = document.querySelector('.thumb-item.active');
    if (activeTh) activeTh.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });

    // Update status
    document.getElementById('statusText').textContent =
      'Page ' + state.currentPage + ' of ' + state.pageCount + '  \u2014  ' + ASIViewer.config.credentials.name;
  }

  // ---- Scroll Mode ----

  /**
   * Draws a placeholder canvas for a not-yet-rendered page.
   */
  function drawScrollPlaceholder(canvas, pageNum, width, height) {
    canvas.width = width;
    canvas.height = height;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#e8ecf0';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#a0aeb8';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Page ' + pageNum, width / 2, height / 2);
  }

  function initScrollMode() {
    var state = ASIViewer.state;
    var container = document.getElementById('scrollContainer');
    container.innerHTML = '';

    // Clean up old observer
    if (scrollObserver) {
      scrollObserver.disconnect();
      scrollObserver = null;
    }

    var viewerArea = document.getElementById('viewerArea');
    var availW = viewerArea.clientWidth - 60;

    // Use first available canvas for aspect ratio, or default
    var refCanvas = null;
    for (var r = 0; r < state.pageCount; r++) {
      if (state.pageCanvases[r]) { refCanvas = state.pageCanvases[r]; break; }
    }
    var defaultSrcW = refCanvas ? refCanvas.width : 850;
    var defaultSrcH = refCanvas ? refCanvas.height : 1100;

    for (var i = 0; i < state.pageCount; i++) {
      var wrapper = document.createElement('div');
      wrapper.className = 'scroll-page';
      wrapper.setAttribute('data-page', i + 1);

      var srcW = state.pageCanvases[i] ? state.pageCanvases[i].width : defaultSrcW;
      var srcH = state.pageCanvases[i] ? state.pageCanvases[i].height : defaultSrcH;
      var aspect = srcW / srcH;

      var dispW = Math.min(availW, 900) * state.zoomLevel;
      var dispH = dispW / aspect;

      var displayCanvas = document.createElement('canvas');

      if (state.pageCanvases[i]) {
        displayCanvas.width = dispW;
        displayCanvas.height = dispH;
        var dCtx = displayCanvas.getContext('2d');
        dCtx.drawImage(state.pageCanvases[i], 0, 0, dispW, dispH);
      } else {
        drawScrollPlaceholder(displayCanvas, i + 1, dispW, dispH);
      }

      wrapper.appendChild(displayCanvas);

      // Accessibility text layer
      var textLayerDiv = document.createElement('div');
      textLayerDiv.className = 'textLayer';
      wrapper.appendChild(textLayerDiv);
      if (state.pageTextContent[i]) {
        ASIViewer.renderer.renderTextLayerForPage(textLayerDiv, state.pageTextContent[i], state.pdfDoc, i + 1, dispW, dispH);
      }

      // Annotation layer (clickable links)
      var annotDiv = document.createElement('div');
      annotDiv.className = 'annotationLayer';
      wrapper.appendChild(annotDiv);
      ASIViewer.renderer.renderAnnotationLayer(annotDiv, state.pdfDoc, i + 1, dispW, dispH);

      container.appendChild(wrapper);
    }

    // Set up IntersectionObserver for lazy rendering of unrendered pages
    scrollObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var pageNum = parseInt(entry.target.getAttribute('data-page'));
        if (!pageNum || state.pageCanvases[pageNum - 1]) return;

        ASIViewer.renderer.ensurePageRendered(state.pdfDoc, pageNum).then(function () {
          updateScrollPage(pageNum);
        });
      });
    }, {
      root: container,
      rootMargin: '200% 0px'
    });

    // Observe only unrendered pages
    var scrollPages = container.querySelectorAll('.scroll-page');
    scrollPages.forEach(function (el) {
      var pn = parseInt(el.getAttribute('data-page'));
      if (pn && !state.pageCanvases[pn - 1]) {
        scrollObserver.observe(el);
      }
    });
  }

  /**
   * Redraws a single scroll-mode page after its canvas becomes available.
   * @param {number} pageNum - 1-based page number
   */
  function updateScrollPage(pageNum) {
    var state = ASIViewer.state;
    var canvas = state.pageCanvases[pageNum - 1];
    if (!canvas) return;

    var wrapper = document.querySelector('.scroll-page[data-page="' + pageNum + '"]');
    if (!wrapper) return;

    var displayCanvas = wrapper.querySelector('canvas');
    if (!displayCanvas) return;

    // Redraw with the real content
    var dCtx = displayCanvas.getContext('2d');
    dCtx.clearRect(0, 0, displayCanvas.width, displayCanvas.height);
    dCtx.drawImage(canvas, 0, 0, displayCanvas.width, displayCanvas.height);

    // Add text layer if available and not already populated
    var textLayer = wrapper.querySelector('.textLayer');
    if (textLayer && state.pageTextContent[pageNum - 1] && textLayer.childNodes.length === 0) {
      ASIViewer.renderer.renderTextLayerForPage(
        textLayer, state.pageTextContent[pageNum - 1], state.pdfDoc, pageNum,
        displayCanvas.width, displayCanvas.height
      );
    }

    // Stop observing this page
    if (scrollObserver) scrollObserver.unobserve(wrapper);
  }

  /**
   * Called by the background render pool when a page finishes rendering.
   * Updates the appropriate view mode's display.
   * @param {number} pageNum - 1-based page number
   */
  function onPageRendered(pageNum) {
    var state = ASIViewer.state;
    if (state.viewMode === 'scroll') {
      updateScrollPage(pageNum);
    } else if (state.viewMode === 'flip') {
      ASIViewer.flipbook.updateFlipbookPage(pageNum);
    }
  }

  // ---- View Mode ----

  function setViewMode(mode) {
    var state = ASIViewer.state;
    state.viewMode = mode;

    document.getElementById('btnFlip').classList.toggle('active', mode === 'flip');
    document.getElementById('btnScroll').classList.toggle('active', mode === 'scroll');

    // Show/hide spread toggle (only relevant in flip mode)
    document.getElementById('spreadGroup').style.display = mode === 'flip' ? '' : 'none';

    var scrollContainer = document.getElementById('scrollContainer');
    var hints = document.querySelectorAll('.flip-hint');

    if (mode === 'flip') {
      scrollContainer.style.display = 'none';
      hints.forEach(function (h) { h.style.display = ''; });
      ASIViewer.flipbook.initFlipbook();
      document.getElementById('flipbook-container').style.display = '';
    } else {
      ASIViewer.flipbook.destroyFlipbook();
      document.getElementById('flipbook-container').style.display = 'none';
      scrollContainer.style.display = 'flex';
      hints.forEach(function (h) { h.style.display = 'none'; });
      initScrollMode();
    }
  }

  // ---- Spread Mode ----

  function setSpreadMode(mode) {
    var state = ASIViewer.state;
    state.spreadMode = mode;
    document.getElementById('btnSingle').classList.toggle('active', mode === 'single');
    document.getElementById('btnDual').classList.toggle('active', mode === 'dual');

    if (state.viewMode === 'flip') {
      ASIViewer.flipbook.initFlipbook();
    }
  }

  // ---- Zoom ----

  function zoomIn() {
    var state = ASIViewer.state;
    state.zoomLevel = Math.min(2.0, state.zoomLevel + 0.15);
    applyZoom();
  }

  function zoomOut() {
    var state = ASIViewer.state;
    state.zoomLevel = Math.max(0.5, state.zoomLevel - 0.15);
    applyZoom();
  }

  function zoomFit() {
    ASIViewer.state.zoomLevel = 1.0;
    applyZoom();
  }

  function applyZoom() {
    var state = ASIViewer.state;
    document.getElementById('zoomLabel').textContent = Math.round(state.zoomLevel * 100) + '%';
    if (state.viewMode === 'flip') {
      ASIViewer.flipbook.initFlipbook();
    } else {
      initScrollMode();
    }
  }

  // ---- Fullscreen ----

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(function () {});
    } else {
      document.exitFullscreen();
    }
  }

  // ---- Print ----

  async function printDocument() {
    var state = ASIViewer.state;
    var config = ASIViewer.config;

    if (!config.allowPrint) return;
    if (!state.pageCount) return;

    var container = document.getElementById('printContainer');
    container.innerHTML = '';

    // Show preparing status
    var statusText = document.getElementById('statusText');
    var prevStatus = statusText.textContent;
    statusText.textContent = 'Preparing print\u2026';

    // Ensure all pages are rendered before printing
    var unrendered = [];
    for (var u = 0; u < state.pageCount; u++) {
      if (!state.pageCanvases[u]) unrendered.push(u + 1);
    }
    if (unrendered.length > 0) {
      statusText.textContent = 'Rendering ' + unrendered.length + ' remaining pages for print\u2026';
      for (var r = 0; r < unrendered.length; r++) {
        await ASIViewer.renderer.ensurePageRendered(state.pdfDoc, unrendered[r]);
      }
      statusText.textContent = 'Preparing print\u2026';
    }

    // Clone each rendered page canvas and apply print watermark
    for (var i = 0; i < state.pageCount; i++) {
      var src = state.pageCanvases[i];
      if (!src) continue;
      var sheet = document.createElement('div');
      sheet.className = 'print-sheet';

      var pc = document.createElement('canvas');
      pc.width = src.width;
      pc.height = src.height;
      pc.getContext('2d').drawImage(src, 0, 0);
      if (config.showPrintWatermark) {
        ASIViewer.watermark.applyPrintWatermark(pc, config.credentials);
      }

      sheet.appendChild(pc);
      container.appendChild(sheet);
    }

    // Trigger browser print (user can choose pages-per-sheet there)
    window.print();

    // Clean up after print dialog closes
    var cleanup = function () {
      container.innerHTML = '';
      statusText.textContent = prevStatus;
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
  }

  // ---- Keyboard Shortcuts ----

  document.addEventListener('keydown', function (e) {
    switch (e.key) {
      case 'ArrowLeft':
      case 'PageUp':
        e.preventDefault();
        prevPage();
        break;
      case 'ArrowRight':
      case 'PageDown':
      case ' ':
        e.preventDefault();
        nextPage();
        break;
      case 'Home':
        e.preventDefault();
        goToPage(1);
        break;
      case 'End':
        e.preventDefault();
        goToPage(ASIViewer.state.pageCount);
        break;
      case 'f':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          ASIViewer.search.open();
        }
        break;
      case 'Escape':
        if (ASIViewer.search && document.getElementById('searchPanel').classList.contains('open')) {
          ASIViewer.search.close();
        }
        break;
    }
  });

  ASIViewer.navigation = {
    goToPage: goToPage,
    goToPageInput: goToPageInput,
    prevPage: prevPage,
    nextPage: nextPage,
    updatePageUI: updatePageUI,
    initScrollMode: initScrollMode,
    updateScrollPage: updateScrollPage,
    onPageRendered: onPageRendered,
    setViewMode: setViewMode,
    setSpreadMode: setSpreadMode,
    zoomIn: zoomIn,
    zoomOut: zoomOut,
    zoomFit: zoomFit,
    toggleFullscreen: toggleFullscreen,
    printDocument: printDocument
  };
})();
