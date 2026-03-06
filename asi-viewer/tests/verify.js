const http = require('http');

const PORT = process.argv[2] || 8080;
const BASE = 'http://localhost:' + PORT;

function fetch(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetch(new URL(res.headers.location, url).href).then(resolve, reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function run() {
  let pass = 0;
  let fail = 0;

  function check(label, ok) {
    if (ok) { console.log('  PASS: ' + label); pass++; }
    else { console.log('  FAIL: ' + label); fail++; }
  }

  console.log('\n=== ASI Viewer — Verification (port ' + PORT + ') ===\n');

  // 1. Fetch index.html
  const html = await fetch(BASE + '/');

  // Script load order (img src also matches, so filter to .js only)
  console.log('--- Script Load Order ---');
  const allSrcs = [...html.matchAll(/src="([^"]+)"/g)].map(m => m[1]);
  const scripts = allSrcs.filter(s => s.endsWith('.js'));
  scripts.forEach((s, i) => console.log('  ' + (i + 1) + '. ' + s));

  const expected = [
    'lib/pdf.min.js',
    'lib/page-flip.browser.js',
    'lib/pdf-lib.min.js',
    'js/config.js',
    'js/watermark.js',
    'js/pdf-renderer.js',
    'js/content-protection.js',
    'js/thumbnails.js',
    'js/flipbook.js',
    'js/navigation.js',
    'js/search.js',
    'js/settings.js',
    'js/viewer.js'
  ];

  check('Script order correct (' + expected.length + ' scripts)', scripts.length === expected.length && scripts.every((s, i) => s === expected[i]));

  // No CDN references
  const hasCDN = html.includes('cdnjs.cloudflare.com') || html.includes('cdn.jsdelivr');
  check('No CDN references in HTML', hasCDN === false);

  // No inline oncontextmenu
  check('No inline oncontextmenu', html.includes('oncontextmenu') === false);

  // All onclick handlers use ASIViewer namespace (except the file-input trigger which uses document.getElementById)
  const onclicks = [...html.matchAll(/onclick="([^"]+)"/g)].map(m => m[1]);
  const nonNamespaced = onclicks.filter(h => !h.includes('ASIViewer.'));
  const allOk = nonNamespaced.every(h => h.includes("document.getElementById('fileInput')"));
  check('All ' + onclicks.length + ' onclick handlers use ASIViewer.* (1 known exception: fileInput trigger)', allOk);

  // No base64 loading
  check('No base64 placeholder or atob()', html.includes('PDF_BASE64') === false && html.includes('atob(') === false);

  // External CSS link
  check('External CSS link to viewer.css', html.includes('href="css/viewer.css"'));

  // 2. Verify JS modules contain correct namespace
  console.log('\n--- Module Namespace Checks ---');

  const configJs = await fetch(BASE + '/js/config.js');
  check('config.js creates ASIViewer.config', configJs.includes('ASIViewer.config ='));

  const watermarkJs = await fetch(BASE + '/js/watermark.js');
  check('watermark.js creates ASIViewer.watermark', watermarkJs.includes('ASIViewer.watermark ='));

  const rendererJs = await fetch(BASE + '/js/pdf-renderer.js');
  check('pdf-renderer.js creates ASIViewer.renderer', rendererJs.includes('ASIViewer.renderer ='));
  check('pdf-renderer.js uses local worker path', rendererJs.includes('ASIViewer.config.workerSrc') && rendererJs.includes('cdnjs') === false);

  const flipbookJs = await fetch(BASE + '/js/flipbook.js');
  check('flipbook.js creates ASIViewer.flipbook', flipbookJs.includes('ASIViewer.flipbook ='));

  const thumbnailsJs = await fetch(BASE + '/js/thumbnails.js');
  check('thumbnails.js creates ASIViewer.thumbnails', thumbnailsJs.includes('ASIViewer.thumbnails ='));

  const navigationJs = await fetch(BASE + '/js/navigation.js');
  check('navigation.js creates ASIViewer.navigation', navigationJs.includes('ASIViewer.navigation ='));

  const protectionJs = await fetch(BASE + '/js/content-protection.js');
  check('content-protection.js creates ASIViewer.protection', protectionJs.includes('ASIViewer.protection ='));

  const searchJs = await fetch(BASE + '/js/search.js');
  check('search.js creates ASIViewer.search', searchJs.includes('ASIViewer.search ='));

  const viewerJs = await fetch(BASE + '/js/viewer.js');
  check('viewer.js creates ASIViewer.state', viewerJs.includes('ASIViewer.state ='));

  // 3. Verify PDF is loadable from URL
  console.log('\n--- Asset Availability ---');

  const pdfCheck = await new Promise((resolve) => {
    http.get(BASE + '/tests/test-pdfs/Knowledge-Series-Module-1.pdf', (res) => {
      resolve({ status: res.statusCode, size: parseInt(res.headers['content-length'] || '0') });
      res.destroy();
    });
  });
  check('Test PDF responds (status ' + pdfCheck.status + ', ' + Math.round(pdfCheck.size / 1024) + ' KB)', pdfCheck.status === 200 && pdfCheck.size > 100000);

  const workerCheck = await new Promise((resolve) => {
    http.get(BASE + '/lib/pdf.worker.min.js', (res) => {
      resolve({ status: res.statusCode, size: parseInt(res.headers['content-length'] || '0') });
      res.destroy();
    });
  });
  check('PDF.js worker local (' + Math.round(workerCheck.size / 1024) + ' KB)', workerCheck.status === 200 && workerCheck.size > 100000);

  // 4. Check config.js has URL param support
  console.log('\n--- Config Resolution ---');
  check('config.js reads URL params', configJs.includes('URLSearchParams'));
  check('config.js reads PostMessage', configJs.includes('addEventListener') && configJs.includes('ASI_VIEWER_CONFIG'));
  check('config.js reads JS globals', configJs.includes('ASI_VIEWER_CONFIG') || configJs.includes('window.ASI_VIEWER_CONFIG'));
  check('config.js has dev defaults', configJs.includes('Jane Smith') && configJs.includes('jane.smith@example.com'));

  // 5. Check key PoC functionality preserved
  console.log('\n--- Functionality Preservation ---');
  check('Watermark has tiled diagonal pattern', watermarkJs.includes('rotate') && watermarkJs.includes('diagonal'));
  check('Print watermark has footer bar', watermarkJs.includes('applyPrintWatermark') && watermarkJs.includes('Licensed to'));
  check('Flipbook destroyFlipbook() recreates container', flipbookJs.includes('fresh.id') && flipbookJs.includes('insertBefore'));
  check('Navigation has keyboard shortcuts (arrows, Home, End)', navigationJs.includes('ArrowLeft') && navigationJs.includes('Home') && navigationJs.includes('End'));
  check('Content protection blocks Ctrl+S and Ctrl+P', protectionJs.includes("e.key === 's'") && protectionJs.includes("e.key === 'p'"));
  check('Viewer has resize handler with debounce', viewerJs.includes('resizeTimer') && viewerJs.includes('setTimeout'));
  check('PDF loaded via URL (not base64)', viewerJs.includes('loadDocument') && viewerJs.includes('atob') === false);

  // 6. Progressive loading checks
  console.log('\n--- Progressive Loading ---');
  check('pdf-renderer.js has ensurePageRendered()', rendererJs.includes('ensurePageRendered'));
  check('pdf-renderer.js has renderingInProgress dedup map', rendererJs.includes('renderingInProgress'));
  check('pdf-renderer.js exports ensurePageRendered', rendererJs.includes('ensurePageRendered: ensurePageRendered'));
  check('pdf-renderer.js sets --scale-factor on text layer', rendererJs.includes('--scale-factor'));
  check('viewer.js has renderPool()', viewerJs.includes('function renderPool'));
  check('viewer.js has extractAllTextInBackground()', viewerJs.includes('extractAllTextInBackground'));
  check('viewer.js has textExtractionDone state', viewerJs.includes('textExtractionDone'));
  check('viewer.js uses sparse arrays', viewerJs.includes('new Array(state.pageCount).fill(null)'));
  check('viewer.js renders page 1 first', viewerJs.includes('Rendering page 1'));
  check('viewer.js reRenderPages uses pool', viewerJs.includes('await renderPool(allPages, 3)'));
  check('flipbook.js has data-page attribute', flipbookJs.includes("data-page"));
  check('flipbook.js has drawPlaceholder()', flipbookJs.includes('drawPlaceholder'));
  check('flipbook.js has updateFlipbookPage()', flipbookJs.includes('updateFlipbookPage'));
  check('flipbook.js uses pageCount for loop bounds', flipbookJs.includes('i < state.pageCount'));
  check('navigation.js has IntersectionObserver', navigationJs.includes('IntersectionObserver'));
  check('navigation.js has updateScrollPage()', navigationJs.includes('updateScrollPage'));
  check('navigation.js has onPageRendered()', navigationJs.includes('onPageRendered'));
  check('navigation.js goToPage calls ensurePageRendered', navigationJs.includes('ensurePageRendered'));
  check('navigation.js printDocument is async', navigationJs.includes('async function printDocument'));
  check('thumbnails.js has IntersectionObserver', thumbnailsJs.includes('IntersectionObserver'));
  check('thumbnails.js has thumb-placeholder', thumbnailsJs.includes('thumb-placeholder'));
  check('thumbnails.js renders page 1 immediately', thumbnailsJs.includes('renderThumbnail(pdfDoc, 1)'));
  check('search.js has partial-search indicator', searchJs.includes('searched') && searchJs.includes('pages)'));

  const css = await fetch(BASE + '/css/viewer.css');
  check('viewer.css has .thumb-placeholder style', css.includes('.thumb-placeholder'));

  // Summary
  console.log('\n=== RESULTS: ' + pass + ' passed, ' + fail + ' failed ===\n');
  process.exit(fail > 0 ? 1 : 0);
}

run().catch(err => { console.error('Test error:', err); process.exit(1); });
