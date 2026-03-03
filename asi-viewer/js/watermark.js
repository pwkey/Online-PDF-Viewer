// ============================================================
//  WATERMARK ENGINE — ASIViewer.watermark
//  Fully client-side, no 3rd party. Composites directly onto
//  canvas pixels making it inseparable from rendered content.
// ============================================================
(function () {
  'use strict';

  window.ASIViewer = window.ASIViewer || {};

  /**
   * Applies a tiled diagonal watermark to a canvas.
   *
   * @param {HTMLCanvasElement} canvas - Target canvas with rendered PDF page
   * @param {Object} credentials - User credential data
   * @param {Object} options - Watermark style options
   */
  function applyWatermark(canvas, credentials, options) {
    options = options || {};
    var opacity    = options.opacity    !== undefined ? options.opacity    : 0.09;
    var fontSize   = options.fontSize   !== undefined ? options.fontSize   : 14;
    var fontFamily = options.fontFamily || 'Arial, Helvetica, sans-serif';
    var color      = options.color      || '#445566';
    var angle      = options.angle      !== undefined ? options.angle      : -25;
    var lineGapX   = options.lineGapX   !== undefined ? options.lineGapX   : 380;
    var lineGapY   = options.lineGapY   !== undefined ? options.lineGapY   : 140;
    var showBorder = options.showBorder || false;

    var ctx = canvas.getContext('2d');
    var w = canvas.width;
    var h = canvas.height;

    // Scale font with canvas resolution
    var scale = w / 800;
    var scaledFont = Math.max(10, Math.round(fontSize * scale));
    var scaledGapX = lineGapX * scale;
    var scaledGapY = lineGapY * scale;

    ctx.save();

    // Watermark text lines
    var line1 = credentials.name + '  |  ' + credentials.email;
    var line2 = 'Student ID: ' + credentials.studentId + '  |  ' + credentials.timestamp;

    ctx.globalAlpha = opacity;
    ctx.font = '500 ' + scaledFont + 'px ' + fontFamily;
    ctx.fillStyle = color;
    ctx.textBaseline = 'middle';

    // Rotate entire context
    var rad = (angle * Math.PI) / 180;
    ctx.translate(w / 2, h / 2);
    ctx.rotate(rad);

    // Tile across a region large enough to cover the rotated canvas
    var diagonal = Math.sqrt(w * w + h * h);
    var startX = -diagonal;
    var startY = -diagonal;
    var endX = diagonal;
    var endY = diagonal;

    for (var y = startY; y < endY; y += scaledGapY) {
      for (var x = startX; x < endX; x += scaledGapX) {
        ctx.fillText(line1, x, y);
        ctx.fillText(line2, x, y + scaledFont * 1.4);
      }
    }

    ctx.restore();

    // Optional: thin border watermark with credentials in footer
    if (showBorder) {
      ctx.save();
      ctx.globalAlpha = 0.15;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1 * scale;
      ctx.strokeRect(4 * scale, 4 * scale, w - 8 * scale, h - 8 * scale);
      ctx.restore();
    }
  }

  /**
   * Enhanced watermark for print output — higher opacity,
   * plus a footer bar with user credentials.
   */
  function applyPrintWatermark(canvas, credentials) {
    // First apply the standard tiled watermark at higher opacity
    applyWatermark(canvas, credentials, { opacity: 0.18, showBorder: true });

    var ctx = canvas.getContext('2d');
    var w = canvas.width;
    var h = canvas.height;
    var scale = w / 800;
    var barH = 28 * scale;

    // Footer credential bar
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#1a2744';
    ctx.fillRect(0, h - barH, w, barH);

    ctx.globalAlpha = 0.7;
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 ' + (11 * scale) + 'px Arial, sans-serif';
    ctx.textBaseline = 'middle';
    var footerText = 'Licensed to: ' + credentials.name + ' (' + credentials.email + ') \u2014 ID: ' + credentials.studentId + ' \u2014 Printed: ' + new Date().toLocaleString('en-AU');
    ctx.fillText(footerText, 10 * scale, h - barH / 2);
    ctx.restore();
  }

  ASIViewer.watermark = {
    applyWatermark: applyWatermark,
    applyPrintWatermark: applyPrintWatermark
  };
})();
