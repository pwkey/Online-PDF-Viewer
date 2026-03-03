// ============================================================
//  FLIPBOOK — ASIViewer.flipbook
//  StPageFlip destroy/recreate cycle, initFlipbook()
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

  function initFlipbook() {
    destroyFlipbook();

    var state = ASIViewer.state;
    var container = document.getElementById('flipbook-container');
    if (state.pageCanvases.length === 0) return;

    // Calculate dimensions to fit the viewer area
    var viewerArea = document.getElementById('viewerArea');
    var availW = viewerArea.clientWidth - 60;
    var availH = viewerArea.clientHeight - 40;

    // Use the first page's aspect ratio
    var srcW = state.pageCanvases[0].width;
    var srcH = state.pageCanvases[0].height;
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

    // Create page elements
    var pages = [];
    for (var i = 0; i < state.pageCanvases.length; i++) {
      var div = document.createElement('div');
      div.className = 'page-canvas-wrapper';
      div.setAttribute('data-density', 'hard');

      var displayCanvas = document.createElement('canvas');
      displayCanvas.width = pgW;
      displayCanvas.height = pgH;
      var dCtx = displayCanvas.getContext('2d');
      dCtx.drawImage(state.pageCanvases[i], 0, 0, pgW, pgH);

      div.appendChild(displayCanvas);
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
    getFlipBook: getFlipBook
  };
})();
