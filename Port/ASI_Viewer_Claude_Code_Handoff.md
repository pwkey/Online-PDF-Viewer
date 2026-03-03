# ASI Custom PDF Viewer — Claude Code Project Brief

> **Purpose**: Complete handoff document for continuing development of the ASI Course Notes PDF Viewer in Claude Code. Contains all context, decisions, architecture, working code, integration details, and remaining work.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Business Context](#2-business-context)
3. [Technology Decisions (Final)](#3-technology-decisions-final)
4. [Architecture](#4-architecture)
5. [Current PoC Status](#5-current-poc-status)
6. [Working Code — index.html (PoC)](#6-working-code)
7. [Watermark Engine (Custom, No 3rd Party)](#7-watermark-engine)
8. [Kentico CMS Integration](#8-kentico-cms-integration)
9. [Production File Structure](#9-production-file-structure)
10. [Development Phases](#10-development-phases)
11. [Known Issues & Fixes Applied](#11-known-issues--fixes-applied)
12. [Content Protection Strategy](#12-content-protection-strategy)
13. [PDF Characteristics](#13-pdf-characteristics)
14. [Licensing](#14-licensing)
15. [Key Contacts & Decision Log](#15-key-contacts--decision-log)

---

## 1. Project Overview

**Australian Steel Institute (ASI)** needs a custom PDF viewer to replace their current FlowPaper-based solution for displaying course notes to enrolled students via their online portal.

### What We're Building

A self-contained, vanilla JavaScript PDF flipbook viewer widget that:

- Renders original PDF files client-side (no server-side conversion)
- Provides page-turn animation for a book-like experience
- Applies watermarks **entirely client-side** using credential data from Kentico
- Embeds into ASI's Kentico CMS portal via the same integration pattern as the current FlowPaper widget
- Provides single-page and dual-page spread viewing modes
- Includes scroll mode as an alternative to flipbook mode
- Implements content protection measures (deterrence-level)

### Why We're Replacing FlowPaper

1. **Font rendering failures**: FlowPaper's server-side PDF conversion step corrupts fonts in PowerPoint-exported PDFs, causing garbled text
2. **Unreliable watermarking**: Current watermarking is a separate endpoint that generates an image overlay — ASI wants full ownership of the watermark pipeline with no 3rd party dependency
3. **Limited customisation**: FlowPaper's viewer cannot be deeply customised to ASI's needs
4. **Vendor dependency**: Self-hosted solution eliminates ongoing licensing concerns

---

## 2. Business Context

### ASI's Portal

- **Platform**: Kentico CMS (.NET-based), server-rendered pages (not a SPA)
- **Users**: Engineering professionals enrolled in ASI courses
- **Content**: Technical course notes, typically exported from PowerPoint as PDF
- **Current viewer**: FlowPaper embedded as a standalone HTML/JS widget via iframe or script include
- **Authentication**: Kentico manages user sessions; viewer receives user context from the portal

### Existing Infrastructure

- **Watermark endpoint exists**: `/watermark/?contact={contactid}` — generates a watermark image per user
- **Decision**: We are **NOT** reusing this endpoint for watermarking. Our viewer handles all watermarking client-side. However, we **DO** need Kentico to provide the user credential data (name, email, student ID) to the viewer — this can come from:
  - A Kentico API endpoint that returns JSON credentials using the session cookie
  - JavaScript globals set by Kentico before the viewer script loads
  - URL parameters passed when embedding the viewer

### Tech Consultant

ASI has a tech consultant who manages the Kentico infrastructure. You'll need to coordinate with them on:

- Exact embedding method (iframe vs script include)
- How authentication tokens/session data are passed to the viewer
- How PDFs are served (direct URLs vs proxy endpoint with auth)
- Deployment location within Kentico's file structure

---

## 3. Technology Decisions (Final)

| Component | Choice | License | Why |
|-----------|--------|---------|-----|
| PDF rendering | **PDF.js v3.11.174** | Apache 2.0 | Industry standard, renders original PDFs client-side, no conversion step |
| Page-turn animation | **StPageFlip (page-flip) v2.0.7** | MIT | Lightweight, canvas/HTML-based, good touch support |
| Watermarking | **Custom canvas compositing** | N/A (our code) | Full ownership, no 3rd party dependency, tiled diagonal text |
| Framework | **Vanilla JavaScript** | N/A | Matches Kentico integration pattern, no build step required, no framework overhead |
| Styling | **Plain CSS** | N/A | Self-contained, no preprocessor dependency |

### What We Explicitly Decided Against

- **React/Vue/Angular**: Kentico is server-rendered, not a SPA. Framework overhead adds complexity with no benefit
- **Reusing existing `/watermark/` endpoint**: ASI wants full watermark ownership — no dependency on the image-generating endpoint
- **Server-side PDF conversion**: The root cause of FlowPaper's font problems. PDF.js renders originals directly
- **turn.js**: GPL licensed, would require ASI to open-source their viewer

### Validated

PDF.js was tested against 5 representative ASI course note PDFs (PowerPoint-exported). **All rendered perfectly** — confirming FlowPaper's conversion step was the root cause of font issues.

---

## 4. Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Kentico CMS Page                                       │
│  ┌───────────────────────────────────────────────────┐  │
│  │  <iframe> or <script> embed                       │  │
│  │  ┌─────────────────────────────────────────────┐  │  │
│  │  │  ASI PDF Viewer (self-contained widget)     │  │  │
│  │  │                                             │  │  │
│  │  │  1. Receives user credentials from Kentico  │  │  │
│  │  │  2. Fetches PDF from authenticated endpoint │  │  │
│  │  │  3. PDF.js renders each page to <canvas>    │  │  │
│  │  │  4. Custom watermark composited onto canvas  │  │  │
│  │  │  5. StPageFlip provides flip animation      │  │  │
│  │  │  6. Content protection layers applied       │  │  │
│  │  │                                             │  │  │
│  │  └─────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Data Flow

```
Kentico Session → User Credentials (name, email, studentId)
                         ↓
               ASI PDF Viewer Widget
                         ↓
              PDF.js renders page → Canvas
                         ↓
              applyWatermark() composites credentials onto canvas pixels
                         ↓
              StPageFlip wraps canvases into flipbook UI
```

### Key Principle

The watermark is drawn **directly onto the canvas pixels** after PDF.js renders the page content. This means:

- The watermark cannot be removed via DOM inspection or CSS
- The watermark is "baked into" the visual output
- Print output gets an enhanced watermark (higher opacity + footer bar)
- Canvas-based rendering is harder to extract than DOM-based content

---

## 5. Current PoC Status

### What's Working

- ✅ PDF.js loading and rendering all 39 pages of the sample PDF
- ✅ Custom canvas watermarking (tiled diagonal, name/email/studentId/date)
- ✅ StPageFlip page-turn animation
- ✅ Single-page and dual-page spread toggle
- ✅ Flipbook mode ↔ Scroll mode switching
- ✅ Bottom horizontal thumbnail strip (scrollable)
- ✅ Page navigation (arrows, keyboard, direct input)
- ✅ Zoom in/out/fit
- ✅ Fullscreen toggle
- ✅ Right-click disabled on viewer area
- ✅ Ctrl+S / Ctrl+P interception
- ✅ Responsive layout
- ✅ Status bar with user name and watermark indicator

### What Needs Production Work

- ⬜ Proper PDF.js web worker (currently falls back to main thread — "fake worker" warning)
- ⬜ Kentico credential integration (currently hardcoded `USER_CREDENTIALS` object)
- ⬜ Authenticated PDF fetching (currently loads from embedded base64 or local file)
- ⬜ Print watermark implementation (function exists, needs print stylesheet/handler)
- ⬜ Error handling and loading states for network failures
- ⬜ Text search within PDF
- ⬜ Mobile touch optimisation
- ⬜ Performance optimisation for large PDFs (lazy rendering, page recycling)
- ⬜ ASI branding/theming
- ⬜ Accessibility (keyboard nav exists, needs ARIA labels)
- ⬜ Testing across browsers (Chrome, Firefox, Safari, Edge)

---

## 6. Working Code

The PoC is a single `index.html` file (~1,200 lines) containing all HTML, CSS, and JavaScript. For the production build, this should be split into proper modules.

### PoC File

The current working PoC is `ASI_Viewer_PoC.html`. For Claude Code development, this should be split as described in the Production File Structure section below.

### Critical Implementation Details

**StPageFlip destroy/recreate pattern**: StPageFlip's `destroy()` method removes the container element from the DOM entirely. You cannot reinitialise on the same container. The solution is to:

```javascript
function destroyFlipbook() {
  if (flipBook) {
    try { flipBook.destroy(); } catch(e) {}
    flipBook = null;
  }
  // StPageFlip removes the container from DOM, so recreate it
  let old = document.getElementById('flipbook-container');
  const parent = document.getElementById('viewerArea');
  if (old) old.remove();

  const fresh = document.createElement('div');
  fresh.id = 'flipbook-container';
  const scrollEl = document.getElementById('scrollContainer');
  parent.insertBefore(fresh, scrollEl);
}
```

This pattern must be used for ALL operations that reinitialise the flipbook: mode switching, zoom changes, spread mode changes, resize, sidebar toggle.

**Single vs Dual page mode**: Controlled by StPageFlip's `usePortrait` option:

```javascript
const isSingle = spreadMode === 'single';
new St.PageFlip(container, {
  // ...
  usePortrait: isSingle,  // true = single page, false = dual spread
});
```

In single mode, page dimensions fill the available viewport. In dual mode, each page gets half the width.

---

## 7. Watermark Engine

**This is 100% our code — no 3rd party dependency.** The watermark system has two functions:

### On-Screen Watermark

```javascript
function applyWatermark(canvas, credentials, options = {}) {
  // Default options
  const {
    opacity    = 0.09,      // Subtle but visible
    fontSize   = 14,
    fontFamily = 'Arial, Helvetica, sans-serif',
    color      = '#445566',
    angle      = -25,        // Diagonal tilt (degrees)
    lineGapX   = 380,        // Horizontal tile spacing
    lineGapY   = 140,        // Vertical tile spacing
  } = options;

  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  // Scale font with canvas resolution
  const scale = w / 800;
  const scaledFont = Math.max(10, Math.round(fontSize * scale));

  ctx.save();

  // Watermark text lines
  const line1 = `${credentials.name}  |  ${credentials.email}`;
  const line2 = `Student ID: ${credentials.studentId}  |  ${credentials.timestamp}`;

  ctx.globalAlpha = opacity;
  ctx.font = `500 ${scaledFont}px ${fontFamily}`;
  ctx.fillStyle = color;

  // Rotate and tile across entire canvas
  ctx.translate(w / 2, h / 2);
  ctx.rotate((angle * Math.PI) / 180);

  const diagonal = Math.sqrt(w * w + h * h);
  for (let y = -diagonal; y < diagonal; y += scaledGapY) {
    for (let x = -diagonal; x < diagonal; x += scaledGapX) {
      ctx.fillText(line1, x, y);
      ctx.fillText(line2, x, y + scaledFont * 1.4);
    }
  }

  ctx.restore();
}
```

### Print Watermark (Enhanced)

```javascript
function applyPrintWatermark(canvas, credentials) {
  // Higher opacity tiled watermark
  applyWatermark(canvas, credentials, { opacity: 0.18, showBorder: true });

  // Plus footer credential bar
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const scale = w / 800;
  const barH = 28 * scale;

  ctx.save();
  ctx.globalAlpha = 0.4;
  ctx.fillStyle = '#1a2744';
  ctx.fillRect(0, h - barH, w, barH);

  ctx.globalAlpha = 0.7;
  ctx.fillStyle = '#ffffff';
  ctx.font = `600 ${11 * scale}px Arial, sans-serif`;
  ctx.textBaseline = 'middle';
  const text = `Licensed to: ${credentials.name} (${credentials.email}) — ID: ${credentials.studentId} — Printed: ${new Date().toLocaleString('en-AU')}`;
  ctx.fillText(text, 10 * scale, h - barH / 2);
  ctx.restore();
}
```

### Credential Data Structure

```javascript
const USER_CREDENTIALS = {
  name: 'Jane Smith',
  email: 'jane.smith@example.com',
  studentId: 'ASI-2024-00847',
  timestamp: new Date().toLocaleDateString('en-AU', {
    day: '2-digit', month: 'short', year: 'numeric'
  })
};
```

In production, this object is populated from Kentico session data. See Integration section.

### Future Watermark Enhancements

- **Phase 2**: Kentico endpoint returns user credential *text* (not image) via JSON API, giving full flexibility
- **Invisible/forensic watermarks**: Encode user ID in subtle pixel-level patterns for tracing leaked documents
- **QR code watermark**: Small QR in corner encoding user + timestamp for quick identification

---

## 8. Kentico CMS Integration

### Current FlowPaper Pattern (what we're matching)

FlowPaper is currently embedded as a standalone widget:

```
/viewer/
  index.html          ← Entry point
  flowpaper.js        ← FlowPaper library
  flowpaper.css       ← Styles
```

Kentico embeds this via `<iframe src="/viewer/index.html?pdf=...">` or a `<script>` include. The viewer receives:
- PDF location via URL parameter or config
- User session context from Kentico (for watermarking)

### Our Integration Approach

**Option A — JavaScript globals (simplest)**:

Kentico page sets globals before loading the viewer:

```html
<!-- In Kentico page template -->
<script>
  window.ASI_VIEWER_CONFIG = {
    pdfUrl: '/api/course-pdf/12345?token=abc123',
    user: {
      name: 'Jane Smith',
      email: 'jane.smith@example.com',
      studentId: 'ASI-2024-00847'
    }
  };
</script>
<script src="/viewer/asi-viewer.js"></script>
<div id="asi-viewer-mount"></div>
```

**Option B — URL parameters**:

```html
<iframe src="/viewer/?pdf=/api/course-pdf/12345&contact=67890"></iframe>
```

Viewer reads params, then calls a credential API:

```javascript
const params = new URLSearchParams(window.location.search);
const pdfUrl = params.get('pdf');
const contactId = params.get('contact');

// Fetch credentials from Kentico API
const creds = await fetch(`/api/user-credentials/${contactId}`, {
  credentials: 'include'  // Send session cookie
}).then(r => r.json());
```

**Option C — PostMessage (for iframe isolation)**:

```javascript
// Kentico parent page
const iframe = document.getElementById('viewer-frame');
iframe.contentWindow.postMessage({
  type: 'ASI_VIEWER_INIT',
  pdfUrl: '...',
  credentials: { name: '...', email: '...', studentId: '...' }
}, '*');
```

### Coordinate with Tech Consultant

Questions to resolve:

1. **Which embedding method** does Kentico currently use for FlowPaper? (iframe vs script include)
2. **How are PDFs currently served?** Direct file URLs? Authenticated proxy endpoint?
3. **What session/auth data** is available in the page context? Cookie? Token? User object?
4. **Where should the viewer files be deployed** within Kentico's file structure?
5. **Can we add a new API endpoint** to return user credential JSON? (e.g., `/api/user-credentials/{contactId}`)
6. **CORS considerations** if viewer and API are on different subdomains?

---

## 9. Production File Structure

```
asi-viewer/
├── index.html                  # Entry point (minimal HTML shell)
├── css/
│   └── viewer.css              # All styles
├── js/
│   ├── viewer.js               # Main application controller
│   ├── pdf-renderer.js         # PDF.js loading and page rendering
│   ├── watermark.js            # Watermark engine (applyWatermark, applyPrintWatermark)
│   ├── flipbook.js             # StPageFlip wrapper (init, destroy, mode switching)
│   ├── thumbnails.js           # Thumbnail strip management
│   ├── navigation.js           # Page nav, keyboard shortcuts, zoom
│   ├── content-protection.js   # Right-click, print intercept, copy prevention
│   └── config.js               # Configuration and credential handling
├── lib/
│   ├── pdf.min.js              # PDF.js library (v3.11.174)
│   ├── pdf.worker.min.js       # PDF.js web worker (serve locally!)
│   └── page-flip.browser.js    # StPageFlip library (v2.0.7)
├── assets/
│   └── icons/                  # Any custom icons or branding
├── package.json                # Dependencies for dev tooling
├── README.md                   # Setup and deployment guide
└── tests/
    ├── test-pdfs/              # Sample PDFs for testing
    └── test-runner.html        # Manual test page
```

### Dev Server Setup

For development, use a simple HTTP server (PDF.js needs proper CORS headers):

```bash
# Option 1: Python
python3 -m http.server 8080

# Option 2: Node
npx serve .

# Option 3: Live-reload
npx live-server --port=8080
```

### Build Considerations

For production, consider:
- **Bundling**: Concatenate JS files into a single `asi-viewer.bundle.js` to reduce HTTP requests
- **Minification**: Terser for JS, cssnano for CSS
- **No build step required**: The viewer works without a build tool — just serve the files. Build tools are optional optimisation.

---

## 10. Development Phases

### Phase 1: Core Viewer MVP (Weeks 1–3)

**Goal**: Drop-in FlowPaper replacement with watermarking

- [ ] Split PoC into proper file structure
- [ ] Serve PDF.js worker locally (eliminates "fake worker" warning)
- [ ] Implement Kentico credential loading (config.js)
- [ ] Implement authenticated PDF fetching
- [ ] Proper error handling (network failures, invalid PDFs, missing credentials)
- [ ] Loading states with progress indication
- [ ] Print watermark implementation (beforeprint handler + canvas injection)
- [ ] Cross-browser testing (Chrome, Firefox, Safari, Edge)
- [ ] Basic mobile responsiveness

### Phase 2: Enhanced Features (Weeks 4–6)

- [ ] Text search within PDF (PDF.js `getTextContent()`)
- [ ] Keyboard accessibility and ARIA labels
- [ ] Mobile touch gestures (pinch zoom, swipe)
- [ ] Performance: Lazy page rendering (only render visible + adjacent pages)
- [ ] Performance: Page canvas recycling for memory management
- [ ] Deep linking (URL hash for page number)
- [ ] ASI branding pass (colours, logo, fonts)

### Phase 3: Content Protection Hardening (Weeks 7–8)

- [ ] Custom print handler (generate watermarked print-specific canvases)
- [ ] DevTools detection (basic — resize monitoring)
- [ ] Clipboard interception
- [ ] Screensharing detection (experimental, via `getDisplayMedia` API)
- [ ] Short-lived PDF URLs (server-side token expiry)
- [ ] Session validation (periodic check that user is still authenticated)

### Phase 4: Integration & Deployment (Weeks 9–10)

- [ ] Kentico integration testing with tech consultant
- [ ] Deploy to staging environment
- [ ] Test with real ASI course PDFs (multiple subjects)
- [ ] User acceptance testing with ASI staff
- [ ] Performance benchmarking
- [ ] Documentation for Kentico admin (how to add viewer to course pages)

### Phase 5: Polish & Launch (Weeks 11–12)

- [ ] Bug fixes from UAT
- [ ] Analytics integration (page views, time on page, print events)
- [ ] Fallback behaviour for old browsers
- [ ] Production deployment
- [ ] FlowPaper decommissioning
- [ ] Post-launch monitoring

---

## 11. Known Issues & Fixes Applied

### Issues Fixed During PoC

| Issue | Root Cause | Fix Applied |
|-------|-----------|-------------|
| `St is not defined` | StPageFlip CDN not loading in sandboxed environment | Inlined library directly into HTML |
| `Cannot read properties of null (reading 'parentNode')` | StPageFlip `destroy()` removes container from DOM | `destroyFlipbook()` recreates container via `parent.insertBefore()` |
| `Cannot read properties of null (reading 'style')` | Switching from scroll→flip mode tried to reference destroyed DOM | `destroyFlipbook()` + fresh container creation before `initFlipbook()` |
| Left page clipped in dual mode | Sidebar consumed viewport width | Moved thumbnails to bottom horizontal strip; added single/dual page toggle |
| Toolbar buttons cut off | Fixed-width toolbar with too many items | `overflow-x: auto` on toolbar, `flex-shrink: 0` on groups |

### Benign Warnings (Not Bugs)

| Warning | Explanation | Production Fix |
|---------|-------------|----------------|
| `Setting up fake worker` | PDF.js can't load web worker from CDN cross-origin | Serve `pdf.worker.min.js` locally alongside viewer |
| `TT: undefined function: 32` | Font hinting warning from PowerPoint-exported PDFs | Harmless — doesn't affect rendering. No fix needed. |

---

## 12. Content Protection Strategy

**Important principle**: Browser-based content protection is **deterrence, not prevention**. A determined user with developer tools can always extract content. The goal is to make casual copying difficult and to clearly signal that content is not for redistribution.

### Protection Layers

| Layer | What It Does | Difficulty to Bypass |
|-------|-------------|---------------------|
| **Visible watermark** | User's name/email tiled across every page | High (baked into canvas pixels) |
| **Canvas rendering** | Content rendered to canvas, not DOM text | Medium (can't select text or inspect elements) |
| **Right-click disabled** | `oncontextmenu="return false"` on viewer area | Low (disable in DevTools) |
| **Keyboard shortcuts** | Intercept Ctrl+S, Ctrl+P | Low (use browser menu instead) |
| **Print watermark** | Enhanced watermark on printed output | Medium (requires custom print handler) |
| **Authenticated PDF URLs** | Short-lived tokens, session validation | High (requires valid session) |
| **No direct PDF link** | PDF served through auth proxy, not static URL | Medium (network tab still shows request) |

### What NOT to Invest Time In

- **DRM/encryption**: Not feasible in browser context
- **Obfuscation**: Provides false sense of security, wastes dev time
- **Screenshot prevention**: Not possible in browsers
- **Aggressive DevTools detection**: Creates cat-and-mouse game, annoys legitimate users

---

## 13. PDF Characteristics

ASI course notes share common characteristics:

- **Source**: Exported from PowerPoint
- **Format**: Standard PDF with embedded fonts
- **Orientation**: Landscape (slide format)
- **Page count**: Tens of pages (typically 20–50), not hundreds
- **Content**: Technical engineering diagrams, tables, equations, images
- **Fonts**: PowerPoint's default embedded fonts work perfectly with PDF.js
- **File size**: ~1–5 MB typical

### Implications for Development

- **Progressive loading not critical**: Documents are small enough to load entirely upfront
- **Page pre-rendering is feasible**: Can render all pages at init without performance issues
- **Landscape orientation**: Bottom thumbnail strip (not sidebar) is the correct UX choice
- **No conversion needed**: PDF.js handles these files natively — this is the core advantage over FlowPaper

---

## 14. Licensing

All dependencies are permissively licensed:

| Library | License | Commercial Use | Redistribution |
|---------|---------|---------------|---------------|
| PDF.js | Apache 2.0 | ✅ Yes | ✅ With license notice |
| StPageFlip (page-flip) | MIT | ✅ Yes | ✅ With license notice |
| Custom viewer code | ASI proprietary | N/A | ASI owns |

**Action required**: Include license notices for PDF.js and StPageFlip in the deployed viewer (typically a `LICENSES.txt` file or comments in the bundle).

---

## 15. Key Contacts & Decision Log

### Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-02 | Replace FlowPaper with custom viewer | Font rendering failures, watermark limitations, vendor dependency |
| 2026-03-02 | PDF.js + StPageFlip + Canvas watermark | Best combination of rendering quality, animation, and control |
| 2026-03-02 | Vanilla JS, no framework | Matches Kentico integration pattern, no build step required |
| 2026-03-03 | Custom watermarking, NO reuse of existing endpoint | ASI wants full watermark ownership, no 3rd party in the pipeline |
| 2026-03-03 | Bottom thumbnail strip, not sidebar | Landscape PDFs need maximum horizontal space for the viewer |
| 2026-03-03 | Single-page default with dual-page option | Single page fills viewport better; dual spread optional for book feel |
| 2026-03-03 | Port to Claude Code for production development | Need proper file structure, dev server, iterative testing, git versioning |

### Open Questions for Tech Consultant

1. FlowPaper embedding method (iframe vs script include)?
2. PDF serving approach (direct URLs vs authenticated proxy)?
3. Available session/auth data in Kentico page context?
4. Deployment location within Kentico file structure?
5. Can a new `/api/user-credentials/{contactId}` endpoint be created?
6. Any CORS restrictions between viewer and API?

---

## Appendix A: Sample PDF for Testing

The PoC was built and tested using:

**File**: `ASI_Wind_Codes_Webcast_Seminar_-_Part_1_June_2022.pdf`
**Content**: "Updated Australian Wind Codes and their Impact on Steel Structures — Part 1: Changes in AS/NZS 1170.2:2021 — Wind Actions"
**Pages**: 39
**Format**: Landscape PowerPoint export
**Size**: ~3 MB

This PDF is representative of typical ASI course material and should be included in the `tests/test-pdfs/` directory for ongoing development.

---

## Appendix B: Getting Started in Claude Code

```bash
# 1. Create project directory
mkdir asi-viewer && cd asi-viewer
git init

# 2. Install dependencies
npm init -y
npm install --save pdfjs-dist@3.11.174 page-flip@2.0.7

# 3. Copy libraries to lib/ directory
mkdir -p lib
cp node_modules/pdfjs-dist/build/pdf.min.js lib/
cp node_modules/pdfjs-dist/build/pdf.worker.min.js lib/
cp node_modules/page-flip/dist/js/page-flip.browser.js lib/

# 4. Copy the PoC index.html as starting point
# Then begin splitting into the file structure described in Section 9

# 5. Start dev server
npx serve . --port 8080
```

### First Tasks in Claude Code

1. **Split the PoC** into the production file structure (Section 9)
2. **Serve PDF.js worker locally** — copy `pdf.worker.min.js` to `lib/` and point `pdfjsLib.GlobalWorkerOptions.workerSrc` to it
3. **Create config.js** — extract the `USER_CREDENTIALS` and `PDF_URL` into a configuration module that supports all three Kentico integration options
4. **Set up a proper dev page** with the sample PDF loading from a local path (not embedded base64)
5. **Test mode switching** thoroughly — flip→scroll→flip, zoom, spread changes
