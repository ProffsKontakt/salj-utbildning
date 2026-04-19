import { useState, useEffect, useRef, useCallback } from "react";
import {
  Phone, Brain, Shield, Target, Zap, User, Users, TrendingUp, BookOpen,
  ChevronRight, ChevronLeft, CheckCircle, AlertTriangle, Clock, Award, Star,
  ArrowRight, MessageCircle, Eye, Heart, Lightbulb, BarChart3, Settings,
  Home, LogOut, Calendar, FileText, Play, RotateCcw, Lock, Send, Bot, Battery,
  Hash, Trophy, Flame, Menu, X, Leaf, ChevronDown, ChevronUp, Search, Sparkles,
  CircleCheck, GraduationCap, Dumbbell, Activity, Crown, Medal, Swords,
  Sun, Moon
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════
// PROFFSKONTAKT SÄLJTRÄNING v2.0
// Vit + Grön • Duolingo-inspired gamification • 5 pages + admin
// ═══════════════════════════════════════════════════════════════

// ── Theme ──
const T = {
  primary: "#059669",     // emerald-600
  primaryDark: "#047857", // emerald-700
  primaryLight: "#D1FAE5",// emerald-100
  primaryBg: "#ECFDF5",  // emerald-50
  accent: "#10B981",      // emerald-500
  gold: "#F59E0B",
  goldLight: "#FEF3C7",
  red: "#EF4444",
  blue: "#3B82F6",
  purple: "#8B5CF6",
};

// ── Dark Mode Hook ──
const useDarkMode = () => {
  const [dark, setDark] = useState(() => localStorage.getItem("salj_theme") === "dark");
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("salj_theme", dark ? "dark" : "light");
  }, [dark]);
  return [dark, setDark];
};

const DISC_COLORS = { R: "#DC2626", Y: "#F59E0B", Gr: "#059669", B: "#3B82F6" };
const DISC_NAMES = { R: "Röd (Dominant)", Y: "Gul (Influencer)", Gr: "Grön (Stabil)", B: "Blå (Analytisk)" };
const DISC_SHORT = { R: "Röd", Y: "Gul", Gr: "Grön", B: "Blå" };
const DISC_EMOJI = { R: "🔴", Y: "🟡", Gr: "🟢", B: "🔵" };

// ── Supabase Config ──
const SUPABASE_URL = "https://torchccweanjulnaagqu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRvcmNoY2N3ZWFuanVsbmFhZ3F1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0OTQwMjksImV4cCI6MjA4NTA3MDAyOX0.qdO5vlySjkmbRq_fw9K3k-RzXU2OnSNmED4eWhyAnQs";
const LEADS_SUPABASE_URL = "https://unjrgwyvfjrmbntcosdc.supabase.co";
const LEADS_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVuanJnd3l2ZmpybWJudGNvc2RjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNTUyOTEsImV4cCI6MjA4NzczMTI5MX0.p6t6sgAurnLwPSNYwdb-cd-ZvQofOzJf-VK6nHqm1MU";

// Admin PINs (Julian + other admins)
const ADMIN_PINS = ["0411"];

