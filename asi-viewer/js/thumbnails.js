// ============================================================
//  THUMBNAILS — ASIViewer.thumbnails
//  buildThumbnails(), toggleStrip()
// ============================================================
(function () {
  'use strict';

  window.ASIViewer = window.ASIViewer || {};

  /**
   * Builds the bottom thumbnail strip from the loaded PDF.
   * @param {PDFDocumentProxy} pdfDoc
   * @param {number} pageCount
   */
  async function buildThumbnails(pdfDoc, pageCount) {
    var container = document.getElementById('thumbContainer');
    container.innerHTML = '';

    for (var i = 1; i <= pageCount; i++) {
      var thumbCanvas = await ASIViewer.renderer.renderThumbnail(pdfDoc, i);

      var item = document.createElement('div');
      item.className = 'thumb-item' + (i === 1 ? ' active' : '');
      item.setAttribute('data-page', i);
      (function (pageNum) {
        item.onclick = function () { ASIViewer.navigation.goToPage(pageNum); };
      })(i);

      item.appendChild(thumbCanvas);

      var label = document.createElement('div');
      label.className = 'thumb-label';
      label.textContent = i;
      item.appendChild(label);

      container.appendChild(item);
    }
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
