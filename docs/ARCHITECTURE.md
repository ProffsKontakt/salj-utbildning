# Notställ – arkitektur

Notställ är en lokal-först PWA för professionella sångare: skanna eller importera noter,
ordna dem i projekt (konserter), annotera direkt på PDF:en och framför från skärmen.

## Stack

| Del | Val |
| --- | --- |
| Bygg / UI | Vite 8, React 19, Tailwind 4 (`@theme`-tokens i `src/index.css`) |
| Routing | react-router-dom 7 (`BrowserRouter`, SPA-rewrite i `vercel.json`) |
| Lagring | Dexie 4 (IndexedDB) + `dexie-react-hooks` (`useLiveQuery`) |
| PDF-rendering | `pdfjs-dist` **legacy-build** (`pdfjs-dist/legacy/build/pdf.mjs`) – moderna builden kräver `Map.prototype.getOrInsertComputed` som saknas i äldre Safari/Chrome |
| PDF-redigering | `pdf-lib` (bilder → PDF, lägg till sidor, export med inbakade anteckningar) |
| Drag & drop | `@dnd-kit/core` + `@dnd-kit/sortable` |
| Offline | `vite-plugin-pwa` (`registerType: 'autoUpdate'`) |
| Backup | `fflate` (zip) |

pdf.js behöver `standard_fonts/`, `cmaps/` och `wasm/` vid körning. De kopieras av
`scripts/copy-pdfjs-assets.mjs` till `public/pdfjs/` (git-ignorerat) före `dev`/`build`.

## Datamodell (`src/db/db.js`)

```
scores        { id, title, composer, voice, key, notes, pageCount,
                pageOrder:number[], rotations:{[srcPage]:0|90|180|270},
                thumb:ArrayBuffer|null, thumbMime, createdAt, updatedAt, lastOpenedAt }
files         { id (= scoreId), data:ArrayBuffer (PDF), mime, size, name }
annotations   { scoreId, pageIndex, strokes:Stroke[], texts:TextNote[], note, updatedAt }
projects      { id, name, date:'YYYY-MM-DD'|'', venue, notes, createdAt, updatedAt }
projectScores { id, projectId, scoreId, position }
settings      { key, value }
```

* **`pageIndex` är alltid källsidans index** (0-baserat i PDF-filen). `pageOrder` är
  visningsordningen och kan sakna sidor (borttagna). `rotations` är extra rotation utöver
  sidans egna `/Rotate`.
* **Stroke** `{ id, tool:'pen'|'highlighter', color:'#rrggbb', width:pt, opacity, points:[x0,y0,x1,y1,…] }`
  – punkter i **PDF-användarrymd** (punkter, origo nere till vänster), erhållna via
  `viewport.convertToPdfPoint(cssX, cssY)`. Bredd i PDF-punkter (skärmbredd = width × viewport.scale).
* **TextNote** `{ id, x, y, text, color, size }` – baslinjens vänstra punkt i PDF-användarrymd.
* Filer lagras som `ArrayBuffer` (inte Blob) för maximal Safari-kompatibilitet.

Alla skrivningar går via hjälpfunktionerna i `db.js` (`createScore`, `updateScore`,
`replaceScoreFile`, `deleteScore`, `putAnnotation`, `createProject`, `addScoresToProject`,
`reorderProjectScores`, …). Läsning i komponenter sker med `useLiveQuery` så UI:t uppdateras
automatiskt.

## Koordinater & rendering (`src/lib/pdf.js`, `src/components/PdfPage.jsx`)

* `getPageViewport(page, { scale, rotation })` kombinerar sidans egna rotation med användarens.
* `renderPage(page, canvas, { scale, rotation, dpr })` ritar med device-pixel-ratio, klampad
  så canvasen håller sig under 12 MP och 4096 px per sida (iOS-gräns).
* `<PdfPage doc pageIndex scale rotation onViewport>` renderar en sida och positionerar barn
  (annoteringslagret) absolut över sidan. Elementets CSS-storlek = `viewport.width × height`,
  så pekarkoordinater relativt elementet kan konverteras direkt med `viewport.convertToPdfPoint`.
