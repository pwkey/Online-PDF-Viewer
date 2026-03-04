// ============================================================
//  VIEWER — ASIViewer.state + init() orchestrator
//  This is the last script loaded — it wires everything together.
// ============================================================
(function () {
  'use strict';

  window.ASIViewer = window.ASIViewer || {};

  // ---- Shared State ----
  ASIViewer.state = {
    pdfDoc: null,
    pageCanvases: [],
    pageCount: 0,
    currentPage: 1,
    viewMode: 'flip',
    spreadMode: 'single',
    zoomLevel: 1.0,
    pageWidth: 0,
    pageHeight: 0
  };

  // ---- Init Orchestrator ----
  async function init() {
    var state = ASIViewer.state;
    var config = ASIViewer.config;
    var overlay = document.getElementById('loadingOverlay');
    var progress = document.getElementById('loadingProgress');
    var loadingText = overlay.querySelector('.loading-text');

    // Reset state if retrying
    overlay.classList.remove('hidden', 'error');
    if (loadingText) loadingText.textContent = 'Loading\u2026';
    progress.textContent = '';
    var oldBtn = overlay.querySelector('.loading-retry-btn');
    if (oldBtn) oldBtn.remove();

    // Load config file (viewer-config.json) before anything else
    await config.load();

    // Activate content protection
    ASIViewer.protection.init();

    // Admin mode — show gear button and init settings panel
    if (config.adminMode) {
      document.getElementById('btnSettings').style.display = '';
      ASIViewer.settings.initPanel();
    }

    try {
      progress.textContent = 'Fetching PDF\u2026';

      // Load PDF document from URL (not base64)
      state.pdfDoc = await ASIViewer.renderer.loadDocument(config.pdfUrl);
      state.pageCount = state.pdfDoc.numPages;

      // Load config embedded in PDF metadata (outranks viewer-config.json)
      await config.loadFromPdf(state.pdfDoc);

      // Refresh print button visibility (PDF metadata may have changed allowPrint)
      document.getElementById('btnPrint').style.display = config.allowPrint ? '' : 'none';

      // Refresh settings panel if admin (toggles may show stale values)
      if (config.adminMode) {
        ASIViewer.settings.initPanel();
      }

      progress.textContent = 'Rendering ' + state.pageCount + ' pages\u2026';

      // Pre-render all pages with watermark
      state.pageCanvases = [];
      for (var i = 1; i <= state.pageCount; i++) {
        progress.textContent = 'Rendering page ' + i + ' of ' + state.pageCount + '\u2026';
        var canvas = await ASIViewer.renderer.renderPage(state.pdfDoc, i);
        state.pageCanvases.push(canvas);
      }

      // Build thumbnail strip
      progress.textContent = 'Building thumbnails\u2026';
      await ASIViewer.thumbnails.buildThumbnails(state.pdfDoc, state.pageCount);

      // Start in flip mode
      ASIViewer.navigation.setViewMode('flip');

      // Show watermark badge
      document.getElementById('watermarkBadge').style.display = '';

      // Show print button if printing is allowed
      if (config.allowPrint) {
        document.getElementById('btnPrint').style.display = '';
      }

      // Hide loading overlay
      overlay.classList.add('hidden');
      setTimeout(function () { overlay.remove(); }, 500);

      ASIViewer.navigation.updatePageUI();

    } catch (err) {
      console.error('[ASI Viewer] Init error:', err);
      overlay.classList.add('error');
      if (loadingText) loadingText.textContent = 'Failed to load PDF';
      progress.textContent = err.message || 'Unknown error';

      var retryBtn = document.createElement('button');
      retryBtn.className = 'loading-retry-btn';
      retryBtn.textContent = 'Retry';
      retryBtn.addEventListener('click', function () { init(); });
      overlay.appendChild(retryBtn);
    }
  }

  // ---- Re-render all pages (used by settings panel for live preview) ----
  async function reRenderPages() {
    var state = ASIViewer.state;
    var config = ASIViewer.config;

    if (!state.pdfDoc) return;

    // Show a lightweight loading overlay
    var viewerArea = document.getElementById('viewerArea');
    var overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    overlay.innerHTML = '<div class="loading-spinner"></div><div class="loading-text">Updating pages\u2026</div>';
    viewerArea.appendChild(overlay);

    try {
      // Re-render all pages (watermark conditional is inside renderPage)
      var newCanvases = [];
      for (var i = 1; i <= state.pageCount; i++) {
        var canvas = await ASIViewer.renderer.renderPage(state.pdfDoc, i);
        newCanvases.push(canvas);
      }
      state.pageCanvases = newCanvases;

      // Rebuild current view mode
      if (state.viewMode === 'flip') {
        ASIViewer.flipbook.initFlipbook();
      } else {
        ASIViewer.navigation.initScrollMode();
      }
    } catch (err) {
      console.error('[ASI Viewer] Re-render error:', err);
    }

    // Remove overlay
    overlay.classList.add('hidden');
    setTimeout(function () {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }, 400);
  }

  // ---- Resize Handler ----
  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      var state = ASIViewer.state;
      if (state.viewMode === 'flip') {
        ASIViewer.flipbook.initFlipbook();
      } else {
        ASIViewer.navigation.initScrollMode();
      }
    }, 250);
  });

  // ---- Public API ----
  ASIViewer.viewer = {
    reRenderPages: reRenderPages
  };

  // ---- Go ----
  init();
})();