const supabase = {
  from: (table) => ({
    select: (cols = "*") => ({
      eq: (col, val) => ({
        single: () => fetch(`${SUPABASE_URL}/rest/v1/${table}?select=${cols}&${col}=eq.${val}&limit=1`, {
          headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
        }).then(r => r.json()).then(d => ({ data: d?.[0] || null })),
        order: (orderCol, opts = {}) => ({
          limit: (n) => ({
            then: (fn) => fetch(`${SUPABASE_URL}/rest/v1/${table}?select=${cols}&${col}=eq.${val}&order=${orderCol}.${opts.ascending ? 'asc' : 'desc'}&limit=${n}`, {
              headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
            }).then(r => r.json()).then(d => fn({ data: d }))
          })
        })
      }),
      order: (orderCol, opts = {}) => ({
        limit: (n) => ({
          then: (fn) => fetch(`${SUPABASE_URL}/rest/v1/${table}?select=${cols}&order=${orderCol}.${opts.ascending ? 'asc' : 'desc'}&limit=${n}`, {
            headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
          }).then(r => r.json()).then(d => fn({ data: d }))
        })
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
    update: (data) => ({
      eq: (col, val) => fetch(`${SUPABASE_URL}/rest/v1/${table}?${col}=eq.${val}`, {
        method: "PATCH",
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify(data)
      }).then(r => r.json()).then(d => ({ data: d }))
    }),
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
    const row = { name: profile.name, pin: profile.pin, disc_type: profile.discType, disc_secondary: profile.secondaryType || null, disc_scores: profile.aspectScores || {}, disc_answers: profile.answers || [], avatar_color: DISC_COLORS[profile.discType] || "#059669" };
    const { data } = await supabase.from("salespeople").insert(row);
    if (data && data[0]) return data[0].id;
  } catch (e) { console.warn("Save failed:", e); }
  return null;
}

function shuffle(arr) { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

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
    name: "GUL", archetype: "The Influencer", color: "#F59E0B",
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
    name: "BLÅ", archetype: "The Analyst", color: "#3B82F6",
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

// ═══════════════════════════════════════════════════════════════
// TRAINING DATA
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

const CALL_BLUEPRINTS = {
  1: { title: "SAMTAL 1 — Etablera allt", subtitle: "Varje punkt ska vara klarerad innan du lägger på. Missar du en punkt förlängs säljcykeln med minst ett samtal.", timing: "20-25 minuter", sections: [
    { name: "1. DISC-identifiering", time: "Min 0-2", goal: "Identifiera persontypen inom 2 minuter. Det styr ALLT: tempo, argumentation, avslut, känslor.", steps: ["Lyssna på hälsningen", "Ställ öppen fråga", "Bekräfta din läsning — anpassa tempo"],
      details: [
        { id: "1a", action: "Lyssna på hälsningen", how: "Första 10 sekunderna avslöjar typ. Du behöver inte fråga nåt, bara lyssna på HUR de svarar.", script: "(Du hälsar normalt, de svarar.)", listen: "Kort/otålig = Röd. Glad/pratig = Gul. Mjuk/avvaktande = Grön. Formell/saklig = Blå." },
        { id: "1b", action: "Ställ en öppen fråga", how: "\"Berätta om era solpaneler\" avslöjar allt. Röd ger 1 mening. Gul berättar en story. Grön ger kort svar. Blå ger exakta specifikationer.", script: "\"Berätta lite om ert hus och era solpaneler — hur länge har ni haft dem?\"", listen: "Längden och typen av svar avslöjar DISC-typ direkt." },
        { id: "1c", action: "Bekräfta din läsning", how: "Anpassa ditt tempo direkt. Gult tempo på blå = tappar dem. Blått tempo på röd = de somnar.", script: "(Inget specifikt script — du justerar ditt beteende.)", listen: "Om de engagerar sig mer = rätt tempo. Om de blir kortare/irriterade = fel tempo." },
      ]},
    { name: "2. Kvalificering", time: "Min 2-4", goal: "Kan kunden köpa? Äger de huset, har sol, har mandat? Om partnern måste in och du inte vet det = slösat hela samtal 1.", steps: ["Äger de huset?", "Har de solpaneler?", "Vem bestämmer? (Partner?)", "Timing — aktivt eller bara nyfikna?"],
      details: [
        { id: "2a", action: "Äger de huset?", how: "Hyresgäster kan inte installera. Bostadsrätter är komplicerat. Du behöver veta direkt.", script: "\"Och ni äger huset själva?\"", listen: "\"Vi hyr\" = avsluta artigt. \"Bostadsrätt\" = kolla om möjligt." },
        { id: "2b", action: "Har de solpaneler?", how: "Utan sol är batteri-caset svagare. Ska redan vara kvalificerat via lead, men dubbelkolla.", script: "\"Och ni har solpaneler redan installerade?\"", listen: "\"Nej\" = batteri-only pitch (backup + arbitrage). Oftast svagare case." },
        { id: "2c", action: "Vem bestämmer?", how: "Om partnern inte är med och partnern bestämmer om ekonomin = samtal 1 är bara uppvärmning.", script: "\"Är det nåt ni brukar besluta om tillsammans med din partner, eller är det du som sköter den här typen av saker hemma?\"", listen: "\"Vi bestämmer ihop\" = boka gemensamt samtal 2. \"Min fru sköter ekonomin\" = du pratar med fel person." },
        { id: "2d", action: "Timing", how: "Styr hur hårt du går på avslut.", script: "\"Är det här nåt ni aktivt kollar på just nu, eller mer att ni vill förstå vad som finns?\"", listen: "\"Bara nyfiken\" = mer tid på emotionell shift. \"Vi ska köpa i år\" = guldläge, pusha hårt." },
      ]},
    { name: "3. Datainsamling", time: "Min 4-8", goal: "Samla ALL data för exakt kalkyl. Utan det kan du inte räkna, och utan kalkyl kan du inte stänga.", steps: ["Systemstorlek (kW)", "Växelriktare/inverter", "Elförbrukning (kWh/år)", "Egenanvändningsgrad", "Elbil?", "Elavtal"],
      details: [
        { id: "3a", action: "Systemstorlek (kW)", how: "Avgör hur mycket el de producerar och vilken batteristorlek som är optimal.", script: "\"Hur stort solsystem har ni? Vet du hur många kilowatt det är?\" (Om de inte vet: \"Vet du hur många paneler ni har? Då kan jag räkna ut det.\")", listen: "Under 5 kW = svagare case. Över 10 kW = starkt case." },
        { id: "3b", action: "Växelriktare / inverter", how: "Avgör kompatibilitet och om de behöver byta inverter.", script: "\"Vet du vilken växelriktare ni har? Det brukar stå på en låda i garaget eller vid säkringsskåpet.\"", listen: "Hybrid redan = billigare installation. Mikro-inverters = DC-kopplat batteri krävs." },
        { id: "3c", action: "Elförbrukning", how: "Kärnan i kalkylen. Utan den kan du inte räkna besparing.", script: "\"Vad betalar ni ungefär i el per månad? Eller vet du hur många kilowattimmar ni drar per år?\"", listen: "Typiskt: 15 000-25 000 kWh/år. Hög förbrukning + stor sol = bästa caset." },
        { id: "3d", action: "Egenanvändningsgrad", how: "Hur mycket av solelen de använder själva vs säljer tillbaka. De flesta vet inte detta — DÄR sitter din pitch.", script: "\"Vet du hur stor andel av er solel ni faktiskt använder själva? Vs hur mycket som går ut på nätet?\"", listen: "Typiskt 25-40% egenanvändning. Med batteri: 70-85%. Gapet = besparingen." },
        { id: "3e", action: "Elbil?", how: "Elbil = 3000-5000 kWh extra/år. Massivt batteri-case.", script: "\"Har ni elbil, eller funderar ni på att skaffa?\"", listen: "Ja = guldläge. \"Funderar\" = framtids-argument." },
        { id: "3f", action: "Elavtal", how: "Rörligt/fast/timpris påverkar arbitrage-besparingen.", script: "\"Har ni rörligt eller fast elavtal? Har ni timpris?\"", listen: "Rörligt/timpris = starkare arbitrage. Fast = fokus egenanvändning." },
      ]},
    { name: "4. Ekonomisk smärta", time: "Min 8-14", goal: "DEN VIKTIGASTE SEKTIONEN. Kvantifiera vad det KOSTAR att inte ha batteri. Du säljer inte ett batteri — du visar kunden hur mycket pengar de bränner.", steps: ["5 pengaläckorna", "Räkna LIVE med kundens siffror", "Visa vad de redan förlorat", "Bryt ner till per dag", "Framtidsprojektion 5 + 10 år"],
      details: [
        { id: "L1", action: "Pengaläcka: Säljer billigt, köper dyrt", how: "DEN STORA. Kunden säljer överskott för 0.50-0.80 kr/kWh och köper tillbaka SAMMA el på kvällen för 1.50-2.50 kr/kWh.", script: "\"Du säljer el till nätet för ungefär [X öre]. Men på kvällen köper du tillbaka den för [Y kr]. Du producerar elen, ger bort den billigt, och betalar tre gånger mer för att få tillbaka den. Med batteri lagrar du den istället.\"", listen: "Typiskt: 4000-8000 kWh överskott/år. Vid 1.50 kr spread = 6 000-12 000 kr/år." },
        { id: "L2", action: "Pengaläcka: Nätavgifter och effektavgifter", how: "Varje gång kunden drar el från nätet betalar de nätavgift + energiskatt ovanpå kWh-priset.", script: "\"Utöver elpriset betalar du nätavgift, energiskatt och moms varje gång du köper el. Det är ungefär [X öre/kWh] extra. Varje kWh du lagrar slipper du betala det på.\"", listen: "Nätavgift + skatt: ca 0.40-0.80 kr/kWh. På 5000 kWh = 2 000-4 000 kr/år." },
        { id: "L3", action: "Pengaläcka: Effekttoppar", how: "Många nätbolag debiterar baserat på högsta effektuttag. Batteri kapar topparna.", script: "\"En del av din nätavgift baseras på högsta effektuttaget under månaden. Drar du 10 kW en gång betalar du för det hela månaden. Batteriet kapar topparna automatiskt.\"", listen: "Typiskt 50-200 kr/mån = 600-2 400 kr/år." },
        { id: "L4", action: "Pengaläcka: Elprisarbitrage", how: "Med timpris: laddar när elen är billig, laddar ur när den är dyr. Fungerar året runt.", script: "\"Om du har timpris laddar batteriet automatiskt när elen kostar minst och använder den lagrade elen när priset toppar. Du köper för 30 öre och slipper köpa för 2 kronor.\"", listen: "Typiskt 2 000-5 000 kr/år beroende på prisspridning." },
        { id: "L5", action: "Pengaläcka: Nätnytta/stödtjänster", how: "Aggregering av batterier för frekvensreglering (FCR-D, FFR). Kunden kan tjäna pengar på att stötta elnätet.", script: "\"Ditt batteri kan tjäna pengar åt dig medan du sover. Genom att vara kopplat till elnätet hjälper det till att balansera frekvensen, och du får betalt för det.\"", listen: "Typiskt 1 000-4 000 kr/år. Kommer troligtvis öka." },
        { id: "R1-R8", action: "Räkna LIVE med kundens siffror", how: "Aldrig generella siffror. Alltid DERAS siffror. Kvantifiera överskott → Beräkna förlust/kWh → Multiplicera till årsförlust → Lägg på arbitrage → Visa redan förlorat → Månads/dagsperspektiv → Framtidsprojektion → Jämför med batterikostnad.", script: "\"Ni producerar [X kWh/år] och använder [Y%] själva. Det betyder [Z kWh] överskott per år. Med en spread på [kr], förlorar du [summa kr/år]. Det är [summa/365 kr] om dagen. Sedan ni fick sol för [X år] sen har ni gått miste om [totalt kr]. De pengarna kommer aldrig tillbaka.\"", listen: "Payback-tid under 5 år = starkt case. Visa 5-årig och 10-årig förlust utan batteri." },
      ]},
    { name: "5. Motivation mapping", time: "Min 14-16", goal: "Ta reda på VARFÖR de skaffade sol. Samma drivkraft säljer batteriet.", steps: ["Ekonomi → batteri på ekonomi", "Miljö → grön el dygnet runt", "Kontroll → oberoende av elnätet", "Social → grannarna tar nästa steg"],
      details: [
        { id: "5a", action: "Ekonomi / spara pengar", how: "De nämner elräkningen, ROI, payback, \"det lönar sig\".", script: "\"Du skaffade sol för att spara pengar. Problemet är att utan batteri sparar du bara hälften av vad du kunde. Batteriet gör att solinvesteringen faktiskt levererar det du trodde den skulle.\"", listen: "Koppla batteri till samma ekonomilogik de redan accepterat." },
        { id: "5b", action: "Miljö / hållbarhet", how: "De nämner klimat, grön el, \"göra rätt\".", script: "\"Du producerar 100% grön el. Men på kvällen köper du el som till stor del kommer från fossila källor. Med batteri använder du din egna gröna el dygnet runt.\"", listen: "Koppla batteri till deras gröna identitet." },
        { id: "5c", action: "Oberoende / kontroll", how: "De nämner elnätet, \"slippa vara beroende\".", script: "\"Du ville ha kontroll över din el. Men utan batteri är du fortfarande beroende av nätet varje kväll. Med batteri bestämmer du.\"", listen: "Backup vid strömavbrott + minskat beroende." },
        { id: "5d", action: "Grannen hade det / social", how: "De nämner vänner, grannar, trend.", script: "\"Du var tidig med sol. Nu tar grannarna nästa steg med batteri. Du som redan har sol har bästa utgångsläget.\"", listen: "FOMO + social status." },
      ]},
    { name: "6. Next step", time: "Min 18-22", goal: "Inbokat och bekräftat. Otydlighet = deal dör.", steps: ["Boka med datum + tid", "SMS-bekräftelse INNAN du lägger på", "Ge kunden uppgift (fyll i formulär)", "Sammanfatta samtalet i en mening"],
      details: [
        { id: "9a", action: "Boka nästa kontakt", how: "Aldrig \"jag hör av mig nästa vecka\". Alltid specifikt datum och tid.", script: "\"Jag ringer dig på onsdag klockan 17:00, funkar det?\" Ge TVÅ alternativ: \"Funkar onsdag 17 eller torsdag 18 bäst?\"", listen: "Vagt = dead deal." },
        { id: "9b", action: "SMS-bekräftelse", how: "Skicka medan du fortfarande pratar. Då vet du att de har rätt nummer.", script: "\"Jag skickar ett SMS nu direkt med sammanfattning och tid. Kolla att du fått det... Perfekt.\"", listen: "SMS: namn, datum/tid, vad kunden behöver göra." },
        { id: "9c", action: "Ge kunden en uppgift", how: "Micro-commitment. Aktiva kunder mellan samtalen = investerade.", script: "\"Det enda du behöver göra innan vi pratar nästa gång är att fylla i det korta formuläret. Tar 3 minuter.\"", listen: "Uppgiften ska vara ENKEL, SPECIFIK, med TYDLIGT SYFTE." },
        { id: "9d", action: "Sammanfatta i en mening", how: "Kunden ska kunna förklara för partner.", script: "\"Kort sammanfattat: du förlorar ungefär [X kr/år] utan batteri, och vi kan lösa det med en månadskostnad som är lägre än din nuvarande elräkning. Jag ringer onsdag 17:00.\"", listen: "Om kunden inte kan förklara = partnern säger nej av princip." },
      ]},
  ]},
  2: { title: "SAMTAL 2 — Presentera & stäng", subtitle: "ETT jobb: stänga dealen. Max 15-20 minuter. Du har redan byggt smärta, ethos och urgency.", timing: "15-20 minuter", sections: [
    { name: "1. Förberedelse", time: "Innan samtal", goal: "Vinns eller förloras INNAN du ringer.", steps: ["Gå igenom formulärsvar", "Räkna ut kalkyl med deras siffror", "Välj systemstorlek + produkt", "Planera close-sekvens baserat på DISC"],
      details: [
        { id: "1a", action: "Gå igenom formulärsvaren", how: "Notera avvikelser från samtal 1. Om du frågar nåt de redan svarat på ser du oförberedd ut.", script: "—", listen: "Systemstorlek? Förbrukning? Elbil? Elbolag? Partner nämnd?" },
        { id: "1b", action: "Räkna ut kalkylen", how: "Gör hela kalkylen INNAN. Ha besparingen i kr/år, kr/mån, kr/dag. Ha payback och livstidsbesparing.", script: "—", listen: "Årsbesparing? Månadsbesparing? Payback? Livstid 20 år? LF månadskostnad? Netto/mån?" },
        { id: "1c", action: "Välj rätt system", how: "Ha EN primär rekommendation och ETT alternativ. Inte tre, inte fem.", script: "—", listen: "Primär rekommendation? Alternativ? Varför just den?" },
        { id: "1d", action: "Planera close-sekvens", how: "Välj primär close-teknik och ha backup redo baserat på DISC-typ från samtal 1.", script: "—", listen: "Persontyp? Primär close? Backup? Förväntad invändning?" },
      ]},
    { name: "2. Öppning", time: "Min 0-2", goal: "Påminn om varför de ska lyssna. Max 60 sekunder.", steps: ["Hänvisa till samtal 1", "Bekräfta formulär ifyllt", "Sätt agenda: kalkyl → lösning → next step"],
      details: [
        { id: "2a", action: "Hänvisa till samtal 1", how: "Specifik detalj, inte generell. Aldrig: \"Hej, jag ringer om batteriet.\"", script: "\"Hej [namn]! Förra gången pratade vi om att du säljer tillbaka [X kWh/år] och att du förlorar ungefär [Y kr/mån]. Jag har räknat klart nu.\"", listen: "Kunden ska känna igen smärtan från samtal 1." },
        { id: "2b", action: "Bekräfta formulär", how: "Om ifyllt: bra. Om inte: fyll i live nu, 2 min.", script: "Om ifyllt: \"Jag har gått igenom det du skickade in, perfekt.\" Om ej: \"Vi fixar det nu, tar 2 minuter.\"", listen: "Ej ifyllt + vill ej göra det = rött flagg." },
        { id: "2c", action: "Sätt agenda", how: "Berätta vad som händer de närmaste 15 minuterna. Ger kontroll, sänker motstånd.", script: "\"Jag visar kalkylen med era siffror, vi kollar vilken lösning som passar bäst, och bestämmer nästa steg. Låter det bra?\"", listen: "Aldrig hoppa rakt in utan agenda." },
      ]},
    { name: "3. Kalkylpresentation", time: "Min 2-8", goal: "Siffrorna som stänger. Struktur: smärta → besparing → investering → netto → payback.", steps: ["Påminn om smärtan (30 sek)", "Presentera besparing — stapla rad för rad", "Visa nettot (KILLER-steget)", "Payback + livstidsbesparing"],
      details: [
        { id: "3a", action: "Påminn om smärtan", how: "Starta med smärtan, inte lösningen. 30 sekunder.", script: "\"Med er solproduktion på [X kWh] och egenanvändning på [Y%] förlorar ni [Z kr/år]. Sedan ni skaffade panelerna har det blivit [total förlust kr].\"", listen: "Röd: kort siffra. Gul: relaterbart. Grön: mjukt. Blå: exakt." },
        { id: "3b", action: "Stapla besparingarna", how: "Varje rad som adderas bygger value. Kunden ser fyra-fem separata inkomstkällor.", script: "\"Egenanvändning: [A kr/år]. Arbitrage: [B kr/år]. Nätnytta: [C kr/år]. Effekttoppar: [D kr/år]. Totalt: [summa kr/år] = [summa/12 kr/mån].\"", listen: "Kunden ska se att det inte bara är en sak." },
        { id: "3c", action: "Nettot (KILLER-steget)", how: "DET HÄR ÄR AVSLUTET I SIFFROR. Om nettot är positivt har kunden inget rationellt argument att säga nej.", script: "\"Besparing: [A kr/mån]. Kostnad: [B kr/mån]. Netto: du är plus [A-B kr/mån] från dag 1. Batteriet betalar för sig självt.\"", listen: "Pausa efter nettot. Tystnad-close naturligt inbyggd." },
        { id: "3d", action: "Payback + livstid", how: "Future pacing. Flytta kundens tidslinje förbi köpet.", script: "\"Batteriet är betalt efter [X] år. Sen sparar du [Y kr/år] i minst 15 år till. Total livstidsbesparing: [Z kr].\"", listen: "Röd: ROI. Gul: \"Tänk vad du kan göra med det.\" Grön: trygghet. Blå: kumulativ siffra." },
      ]},
    { name: "4. Close-sekvens", time: "Min 10-18", goal: "Gå på avslut. Punkt.", steps: ["Steg 1: Assumptive + Tystnad", "Steg 2: Invändning → Sharp Angle", "Steg 3: Sammanfattning + Netto", "Steg 4: Urgency / Takeaway", "Steg 5: Boka samtal 3 med partner"],
      details: [
        { id: "C1", action: "Assumptive Close + Tystnad", how: "Direkt efter kalkyl. Anta att de köper.", script: "\"Bra. Allt ser rätt ut. Jag bokar in hembesöket [dag] så kör vi igång. Funkar förmiddag eller eftermiddag?\" [TYST. Vänta.]", listen: "Invändning = gå till steg 2." },
        { id: "C2", action: "Sharp Angle", how: "Hantera invändningen. Koppla till villkorat avslut.", script: "\"Om jag löser [deras invändning] — kör vi då?\"", listen: "Ytterligare tveksamhet = steg 3." },
        { id: "C3", action: "Sammanfattnings-close", how: "Sammanfatta hela caset i 30 sekunder.", script: "\"Ni sparar [X kr/mån], kostnaden är [Y kr/mån], netto plus [X-Y]. 15 års garanti. Lokal service. Vi tar hand om allt. Ska vi köra?\"", listen: "Vill fortfarande inte = steg 4." },
        { id: "C4", action: "Urgency / Takeaway", how: "DISC-anpassat. Urgency för gul/röd, empati för grön.", script: "Urgency: \"Vi har [X] installationstider kvar i [månad].\" Takeaway (röd): \"Det kanske inte är rätt timing.\" Empati (grön): \"Första steget är bara hembesöket — inget bindande.\"", listen: "Fortfarande inte = steg 5." },
        { id: "C5", action: "Boka samtal 3 med partner", how: "Aldrig släpp utan next step.", script: "\"Vi tar ett kort samtal med dig och [partner] ihop. 15 min, inget bindande. Funkar [dag] klockan [tid]?\"", listen: "Om de inte vill boka alls: \"Kan jag ringa om 2 veckor?\"" },
      ]},
  ]},
  3: { title: "SAMTAL 3 — Partner-samtalet", subtitle: "Partnern har hört kundens version (alltid svagare). SISTA chansen. Om du inte stänger här är dealen med 80% sannolikhet död.", timing: "18-20 minuter", sections: [
    { name: "1. Förberedelse", time: "Dagen innan", goal: "Du säljer till TVÅ personer nu.", steps: ["Ring kunden innan", "Identifiera partnerns persontyp", "Förbered svar på invändningar", "Gör kunden till din allierade"],
      details: [
        { id: "1a", action: "Ring kunden innan", how: "1 dag innan. Fråga: \"Har du berättat? Vad sa partnern? Nåt specifikt hen undrar över?\"", script: "\"Hej [namn]! Vi ses med [partner] imorgon. Har du hunnit berätta lite om vad vi pratat om? Vad tyckte hen?\"", listen: "Partnerns temperatur bestämmer din strategi." },
        { id: "1b", action: "Identifiera partnerns typ", how: "Fråga: \"Är [partner] mer siffertyp eller magkänsle-människa?\" Ger DISC-hint.", script: "\"Är [partner] mer en som vill se alla siffror, eller mer magkänsla?\"", listen: "Du kanske sålde till gul — men partnern kan vara blå." },
        { id: "1c", action: "Förbered invändningssvar", how: "Ha 2-3 svar redo baserat på vad kunden berättat. Partner-invändningar = pris, timing, trovärdighet.", script: "—", listen: "Du har MAX 1 chans att besvara partnerns huvudinvändning." },
        { id: "1d", action: "Gör kunden till allierad", how: "\"Jag behöver din hjälp. Kan du berätta för [partner] varför du tycker det verkar bra?\"", script: "\"Hen lyssnar mer på dig än på mig. Om du kan berätta varför du tycker det ser bra ut hjälper det enormt.\"", listen: "Kunden som medförsäljare. Partnern litar mer på kunden." },
      ]},
    { name: "2. Rapport med partner", time: "Min 0-3", goal: "Från 'okänd säljare' till 'kunnig person'. 60 sekunder.", steps: ["Hälsa partnern med namn", "Ram: 'Jag är här för att svara på DINA frågor'", "Fråga partnern öppen fråga först"],
      details: [
        { id: "2a", action: "Hälsa partnern personligen", how: "Använd partnerns namn. Tacka för tiden. Visa respekt.", script: "\"Hej [partnerns namn]! Tack för att du tar dig tid. [Kundens namn] berättade att ni tar beslut ihop, och det tycker jag är jättebra.\"", listen: "ALDRIG börja med att prata med kunden. Partnern ska känna att samtalet är för HEN." },
        { id: "2b", action: "Ge partnern kontroll", how: "De vill inte bli sålda till — de vill fatta informerat beslut.", script: "\"Jag visar snabbt siffrorna, sen är jag helt öppen för dina frågor. Det är dina frågor som styr. Låter det bra?\"", listen: "Partnern i förarsätet. Kritiskt för gröna och blåa partners." },
        { id: "2c", action: "Öppen fråga", how: "Ge partnern chans att prata FÖRST. Avslöjar persontyp och orosmoment.", script: "\"Innan jag visar nåt — har [kundens namn] berättat lite? Vad är din känsla hittills?\"", listen: "Första svaret berättar ALLT: skeptisk, nyfiken eller neutral." },
      ]},
    { name: "3. Mini-pitch", time: "Min 3-8", goal: "Hela caset komprimerat till 5 min. Smärta → Redan förlorat → Lösning → Siffror → Social proof.", steps: ["Smärtan (60 sek)", "Redan förlorat (30 sek)", "Lösningen (60 sek)", "Siffrorna (90 sek)", "Social proof (30 sek)"],
      details: [
        { id: "3a", action: "Smärtan (60 sek)", how: "Komprimerad version av samtal 1.", script: "\"Kort version: ni producerar [X kWh/år] men bara [Y%] används hemma. Resten säljer ni för [Z öre/kWh] och köper tillbaka samma el för [Å kr/kWh]. Det gapet kostar er [summa kr/år].\"", listen: "\"Oj, det visste jag inte\" eller \"Stämmer det?\" = bra, du har deras uppmärksamhet." },
        { id: "3b", action: "Redan förlorat (30 sek)", how: "Sunk cost — gör det personligt.", script: "\"Sedan ni skaffade panelerna för [X] år sen har ni gått miste om ungefär [total förlust kr]. Varje månad tickar det vidare med [månadsförlust kr].\"", listen: "Obekvämt = bra. Samma emotionella shift, men komprimerat." },
        { id: "3c", action: "Lösningen (60 sek)", how: "Kort och tydlig.", script: "\"Ett batteri lagrar överskottselen. Egenanvändningen går från [Y%] till [ny Y%]. Plus arbitrage, nätnytta, effekttoppar. Total besparing: [X kr/år].\"", listen: "\"Vad kostar det?\" = köpsignal." },
        { id: "3d", action: "Siffrorna (90 sek)", how: "Investering → Finansiering → Netto → Payback → Livstid.", script: "\"Investeringen: [totalpris]. Finansiering: [Y kr/mån]. Besparing: [Z kr/mån]. Netto: ni är plus [Z-Y kr/mån] från dag 1. Payback: [A] år. Livstid: [B kr].\"", listen: "\"Det låter bra, men...\" = invändning incoming. Bra." },
        { id: "3e", action: "Social proof (30 sek)", how: "Lokal, specifik, namngivet.", script: "\"Vi har installerat [X] system i [område]. Familjen [namn] har liknande setup och sparar [Y kr/mån]. Jag kan ge er deras nummer.\"", listen: "Social proof landar hårdare mot ny person." },
      ]},
    { name: "4. Close-sekvens", time: "Min 12-18", goal: "EN chans. Låt kunden hjälpa stänga.", steps: ["Kund-endorsed close", "Partnerns fråga → Sharp Angle", "Gemensamt beslut + Trygghet", "Om total nej: Lär dig och gå vidare"],
      details: [
        { id: "C1", action: "Kund-endorsed close", how: "Låt kunden stänga. Partnern litar mer på kunden.", script: "\"[Kundens namn], du har sett siffrorna och pratat med mig. Vad tänker du — ska vi köra?\" [Kunden: \"Ja.\"] \"[Partner], vad tänker du?\"", listen: "Partnern tvekar = steg 2." },
        { id: "C2", action: "Sharp Angle på partnerns fråga", how: "Vänta på invändning. Hantera. Koppla till villkorat avslut.", script: "\"Om jag kan [lösa deras oro] — kan vi gå vidare då?\"", listen: "Fler frågor = besvara alla, sedan steg 3." },
        { id: "C3", action: "Gemensamt beslut + trygghet", how: "Empati + sammanfattning. Sänk ribban.", script: "\"Jag förstår att det är stort att ta ihop. [Besparing], [netto], [garanti], [lokal service]. Första steget är bara hembesöket — inget bindande. Ska vi boka det?\"", listen: "Fortfarande nej = steg 4." },
        { id: "C4", action: "Om total nej: lär dig", how: "Ärlig fråga. Skicka tack-SMS.", script: "\"Jag respekterar det. Kan jag fråga — vad hade behövt vara annorlunda för att ni sagt ja? Jag frågar för att bli bättre.\"", listen: "LYSSNA. Anteckna. Det är guld för framtida samtal." },
      ]},
  ]},
};

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
// XP & GAMIFICATION SYSTEM
// ═══════════════════════════════════════════════════════════════
const XP_ACTIONS = {
  login: 10, quiz_complete: 50, quiz_perfect: 100, checkin: 30, ai_question: 5, lesson_complete: 40,
};

const BADGES = [
  { id: "first_login", name: "Ny Rekryt", desc: "Logga in första gången", icon: "🎯", xpReq: 0 },
  { id: "quiz_master", name: "Quizkung", desc: "Få 100% på ett quiz", icon: "🧠", xpReq: 100 },
  { id: "streak_3", name: "3-dagars streak", desc: "Logga in 3 dagar i rad", icon: "🔥", xpReq: 0 },
  { id: "streak_7", name: "Veckokrirare", desc: "Logga in 7 dagar i rad", icon: "⚡", xpReq: 0 },
  { id: "ai_explorer", name: "AI-utforskare", desc: "Ställ 10 frågor till AI", icon: "🤖", xpReq: 50 },
  { id: "closer", name: "Closer", desc: "Nå nivå 2", icon: "🎖️", xpReq: 200 },
  { id: "specialist", name: "Specialist", desc: "Nå nivå 3", icon: "⭐", xpReq: 500 },
  { id: "expert", name: "Expert", desc: "Nå nivå 4", icon: "👑", xpReq: 1000 },
  { id: "legend", name: "Legend", desc: "Nå nivå 5", icon: "🏆", xpReq: 2000 },
];

const LEVELS = [
  { name: "Rookie", minXp: 0, color: "#6B7280" },
  { name: "Closer", minXp: 200, color: "#059669" },
  { name: "Specialist", minXp: 500, color: "#3B82F6" },
  { name: "Expert", minXp: 1000, color: "#8B5CF6" },
  { name: "Legend", minXp: 2000, color: "#F59E0B" },
];

function getLevel(xp) {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].minXp) return { ...LEVELS[i], index: i };
  }
  return { ...LEVELS[0], index: 0 };
}

function getXpProgress(xp) {
  const current = getLevel(xp);
  const nextIdx = Math.min(current.index + 1, LEVELS.length - 1);
  const next = LEVELS[nextIdx];
  if (current.index === LEVELS.length - 1) return { current, next: current, progress: 100, xpToNext: 0 };
  const progress = ((xp - current.minXp) / (next.minXp - current.minXp)) * 100;
  return { current, next, progress: Math.min(progress, 100), xpToNext: next.minXp - xp };
}

// Gamification state helper
function useGamification(profileId) {
  const key = `xp_${profileId || 'anon'}`;
  const [xp, setXp] = useState(() => {
    const saved = localStorage.getItem(key);
    return saved ? parseInt(saved) : 0;
  });
  const [streak, setStreak] = useState(() => {
    const saved = JSON.parse(localStorage.getItem(`streak_${profileId || 'anon'}`) || '{"count":0,"lastDate":""}');
    return saved;
  });

  const addXp = useCallback((amount) => {
    setXp(prev => {
      const next = prev + amount;
      localStorage.setItem(key, next.toString());
      return next;
    });
  }, [key]);

  const checkStreak = useCallback(() => {
    const today = new Date().toDateString();
    const sKey = `streak_${profileId || 'anon'}`;
    const saved = JSON.parse(localStorage.getItem(sKey) || '{"count":0,"lastDate":""}');
    if (saved.lastDate === today) return saved.count;
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    const newStreak = saved.lastDate === yesterday ? saved.count + 1 : 1;
    const data = { count: newStreak, lastDate: today };
    localStorage.setItem(sKey, JSON.stringify(data));
    setStreak(data);
    return newStreak;
  }, [profileId]);

  return { xp, addXp, streak: streak.count, checkStreak, level: getLevel(xp), progress: getXpProgress(xp) };
}

// ═══════════════════════════════════════════════════════════════
// UI COMPONENTS — GREEN/WHITE THEME
// ═══════════════════════════════════════════════════════════════
const Card = ({ children, className = "", onClick, hover = true }) => (
  <div onClick={onClick} className={`bg-white rounded-2xl border border-gray-100 p-6 ${hover ? "hover:shadow-md hover:border-gray-200" : ""} shadow-sm transition-all duration-200 ${onClick ? "cursor-pointer" : ""} ${className}`}>{children}</div>
);

const Badge = ({ text, color = T.primary, bg }) => (
  <span className="text-xs font-bold px-2.5 py-1 rounded-lg" style={{ background: bg || `${color}15`, color }}>{text}</span>
);

const ProgressBar = ({ value, max = 100, color = T.primary, height = "h-2", className = "" }) => (
  <div className={`w-full bg-gray-100 rounded-full ${height} overflow-hidden ${className}`}>
    <div className={`${height} rounded-full transition-all duration-500`} style={{ width: `${Math.min((value / max) * 100, 100)}%`, background: color }} />
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

  const handleKeyDown = (idx, e) => {
    if (e.key === "Backspace" && !pin[idx] && idx > 0) pinRefs[idx - 1].current?.focus();
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
        const isAdmin = ADMIN_PINS.includes(pinCode);
        const profile = { name: p.name, pin: p.pin, discType: p.disc_type, secondaryType: p.disc_secondary, aspectScores, answers: p.disc_answers || [], supabaseId: p.id, isAdmin };
        localStorage.setItem("salj_profile", JSON.stringify(profile));
        onLogin(profile);
      } else { setError("Fel PIN-kod"); }
    } catch (e) { setError("Fel vid inloggning"); } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-green-50 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-green-600 rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-emerald-500/25 transform rotate-3">
            <Leaf size={36} className="text-white transform -rotate-3" />
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Proffskontakt</h1>
          <p className="text-emerald-600 text-sm font-semibold mt-1 tracking-wide">SÄLJTRÄNING</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-gray-100 p-8 shadow-xl shadow-gray-200/50">
          <label className="block text-sm font-semibold text-gray-900 mb-4 text-center">Ange din PIN-kod</label>
          <div className="flex gap-3 justify-center mb-6">
            {pin.map((p, i) => (
              <input key={i} ref={pinRefs[i]} type="text" inputMode="numeric" maxLength="1" value={p}
                onChange={(e) => handlePinChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                className="w-14 h-14 text-center text-2xl font-bold border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50 focus:outline-none transition-all bg-gray-50" />
            ))}
          </div>
          {error && <div className="text-red-500 text-sm text-center mb-4 font-medium bg-red-50 rounded-lg py-2">{error}</div>}
          <button type="submit" disabled={loading} className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-xl font-semibold hover:from-emerald-600 hover:to-green-700 disabled:from-gray-300 disabled:to-gray-300 transition-all shadow-lg shadow-emerald-500/20 mb-3">
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
// DISC TEST — FULLSCREEN ONBOARDING GATE
// ═══════════════════════════════════════════════════════════════
const DiscTest = ({ onComplete }) => {
  const [phase, setPhase] = useState("intro");
  const [name, setName] = useState("");
  const [pin, setPin] = useState(["","","",""]);
  const pinRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState(new Array(DISC_QUESTIONS.length).fill(null));
  const [optionOrder] = useState(() => DISC_QUESTIONS.map(q => shuffle(q.options)));
  const [showResult, setShowResult] = useState(false);
  const [result, setResult] = useState(null);

  const handleAnswer = (type) => {
    const newA = [...answers]; newA[currentQ] = type; setAnswers(newA);
    if (currentQ < DISC_QUESTIONS.length - 1) {
      setTimeout(() => setCurrentQ(currentQ + 1), 150);
    } else {
      finishTest(newA);
    }
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
    const r = { name, pin: pin.join(""), discType: sorted[0][0], secondaryType: sorted[1][0], aspectScores, answers: finalAnswers };
    setResult(r);
    setShowResult(true);
  };

  const handlePinChange = (idx, val) => { const n = [...pin]; n[idx] = val.slice(-1); setPin(n); if(n[idx] && idx < 3) pinRefs[idx+1].current?.focus(); };

  // Result screen
  if (showResult && result) {
    const fullP = DISC_PROFILES_FULL[result.discType];
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-green-50 flex items-center justify-center p-6">
        <div className="w-full max-w-lg">
          <div className="text-center mb-8">
            <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-4 text-5xl" style={{ background: `${DISC_COLORS[result.discType]}15` }}>
              {DISC_EMOJI[result.discType]}
            </div>
            <h1 className="text-3xl font-extrabold text-gray-900">Du är {fullP.name}!</h1>
            <p className="text-gray-500 mt-2">{fullP.archetype}</p>
          </div>
          <Card hover={false} className="mb-6">
            <p className="text-gray-700 text-center leading-relaxed">{fullP.oneLiner}</p>
          </Card>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <Card hover={false} className="!p-4">
              <p className="text-xs font-bold text-emerald-600 mb-2">SUPERKRAFTER</p>
              {fullP.superpowers.slice(0,2).map((s,i) => <p key={i} className="text-xs text-gray-600 mb-1">+ {s}</p>)}
            </Card>
            <Card hover={false} className="!p-4">
              <p className="text-xs font-bold text-red-500 mb-2">BLINDSPOTS</p>
              {fullP.blindspots.slice(0,2).map((s,i) => <p key={i} className="text-xs text-gray-600 mb-1">- {s}</p>)}
            </Card>
          </div>
          <button onClick={() => onComplete(result)} className="w-full py-4 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-xl font-bold text-lg hover:from-emerald-600 hover:to-green-700 transition-all shadow-lg shadow-emerald-500/20">
            Starta din träning →
          </button>
        </div>
      </div>
    );
  }

  // Intro screen
  if (phase === "intro") return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-green-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/20">
            <Brain size={28} className="text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">DISC Personlighetstest</h1>
          <p className="text-gray-500 mt-2">{DISC_QUESTIONS.length} frågor — upptäck din försäljarprofil</p>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); if(name.trim() && pin.join("").length === 4) setPhase("quiz"); }} className="bg-white rounded-3xl border border-gray-100 p-8 shadow-xl shadow-gray-200/50 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Ditt namn</label>
            <input type="text" value={name} onChange={e=>setName(e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50 focus:outline-none bg-gray-50" placeholder="Förnamn Efternamn" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Välj en 4-siffrig PIN</label>
            <div className="flex gap-3 justify-center">
              {pin.map((p,i) => <input key={i} ref={pinRefs[i]} type="text" inputMode="numeric" maxLength="1" value={p} onChange={e=>handlePinChange(i,e.target.value)} className="w-14 h-14 text-center text-2xl font-bold border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:outline-none bg-gray-50" />)}
            </div>
          </div>
          <button type="submit" disabled={!name.trim() || pin.join("").length !== 4} className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-xl font-semibold hover:from-emerald-600 hover:to-green-700 disabled:from-gray-300 disabled:to-gray-300 transition-all shadow-lg shadow-emerald-500/20">
            Starta testet
          </button>
        </form>
      </div>
    </div>
  );

  // Quiz
  const q = DISC_QUESTIONS[currentQ];
  const progress = ((currentQ+1)/DISC_QUESTIONS.length)*100;
  const aspectLabels = { WORK: "Arbete", SALES: "Sälj", STRESS: "Stress", DECIDE: "Beslut", CONFLICT: "Konflikt", SOCIAL: "Social" };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-green-50 p-6">
      <div className="max-w-2xl mx-auto pt-8">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-bold text-gray-900">{currentQ+1} / {DISC_QUESTIONS.length}</span>
          <Badge text={aspectLabels[q.aspect] || q.aspect} color={T.primary} />
        </div>
        <ProgressBar value={progress} color={T.primary} className="mb-8" />

        <Card hover={false} className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6 leading-relaxed">{q.q}</h2>
          <div className="space-y-3">
            {(optionOrder[currentQ]||q.options).map((opt,i) => (
              <button key={i} onClick={() => handleAnswer(opt.type)}
                className="w-full p-4 text-left border-2 border-gray-100 rounded-xl hover:border-emerald-300 hover:bg-emerald-50/50 transition-all text-gray-900 font-medium active:scale-[0.98]">
                {opt.text}
              </button>
            ))}
          </div>
        </Card>

        {currentQ > 0 && (
          <button onClick={() => setCurrentQ(currentQ - 1)} className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1">
            <ChevronLeft size={16} /> Föregående
          </button>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// SIDEBAR NAVIGATION
// ═══════════════════════════════════════════════════════════════
const Sidebar = ({ page, setPage, profile, xp, streak, onLogout, dark, setDark }) => {
  const level = getLevel(xp);
  const progress = getXpProgress(xp);

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: Home },
    { id: "coach", label: "AI Säljcoach", icon: Bot },
    { id: "expert", label: "Batteriexperten", icon: Battery },
    { id: "training", label: "Utbildning", icon: GraduationCap },
    { id: "checkin", label: "Check-in", icon: Activity },
  ];

  if (profile?.isAdmin) {
    navItems.push({ id: "admin", label: "Admin", icon: Settings });
  }

  return (
    <div className={`w-64 flex flex-col h-screen fixed left-0 top-0 z-30 border-r transition-colors duration-300 ${dark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-100"}`}>
      {/* Logo */}
      <div className="p-6 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl flex items-center justify-center shadow-sm">
            <Leaf size={20} className="text-white" />
          </div>
          <div>
            <h1 className={`text-sm font-extrabold tracking-tight ${dark ? "text-gray-100" : "text-gray-900"}`}>Proffskontakt</h1>
            <p className="text-xs text-emerald-500 font-semibold">Säljträning</p>
          </div>
        </div>
      </div>

      {/* Profile card */}
      <div className={`mx-4 mb-4 p-3 rounded-xl border transition-colors ${dark ? "bg-gray-800/50 border-gray-700" : "bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-100"}`}>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ background: DISC_COLORS[profile?.discType] || T.primary }}>
            {profile?.name?.[0] || "?"}
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-bold truncate ${dark ? "text-gray-100" : "text-gray-900"}`}>{profile?.name}</p>
            <p className={`text-xs ${dark ? "text-gray-400" : "text-gray-500"}`}>{level.name} • {DISC_SHORT[profile?.discType]}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ProgressBar value={progress.progress} height="h-1.5" color={level.color} className="flex-1" />
          <span className="text-xs font-bold" style={{ color: level.color }}>{xp} XP</span>
        </div>
        {streak > 0 && <div className="flex items-center gap-1 mt-1.5"><Flame size={12} className="text-orange-500" /><span className="text-xs font-semibold text-orange-600">{streak} dagars streak</span></div>}
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 space-y-1">
        {navItems.map(item => {
          const active = page === item.id;
          return (
            <button key={item.id} onClick={() => setPage(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                active
                  ? dark ? "bg-emerald-900/30 text-emerald-400 font-semibold" : "bg-emerald-50 text-emerald-700 font-semibold"
                  : dark ? "text-gray-400 hover:text-gray-200 hover:bg-gray-800" : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
              }`}>
              <item.icon size={18} className={active ? dark ? "text-emerald-400" : "text-emerald-600" : ""} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Theme toggle + Logout */}
      <div className={`p-4 border-t space-y-1 ${dark ? "border-gray-800" : "border-gray-50"}`}>
        <button onClick={() => setDark(!dark)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${dark ? "text-gray-400 hover:text-amber-400 hover:bg-gray-800" : "text-gray-400 hover:text-amber-600 hover:bg-amber-50"}`}>
          {dark ? <Sun size={18} /> : <Moon size={18} />} {dark ? "Ljust tema" : "Mörkt tema"}
        </button>
        <button onClick={onLogout} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${dark ? "text-gray-500 hover:text-red-400 hover:bg-red-900/20" : "text-gray-400 hover:text-red-500 hover:bg-red-50"}`}>
          <LogOut size={18} /> Logga ut
        </button>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════
