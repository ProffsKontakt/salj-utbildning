# Notställ – konto och molnbibliotek

Notställ fungerar helt utan konto (allt ligger då i webbläsarens databas på enheten).
Med ett konto sparas biblioteket i molnet och följer med till alla enheter där du loggar
in. Du väljer själv vilka stycken som ska laddas ner för offline-bruk.

## Hur det fungerar

| Del | Var |
| --- | --- |
| Konton, inloggning | Supabase Auth, projekt **Notställ** (`jzwimqddhjzpmnuyoyhv`, region eu-north-1) |
| Metadata: stycken, sidordning, anteckningar, projekt, setlistor | Postgres-tabeller `scores`, `annotations`, `projects`, `project_scores` (row level security: varje användare ser bara sina rader) |
| PDF-filer och tumnaglar | Storage-bucket `scores`, privat, sökväg `<user_id>/<score_id>.pdf` och `.thumb.jpg` |
| Klientkod | `src/lib/sync/` (engine, Supabase-klient, fejkat moln för tester), `src/components/account/`, `src/pages/Account.jsx` |

**Synkmodell.** Alla lokala skrivningar sätter `dirty = 1`; borttagningar av rader som
tillhör ett konto lämnar en *tombstone*. Motorn (`engine.js`) kör vid inloggning, när
enheten går online, när fliken blir synlig, en minut efter senaste körning och 1,5 s
efter varje lokal ändring:

1. skickar tombstones som mjuka raderingar (`deleted_at`) och tar bort filer i Storage,
2. laddar upp ändrade rader (PDF och tumnagel först om deras versionsnummer ökat),
3. hämtar allt som ändrats sedan förra körningen (`synced_at`, serverklocka, med 5 s
   överlapp) och tillämpar det med *last-write-wins* per rad enligt klientens `updatedAt`,
4. hämtar saknade tumnaglar och uppdaterar nedladdade PDF:er som ändrats på en annan enhet.

**Offline.** Ett stycke är nedladdat när dess PDF finns i tabellen `files` på enheten.
Stycken som bara finns i molnet visas med en molnikon i biblioteket och laddas ner
när de öppnas online (inställningen »Ladda ner automatiskt«), via kortmenyn, via
»Ladda ner alla« i ett projekt eller »Ladda ner allt« på kontosidan. Ändringar som görs
offline köas och laddas upp nästa gång enheten är online.

**Utloggning** tar bort kontots noter från enheten (kan stängas av i dialogen). Rader
som skapats innan inloggning erbjuds att laddas upp vid första inloggningen.

## Aktivera inloggningssätt (görs i Supabase-panelen)

Öppna https://supabase.com/dashboard/project/jzwimqddhjzpmnuyoyhv

### 1. Grundinställningar (obligatoriskt)

Authentication → URL Configuration:

- **Site URL**: din produktionsadress, t.ex. `https://utbildning.proffskontakt.se`
- **Redirect URLs**: lägg till `https://utbildning.proffskontakt.se/konto`,
  `https://*-julian-nordgrens-projects.vercel.app/konto` (förhandsvisningar) och
  `http://localhost:5173/konto` (utveckling).

### 2. Google (rekommenderat)

1. Gå till https://console.cloud.google.com → APIs & Services → Credentials →
   **Create credentials → OAuth client ID**, typ *Web application*.
2. Authorized JavaScript origins: din produktionsadress (och `http://localhost:5173`).
3. Authorized redirect URIs: `https://jzwimqddhjzpmnuyoyhv.supabase.co/auth/v1/callback`
4. Kopiera **Client ID** och **Client secret**.
5. I Supabase: Authentication → Providers → **Google** → Enable, klistra in ID och secret,
   spara. (OAuth consent screen måste vara publicerad, annars kan bara testanvändare logga in.)

Knappen »Fortsätt med Google« i appen fungerar därefter direkt.

### 3. E-post + lösenord

Är aktiverat från start. Som standard kräver Supabase att adressen bekräftas via ett
mejl, och det inbyggda mejlutskicket är hårt begränsat (några få per timme) och avsett
för test. Välj ett av följande:

- **Enklast:** Authentication → Providers → Email → stäng av **Confirm email**.
  Konton skapas då direkt utan mejl.
- **Bäst:** Authentication → SMTP Settings → ange egen SMTP (t.ex. Resend, Postmark,
  Brevo). Då fungerar bekräftelse- och återställningsmejl obegränsat.

### 4. Apple (valfritt)

Kräver Apple Developer-konto. Skapa en *Services ID* med Sign in with Apple, ange
`https://jzwimqddhjzpmnuyoyhv.supabase.co/auth/v1/callback` som Return URL, skapa en
nyckel (Sign in with Apple) och fyll i Team ID, Key ID, Services ID och nyckeln under
Authentication → Providers → Apple. Appen har redan stöd (`signInWithApple` i
`cloudSupabase.js`); lägg till en knapp i `LoginCard.jsx` när providern är aktiverad.

## Kostnad och gränser

Projektet kostar 10 USD/mån utöver organisationens plan. Storage-bucketen tillåter
PDF och JPEG upp till 200 MB per fil. Ingenting rensas automatiskt – mjukt raderade
rader ligger kvar med `deleted_at` (kan städas med ett schemalagt jobb senare).

## Tester

`e2e/cloud.spec.js` kör mot ett fejkat moln (`scripts/fakeCloudPlugin.js`, startas
med `NOTSTALL_FAKE_CLOUD=1`) och testar två enheter mot samma konto: uppladdning,
nedladdning vid öppning, anteckningar åt båda håll, borttagning, projekt, offline-kö
och utloggning. Mot det riktiga projektet finns en användare `smoke@notstall.test`
som bara används av det automatiska rökprovet.