* Dokument hålls i en referensräknad cache: `usePdfDocument(scoreId, version)`.
  Efter byte av filbytes: `invalidateScoreDocument(scoreId)` och öka `version`.

## Export (`src/lib/pdfEdit.js`)

`buildExportPdf({ srcBytes, pageOrder, rotations, annotations, title })` kopierar sidorna i
visningsordning, sätter rotation och ritar strokes med råa PDF-operatorer i användarrymd
(pdf-lib wrappar befintligt innehåll i `q … Q`, så CTM är ren). Text ritas med Helvetica
(WinAnsi) roterad lika mycket som sidan så den läses rättvänd.

Sparande sker via `saveFile()` i `src/lib/download.js`: Web Share (iOS, endast `files`),
annars `showSaveFilePicker`, annars `<a download>`.

## Plattformsregler

* Kamera: `<input type="file" accept="image/*" capture="environment">` ger **en** bild per gång
  på iOS – loopa. Fil-/bildbiblioteksimport: separat `<input multiple>` utan `capture`.
  Inkludera aldrig `image/heic` i `accept`. Alla bilder omkodas till JPEG via `<img>` → canvas
  (`src/lib/image.js`), vilket också tar hand om EXIF-rotation.
* Ritning: `pointerType === 'pen'` ritar alltid; `touch` ritar bara om inställningen
  `penOnly` är av. Ritytan har `touch-action: none` (klass `.ink-surface`) och icke-passiva
  `touchmove`/`gesturestart`-lyssnare med `preventDefault` medan ett verktyg är aktivt.
* iOS-hemskärmsappen har **egen** IndexedDB, separat från Safari-fliken. Appen visar detta i
  inställningarna och uppmanar till installation innan import.
* `navigator.storage.persist()` anropas vid start (`requestPersistentStorage`).
* Wake lock begärs från en användargest och återbegärs vid `visibilitychange`.

## UI-konventioner

* Språk: svenska i all UI-text.
* Tema: mörk scen. Tokens: `bg-ink-900/850/800/700`, text `text-ivory-50…500`, accent
  `gold-300…600`, destruktivt `velvet-*`/`danger`. Rubriker i `font-display` (Cormorant Garamond).
* Delade komponenter i `src/components/ui/` (`Button`, `IconButton`, `TextField`, `TextArea`,
  `Toggle`, `Dialog`, `ConfirmDialog`, `Menu`, `TopBar`, `EmptyState`, `useToast`).
* Layout: `Shell` ger sidomeny (md+) / bottenflikar (mobil). Fullskärmsvyer (visare,
  sidhanterare, konsertläge) ligger utanför `Shell` och använder `TopBar`.

## Vyer

| Route | Fil | Innehåll |
| --- | --- | --- |
| `/` | `pages/Library.jsx` | Bibliotek: sök, kort med tumnaglar, import (skanna/filer) |
| `/noter/:scoreId` | `pages/ScoreViewer.jsx` | Visare + annotering |
| `/noter/:scoreId/sidor` | `pages/PageManager.jsx` | Ordna om / rotera / ta bort / lägg till sidor |
| `/projekt` | `pages/Projects.jsx` | Konsertprojekt |
| `/projekt/:projectId` | `pages/ProjectDetail.jsx` | Setlista (sorterbar), lägg till stycken |
| `/projekt/:projectId/spela` | `pages/Performance.jsx` | Konsertläge: hela setlistan sida för sida |
| `/installningar` | `pages/Settings.jsx` | Inställningar, lagring, backup, rensa |

## Kommandon

```
npm run dev        # utveckling (kopierar pdf.js-assets först)
npm run build      # produktion → dist/
npm run lint       # eslint
npm run test:e2e   # Playwright (kräver build eller dev-server enligt playwright.config.js)
npm run icons      # regenerera PWA-ikoner från SVG
```