const Dashboard = ({ profile, setPage, xp, addXp, streak }) => {
  const level = getLevel(xp);
  const progress = getXpProgress(xp);
  const fullP = DISC_PROFILES_FULL[profile?.discType];
  const [quizScores] = useState(() => JSON.parse(localStorage.getItem("salj_quiz_scores") || "[]"));

  const [discDetailOpen, setDiscDetailOpen] = useState(false);
  const [discDetailAspect, setDiscDetailAspect] = useState(null);

  // DISC Circular Radar Chart — maps all 50 answers across 4 colors and 6 aspects
  const DiscRadarChart = ({ size = 260, clickable = true }) => {
    const aspects = ["WORK","SALES","STRESS","DECIDE","CONFLICT","SOCIAL"];
    const labels = ["Arbete","Sälj","Stress","Beslut","Konflikt","Social"];
    const cx = size / 2, cy = size / 2, maxR = size * 0.38;
    const rings = [0.25, 0.5, 0.75, 1.0];
    const angleStep = (2 * Math.PI) / aspects.length;
    const startAngle = -Math.PI / 2;

    const getPoint = (i, ratio) => {
      const angle = startAngle + i * angleStep;
      return { x: cx + maxR * ratio * Math.cos(angle), y: cy + maxR * ratio * Math.sin(angle) };
    };

    const colorKeys = ["R", "Y", "Gr", "B"];
    const paths = colorKeys.map(colorKey => {
      const points = aspects.map((asp, i) => {
        const pct = profile?.aspectScores?.[asp]?.percents?.[colorKey] || 0;
        return getPoint(i, pct / 100);
      });
      const d = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";
      return { key: colorKey, d, color: DISC_COLORS[colorKey], points };
    });

    const aspectContexts = {
      WORK: { title: "Arbete", desc: "Hur du fungerar i din arbetsroll — ditt tempo, dina prioriteringar och vad som driver dig i jobbet.", icon: Dumbbell },
      SALES: { title: "Sälj", desc: "Hur du säljer naturligt — din approach, dina styrkor och blinda fläckar i säljsamtalet.", icon: Target },
      STRESS: { title: "Stress", desc: "Hur du reagerar under press — din copingstrategi och vad som händer när det blir tufft.", icon: Zap },
      DECIDE: { title: "Beslut", desc: "Hur du fattar beslut — snabbt på magkänsla eller metodiskt med all data.", icon: Brain },
      CONFLICT: { title: "Konflikt", desc: "Hur du hanterar konflikter — konfronterar, medlar, undviker eller analyserar.", icon: Swords },
      SOCIAL: { title: "Social", desc: "Hur du fungerar socialt — din energi, hur du bygger relationer och vad som laddar dig.", icon: Users },
    };

    return (
      <div>
        <svg viewBox={`0 0 ${size} ${size}`} className="w-full" style={{ maxWidth: size }}>
          {/* Background rings */}
          {rings.map(r => (
            <polygon key={r} points={aspects.map((_, i) => { const p = getPoint(i, r); return `${p.x},${p.y}`; }).join(" ")}
              fill="none" stroke="#E5E7EB" strokeWidth="0.5" opacity={0.6} />
          ))}
          {/* Axis lines */}
          {aspects.map((_, i) => {
            const p = getPoint(i, 1);
            return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#E5E7EB" strokeWidth="0.5" opacity={0.4} />;
          })}
          {/* Color areas — sorted so dominant is on top */}
          {[...paths].sort((a, b) => {
            const aMax = Math.max(...aspects.map((asp) => profile?.aspectScores?.[asp]?.percents?.[a.key] || 0));
            const bMax = Math.max(...aspects.map((asp) => profile?.aspectScores?.[asp]?.percents?.[b.key] || 0));
            return aMax - bMax;
          }).map(p => (
            <path key={p.key} d={p.d} fill={p.color} fillOpacity={0.15} stroke={p.color} strokeWidth="1.5" strokeOpacity={0.7} />
          ))}
          {/* Dots at data points */}
          {paths.map(p => p.points.map((pt, i) => {
            const pct = profile?.aspectScores?.[aspects[i]]?.percents?.[p.key] || 0;
            if (pct < 10) return null;
            return <circle key={`${p.key}-${i}`} cx={pt.x} cy={pt.y} r="3" fill={p.color} opacity={0.8} />;
          }))}
          {/* Labels */}
          {aspects.map((asp, i) => {
            const p = getPoint(i, 1.18);
            const dom = profile?.aspectScores?.[asp]?.dominant || profile?.discType;
            return (
              <g key={asp} onClick={clickable ? () => { setDiscDetailAspect(asp); setDiscDetailOpen(true); } : undefined}
                style={clickable ? { cursor: "pointer" } : {}}>
                <text x={p.x} y={p.y - 6} textAnchor="middle" className="text-[10px] font-bold fill-gray-700">{labels[i]}</text>
                <text x={p.x} y={p.y + 6} textAnchor="middle" className="text-[9px] font-semibold" fill={DISC_COLORS[dom]}>{DISC_SHORT[dom]}</text>
              </g>
            );
          })}
          {/* Center label */}
          <text x={cx} y={cy - 4} textAnchor="middle" className="text-[11px] font-extrabold" fill={DISC_COLORS[profile?.discType]}>{DISC_SHORT[profile?.discType]}</text>
          <text x={cx} y={cy + 9} textAnchor="middle" className="text-[7px] font-medium fill-gray-400">PROFIL</text>
        </svg>
        {/* Color legend */}
        <div className="flex justify-center gap-4 mt-2">
          {colorKeys.map(k => (
            <div key={k} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: DISC_COLORS[k] }} />
              <span className="text-xs text-gray-500 font-medium">{DISC_SHORT[k]}</span>
            </div>
          ))}
        </div>
        {clickable && <p className="text-center text-xs text-gray-400 mt-2">Klicka på en kategori för att lära dig mer</p>}

        {/* Detail Modal */}
        {discDetailOpen && discDetailAspect && (() => {
          const asp = discDetailAspect;
          const data = profile?.aspectScores?.[asp];
          const ctx = aspectContexts[asp];
          const dom = data?.dominant || profile?.discType;
          const fullProfile = DISC_PROFILES_FULL[dom];
          const AspIcon = ctx.icon;
          const sortedColors = Object.entries(data?.percents || {}).sort(([,a],[,b]) => b - a);
          return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setDiscDetailOpen(false)}>
              <div className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: `${DISC_COLORS[dom]}12` }}>
                      <AspIcon size={22} style={{ color: DISC_COLORS[dom] }} />
                    </div>
                    <div>
                      <h3 className="text-lg font-extrabold text-gray-900">{ctx.title}</h3>
                      <p className="text-xs text-gray-400">Dominant: {DISC_NAMES[dom]}</p>
                    </div>
                  </div>
                  <button onClick={() => setDiscDetailOpen(false)} className="p-2 hover:bg-gray-100 rounded-xl"><X size={20} className="text-gray-400" /></button>
                </div>
                <p className="text-sm text-gray-600 mb-5">{ctx.desc}</p>

                {/* Color breakdown bars */}
                <div className="space-y-3 mb-6">
                  {sortedColors.map(([key, pct]) => (
                    <div key={key}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold" style={{ color: DISC_COLORS[key] }}>{DISC_NAMES[key]}</span>
                        <span className="text-sm font-bold text-gray-700">{Math.round(pct)}%</span>
                      </div>
                      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: DISC_COLORS[key] }} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* What this means for you */}
                <div className="p-4 rounded-xl border-l-4 mb-4" style={{ borderColor: DISC_COLORS[dom], background: `${DISC_COLORS[dom]}08` }}>
                  <p className="text-xs font-semibold tracking-wide mb-2" style={{ color: DISC_COLORS[dom] }}>VAD DET INNEBÄR FÖR DIG</p>
                  <p className="text-sm text-gray-700">
                    {asp === "WORK" && dom === "R" && "Du är resultatdriven och tar naturligt ledarskap. Du gillar självständighet och mål du kan jaga. Risk: du kör över teamet."}
                    {asp === "WORK" && dom === "Y" && "Du trivs i kreativa, sociala arbetsmiljöer. Du drivs av variation och energi. Risk: rutinjobb tappar dig."}
                    {asp === "WORK" && dom === "Gr" && "Du trivs med stabilitet och tydliga strukturer. Du är pålitlig och stabil. Risk: du undviker förändring."}
                    {asp === "WORK" && dom === "B" && "Du trivs med expertis och kvalitet. Du vill göra rätt och gör research. Risk: perfektionism bromsar dig."}
                    {asp === "SALES" && dom === "R" && "Du stänger snabbt och driver samtalet framåt. Kunder respekterar din direkthet. Risk: du kör över mjuka kunder."}
                    {asp === "SALES" && dom === "Y" && "Du bygger rapport snabbt och säljer med energi. Kunder gillar dig. Risk: du glömmer gå på avslut."}
                    {asp === "SALES" && dom === "Gr" && "Du bygger förtroende över tid. Kunder känner sig trygga. Risk: du väntar för länge med avslut."}
                    {asp === "SALES" && dom === "B" && "Du säljer med kompetens och data. Tekniska kunder älskar dig. Risk: du överförklarar."}
                    {asp === "STRESS" && dom === "R" && "Under press tar du kontroll och agerar. Du fattar snabba beslut. Risk: du blir aggresiv och okänslig."}
                    {asp === "STRESS" && dom === "Y" && "Under press söker du stöd och pratar dig igenom det. Risk: du undviker det svåra genom att fokusera på det roliga."}
                    {asp === "STRESS" && dom === "Gr" && "Under press drar du dig tillbaka och behöver trygghet. Du är tålmodig. Risk: du fryser fast."}
                    {asp === "STRESS" && dom === "B" && "Under press analyserar du mer. Du söker fakta och kontroll. Risk: analys-paralys."}
                    {asp === "DECIDE" && dom === "R" && "Du fattar snabba beslut baserat på magkänsla och mål. Risk: du missar detaljer."}
                    {asp === "DECIDE" && dom === "Y" && "Du fattar beslut baserat på entusiasm och intuition. Risk: impulsiva val du ångrar."}
                    {asp === "DECIDE" && dom === "Gr" && "Du fattar beslut långsamt med konsensus. Du vill att alla ska vara med. Risk: beslutsvånda."}
                    {asp === "DECIDE" && dom === "B" && "Du fattar beslut baserat på data och analys. Metodisk och noggrann. Risk: du aldrig känner att du har tillräckligt med data."}
                    {asp === "CONFLICT" && dom === "R" && "Du konfronterar direkt och vill lösa snabbt. Risk: du skapar mer konflikt genom att vara för hård."}
                    {asp === "CONFLICT" && dom === "Y" && "Du försöker charma bort konflikten. Risk: du löser aldrig grundproblemet."}
                    {asp === "CONFLICT" && dom === "Gr" && "Du undviker konflikt och söker harmoni. Risk: du sväljer frustration tills det exploderar."}
                    {asp === "CONFLICT" && dom === "B" && "Du hanterar konflikt med logik och fakta. Risk: du framstår som kall och okänslig."}
                    {asp === "SOCIAL" && dom === "R" && "Du är selektiv socialt — du gillar folk som levererar. Risk: ytliga relationer."}
                    {asp === "SOCIAL" && dom === "Y" && "Du är rummets energi. Du älskar folk och fest. Risk: du är för beroende av bekräftelse."}
                    {asp === "SOCIAL" && dom === "Gr" && "Du har få men djupa relationer. Du är lojal och omtänksam. Risk: du öppnar inte upp för nya."}
                    {asp === "SOCIAL" && dom === "B" && "Du föredrar djupa samtal framför small talk. Risk: du framstår som distanserad."}
                  </p>
                </div>

                {/* Tip */}
                <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                  <p className="text-xs font-semibold text-emerald-700 tracking-wide mb-1">TIPS FÖR DIG</p>
                  <p className="text-sm text-gray-700">{fullProfile?.calibration}</p>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Welcome header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Hej, {profile?.name}! 👋</h1>
          <p className="text-gray-500 mt-0.5">Redo att bli en bättre säljare idag?</p>
        </div>
        <div className="flex items-center gap-3">
          {streak > 0 && (
            <div className="flex items-center gap-2 bg-orange-50 px-4 py-2 rounded-xl border border-orange-100">
              <Flame size={18} className="text-orange-500" />
              <span className="text-sm font-bold text-orange-700">{streak} dagar</span>
            </div>
          )}
          <div className="flex items-center gap-2 bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-100">
            <Sparkles size={18} className="text-emerald-500" />
            <span className="text-sm font-bold text-emerald-700">{xp} XP</span>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card hover={false} className="!p-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: `${DISC_COLORS[profile?.discType]}12` }}>
              <span className="text-xl">{DISC_EMOJI[profile?.discType]}</span>
            </div>
            <div>
              <p className="text-xs text-gray-400">DISC-typ</p>
              <p className="text-lg font-bold text-gray-900">{DISC_SHORT[profile?.discType]}</p>
            </div>
          </div>
        </Card>
        <Card hover={false} className="!p-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center">
              <Crown size={20} className="text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Nivå</p>
              <p className="text-lg font-bold" style={{ color: level.color }}>{level.name}</p>
            </div>
          </div>
        </Card>
        <Card hover={false} className="!p-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-purple-50 flex items-center justify-center">
              <Trophy size={20} className="text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Quiz-score</p>
              <p className="text-lg font-bold text-gray-900">{quizScores.length > 0 ? `${Math.round(quizScores.reduce((a,b) => a + (b.score/b.maxScore*100), 0) / quizScores.length)}%` : "—"}</p>
            </div>
          </div>
        </Card>
        <Card hover={false} className="!p-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center">
              <Target size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Till nästa nivå</p>
              <p className="text-lg font-bold text-gray-900">{progress.xpToNext} XP</p>
            </div>
          </div>
        </Card>
      </div>

      {/* XP Progress */}
      <Card hover={false} className="!p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold text-gray-900">{level.name}</span>
          <span className="text-sm font-bold" style={{ color: progress.next.color }}>{progress.next.name}</span>
        </div>
        <ProgressBar value={progress.progress} color={level.color} height="h-3" />
        <p className="text-xs text-gray-400 mt-2 text-center">{Math.round(progress.progress)}% — {progress.xpToNext} XP kvar</p>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* DISC Profile */}
        <Card hover={false}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold text-gray-900">Din DISC-profil</h3>
            <Badge text={fullP?.archetype || ""} color={DISC_COLORS[profile?.discType]} />
          </div>
          <p className="text-sm text-gray-600 mb-4">{fullP?.oneLiner}</p>
          <DiscRadarChart />
        </Card>

        {/* Quick actions */}
        <Card hover={false}>
          <h3 className="text-lg font-bold text-gray-900 mb-4">Snabbstart</h3>
          <div className="space-y-2">
            {[
              { label: "AI Säljcoach", desc: "Personlig coaching", icon: Bot, page: "coach", color: T.primary },
              { label: "Batteriexperten", desc: "Produktkunskap", icon: Battery, page: "expert", color: "#10B981" },
              { label: "Quiz", desc: "Testa dina kunskaper", icon: Brain, page: "training", color: T.purple },
              { label: "Samtalsguide", desc: "Steg-för-steg blueprint", icon: Phone, page: "training", color: T.blue },
            ].map((item,i) => (
              <button key={i} onClick={() => setPage(item.page)} className="w-full flex items-center gap-4 p-3 rounded-xl text-left transition-all hover:bg-gray-50 group active:scale-[0.99]">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center transition-all" style={{ background: `${item.color}12` }}>
                  <item.icon size={18} style={{ color: item.color }} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">{item.label}</p>
                  <p className="text-xs text-gray-400">{item.desc}</p>
                </div>
                <ChevronRight size={16} className="text-gray-200 group-hover:text-gray-400" />
              </button>
            ))}
          </div>
        </Card>
      </div>

      {/* Badges */}
      <Card hover={false}>
        <h3 className="text-lg font-bold text-gray-900 mb-4">Badges</h3>
        <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
          {BADGES.slice(0, 5).map(badge => {
            const earned = xp >= badge.xpReq;
            return (
              <div key={badge.id} className={`text-center p-3 rounded-xl ${earned ? "bg-emerald-50 border border-emerald-100" : "bg-gray-50 opacity-40"}`}>
                <div className="text-2xl mb-1">{badge.icon}</div>
                <p className="text-xs font-bold text-gray-900">{badge.name}</p>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// AI COACH PAGE — Full screen
// ═══════════════════════════════════════════════════════════════
const ChatMessage = ({ msg, dark, assistantName, assistantIcon: Icon, assistantColor, profileInitial, profileColor }) => {
  const isUser = msg.role === "user";
  return (
    <div className={`py-6 px-4 ${!isUser ? dark ? "bg-gray-800/40" : "bg-gray-50/70" : ""}`}>
      <div className="max-w-2xl mx-auto flex gap-4">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-sm font-bold ${
          isUser
            ? "text-white"
            : dark ? "bg-emerald-900/50 border border-emerald-700" : "bg-emerald-50 border border-emerald-200"
        }`} style={isUser ? { background: profileColor || T.primary } : {}}>
          {isUser ? (profileInitial || "?") : <Icon size={16} className={dark ? "text-emerald-400" : "text-emerald-600"} />}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-semibold mb-1.5 ${dark ? "text-gray-400" : "text-gray-500"}`}>
            {isUser ? "Du" : assistantName}
          </p>
          <div className={`text-sm leading-relaxed whitespace-pre-wrap ${dark ? "text-gray-200" : "text-gray-800"}`}>
            {msg.text}
          </div>
        </div>
      </div>
    </div>
  );
};

const ChatInput = ({ input, setInput, onSend, loading, dark, placeholder, suggestions, showSuggestions }) => (
  <div className={`border-t p-4 ${dark ? "border-gray-700/50 bg-gray-900/80" : "border-gray-100 bg-white/80"} backdrop-blur-sm`}>
    <div className="max-w-2xl mx-auto">
      {showSuggestions && (
        <div className="flex gap-2 flex-wrap mb-3">
          {suggestions.map((s, i) => (
            <button key={i} onClick={() => setInput(s)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
              dark
                ? "bg-gray-800 text-emerald-400 border-gray-700 hover:bg-gray-700 hover:border-emerald-700"
                : "bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100"
            }`}>{s}</button>
          ))}
        </div>
      )}
      <div className={`flex gap-2 items-end rounded-2xl border p-2 transition-colors ${
        dark ? "bg-gray-800 border-gray-700 focus-within:border-emerald-600" : "bg-gray-50 border-gray-200 focus-within:border-emerald-400"
      }`}>
        <textarea
          value={input}
          onChange={e => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; }}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } }}
          placeholder={placeholder}
          rows={1}
          className={`flex-1 px-3 py-2 bg-transparent resize-none focus:outline-none text-sm leading-relaxed ${dark ? "text-gray-100 placeholder-gray-500" : "text-gray-900 placeholder-gray-400"}`}
          style={{ maxHeight: "120px" }}
        />
        <button onClick={onSend} disabled={loading || !input.trim()}
          className={`p-2.5 rounded-xl transition-all shrink-0 ${
            !input.trim() || loading
              ? dark ? "bg-gray-700 text-gray-500" : "bg-gray-200 text-gray-400"
              : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
          }`}>
          <ArrowRight size={16} />
        </button>
      </div>
      <p className={`text-center text-xs mt-2 ${dark ? "text-gray-600" : "text-gray-300"}`}>AI kan göra misstag — dubbelkolla viktig info</p>
    </div>
  </div>
);

const TypingIndicator = ({ dark, assistantName, assistantIcon: Icon }) => (
  <div className={`py-6 px-4 ${dark ? "bg-gray-800/40" : "bg-gray-50/70"}`}>
    <div className="max-w-2xl mx-auto flex gap-4">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${dark ? "bg-emerald-900/50 border border-emerald-700" : "bg-emerald-50 border border-emerald-200"}`}>
        <Icon size={16} className={dark ? "text-emerald-400" : "text-emerald-600"} />
      </div>
      <div className="flex-1">
        <p className={`text-xs font-semibold mb-1.5 ${dark ? "text-gray-400" : "text-gray-500"}`}>{assistantName}</p>
        <div className="flex items-center gap-1.5 pt-1">
          <div className={`w-2 h-2 rounded-full typing-dot ${dark ? "bg-emerald-500" : "bg-emerald-400"}`} />
          <div className={`w-2 h-2 rounded-full typing-dot ${dark ? "bg-emerald-500" : "bg-emerald-400"}`} />
          <div className={`w-2 h-2 rounded-full typing-dot ${dark ? "bg-emerald-500" : "bg-emerald-400"}`} />
        </div>
      </div>
    </div>
  </div>
);

const AiCoachPage = ({ profile, addXp, dark }) => {
  const [messages, setMessages] = useState([{
    role: "assistant",
    text: `Hej ${profile?.name}! Jag är din personliga AI-säljcoach, anpassad efter din ${DISC_SHORT[profile?.discType]}-profil. Fråga mig om avslutstekniker, invändningshantering, SPIN-frågor, kundtyper, motivation — vad du vill.`
  }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMessage = input.trim(); setInput(""); setMessages(prev => [...prev, { role: "user", text: userMessage }]); setLoading(true);
    addXp?.(XP_ACTIONS.ai_question);
    const salespersonId = profile?.supabaseId;
    if (salespersonId) {
      const result = await callEdgeFunction("ai-coach", { question: userMessage, salesperson_id: salespersonId });
      if (result?.message) { setMessages(prev => [...prev, { role: "assistant", text: result.message }]); setLoading(false); return; }
    }
    setMessages(prev => [...prev, { role: "assistant", text: "Kunde inte nå AI-tjänsten just nu. Försök igen." }]); setLoading(false);
  };

  const suggestions = ["Hur stänger jag som " + DISC_SHORT[profile?.discType] + "?", "Tips för gröna kunder", "Hantera 'det är för dyrt'", "SPIN-teknik för nybörjare"];

  return (
    <div className="flex flex-col h-screen animate-fadeIn">
      <div className={`flex-1 overflow-y-auto ${dark ? "bg-gray-900" : "bg-white"}`}>
        {messages.length <= 1 && (
          <div className="flex flex-col items-center justify-center pt-16 pb-8 px-4">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${dark ? "bg-emerald-900/30 border border-emerald-800" : "bg-emerald-50 border border-emerald-200"}`}>
              <Bot size={28} className={dark ? "text-emerald-400" : "text-emerald-600"} />
            </div>
            <h2 className={`text-xl font-bold mb-1 ${dark ? "text-gray-100" : "text-gray-900"}`}>AI Säljcoach</h2>
            <p className={`text-sm ${dark ? "text-gray-500" : "text-gray-400"}`}>Personlig coaching anpassad efter din DISC-profil</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <ChatMessage key={i} msg={msg} dark={dark} assistantName="AI Säljcoach" assistantIcon={Bot}
            assistantColor={T.primary} profileInitial={profile?.name?.[0]} profileColor={DISC_COLORS[profile?.discType]} />
        ))}
        {loading && <TypingIndicator dark={dark} assistantName="AI Säljcoach" assistantIcon={Bot} />}
        <div ref={endRef} />
      </div>
      <ChatInput input={input} setInput={setInput} onSend={handleSend} loading={loading} dark={dark}
        placeholder="Ställ en fråga till din säljcoach..." suggestions={suggestions} showSuggestions={messages.length <= 1} />
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// AI BATTERY EXPERT PAGE — Full screen
// ═══════════════════════════════════════════════════════════════
const AiBatteryExpertPage = ({ profile, addXp, dark }) => {
  const [messages, setMessages] = useState([{
    role: "assistant",
    text: "Hej! Jag är din AI-produktexpert. Fråga mig om batterier, växelriktare, laddboxar, solpaket, priser, provision, eller vad som helst om Proffskontakts sortiment."
  }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMessage = input.trim(); setInput(""); setMessages(prev => [...prev, { role: "user", text: userMessage }]); setLoading(true);
    addXp?.(XP_ACTIONS.ai_question);
    const salespersonId = profile?.supabaseId;
    if (salespersonId) {
      const result = await callEdgeFunction("ai-product-expert", { question: userMessage, salesperson_id: salespersonId });
      if (result?.message) { setMessages(prev => [...prev, { role: "assistant", text: result.message }]); setLoading(false); return; }
    }
    setMessages(prev => [...prev, { role: "assistant", text: "Kunde inte nå AI-tjänsten just nu. Försök igen." }]); setLoading(false);
  };

  const suggestions = ["Eway batteri?", "Solis vs Solinteg?", "Pris på 10kWh system?", "Hur fungerar provision?", "Komplett system?"];

  return (
    <div className="flex flex-col h-screen animate-fadeIn">
      <div className={`flex-1 overflow-y-auto ${dark ? "bg-gray-900" : "bg-white"}`}>
        {messages.length <= 1 && (
          <div className="flex flex-col items-center justify-center pt-16 pb-8 px-4">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${dark ? "bg-green-900/30 border border-green-800" : "bg-green-50 border border-green-200"}`}>
              <Battery size={28} className={dark ? "text-green-400" : "text-green-600"} />
            </div>
            <h2 className={`text-xl font-bold mb-1 ${dark ? "text-gray-100" : "text-gray-900"}`}>AI Batteriexpert</h2>
            <p className={`text-sm ${dark ? "text-gray-500" : "text-gray-400"}`}>Produktkunskap, priser och provision</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <ChatMessage key={i} msg={msg} dark={dark} assistantName="AI Batteriexpert" assistantIcon={Battery}
            assistantColor="#059669" profileInitial={profile?.name?.[0]} profileColor={DISC_COLORS[profile?.discType]} />
        ))}
        {loading && <TypingIndicator dark={dark} assistantName="AI Batteriexpert" assistantIcon={Battery} />}
        <div ref={endRef} />
      </div>
      <ChatInput input={input} setInput={setInput} onSend={handleSend} loading={loading} dark={dark}
        placeholder="Fråga om produkter, priser, provision..." suggestions={suggestions} showSuggestions={messages.length <= 1} />
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// TRAINING PAGE — Hybrid course + reference
// ═══════════════════════════════════════════════════════════════
const TrainingPage = ({ profile, addXp }) => {
  const [section, setSection] = useState("overview");

  const modules = [
    { id: "spin", name: "SPIN-frågor", desc: "Frågeteknik som styr samtalet", icon: MessageCircle, color: "#3B82F6", count: `${Object.values(SPIN_QUESTIONS).flat().length} frågor` },
    { id: "objections", name: "Invändningar", desc: "Hantera motstånd professionellt", icon: Shield, color: "#EF4444", count: `${OBJECTIONS.length} invändningar` },
    { id: "closes", name: "Avslutstekniker", desc: "Stäng deals med rätt teknik", icon: Target, color: "#8B5CF6", count: `${CLOSES.length} tekniker` },
    { id: "calls", name: "Samtalsguide", desc: "Blueprint för varje samtal", icon: Phone, color: "#059669", count: "3 samtal" },
    { id: "disc", name: "DISC & Kundtyper", desc: "Anpassa till varje personlighet", icon: Users, color: "#F59E0B", count: "4 typer" },
    { id: "quiz", name: "Quiz", desc: "Testa dina kunskaper", icon: Brain, color: "#EC4899", count: `${QUIZ_QUESTIONS.length} frågor` },
  ];

  // SPIN Section
  const SpinSection = () => {
    const [phase, setPhase] = useState("situation");
    const phases = [{ key: "situation", name: "Situation", icon: Eye, color: "#3B82F6" }, { key: "problem", name: "Problem", icon: AlertTriangle, color: "#EF4444" }, { key: "implication", name: "Implikation", icon: TrendingUp, color: "#F59E0B" }, { key: "needPayoff", name: "Need-Payoff", icon: Lightbulb, color: "#059669" }];
    return (
      <div>
        <button onClick={() => setSection("overview")} className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1 mb-6"><ChevronLeft size={16} /> Tillbaka</button>
        <h2 className="text-2xl font-extrabold text-gray-900 mb-2">SPIN Frågebatteri</h2>
        <p className="text-gray-500 text-sm mb-6">Den som ställer frågorna styr samtalet</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">{phases.map(p => (
          <button key={p.key} onClick={()=>setPhase(p.key)} className="p-4 rounded-xl text-left transition-all border-2" style={phase===p.key?{borderColor:p.color,background:`${p.color}08`}:{borderColor:"#F3F4F6"}}>
            <p.icon size={18} style={{color:p.color}} /><div className="font-bold text-sm mt-2 text-gray-900">{p.name}</div><div className="text-xs text-gray-400 mt-0.5">{SPIN_QUESTIONS[p.key].length} frågor</div>
          </button>
        ))}</div>
        <div className="space-y-4">{SPIN_QUESTIONS[phase].map((q,i) => (
          <Card key={i} hover={false}><div className="flex items-start gap-4"><span className="text-emerald-600 font-bold text-sm mt-0.5 w-6 text-right">{i+1}</span><div className="flex-1">
            <p className="text-gray-900 font-medium mb-3">"{q.q}"</p>
            <div className="grid md:grid-cols-2 gap-3"><div className="bg-blue-50/50 rounded-xl p-4"><div className="text-xs text-blue-600 font-semibold tracking-wide mb-1">VARFÖR</div><p className="text-gray-600 text-sm">{q.why}</p></div><div className="bg-amber-50/50 rounded-xl p-4"><div className="text-xs text-amber-600 font-semibold tracking-wide mb-1">LYSSNA EFTER</div><p className="text-gray-600 text-sm">{q.listen}</p></div></div>
          </div></div></Card>
        ))}</div>
      </div>
    );
  };

  // Objections Section
  const ObjectionsSection = () => {
    const [selected, setSelected] = useState(null);
    const [filter, setFilter] = useState("Alla");
    const categories = ["Alla", ...new Set(OBJECTIONS.map(o => o.kat))];
    const filtered = filter === "Alla" ? OBJECTIONS : OBJECTIONS.filter(o => o.kat === filter);
    const catColors = { Pris: "#EF4444", Partner: "#F59E0B", Timing: "#3B82F6", Undvikande: "#8B5CF6", Skepticism: "#D97706", Trovärdighet: "#059669", Praktisk: "#6B7280" };
    return (
      <div>
        <button onClick={() => setSection("overview")} className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1 mb-6"><ChevronLeft size={16} /> Tillbaka</button>
        <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Invändningshantering</h2>
        <p className="text-gray-500 text-sm mb-6">Validera först. Ställ fråga sedan. Pitcha aldrig mot invändningen.</p>
        <div className="flex flex-wrap gap-2 mb-6">{categories.map(c => (
          <button key={c} onClick={()=>setFilter(c)} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${filter===c?"bg-emerald-600 text-white shadow-sm":"bg-gray-50 text-gray-500 hover:bg-gray-100 border border-gray-100"}`}>{c}</button>
        ))}</div>
        <div className="space-y-3">{filtered.map((o,i) => (
          <Card key={i} onClick={()=>setSelected(selected===i?null:i)}>
            <div className="flex items-center justify-between gap-3 mb-1"><span className="text-gray-900 font-bold text-sm min-w-0 break-words">"{o.inv}"</span><span className="shrink-0"><Badge text={o.kat} color={catColors[o.kat]||"#6B7280"} /></span></div>
            {selected===i && <div className="mt-4 space-y-4">
              <div><span className="text-gray-400 text-xs font-semibold tracking-wide">VAD KUNDEN MENAR</span><p className="text-gray-700 text-sm mt-1">{o.meaning}</p></div>
              <div className="bg-emerald-50 rounded-xl p-4 border-l-4 border-emerald-600"><span className="text-emerald-700 text-xs font-semibold tracking-wide">EXAKT VAD DU SÄGER</span><p className="text-gray-900 text-sm mt-1 italic">{o.handling}</p></div>
              <div className="bg-amber-50 rounded-xl p-4 border-l-4 border-amber-500"><span className="text-amber-700 text-xs font-semibold tracking-wide">UPPFÖLJNINGSFRÅGA</span><p className="text-gray-900 text-sm mt-1 italic">{o.follow}</p></div>
            </div>}
          </Card>
        ))}</div>
      </div>
    );
  };

  // Closes Section
  const ClosesSection = () => {
    const [selected, setSelected] = useState(null);
    return (
      <div>
        <button onClick={() => setSection("overview")} className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1 mb-6"><ChevronLeft size={16} /> Tillbaka</button>
        <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Avslutstekniker</h2>
        <p className="text-gray-500 text-sm mb-6">Frågan är inte OM du går på avslut — utan VILKEN teknik och NÄR.</p>
        {profile?.discType && <Card hover={false} className="mb-6 border-l-4" style={{borderColor:DISC_COLORS[profile.discType],background:`${DISC_COLORS[profile.discType]}05`}}>
          <div className="text-xs font-semibold tracking-wide mb-2" style={{color:DISC_COLORS[profile.discType]}}>REKOMMENDERADE FÖR DIG ({DISC_SHORT[profile.discType]})</div>
          <div className="space-y-1">{CLOSES.filter(c=>c.disc[profile.discType]==="PRIMÄR"||c.disc[profile.discType]==="EXTREMT EFFEKTIV").map((c,i)=>(<p key={i} className="text-gray-900 text-sm">{c.name} — <span className="text-emerald-600 font-semibold">{c.disc[profile.discType]}</span></p>))}</div>
        </Card>}
        <div className="space-y-3">{CLOSES.map((c,i) => (
          <Card key={i} onClick={()=>setSelected(selected===i?null:i)}>
            <div className="flex items-center justify-between mb-1"><span className="text-gray-900 font-bold text-sm">{i+1}. {c.name}</span><div className="flex gap-2">
              {profile?.discType && <Badge text={c.disc[profile.discType]} color={DISC_COLORS[profile.discType]} />}
              <Badge text={c.difficulty} color={c.difficulty==="LÄTT"?"#059669":c.difficulty==="MEDEL"?"#D97706":"#EF4444"} />
            </div></div><p className="text-gray-500 text-xs">{c.desc}</p>
            {selected===i && <div className="mt-4 space-y-3"><div className="bg-emerald-50 rounded-xl p-4"><span className="text-emerald-700 text-xs font-semibold tracking-wide">EXAKT VAD DU SÄGER</span><p className="text-gray-900 text-sm mt-1 italic">{c.example}</p></div><div><span className="text-gray-400 text-xs font-semibold tracking-wide">KÖPSIGNAL</span><p className="text-gray-700 text-sm mt-1">{c.signal}</p></div></div>}
          </Card>
        ))}</div>
      </div>
    );
  };

  // Call Guide Section
  const CallsSection = () => {
    const [activeCall, setActiveCall] = useState(1);
    const [activeStep, setActiveStep] = useState(0);
    const [expandedDetails, setExpandedDetails] = useState({});
    const bp = CALL_BLUEPRINTS[activeCall];
    const section = bp.sections[activeStep];

    const toggleDetail = (detailId) => {
      setExpandedDetails(prev => ({
        ...prev,
        [detailId]: !prev[detailId]
      }));
    };

    return (
      <div>
        <button onClick={() => setSection("overview")} className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1 mb-6"><ChevronLeft size={16} /> Tillbaka</button>
        <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Samtalsguide</h2>
        <p className="text-gray-500 text-sm mb-6">Steg-för-steg blueprint för varje samtal</p>
        <div className="flex gap-2 mb-6">{[1,2,3].map(n => <button key={n} onClick={()=>{setActiveCall(n);setActiveStep(0);setExpandedDetails({});}} className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${activeCall===n?"bg-emerald-600 text-white shadow-sm":"bg-gray-50 text-gray-500 hover:bg-gray-100 border border-gray-100"}`}>Samtal {n}</button>)}</div>
        <Card hover={false} className="mb-5"><h3 className="text-lg font-bold text-gray-900">{bp.title}</h3><p className="text-gray-500 text-sm mt-1">{bp.subtitle}</p><Badge text={bp.timing} color={T.primary} /></Card>
        <div className="grid lg:grid-cols-4 gap-5">
          <div className="space-y-1">{bp.sections.map((s,i) => <button key={i} onClick={()=>{setActiveStep(i);setExpandedDetails({});}} className={`w-full text-left px-4 py-3 rounded-xl text-xs transition-all ${activeStep===i?"bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold":"bg-white border border-gray-100 text-gray-500 hover:bg-gray-50"}`}><div className="font-bold">{s.name}</div><div className="text-gray-400 mt-0.5">{s.time}</div></button>)}</div>
          <div className="lg:col-span-3"><Card hover={false}>
            <div className="flex items-center justify-between mb-4"><h4 className="text-lg font-bold text-gray-900">{section.name}</h4><Badge text={section.time} color={T.gold} /></div>
            <p className="text-emerald-600 text-sm font-bold mb-4">MÅL: {section.goal}</p>
            <div className="space-y-2 mb-6">{section.steps.map((step,i) => <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50"><span className="text-emerald-600 font-bold text-sm mt-0.5">{i+1}.</span><span className="text-gray-700 text-sm">{step}</span></div>)}</div>

            {section.details && section.details.length > 0 && (
              <div className="border-t pt-6">
                <p className="text-xs font-bold text-gray-500 mb-3 uppercase">EXPANDERAD GUIDE</p>
                <div className="space-y-2">
                  {section.details.map((detail) => (
                    <div key={detail.id} className="border border-gray-100 rounded-xl overflow-hidden">
                      <button
                        onClick={() => toggleDetail(detail.id)}
                        className="w-full text-left p-3 hover:bg-gray-50 transition-colors flex items-center justify-between"
                      >
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{detail.action}</p>
                          {detail.id && <p className="text-xs text-gray-400 mt-0.5">ID: {detail.id}</p>}
                        </div>
                        {expandedDetails[detail.id] ? <ChevronUp size={16} className="text-emerald-600" /> : <ChevronDown size={16} className="text-gray-400" />}
                      </button>

                      {expandedDetails[detail.id] && (
                        <div className="bg-gray-50 border-t border-gray-100 p-4 space-y-3">
                          <div>
                            <p className="text-xs font-bold text-gray-500 mb-1">HUR</p>
                            <p className="text-sm text-gray-700">{detail.how}</p>
                          </div>
                          <div className="bg-green-50 border border-green-100 rounded-lg p-3">
                            <p className="text-xs font-bold text-green-700 mb-1">SCRIPT</p>
                            <p className="text-sm text-gray-800 italic">{detail.script}</p>
                          </div>
                          <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
                            <p className="text-xs font-bold text-amber-700 mb-1">LYSSNA PÅ</p>
                            <p className="text-sm text-gray-800">{detail.listen}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-between mt-6"><button onClick={()=>{setActiveStep(Math.max(0,activeStep-1));setExpandedDetails({});}} disabled={activeStep===0} className="text-sm text-gray-400 hover:text-gray-700 disabled:opacity-30 flex items-center gap-1"><ChevronLeft size={16} />Föregående</button><button onClick={()=>{setActiveStep(Math.min(bp.sections.length-1,activeStep+1));setExpandedDetails({});}} disabled={activeStep===bp.sections.length-1} className="text-sm text-emerald-600 hover:text-emerald-700 disabled:opacity-30 flex items-center gap-1">Nästa<ChevronRight size={16} /></button></div>
          </Card></div>
        </div>
      </div>
    );
  };

  // DISC Section
  const DiscSection = () => {
    const [selected, setSelected] = useState(profile?.discType || "R");
    const types = ["R", "Y", "Gr", "B"];
    const p = DISC_PROFILES[selected];
    const full = DISC_PROFILES_FULL[selected];
    return (
      <div>
        <button onClick={() => setSection("overview")} className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1 mb-6"><ChevronLeft size={16} /> Tillbaka</button>
        <h2 className="text-2xl font-extrabold text-gray-900 mb-2">DISC & Kundtyper</h2>
        <p className="text-gray-500 text-sm mb-6">Förstå och anpassa dig till varje personlighetstyp</p>
        <div className="grid grid-cols-4 gap-3 mb-6">{types.map(t => (
          <button key={t} onClick={()=>setSelected(t)} className="p-4 rounded-xl text-center transition-all border-2" style={selected===t?{borderColor:DISC_COLORS[t],background:`${DISC_COLORS[t]}08`}:{borderColor:"#F3F4F6"}}>
            <div className="text-2xl mb-1">{DISC_EMOJI[t]}</div>
            <div className="font-bold text-sm text-gray-900">{DISC_SHORT[t]}</div>
          </button>
        ))}</div>
        <Card hover={false} className="mb-4">
          <h3 className="text-lg font-bold text-gray-900 mb-1">{p.name}</h3>
          <p className="text-sm text-gray-600 mb-4">{full.oneLiner}</p>
          <div className="grid md:grid-cols-2 gap-4">
            <div><p className="text-xs font-bold text-gray-400 mb-2">KÄNNER IGEN</p><p className="text-sm text-gray-700">{p.recognize}</p></div>
            <div><p className="text-xs font-bold text-gray-400 mb-2">DRIVKRAFT</p><p className="text-sm text-gray-700">{p.drive}</p></div>
            <div><p className="text-xs font-bold text-gray-400 mb-2">RÄDSLA</p><p className="text-sm text-gray-700">{p.fear}</p></div>
            <div><p className="text-xs font-bold text-gray-400 mb-2">TEMPO</p><p className="text-sm text-gray-700">{p.tempo}</p></div>
          </div>
        </Card>
        <Card hover={false} className="mb-4 bg-emerald-50 border-emerald-100">
          <p className="text-xs font-bold text-emerald-700 mb-2">SÄG DETTA</p>
          <p className="text-sm text-gray-800 italic">{p.say}</p>
        </Card>
        <Card hover={false} className="bg-red-50 border-red-100">
          <p className="text-xs font-bold text-red-600 mb-2">UNDVIK</p>
          <p className="text-sm text-gray-800">{p.avoid}</p>
        </Card>
      </div>
    );
  };

  // Quiz Section
  const QuizSection = () => {
    const [started, setStarted] = useState(false);
    const [current, setCurrent] = useState(0);
    const [answers, setAnswers] = useState([]);
    const [showResult, setShowResult] = useState(false);

    const handleAnswer = (idx) => {
      const newA = [...answers, idx]; setAnswers(newA);
      if (current < QUIZ_QUESTIONS.length - 1) setCurrent(current + 1);
      else {
        const score = newA.filter((a,i) => a === QUIZ_QUESTIONS[i].correct).length;
        const existing = JSON.parse(localStorage.getItem("salj_quiz_scores") || "[]");
        existing.push({ type: "Säljquiz", score, maxScore: QUIZ_QUESTIONS.length, date: new Date().toISOString() });
        localStorage.setItem("salj_quiz_scores", JSON.stringify(existing));
        addXp?.(score === QUIZ_QUESTIONS.length ? XP_ACTIONS.quiz_perfect : XP_ACTIONS.quiz_complete);
        setShowResult(true);
      }
    };

    const score = answers.filter((a,i) => a === QUIZ_QUESTIONS[i]?.correct).length;
    const pct = QUIZ_QUESTIONS.length > 0 ? Math.round((score/QUIZ_QUESTIONS.length)*100) : 0;

    if (!started) return (
      <div>
        <button onClick={() => setSection("overview")} className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1 mb-6"><ChevronLeft size={16} /> Tillbaka</button>
        <div className="text-center py-12">
          <div className="w-20 h-20 bg-pink-50 rounded-2xl flex items-center justify-center mx-auto mb-4"><Brain size={36} className="text-pink-500" /></div>
          <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Säljquiz</h2>
          <p className="text-gray-500 mb-6">{QUIZ_QUESTIONS.length} frågor om invändningar, closes, DISC, SPIN</p>
          <button onClick={()=>setStarted(true)} className="px-8 py-3 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-xl font-bold hover:from-emerald-600 hover:to-green-700 transition-all shadow-lg shadow-emerald-500/20">Starta Quiz</button>
        </div>
      </div>
    );

    if (showResult) return (
      <div>
        <button onClick={() => setSection("overview")} className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1 mb-6"><ChevronLeft size={16} /> Tillbaka</button>
        <div className="text-center mb-8">
          <div className="text-6xl font-extrabold mb-2" style={{color: pct >= 80 ? "#059669" : pct >= 60 ? "#D97706" : "#EF4444"}}>{pct}%</div>
          <p className="text-gray-500">{score} av {QUIZ_QUESTIONS.length} rätt — {pct >= 80 ? "Starkt!" : pct >= 60 ? "Bra grund!" : "Öva mer!"}</p>
        </div>
        <div className="space-y-3">{QUIZ_QUESTIONS.map((q,i) => (
          <Card key={i} hover={false} className={`border-l-4 ${answers[i]===q.correct ? "border-l-emerald-500" : "border-l-red-500"}`}>
            <p className="text-sm font-medium text-gray-900 mb-2">{i+1}. {q.q}</p>
            <p className="text-sm"><span className="text-gray-400">Ditt svar: </span><span className={answers[i]===q.correct?"text-emerald-600 font-semibold":"text-red-500"}>{q.options[answers[i]]}</span></p>
            {answers[i]!==q.correct && <p className="text-sm"><span className="text-gray-400">Rätt: </span><span className="text-emerald-600 font-semibold">{q.options[q.correct]}</span></p>}
            <p className="text-gray-400 text-xs mt-2">{q.explanation}</p>
          </Card>
        ))}</div>
        <button onClick={()=>{setStarted(false);setCurrent(0);setAnswers([]);setShowResult(false);}} className="mt-6 px-6 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-all">Kör igen</button>
      </div>
    );

    const q = QUIZ_QUESTIONS[current];
    return (
      <div>
        <div className="flex justify-between items-center mb-2"><span className="text-sm font-bold text-gray-900">Fråga {current+1} / {QUIZ_QUESTIONS.length}</span></div>
        <ProgressBar value={((current+1)/QUIZ_QUESTIONS.length)*100} color={T.primary} className="mb-6" />
        <Card hover={false}><p className="text-gray-900 font-semibold mb-6">{q.q}</p><div className="space-y-3">{q.options.map((opt,i) => (
          <button key={i} onClick={()=>handleAnswer(i)} className="w-full text-left p-4 border-2 border-gray-100 rounded-xl text-sm text-gray-900 hover:border-emerald-300 hover:bg-emerald-50/50 transition-all font-medium active:scale-[0.99]">{opt}</button>
        ))}</div></Card>
      </div>
    );
  };

  // Overview
  if (section === "overview") return (
    <div className="animate-fadeIn">
      <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Utbildning</h2>
      <p className="text-gray-500 text-sm mb-6">Allt du behöver för att bli en bättre säljare</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {modules.map(m => (
          <Card key={m.id} onClick={() => setSection(m.id)} className="group">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `${m.color}12` }}>
                <m.icon size={22} style={{ color: m.color }} />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-gray-900 group-hover:text-emerald-700 transition-colors">{m.name}</h3>
                <p className="text-xs text-gray-400 mt-0.5">{m.desc}</p>
                <Badge text={m.count} color={m.color} />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );

  const sections = { spin: SpinSection, objections: ObjectionsSection, closes: ClosesSection, calls: CallsSection, disc: DiscSection, quiz: QuizSection };
  const Section = sections[section];
  return Section ? <div className="animate-fadeIn"><Section /></div> : null;
};

// ═══════════════════════════════════════════════════════════════
// CHECK-IN & PROGRESS PAGE
// ═══════════════════════════════════════════════════════════════
const CheckinPage = ({ profile, addXp }) => {
  const [mode, setMode] = useState("form"); // form, history
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [history, setHistory] = useState(() => JSON.parse(localStorage.getItem(`checkins_${profile?.supabaseId || 'anon'}`) || "[]"));

  const handleSubmit = () => {
    const entry = { date: new Date().toISOString(), week: getWeekNumber(), answers, energy: parseInt(answers.energy) || 5, confidence: parseInt(answers.confidence) || 5 };
    const updated = [...history, entry];
    setHistory(updated);
    localStorage.setItem(`checkins_${profile?.supabaseId || 'anon'}`, JSON.stringify(updated));
    addXp?.(XP_ACTIONS.checkin);
    setSubmitted(true);
  };

  function getWeekNumber() {
    const d = new Date();
    const onejan = new Date(d.getFullYear(), 0, 1);
    return Math.ceil((((d.getTime() - onejan.getTime()) / 86400000) + onejan.getDay() + 1) / 7);
  }

  if (submitted) return (
    <div className="animate-fadeIn text-center py-16">
      <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
        <CheckCircle size={40} className="text-emerald-500" />
      </div>
      <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Check-in sparad!</h2>
      <p className="text-gray-500 mb-2">+{XP_ACTIONS.checkin} XP</p>
      <button onClick={() => { setSubmitted(false); setAnswers({}); setMode("history"); }} className="mt-4 px-6 py-2.5 bg-emerald-50 text-emerald-700 rounded-xl font-medium hover:bg-emerald-100 transition-all">Se historik</button>
    </div>
  );

  return (
    <div className="animate-fadeIn">
      <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Vecko-check-in</h2>
      <p className="text-gray-500 text-sm mb-6">Reflektera över din vecka och tracka din utveckling</p>

      <div className="flex gap-2 mb-6">
        <button onClick={() => setMode("form")} className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${mode === "form" ? "bg-emerald-600 text-white" : "bg-gray-50 text-gray-500 hover:bg-gray-100 border border-gray-100"}`}>Ny check-in</button>
        <button onClick={() => setMode("history")} className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${mode === "history" ? "bg-emerald-600 text-white" : "bg-gray-50 text-gray-500 hover:bg-gray-100 border border-gray-100"}`}>Historik ({history.length})</button>
      </div>

      {mode === "form" ? (
        <div className="space-y-4">
          {/* Energy & Confidence sliders */}
          <Card hover={false}>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-3">Energi denna vecka (1-10)</label>
                <div className="flex gap-2">{[1,2,3,4,5,6,7,8,9,10].map(n => (
                  <button key={n} onClick={() => setAnswers({...answers, energy: n})}
                    className={`w-9 h-9 rounded-lg text-sm font-bold transition-all ${answers.energy === n ? "bg-emerald-600 text-white shadow-sm" : "bg-gray-50 text-gray-400 hover:bg-emerald-50 hover:text-emerald-600"}`}>{n}</button>
                ))}</div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-3">Självförtroende (1-10)</label>
                <div className="flex gap-2">{[1,2,3,4,5,6,7,8,9,10].map(n => (
                  <button key={n} onClick={() => setAnswers({...answers, confidence: n})}
                    className={`w-9 h-9 rounded-lg text-sm font-bold transition-all ${answers.confidence === n ? "bg-blue-600 text-white shadow-sm" : "bg-gray-50 text-gray-400 hover:bg-blue-50 hover:text-blue-600"}`}>{n}</button>
                ))}</div>
              </div>
            </div>
          </Card>

          {/* Text questions */}
          {WEEKLY_QUESTIONS.map((q, i) => (
            <Card key={i} hover={false} className="!p-4">
              <label className="block text-sm font-semibold text-gray-900 mb-2">{q}</label>
              <input type="text" value={answers[`q${i}`] || ""} onChange={e => setAnswers({...answers, [`q${i}`]: e.target.value})}
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-100 rounded-lg focus:border-emerald-500 focus:ring-2 focus:ring-emerald-50 focus:outline-none text-sm" placeholder="Ditt svar..." />
            </Card>
          ))}

          <button onClick={handleSubmit} disabled={!answers.energy || !answers.confidence}
            className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-xl font-bold hover:from-emerald-600 hover:to-green-700 disabled:from-gray-300 disabled:to-gray-300 transition-all shadow-lg shadow-emerald-500/20">
            Spara check-in (+{XP_ACTIONS.checkin} XP)
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {history.length === 0 ? (
            <Card hover={false} className="text-center py-12">
              <Activity size={40} className="mx-auto text-gray-200 mb-3" />
              <p className="text-gray-400">Ingen historik ännu. Gör din första check-in!</p>
            </Card>
          ) : (
            history.slice().reverse().map((entry, i) => (
              <Card key={i} hover={false}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-bold text-gray-900">Vecka {entry.week}</span>
                  <span className="text-xs text-gray-400">{new Date(entry.date).toLocaleDateString('sv-SE')}</span>
                </div>
                <div className="flex gap-4">
                  <div className="flex items-center gap-2"><Zap size={14} className="text-emerald-500" /><span className="text-sm text-gray-600">Energi: <strong>{entry.energy}/10</strong></span></div>
                  <div className="flex items-center gap-2"><Star size={14} className="text-blue-500" /><span className="text-sm text-gray-600">Självförtroende: <strong>{entry.confidence}/10</strong></span></div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// ADMIN PAGE — Simple overview
// ═══════════════════════════════════════════════════════════════
const AdminPage = () => {
  const [salespeople, setSalespeople] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("salespeople").select("*").then(({ data }) => {
      setSalespeople(data || []);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="text-center py-12 text-gray-400">Laddar...</div>;

  return (
    <div className="animate-fadeIn">
      <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Admin</h2>
      <p className="text-gray-500 text-sm mb-6">Översikt alla säljare</p>

      <Card hover={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-3 px-4 text-xs font-bold text-gray-400 uppercase">Namn</th>
                <th className="text-left py-3 px-4 text-xs font-bold text-gray-400 uppercase">DISC</th>
                <th className="text-left py-3 px-4 text-xs font-bold text-gray-400 uppercase">Sekundär</th>
                <th className="text-left py-3 px-4 text-xs font-bold text-gray-400 uppercase">XP</th>
                <th className="text-left py-3 px-4 text-xs font-bold text-gray-400 uppercase">Nivå</th>
              </tr>
            </thead>
            <tbody>
              {salespeople.map((p, i) => {
                const savedXp = parseInt(localStorage.getItem(`xp_${p.id}`) || "0");
                const lvl = getLevel(savedXp);
                return (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs" style={{ background: DISC_COLORS[p.disc_type] || "#6B7280" }}>
                          {p.name?.[0] || "?"}
                        </div>
                        <span className="font-medium text-gray-900">{p.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4"><Badge text={DISC_SHORT[p.disc_type] || "?"} color={DISC_COLORS[p.disc_type]} /></td>
                    <td className="py-3 px-4 text-gray-500">{DISC_SHORT[p.disc_secondary] || "—"}</td>
                    <td className="py-3 px-4 font-medium text-gray-900">{savedXp}</td>
                    <td className="py-3 px-4"><Badge text={lvl.name} color={lvl.color} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════
export default function App() {
  const [profile, setProfile] = useState(null);
  const [page, setPage] = useState("dashboard");
  const [showDiscTest, setShowDiscTest] = useState(false);
  const [dark, setDark] = useDarkMode();

  const gamification = useGamification(profile?.supabaseId);

  useEffect(() => {
    if (profile) {
      gamification.checkStreak();
      gamification.addXp(XP_ACTIONS.login);
    }
  }, [profile?.supabaseId]);

  const handleLogin = (p) => {
    setProfile(p);
    if (!p.discType) setShowDiscTest(true);
  };

  const handleNewUser = () => setShowDiscTest(true);

  const handleDiscComplete = async (result) => {
    const id = await saveSalespersonToSupabase(result);
    const p = { ...result, supabaseId: id };
    localStorage.setItem("salj_profile", JSON.stringify(p));
    setProfile(p);
    setShowDiscTest(false);
  };

  const handleLogout = () => {
    localStorage.removeItem("salj_profile");
    setProfile(null);
    setPage("dashboard");
  };

  // Not logged in
  if (!profile && !showDiscTest) return <PinLogin onLogin={handleLogin} onNewUser={handleNewUser} />;

  // DISC test onboarding
  if (showDiscTest) return <DiscTest onComplete={handleDiscComplete} />;

  // Main app
  const pages = {
    dashboard: <Dashboard profile={profile} setPage={setPage} xp={gamification.xp} addXp={gamification.addXp} streak={gamification.streak} />,
    coach: <AiCoachPage profile={profile} addXp={gamification.addXp} dark={dark} />,
    expert: <AiBatteryExpertPage profile={profile} addXp={gamification.addXp} dark={dark} />,
    training: <TrainingPage profile={profile} addXp={gamification.addXp} />,
    checkin: <CheckinPage profile={profile} addXp={gamification.addXp} />,
    admin: <AdminPage />,
  };

  return (
    <div className={`min-h-screen flex transition-colors duration-300 ${dark ? "bg-gray-950" : "bg-gradient-to-br from-gray-50 via-white to-emerald-50/30"}`}>
      <Sidebar page={page} setPage={setPage} profile={profile} xp={gamification.xp} streak={gamification.streak} onLogout={handleLogout} dark={dark} setDark={setDark} />
      <div className="w-64 shrink-0" />
      <main className="flex-1 min-w-0 overflow-x-hidden">
        <div className={`${page === "coach" || page === "expert" ? "" : "p-8 pt-6"}`}>
          <div className={`${page === "coach" || page === "expert" ? "" : "max-w-7xl mx-auto"}`}>
            {pages[page] || pages.dashboard}
          </div>
        </div>
      </main>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fadeIn { animation: fadeIn 0.3s ease-out; }
        @keyframes typingDot { 0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); } 40% { opacity: 1; transform: scale(1); } }
        .typing-dot { animation: typingDot 1.4s infinite; }
        .typing-dot:nth-child(2) { animation-delay: 0.2s; }
        .typing-dot:nth-child(3) { animation-delay: 0.4s; }
      `}</style>
    </div>
  );
}
