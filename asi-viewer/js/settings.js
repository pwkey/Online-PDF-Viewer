// ============================================================
//  SETTINGS — ASIViewer.settings
//  Admin settings panel: toggle watermarks & print, live preview,
//  export viewer-config.json for deployment.
// ============================================================
(function () {
  'use strict';

  window.ASIViewer = window.ASIViewer || {};

  var panel = null;

  function getPanel() {
    if (!panel) panel = document.getElementById('settingsPanel');
    return panel;
  }

  function toggle() {
    getPanel().classList.toggle('open');
  }

  function open() {
    getPanel().classList.add('open');
  }

  function close() {
    getPanel().classList.remove('open');
  }

  /**
   * Initialise panel state from current config and wire up listeners.
   * Safe to call multiple times — listeners are wired only on first call,
   * subsequent calls just refresh checkbox states.
   */
  var listenersWired = false;

  function initPanel() {
    var config = ASIViewer.config;

    var chkWatermark = document.getElementById('toggleWatermark');
    var chkPrintWatermark = document.getElementById('togglePrintWatermark');
    var chkAllowPrint = document.getElementById('toggleAllowPrint');

    // Set initial states
    chkWatermark.checked = config.showWatermark;
    chkPrintWatermark.checked = config.showPrintWatermark;
    chkAllowPrint.checked = config.allowPrint;

    // Wire listeners only once
    if (!listenersWired) {
      listenersWired = true;

      chkWatermark.addEventListener('change', function () {
        onWatermarkToggle(this.checked);
      });

      chkPrintWatermark.addEventListener('change', function () {
        onPrintWatermarkToggle(this.checked);
      });

      chkAllowPrint.addEventListener('change', function () {
        onPrintToggle(this.checked);
      });
    }

    updateConfigOutput();
  }

  function onWatermarkToggle(checked) {
    ASIViewer.config.showWatermark = checked;
    updateConfigOutput();
    // Live preview — re-render all pages
    ASIViewer.viewer.reRenderPages();
  }

  function onPrintWatermarkToggle(checked) {
    ASIViewer.config.showPrintWatermark = checked;
    updateConfigOutput();
    // No re-render needed — only affects print
  }

  function onPrintToggle(checked) {
    ASIViewer.config.allowPrint = checked;
    updateConfigOutput();

    var btnPrint = document.getElementById('btnPrint');
    btnPrint.style.display = checked ? '' : 'none';
  }

  /**
   * Build a config object containing only non-default values, display in panel.
   */
  function updateConfigOutput() {
    var config = ASIViewer.config;
    var defaults = config._defaults;
    var output = {};

    if (config.showWatermark !== defaults.showWatermark) {
      output.showWatermark = config.showWatermark;
    }
    if (config.showPrintWatermark !== defaults.showPrintWatermark) {
      output.showPrintWatermark = config.showPrintWatermark;
    }
    if (config.allowPrint !== defaults.allowPrint) {
      output.allowPrint = config.allowPrint;
    }

    var json = JSON.stringify(output, null, 2);
    document.getElementById('configOutput').textContent = json;
  }

  /**
   * Download current non-default config as viewer-config.json.
   */
  function exportConfig() {
    var config = ASIViewer.config;
    var defaults = config._defaults;
    var output = {};

    if (config.showWatermark !== defaults.showWatermark) {
      output.showWatermark = config.showWatermark;
    }
    if (config.showPrintWatermark !== defaults.showPrintWatermark) {
      output.showPrintWatermark = config.showPrintWatermark;
    }
    if (config.allowPrint !== defaults.allowPrint) {
      output.allowPrint = config.allowPrint;
    }

    var json = JSON.stringify(output, null, 2);
    var blob = new Blob([json], { type: 'application/json' });
    var url = URL.createObjectURL(blob);

    var a = document.createElement('a');
    a.href = url;
    a.download = 'viewer-config.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Embed current non-default config into PDF metadata and trigger download.
   * Uses pdf-lib to set a custom ASIViewerConfig key in the Info dictionary.
   */
  async function embedConfigInPdf() {
    var config = ASIViewer.config;
    var defaults = config._defaults;

    // Build non-default config object (same logic as exportConfig)
    var output = {};
    if (config.showWatermark !== defaults.showWatermark) {
      output.showWatermark = config.showWatermark;
    }
    if (config.showPrintWatermark !== defaults.showPrintWatermark) {
      output.showPrintWatermark = config.showPrintWatermark;
    }
    if (config.allowPrint !== defaults.allowPrint) {
      output.allowPrint = config.allowPrint;
    }

    var jsonStr = JSON.stringify(output);

    try {
      // Fetch the current PDF as bytes
      var resp = await fetch(config.pdfUrl);
      if (!resp.ok) throw new Error('Failed to fetch PDF: ' + resp.status);
      var bytes = await resp.arrayBuffer();

      // Load with pdf-lib
      var pdfLibDoc = await PDFLib.PDFDocument.load(bytes);

      // Ensure Info dictionary exists (setProducer creates it if needed)
      pdfLibDoc.setProducer(pdfLibDoc.getProducer() || 'pdf-lib');

      // Access low-level Info dictionary and set custom key
      var context = pdfLibDoc.context;
      var infoRef = context.trailerInfo.Info;
      var infoDict = context.lookup(infoRef);
      infoDict.set(
        PDFLib.PDFName.of('ASIViewerConfig'),
        PDFLib.PDFHexString.fromText(jsonStr)
      );

      // Save modified PDF
      var pdfBytes = await pdfLibDoc.save();

      // Derive filename from URL, add -configured suffix
      var urlParts = config.pdfUrl.split('/');
      var filename = urlParts[urlParts.length - 1] || 'document.pdf';
      filename = filename.split('?')[0];
      var dotIdx = filename.lastIndexOf('.');
      if (dotIdx > 0) {
        filename = filename.substring(0, dotIdx) + '-configured' + filename.substring(dotIdx);
      } else {
        filename = filename + '-configured';
      }

      // Trigger download
      var blob = new Blob([pdfBytes], { type: 'application/pdf' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[ASI Viewer] Embed config error:', err);
      alert('Failed to embed config in PDF: ' + err.message);
    }
  }

  ASIViewer.settings = {
    toggle: toggle,
    open: open,
    close: close,
    initPanel: initPanel,
    exportConfig: exportConfig,
    embedConfigInPdf: embedConfigInPdf
  };
})();
