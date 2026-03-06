// ============================================================
//  THUMBNAILS — ASIViewer.thumbnails
//  buildThumbnails() with lazy IntersectionObserver, toggleStrip()
// ============================================================
(function () {
  'use strict';

  window.ASIViewer = window.ASIViewer || {};

  var thumbObserver = null;

  /**
   * Builds the bottom thumbnail strip.
   * Page 1 is rendered immediately; the rest are placeholder divs
   * that render lazily via IntersectionObserver as they scroll into view.
   * @param {PDFDocumentProxy} pdfDoc
   * @param {number} pageCount
   */
  async function buildThumbnails(pdfDoc, pageCount) {
    var container = document.getElementById('thumbContainer');
    container.innerHTML = '';

    // Clean up old observer
    if (thumbObserver) {
      thumbObserver.disconnect();
      thumbObserver = null;
    }

    // Render page 1 thumbnail immediately
    var firstThumbCanvas = await ASIViewer.renderer.renderThumbnail(pdfDoc, 1);
    var firstItem = createThumbItem(1, firstThumbCanvas);
    container.appendChild(firstItem);

    // Create placeholder divs for the rest
    // Compute aspect ratio from page 1 thumbnail for placeholder sizing
    var thumbAspect = firstThumbCanvas.width / firstThumbCanvas.height;

    for (var i = 2; i <= pageCount; i++) {
      var item = createThumbPlaceholder(i, thumbAspect);
      container.appendChild(item);
    }

    // Set up IntersectionObserver for lazy thumbnail rendering
    var thumbStrip = document.getElementById('thumbStrip');
    thumbObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var item = entry.target;
        var pageNum = parseInt(item.getAttribute('data-page'));
        if (!pageNum) return;

        // Already rendered (has a canvas child)?
        if (item.querySelector('canvas')) return;

        // Stop observing immediately
        thumbObserver.unobserve(item);

        // Render thumbnail
        ASIViewer.renderer.renderThumbnail(pdfDoc, pageNum).then(function (thumbCanvas) {
          // Replace placeholder with real canvas
          var placeholder = item.querySelector('.thumb-placeholder');
          if (placeholder) placeholder.remove();
          // Insert canvas before the label
          var label = item.querySelector('.thumb-label');
          item.insertBefore(thumbCanvas, label);
        });
      });
    }, {
      root: thumbStrip,
      rootMargin: '200px'
    });

    // Observe all placeholder items
    var placeholders = container.querySelectorAll('.thumb-item:not(:first-child)');
    placeholders.forEach(function (el) {
      thumbObserver.observe(el);
    });
  }

  /**
   * Creates a complete thumb-item with a real canvas.
   */
  function createThumbItem(pageNum, thumbCanvas) {
    var item = document.createElement('div');
    item.className = 'thumb-item' + (pageNum === 1 ? ' active' : '');
    item.setAttribute('data-page', pageNum);
    (function (pn) {
      item.onclick = function () { ASIViewer.navigation.goToPage(pn); };
    })(pageNum);

    item.appendChild(thumbCanvas);

    var label = document.createElement('div');
    label.className = 'thumb-label';
    label.textContent = pageNum;
    item.appendChild(label);

    return item;
  }

  /**
   * Creates a thumb-item with a placeholder div instead of a canvas.
   */
  function createThumbPlaceholder(pageNum, aspect) {
    var item = document.createElement('div');
    item.className = 'thumb-item';
    item.setAttribute('data-page', pageNum);
    (function (pn) {
      item.onclick = function () { ASIViewer.navigation.goToPage(pn); };
    })(pageNum);

    var placeholder = document.createElement('div');
    placeholder.className = 'thumb-placeholder';
    // Match aspect ratio using padding-bottom trick relative to item height
    // The thumb-item has height:100%, so we set width based on aspect
    placeholder.style.height = '100%';
    placeholder.style.aspectRatio = aspect;
    item.appendChild(placeholder);

    var label = document.createElement('div');
    label.className = 'thumb-label';
    label.textContent = pageNum;
    item.appendChild(label);

    return item;
  }

  /**
   * Toggles the thumbnail strip visibility and re-layouts.
   */
  function toggleStrip() {
    var strip = document.getElementById('thumbStrip');
    var btn = document.getElementById('btnSidebar');
    strip.classList.toggle('collapsed');
    btn.classList.toggle('active');

    // Re-layout after transition
    setTimeout(function () {
      var state = ASIViewer.state;
      if (state.viewMode === 'flip') {
        ASIViewer.flipbook.initFlipbook();
      } else {
        ASIViewer.navigation.initScrollMode();
      }
    }, 300);
  }

  ASIViewer.thumbnails = {
    buildThumbnails: buildThumbnails,
    toggleStrip: toggleStrip
  };
})();
