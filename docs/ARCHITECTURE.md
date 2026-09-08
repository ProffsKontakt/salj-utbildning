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
scores        { id, title, composer, voice, key, notes, pageCount, fileSize,
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

## Koordinater & rendering (`src/lib/pdf.js`, `src/lib/pageCache.js`, `src/components/PdfPage.jsx`)

* **Snabbvisning (sidbildscache).** pdf.js måste avkoda varje skannad sida i JavaScript varje
  gång den visas – 1–3 s per sida på en iPad. Därför rastreras varje sida en gång i bakgrunden
  (`pageCache.js`: prioriterad kö, en sida i taget, pausar medan någon ritar) till en JPEG
  med längsta sida 2600 px plus en 480 px-tumnagel, och lagras i `pageImages` (metadata +
  tumnagel) / `pageImageBlobs` (bytes). Visaren och konsertläget visar bilden som `<img>`
  (hårdvaruavkodad, omedelbar) och öppnar PDF:en bara när en sida saknar bild eller när
  man zoomar förbi bildens upplösning (skärpe-overlay). Cachen är enhetslokal, synkas och
  exporteras aldrig, rensas när filbytes byts (sidhanterare, ny nedladdning) eller stycket
  lämnar enheten, och byggs om vid appstart (`warmPageCache`) om något saknas. Rotation
  ändrar inte bilden – den vrids med CSS.
* `src/lib/viewport.js` bygger en pdf.js-kompatibel `PageViewport` från sidans `viewBox`,
  `userUnit` och rotation (sparas med varje sidbild), så geometri och annoteringskoordinater
  fungerar utan ett öppnat dokument. Transformen är identisk med pdf.js.
* `getPageViewport(page, { scale, rotation })` kombinerar sidans egna rotation med användarens.
* `renderPage(page, canvas, { scale, rotation, dpr })` ritar med device-pixel-ratio, klampad
  så canvasen håller sig under 12 MP och 4096 px per sida (iOS-gräns).
* `<PdfPage doc raster pageIndex scale rotation onViewport>` visar sidbilden (eller ritar med
  pdf.js) och positionerar barn (annoteringslagret) absolut över sidan. Elementets CSS-storlek
  = `viewport.width × height`, så pekarkoordinater relativt elementet kan konverteras direkt
  med `viewport.convertToPdfPoint`. `data-source` = `image` | `pdf`.
* `ScoreStage` äger dokumentet: `usePdfDocument` anropas bara när den aktuella sidan saknar
  bild eller zoomen är > 1,25. Föregående och nästa sida hålls förrenderade (dolda slots).
* Dokument hålls i en referensräknad cache: `usePdfDocument(scoreId, version)`.
  `invalidateScoreDocument(scoreId)` skickar `pdfEvents` »invalidate« så öppna vyer laddar om.

## Export (`src/lib/pdfEdit.js`)

`buildExportPdf({ srcBytes, pageOrder, rotations, annotations, title })` kopierar sidorna i
visningsordning, sätter rotation och ritar strokes med råa PDF-operatorer i användarrymd
(pdf-lib wrappar befintligt innehåll i `q … Q`, så CTM är ren). Text ritas med Helvetica
(WinAnsi) roterad lika mycket som sidan så den läses rättvänd.

Sparande sker via `saveFile()` i `src/lib/download.js`: Web Share (endast `files`, det som
fungerar på iOS), annars `<a download>`. `showSaveFilePicker` används medvetet inte – det är
Chromium-exklusivt, kräver egen aktivering och hänger headless-körningar (Playwright).

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
* Beständig lagring begärs vid start (`requestPersistentStorage()` i `src/pwa.js`; Safari beviljar
  den heuristiskt, t.ex. för installerade hemskärmsappar) och kan begäras igen via knappen
  »Begär beständig lagring« i inställningarnas lagringskort, som bara visas när
  `navigator.storage.persisted()` är `false`.
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

## Beslut (och varför)

| Beslut | Motivering |
| --- | --- |
| pdf.js **legacy-build** | Den moderna builden använder `Map.prototype.getOrInsertComputed`, `URL.parse`, `Promise.try` m.m. (kräver Safari 26.2+). Legacy-builden polyfillar dem och stödjer iPadOS 18+. |
| En delad `PDFWorker` | Varje `getDocument` utan `worker` startar en egen tråd. Med `worker` överlever tråden `loadingTask.destroy()`. |
| PDF-bytes som `ArrayBuffer` i IndexedDB | Undviker historiska Blob-buggar i Safari; pdf.js behöver ändå bytes. Storlek sparas i `scores.fileSize` så statistik inte läser filerna. |
| Anteckningar i PDF-användarrymd | `viewport.convertToPdfPoint` inkluderar CropBox-offset ⇒ samma koordinater som pdf-lib:s innehållsström. Rotation/zoom påverkar inte lagrade data. |
| Export med råa operatorer | `drawSvgPath` speglar y-axeln och `drawLine` skapar en ExtGState per anrop. Vi bygger `q … Q`-block med en cachad ExtGState per alfa/blandning. |
| Krypterade PDF:er rastreras vid import | pdf-lib kan inte dekryptera – `copyPages` skulle ge oläsliga sidor. pdf.js renderar dem, så vi gör om dem till bild-PDF (`isEncryptedPdf` via `getPermissions()`). |
| Export/backup via Web Share på iOS | `<a download>` fungerar inte i installerade hemskärmsappar. `saveFile()` provar `navigator.share({ files })` → `<a download>` (inget `showSaveFilePicker`, se Export). På iOS rapporteras ett misslyckat share-ark som `'failed'` i stället för att tyst falla tillbaka. |
| Kamera = en bild per tryck | iOS ignorerar `multiple` tillsammans med `capture`. Skanningsvyn loopar i stället. |
| Canvas ≤ 12 MP och ≤ 4096 px/sida | iOS ≤ 17 vägrar större canvas (ritar tomt). `clampDpr` sänker DPR i stället för att krascha. |
| `virtual:pwa-register` + uppskjuten reload | Ny version laddas om direkt i biblioteket men aldrig mitt i en konsert. `vite:preloadError` ⇒ reload (gamla chunkar 404:ar efter deploy). |
| dnd-kit `PointerSensor` med `distance: 6` på ett handtag med `touch-action: none` | Låter listan scrolla med fingret samtidigt som handtaget drar. Svenska skärmläsartexter i `dndA11y.js`. |
| Hemskärmsapp ≠ Safari-flik | iOS ger dem separata IndexedDB. Appen uppmanar till installation innan import och erbjuder backup. |
| Förrenderade sidbilder i stället för live-pdf.js | Safari saknar hårdvaruväg för pdf.js: en skannad sida kostar 1–3 s JS-avkodning per visning. En JPEG per sida gör bläddring till ett `<img>`-byte; pdf.js finns kvar som reserv och skärpe-overlay vid zoom. |
| Ingen bakgrundssynk | Push först 5 s efter en ändring, hämtning bara på begäran, allt pausat på scenen. Varje synk-omgång läste två hela tabeller och triggade omritning av alla vyer – på scenen märktes det som hack i pennan. |

## Ritning (`src/components/viewer/AnnotationLayer.jsx`, `src/lib/penState.js`)

* **Handavvisning.** En touch ignoreras helt medan en penna är på glaset och 700 ms efter
  att den lyfts (`touchBlocked()`), både i ritlagret och i scenens gester; under ett
  pennstreck stoppas alla `touchstart`/`touchmove` på dokumentnivå så handen aldrig
  scrollar, zoomar eller bläddrar. Medan ett verktyg är aktivt bläddrar fingrar aldrig
  (varken tryck eller svep) – de får bara panorera och nypa.
* **Endast penna** slås på automatiskt första gången en penna ritar (`onPenSeen`), tills
  användaren själv väljer (`penOnlyChosen`).
* **Tryckkänslig penna.** Pennstreck sparar `pressures` (ett värde per punkt, EMA-utjämnat)
  och ritas som en fylld kontur med variabel bredd (0,55–1,45 × vald bredd). Överstrykning
  har fast bredd. Strecks utan `pressures` (finger, mus, äldre data) ritas som förut.
  Webbläsarens förutsagda punkter (`getPredictedEvents`) ritas bara på live-canvasen.
* **Inga tappade streck.** Ändringar som görs innan sidans anteckningspost hunnit laddas köas
  i redigeraren och tillämpas när laddningen landar.

## Tester

`e2e/` innehåller Playwright-tester som kör mot dev-servern (för att kunna läsa IndexedDB via
appens moduler) och ett rökprov mot produktionsbygget (`vite preview`). Test-id:n
(`data-testid`) är en del av UI-kontraktet – ta inte bort dem.

## Konto och molnsynk

Se `docs/CLOUD.md` för uppsättning och synkmodell. Kort: `src/lib/sync/engine.js` pushar
`dirty`-rader och tombstones, pullar sedan förändringar sedan senaste `synced_at`, med
last-write-wins per rad. `SyncProvider` (kontext `useSync()`) äger inloggningsstatus och
motorn; `AdoptLocalDialog` erbjuder uppladdning av lokala noter vid första inloggningen.
Lokalt schema v3 lägger till `ownerId`, `dirty`, fil-/tumnagelversioner och tabellen
`tombstones`; v4 lägger till cachetabellerna `pageImages`/`pageImageBlobs`. En `files`-rad
betyder »nedladdad«; utan den är stycket bara i molnet. Synken körs bara som push efter
lokala ändringar och som full synk vid inloggning/appstart/»Synka nu« – se `docs/CLOUD.md`.
