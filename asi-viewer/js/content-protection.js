// ============================================================
//  CONTENT PROTECTION — ASIViewer.protection
//  Right-click block, Ctrl+S/P intercept, beforeprint handler
// ============================================================
(function () {
  'use strict';

  window.ASIViewer = window.ASIViewer || {};

  function init() {
    // Block right-click on viewer area
    var viewerArea = document.getElementById('viewerArea');
    if (viewerArea) {
      viewerArea.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        return false;
      });
    }

    // Block Ctrl+S, conditionally handle Ctrl+P
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        if (ASIViewer.config.allowPrint) {
          ASIViewer.navigation.printDocument();
        } else {
          alert('Printing is disabled for this document.');
        }
        return;
      }
    });

    // Print interception — apply enhanced watermark
    window.addEventListener('beforeprint', function () {
      console.log('[ASI Viewer] Print event detected \u2014 print watermark would be applied.');
    });
  }

  ASIViewer.protection = {
    init: init
  };
})();
