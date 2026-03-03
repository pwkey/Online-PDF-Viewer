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
   * Called once from viewer.js when adminMode is true.
   */
  function initPanel() {
    var config = ASIViewer.config;

    var chkWatermark = document.getElementById('toggleWatermark');
    var chkPrintWatermark = document.getElementById('togglePrintWatermark');
    var chkAllowPrint = document.getElementById('toggleAllowPrint');

    // Set initial states
    chkWatermark.checked = config.showWatermark;
    chkPrintWatermark.checked = config.showPrintWatermark;
    chkAllowPrint.checked = config.allowPrint;

    // Wire listeners
    chkWatermark.addEventListener('change', function () {
      onWatermarkToggle(this.checked);
    });

    chkPrintWatermark.addEventListener('change', function () {
      onPrintWatermarkToggle(this.checked);
    });

    chkAllowPrint.addEventListener('change', function () {
      onPrintToggle(this.checked);
    });

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

  ASIViewer.settings = {
    toggle: toggle,
    open: open,
    close: close,
    initPanel: initPanel,
    exportConfig: exportConfig
  };
})();
