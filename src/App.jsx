import { useState, useEffect, useRef } from "react";
import { Phone, Brain, Shield, Target, Zap, User, Users, TrendingUp, BookOpen, ChevronRight, ChevronLeft, CheckCircle, AlertTriangle, Clock, Award, Star, ArrowRight, MessageCircle, Eye, Heart, Lightbulb, BarChart3, Settings, Home, LogOut, Calendar, FileText, Play, RotateCcw, Lock, Send, Bot, Battery, Hash, Trophy, Flame } from "lucide-react";

// ═══════════════════════════════════════════════════════════════
// PROFFSKONTAKT SÄLJTRÄNING — KOMPLETT PLATTFORM
// Premium light design • Claude AI integration • Full DISC system
// ═══════════════════════════════════════════════════════════════

const DISC_COLORS = { R: "#DC2626", Y: "#EA580C", Gr: "#059669", B: "#0369A1" };
const DISC_NAMES = { R: "Röd (Dominant)", Y: "Gul (Influencer)", Gr: "Grön (Stabil)", B: "Blå (Analytisk)" };
const DISC_SHORT = { R: "Röd", Y: "Gul", Gr: "Grön", B: "Blå" };

// ═══════════════════════════════════════════════════════════════
// SUPABASE CONFIG
// ═══════════════════════════════════════════════════════════════
const SUPABASE_URL = "https://torchccweanjulnaagqu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRvcmNoY2N3ZWFuanVsbmFhZ3F1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0OTQwMjksImV4cCI6MjA4NTA3MDAyOX0.qdO5vlySjkmbRq_fw9K3k-RzXU2OnSNmED4eWhyAnQs";
const LEADS_SUPABASE_URL = "https://unjrgwyvfjrmbntcosdc.supabase.co";
const LEADS_SUPABASE_ANON_KEY = "PLACEHOLDER_NEEDS_REAL_KEY";

const supabase = {
  from: (table) => ({
    select: (cols = "*") => ({
      eq: (col, val) => ({
        single: () => fetch(`${SUPABASE_URL}/rest/v1/${table}?select=${cols}&${col}=eq.${val}&limit=1`, {
          headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
        }).then(r => r.json()).then(d => ({ data: d?.[0] || null })),
      }),
      then: (fn) => fetch(`${SUPABASE_URL}/rest/v1/${table}?select=${cols}`, {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
      }).then(r => r.json()).then(d => fn({ data: d }))
    }),
    insert: (rows) => fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(Array.isArray(rows) ? rows : [rows])
    }).then(r => r.json()).then(d => ({ data: d })),
  })
};

async function callEdgeFunction(name, body) {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      body: JSON.stringify(body)
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) { return null; }
}

async function saveSalespersonToSupabase(profile) {
  try {
    const row = { name: profile.name, pin: profile.pin, disc_type: profile.discType, disc_secondary: profile.secondaryType || null, disc_scores: profile.aspectScores || {}, disc_answers: profile.answers || [], avatar_color: DISC_COLORS[profile.discType] || "#0369A1" };
    const { data } = await supabase.from("salespeople").insert(row);
    if (data && data[0]) return data[0].id;
  } catch (e) { console.warn("Save failed:", e); }
  return null;
}

// ═══════════════════════════════════════════════════════════════
// DISC PROFILES — FULL DATA
// ═══════════════════════════════════════════════════════════════
const DISC_PROFILES_FULL = {
  R: {
    name: "RÖD", archetype: "The Dominator", color: "#DC2626",
    oneLiner: "Du är en closer. Du driver, du pressar, du vinner. Men din styrka är också din blindspot.",
    superpowers: ["Du stänger snabbt. Du tvekar inte att gå på avslut.", "Du hanterar kundrejektion utan att det påverkar dig.", "Du kör hårda förhandlingar och backar inte från högt pris.", "Röda och blåa kunder respekterar dig direkt."],
    blindspots: ["Du kör över gröna och blåa kunder.", "Du lyssnar dåligt — du har redan bestämt svaret.", "Du avbryter kunder. Ofta. Utan att märka det.", "Du tappar deals på grund av för mycket push."],
    biggestTrap: "Att pusha för hårt på fel typ av kund. Grön kund säger 'jag vill tänka' — du går hårdare — de stänger ner — dealen är död.",
    mustDoMore: ["LYSSNA. Ställ 3 frågor innan du pitchar.", "Sänk tempot med gröna och blåa.", "Pausa efter en fråga.", "Visa empati."],
    mustDoLess: ["Avbryta kunden.", "Pressa när du känner motstånd.", "Prata om hur bra produkten är.", "Ignorera varningssignaler."],
    matrix: { R: { title: "Till RÖD kund", text: "NATURLIG MATCH. Kör på ditt sätt. Båda vill till avslut. Varning: maktkamp kan uppstå." }, Y: { title: "Till GUL kund", text: "SÄNK TEMPOT, LÄGG TILL VÄRME. 2 min small talk. Skratta. Stäng med social proof, inte ROI." }, Gr: { title: "Till GRÖN kund", text: "KRITISKT LÄGE. Din stil krossar gröna. Tala långsammare, pausa, INTE avbryt. Din instinkt — ignorera." }, B: { title: "Till BLÅ kund", text: "SÄNK TEMPOT, HÖJ PRECISIONEN. Exakta siffror. Aldrig 'ungefär'. Om du inte vet: kolla upp, aldrig bluffa." } },
    calibration: "Jag ska LYSSNA. 3 frågor innan jag pitchar. Tystnad är okej. Kundens tempo styr mitt."
  },
  Y: {
    name: "GUL", archetype: "The Influencer", color: "#EA580C",
    oneLiner: "Du är rummets energi. Men din charm stänger inte deals — det gör strukturen du saknar.",
    superpowers: ["Du bygger rapport inom 30 sekunder.", "Du säljer med entusiasm som smittar.", "Mästare på social proof och storytelling.", "Kunder vill prata med dig igen."],
    blindspots: ["Du pratar för mycket.", "Du går inte på avslut i tid.", "Du hoppar över detaljer blåa kunder behöver.", "Du säljer på känsla och lovar saker du inte kan leverera."],
    biggestTrap: "Att bygga relation utan att stänga. Världens bästa samtal, ingen deal. Charm är inte en close.",
    mustDoMore: ["STRUKTURERA. Följ flödet.", "Gå på avslut senast minut 15-20.", "Ha siffror redo.", "Var KORT med blåa kunder."],
    mustDoLess: ["Prata. Kunden ska prata 70%.", "Hoppa mellan ämnen.", "Lova på känsla.", "Skoja bort svåra frågor."],
    matrix: { R: { title: "Till RÖD kund", text: "SKÄR NER SNACKET. Max 2 min intro, sen siffror. Gå på avslut direkt. Hoppa över rapport." }, Y: { title: "Till GUL kund", text: "NATURLIG MATCH. Risk: ni pratar bort samtalet. Sätt timer: 20 min = avslut oavsett." }, Gr: { title: "Till GRÖN kund", text: "SÄNK ENERGIN. Din energi är för mycket. Tala långsammare, pausa. Trygghet, inte entusiasm." }, B: { title: "Till BLÅ kund", text: "KRITISKT LÄGE. Fakta över feeling. Kalkyl, spec, garanti. Din gul-pitch = 'oseriös säljare' i deras huvud." } },
    calibration: "Jag ska FOKUSERA. Max 20 min till avslut. Specifika frågor, inte stories. Kunden pratar mer än jag."
  },
  Gr: {
    name: "GRÖN", archetype: "The Connector", color: "#059669",
    oneLiner: "Du är säljaren kunder vill ha som vän. Men vänskap stänger inte deals — du gör, om du vågar fråga.",
    superpowers: ["Du bygger djup förtroende. Kunder återkommer i åratal.", "Gröna och oroliga kunder köper av dig.", "Bäst på uppföljning och kundvård.", "Ingen känner sig pressad av dig."],
    blindspots: ["Du går inte på avslut.", "Du tappar deals till konkurrenter som ringde imorse.", "Du är för rädd att pressa.", "Du tappar röda och gula kunder — ditt lugn känns som apati."],
    biggestTrap: "Att vänta. Du ger kunden tid de inte behövde. Medan du är taktfull är nån annan mer direkt.",
    mustDoMore: ["GÅ PÅ AVSLUT. Det är ditt jobb.", "Ge deadlines.", "Var direkt även när det känns obekvämt.", "Följ upp SAMMA DAG."],
    mustDoLess: ["Vänta på kundens initiativ.", "Anpassa tills du är osynlig.", "Ursäkta dig för att du ringer.", "Lägga på utan next step."],
    matrix: { R: { title: "Till RÖD kund", text: "KRITISKT LÄGE. Din stil borrar ihjäl röda. Snabba upp, rakt på sak, INTE mjukt. Din instinkt — ignorera." }, Y: { title: "Till GUL kund", text: "HÖJ ENERGIN. Din stil är för mjuk. Matcha deras energi. Om du är för lugn tänker de du inte är övertygad." }, Gr: { title: "Till GRÖN kund", text: "NATURLIG MATCH. Risk: ingen går på avslut. TVINGA dig själv att fråga." }, B: { title: "Till BLÅ kund", text: "TILLÄGG PRECISION. Mjukheten är okej, men data också. Kalkyl redo. Annars = 'kan inte produkten'." } },
    calibration: "Jag ska GÅ PÅ AVSLUT. Det är mitt jobb. Att inte fråga är respektlöst mot kundens tid."
  },
  B: {
    name: "BLÅ", archetype: "The Analyst", color: "#0369A1",
    oneLiner: "Du är den säljare kunder litar på. Men analys stänger inte deals — beslut gör det.",
    superpowers: ["Teknisk expert. Blåa och röda kunder köper kompetens.", "Exakta kalkyler. Du vinner på fakta.", "Bygger ethos genom djupkunskap.", "Skeptiska kunder blir dina bästa kunder."],
    blindspots: ["Du pratar för tekniskt.", "Du ger för mycket info. Kunden paralyseras.", "Du går inte på avslut förrän ALL data är klar.", "Du analyserar förlorade deals istället för att agera."],
    biggestTrap: "Att paralysera kunden med information. 5 PDF:er, 3 kalkyler. Kunden blir överväldigad, gör inget.",
    mustDoMore: ["FÖRENKLA. Säg färre saker.", "Gå på avslut med 90% data, inte 100%.", "Matcha kundens tempo.", "Storytelling med gula och gröna."],
    mustDoLess: ["Överförklara detaljer.", "Skicka 20-sidiga offerter.", "Vänta tills 'allt är perfekt'.", "Tro att kunden vill ha lika mycket info som du."],
    matrix: { R: { title: "Till RÖD kund", text: "SNABBA UPP. Skär 70% av infon. Ge: ROI, payback, totalbelopp. Rekommendation, inte alternativ." }, Y: { title: "Till GUL kund", text: "KRITISKT LÄGE. Lägg till värme. Börja med rapport. Varva siffror med story. Gul köper personen." }, Gr: { title: "Till GRÖN kund", text: "SÄNK DETALJNIVÅN. Trygghet, inte teknik. Din djupa förklaring — skippa. 'Vi tar hand om allt.'" }, B: { title: "Till BLÅ kund", text: "NATURLIG MATCH. Risk: analys-paralys. Ge deadline. Jobba med att STÄNGA, inte presentera." } },
    calibration: "Jag ska FÖRENKLA. Kunden behöver inte all info. Avslut med 90%. Matcha tempo."
  }
};

const DISC_PROFILES = {
  R: { name: "Röd (Dominant)", short: "Röd", recognize: "Bestämd, kort i svaren, vill ha kontroll. Avbryter. Pratar om resultat och pengar.", drive: "Vinst och kontroll. Vill vinna. Hatar att förlora pengar.", fear: "Att bli lurad. Att förlora pengar. Att inte ha kontroll.", tempo: "SNABBT. Rakt på sak. Max 2 min intro, sen siffror.", say: "\"Det sparar dig [X kr/år] och du får ROI på [Y] år. Bästa systemet. Punkt.\"", avoid: "Vaga löften, 'det beror på', 'du kanske vill tänka på det'", close: "Direkt: \"Ska vi köra? Jag fixar allt.\"", followUp: "Kort SMS med siffror och CTA." },
  Y: { name: "Gul (Influencer)", short: "Gul", recognize: "Pratar mycket, entusiastisk, avviker. Gillar att skoja. Nämner grannar/vänner.", drive: "Social status. Vill vara först. Gillar ny teknik.", fear: "Att missa nåt. Att andra har det bättre. FOMO.", tempo: "ENERGISKT. Matcha energi. Humor, storytelling. Låt dem prata.", say: "\"Tänk dig att du är den första i kvarteret med det här.\"", avoid: "Torra siffror utan story. Att avbryta dem. Att vara för seriös.", close: "Social proof + FOMO: \"Vi har bara [X] tider kvar i april.\"", followUp: "Personligt: \"Kul samtal! Ledig tid nästa vecka. Sugen?\"" },
  Gr: { name: "Grön (Stabil)", short: "Grön", recognize: "Lugn, trevlig, få frågor. Svårt att läsa. Vill inte bråka.", drive: "Trygghet för familjen. Konsensus med partner. Harmoni.", fear: "Att göra fel. Att partnern blir arg. Problem.", tempo: "LUGNT. Ge tid. Forcera inte. Mjuka frågor. Tystnad ok.", say: "\"Vi tar hand om allt. Ni behöver inte tänka. Om nåt krånglar, ring oss.\"", avoid: "Press, deadlines, 'nu eller aldrig'. De stänger ner.", close: "Trygghet: \"Steg för steg. Inget bindande. Känns det okej?\"", followUp: "Omtänksamt: \"Ville höra om ni hunnit prata om det? Ingen stress.\"" },
  B: { name: "Blå (Analytisk)", short: "Blå", recognize: "Detaljerade frågor. Vill ha data. Skeptisk. Metodisk.", drive: "Rätt beslut baserat på fakta. Noggrannhet.", fear: "Att missa detalj. Att data inte stämmer. Irrationellt beslut.", tempo: "METODISKT. Strukturerad. Ha data redo. Skynda inte.", say: "\"Exakt cellkemi, cykellivslängd, garantivillkor. Allt dokumenterat.\"", avoid: "Avrundade siffror, 'ungefär', känsloargument utan data.", close: "Data-close: \"Baserat på siffrorna — ser du anledning att INTE gå vidare?\"", followUp: "Dokumenterat: \"Bifogar spec + ROI-kalkyl. Hunnit gå igenom?\"" },
};

