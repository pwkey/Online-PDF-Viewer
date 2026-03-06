// ============================================================
//  VIEWER — ASIViewer.state + init() orchestrator
//  Progressive loading: render page 1 fast, show UI, then
//  lazily/concurrently fill in the rest.
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
    pageHeight: 0,
    pageTextContent: [],
    textExtractionDone: false   // true when all pages have had text extracted
  };

  // ---- Concurrent render pool ----

  /**
   * Renders a list of pages with bounded concurrency.
   * @param {number[]} pageNums - 1-based page numbers to render
   * @param {number} concurrency - max concurrent renders (default 3)
   * @param {function} [onPageDone] - called with (pageNum) after each page completes
   * @returns {Promise} resolves when all pages are rendered
   */
  function renderPool(pageNums, concurrency, onPageDone) {
    concurrency = concurrency || 3;
    var state = ASIViewer.state;
    var queue = pageNums.slice(); // copy
    var active = 0;

    return new Promise(function (resolve) {
      function next() {
        // All done?
        if (queue.length === 0 && active === 0) {
          resolve();
          return;
        }

        // Launch up to concurrency tasks
        while (queue.length > 0 && active < concurrency) {
          var pageNum = queue.shift();
          active++;
          ASIViewer.renderer.ensurePageRendered(state.pdfDoc, pageNum).then(
            (function (pn) {
              return function () {
                active--;
                if (onPageDone) onPageDone(pn);
                next();
              };
            })(pageNum)
          ).catch(function () {
            active--;
            next();
          });
        }
      }
      next();
    });
  }

  /**
   * Extracts text content for all pages sequentially in the background.
   * Yields control every 5 pages to keep the UI responsive.
   */
  async function extractAllTextInBackground() {
    var state = ASIViewer.state;

    for (var i = 0; i < state.pageCount; i++) {
      if (state.pageTextContent[i]) continue; // already extracted
      try {
        state.pageTextContent[i] = await ASIViewer.renderer.getPageTextContent(state.pdfDoc, i + 1);
      } catch (e) {
        state.pageTextContent[i] = null;
      }
      // Yield every 5 pages
      if ((i + 1) % 5 === 0) {
        await new Promise(function (r) { setTimeout(r, 0); });
      }
    }
    state.textExtractionDone = true;
  }

  // ---- Init Orchestrator (progressive) ----
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

      // Initialize sparse arrays
      state.pageCanvases = new Array(state.pageCount).fill(null);
      state.pageTextContent = new Array(state.pageCount).fill(null);
      state.textExtractionDone = false;

      progress.textContent = 'Rendering page 1\u2026';

      // Render page 1 + extract its text content
      state.pageCanvases[0] = await ASIViewer.renderer.renderPage(state.pdfDoc, 1);
      state.pageTextContent[0] = await ASIViewer.renderer.getPageTextContent(state.pdfDoc, 1);

      // Build thumbnail strip (page 1 real, rest placeholders)
      progress.textContent = 'Building thumbnails\u2026';
      await ASIViewer.thumbnails.buildThumbnails(state.pdfDoc, state.pageCount);

      // Start in flip mode — user sees content NOW
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

      // ---- Background work (non-blocking) ----

      // Background: extract text for all remaining pages
      extractAllTextInBackground();

      // Background: render remaining pages with pool (3 concurrent)
      if (state.pageCount > 1) {
        var remaining = [];
        for (var i = 2; i <= state.pageCount; i++) remaining.push(i);

        renderPool(remaining, 3, function (pageNum) {
          // Notify the active view mode so it can update the display
          ASIViewer.navigation.onPageRendered(pageNum);
        });
      }

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
      // Null out all canvases, then re-render with pool
      for (var i = 0; i < state.pageCount; i++) {
        state.pageCanvases[i] = null;
      }

      var allPages = [];
      for (var j = 1; j <= state.pageCount; j++) allPages.push(j);

      await renderPool(allPages, 3);

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

  // ---- Load PDF from local file input (progressive) ----
  async function loadFromFile(input) {
    var file = input.files && input.files[0];
    if (!file) return;

    var state = ASIViewer.state;

    // Create loading overlay (the original may have been removed)
    var viewerArea = document.getElementById('viewerArea');
    var overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    overlay.id = 'loadingOverlay';
    overlay.innerHTML = '<div class="loading-spinner"></div>' +
      '<div class="loading-text">Loading\u2026</div>' +
      '<div class="loading-progress" id="loadingProgress"></div>';
    viewerArea.appendChild(overlay);
    var progress = overlay.querySelector('.loading-progress');
    var loadingText = overlay.querySelector('.loading-text');

    // Close search panel if open
    if (ASIViewer.search) ASIViewer.search.close();

    try {
      progress.textContent = 'Reading file\u2026';

      var arrayBuffer = await file.arrayBuffer();
      var data = new Uint8Array(arrayBuffer);

      progress.textContent = 'Parsing PDF\u2026';
      state.pdfDoc = await pdfjsLib.getDocument({ data: data }).promise;
      state.pageCount = state.pdfDoc.numPages;
      state.currentPage = 1;
      state.zoomLevel = 1.0;

      // Initialize sparse arrays
      state.pageCanvases = new Array(state.pageCount).fill(null);
      state.pageTextContent = new Array(state.pageCount).fill(null);
      state.textExtractionDone = false;

      progress.textContent = 'Rendering page 1\u2026';

      // Render page 1 + extract its text content
      state.pageCanvases[0] = await ASIViewer.renderer.renderPage(state.pdfDoc, 1);
      state.pageTextContent[0] = await ASIViewer.renderer.getPageTextContent(state.pdfDoc, 1);

      // Build thumbnail strip (page 1 real, rest placeholders)
      progress.textContent = 'Building thumbnails\u2026';
      await ASIViewer.thumbnails.buildThumbnails(state.pdfDoc, state.pageCount);

      // Show viewer immediately
      ASIViewer.navigation.setViewMode(state.viewMode);
      document.getElementById('zoomLabel').textContent = '100%';

      overlay.classList.add('hidden');
      setTimeout(function () { if (overlay.parentNode) overlay.remove(); }, 500);

      ASIViewer.navigation.updatePageUI();

      // ---- Background work (non-blocking) ----

      // Background: extract text for all remaining pages
      extractAllTextInBackground();

      // Background: render remaining pages with pool (3 concurrent)
      if (state.pageCount > 1) {
        var remaining = [];
        for (var i = 2; i <= state.pageCount; i++) remaining.push(i);

        renderPool(remaining, 3, function (pageNum) {
          ASIViewer.navigation.onPageRendered(pageNum);
        });
      }

    } catch (err) {
      console.error('[ASI Viewer] File load error:', err);
      overlay.classList.add('error');
      if (loadingText) loadingText.textContent = 'Failed to load PDF';
      progress.textContent = err.message || 'Unknown error';

      var retryClose = document.createElement('button');
      retryClose.className = 'loading-retry-btn';
      retryClose.textContent = 'Close';
      retryClose.addEventListener('click', function () {
        overlay.classList.add('hidden');
        setTimeout(function () { if (overlay.parentNode) overlay.remove(); }, 400);
      });
      overlay.appendChild(retryClose);
    }

    // Reset file input so the same file can be re-selected
    input.value = '';
  }

  // ---- Public API ----
  ASIViewer.viewer = {
    reRenderPages: reRenderPages,
    loadFromFile: loadFromFile
  };

  // ---- Go ----
  init();
})();
