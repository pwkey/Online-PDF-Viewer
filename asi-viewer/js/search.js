// ============================================================
//  SEARCH — ASIViewer.search
//  Find-in-document with result list, prev/next navigation,
//  and on-page highlight overlay.
// ============================================================
(function () {
  'use strict';

  window.ASIViewer = window.ASIViewer || {};

  var results = [];       // { page, charIndex, contextSnippet, matchLength }
  var currentIndex = -1;
  var debounceTimer = null;

  // ---- Panel open / close ----

  function toggle() {
    var panel = document.getElementById('searchPanel');
    if (panel.classList.contains('open')) {
      close();
    } else {
      open();
    }
  }

  function open() {
    var panel = document.getElementById('searchPanel');
    panel.classList.add('open');
    var input = document.getElementById('searchInput');
    input.focus();
    input.select();
  }

  function close() {
    var panel = document.getElementById('searchPanel');
    panel.classList.remove('open');
    clearHighlights();
    results = [];
    currentIndex = -1;
    document.getElementById('searchInput').value = '';
    document.getElementById('searchCount').textContent = '';
    document.getElementById('searchResults').innerHTML = '';
  }

  // ---- Search logic ----

  function doSearch() {
    var query = document.getElementById('searchInput').value;
    results = [];
    currentIndex = -1;
    clearHighlights();
    document.getElementById('searchResults').innerHTML = '';
    document.getElementById('searchCount').textContent = '';

    if (!query) return;

    var state = ASIViewer.state;
    var queryLower = query.toLowerCase();

    for (var p = 0; p < state.pageTextContent.length; p++) {
      var textContent = state.pageTextContent[p];
      if (!textContent || !textContent.items) continue;

      var pageText = textContent.items.map(function (item) { return item.str; }).join('');
      var pageTextLower = pageText.toLowerCase();

      var idx = 0;
      while ((idx = pageTextLower.indexOf(queryLower, idx)) !== -1) {
        // Build context snippet (~40 chars either side)
        var ctxStart = Math.max(0, idx - 40);
        var ctxEnd = Math.min(pageText.length, idx + query.length + 40);
        var before = pageText.substring(ctxStart, idx);
        var match = pageText.substring(idx, idx + query.length);
        var after = pageText.substring(idx + query.length, ctxEnd);
        var snippet = (ctxStart > 0 ? '\u2026' : '') + before + match + after + (ctxEnd < pageText.length ? '\u2026' : '');

        results.push({
          page: p + 1,
          charIndex: idx,
          matchLength: query.length,
          contextSnippet: snippet,
          matchInSnippet: { start: before.length + (ctxStart > 0 ? 1 : 0), length: match.length }
        });
        idx += query.length;
      }
    }

    // Show count — include partial indicator if text extraction is incomplete
    var countEl = document.getElementById('searchCount');
    var pagesSearched = 0;
    for (var ps = 0; ps < state.pageTextContent.length; ps++) {
      if (state.pageTextContent[ps] && state.pageTextContent[ps].items) pagesSearched++;
    }
    var partialNote = '';
    if (!state.textExtractionDone && pagesSearched < state.pageCount) {
      partialNote = ' (searched ' + pagesSearched + '/' + state.pageCount + ' pages)';
    }
    countEl.textContent = (results.length ? results.length + ' result' + (results.length > 1 ? 's' : '') : 'No results') + partialNote;

    // Build result list
    var listEl = document.getElementById('searchResults');
    for (var i = 0; i < results.length; i++) {
      var r = results[i];
      var div = document.createElement('div');
      div.className = 'search-result-item';
      div.setAttribute('data-index', i);

      var pageLabel = document.createElement('span');
      pageLabel.className = 'search-result-page';
      pageLabel.textContent = 'Page ' + r.page;

      var snippetEl = document.createElement('span');
      snippetEl.className = 'search-result-snippet';
      // Highlight the match within the snippet
      var ms = r.matchInSnippet;
      var snipBefore = r.contextSnippet.substring(0, ms.start);
      var snipMatch = r.contextSnippet.substring(ms.start, ms.start + ms.length);
      var snipAfter = r.contextSnippet.substring(ms.start + ms.length);
      snippetEl.appendChild(document.createTextNode(snipBefore));
      var mark = document.createElement('mark');
      mark.className = 'search-match';
      mark.textContent = snipMatch;
      snippetEl.appendChild(mark);
      snippetEl.appendChild(document.createTextNode(snipAfter));

      div.appendChild(pageLabel);
      div.appendChild(snippetEl);

      (function (index) {
        div.addEventListener('click', function () { goToResult(index); });
      })(i);

      listEl.appendChild(div);
    }

    // Navigate to first result
    if (results.length > 0) {
      goToResult(0);
    }
  }

  // ---- Result navigation ----

  function nextResult() {
    if (!results.length) return;
    goToResult((currentIndex + 1) % results.length);
  }

  function prevResult() {
    if (!results.length) return;
    goToResult((currentIndex - 1 + results.length) % results.length);
  }

  function goToResult(index) {
    if (index < 0 || index >= results.length) return;
    currentIndex = index;

    // Update active class on result items
    var items = document.querySelectorAll('.search-result-item');
    items.forEach(function (el) {
      el.classList.toggle('active', parseInt(el.getAttribute('data-index')) === index);
    });

    // Scroll active item into view in the result list
    var activeItem = document.querySelector('.search-result-item.active');
    if (activeItem) activeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    // Update counter
    document.getElementById('searchCount').textContent = (index + 1) + ' of ' + results.length;

    var r = results[index];

    // Navigate to the page
    ASIViewer.navigation.goToPage(r.page);

    // Highlight the match on the page
    clearHighlights();
    highlightMatch(r.page, r);
  }

  // ---- On-page highlighting ----

  function highlightMatch(pageNum, matchInfo) {
    var state = ASIViewer.state;
    var textContent = state.pageTextContent[pageNum - 1];
    if (!textContent || !textContent.items) return;

    // Find which text items span the match
    var items = textContent.items;
    var charOffset = 0;
    var matchStart = matchInfo.charIndex;
    var matchEnd = matchStart + matchInfo.matchLength;

    // Find the page wrapper element(s)
    var wrappers = getPageWrappers(pageNum);
    if (!wrappers.length) return;

    wrappers.forEach(function (wrapper) {
      // Get display dimensions from the wrapper
      var canvas = wrapper.querySelector('canvas');
      if (!canvas) return;
      var displayWidth = canvas.width;
      var displayHeight = canvas.height;

      // Get the page viewport at scale 1
      // We'll compute scale from displayWidth
      var pdfDoc = state.pdfDoc;
      pdfDoc.getPage(pageNum).then(function (page) {
        var viewport = page.getViewport({ scale: 1 });
        var scale = displayWidth / viewport.width;

        // Create or find highlight layer
        var layer = wrapper.querySelector('.searchHighlightLayer');
        if (!layer) {
          layer = document.createElement('div');
          layer.className = 'searchHighlightLayer';
          wrapper.appendChild(layer);
        }

        // Walk through items to find those overlapping the match
        var offset = 0;
        for (var i = 0; i < items.length; i++) {
          var item = items[i];
          var itemLen = item.str.length;
          var itemStart = offset;
          var itemEnd = offset + itemLen;

          if (itemEnd > matchStart && itemStart < matchEnd) {
            // This item overlaps the match
            var t = item.transform;
            if (!t) { offset += itemLen; continue; }

            var x = t[4] * scale;
            var y = t[5] * scale;
            var itemWidth = (item.width || 0) * scale;
            var itemHeight = (item.height || Math.abs(t[3])) * scale;

            // For partial matches within an item, estimate proportional x/width
            var overlapStart = Math.max(matchStart, itemStart) - itemStart;
            var overlapEnd = Math.min(matchEnd, itemEnd) - itemStart;
            if (itemLen > 0 && item.width) {
              var charWidth = itemWidth / itemLen;
              var hlX = x + overlapStart * charWidth;
              var hlW = (overlapEnd - overlapStart) * charWidth;
            } else {
              var hlX = x;
              var hlW = itemWidth || 50;
            }

            var hlTop = displayHeight - y - itemHeight;

            var hlDiv = document.createElement('div');
            hlDiv.className = 'search-highlight';
            hlDiv.style.left = hlX + 'px';
            hlDiv.style.top = hlTop + 'px';
            hlDiv.style.width = hlW + 'px';
            hlDiv.style.height = itemHeight + 'px';
            layer.appendChild(hlDiv);
          }

          offset += itemLen;
        }
      });
    });
  }

  function getPageWrappers(pageNum) {
    var state = ASIViewer.state;
    var wrappers = [];

    if (state.viewMode === 'scroll') {
      var el = document.querySelector('.scroll-page[data-page="' + pageNum + '"]');
      if (el) wrappers.push(el);
    } else {
      // Flip mode — pages are inside .page-canvas-wrapper divs
      var all = document.querySelectorAll('.page-canvas-wrapper');
      all.forEach(function (w) {
        if (w.getAttribute('data-page') === String(pageNum)) {
          wrappers.push(w);
        }
      });
    }
    return wrappers;
  }

  function clearHighlights() {
    var layers = document.querySelectorAll('.searchHighlightLayer');
    layers.forEach(function (l) { l.remove(); });
  }

  // ---- Input handler with debounce ----

  document.addEventListener('DOMContentLoaded', function () {
    var input = document.getElementById('searchInput');
    if (!input) return;

    input.addEventListener('input', function () {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(doSearch, 200);
    });

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) {
          prevResult();
        } else {
          nextResult();
        }
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    });
  });

  // ---- Public API ----

  ASIViewer.search = {
    toggle: toggle,
    open: open,
    close: close,
    doSearch: doSearch,
    nextResult: nextResult,
    prevResult: prevResult,
    goToResult: goToResult,
    highlightMatch: highlightMatch,
    clearHighlights: clearHighlights
  };
})();