// ═══════════════════════════════════════════════════════════════
// DISC TEST — 50 QUESTIONS (ALL 6 ASPECTS)
// ═══════════════════════════════════════════════════════════════
const DISC_QUESTIONS = [
  { aspect: "WORK", q: "Du får välja mellan två jobb med samma lön. Vilket lockar mer?", options: [{ text: "Det där jag har eget ansvar och sätter mina egna mål", type: "R" }, { text: "Det där jag jobbar i ett kreativt team med mycket folk", type: "Y" }, { text: "Det med tydliga rutiner och schysst arbetsmiljö", type: "Gr" }, { text: "Det där jag får specialisera mig och bli riktigt bra på något", type: "B" }] },
  { aspect: "WORK", q: "Du sitter i ett möte som spårar ur och inget händer. Vad gör du?", options: [{ text: "Tar ordet och styr tillbaka till beslut", type: "R" }, { text: "Försöker lyfta energin med en ny idé eller infallsvinkel", type: "Y" }, { text: "Inväntar att nån annan tar tag i det", type: "Gr" }, { text: "Pekar på att vi avvikit från agendan", type: "B" }] },
  { aspect: "WORK", q: "En kollega levererar halvdåligt arbete som påverkar dig. Hur reagerar du?", options: [{ text: "Säger till direkt — det måste fixas nu", type: "R" }, { text: "Tar det med kollegan över en kaffe, informellt", type: "Y" }, { text: "Fixar det tyst själv för att slippa dålig stämning", type: "Gr" }, { text: "Dokumenterar problemet och tar upp det sakligt", type: "B" }] },
  { aspect: "WORK", q: "Du har en ledig timme på kontoret utan inplanerat. Vad gör du?", options: [{ text: "Ringer prospekts och jagar nya deals", type: "R" }, { text: "Snackar med kollegorna, nätverkar, brainstormar", type: "Y" }, { text: "Går igenom mina uppgifter och ser vad jag kan föra framåt", type: "Gr" }, { text: "Fördjupar mig i produktkunskap eller analyserar data", type: "B" }] },
  { aspect: "WORK", q: "Du blir erbjuden en ny roll som kräver att du lär om helt. Vad tänker du?", options: [{ text: "Spännande utmaning — jag tar den om den leder uppåt", type: "R" }, { text: "Kul med nåt nytt, nya människor, variation", type: "Y" }, { text: "Jag vill veta mer innan — hur påverkar det min vardag?", type: "Gr" }, { text: "Intressant, men jag behöver förstå hela bilden först", type: "B" }] },
  { aspect: "WORK", q: "Chefen frågar vem som vill leda ett nytt projekt. Vad gör du?", options: [{ text: "Räcker upp handen — jag leder gärna", type: "R" }, { text: "Kollar vilka andra som är med och hoppar på om teamet är kul", type: "Y" }, { text: "Bidrar gärna men föredrar att nån annan tar rodret", type: "Gr" }, { text: "Frågar först vad målet och tidsramen är", type: "B" }] },
  { aspect: "WORK", q: "Vad gör dig mest frustrerad en vanlig arbetsdag?", options: [{ text: "Att saker tar för lång tid och ingen fattar beslut", type: "R" }, { text: "Att sitta ensam utan att få bolla med nån", type: "Y" }, { text: "Att planer ändras utan förvarning", type: "Gr" }, { text: "Att folk tar beslut utan tillräckligt underlag", type: "B" }] },
  { aspect: "WORK", q: "Du ska starta dagen. Vad gör du först?", options: [{ text: "Kollar vad som är viktigast och sätter igång direkt", type: "R" }, { text: "Tar en kopp kaffe och pratar med teamet", type: "Y" }, { text: "Går igenom min to-do-lista och börjar med det som ligger närmast", type: "Gr" }, { text: "Prioriterar baserat på deadlines och vad som kräver mest fokus", type: "B" }] },
  { aspect: "WORK", q: "Du hittar ett bättre sätt att göra en uppgift, men det bryter mot rutinen. Vad gör du?", options: [{ text: "Kör det nya sättet — resultat trumfar process", type: "R" }, { text: "Testar det och berättar för alla om det funkar", type: "Y" }, { text: "Kollar med chefen innan jag ändrar nåt", type: "Gr" }, { text: "Analyserar varför det gamla sättet finns innan jag byter", type: "B" }] },
  { aspect: "SALES", q: "Du ringer en kund som inte svarat på tre mail. Vad säger du?", options: [{ text: "Rakt på sak: du förlorar pengar varje dag utan det här", type: "R" }, { text: "Hej! Tänkte på dig — har du hunnit kolla?", type: "Y" }, { text: "Hej, jag ville bara höra om du har några frågor jag kan hjälpa med", type: "Gr" }, { text: "Hej, jag har uppdaterat kalkylen med nya siffror — vill du att jag skickar?", type: "B" }] },
  { aspect: "SALES", q: "Kunden frågar: 'Varför ska jag välja er?' Vad svarar du?", options: [{ text: "Vi levererar resultat, punkt slut. Kolla våra siffror.", type: "R" }, { text: "Vi bryr oss på riktigt — du kommer märka det redan efter första samtalet", type: "Y" }, { text: "Vi tar hand om hela processen så du slipper oroa dig", type: "Gr" }, { text: "Vi har marknadens bästa produkt sett till specifikationer och garanti", type: "B" }] },
  { aspect: "SALES", q: "Du märker att kunden inte lyssnar ordentligt under samtalet. Vad gör du?", options: [{ text: "Ställer en rak fråga som tvingar dem att fokusera", type: "R" }, { text: "Byter vinkel, berättar en historia som fångar intresset", type: "Y" }, { text: "Frågar om det är en bättre tid att prata", type: "Gr" }, { text: "Sammanfattar det viktigaste i tre korta punkter", type: "B" }] },
  { aspect: "SALES", q: "Du har en dag med noll stängda deals. Hur hanterar du kvällen?", options: [{ text: "Frustrerad men laddad — imorgon kör jag dubbelt", type: "R" }, { text: "Ringer en kompis, pratar bort det, byter fokus", type: "Y" }, { text: "Orolig — funderar på vad jag kunde gjort annorlunda", type: "Gr" }, { text: "Går igenom samtalen och identifierar vad som gick snett", type: "B" }] },
  { aspect: "SALES", q: "Kunden säger: 'Grannen fick det billigare.' Vad tänker du?", options: [{ text: "Bra, då vet vi var ribban ligger — vi slår det med bättre produkt", type: "R" }, { text: "Ah, intressant! Vet du vad grannen fick? Vi kan säkert matcha", type: "Y" }, { text: "Det förstår jag. Låt mig visa vad som ingår hos oss", type: "Gr" }, { text: "Vilka specifikationer hade grannens system? Så jämför vi korrekt", type: "B" }] },
  { aspect: "SALES", q: "Du ska förbereda ett säljsamtal imorgon. Hur lägger du tiden?", options: [{ text: "Kort research, kör på känsla — jag läser kunden live", type: "R" }, { text: "Kollar deras sociala medier, hittar gemensamma intressen", type: "Y" }, { text: "Går igenom förra samtalet och förbereder svar på troliga invändningar", type: "Gr" }, { text: "Bygger en kalkyl och samlar all data om deras situation", type: "B" }] },
  { aspect: "SALES", q: "Du har en kund som gillar dig men aldrig tar beslut. Vad gör du?", options: [{ text: "Ger en deadline — erbjudandet gäller till fredag", type: "R" }, { text: "Bjuder på en kaffe och pratar igenom det face-to-face", type: "Y" }, { text: "Frågar vad som håller dem tillbaka och lyssnar noga", type: "Gr" }, { text: "Skickar en sammanfattning med alla svar på deras frågor", type: "B" }] },
  { aspect: "SALES", q: "Mitt i ett samtal märker du att du pitchat fel produkt. Vad gör du?", options: [{ text: "Korrigerar snabbt och pivoterar utan att göra en grej av det", type: "R" }, { text: "Skrattar åt mig själv och säger 'Vet du vad, jag har nåt ännu bättre'", type: "Y" }, { text: "Ber om ursäkt och förklarar att jag vill ge rätt rekommendation", type: "Gr" }, { text: "Pausar, förklarar vad som skiljer produkterna åt och varför den andra passar bättre", type: "B" }] },
  { aspect: "SALES", q: "Du stänger en stor deal. Vad gör du direkt efteråt?", options: [{ text: "Ringer nästa prospekt — momentumet ska utnyttjas", type: "R" }, { text: "Firar med teamet och berättar hur det gick", type: "Y" }, { text: "Skickar ett tack-meddelande till kunden och dokumenterar", type: "Gr" }, { text: "Går igenom vad som funkade för att replikera det", type: "B" }] },
  { aspect: "STRESS", q: "Datorn kraschar och du förlorar en timmes arbete. Vad gör du?", options: [{ text: "Svär till och gör om det snabbt — ingen tid att sörja", type: "R" }, { text: "Suckar högt, berättar för alla, och börjar om med humor", type: "Y" }, { text: "Blir stressad men börjar tyst göra om det", type: "Gr" }, { text: "Kollar om det finns autosave och lär mig hur jag undviker det i framtiden", type: "B" }] },
  { aspect: "STRESS", q: "Du ska hålla en presentation om 30 minuter och märker ett fel i materialet. Vad gör du?", options: [{ text: "Fixar det snabbt och kör — ingen kommer märka", type: "R" }, { text: "Nämner det och gör det till en grej: 'Ni får live-versionen!'", type: "Y" }, { text: "Blir nervös och försöker fixa det ordentligt innan", type: "Gr" }, { text: "Korrigerar det noggrant — hellre sen än felaktig", type: "B" }] },
  { aspect: "STRESS", q: "Två kollegor bråkar öppet och du sitter mitt emellan. Vad gör du?", options: [{ text: "Bryter in och säger att vi löser det här nu", type: "R" }, { text: "Försöker lätta stämningen med humor", type: "Y" }, { text: "Håller mig utanför men kollar sen att alla mår bra", type: "Gr" }, { text: "Lyssnar på båda och försöker förstå sakfrågan", type: "B" }] },
  { aspect: "STRESS", q: "Du vaknar en söndag och inser att du glömt skicka en viktig offert på fredag. Vad gör du?", options: [{ text: "Skickar den direkt med ett kort 'Här kommer den'", type: "R" }, { text: "Ringer kunden, skämtar lite om helgjobb, skickar", type: "Y" }, { text: "Mår dåligt men skickar den med en ursäkt", type: "Gr" }, { text: "Kollar igenom offerten en extra gång och skickar med en förklaring", type: "B" }] },
  { aspect: "STRESS", q: "Du hamnar i en trafikstockning och kommer bli sen till ett kundmöte. Vad tänker du?", options: [{ text: "Ringer och säger jag är 10 min sen, rakt på sak", type: "R" }, { text: "Ringer, snackar lite, gör det till nåt positivt", type: "Y" }, { text: "Stressar och oroar mig för vad kunden tänker", type: "Gr" }, { text: "Ringer, meddelar exakt tid, och förbereder mig mentalt", type: "B" }] },
  { aspect: "STRESS", q: "Din chef ger dig feedback du inte håller med om. Vad gör du?", options: [{ text: "Säger att jag inte håller med och förklarar varför", type: "R" }, { text: "Tar emot det, men ventilerar sen med en kollega", type: "Y" }, { text: "Nickar och tar till mig det, även om det skaver", type: "Gr" }, { text: "Frågar efter specifika exempel för att kunna utvärdera", type: "B" }] },
  { aspect: "STRESS", q: "Du har jobbat hårt i veckor utan resultat. Hur påverkas du?", options: [{ text: "Irriterad men driven — det ska fan vända", type: "R" }, { text: "Tappar energi men hittar motivation genom att prata med folk", type: "Y" }, { text: "Börjar tvivla på mig själv och ifrågasätter min approach", type: "Gr" }, { text: "Analyserar vad som inte funkar och justerar strategin", type: "B" }] },
  { aspect: "STRESS", q: "En kund ringer och är arg över nåt som inte var ditt fel. Vad gör du?", options: [{ text: "Lyssnar kort, tar ansvar, löser det — inga ursäkter", type: "R" }, { text: "Validerar känslan, lugnar ner, vänder det till nåt positivt", type: "Y" }, { text: "Lyssnar tålmodigt och ber om ursäkt, fixar det", type: "Gr" }, { text: "Reder ut exakt vad som hänt och förklarar steg för steg", type: "B" }] },
  { aspect: "DECIDE", q: "Du ska välja restaurang för kvällen. Hur går det till?", options: [{ text: "Bestämmer snabbt — 'Vi kör dit' — ingen diskussion", type: "R" }, { text: "Frågar vad alla är sugna på och föreslår nåt kul", type: "Y" }, { text: "Går på det som de flesta verkar vilja", type: "Gr" }, { text: "Kollar betyg och meny online innan jag bestämmer", type: "B" }] },
  { aspect: "DECIDE", q: "Du ska köpa ny telefon. Hur gör du?", options: [{ text: "Tar den senaste modellen — behöver inte jämföra", type: "R" }, { text: "Frågar kompisar vad de har och vad de gillar", type: "Y" }, { text: "Kollar vad jag hade innan och tar något liknande", type: "Gr" }, { text: "Läser recensioner, jämför specifikationer, kollar priser", type: "B" }] },
  { aspect: "DECIDE", q: "Du erbjuds biljetter till en gala imorgon kväll. Du har inga planer. Vad gör du?", options: [{ text: "Ja, absolut — spontanitet driver mig", type: "R" }, { text: "Kul! Vem mer kommer? Jag är med!", type: "Y" }, { text: "Hmm, jag hade tänkt ta det lugnt... men kanske", type: "Gr" }, { text: "Vad är det för gala? Jag vill veta mer först", type: "B" }] },
  { aspect: "DECIDE", q: "Din partner vill boka en resa. Hur deltar du i planeringen?", options: [{ text: "Jag bestämmer destination och bokar — klart", type: "R" }, { text: "Älskar att drömma ihop — vi kan åka dit, eller dit!", type: "Y" }, { text: "Jag är med på det mesta, säg vad du vill", type: "Gr" }, { text: "Jag kollar väder, priser, och logistik innan vi bestämmer", type: "B" }] },
  { aspect: "DECIDE", q: "Du ska renovera hemma och har tre offerter. Hur väljer du?", options: [{ text: "Snabbaste leveranstiden — jag vill att det blir klart", type: "R" }, { text: "Den hantverkare jag hade bäst personkemi med", type: "Y" }, { text: "Den som rekommenderas av nån jag litar på", type: "Gr" }, { text: "Den med mest detaljerad offert och bäst pris/kvalitet", type: "B" }] },
  { aspect: "DECIDE", q: "Du har två sätt att lösa ett problem. Ett är snabbt, ett är grundligare. Vad väljer du?", options: [{ text: "Det snabba — fixa nu, optimera sen", type: "R" }, { text: "Beror på vem som påverkas — jag kollar med dem", type: "Y" }, { text: "Det grundligare — vill inte behöva göra om det", type: "Gr" }, { text: "Det grundligare — men jag vill förstå varför det är bättre först", type: "B" }] },
  { aspect: "DECIDE", q: "En kompis frågar dig om råd i ett viktigt beslut. Hur ger du råd?", options: [{ text: "Rak feedback — 'Gör så här, det är bäst'", type: "R" }, { text: "Pratar igenom det, delar egna erfarenheter, peppar", type: "Y" }, { text: "Lyssnar noga och bekräftar vad de själva tänker", type: "Gr" }, { text: "Ställer frågor och hjälper dem väga för- och nackdelar", type: "B" }] },
  { aspect: "DECIDE", q: "Du ser en möjlighet som kan ge bra resultat men innebär risk. Vad gör du?", options: [{ text: "Kör — risk är en del av spelet", type: "R" }, { text: "Kollar om nån vill vara med och testar tillsammans", type: "Y" }, { text: "Funderar ett tag — vill inte förhasta mig", type: "Gr" }, { text: "Räknar på det: vad är worst case vs best case?", type: "B" }] },
  { aspect: "CONFLICT", q: "Du är på middag med vänner och nån säger nåt du tycker är helt fel. Vad gör du?", options: [{ text: "Säger emot direkt — fakta är fakta", type: "R" }, { text: "Gör en skämtsam kommentar som utmanar utan att det blir tungt", type: "Y" }, { text: "Låter det passera — det är inte värt en diskussion nu", type: "Gr" }, { text: "Frågar hur de menar och lägger fram min syn sakligt", type: "B" }] },
  { aspect: "CONFLICT", q: "En kund klagar offentligt om er på sociala medier. Hur reagerar du?", options: [{ text: "Svarar direkt, rakt — vi tar ansvar och fixar det", type: "R" }, { text: "Svarar personligt och varmt, bjuder in till dialog", type: "Y" }, { text: "Vill helst inte svara offentligt — tar det privat", type: "Gr" }, { text: "Svarar med fakta och en tydlig förklaring av vad som hänt", type: "B" }] },
  { aspect: "CONFLICT", q: "Du och en kollega har totalt olika åsikt i en viktig fråga. Vad händer?", options: [{ text: "Jag argumenterar för min sak tills vi landar", type: "R" }, { text: "Vi pratar igenom det — oftast hittar vi nåt bra i mitten", type: "Y" }, { text: "Jag ger efter om det inte är superviktigt", type: "Gr" }, { text: "Vi lägger fram fakta och ser vad datan säger", type: "B" }] },
  { aspect: "CONFLICT", q: "Nån tar åt sig äran för nåt du gjort. Vad gör du?", options: [{ text: "Konfronterar dem direkt — det är mitt arbete", type: "R" }, { text: "Nämner det inför gruppen, halvt skämtsamt", type: "Y" }, { text: "Sväljer det men tänker på det länge", type: "Gr" }, { text: "Tar upp det privat och dokumenterar mitt bidrag", type: "B" }] },
  { aspect: "CONFLICT", q: "Du ska ge negativ feedback till nån i teamet. Hur gör du?", options: [{ text: "Rakt ut — 'Det här funkar inte, fixa det'", type: "R" }, { text: "Inleder positivt, tar det svåra, avslutar positivt", type: "Y" }, { text: "Tar det försiktigt och frågar hur de själva tycker det går", type: "Gr" }, { text: "Ger specifika exempel och konkreta förslag på förbättring", type: "B" }] },
  { aspect: "CONFLICT", q: "Du sitter i kö och nån tränger sig förbi dig. Vad gör du?", options: [{ text: "Säger till direkt — 'Ursäkta, kön börjar där bak'", type: "R" }, { text: "Kommenterar nåt halvhögt med den bredvid mig", type: "Y" }, { text: "Suckar inombords men säger inget", type: "Gr" }, { text: "Funderar på om det finns en anledning och noterar", type: "B" }] },
  { aspect: "CONFLICT", q: "Du måste säga nej till nåt du blivit ombedd att göra. Hur gör du?", options: [{ text: "Rakt nej — 'Hinner inte, prioriterar annat'", type: "R" }, { text: "Förklarar varför och föreslår en annan lösning", type: "Y" }, { text: "Svårt att säga nej — försöker hitta ett sätt att hjälpa ändå", type: "Gr" }, { text: "Förklarar logiskt varför det inte funkar just nu", type: "B" }] },
  { aspect: "CONFLICT", q: "Nån avbryter dig mitt i en mening under ett möte. Vad gör du?", options: [{ text: "Avbryter tillbaka — 'Låt mig göra klart'", type: "R" }, { text: "Går med i det nya ämnet, kommer tillbaka sen", type: "Y" }, { text: "Tystnar och väntar på min tur", type: "Gr" }, { text: "Antecknar det jag skulle säga och tar upp det senare", type: "B" }] },
  { aspect: "SOCIAL", q: "Du kommer till en fest där du inte känner nån. Vad gör du?", options: [{ text: "Går rakt fram till nån intressant och presenterar mig", type: "R" }, { text: "Börjar prata med den som är närmast — energin tar mig vidare", type: "Y" }, { text: "Letar efter nån som också verkar ny och pratar försiktigt", type: "Gr" }, { text: "Observerar rummet en stund innan jag väljer vem jag pratar med", type: "B" }] },
  { aspect: "SOCIAL", q: "Din vän berättar om ett problem. Vad gör du instinktivt?", options: [{ text: "Föreslår en lösning direkt", type: "R" }, { text: "Delar en liknande erfarenhet och visar att jag förstår", type: "Y" }, { text: "Lyssnar och visar att jag finns där", type: "Gr" }, { text: "Ställer frågor för att förstå hela bilden", type: "B" }] },
  { aspect: "SOCIAL", q: "Du ska beskriva dig själv i tre ord till nån du nyss träffat. Vad säger du?", options: [{ text: "Målmedveten, snabb, bestämd", type: "R" }, { text: "Social, nyfiken, positiv", type: "Y" }, { text: "Lojal, lugn, omtänksam", type: "Gr" }, { text: "Grundlig, ärlig, eftertänksam", type: "B" }] },
  { aspect: "SOCIAL", q: "Du planerar teamaktivitet för jobbet. Vad föreslår du?", options: [{ text: "Nåt tävlingsinriktat — go-kart, escape room", type: "R" }, { text: "Nåt socialt — AW, middag, bowling", type: "Y" }, { text: "Nåt avslappnat — picknick, promenad, matlagning", type: "Gr" }, { text: "Nåt som alla kan delta i — frågar vad folk vill", type: "B" }] },
  { aspect: "SOCIAL", q: "Hur laddar du batterierna efter en tung vecka?", options: [{ text: "Gör nåt aktivt — träning, projekt, nåt produktivt", type: "R" }, { text: "Umgås med folk — vänner, familj, nåt kul ihop", type: "Y" }, { text: "Tar det lugnt hemma — soffa, film, bara vara", type: "Gr" }, { text: "Gör nåt för mig själv — läser, lär mig nåt, reflekterar", type: "B" }] },
  { aspect: "SOCIAL", q: "Du får ett SMS från en okänd säljare. Vad gör du?", options: [{ text: "Ignorerar eller svarar kort om det verkar relevant", type: "R" }, { text: "Svarar om det verkar intressant — man vet aldrig", type: "Y" }, { text: "Blir lite obekväm och ignorerar", type: "Gr" }, { text: "Kollar upp vem det är och företaget innan jag svarar", type: "B" }] },
  { aspect: "SOCIAL", q: "Du ska introducera dig i en ny grupp. Vad nämner du?", options: [{ text: "Vad jag gör och vad jag åstadkommit", type: "R" }, { text: "Nåt personligt och kul som folk minns", type: "Y" }, { text: "Kort och enkelt — namn, roll, glad att vara här", type: "Gr" }, { text: "Min bakgrund och vad jag kan bidra med", type: "B" }] },
  { aspect: "SOCIAL", q: "Det är fredagskväll och du har inga planer. Vad gör du?", options: [{ text: "Fixar nåt — jag gillar inte att sitta still", type: "R" }, { text: "Ringer runt och ser om nån vill hitta på nåt", type: "Y" }, { text: "Njuter av lugnet — äntligen en kväll utan planer", type: "Gr" }, { text: "Gör nåt jag inte haft tid med under veckan", type: "B" }] },
];

