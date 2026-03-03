// ============================================================
//  PDF RENDERER — ASIViewer.renderer
//  PDF.js worker setup, renderPage(), renderThumbnail(), loadDocument()
// ============================================================
(function () {
  'use strict';

  window.ASIViewer = window.ASIViewer || {};

  // Set up PDF.js worker from config (local file, no CDN)
  pdfjsLib.GlobalWorkerOptions.workerSrc = ASIViewer.config.workerSrc;

  /**
   * Loads a PDF document from a URL.
   * @param {string} url - URL to the PDF file
   * @returns {Promise<PDFDocumentProxy>}
   */
  function loadDocument(url) {
    return pdfjsLib.getDocument({ url: url }).promise;
  }

  /**
   * Renders a single PDF page to a new canvas with watermark applied.
   * @param {PDFDocumentProxy} pdfDoc
   * @param {number} pageNum
   * @param {number} [scale]
   * @returns {Promise<HTMLCanvasElement>}
   */
  async function renderPage(pdfDoc, pageNum, scale) {
    scale = scale || ASIViewer.config.baseRenderScale;
    var page = await pdfDoc.getPage(pageNum);
    var viewport = page.getViewport({ scale: scale });

    var canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    var ctx = canvas.getContext('2d');

    // White background (some PDFs don't fill their own background)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Render PDF page
    await page.render({ canvasContext: ctx, viewport: viewport }).promise;

    // Composite watermark directly onto the rendered pixels (if enabled)
    if (ASIViewer.config.showWatermark) {
      ASIViewer.watermark.applyWatermark(canvas, ASIViewer.config.credentials);
    }

    return canvas;
  }

  /**
   * Renders a thumbnail-sized canvas of a page.
   * @param {PDFDocumentProxy} pdfDoc
   * @param {number} pageNum
   * @returns {Promise<HTMLCanvasElement>}
   */
  async function renderThumbnail(pdfDoc, pageNum) {
    var page = await pdfDoc.getPage(pageNum);
    var viewport = page.getViewport({ scale: 0.3 });

    var canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: ctx, viewport: viewport }).promise;
    return canvas;
  }

  ASIViewer.renderer = {
    loadDocument: loadDocument,
    renderPage: renderPage,
    renderThumbnail: renderThumbnail
  };
})();
