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

  /**
   * Extracts text content (with positioning) from a PDF page.
   * @param {PDFDocumentProxy} pdfDoc
   * @param {number} pageNum
   * @returns {Promise<TextContent>}
   */
  async function getPageTextContent(pdfDoc, pageNum) {
    var page = await pdfDoc.getPage(pageNum);
    return page.getTextContent();
  }

  /**
   * Renders an invisible text layer over a display canvas for screen reader accessibility.
   * @param {HTMLElement} container - The .textLayer div to populate
   * @param {TextContent} textContent - From getPageTextContent()
   * @param {PDFDocumentProxy} pdfDoc
   * @param {number} pageNum - 1-based page number
   * @param {number} displayWidth - Width of the display canvas
   * @param {number} displayHeight - Height of the display canvas
   */
  async function renderTextLayerForPage(container, textContent, pdfDoc, pageNum, displayWidth, displayHeight) {
    var page = await pdfDoc.getPage(pageNum);
    var originalViewport = page.getViewport({ scale: 1 });
    var scale = displayWidth / originalViewport.width;
    var viewport = page.getViewport({ scale: scale });

    pdfjsLib.renderTextLayer({
      textContentSource: textContent,
      container: container,
      viewport: viewport
    });
  }

  /**
   * Returns raw annotations array from a PDF page.
   * @param {PDFDocumentProxy} pdfDoc
   * @param {number} pageNum - 1-based page number
   * @returns {Promise<Array>}
   */
  async function getPageAnnotations(pdfDoc, pageNum) {
    var page = await pdfDoc.getPage(pageNum);
    return page.getAnnotations();
  }

  /**
   * Resolves a PDF.js destination to a 1-based page number.
   * @param {PDFDocumentProxy} pdfDoc
   * @param {string|Array} dest - Named destination string or explicit dest array
   * @returns {Promise<number|null>} 1-based page number, or null if unresolvable
   */
  async function resolveDestToPageNum(pdfDoc, dest) {
    try {
      // Named destination (string) — resolve to explicit dest array first
      if (typeof dest === 'string') {
        dest = await pdfDoc.getDestination(dest);
      }
      if (!Array.isArray(dest) || dest.length === 0) return null;

      // dest[0] is a page reference object — resolve to 0-based index
      var pageIndex = await pdfDoc.getPageIndex(dest[0]);
      return pageIndex + 1; // convert to 1-based
    } catch (e) {
      return null;
    }
  }

  /**
   * Renders clickable link overlays for a PDF page's annotations.
   * Supports both external URL links and internal page links.
   * @param {HTMLElement} container - The .annotationLayer div to populate
   * @param {PDFDocumentProxy} pdfDoc
   * @param {number} pageNum - 1-based page number
   * @param {number} displayWidth - Width of the display canvas
   * @param {number} displayHeight - Height of the display canvas
   */
  async function renderAnnotationLayer(container, pdfDoc, pageNum, displayWidth, displayHeight) {
    var page = await pdfDoc.getPage(pageNum);
    var viewport = page.getViewport({ scale: 1 });
    var scale = displayWidth / viewport.width;

    var annotations = await page.getAnnotations();

    for (var i = 0; i < annotations.length; i++) {
      var annot = annotations[i];
      if (annot.subtype !== 'Link') continue;

      // Determine if this is an external URL or internal destination
      var url = annot.url || annot.unsafeUrl || null;
      var dest = annot.dest || null;

      // Skip annotations with neither a URL nor a destination
      if (!url && !dest) continue;

      var rect = annot.rect;
      var left = rect[0] * scale;
      var top = displayHeight - (rect[3] * scale);
      var width = (rect[2] - rect[0]) * scale;
      var height = (rect[3] - rect[1]) * scale;

      var a = document.createElement('a');
      a.className = 'annotation-link';
      a.style.left = left + 'px';
      a.style.top = top + 'px';
      a.style.width = width + 'px';
      a.style.height = height + 'px';

      if (url) {
        // External link — open in new tab
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
      } else {
        // Internal link — navigate within the viewer
        a.href = '#';
        (function (linkDest) {
          a.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            resolveDestToPageNum(pdfDoc, linkDest).then(function (targetPage) {
              if (targetPage) {
                ASIViewer.navigation.goToPage(targetPage);
              }
            });
          });
        })(dest);
      }

      container.appendChild(a);
    }
  }

  ASIViewer.renderer = {
    loadDocument: loadDocument,
    renderPage: renderPage,
    renderThumbnail: renderThumbnail,
    getPageTextContent: getPageTextContent,
    renderTextLayerForPage: renderTextLayerForPage,
    getPageAnnotations: getPageAnnotations,
    renderAnnotationLayer: renderAnnotationLayer
  };
})();