function shuffle(arr) { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// ═══════════════════════════════════════════════════════════════
// DATA: SPIN QUESTIONS (FULL)
// ═══════════════════════════════════════════════════════════════
const SPIN_QUESTIONS = {
  situation: [
    { q: "Berätta lite om ert hus och era solpaneler — hur länge har ni haft dem?", why: "Öppnar mjukt. Får kunden att prata om nåt de äger.", listen: "Systemstorlek, ålder, om de är nöjda." },
    { q: "Vad fick er att skaffa solpaneler från början?", why: "Avslöjar drivkraft: ekonomi, miljö, social.", listen: "Primära motivationen. Använd samma argument." },
    { q: "Hur ser er elräkning ut idag?", why: "Konkret siffra att räkna på.", listen: "Månadskostnad. Ju högre, desto starkare case." },
    { q: "Vet du hur mycket av er solel ni använder vs säljer tillbaka?", why: "De flesta vet inte. Din chans att utbilda.", listen: "Om de vet: räkna med siffror. Om inte: visa gapet." },
    { q: "Har ni elbil, eller planerar ni?", why: "Elbil = massivt batteri-case.", listen: "Ja = guldläge. Nej = andra skäl." },
    { q: "Vilken växelriktare har ni?", why: "Kompatibilitet + installationskostnad.", listen: "Hybrid = billigare. Mikro-inverters = DC krävs." },
    { q: "Har ni rörligt eller fast elavtal?", why: "Påverkar arbitrage-besparingen.", listen: "Rörligt/timpris = starkare arbitrage." },
    { q: "Hur stor är er genomsnittliga månadsförbrukning i kWh?", why: "Kärnan i kalkylen.", listen: "15 000-25 000 kWh/år = typiskt." },
    { q: "Vet du ungefär hur stor andel av elen ni förbrukar dagtid vs kvällstid?", why: "Visar potentialen för batterilagring.", listen: "Hög kvällsförbrukning = starkt case." },
    { q: "Har ni värmepump eller annan stor elförbrukare?", why: "Påverkar dimensionering och besparing.", listen: "VP = större batteri, större besparing." },
  ],
  problem: [
    { q: "Vad händer med er elräkning på vintern?", why: "Exponerar problemet: fullt pris trots sol.", listen: "Frustration eller resignation." },
    { q: "Har du funderat på vad som händer med elpriset framöver?", why: "Skapar framtidsoro. Batteri ger kontroll.", listen: "Oro = bra." },
    { q: "Händer det att strömmen går hos er?", why: "Backup-argumentet. Starkt för familjer.", listen: "Upplevt avbrott = guld." },
    { q: "Känner du att ni får tillräckligt bra betalt för elen ni säljer tillbaka?", why: "Triggar insikt om dålig ersättning.", listen: "'Nej' = öppning." },
    { q: "Stör det dig att elbolaget sätter priset utan att du har nåt val?", why: "Kontroll-argumentet. Starkt för röda.", listen: "Frustration över brist på kontroll." },
    { q: "Har du märkt att din solproduktion inte matchar när ni faktiskt behöver elen?", why: "Timing-problemet = kärnan i batterifallet.", listen: "Medvetenhet om dag/natt-gapet." },
    { q: "Känns det som att era solpaneler levererar det ni förväntade er?", why: "Mjuk ingång till smärtan.", listen: "'Ja men...' = öppning att gräva djupare." },
    { q: "Upplever ni prisspikar under vintern som slår hårt?", why: "Säsongsvariation = akut smärta.", listen: "Konkreta exempel stärker caset." },
  ],
  implication: [
    { q: "Om elpriset fortsätter stiga — vad tror du din elräkning ser ut om 3 år?", why: "Tvingar kunden att tänka framåt.", listen: "Obehag. Det är meningen." },
    { q: "Vet du hur mycket du förlorat i onödiga elkostnader sedan du skaffade solpanelerna?", why: "Sunk cost. Smärtsamt men effektivt.", listen: "'Nej' = räkna åt dem." },
    { q: "Vad innebär det för er familjebudget att förlora [X kr] per år i onödan?", why: "Gör abstrakt förlust personlig.", listen: "Konkreta saker de kunde spenderat på." },
    { q: "Hur påverkar det din solinvesterings ROI att 70% av elen säljs billigt?", why: "Ifrågasätter om investeringen lever upp.", listen: "Insikt att panelerna underpresterar." },
    { q: "Om du räknar 5 år framåt med dagens gap — vad blir totalsumman?", why: "Stora tal skapar urgency.", listen: "Chock-reaktion = du är på rätt väg." },
    { q: "Vad hade ni kunnat göra med de pengarna istället?", why: "Alternativkostnad gör det personligt.", listen: "Semester, renovering, barnens framtid." },
    { q: "Hur länge till vill du subventionera elbolagets vinst med din solel?", why: "Reframe: du betalar DERAS vinst.", listen: "Ilska mot elbolaget = motivation." },
  ],
  needPayoff: [
    { q: "Om du kunde använda ALL din solel själv — hur mycket tror du det sparar?", why: "Kunden säljer lösningen till sig själv.", listen: "Nyfikenhet, intresse." },
    { q: "Hur skulle det kännas att ha en elräkning nära noll, oavsett elpris?", why: "Emotionell payoff. Trygghet + kontroll.", listen: "'Det vore fantastiskt' = closing time." },
    { q: "Tänk om du kunde tjäna pengar på din el medan du sover — intressant?", why: "Nätnytta/aggregering. Överraskningsmoment.", listen: "Nyfikenhet = du har deras uppmärksamhet." },
    { q: "Om det fanns ett sätt att göra din solinvestering 2-3x mer lönsam — vill du veta hur?", why: "Framtidsvisionen. Stark för alla typer.", listen: "Ja = öppen dörr." },
    { q: "Vad skulle det betyda för er att aldrig mer oroa sig för elpriser?", why: "Emotionellt slut-argument.", listen: "Trygghet, kontroll, frihet." },
    { q: "Om batteriet betalar sig självt via besparingen — ser du nån anledning att INTE göra det?", why: "Direkt closing-fråga inbäddad.", listen: "Invändningar = hantera. Inget svar = gå på avslut." },
  ],
};

// ═══════════════════════════════════════════════════════════════
// DATA: OBJECTIONS (FULL 14)
// ═══════════════════════════════════════════════════════════════
const OBJECTIONS = [
  { inv: "Jag måste kolla med min fru/man", kat: "Partner", meaning: "Kunden vågar inte ta beslut ensam.", handling: "\"Det förstår jag helt. De flesta tar det här beslutet tillsammans. Är din partner positiv till att ni sparar pengar?\"", follow: "\"Vad tror du din partner skulle behöva höra för att känna sig trygg?\"" },
  { inv: "Vi bestämmer saker ihop", kat: "Partner", meaning: "Kunden är inte beslutsfattaren.", handling: "\"Absolut, och det tycker jag är bra. Vi bokar ett kort samtal där ni båda är med. Funkar det ikväll eller imorgon?\"", follow: "\"Finns det nåt specifikt du tror att hen kommer undra över?\"" },
  { inv: "Det är för dyrt", kat: "Pris", meaning: "Kunden ser inte värdet relativt kostnaden.", handling: "\"Jag hör dig. Vad betalar du i snitt per månad för el just nu? Med batteri sparar du [Y kr/år].\"", follow: "\"Om du visste att du sparar [Y kr] om året — skulle priset fortfarande kännas för högt?\"" },
  { inv: "Jag har fått billigare offerter", kat: "Pris", meaning: "Jämför äpplen med päron.", handling: "\"Bra att du jämför! Fick du prismatiska celler eller pouch-celler? Billigare = pouch = tappar kapacitet snabbare.\"", follow: "\"Vill du att jag gör en jämförelse så du ser vad du får i båda fallen?\"" },
  { inv: "Jag vill ha fler offerter först", kat: "Pris", meaning: "Kunden är i research-läge.", handling: "\"Smart. Se till att du jämför cellkemi, cykellivslängd, garanti, och service.\"", follow: "\"Vad är viktigast — pris, kvalitet, eller tryggheten?\"" },
  { inv: "Ni är inte lokala", kat: "Trovärdighet", meaning: "Orolig att ingen kommer om nåt går fel.", handling: "\"Vi har installationer i ditt område, servicepartner i [stad]. Garantin gäller oavsett.\"", follow: "\"Vad oroar du dig mest — installationen eller servicen efteråt?\"" },
  { inv: "Vi har andra saker just nu", kat: "Timing", meaning: "Batteriet är inte top-of-mind.", handling: "\"Varje månad utan batteri förlorar du [X kr]. Vi fixar allt — du behöver knappt lyfta ett finger.\"", follow: "\"Om det inte tar mer än 20 min av din tid — värt att titta på siffrorna?\"" },
  { inv: "Batteripriser kommer sjunka", kat: "Timing", meaning: "Tror att vänta = smart.", handling: "\"Priserna har sjunkit historiskt. Men varje månad betalar du fullt pris. Kunder som väntade förlorade 12-15 månaders besparing.\"", follow: "\"Hur mycket betalar du i el per månad? Då räknar vi vad det kostar att vänta.\"" },
  { inv: "Jag vill tänka på det", kat: "Undvikande", meaning: "Inte tillräckligt starka skäl att agera NU.", handling: "\"Absolut. Vad specifikt vill du fundera på? Så ger jag rätt underlag.\"", follow: "\"Om du hade all info just nu — skulle du vilja gå vidare?\"" },
  { inv: "Jag tror inte det lönar sig", kat: "Skepticism", meaning: "Dålig koll på elräkningar.", handling: "\"Okej, vi kollar! Vad betalar du per kWh? Med de siffrorna sparar du [X kr/år]. Payback på [Y] år.\"", follow: "\"Om siffrorna visar payback på [Y] år och sen [X kr/år] i 15 år — intressant?\"" },
  { inv: "Jag har aldrig hört om er", kat: "Trovärdighet", meaning: "Vill veta att du inte är flyby-night.", handling: "\"Vi har gjort [X] installationer i [region]. [Garanti], partner [Y] i branschen [Z] år.\"", follow: "\"Vad gör att du känner dig trygg — recensioner, garanti, eller prata med nån som har det?\"" },
  { inv: "Vi har ingen plats", kat: "Praktisk", meaning: "Tänker på gamla klumpiga batterier.", handling: "\"Du behöver typ en bokhyllas väggyta. Garage, källare, eller utomhus. Jag skickar mått och bilder.\"", follow: "\"Har du garage eller förråd? Då löser vi det.\"" },
  { inv: "Hur vet jag att ni finns om 10 år?", kat: "Trovärdighet", meaning: "Djup risk-oro.", handling: "\"Garantin är försäkrad och gäller oavsett. Batterierna är standardkomponenter — vilken elektriker kan serva dem.\"", follow: "\"Vill du att jag skickar garantivillkoren?\"" },
  { inv: "Jag vill göra egen research först", kat: "Undvikande", meaning: "Vill ha kontroll.", handling: "\"Bra! Jag skickar en guide med vad du ska kolla — cellkemi, cykellivslängd, garanti, kapacitet.\"", follow: "\"Vad vill du ta reda på? Kanske sparar jag dig tid redan nu.\"" },
];

// ═══════════════════════════════════════════════════════════════
// DATA: CLOSING TECHNIQUES (FULL 10)
// ═══════════════════════════════════════════════════════════════
const CLOSES = [
  { name: "Assumptive Close", desc: "Anta att de köper. Fråga aldrig 'vill du köpa?'", example: "\"Bra, då bokar vi hembesök [dag]. Förmiddag eller eftermiddag?\"", signal: "Praktiska frågor om installation", difficulty: "LÄTT", disc: { R: "PRIMÄR", Y: "BRA", Gr: "FÖRSIKTIG", B: "UNDVIK" } },
  { name: "Alternativ-close", desc: "Ge kunden två JA-alternativ, aldrig ja/nej.", example: "\"Nästa vecka eller slutet av månaden — vilken funkar?\"", signal: "Nickar, ställer praktiska frågor", difficulty: "LÄTT", disc: { R: "BRA", Y: "PRIMÄR", Gr: "BRA", B: "BRA" } },
  { name: "Sammanfattnings-close", desc: "Stapla alla fördelar tills det totala värdet är överväldigande.", example: "\"Ni sparar [X kr/år], backup, 15 års garanti, månadskostnad lägre. Hur låter det?\"", signal: "Intresserad men tar inte initiativ", difficulty: "MEDEL", disc: { R: "UNDVIK", Y: "BRA", Gr: "PRIMÄR", B: "BRA" } },
  { name: "Sharp Angle Close", desc: "Kund ställer krav → du löser det → koppling till åtagande.", example: "\"Om jag kan boka er före midsommar — kör vi då?\"", signal: "Kan ni göra X?", difficulty: "MEDEL", disc: { R: "PRIMÄR", Y: "BRA", Gr: "FÖRSIKTIG", B: "BRA" } },
  { name: "Takeaway Close", desc: "Antyda att det kanske inte passar dem. Reversal psychology.", example: "\"Det kanske inte är rätt tidpunkt för er. Inte alla kan just nu.\"", signal: "Intresserad men agerar inte", difficulty: "SVÅR", disc: { R: "PRIMÄR", Y: "STARK", Gr: "UNDVIK", B: "UNDVIK" } },
  { name: "Tystnad-close", desc: "Ställ frågan. Håll käft. Den som pratar först förlorar.", example: "\"Ska vi köra?\" [TYST]", signal: "Kunden tänker men säger inte nej", difficulty: "SVÅR", disc: { R: "EXTREMT EFFEKTIV", Y: "SVÅR", Gr: "BRA", B: "BRA" } },
  { name: "Puppy Dog Close", desc: "Micro-commitment. Testa ett litet steg som leder till köp.", example: "\"Vi gör en gratis beräkning först. Om siffrorna ser bra ut pratar vi vidare.\"", signal: "Vill inte binda sig", difficulty: "LÄTT", disc: { R: "UNDVIK", Y: "BRA", Gr: "PRIMÄR", B: "BRA" } },
  { name: "Urgency Close", desc: "Tidsbegränsning — vänta har en kostnad. Måste vara VERKLIG.", example: "\"Vi har [X] installationstider kvar. Kan inte hålla den här tiden.\"", signal: "Vill ta det efter semestern", difficulty: "MEDEL", disc: { R: "BRA", Y: "PRIMÄR", Gr: "FÖRSIKTIG", B: "SVAG" } },
  { name: "Empati-close", desc: "Validera tveksamheten genuint, reframera beslutet som tryggt.", example: "\"Jag förstår att det känns stort. Du har redan investerat [X kr] i sol.\"", signal: "Det känns stort — rädsla", difficulty: "MEDEL", disc: { R: "UNDVIK", Y: "BRA", Gr: "PRIMÄR", B: "SVAG" } },
  { name: "Kalkyl-close", desc: "Låt siffrorna tala. Presentera kalkylen och stäng.", example: "\"Ni sparar [X kr/år]. Batteriet kostar [Y kr]. Betalt efter [Z] år. Ska vi gå vidare?\"", signal: "Kunden har gett alla siffror", difficulty: "LÄTT", disc: { R: "PRIMÄR", Y: "KOMPLEMENT", Gr: "BRA", B: "PRIMÄR" } },
];

// ═══════════════════════════════════════════════════════════════
// DATA: CALL BLUEPRINTS (3 CALLS)
// ═══════════════════════════════════════════════════════════════
const CALL_BLUEPRINTS = {
  1: { title: "SAMTAL 1 — Etablera allt", subtitle: "Varje punkt ska vara klarerad innan du lägger på.", timing: "20-25 minuter", sections: [
    { name: "1. DISC-identifiering", time: "Min 0-2", goal: "Identifiera persontyp inom 2 minuter.", steps: ["Lyssna på hälsningen (10 sek avslöjar typ)", "Ställ öppen fråga: 'Berätta om era solpaneler'", "Bekräfta läsning — anpassa tempo direkt"] },
    { name: "2. Kvalificering", time: "Min 2-4", goal: "Kan de köpa? Har de mandat?", steps: ["Äger de huset?", "Har de solpaneler?", "Vem bestämmer? (Partner?)", "Timing — aktivt eller bara nyfikna?"] },
    { name: "3. Datainsamling", time: "Min 4-8", goal: "ALL data för exakt kalkyl.", steps: ["Systemstorlek (kW)", "Växelriktare/inverter", "Elförbrukning (kWh/år)", "Egenanvändningsgrad", "Elbil?", "Elavtal (rörligt/fast/timpris?)"] },
    { name: "4. Ekonomisk smärta", time: "Min 8-14", goal: "Kvantifiera vad det KOSTAR att inte ha batteri.", steps: ["5 pengaläckorna", "Räkna LIVE med kundens siffror", "Visa vad de redan förlorat", "Bryt ner till per dag", "Framtidsprojektion 5 + 10 år"] },
    { name: "5. Motivation mapping", time: "Min 14-16", goal: "Ta reda på VARFÖR de skaffade sol.", steps: ["Ekonomi → batteri på ekonomi", "Miljö → grön el dygnet runt", "Kontroll → oberoende av elnätet", "Social → grannarna tar nästa steg"] },
    { name: "6. Next step", time: "Min 18-22", goal: "Inbokat och bekräftat.", steps: ["Boka med datum + tid", "SMS-bekräftelse INNAN du lägger på", "Ge kunden uppgift (fyll i formulär)", "Sammanfatta samtalet i en mening"] },
  ]},
  2: { title: "SAMTAL 2 — Presentera & stäng", subtitle: "ETT jobb: stänga dealen. Max 15-20 minuter.", timing: "15-20 minuter", sections: [
    { name: "1. Förberedelse", time: "Innan samtal", goal: "Vinns eller förloras INNAN du ringer.", steps: ["Gå igenom formulärsvar", "Räkna ut kalkyl med deras siffror", "Välj systemstorlek + produkt", "Planera close-sekvens baserat på DISC"] },
    { name: "2. Öppning", time: "Min 0-2", goal: "Påminn om varför de ska lyssna.", steps: ["Hänvisa till samtal 1", "Bekräfta formulär ifyllt", "Sätt agenda: kalkyl → lösning → next step"] },
    { name: "3. Kalkylpresentation", time: "Min 2-8", goal: "Siffrorna som stänger.", steps: ["Påminn om smärtan (30 sek)", "Presentera besparing — stapla rad för rad", "Visa nettot (KILLER-steget)", "Payback + livstidsbesparing"] },
    { name: "4. Close-sekvens", time: "Min 10-18", goal: "Gå på avslut. Punkt.", steps: ["Steg 1: Assumptive + Tystnad", "Steg 2: Invändning → Sharp Angle", "Steg 3: Sammanfattning + Netto", "Steg 4: Urgency / Takeaway", "Steg 5: Boka samtal 3 med partner"] },
  ]},
  3: { title: "SAMTAL 3 — Partner-samtalet", subtitle: "Partnern har hört kundens version (alltid svagare). SISTA chansen.", timing: "18-20 minuter", sections: [
    { name: "1. Förberedelse", time: "Dagen innan", goal: "Du säljer till TVÅ personer.", steps: ["Ring kunden innan — vad tycker partnern?", "Identifiera partnerns persontyp", "Förbered svar på invändningar", "Gör kunden till din allierade"] },
    { name: "2. Rapport med partner", time: "Min 0-3", goal: "Från 'okänd säljare' till 'kunnig person'.", steps: ["Hälsa på partnern med namn", "Ram: 'Jag är här för att svara på DINA frågor'", "Fråga partnern öppen fråga först"] },
    { name: "3. Mini-pitch", time: "Min 3-8", goal: "Hela caset komprimerat till 5 min.", steps: ["Smärtan (60 sek)", "Redan förlorat (30 sek)", "Lösningen (60 sek)", "Siffrorna (90 sek)", "Social proof (30 sek)"] },
    { name: "4. Close-sekvens", time: "Min 12-18", goal: "EN chans. Låt kunden hjälpa stänga.", steps: ["Kund-endorsed close", "Partnerns fråga = din öppning → Sharp Angle", "Gemensamt beslut + Trygghet", "Om total nej: Lär dig och gå vidare"] },
  ]},
};

// ═══════════════════════════════════════════════════════════════
// DATA: QUIZ QUESTIONS (12)
// ═══════════════════════════════════════════════════════════════
const QUIZ_QUESTIONS = [
  { q: "Kunden säger 'Jag måste kolla med min fru'. Vad gör du?", options: ["Säger 'jag förstår' och lägger på", "Bokar gemensamt samtal direkt", "Skickar offerten på mail", "Sänker priset"], correct: 1, explanation: "Du vill aldrig avsluta utan next step. Boka samtal 3 med partner." },
  { q: "Vilken close-teknik funkar BÄST mot en Röd persontyp?", options: ["Empati-close", "Puppy Dog Close", "Assumptive Close", "Sammanfattnings-close"], correct: 2, explanation: "Röda respekterar beslutsamhet. Assumptive Close + Kalkyl-close är primära." },
  { q: "Kunden säger 'Det är för dyrt'. Vad gör du FÖRST?", options: ["Sänker priset direkt", "Frågar vad de betalar per månad i el", "Säger att ni har bäst kvalitet", "Erbjuder finansiering direkt"], correct: 1, explanation: "Kvantifiera deras nuvarande kostnad FÖRST." },
  { q: "Vad är den viktigaste sektionen i hela säljprocessen?", options: ["Produktpresentation", "Small talk och rapport", "Ekonomisk smärta — kvantifiera pengaläckor", "Closing-teknik"], correct: 2, explanation: "Utan kvantifierad smärta i kronor har du inget avslut." },
  { q: "En Grön kund verkar intresserad men säger ingenting. Vad gör du?", options: ["Pushar hårdare med urgency", "Ger dem tystnad och tid att tänka", "Avslutar samtalet", "Ber dem prata med partnern"], correct: 1, explanation: "Gröna behöver tid. Forcera inte." },
  { q: "När ska du nämna LF Finans FÖRSTA gången?", options: ["Vid avslut, om de tycker det är dyrt", "Minut 5-8, normalisera tidigt", "Aldrig", "Bara om de frågar"], correct: 1, explanation: "Plantera fröet i minut 5-8. Vid avslut är det desperat." },
  { q: "Hur vet du att kunden har 'Gul' persontyp?", options: ["Kort och otålig", "Detaljerade tekniska frågor", "Pratar mycket, entusiastisk, nämner grannar", "Lugn, trevlig, svårt att läsa"], correct: 2, explanation: "Gula pratar mycket, avviker, gillar att skoja." },
  { q: "Kunden har sagt ja till problemet, ja till lösningen, ja till siffrorna. Vad gör du?", options: ["Frågar om de vill köpa", "Antar att de köper — boka direkt", "Skickar mer info per mail", "Ger dem tid att tänka"], correct: 1, explanation: "Gyllene principen: de har redan köpt." },
  { q: "Vad är skillnaden mellan prismatiska celler och pouch-celler?", options: ["Ingen skillnad", "Prismatiska är billigare men sämre", "Prismatiska håller 6000+ cykler vs 3000", "Pouch-celler är alltid bättre"], correct: 2, explanation: "Prismatiska = 6000+ cykler, 10% tapp. Pouch = 3000, 20% tapp." },
  { q: "Du har försökt 2 closes utan resultat. Vad gör du ALDRIG?", options: ["Provar en tredje teknik", "Bokar samtal 2 med specifik tid", "Säger 'jag hör av mig nästa vecka'", "Ger kunden en uppgift"], correct: 2, explanation: "'Jag hör av mig' = deal dör i 70% av fallen." },
  { q: "Vilken ethos-byggare är starkast?", options: ["Prata skit om konkurrenter", "Lär kunden något nytt (prismatiska vs pouch)", "Överdriv besparingssiffrorna", "Nämn antal installationer"], correct: 1, explanation: "Lär dem skillnaden mellan celltyper. Du = expert." },
  { q: "En Blå kund säger 'Jag vill se all dokumentation först'. Vad gör du?", options: ["Försöker stänga ändå", "Ger dem ALLT — PDF:er, spec, garanti", "Säger att det inte finns", "Minimerar deras oro"], correct: 1, explanation: "Blåa behöver data. Ge dem allt." },
];

const WEEKLY_QUESTIONS = [
  "Hur många samtal ringde du denna vecka?",
  "Hur många av dessa ledde till samtal 2?",
  "Vilken persontyp hade du svårast att hantera? (R/Y/Gr/B)",
  "Vilken invändning kom oftast?",
  "Stängde du minst en deal?",
  "Vad var din största lärdom denna vecka?",
  "Vilken del av samtalet kändes svagast?",
  "Använde du SPIN-frågorna konsekvent?",
  "Gick du på avslut i varje samtal?",
  "Vad ska du göra annorlunda nästa vecka?",
];

// ═══════════════════════════════════════════════════════════════
// AI RESPONSE FUNCTIONS (FULL)
// ═══════════════════════════════════════════════════════════════
function getCoachResponse(question, profile) {
  const q = question.toLowerCase();
  const discType = profile?.discType || "R";
  const fullP = DISC_PROFILES_FULL[discType];
  if (!fullP) return "Jag behöver mer kontext. Kan du omformulera?";
  if (q.includes("avslut") || q.includes("close") || q.includes("stäng")) {
    const tips = { R: "Du är redan bra på avslut — men du pressar ibland FÖR hårt. Prova att vara tyst efter din close-fråga. Tystnad-close + Assumptive Close är dina go-to. Men med gröna kunder: backa och ge dem Puppy Dog Close istället.", Y: "Ditt största problem är att du INTE stänger. Du pratar bort affären. Sätt en timer på 15 min — efter det MÅSTE du gå på avslut. Alternativ-close funkar bra: 'Nästa vecka eller slutet av månaden?'", Gr: "Du måste öva på att gå på avslut VARJE samtal. Det är inte ohövligt — det är ditt jobb. Börja med Empati-close: 'Jag förstår att det känns stort.' Sen Puppy Dog Close.", B: "Du väntar tills du har 100% data. Sluta. 90% räcker. Kalkyl-close är din naturliga styrka — 'Siffrorna visar X, ser du anledning att INTE gå vidare?'" };
    return tips[discType];
  }
  if (q.includes("invändning") || q.includes("nej") || q.includes("motstånd")) {
    return `Som ${fullP.name}: ${fullP.blindspots[0]}. När kunden säger nej, ${discType === "R" ? "vill du pusha hårdare — prova att validera FÖRST: 'Jag förstår det.' Sen fråga varför." : discType === "Y" ? "skojar du bort det — men kunden behöver bli hörd. Pausa, lyssna, ställ en direkt fråga." : discType === "Gr" ? "accepterar du det direkt — men det dödar dealen. Fråga: 'Vad specifikt oroar dig?'" : "analyserar du istället för att hantera det. Reagera direkt: 'Intressant — berätta mer.'"}`;
  }
  if (q.includes("disc") || q.includes("persontyp") || q.includes("identifiera")) {
    return `De första 30 sekunderna avslöjar allt. Kort och rakt = Röd. Pratsam = Gul. Lugn = Grön. Detaljfråga = Blå. Som ${fullP.name} är din svåraste kund ${discType === "R" ? "Gröna (du kör över dem)" : discType === "Y" ? "Blåa (de tycker du är oseriös)" : discType === "Gr" ? "Röda (ditt tempo frustrerar dem)" : "Gula (din precision dödar energin)"}. Anpassa DITT tempo till DERAS.`;
  }
  if (q.includes("spin") || q.includes("fråg")) {
    return `SPIN som ${fullP.name}: ${discType === "R" ? "Du vill hoppa till Need-Payoff direkt. TVINGA dig att köra alla faser." : discType === "Y" ? "Du ställer bra frågor men hoppar mellan dem. Följ ordningen: S→P→I→N." : discType === "Gr" ? "Du är bra på Situation men undviker Problem/Implikation. Kunden BEHÖVER känna smärtan." : "Du gillar Situation (data!) men missar emotionella kraften i Implikation."} Den som ställer frågorna styr samtalet.`;
  }
  if (q.includes("motivation") || q.includes("dålig dag") || q.includes("tappar") || q.includes("orkar")) {
    const tips = { R: "Du drivs av att vinna. Sätt ett micro-mål: 'Jag ska boka ETT samtal 2 idag.' Vinn det. Sen nästa.", Y: "Du drivs av energi från andra. Ring en kollega, prata om en bra deal, sen ring kunden.", Gr: "Påminn dig om varje kund du HJÄLPT — inte siffrorna. Du säljer inte batterier, du räddar familjer pengar.", B: "Lär dig något nytt om produkten. Känslan av att veta mer = motivation." };
    return `${tips[discType]} Och kom ihåg: '${fullP.calibration}'.`;
  }
  if (q.includes("stress") || q.includes("press") || q.includes("nervös")) {
    return `Under press: ${discType === "R" ? "Du kör hårdare — pausa 2 sekunder innan du svarar." : discType === "Y" ? "Var ärlig: 'Jag tar en paus och kommer tillbaka med bättre svar.'" : discType === "Gr" ? "Du drar dig tillbaka. Kommunicera istället: 'Jag vill ge dig rätt svar — ge mig 2 minuter.'" : "Du samlar mer data — acceptera att 80% räcker under press."} Tips: andas in 4 sek, ut 4 sek, 3 gånger.`;
  }
  return `Som ${fullP.name} (${fullP.archetype}): ${fullP.oneLiner} Fokusera på: ${fullP.mustDoMore[0]} Sluta med: ${fullP.mustDoLess[0]}`;
}

function getBatteryResponse(question) {
  const q = question.toLowerCase();
  if (q.includes("eway") || q.includes("e-way") || q.includes("univ")) return "Eway UNIV7600(HP) — vårt huvudbatteri. 7,68 kWh per modul (LFP), stackbart till 64 moduler = max 491 kWh. 50A laddning/urladdning. IP65-klassat. Inbyggt aerosolbrandskydd — unikt i prisklassen. -10°C till +55°C. 71 kg/modul. 10 års garanti. Kompatibel med Solis, Solinteg, SAJ. Betona brandskyddet och stackbarheten.";
  if (q.includes("enershare") || q.includes("battery core")) return "Enershare Battery Core — universalbatteriet. Kompatibelt med: SunGrow, GoodWe, Solis, Deye/Sunsynk, Solinteg, Hoymiles, Afore, Sinexcel. Bredaste kompatibiliteten på marknaden. LFP-celler, modulärt. 'Oavsett vilken växelriktare du har kan vi hitta en lösning.'";
  if (q.includes("solis") && !q.includes("solinteg")) return "Solis S6-EH3P — premiumval. 5-18kW 3-fas. 160% PV-överdimensionering, 98,5% verkningsgrad, IP66, <10ms backup-switch. 4 MPPT, 50A laddning. Marknadsledande globalt med 500+ GW installerad effekt. 'Solis driver fler solanläggningar än något annat märke i världen.'";
  if (q.includes("solinteg") || q.includes("integ-m")) return "Solinteg INTEG-M — 10-20kW 3-fas. 30A PV-ingång, 40A batteriladdning, 7 driftlägen inkl. ToU för spotprisoptimering. WiFi/LAN. Mer prisvärd än Solis — perfekt för priskänsliga kunder med 3-fas.";
  if (q.includes("saj") || q.includes("hs3")) return "SAJ HS3 — all-in-one energilagring. Integrerad hybrid + BMS. Upp till 8 moduler. Färre komponenter = enklare installation. 'SAJ är plug-and-play — en enhet istället för tre.'";
  if (q.includes("växelriktare") || q.includes("inverter") || q.includes("hybrid")) return "Vårt sortiment: SOLIS S6-EH3P (5-18kW) = Premium, 98,5% verkningsgrad, IP66, <10ms backup. SOLINTEG INTEG-M (10-20kW) = Prisvärt, 7 driftlägen, ToU-stöd. SAJ HS3 = All-in-one, integrerad BMS. Alla fungerar med Eway och Enershare.";
  if (q.includes("chargeamps") || q.includes("luna")) return "ChargeAmps Luna — premium-laddare. Upp till 22 kW 3-fas, Type 2, RFID, ISO 15118. 4G+WiFi. Skandinavisk design. 5 års garanti. 'Ladda bilen med din egen solel — Luna styr laddningen automatiskt.'";
  if (q.includes("zaptec") || q.includes("go 2")) return "Zaptec Go 2 — smart laddbox. 22 kW 3-fas, IP54, MID Class B-mätare, 4G+WiFi+BLE. Dynamisk lastbalansering — perfekt för BRF. Zaptec = funktionellt, Luna = premium.";
  if (q.includes("ladda") || q.includes("elbil") || q.includes("laddbox") || q.includes("ev")) return "ChargeAmps Luna: 22kW, premium, RFID, ISO 15118, 5 års garanti. Bäst för villaägare. Zaptec Go 2: 22kW, MID Class B, lastbalansering. Bäst för BRF. Kopplat till sol+batteri = ladda med egen solel. 'Hela kretsloppet.'";
  if (q.includes("sungrow") || q.includes("mätare") || q.includes("dtsu")) return "Sungrow DTSU666-20 smartmätare — 3-fas, 6 CT-ingångar, RS485, Class 1-noggrannhet, lagrar data i 10 år. Kritisk för optimalt system. Utan korrekt mätare tappar kunden 5-15% besparing. 'Mätaren är hjärnan.'";
  if (q.includes("enequi") || q.includes("energistyrning") || q.includes("optimering")) return "Enequi Core — AI-driven energistyrning. Analyserar spotpriser, väderprognos, förbrukningsmönster. Optimerar automatiskt: batteri, elbil, värmepump. Upp till 50% lägre elräkning. 'Som att ha en energikonsult som jobbar 24/7 åt dig.'";
  if (q.includes("system") || q.includes("helhet") || q.includes("komplett")) return "Komplett system: Solpaneler → Eway batteri (7,68-491 kWh) → Hybridväxelriktare (Solis/Solinteg/SAJ) → Sungrow smartmätare → Enequi Core AI-styrning → ChargeAmps/Zaptec laddbox. Resultat: producera, lagra, optimera, använd egen el. 'Det är ett komplett energisystem som betalar tillbaka sig.'";
  if (q.includes("garanti")) return "Eway batteri: 10 år. Solis: 10 år (utökningsbar till 25). Solinteg: 10 år. ChargeAmps: 5 år. Zaptec: 5 år. Batterierna garanteras 80% kapacitet. Nämn garantin PROAKTIVT.";
  if (q.includes("kapacitet") || q.includes("kwh") || q.includes("dimensionering")) return "Eway: 7,68 kWh/modul, stackbart till 64 (491 kWh). Villa: 1-2 moduler. Med elbil: 2-3. Stort hus+pool+elbil: 3-4. Kunden börjar med vad de behöver och bygger ut. Använd kundens förbrukningsdata.";
  if (q.includes("pris") || q.includes("kost") || q.includes("investering")) return "Framea ALDRIG totalpriset först. Börja med besparingen. Typisk villa: 8-15 kkr/år. Med elbil: ytterligare 5-10 kkr. Payback: 5-8 år, sen 10+ år ren vinst. 'Månadskostnaden är ofta LÄGRE än besparingen från dag ett.'";
  if (q.includes("arbitrage") || q.includes("timpris") || q.includes("spotpris")) return "Enequi styr Eway att ladda vid låg spot (30-50 öre) och urladda vid hög (1-2 kr). 15 kWh batteri = ~1350 kr/månad på arbitrage. 'Ditt batteri tjänar pengar åt dig medan du sover.'";
  if (q.includes("installation") || q.includes("montering")) return "Eway IP65 — fungerar utomhus, garage, källare. 71 kg/modul. Typisk installation: 1 dag. SAJ HS3 = enklaste installationen (all-in-one). Alltid certifierad elektriker.";
  if (q.includes("konkurrent") || q.includes("tesla") || q.includes("powerwall")) return "Vs Tesla Powerwall: Eway har LFP (6000+ cykler) vs NMC. Stackbart till 491 kWh vs max 3 enheter. Aerosolbrandskydd. Vår styrka: komplett system — inte bara en box. 'Vi levererar hela lösningen.'";
  if (q.includes("backup") || q.includes("strömavbrott")) return "Solis kopplar om på <10ms. 15 kWh = 8-12 timmar backup. IP65 + brandskydd = trygg drift. 'Om grannen sitter i mörker, du har fortfarande ström.'";
  if (q.includes("lfp") || q.includes("lithium") || q.includes("kemi") || q.includes("prismatisk") || q.includes("cell")) return "LFP (Lithium Iron Phosphate): säkrast, 6000+ cykler, 10% kapacitetstapp. Eway lägger till aerosolbrandskydd. NMC (Tesla): högre densitet men kortare liv + risk. 'Samma kemi som i elbilar — med extra brandskydd.'";
  if (q.includes("kompatib") || q.includes("passar") || q.includes("fungerar med")) return "Eway: Solis, Solinteg, SAJ. Enershare: SunGrow, GoodWe, Solis, Deye, Solinteg, Hoymiles, Afore, Sinexcel. Sungrow-mätare: alla växelriktare. 'Vi anpassar oss efter ditt system.'";
  if (q.includes("wifi") || q.includes("app") || q.includes("monitor")) return "Alla produkter uppkopplade. Solis: WiFi/4G, SolisCloud. Solinteg: WiFi/LAN. SAJ: WiFi, eSAJ. ChargeAmps: 4G+WiFi. Zaptec: 4G+WiFi+BLE. Enequi: samlar ALL data i en dashboard. 'Du ser exakt vad varje krona gör.'";
  return "Jag kan svara om hela sortimentet: Eway, Enershare, Solis, Solinteg, SAJ, ChargeAmps Luna, Zaptec Go 2, Sungrow, Enequi — plus dimensionering, priser, installation, arbitrage, backup, cellkemi, och konkurrenter. Ställ en specifik fråga!";
}

// ═══════════════════════════════════════════════════════════════
// UI COMPONENTS — PREMIUM DESIGN
// ═══════════════════════════════════════════════════════════════
const Card = ({ children, className = "", onClick }) => (
  <div onClick={onClick} className={`bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-all duration-200 ${onClick ? "cursor-pointer" : ""} ${className}`}>{children}</div>
);

const SectionTitle = ({ icon: Icon, title, subtitle }) => (
  <div className="mb-8">
    <div className="flex items-center gap-3 mb-1">
      {Icon && <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center"><Icon size={20} className="text-blue-600" /></div>}
      <h2 className="text-2xl font-bold text-gray-900 tracking-tight">{title}</h2>
    </div>
    {subtitle && <p className="text-gray-500 text-sm ml-[52px]">{subtitle}</p>}
  </div>
);

// ═══════════════════════════════════════════════════════════════
// PIN LOGIN
// ═══════════════════════════════════════════════════════════════
const PinLogin = ({ onLogin, onNewUser }) => {
  const [pin, setPin] = useState(["", "", "", ""]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const pinRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];

  useEffect(() => { const cached = JSON.parse(localStorage.getItem("salj_profile") || "null"); if (cached) onLogin(cached); }, []);

  const handlePinChange = (idx, val) => {
    const newPin = [...pin]; newPin[idx] = val.slice(-1).toUpperCase(); setPin(newPin);
    if (newPin[idx] && idx < 3) pinRefs[idx + 1].current?.focus();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const pinCode = pin.join("");
    if (pinCode.length !== 4) { setError("PIN måste vara 4 siffror"); return; }
    setLoading(true);
    try {
      const { data } = await supabase.from("salespeople").select("*").eq("pin", pinCode).single();
      if (data) {
        const p = data;
        const aspectScores = {};
        if (p.disc_scores && typeof p.disc_scores === "object") {
          Object.entries(p.disc_scores).forEach(([aspect, scores]) => {
            if (scores && typeof scores === "object") {
              const total = (scores.R || 0) + (scores.Y || 0) + (scores.Gr || 0) + (scores.B || 0);
              const entries = Object.entries(scores).sort(([,a],[,b]) => b - a);
              aspectScores[aspect] = { dominant: entries[0]?.[0] || "R", scores, total, percents: { R: total ? ((scores.R||0)/total)*100 : 0, Y: total ? ((scores.Y||0)/total)*100 : 0, Gr: total ? ((scores.Gr||0)/total)*100 : 0, B: total ? ((scores.B||0)/total)*100 : 0 } };
            }
          });
        }
        const profile = { name: p.name, pin: p.pin, discType: p.disc_type, secondaryType: p.disc_secondary, aspectScores, answers: p.disc_answers || [], supabaseId: p.id };
        localStorage.setItem("salj_profile", JSON.stringify(profile));
        onLogin(profile);
      } else { setError("PIN hittas inte"); }
    } catch (e) { setError("Fel vid inloggning"); } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-blue-600/20">
            <Battery size={28} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Säljträning</h1>
          <p className="text-gray-400 text-sm mt-2">Proffskontakt</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-gray-100 p-8 shadow-xl shadow-gray-200/50">
          <label className="block text-sm font-semibold text-gray-900 mb-4">Ange din PIN-kod</label>
          <div className="flex gap-3 justify-center mb-6">
            {pin.map((p, i) => (
              <input key={i} ref={pinRefs[i]} type="text" maxLength="1" value={p} onChange={(e) => handlePinChange(i, e.target.value)}
                className="w-14 h-14 text-center text-2xl font-bold border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-50 focus:outline-none transition-all bg-gray-50" />
            ))}
          </div>
          {error && <div className="text-red-500 text-sm text-center mb-4 font-medium">{error}</div>}
          <button type="submit" disabled={loading} className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:bg-gray-300 transition-all shadow-lg shadow-blue-600/20 mb-3">
            {loading ? "Laddar..." : "Logga in"}
          </button>
          <button type="button" onClick={onNewUser} className="w-full py-3 bg-gray-50 text-gray-700 rounded-xl font-medium hover:bg-gray-100 border border-gray-200 transition-all">
            Ny användare
          </button>
        </form>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// DISC TEST
// ═══════════════════════════════════════════════════════════════
const DiscTest = ({ onComplete }) => {
  const [phase, setPhase] = useState("intro");
  const [name, setName] = useState("");
  const [pin, setPin] = useState(["","","",""]);
  const pinRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState(new Array(DISC_QUESTIONS.length).fill(null));
  const [optionOrder] = useState(() => DISC_QUESTIONS.map(q => shuffle(q.options)));

  const handleAnswer = (type) => {
    const newA = [...answers]; newA[currentQ] = type; setAnswers(newA);
    if (currentQ < DISC_QUESTIONS.length - 1) setCurrentQ(currentQ + 1);
    else finishTest(newA);
  };

  const finishTest = (finalAnswers) => {
    const typeCounts = { R: 0, Y: 0, Gr: 0, B: 0 };
    finalAnswers.forEach(t => { if (t) typeCounts[t]++; });
    const sorted = Object.entries(typeCounts).sort(([,a],[,b]) => b - a);
    const aspectScores = {};
    ["WORK","SALES","STRESS","DECIDE","CONFLICT","SOCIAL"].forEach(aspect => {
      const qs = DISC_QUESTIONS.map((q,i) => ({q,i})).filter(x => x.q.aspect === aspect);
      const counts = { R:0, Y:0, Gr:0, B:0 };
      qs.forEach(({i}) => { if(finalAnswers[i]) counts[finalAnswers[i]]++; });
      const total = Object.values(counts).reduce((a,b)=>a+b,0);
      const dom = Object.entries(counts).sort(([,a],[,b])=>b-a)[0][0];
      aspectScores[aspect] = { dominant: dom, counts, total, percents: { R: total?(counts.R/total)*100:0, Y: total?(counts.Y/total)*100:0, Gr: total?(counts.Gr/total)*100:0, B: total?(counts.B/total)*100:0 } };
    });
    onComplete({ name, pin: pin.join(""), discType: sorted[0][0], secondaryType: sorted[1][0], aspectScores, answers: finalAnswers });
  };

  const handlePinChange = (idx, val) => { const n = [...pin]; n[idx] = val.slice(-1); setPin(n); if(n[idx] && idx < 3) pinRefs[idx+1].current?.focus(); };

  if (phase === "intro") return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">DISC Personlighetstest</h1>
          <p className="text-gray-500 mt-2">{DISC_QUESTIONS.length} frågor — upptäck din försäljarprofil</p>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); if(name.trim()) setPhase("quiz"); }} className="bg-white rounded-3xl border border-gray-100 p-8 shadow-xl shadow-gray-200/50 space-y-5">
          <div><label className="block text-sm font-semibold text-gray-900 mb-2">Namn</label><input type="text" value={name} onChange={e=>setName(e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-50 focus:outline-none bg-gray-50" placeholder="Ditt namn" /></div>
          <div><label className="block text-sm font-semibold text-gray-900 mb-2">PIN-kod</label><div className="flex gap-3">{pin.map((p,i) => <input key={i} ref={pinRefs[i]} type="text" maxLength="1" value={p} onChange={e=>handlePinChange(i,e.target.value)} className="w-14 h-14 text-center text-2xl font-bold border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none bg-gray-50" />)}</div></div>
          <button type="submit" className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20">Starta test</button>
        </form>
      </div>
    </div>
  );

  const q = DISC_QUESTIONS[currentQ];
  const progress = ((currentQ+1)/DISC_QUESTIONS.length)*100;
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 p-6">
      <div className="max-w-2xl mx-auto pt-8">
        <div className="flex justify-between items-center mb-3"><span className="text-sm font-bold text-gray-900">{currentQ+1} / {DISC_QUESTIONS.length}</span><span className="text-sm font-bold text-blue-600">{Math.round(progress)}%</span></div>
        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mb-8"><div className="h-full bg-blue-600 rounded-full transition-all duration-300" style={{width:`${progress}%`}} /></div>
        <Card className="mb-6">
          <p className="text-xs font-semibold text-blue-600 tracking-wide mb-4">{q.aspect}</p>
          <h2 className="text-lg font-semibold text-gray-900 mb-6 leading-relaxed">{q.q}</h2>
          <div className="space-y-3">{(optionOrder[currentQ]||q.options).map((opt,i) => (
            <button key={i} onClick={() => handleAnswer(opt.type)} className="w-full p-4 text-left border-2 border-gray-100 rounded-xl hover:border-blue-300 hover:bg-blue-50/50 transition-all text-gray-900 font-medium">{opt.text}</button>
          ))}</div>
        </Card>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════
const Dashboard = ({ profile, setPage }) => {
  const [quizScores, setQuizScores] = useState([]);
  const [saljScore, setSaljScore] = useState(0);
  const [level, setLevel] = useState("Rookie");

  useEffect(() => { setQuizScores(JSON.parse(localStorage.getItem("salj_quiz_scores") || "[]")); }, []);
  useEffect(() => {
    const avg = quizScores.length > 0 ? quizScores.reduce((a,b) => a + (b.score/b.maxScore*100), 0) / quizScores.length : 0;
    const s = Math.round(avg * 0.4);
    setSaljScore(s);
    setLevel(s < 20 ? "Rookie" : s < 40 ? "Closer" : s < 60 ? "Specialist" : s < 80 ? "Expert" : "Legend");
  }, [quizScores]);

  return (
    <div className="space-y-8">
      <div><h1 className="text-3xl font-bold text-gray-900 tracking-tight">Välkommen, {profile.name}</h1><p className="text-gray-500 mt-1">{DISC_NAMES[profile.discType]}</p></div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {[{ label: "Din typ", value: DISC_SHORT[profile.discType], icon: Award, bg: `${DISC_COLORS[profile.discType]}10`, iconColor: DISC_COLORS[profile.discType] },
          { label: "Nivå", value: level, icon: Trophy, bg: "#FEF3C7", iconColor: "#D97706" },
          { label: "Säljscore", value: `${saljScore}/100`, icon: TrendingUp, bg: "#D1FAE5", iconColor: "#059669" }
        ].map((c,i) => (
          <Card key={i}>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{background: c.bg}}><c.icon size={22} style={{color: c.iconColor}} /></div>
              <div><p className="text-sm text-gray-400">{c.label}</p><p className="text-xl font-bold text-gray-900">{c.value}</p></div>
            </div>
            {c.label === "Säljscore" && <div className="mt-4 w-full bg-gray-100 rounded-full h-2"><div className="bg-emerald-500 h-2 rounded-full transition-all" style={{width:`${saljScore}%`}} /></div>}
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <h3 className="text-lg font-bold text-gray-900 mb-4">Quiz-resultat</h3>
          {quizScores.length > 0 ? <div className="space-y-2">{quizScores.slice(-5).map((q,i) => (
            <div key={i} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl"><span className="text-sm text-gray-700 font-medium">{q.type}</span><span className="text-sm font-bold text-blue-600">{q.score}/{q.maxScore}</span></div>
          ))}</div> : <div className="py-8 text-center"><Brain size={28} className="mx-auto text-gray-200 mb-2" /><p className="text-gray-400 text-sm">Inga quiz ännu</p></div>}
        </Card>
        <Card>
          <h3 className="text-lg font-bold text-gray-900 mb-4">Snabbstart</h3>
          <div className="space-y-2">
            {[{ label: "Quiz", desc: "Testa dina kunskaper", icon: Brain, page: "quiz" }, { label: "SPIN-frågor", desc: "Öva frågeteknik", icon: MessageCircle, page: "spin" }, { label: "Invändningar", desc: "Hantera motstånd", icon: Shield, page: "objections" }, { label: "AI Coach", desc: "Personlig coaching", icon: Bot, page: "coach" }].map((item,i) => (
              <button key={i} onClick={() => setPage(item.page)} className="w-full flex items-center gap-4 p-3 rounded-xl text-left transition-all hover:bg-blue-50 group">
                <div className="w-10 h-10 rounded-lg bg-gray-50 group-hover:bg-blue-100 flex items-center justify-center transition-all"><item.icon size={18} className="text-gray-400 group-hover:text-blue-600 transition-all" /></div>
                <div className="flex-1"><p className="text-sm font-semibold text-gray-900">{item.label}</p><p className="text-xs text-gray-400">{item.desc}</p></div>
                <ChevronRight size={16} className="text-gray-200 group-hover:text-blue-400" />
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// AI COACH — Uses Edge Function (Claude API)
// ═══════════════════════════════════════════════════════════════
const AiCoach = ({ profile }) => {
  const [messages, setMessages] = useState([{ role: "assistant", text: `Hej ${profile?.name}! Jag är din personliga AI-säljcoach. Jag vet att du är ${DISC_PROFILES_FULL[profile?.discType]?.name || "unik"} och har tillgång till allt utbildningsmaterial. Fråga mig om avslutstekniker, invändningar, SPIN, persontyper, motivation, eller stress.` }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMessage = input.trim(); setInput(""); setMessages(prev => [...prev, { role: "user", text: userMessage }]); setLoading(true);
    const salespersonId = profile?.supabaseId;
    if (salespersonId) {
      const result = await callEdgeFunction("ai-coach", { question: userMessage, salesperson_id: salespersonId });
      if (result?.message) { setMessages(prev => [...prev, { role: "assistant", text: result.message }]); setLoading(false); return; }
    }
    const response = getCoachResponse(userMessage, profile);
    setMessages(prev => [...prev, { role: "assistant", text: response }]); setLoading(false);
  };

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 100px)" }}>
      <div className="mb-5"><h2 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center"><Bot size={20} className="text-blue-600" /></div>AI Säljcoach</h2><p className="text-sm text-gray-400 mt-1 ml-[52px]">Personlig coaching med Claude AI</p></div>
      <div className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[70%] px-5 py-3.5 text-sm leading-relaxed whitespace-pre-wrap ${msg.role === "user" ? "bg-blue-600 text-white rounded-2xl rounded-br-lg" : "bg-gray-50 text-gray-800 rounded-2xl rounded-bl-lg border border-gray-100"}`}>{msg.text}</div>
            </div>
          ))}
          {loading && <div className="flex justify-start"><div className="px-5 py-3.5 bg-gray-50 rounded-2xl rounded-bl-lg border border-gray-100 text-sm text-gray-400">Coachen tänker...</div></div>}
          <div ref={endRef} />
        </div>
        <div className="p-4 border-t border-gray-50">
          <div className="flex gap-3">
            <input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSend()} placeholder="Ställ en fråga..." className="flex-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-50 focus:outline-none text-sm" />
            <button onClick={handleSend} disabled={loading} className="px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:bg-gray-200 transition-all shadow-sm"><Send size={18} /></button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// AI BATTERIEXPERT — Uses Edge Function (Claude API)
// ═══════════════════════════════════════════════════════════════
const AiBatteryExpert = ({ profile }) => {
  const [messages, setMessages] = useState([{ role: "assistant", text: "Hej! Jag är din AI-produktexpert för hela Proffskontakts sortiment — Eway-batterier, Enershare, växelriktare (Solis, Solinteg, SAJ), laddboxar (ChargeAmps, Zaptec), Sungrow smartmätare, och Enequi energistyrning. Fråga mig vad som helst!" }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMessage = input.trim(); setInput(""); setMessages(prev => [...prev, { role: "user", text: userMessage }]); setLoading(true);
    const salespersonId = profile?.supabaseId;
    if (salespersonId) {
      const result = await callEdgeFunction("ai-product-expert", { question: userMessage, salesperson_id: salespersonId });
      if (result?.message) { setMessages(prev => [...prev, { role: "assistant", text: result.message }]); setLoading(false); return; }
    }
    const response = getBatteryResponse(userMessage);
    setMessages(prev => [...prev, { role: "assistant", text: response }]); setLoading(false);
  };

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 100px)" }}>
      <div className="mb-5"><h2 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center"><Battery size={20} className="text-emerald-600" /></div>AI Batteriexpert</h2><p className="text-sm text-gray-400 mt-1 ml-[52px]">Produktkunskap med Claude AI</p></div>
      <div className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[70%] px-5 py-3.5 text-sm leading-relaxed whitespace-pre-wrap ${msg.role === "user" ? "bg-emerald-600 text-white rounded-2xl rounded-br-lg" : "bg-gray-50 text-gray-800 rounded-2xl rounded-bl-lg border border-gray-100"}`}>{msg.text}</div>
            </div>
          ))}
          {loading && <div className="flex justify-start"><div className="px-5 py-3.5 bg-gray-50 rounded-2xl rounded-bl-lg border border-gray-100 text-sm text-gray-400">Söker i produktdatabasen...</div></div>}
          <div ref={endRef} />
        </div>
        <div className="px-4 py-2 flex gap-2 overflow-x-auto border-t border-gray-50">
          {["Eway batteri?","Solis vs Solinteg?","ChargeAmps Luna?","Komplett system?","Enequi styrning?"].map((s,i) => <button key={i} onClick={()=>setInput(s)} className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs bg-gray-50 text-gray-500 hover:bg-emerald-50 hover:text-emerald-700 border border-gray-100 transition-all">{s}</button>)}
        </div>
        <div className="p-4 border-t border-gray-50">
          <div className="flex gap-3">
            <input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSend()} placeholder="Fråga om produkter..." className="flex-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-50 focus:outline-none text-sm" />
            <button onClick={handleSend} disabled={loading} className="px-4 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:bg-gray-200 transition-all shadow-sm"><Send size={18} /></button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// QUIZ SYSTEM
// ═══════════════════════════════════════════════════════════════
const QuizSystem = () => {
  const [started, setStarted] = useState(false);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [showResult, setShowResult] = useState(false);

  const handleAnswer = (idx) => {
    const newA = [...answers, idx]; setAnswers(newA);
    if (current < QUIZ_QUESTIONS.length - 1) setCurrent(current + 1);
    else { const score = newA.filter((a,i) => a === QUIZ_QUESTIONS[i].correct).length; const existing = JSON.parse(localStorage.getItem("salj_quiz_scores") || "[]"); existing.push({ type: "Säljquiz", score, maxScore: QUIZ_QUESTIONS.length, date: new Date().toISOString() }); localStorage.setItem("salj_quiz_scores", JSON.stringify(existing)); setShowResult(true); }
  };

  const score = answers.filter((a,i) => a === QUIZ_QUESTIONS[i]?.correct).length;
  const pct = QUIZ_QUESTIONS.length > 0 ? Math.round((score/QUIZ_QUESTIONS.length)*100) : 0;

  if (!started) return (
    <div><SectionTitle icon={Brain} title="Quiz" subtitle="Testa dina säljkunskaper" />
    <Card className="text-center py-12"><Brain size={40} className="mx-auto text-blue-200 mb-4" /><h3 className="text-xl font-bold text-gray-900 mb-2">{QUIZ_QUESTIONS.length} frågor</h3><p className="text-gray-400 text-sm mb-6">Invändningar, closes, DISC, SPIN</p>
    <button onClick={()=>setStarted(true)} className="px-8 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20">Starta Quiz</button></Card></div>
  );

  if (showResult) return (
    <div><SectionTitle icon={Award} title="Resultat" subtitle={`${score} av ${QUIZ_QUESTIONS.length} rätt`} />
    <Card className="text-center py-8 mb-6"><div className="text-5xl font-bold mb-2" style={{color: pct >= 80 ? "#059669" : pct >= 60 ? "#D97706" : "#DC2626"}}>{pct}%</div><p className="text-gray-400">{pct >= 80 ? "Starkt!" : pct >= 60 ? "Bra grund, öva mer." : "Gå igenom materialet igen."}</p></Card>
    <div className="space-y-3">{QUIZ_QUESTIONS.map((q,i) => (
      <Card key={i} className={`border-l-4 ${answers[i]===q.correct ? "border-l-emerald-500" : "border-l-red-500"}`}>
        <p className="text-sm font-medium text-gray-900 mb-2">{i+1}. {q.q}</p>
        <p className="text-sm"><span className="text-gray-400">Ditt svar: </span><span className={answers[i]===q.correct?"text-emerald-600":"text-red-500"}>{q.options[answers[i]]}</span></p>
        {answers[i]!==q.correct && <p className="text-sm"><span className="text-gray-400">Rätt: </span><span className="text-emerald-600">{q.options[q.correct]}</span></p>}
        <p className="text-gray-400 text-xs mt-2 italic">{q.explanation}</p>
      </Card>
    ))}</div>
    <button onClick={()=>{setStarted(false);setCurrent(0);setAnswers([]);setShowResult(false);}} className="mt-6 px-6 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-all">Kör igen</button></div>
  );

  const q = QUIZ_QUESTIONS[current];
  return (
    <div><SectionTitle icon={Brain} title={`Fråga ${current+1} / ${QUIZ_QUESTIONS.length}`} />
    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mb-6"><div className="h-full bg-blue-600 rounded-full transition-all" style={{width:`${((current+1)/QUIZ_QUESTIONS.length)*100}%`}} /></div>
    <Card><p className="text-gray-900 font-semibold mb-6">{q.q}</p><div className="space-y-3">{q.options.map((opt,i) => (
      <button key={i} onClick={()=>handleAnswer(i)} className="w-full text-left p-4 border-2 border-gray-100 rounded-xl text-sm text-gray-900 hover:border-blue-300 hover:bg-blue-50/50 transition-all font-medium">{opt}</button>
    ))}</div></Card></div>
  );
};

// ═══════════════════════════════════════════════════════════════
// SPIN QUESTIONS
// ═══════════════════════════════════════════════════════════════
const SpinQuestions = () => {
  const [phase, setPhase] = useState("situation");
  const phases = [{ key: "situation", name: "Situation", icon: Eye, color: "#0369A1" }, { key: "problem", name: "Problem", icon: AlertTriangle, color: "#DC2626" }, { key: "implication", name: "Implikation", icon: TrendingUp, color: "#EA580C" }, { key: "needPayoff", name: "Need-Payoff", icon: Lightbulb, color: "#059669" }];
  return (
    <div><SectionTitle icon={MessageCircle} title="SPIN Frågebatteri" subtitle="Den som ställer frågorna styr samtalet" />
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">{phases.map(p => (
      <button key={p.key} onClick={()=>setPhase(p.key)} className="p-4 rounded-xl text-left transition-all border-2" style={phase===p.key?{borderColor:p.color,background:`${p.color}08`}:{borderColor:"#F3F4F6"}}>
        <p.icon size={18} style={{color:p.color}} /><div className="font-bold text-sm mt-2 text-gray-900">{p.name}</div><div className="text-xs text-gray-400 mt-0.5">{SPIN_QUESTIONS[p.key].length} frågor</div>
      </button>
    ))}</div>
    <div className="space-y-4">{SPIN_QUESTIONS[phase].map((q,i) => (
      <Card key={i}><div className="flex items-start gap-4"><span className="text-blue-600 font-bold text-sm mt-0.5 w-6 text-right">{i+1}</span><div className="flex-1">
        <p className="text-gray-900 font-medium mb-3">"{q.q}"</p>
        <div className="grid md:grid-cols-2 gap-3"><div className="bg-blue-50/50 rounded-xl p-4"><div className="text-xs text-blue-600 font-semibold tracking-wide mb-1">VARFÖR</div><p className="text-gray-600 text-sm">{q.why}</p></div><div className="bg-amber-50/50 rounded-xl p-4"><div className="text-xs text-amber-600 font-semibold tracking-wide mb-1">LYSSNA EFTER</div><p className="text-gray-600 text-sm">{q.listen}</p></div></div>
      </div></div></Card>
    ))}</div></div>
  );
};

// ═══════════════════════════════════════════════════════════════
// OBJECTION HANDLER
// ═══════════════════════════════════════════════════════════════
const ObjectionHandler = () => {
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("Alla");
  const categories = ["Alla", ...new Set(OBJECTIONS.map(o => o.kat))];
  const filtered = filter === "Alla" ? OBJECTIONS : OBJECTIONS.filter(o => o.kat === filter);
  const catColors = { Pris: "#DC2626", Partner: "#EA580C", Timing: "#0369A1", Undvikande: "#7C3AED", Skepticism: "#B45309", Trovärdighet: "#059669", Praktisk: "#6B7280" };
  return (
    <div><SectionTitle icon={Shield} title="Invändningshantering" subtitle="Validera först. Ställ fråga sedan. Pitcha aldrig mot invändningen." />
    <div className="flex flex-wrap gap-2 mb-6">{categories.map(c => (
      <button key={c} onClick={()=>setFilter(c)} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${filter===c?"bg-blue-600 text-white shadow-sm":"bg-gray-50 text-gray-500 hover:bg-gray-100 border border-gray-100"}`}>{c}</button>
    ))}</div>
    <div className="space-y-3">{filtered.map((o,i) => (
      <Card key={i} onClick={()=>setSelected(selected===i?null:i)} className="hover:border-blue-200">
        <div className="flex items-center justify-between mb-1"><span className="text-gray-900 font-bold text-sm">"{o.inv}"</span><span className="text-xs font-bold px-2.5 py-1 rounded-lg" style={{background:`${catColors[o.kat]||"#6B7280"}10`,color:catColors[o.kat]||"#6B7280"}}>{o.kat}</span></div>
        {selected===i && <div className="mt-4 space-y-4 animate-in">
          <div><span className="text-gray-400 text-xs font-semibold tracking-wide">VAD KUNDEN MENAR</span><p className="text-gray-700 text-sm mt-1">{o.meaning}</p></div>
          <div className="bg-blue-50 rounded-xl p-4 border-l-4 border-blue-600"><span className="text-blue-700 text-xs font-semibold tracking-wide">EXAKT VAD DU SÄGER</span><p className="text-gray-900 text-sm mt-1 italic">{o.handling}</p></div>
          <div className="bg-amber-50 rounded-xl p-4 border-l-4 border-amber-500"><span className="text-amber-700 text-xs font-semibold tracking-wide">UPPFÖLJNINGSFRÅGA</span><p className="text-gray-900 text-sm mt-1 italic">{o.follow}</p></div>
        </div>}
      </Card>
    ))}</div></div>
  );
};

// ═══════════════════════════════════════════════════════════════
// CLOSING TECHNIQUES
// ═══════════════════════════════════════════════════════════════
const ClosingTechniques = ({ profile }) => {
  const [selected, setSelected] = useState(null);
  return (
    <div><SectionTitle icon={Target} title="Avslutstekniker" subtitle="Frågan är inte OM du går på avslut — utan VILKEN teknik och NÄR." />
    <Card className="mb-6 border-l-4 border-blue-600"><p className="text-blue-700 text-sm font-bold">GYLLENE PRINCIPEN</p><p className="text-gray-600 text-sm mt-1">Om kunden har sagt ja till problemet, ja till lösningen, och ja till siffrorna — har de redan köpt.</p></Card>
    {profile?.discType && <Card className="mb-6 border-l-4" style={{borderColor:DISC_COLORS[profile.discType],background:`${DISC_COLORS[profile.discType]}05`}}>
      <div className="text-xs font-semibold tracking-wide mb-2" style={{color:DISC_COLORS[profile.discType]}}>REKOMMENDERADE FÖR DIG ({DISC_SHORT[profile.discType]})</div>
      <div className="space-y-1">{CLOSES.filter(c=>c.disc[profile.discType]==="PRIMÄR"||c.disc[profile.discType]==="EXTREMT EFFEKTIV").map((c,i)=>(<p key={i} className="text-gray-900 text-sm">{c.name} — <span className="text-emerald-600 font-semibold">{c.disc[profile.discType]}</span></p>))}</div>
    </Card>}
    <div className="space-y-3">{CLOSES.map((c,i) => (
      <Card key={i} onClick={()=>setSelected(selected===i?null:i)} className="hover:border-blue-200">
        <div className="flex items-center justify-between mb-1"><span className="text-gray-900 font-bold text-sm">{i+1}. {c.name}</span><div className="flex gap-2">
          {profile?.discType && <span className="text-xs font-bold px-2 py-1 rounded-lg" style={{background:`${DISC_COLORS[profile.discType]}10`,color:DISC_COLORS[profile.discType]}}>{c.disc[profile.discType]}</span>}
          <span className={`text-xs font-bold px-2 py-1 rounded-lg ${c.difficulty==="LÄTT"?"bg-emerald-50 text-emerald-700":c.difficulty==="MEDEL"?"bg-amber-50 text-amber-700":"bg-red-50 text-red-700"}`}>{c.difficulty}</span>
        </div></div><p className="text-gray-500 text-xs">{c.desc}</p>
        {selected===i && <div className="mt-4 space-y-3"><div className="bg-blue-50 rounded-xl p-4"><span className="text-blue-700 text-xs font-semibold tracking-wide">EXAKT VAD DU SÄGER</span><p className="text-gray-900 text-sm mt-1 italic">{c.example}</p></div><div><span className="text-gray-400 text-xs font-semibold tracking-wide">KÖPSIGNAL</span><p className="text-gray-700 text-sm mt-1">{c.signal}</p></div></div>}
      </Card>
    ))}</div></div>
  );
};

// ═══════════════════════════════════════════════════════════════
// CALL GUIDE
// ═══════════════════════════════════════════════════════════════
const CallGuide = ({ profile }) => {
  const [activeCall, setActiveCall] = useState(1);
  const [activeStep, setActiveStep] = useState(0);
  const bp = CALL_BLUEPRINTS[activeCall];
  return (
    <div><SectionTitle icon={Phone} title="Samtalsguide" subtitle="Steg-för-steg blueprint för varje samtal" />
    <div className="flex gap-2 mb-6">{[1,2,3].map(n => <button key={n} onClick={()=>{setActiveCall(n);setActiveStep(0);}} className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${activeCall===n?"bg-blue-600 text-white shadow-sm":"bg-gray-50 text-gray-500 hover:bg-gray-100 border border-gray-100"}`}>Samtal {n}</button>)}</div>
    <Card className="mb-5"><h3 className="text-lg font-bold text-gray-900">{bp.title}</h3><p className="text-gray-500 text-sm mt-1">{bp.subtitle}</p><span className="inline-block mt-2 text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-lg">{bp.timing}</span></Card>
    <div className="grid lg:grid-cols-4 gap-5">
      <div className="space-y-1">{bp.sections.map((s,i) => <button key={i} onClick={()=>setActiveStep(i)} className={`w-full text-left px-4 py-3 rounded-xl text-xs transition-all ${activeStep===i?"bg-blue-50 border border-blue-200 text-blue-700 font-bold":"bg-white border border-gray-100 text-gray-500 hover:bg-gray-50"}`}><div className="font-bold">{s.name}</div><div className="text-gray-400 mt-0.5">{s.time}</div></button>)}</div>
      <div className="lg:col-span-3"><Card>
        <div className="flex items-center justify-between mb-4"><h4 className="text-lg font-bold text-gray-900">{bp.sections[activeStep].name}</h4><span className="text-xs font-bold text-amber-600 bg-amber-50 px-3 py-1 rounded-lg">{bp.sections[activeStep].time}</span></div>
        <p className="text-blue-600 text-sm font-bold mb-4">MÅL: {bp.sections[activeStep].goal}</p>
        <div className="space-y-2">{bp.sections[activeStep].steps.map((step,i) => <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50"><span className="text-blue-600 font-bold text-sm mt-0.5">{i+1}.</span><span className="text-gray-700 text-sm">{step}</span></div>)}</div>
        <div className="flex justify-between mt-6"><button onClick={()=>setActiveStep(Math.max(0,activeStep-1))} disabled={activeStep===0} className="text-sm text-gray-400 hover:text-gray-700 disabled:opacity-30 flex items-center gap-1"><ChevronLeft size={16} />Föregående</button><button onClick={()=>setActiveStep(Math.min(bp.sections.length-1,activeStep+1))} disabled={activeStep===bp.sections.length-1} className="text-sm text-blue-600 hover:text-blue-700 disabled:opacity-30 flex items-center gap-1">Nästa<ChevronRight size={16} /></button></div>
      </Card></div>
    </div></div>
  );
};

// ═══════════════════════════════════════════════════════════════
// EMOTIONS METHOD
// ═══════════════════════════════════════════════════════════════
const EmotionsMethod = () => (
  <div><SectionTitle icon={Heart} title="Känslor & Metod" subtitle="Kunden köper en känsla av kontroll, inte ett batteri." />
  <h3 className="text-sm font-bold text-blue-600 tracking-wide mb-4">5 KÄNSLOR EFTER SAMTAL 1</h3>
  <div className="space-y-3 mb-8">{[
    { num: 1, feel: "Mina solpaneler jobbar inte för mig", trigger: "Visa gapet: säljer billigt, köper dyrt" },
    { num: 2, feel: "En förändring måste ske NU", trigger: "Kvantifiera förlust per månad" },
    { num: 3, feel: "Jag har lärt mig nåt nytt", trigger: "Prismatiska vs pouch-celler" },
    { num: 4, feel: "Det var ett bra samtal", trigger: "Var genuint nyfiken. 70% ska kunden prata." },
    { num: 5, feel: "Jag vet exakt vad nästa steg är", trigger: "Sammanfatta explicit. SMS direkt." },
  ].map(e => <Card key={e.num}><div className="flex items-start gap-4"><div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-sm flex-shrink-0">{e.num}</div><div><p className="text-gray-900 font-bold text-sm">"{e.feel}"</p><p className="text-gray-500 text-xs mt-1">{e.trigger}</p></div></div></Card>)}</div>
  <h3 className="text-sm font-bold text-blue-600 tracking-wide mb-4">ETHOS / PATHOS / LOGOS</h3>
  <div className="grid md:grid-cols-3 gap-4 mb-8">{[
    { name: "ETHOS", sub: "Trovärdighet", color: "#0369A1", desc: "Teknisk kunskap, lokala referenser, ärlighet om nackdelar" },
    { name: "PATHOS", sub: "Känsla", color: "#DC2626", desc: "Loss aversion, sunk cost, stolthet, frustration mot elbolag" },
    { name: "LOGOS", sub: "Logik", color: "#059669", desc: "Konkret ROI med DERAS siffror, payback-tid, livstidsbesparing" },
  ].map(p => <Card key={p.name} className="border-t-4" style={{borderTopColor:p.color}}><div className="text-sm font-bold mb-1" style={{color:p.color}}>{p.name}</div><div className="text-xs text-gray-400 mb-2">{p.sub}</div><p className="text-gray-600 text-xs">{p.desc}</p></Card>)}</div>
  <h3 className="text-sm font-bold text-blue-600 tracking-wide mb-4">PER PERSONTYP</h3>
  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[
    { type: "Röd", primary: "LOGOS", secondary: "ETHOS", color: DISC_COLORS.R },
    { type: "Gul", primary: "PATHOS", secondary: "ETHOS", color: DISC_COLORS.Y },
    { type: "Grön", primary: "PATHOS", secondary: "LOGOS", color: DISC_COLORS.Gr },
    { type: "Blå", primary: "LOGOS", secondary: "ETHOS", color: DISC_COLORS.B },
  ].map(t => <Card key={t.type}><div className="font-bold text-sm mb-2" style={{color:t.color}}>{t.type}</div><div className="text-xs text-gray-400">Primärt: <span className="text-gray-900">{t.primary}</span></div><div className="text-xs text-gray-400">Sekundärt: <span className="text-gray-900">{t.secondary}</span></div></Card>)}</div>
  </div>
);

// ═══════════════════════════════════════════════════════════════
// DISC PROFILES VIEWER
// ═══════════════════════════════════════════════════════════════
const DiscProfiles = ({ profile }) => {
  const [active, setActive] = useState(profile?.discType || "R");
  const p = DISC_PROFILES[active];
  return (
    <div><SectionTitle icon={Users} title="Persontyper (DISC)" subtitle="Identifiera persontypen inom 2 minuter" />
    <div className="flex gap-3 mb-6">{Object.entries(DISC_PROFILES).map(([k,v]) => <button key={k} onClick={()=>setActive(k)} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all border-2 ${active===k?"text-white":"text-gray-500 border-gray-100 hover:border-gray-200"}`} style={active===k?{borderColor:DISC_COLORS[k],background:DISC_COLORS[k]}:{}}>{v.short}{k===profile?.discType?" (DU)":""}</button>)}</div>
    <div className="grid md:grid-cols-2 gap-4">{[
      { title: "Kännetecken", content: p.recognize }, { title: "Drivkraft", content: p.drive }, { title: "Rädsla", content: p.fear }, { title: "Tempo", content: p.tempo },
      { title: "Säg detta", content: p.say }, { title: "Undvik", content: p.avoid }, { title: "Stäng så här", content: p.close }, { title: "Uppföljning", content: p.followUp },
    ].map((item,i) => <Card key={i}><div className="text-xs text-blue-600 font-semibold tracking-wide mb-2">{item.title.toUpperCase()}</div><p className="text-gray-700 text-sm">{item.content}</p></Card>)}</div>
    {profile?.discType && <Card className="mt-6 border-l-4" style={{borderColor:DISC_COLORS[profile.discType],background:`${DISC_COLORS[profile.discType]}05`}}>
      <h3 className="text-sm font-bold tracking-wide mb-2" style={{color:DISC_COLORS[profile.discType]}}>DU ({DISC_SHORT[profile.discType]}) → KUND ({DISC_SHORT[active]})</h3>
      <p className="text-gray-700 text-sm">{DISC_PROFILES_FULL[profile.discType]?.matrix[active]?.text || "Anpassa ditt tempo."}</p>
    </Card>}</div>
  );
};

// ═══════════════════════════════════════════════════════════════
// WEEKLY CHECKIN
// ═══════════════════════════════════════════════════════════════
const WeeklyCheckin = ({ onSave, checkins }) => {
  const [answers, setAnswers] = useState(Array(WEEKLY_QUESTIONS.length).fill(""));
  const [saved, setSaved] = useState(false);
  if (saved) return (<div><SectionTitle icon={Calendar} title="Vecko-checkin" subtitle="Sparad!" /><Card className="text-center py-12"><CheckCircle size={40} className="mx-auto text-emerald-500 mb-3" /><h3 className="text-lg font-bold text-gray-900">Sparad!</h3><p className="text-gray-400 text-sm mt-1">Se din progress i dashboarden.</p></Card></div>);
  return (
    <div><SectionTitle icon={Calendar} title="Vecko-checkin" subtitle="Reflektera. 3 minuter. Varje fredag." />
    <div className="space-y-4 mb-6">{WEEKLY_QUESTIONS.map((q,i) => <Card key={i}><label className="text-sm text-gray-900 font-medium block mb-2">{i+1}. {q}</label><input type="text" value={answers[i]} onChange={e=>{const a=[...answers];a[i]=e.target.value;setAnswers(a);}} className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:border-blue-500 focus:outline-none" placeholder="Ditt svar..." /></Card>)}</div>
    <button onClick={()=>{onSave({date:new Date().toISOString().split("T")[0],answers,timestamp:Date.now()});setSaved(true);}} className="px-8 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20">Spara</button>
    {checkins.length > 0 && <div className="mt-8"><h3 className="text-sm font-bold text-gray-900 mb-3">Historik</h3><div className="space-y-2">{checkins.slice().reverse().slice(0,5).map((c,i) => <Card key={i}><div className="flex justify-between"><span className="text-gray-400 text-sm">{c.date}</span><span className="text-gray-500 text-xs">{c.answers[0]} samtal</span></div>{c.answers[5] && <p className="text-gray-600 text-xs mt-1">Lärdom: {c.answers[5]}</p>}</Card>)}</div></div>}</div>
  );
};

// ═══════════════════════════════════════════════════════════════
// DEVELOPMENT PLAN
// ═══════════════════════════════════════════════════════════════
const DevelopmentPlan = ({ profile, checkins }) => {
  const weekNum = checkins.length;
  const phases = [
    { name: "Vecka 1-2: GRUND", desc: "Lär dig DISC, SPIN-frågor, invändningshantering", tasks: ["Gör personlighetstestet", "Läs alla DISC-profiler", "Memorera topp 5 invändningar", "Öva SPIN-frågor högt", "Kör quiz tills 80%+"] },
    { name: "Vecka 3-4: SAMTALSSTRUKTUR", desc: "Fokus på Samtal 1 blueprint", tasks: ["Kör 10+ samtal 1", "Identifiera DISC inom 2 min", "Använd alla pengaläckorna", "Gå på avslut varje samtal", "Reflektera efter varje samtal"] },
    { name: "Vecka 5-6: CLOSING", desc: "Mästra avslutstekniker", tasks: ["Öva alla 10 close-tekniker", "Kör samtal 2 med kalkyl", "Stäng minst 2 deals", "Hantera 3+ invändningar/samtal", "Börja med Sharp Angle + Takeaway"] },
    { name: "Vecka 7-8: FÖRFINING", desc: "Anpassa per persontyp", tasks: ["Anpassa close per DISC", "Kör samtal 3 med partner", "Close rate mål: 25%+", "Mentora junior säljare", "Dokumentera framgångsmönster"] },
  ];
  const currentPhase = Math.min(Math.floor(weekNum/2), phases.length-1);
  return (
    <div><SectionTitle icon={TrendingUp} title="Utvecklingsplan" subtitle="8-veckors plan" />
    <Card className="mb-6"><div className="flex justify-between mb-3"><span className="text-sm font-bold text-gray-900">Din progress</span><span className="text-sm font-bold text-blue-600">Vecka {weekNum}/8</span></div><div className="w-full bg-gray-100 rounded-full h-3"><div className="bg-blue-600 h-3 rounded-full transition-all" style={{width:`${Math.min(100,(weekNum/8)*100)}%`}} /></div></Card>
    <div className="space-y-4">{phases.map((p,i) => (
      <Card key={i} className={`border-l-4 ${i===currentPhase?"border-l-blue-600":i<currentPhase?"border-l-emerald-500":"border-l-gray-200"}`}>
        <div className="flex items-center gap-3 mb-2">{i<currentPhase?<CheckCircle size={18} className="text-emerald-500" />:i===currentPhase?<Zap size={18} className="text-blue-600" />:<Clock size={18} className="text-gray-300" />}<h4 className="font-bold text-gray-900 text-sm">{p.name}</h4></div>
        <p className="text-gray-500 text-xs mb-3">{p.desc}</p>
        <div className="space-y-1">{p.tasks.map((t,j) => <div key={j} className="flex items-center gap-2 text-xs"><span className={i<currentPhase?"text-emerald-500":"text-gray-300"}>{i<currentPhase?"✓":"○"}</span><span className={i<=currentPhase?"text-gray-700":"text-gray-400"}>{t}</span></div>)}</div>
      </Card>
    ))}</div></div>
  );
};

// ═══════════════════════════════════════════════════════════════
// TEAM VIEW
// ═══════════════════════════════════════════════════════════════
const TeamView = () => {
  const [profiles, setProfiles] = useState([]);
  useEffect(() => {
    fetch(`${SUPABASE_URL}/rest/v1/salespeople?select=*`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } })
      .then(r => r.json()).then(d => { if (Array.isArray(d)) setProfiles(d); }).catch(() => {});
  }, []);
  return (
    <div><SectionTitle icon={Users} title="Teamet" subtitle="Alla säljares profiler" />
    {profiles.length === 0 ? <Card><p className="text-gray-400 text-sm text-center py-8">Laddar profiler...</p></Card> :
    <div className="grid grid-cols-2 md:grid-cols-3 gap-5">{profiles.map((p,i) => {
      const color = DISC_COLORS[p.disc_type] || "#0369A1";
      return <Card key={i} className="text-center"><div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center text-xl font-bold text-white" style={{background:color}}>{p.name?.[0]}</div><div className="font-bold text-gray-900">{p.name}</div><div className="text-xs font-semibold mt-1" style={{color}}>{DISC_SHORT[p.disc_type] || p.disc_type}</div>{p.disc_secondary && <div className="text-xs text-gray-400 mt-0.5">Sekundär: {DISC_SHORT[p.disc_secondary]}</div>}</Card>;
    })}</div>}
    {profiles.length > 0 && <Card className="mt-6"><h3 className="text-sm font-bold text-gray-900 mb-4">Teamfördelning</h3><div className="grid grid-cols-4 gap-3">{["R","Y","Gr","B"].map(k => {
      const count = profiles.filter(p=>p.disc_type===k).length;
      return <div key={k} className="text-center p-3 rounded-xl bg-gray-50"><div className="text-2xl font-bold" style={{color:DISC_COLORS[k]}}>{count}</div><div className="text-xs text-gray-400">{DISC_SHORT[k]}</div></div>;
    })}</div></Card>}</div>
  );
};

// ═══════════════════════════════════════════════════════════════
// MY PROFILE
// ═══════════════════════════════════════════════════════════════
const MyProfile = ({ profile }) => {
  const fp = DISC_PROFILES_FULL[profile?.discType];
  if (!fp) return null;
  return (
    <div className="space-y-6"><SectionTitle icon={User} title="Min Profil" subtitle={`${profile?.name} — ${DISC_NAMES[profile?.discType]}`} />
    <Card className="border-l-4" style={{borderColor:fp.color,background:`${fp.color}05`}}><div className="flex items-start gap-4"><div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-bold text-white flex-shrink-0" style={{background:fp.color}}>{profile?.name?.[0]}</div><div><h3 className="text-xl font-bold text-gray-900">{fp.name}</h3><p className="text-gray-500 italic text-sm">{fp.archetype}</p><p className="text-gray-700 mt-2 text-sm leading-relaxed">{fp.oneLiner}</p></div></div></Card>
    <div className="grid md:grid-cols-2 gap-4">
      <Card><h4 className="text-sm font-bold text-emerald-600 mb-3">SUPERKRAFTER</h4><ul className="space-y-2">{fp.superpowers.map((s,i) => <li key={i} className="text-sm text-gray-700 flex gap-2"><span className="text-emerald-500 mt-0.5">✓</span>{s}</li>)}</ul></Card>
      <Card><h4 className="text-sm font-bold text-red-600 mb-3">BLINDSPOTS</h4><ul className="space-y-2">{fp.blindspots.map((s,i) => <li key={i} className="text-sm text-gray-700 flex gap-2"><span className="text-red-500 mt-0.5">✗</span>{s}</li>)}</ul></Card>
    </div>
    <Card className="border-l-4 border-amber-500"><h4 className="text-sm font-bold text-amber-700 mb-2">STÖRSTA FÄLLAN</h4><p className="text-gray-700 text-sm">{fp.biggestTrap}</p></Card>
    <div className="grid md:grid-cols-2 gap-4">
      <Card><h4 className="text-sm font-bold text-blue-600 mb-3">GÖR MER AV</h4>{fp.mustDoMore.map((m,i) => <p key={i} className="text-sm text-gray-700 mb-1">• {m}</p>)}</Card>
      <Card><h4 className="text-sm font-bold text-red-600 mb-3">GÖR MINDRE AV</h4>{fp.mustDoLess.map((m,i) => <p key={i} className="text-sm text-gray-700 mb-1">• {m}</p>)}</Card>
    </div>
    <Card><h4 className="text-sm font-bold text-blue-600 mb-4">ANPASSNINGSMATRIS</h4><div className="grid md:grid-cols-2 gap-3">{["R","Y","Gr","B"].map(k => <div key={k} className="bg-gray-50 rounded-xl p-4 border-l-4" style={{borderColor:DISC_COLORS[k]}}><h5 className="font-bold text-sm mb-1" style={{color:DISC_COLORS[k]}}>{fp.matrix[k].title}</h5><p className="text-gray-600 text-xs">{fp.matrix[k].text}</p></div>)}</div></Card>
    <Card className="border-l-4 border-emerald-600" style={{background:"#F0FDF4"}}><h4 className="text-sm font-bold text-emerald-700 mb-2">KALIBRERING</h4><p className="text-gray-900 font-semibold italic">"{fp.calibration}"</p><p className="text-gray-500 text-sm mt-2">Säg detta innan varje kundsamtal.</p></Card>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════
const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: Home },
  { key: "profile", label: "Min Profil", icon: User },
  { key: "team", label: "Teamet", icon: Users },
  { key: "quiz", label: "Quiz", icon: Brain },
  { key: "coach", label: "AI Coach", icon: Bot },
  { key: "battery", label: "Batteriexpert", icon: Battery },
  { key: "callguide", label: "Samtalsguide", icon: Phone },
  { key: "spin", label: "SPIN Frågor", icon: MessageCircle },
  { key: "disc", label: "Persontyper", icon: Eye },
  { key: "objections", label: "Invändningar", icon: Shield },
  { key: "closing", label: "Avslutstekniker", icon: Target },
  { key: "emotions", label: "Känslor & Metod", icon: Heart },
  { key: "checkin", label: "Vecko-checkin", icon: Calendar },
  { key: "development", label: "Utvecklingsplan", icon: TrendingUp },
];

export default function App() {
  const [profile, setProfile] = useState(() => { try { return JSON.parse(localStorage.getItem("salj_profile")); } catch { return null; } });
  const [page, setPage] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showNewUser, setShowNewUser] = useState(false);
  const [checkins, setCheckins] = useState(() => { try { return JSON.parse(localStorage.getItem("salj_checkins")) || []; } catch { return []; } });

  useEffect(() => { if (profile) localStorage.setItem("salj_profile", JSON.stringify(profile)); }, [profile]);
  useEffect(() => { localStorage.setItem("salj_checkins", JSON.stringify(checkins)); }, [checkins]);

  const handleTestComplete = async (result) => { const supabaseId = await saveSalespersonToSupabase(result); setProfile({ ...result, supabaseId }); setShowNewUser(false); };
  const handleCheckin = (entry) => setCheckins([...checkins, entry]);

  if (showNewUser) return <DiscTest onComplete={handleTestComplete} />;
  if (!profile) return <PinLogin onLogin={p => setProfile(p)} onNewUser={() => setShowNewUser(true)} />;

  return (
    <div className="h-screen w-screen overflow-hidden bg-gray-50/50 flex">
      <aside className={`${sidebarOpen ? "w-60" : "w-[68px]"} h-full bg-white border-r border-gray-100 flex flex-col transition-all duration-300 flex-shrink-0`}>
        <div className="px-4 h-16 flex items-center justify-between border-b border-gray-50">
          {sidebarOpen && <div><h1 className="text-sm font-bold text-gray-900 tracking-tight">Säljträning</h1><p className="text-[10px] text-gray-400 tracking-wide">PROFFSKONTAKT</p></div>}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-gray-300 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-50 transition-all">{sidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}</button>
        </div>
        <nav className="flex-1 py-3 px-2.5 overflow-y-auto space-y-0.5">
          {NAV_ITEMS.map(item => (
            <button key={item.key} onClick={() => setPage(item.key)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left text-[13px] rounded-xl transition-all ${page === item.key ? "bg-blue-50 text-blue-700 font-semibold" : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"}`}>
              <item.icon size={17} className="flex-shrink-0" />
              {sidebarOpen && <span className="truncate">{item.label}</span>}
            </button>
          ))}
        </nav>
        <div className="px-3 py-3 border-t border-gray-50">
          {sidebarOpen && <div className="flex items-center gap-3 px-2 py-2.5 mb-2 bg-gray-50 rounded-xl">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: DISC_COLORS[profile.discType] || "#3B82F6" }}>{profile.name?.[0]}</div>
            <div className="overflow-hidden"><p className="text-sm font-semibold text-gray-900 truncate">{profile.name}</p><p className="text-[10px] text-gray-400">{DISC_SHORT[profile.discType]}</p></div>
          </div>}
          <button onClick={() => { setProfile(null); localStorage.removeItem("salj_profile"); }} className="w-full flex items-center gap-3 px-3 py-2 text-[13px] text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"><LogOut size={15} />{sidebarOpen && "Logga ut"}</button>
        </div>
      </aside>

      <main className="flex-1 h-full overflow-y-auto">
        <div className="p-8 lg:p-10">
          <div className="max-w-5xl mx-auto">
            {page === "dashboard" && <Dashboard profile={profile} setPage={setPage} />}
            {page === "profile" && <MyProfile profile={profile} />}
            {page === "team" && <TeamView />}
            {page === "quiz" && <QuizSystem />}
            {page === "coach" && <AiCoach profile={profile} />}
            {page === "battery" && <AiBatteryExpert profile={profile} />}
            {page === "callguide" && <CallGuide profile={profile} />}
            {page === "spin" && <SpinQuestions />}
            {page === "disc" && <DiscProfiles profile={profile} />}
            {page === "objections" && <ObjectionHandler />}
            {page === "closing" && <ClosingTechniques profile={profile} />}
            {page === "emotions" && <EmotionsMethod />}
            {page === "checkin" && <WeeklyCheckin onSave={handleCheckin} checkins={checkins} />}
            {page === "development" && <DevelopmentPlan profile={profile} checkins={checkins} />}
          </div>
        </div>
      </main>
    </div>
  );
}
