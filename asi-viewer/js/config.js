// ============================================================
//  CONFIG — ASIViewer.config
//  Resolves configuration from 5 sources (highest priority first):
//    1. PostMessage from parent frame
//    2. URL parameters
//    3. JS globals set before viewer loads
//    4. viewer-config.json file (deployed alongside viewer)
//    5. Dev defaults
// ============================================================
(function () {
  'use strict';

  window.ASIViewer = window.ASIViewer || {};

  // --- Source 3: JS globals (set by Kentico before viewer loads) ---
  var globals = window.ASI_VIEWER_CONFIG || {};

  // --- Source 2: URL parameters ---
  var params = new URLSearchParams(window.location.search);

  // --- Helper: resolve boolean from URL param string ---
  function paramBool(key, fallback) {
    var val = params.get(key);
    if (val === 'true') return true;
    if (val === 'false') return false;
    return fallback;
  }

  // --- Resolve with fallback chain (file config merged in load()) ---
  var config = {
    pdfUrl: params.get('pdf') || globals.pdfUrl || 'tests/test-pdfs/Knowledge-Series-Module-1.pdf',
    workerSrc: params.get('workerSrc') || globals.workerSrc || 'lib/pdf.worker.min.js',
    baseRenderScale: parseFloat(params.get('scale')) || globals.baseRenderScale || 1.5,
    allowPrint: paramBool('allowPrint', globals.allowPrint !== undefined ? globals.allowPrint : true),
    showWatermark: paramBool('showWatermark', globals.showWatermark !== undefined ? globals.showWatermark : true),
    showPrintWatermark: paramBool('showPrintWatermark', globals.showPrintWatermark !== undefined ? globals.showPrintWatermark : true),
    adminMode: paramBool('admin', globals.adminMode !== undefined ? globals.adminMode : false),
    credentials: {
      name: params.get('name') || globals.userName || 'Jane Smith',
      email: params.get('email') || globals.userEmail || 'jane.smith@example.com',
      studentId: params.get('studentId') || globals.studentId || 'ASI-2024-00847',
      timestamp: new Date().toLocaleDateString('en-AU', {
        day: '2-digit', month: 'short', year: 'numeric'
      })
    }
  };

  // --- Defaults record (used to detect non-default values for export) ---
  var DEFAULTS = {
    showWatermark: true,
    showPrintWatermark: true,
    allowPrint: true
  };
  config._defaults = DEFAULTS;

  // --- Source 4: Async file config loader ---
  config.load = async function () {
    try {
      var resp = await fetch('viewer-config.json');
      if (!resp.ok) return; // 404 or other error — silently ignored
      var fileConfig = await resp.json();

      // File config is lowest priority — only apply if URL params and globals didn't set it
      // For each key: if URL param was NOT explicitly set AND global was NOT explicitly set, use file value
      if (params.get('showWatermark') === null && globals.showWatermark === undefined && fileConfig.showWatermark !== undefined) {
        config.showWatermark = !!fileConfig.showWatermark;
      }
      if (params.get('showPrintWatermark') === null && globals.showPrintWatermark === undefined && fileConfig.showPrintWatermark !== undefined) {
        config.showPrintWatermark = !!fileConfig.showPrintWatermark;
      }
      if (params.get('allowPrint') === null && globals.allowPrint === undefined && fileConfig.allowPrint !== undefined) {
        config.allowPrint = !!fileConfig.allowPrint;
      }
    } catch (e) {
      // Network error or JSON parse error — silently ignored
    }
  };

  // --- Source 1: PostMessage listener (can override at runtime) ---
  window.addEventListener('message', function (e) {
    if (e.data && e.data.type === 'ASI_VIEWER_CONFIG') {
      var d = e.data.payload || {};
      if (d.pdfUrl) config.pdfUrl = d.pdfUrl;
      if (d.allowPrint !== undefined) config.allowPrint = !!d.allowPrint;
      if (d.showWatermark !== undefined) config.showWatermark = !!d.showWatermark;
      if (d.showPrintWatermark !== undefined) config.showPrintWatermark = !!d.showPrintWatermark;
      if (d.name) config.credentials.name = d.name;
      if (d.email) config.credentials.email = d.email;
      if (d.studentId) config.credentials.studentId = d.studentId;
    }
  });

  ASIViewer.config = config;
})();
