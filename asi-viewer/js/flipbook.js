// ============================================================
//  FLIPBOOK — ASIViewer.flipbook
//  StPageFlip destroy/recreate cycle, initFlipbook()
//  Sparse-tolerant: handles null canvases with placeholders
// ============================================================
(function () {
  'use strict';

  window.ASIViewer = window.ASIViewer || {};

  var flipBook = null;

  function destroyFlipbook() {
    if (flipBook) {
      try { flipBook.destroy(); } catch (e) { /* already destroyed */ }
      flipBook = null;
    }
    // StPageFlip's destroy() removes the container from the DOM entirely,
    // so we always need to ensure a fresh container exists.
    var old = document.getElementById('flipbook-container');
    var parent = document.getElementById('viewerArea');
    if (old) {
      old.remove();
    }
    var fresh = document.createElement('div');
    fresh.id = 'flipbook-container';
    // Insert before the scroll container
    var scrollEl = document.getElementById('scrollContainer');
    parent.insertBefore(fresh, scrollEl);
  }

  /**
   * Draws a light gray placeholder with "Page N" text onto a canvas.
   */
  function drawPlaceholder(canvas, pageNum, width, height) {
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

  function initFlipbook() {
    destroyFlipbook();

    var state = ASIViewer.state;
    var container = document.getElementById('flipbook-container');
    if (state.pageCount === 0) return;

    // Calculate dimensions to fit the viewer area
    var viewerArea = document.getElementById('viewerArea');
    var availW = viewerArea.clientWidth - 60;
    var availH = viewerArea.clientHeight - 40;

    // Use the first available page's aspect ratio, or default 8.5x11
    var firstCanvas = null;
    for (var f = 0; f < state.pageCount; f++) {
      if (state.pageCanvases[f]) { firstCanvas = state.pageCanvases[f]; break; }
    }
    var srcW = firstCanvas ? firstCanvas.width : 850;
    var srcH = firstCanvas ? firstCanvas.height : 1100;
    var aspect = srcW / srcH;

    var pgW, pgH;

    if (state.spreadMode === 'dual') {
      // Dual mode: two pages side by side, each gets half the width
      pgW = Math.floor(availW / 2);
      pgH = Math.floor(pgW / aspect);
      if (pgH > availH) {
        pgH = availH;
        pgW = Math.floor(pgH * aspect);
      }
    } else {
      // Single mode: one page fills the available space
      pgW = availW;
      pgH = Math.floor(pgW / aspect);
      if (pgH > availH) {
        pgH = availH;
        pgW = Math.floor(pgH * aspect);
      }
    }

    // Apply zoom
    pgW = Math.floor(pgW * state.zoomLevel);
    pgH = Math.floor(pgH * state.zoomLevel);

    state.pageWidth = pgW;
    state.pageHeight = pgH;

    // Create page elements — use pageCount, not pageCanvases.length
    var pages = [];
    for (var i = 0; i < state.pageCount; i++) {
      var div = document.createElement('div');
      div.className = 'page-canvas-wrapper';
      div.setAttribute('data-density', 'hard');
      div.setAttribute('data-page', i + 1);

      var displayCanvas = document.createElement('canvas');

      if (state.pageCanvases[i]) {
        // Real canvas available — draw it
        displayCanvas.width = pgW;
        displayCanvas.height = pgH;
        var dCtx = displayCanvas.getContext('2d');
        dCtx.drawImage(state.pageCanvases[i], 0, 0, pgW, pgH);
      } else {
        // Not yet rendered — draw placeholder
        drawPlaceholder(displayCanvas, i + 1, pgW, pgH);
      }

      div.appendChild(displayCanvas);

      // Accessibility text layer — only if text content exists
      var textLayerDiv = document.createElement('div');
      textLayerDiv.className = 'textLayer';
      div.appendChild(textLayerDiv);
      if (state.pageTextContent[i]) {
        ASIViewer.renderer.renderTextLayerForPage(textLayerDiv, state.pageTextContent[i], state.pdfDoc, i + 1, pgW, pgH);
      }

      // Annotation layer (clickable links)
      var annotDiv = document.createElement('div');
      annotDiv.className = 'annotationLayer';
      div.appendChild(annotDiv);
      ASIViewer.renderer.renderAnnotationLayer(annotDiv, state.pdfDoc, i + 1, pgW, pgH);

      pages.push(div);
    }

    // Init StPageFlip - usePortrait:true for single page mode
    var isSingle = state.spreadMode === 'single';

    flipBook = new St.PageFlip(container, {
      width: pgW,
      height: pgH,
      size: 'fixed',
      minWidth: pgW,
      maxWidth: pgW,
      minHeight: pgH,
      maxHeight: pgH,
      showCover: true,
      maxShadowOpacity: 0.35,
      mobileScrollSupport: false,
      flippingTime: 600,
      useMouseEvents: true,
      swipeDistance: 30,
      clickEventForward: true,
      usePortrait: isSingle,
      startZIndex: 0,
      autoSize: false,
      drawShadow: true
    });

    flipBook.loadFromHTML(pages);

    // Restore current page position
    if (state.currentPage > 1) {
      try { flipBook.flip(state.currentPage - 1); } catch (e) {}
    }

    // Track page changes from flip events
    flipBook.on('flip', function (e) {
      state.currentPage = e.data + 1;
      ASIViewer.navigation.updatePageUI();
    });

    // Set up directional cursor on the StPageFlip wrapper
    setupFlipCursor(container, isSingle);

    ASIViewer.navigation.updatePageUI();
  }

  /**
   * Updates a single page in the flipbook after its canvas becomes available.
   * Finds the wrapper by data-page, redraws its display canvas, and adds the
   * text layer if available and not already present.
   * @param {number} pageNum - 1-based page number
   */
  function updateFlipbookPage(pageNum) {
    var state = ASIViewer.state;
    var canvas = state.pageCanvases[pageNum - 1];
    if (!canvas) return;

    var wrapper = document.querySelector('.page-canvas-wrapper[data-page="' + pageNum + '"]');
    if (!wrapper) return;

    // Redraw display canvas
    var displayCanvas = wrapper.querySelector('canvas');
    if (displayCanvas) {
      var dCtx = displayCanvas.getContext('2d');
      dCtx.clearRect(0, 0, displayCanvas.width, displayCanvas.height);
      dCtx.drawImage(canvas, 0, 0, displayCanvas.width, displayCanvas.height);
    }

    // Add text layer if available and not already populated
    var textLayer = wrapper.querySelector('.textLayer');
    if (textLayer && state.pageTextContent[pageNum - 1] && textLayer.childNodes.length === 0) {
      ASIViewer.renderer.renderTextLayerForPage(
        textLayer, state.pageTextContent[pageNum - 1], state.pdfDoc, pageNum,
        displayCanvas.width, displayCanvas.height
      );
    }
  }

  /**
   * Attaches a mousemove listener to the .stf__wrapper element that toggles
   * flip-cursor-prev / flip-cursor-next classes based on which click-zone
   * the pointer is in. Zone logic mirrors StPageFlip internals:
   *   - Landscape (dual): left half = prev, right half = next
   *   - Portrait (single): left 20% = prev, rest = next
   */
  function setupFlipCursor(container, isPortrait) {
    var wrapper = container.querySelector('.stf__wrapper');
    if (!wrapper) return;

    wrapper.addEventListener('mousemove', function (e) {
      var rect = wrapper.getBoundingClientRect();
      var x = e.clientX - rect.left;
      var w = rect.width;

      var isPrev;
      if (isPortrait) {
        // StPageFlip portrait: left 1/5 of the wrapper width = BACK
        isPrev = x <= w / 5;
      } else {
        // StPageFlip landscape: left half = BACK
        isPrev = x < w / 2;
      }

      wrapper.classList.toggle('flip-cursor-prev', isPrev);
      wrapper.classList.toggle('flip-cursor-next', !isPrev);
    });

    wrapper.addEventListener('mouseleave', function () {
      wrapper.classList.remove('flip-cursor-prev', 'flip-cursor-next');
    });
  }

  function getFlipBook() {
    return flipBook;
  }

  ASIViewer.flipbook = {
    destroyFlipbook: destroyFlipbook,
    initFlipbook: initFlipbook,
    updateFlipbookPage: updateFlipbookPage,
    getFlipBook: getFlipBook
  };
})();
