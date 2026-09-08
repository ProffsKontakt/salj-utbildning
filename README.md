# Notställ

Nothantering för professionella sångare – en lokal-först webbapp (PWA) som fungerar offline
på iPad, iPhone, Android och dator.

- **Skanna eller importera** noter (kamera, bilder, PDF). Bilder blir automatiskt PDF.
- **Projekt** för varje konsert med sorterbar setlista och ett **konsertläge** som bläddrar
  genom alla stycken sida för sida – sidorna är förrenderade så varje bläddring är omedelbar.
- **Annotera** direkt på noterna: tryckkänslig penna (Apple Pencil), överstrykning, radera,
  textanteckningar, sidanteckningar. Handen på skärmen ignoreras medan pennan ritar.
  Anteckningarna följer med vid zoom och rotation och bakas in vid export.
- **Ordna sidor**: dra och släpp, rotera, göm och återställ sidor, lägg till fler sidor.
- **Exportera** PDF (med eller utan anteckningar) och **säkerhetskopiera** hela biblioteket.

Allt lagras lokalt i webbläsaren (IndexedDB). Ingen inloggning, ingen server.

## Utveckling

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # produktion → dist/
npm run lint
npm run test:e2e   # Playwright (Chromium)
```

Se `docs/ARCHITECTURE.md` för arkitektur, datamodell och plattformsbeslut.

## Driftsättning

Projektet är en statisk Vite-app. På Vercel: koppla repot, build command `npm run build`,
output `dist`. `vercel.json` innehåller SPA-rewrite och cache-headers för service workern.
