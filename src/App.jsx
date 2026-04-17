import { useState, useEffect, useRef, useCallback } from "react";
import { BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, XAxis, YAxis, Tooltip, Cell, LineChart, Line, Legend } from "recharts";
import { Phone, Brain, Shield, Target, Zap, User, Users, TrendingUp, BookOpen, ChevronRight, ChevronLeft, CheckCircle, AlertTriangle, Clock, Award, Star, ArrowRight, MessageCircle, Eye, Heart, Lightbulb, BarChart3, Settings, Home, LogOut, Calendar, FileText, Play, RotateCcw, Lock, Send, Bot, Battery, Hash } from "lucide-react";

// ═══════════════════════════════════════════
// PROFFSKONTAKT SÄLJTRÄNING — KOMPLETT PLATTFORM
// Med integrerat 50-frågor DISC-test, personalisering, AI-coach & PIN-login
// ═══════════════════════════════════════════

const DISC_COLORS = { R: "#FF3B3B", Y: "#FFBE0B", Gr: "#06FFA5", B: "#3A86FF" };
const DISC_NAMES = { R: "Röd (Dominant)", Y: "Gul (Influencer)", Gr: "Grön (Stabil)", B: "Blå (Analytisk)" };
const DISC_SHORT = { R: "Röd", Y: "Gul", Gr: "Grön", B: "Blå" };

// ═══════════════════════════════════════════
// SUPABASE CONFIG
// ═══════════════════════════════════════════
const SUPABASE_URL = "https://torchccweanjulnaagqu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRvcmNoY2N3ZWFuanVsbmFhZ3F1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0OTQwMjksImV4cCI6MjA4NTA3MDAyOX0.qdO5vlySjkmbRq_fw9K3k-RzXU2OnSNmED4eWhyAnQs";

// Supabase helper — lightweight fetch wrapper (no SDK needed in artifact)
const supabase = {
  from: (table) => ({
    select: (cols = "*") => ({
      eq: (col, val) => ({
        single: () => fetch(`${SUPABASE_URL}/rest/v1/${table}?select=${cols}&${col}=eq.${val}&limit=1`, {
          headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
        }).then(r => r.json()).then(d => ({ data: d?.[0] || null })),
        order: (orderCol, opts = {}) => ({
          limit: (n) => fetch(`${SUPABASE_URL}/rest/v1/${table}?select=${cols}&${col}=eq.${val}&order=${orderCol}.${opts.ascending ? 'asc' : 'desc'}&limit=${n}`, {
            headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
          }).then(r => r.json()).then(d => ({ data: d }))
        })
      }),
      order: (orderCol, opts = {}) => ({
        limit: (n) => fetch(`${SUPABASE_URL}/rest/v1/${table}?select=${cols}&order=${orderCol}.${opts.ascending ? 'asc' : 'desc'}&limit=${n}`, {
          headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
        }).then(r => r.json()).then(d => ({ data: d }))
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
    upsert: (rows) => fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, "Content-Type": "application/json", Prefer: "return=representation,resolution=merge-duplicates" },
      body: JSON.stringify(Array.isArray(rows) ? rows : [rows])
    }).then(r => r.json()).then(d => ({ data: d }))
  })
};

// Edge Function caller
async function callEdgeFunction(name, body) {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.warn(`Edge function ${name} error:`, err);
      return null;
    }
    return await res.json();
  } catch (e) {
    console.warn(`Edge function ${name} failed:`, e);
    return null;
  }
}

// Save salesperson to Supabase (called after DISC test)
async function saveSalespersonToSupabase(profile) {
  try {
    const row = {
      name: profile.name,
      pin: profile.pin,
      disc_type: profile.discType,
      disc_secondary: profile.secondaryType || null,
      disc_scores: profile.aspectScores || {},
      disc_answers: profile.answers || [],
      disc_slow_questions: profile.slowQuestions || [],
      disc_answer_changes: profile.answerChanges || [],
      radar_data: profile.radarData || {},
      avatar_color: DISC_COLORS[profile.discType] || "#00D9FF"
    };
    const { data } = await supabase.from("salespeople").insert(row);
    if (data && data[0]) {
      return data[0].id; // Return the Supabase UUID
    }
  } catch (e) {
    console.warn("Failed to save to Supabase:", e);
  }
  return null;
}

// ═══════════════════════════════════════════
// PERSONALIZATION ENGINE
// Generates unique insight text based on full test answers
// ═══════════════════════════════════════════
function generatePersonalInsight(profile) {
  if (!profile?.discType || !profile?.aspectScores) return null;
  const { discType, secondary, scores, aspectScores, slowQuestions, totalChanges, consistencyScore, answers } = profile;
  const typeLabel = (t) => DISC_SHORT[t] || t;

  const getAspectPattern = () => {
    const p = {};
    ["WORK","SALES","STRESS","DECIDE","CONFLICT","SOCIAL"].forEach(a => { p[a] = aspectScores[a]?.dominant || discType; });
    return p;
  };
  const pattern = getAspectPattern();
  const flips = Object.entries(pattern).filter(([_,d]) => d !== discType).map(([a,d]) => ({aspect:a, type:d}));
  const slowCount = slowQuestions?.length || 0;
  const isConsistent = (consistencyScore || 50) > 75;

  // ── HEADLINE ──
  const headlineMap = {
    "R+Y": "Vinnare som tänker snabbt — men kan glömma att lyssna",
    "R+Gr": "Kommandör med hjärta — styrka med stabilitet",
    "R+B": "Beslutsam analytiker — klinisk precision med driv",
    "Y+R": "Energisk dörröppnare som också vill vinna",
    "Y+Gr": "Folk-magneten som faktiskt bryr sig på riktigt",
    "Y+B": "Karismatisk intellektuell — charm möter fakta",
    "Gr+R": "Stabil yta, bytarkoch under ytan",
    "Gr+Y": "Pålitlig kompis med ledarinstinkter",
    "Gr+B": "Systemtänkaren som skyddar relationer",
    "B+R": "Perfektionist som vill slå alla konkurrenter",
    "B+Y": "Analytiker med säljhjärta — motsägelserna gör dig stark",
    "B+Gr": "Grundlig och lugn — men kan trötta på inkonsekvens"
  };
  const headline = (headlineMap[`${discType}+${secondary}`] || `${typeLabel(discType)} med ${typeLabel(secondary)}-instinkter`) + (flips.length >= 3 ? " (men inte alltid)" : "");

  // ── SELF PORTRAIT ──
  const portraits = {
    "R+Y": `Du kör hårt framåt och älskar att vinna. Du har en naturlig charm som gör att folk VILL följa dig — men du glömmer ibland att de inte springer lika fort. ${pattern.SALES === "Y" ? "I sälj skiner du — du jagar OCH charmerar." : "I sälj kan du bli för snabb och missa relationbygget."} Spänningen mellan din tävlingsinstinkt och ditt behov av att vara omtyckt driver dig — men kan också splittra dig.`,
    "R+Gr": `Du är en sällsynt kombination: bestämd men stabil. Folk undrar varför du är så resultatorienterad men också så omtänksam. ${pattern.CONFLICT === "Gr" ? "I konflikter drar du in dig istället för att explodera — det förvånar folk." : "Men i konflikter kan din röda sida ta över."} Du bygger långsiktigt MED folk, inte TROTS dem.`,
    "R+B": `Du vill vinna — men inte innan du förstår exakt HUR. Du är beslutsam OCH analytisk, vilket gör dig svår att slå. ${pattern.SALES === "B" ? "I sälj är du kirurgisk — du hanterar invändningar med precision." : "I sälj kan du bli otålig med detaljer."} Problemet: du kan paralyseras av din egen perfektionism.`,
    "Y+R": `Du är folk-magneten som också vill vinna. Du berättar en bra story OCH du vill komma först. ${pattern.WORK === "R" ? "På jobbet kan du bli nästan aggressiv när det inte går snabbt." : "Men du litar mer på relationer än resultat."} Risk: folk slutar tro på dina löften för du glömmer dem när det blir svårt.`,
    "Y+Gr": `Du är den bästa versionen av social — du älskar folk OCH du bryr dig genuint. ${pattern.CONFLICT === "Gr" ? "I konflikter drar du in dig snarare än exploderar." : "Men om någon hotar din grupp kan du bli överraskande direkt."} Ditt problem: du tar på dig för mycket för att alla ska ha det bra — och kollapsar i tysthet.`,
    "Y+B": `Du är intelligent OCH charmig — och det gör att folk underskattar din analytiska sida. ${pattern.DECIDE === "B" ? "Du ifrågasätter dina val oftare än du visar." : "Du litar mer på magkänsla än data."} Spänningen mellan att vara korrekt och att vara älskad skapar din unika styrka.`,
    "Gr+R": `Du är stabil men du vill MER än folk tror. Under lugnet finns en ambition som sällan visas. ${pattern.STRESS === "R" ? "Under press biter du ihop och kör." : "Under press söker du samarbete istället."} Din svaghet: folk utnyttjar din tystnad och tror att du inte har ambitioner.`,
    "Gr+Y": `Du är pålitlig OCH social — folk vill ha dig i varje team. ${pattern.WORK === "Y" ? "Du skapar kul på jobbet — du inspirerar genom närvaro." : "Men i sälj kan du bli för försiktig för att inte såra."} Lär dig ta plats utan att skämmas.`,
    "Gr+B": `Du ser hur allt hänger ihop och vill att det fungerar för alla. ${pattern.DECIDE === "B" ? "Din grundlighet kan tyvärr leda till inaktivitet." : "Du fattar beslut snabbare än folk tror."} Risk: analys-förlamning gömd bakom pålitlighet.`,
    "B+R": `Perfektionist som vill vinna. Farlig kombination för konkurrenter. ${pattern.SALES === "R" ? "Du säljer genom expertis + aggressiv förberedelse." : "Du bygger långsiktig expertis-relation."} Svaghet: du förväntar samma perfektion av andra — och blir besviken.`,
    "B+Y": `Analytiker med säljhjärta — du förstår både data och drömmar. ${pattern.SALES === "Y" ? "Du charmerar genom kunskap — en sällsynt mix." : "Du är mer teknisk försäljare än du tror."} Tvekan mellan att vara korrekt eller att vara älskad splittrar dig ibland.`,
    "B+Gr": `Grundlig och lugn. Folk som springer utan att tänka stör dig. ${pattern.STRESS === "Gr" ? "Under press blir du robotisk — fokuserar på systemet." : "Under press kan du bli oväntat snabb."} Svaghet: du tycker andra är slarviga när de bara är mindre detaljerade.`
  };
  const selfPortrait = portraits[`${discType}+${secondary}`] || `Du är ${typeLabel(discType)} i grunden med ${typeLabel(secondary)}-drag som gör dig unik.`;

  // ── HIDDEN CONFLICT ──
  let hiddenConflict = "";
  if (flips.length > 0) {
    const aspectLabels = { WORK: "jobbet", SALES: "sälj", STRESS: "press", DECIDE: "beslut", CONFLICT: "konflikter", SOCIAL: "sociala situationer" };
    const flipDescs = flips.slice(0, 2).map(f => aspectLabels[f.aspect]);
    hiddenConflict = `Din hemliga konflikt: du är ${typeLabel(discType)} i de flesta situationer — men i ${flipDescs.join(" och ")} blir du ${typeLabel(flips[0].type)}. Du är bokstavligen två olika personer beroende på sammanhang. Det är inte falskt — men det kostar energi.`;
  } else {
    hiddenConflict = `Du är ovanligt konsekvent — samma person oavsett situation. Det ger dig styrka, men det betyder också att du saknar flexibilitet. Du anpassar dig inte lätt till folk som är annorlunda.`;
  }
  if (slowCount > 2) hiddenConflict += ` De ${slowCount} frågorna du tvekade på avslöjar var denna spänning lever — det är dina växande kanter.`;
  if ((totalChanges || 0) > 3) hiddenConflict += ` Du ändrade svar ${totalChanges} gånger, vilket tyder på att du inte är helt säker — och det är okej, men det tar energi.`;

  // ── SALES IDENTITY ──
  const salesDom = pattern.SALES;
  const salesIdMap = {
    R: "Du säljer genom att ta kommandot. Du vill stänga och du backar inte. Fällan: du pressar för hårt och hör inte kundens nej.",
    Y: "Du säljer genom relation. Kunden gillar dig innan produkten nämns. Fällan: du snackar bort affären och glömmer avslut.",
    Gr: "Du säljer genom tillit. Kunden vet att du inte ljuger. Fällan: du är för långsam och rivaler hinner före.",
    B: "Du säljer genom expertis och exakta svar. Fällan: du överförklarar och paralyserar kunden med info."
  };
  let salesIdentity = salesIdMap[salesDom] || "";
  if (pattern.CONFLICT !== salesDom) salesIdentity += ` Men vid motstånd skiftar du till ${typeLabel(pattern.CONFLICT).toLowerCase()}-läge — och det kan förvirra kunden.`;
  if (pattern.STRESS !== salesDom) salesIdentity += ` Under tidspress blir du mer ${typeLabel(pattern.STRESS).toLowerCase()}.`;

  // ── GROWTH EDGE ──
  const growthMap = {
    R: "Lyssna 3x mer. Din snabbhet imponerar — men den stänger ute folk som behöver tid.",
    Y: "Stäng munnen och stäng affären. Din charm öppnar dörrar — men du glömmer gå igenom dem.",
    Gr: "Gå på avslut. IDAG. Din försiktighet kostar dig deals varje vecka.",
    B: "Förenkla. Ge 3 poänger, inte 15. Kunden behöver inte din Wikipedia-artikel."
  };
  let growthEdge = growthMap[discType] || "";
  if (flips.length > 0) {
    const gapAspect = flips[0];
    const aspectLabels = { WORK: "jobbet", SALES: "sälj", STRESS: "press", DECIDE: "beslut", CONFLICT: "konflikter", SOCIAL: "sociala situationer" };
    growthEdge += ` Specifikt: integrera din ${typeLabel(gapAspect.type).toLowerCase()}-sida i ${aspectLabels[gapAspect.aspect]} — gör det medvetet istället för automatiskt.`;
  }

  // ── DAILY MANTRA ──
  const mantraMap = {
    "R+Y": "Vinna utan att bränna bron.",
    "R+Gr": "Leda genom att bygga, inte genom att förstöra.",
    "R+B": "Beslut nu. Perfekt senare.",
    "Y+R": "Älska folk OCH stäng affären.",
    "Y+Gr": "Ta plats även när ingen ser.",
    "Y+B": "Charmera genom kunskap, inte bara närvaro.",
    "Gr+R": "Visa tänderna när det behövs.",
    "Gr+Y": "Min omsorg är inte svaghet.",
    "Gr+B": "Tillräckligt bra ÄR bra nog.",
    "B+R": "Tillräckligt nu slår perfekt senare.",
    "B+Y": "Människor behöver mig mer än de behöver mina siffror.",
    "B+Gr": "Handling slår analys."
  };
  const dailyMantra = mantraMap[`${discType}+${secondary}`] || "Var autentisk, snabbt.";

  return { headline, selfPortrait, hiddenConflict, salesIdentity, growthEdge, dailyMantra };
}

// ═══════════════════════════════════════════
// AI COACH KNOWLEDGE BASE
// Rule-based coach that responds to development questions
// ═══════════════════════════════════════════
function getCoachResponse(question, profile) {
  const q = question.toLowerCase();
  const discType = profile?.discType || "R";
  const fullP = DISC_PROFILES_FULL[discType];
  if (!fullP) return "Jag behöver mer kontext. Kan du omformulera?";

  // Keyword matching with DISC-personalized responses
  if (q.includes("avslut") || q.includes("close") || q.includes("stäng")) {
    const tips = {
      R: "Du är redan bra på avslut — men du pressar ibland FÖR hårt. Prova att vara tyst efter din close-fråga. Tystnad-close + Assumptive Close är dina go-to. Men med gröna kunder: backa och ge dem Puppy Dog Close istället.",
      Y: "Ditt största problem är att du INTE stänger. Du pratar bort affären. Sätt en timer på 15 min — efter det MÅSTE du gå på avslut. Alternativ-close funkar bra för dig: 'Nästa vecka eller slutet av månaden?'",
      Gr: "Du måste öva på att gå på avslut VARJE samtal. Det är inte ohövligt — det är ditt jobb. Börja med Empati-close: 'Jag förstår att det känns stort. Ska vi ta det steg för steg?' Sen Puppy Dog Close.",
      B: "Du väntar tills du har 100% data. Sluta. 90% räcker. Kalkyl-close är din naturliga styrka — 'Siffrorna visar X, ser du anledning att INTE gå vidare?' Men säg det EFTER 3 poänger, inte 15."
    };
    return tips[discType];
  }

  if (q.includes("invändning") || q.includes("nej") || q.includes("motstånd") || q.includes("objection")) {
    return `Som ${fullP.name}: ${fullP.blindspots[0]}. När kunden säger nej, ${discType === "R" ? "vill du pusha hårdare — men det funkar bara mot röda kunder. Prova att validera FÖRST: 'Jag förstår det.' Sen fråga varför." : discType === "Y" ? "skojar du bort det — men kunden behöver bli hörd. Pausa, lyssna, sen ställ en direkt fråga om vad som oroar dem." : discType === "Gr" ? "accepterar du det direkt — men det dödar dealen. Fråga istället: 'Vad specifikt oroar dig?' Det är inte press, det är service." : "analyserar du vad som gick fel istället för att hantera det i stunden. Reagera direkt: 'Intressant — berätta mer.' Sen använd Sharp Angle."}`;
  }

  if (q.includes("disc") || q.includes("persontyp") || q.includes("kund") || q.includes("identifiera")) {
    return `De första 30 sekunderna avslöjar allt. Lyssna på hälsningen: Kort och rakt = Röd. Pratsam och energisk = Gul. Lugn och trevlig = Grön. Detaljerad fråga direkt = Blå. Som ${fullP.name} är din naturliga match andra ${fullP.name.toLowerCase()}a — men din svåraste kund är ${discType === "R" ? "Gröna (du kör över dem)" : discType === "Y" ? "Blåa (de tycker du är oseriös)" : discType === "Gr" ? "Röda (ditt tempo frustrerar dem)" : "Gula (din precision dödar deras energi)"}. Anpassa DITT tempo till DERAS.`;
  }

  if (q.includes("spin") || q.includes("fråg")) {
    return `SPIN-metodik som ${fullP.name}: ${discType === "R" ? "Du vill hoppa till Need-Payoff direkt. TVINGA dig att köra alla faser. Situation (2 min), Problem (3 min), Implikation (3 min), SEDAN payoff." : discType === "Y" ? "Du ställer bra frågor men hoppar mellan dem. Följ ordningen: S→P→I→N. Skriv ner ordningen FRAMFÖR dig." : discType === "Gr" ? "Du är bra på Situation-frågor men undviker Problem och Implikation (de känns jobbiga). Kunden BEHÖVER känna smärtan." : "Du gillar Situation-frågor (data!) men missar den emotionella kraften i Implikation. 'Vad kostar det er familj?' — känn obehaget."} Den som ställer frågorna styr samtalet.`;
  }

  if (q.includes("motivation") || q.includes("dålig dag") || q.includes("tappar") || q.includes("orkar inte")) {
    return `Ärligt? ${discType === "R" ? "Du drivs av att vinna. När du tappar motivation har du förmodligen inte vunnit på ett tag. Sätt ett micro-mål: 'Jag ska boka ETT samtal 2 idag.' Vinn det. Sen nästa." : discType === "Y" ? "Du drivs av energi från andra. Ring en kollega, prata om en bra deal, påminn dig varför du gillar att sälja. Sen ring kunden." : discType === "Gr" ? "Du drivs av trygghet och mening. Påminn dig om varje kund du HJÄLPT — inte siffrorna. Du säljer inte batterier, du räddar familjer pengar." : "Du drivs av kompetens. Lär dig något nytt om produkten, marknaden eller en konkurrent. Känslan av att veta mer = motivation."} Och kom ihåg: '${fullP.calibration}'.`;
  }

  if (q.includes("samtal 1") || q.includes("första samtal")) {
    return `Samtal 1-blueprint för ${fullP.name}: ${discType === "R" ? "Du vill hoppa till avslut direkt. Slow down. Minut 0-8 = LYSSNA och samla data. Din starkaste fas är minut 8-14 (ekonomisk smärta) — där din kvickhet lyser." : discType === "Y" ? "Du vill prata hela samtalet. Satt en timer. Kunden ska prata 70%, du 30%. Din starkaste fas: rapport + motivation mapping. Men GÅ PÅ AVSLUT i minut 18-22." : discType === "Gr" ? "Du bygger trygghet naturligt — bra. Men du MÅSTE driva framåt till next step. Boka samtal 2 INNAN du lägger på. Aldrig 'jag hör av mig'." : "Du vill ge ALL data. Begränsa dig till 3 poänger per fas. Din starkaste moment: datainsamling + kalkyl. Men förenkla presentationen."}`;
  }

  if (q.includes("stress") || q.includes("press") || q.includes("nervös")) {
    return `Under press reagerar du som ${typeLabel(profile?.aspectScores?.STRESS?.dominant || discType)}. ${discType === "R" ? "Du kör hårdare — det funkar ibland men kan bränna bron. Pausa 2 sekunder innan du svarar." : discType === "Y" ? "Du håller fasaden men stressen läcker igenom. Var ärlig: 'Jag tar en paus och kommer tillbaka med bättre svar.' Kunder respekterar ärlighet." : discType === "Gr" ? "Du drar dig tillbaka. Det ser ut som ointresse. Kommunicera istället: 'Jag vill ge dig rätt svar — ge mig 2 minuter.'" : "Du samlar mer data — men det fördröjer beslut. Acceptera att 80% räcker under press."} Tips: andas in 4 sek, ut 4 sek, 3 gånger. Sen agera.`;
  }

  // Generic fallback with profile awareness
  return `Bra fråga. Som ${fullP.name} (${fullP.archetype}): ${fullP.oneLiner} Ditt fokus just nu borde vara: ${fullP.mustDoMore[0]} Och sluta med: ${fullP.mustDoLess[0]} Vill du veta mer om en specifik situation? Fråga om avslutstekniker, invändningar, SPIN-frågor, persontyper, samtalsstruktur, stress, eller motivation.`;
}

const typeLabel = (t) => DISC_SHORT[t] || t;

// ═══════════════════════════════════════════
// BATTERY EXPERT KNOWLEDGE BASE
// Real product data from Proffskontakt portfolio
// ═══════════════════════════════════════════
function getBatteryResponse(question) {
  const q = question.toLowerCase();

  // ── EWAY BATTERY ──
  if (q.includes("eway") || q.includes("e-way") || q.includes("univ")) {
    return "Eway UNIV7600(HP) — vårt huvudbatteri. Specifikationer: 7,68 kWh per modul (LFP-celler), stackbart upp till 64 moduler = max 491,52 kWh. Effekt: 50A laddning/urladdning, 3,84 kW per modul. IP65-klassat (utomhus OK). Inbyggt aerosolbaserat brandskydd — unikt i prisklassen. Arbetstemperatur: -10°C till +55°C. Vikt: 71 kg/modul. Vägghängd eller golvstående. 10 års garanti. Kompatibel med alla våra växelriktare (Solis, Solinteg, SAJ). I säljsamtalet: betona brandskyddet och stackbarheten — kunden kan börja litet och bygga ut.";
  }

  // ── ENERSHARE BATTERY CORE ──
  if (q.includes("enershare") || q.includes("battery core") || q.includes("batterycore")) {
    return "Enershare Battery Core — universalbatteriet. Kompatibelt med: SunGrow, GoodWe, Solis, Deye/Sunsynk, Solinteg, Hoymiles, Afore, och Sinexcel. Det är det bredaste kompatibilitetsstödet på marknaden. Perfekt för kunder som redan har en växelriktare — vi kan nästan alltid matcha. LFP-celler, modulärt design. I säljsamtalet: 'Oavsett vilken växelriktare du har idag kan vi hitta en lösning — vi låser inte in dig i ett enda märke.'";
  }

  // ── SOLIS INVERTERS ──
  if (q.includes("solis") && !q.includes("solinteg")) {
    return "Solis hybridväxelriktare — vår premiumlinje. S6-EH3P-serien finns i 5K, 6K, 8K, 10K, 12K, 15K och 18K (3-fas). Topspecar: 160% PV-överdimensionering (kör mer sol utan att byta), 98,5% verkningsgrad (bland de bästa), IP66 (regn- och dammtålig), <10ms omkoppling vid strömavbrott (nästan omärkbart). 12kW-modellen: 4 MPPT-ingångar, 50A laddning/urladdning, batterispänning 120-800V. 15kW: samma plattform, mer kapacitet. Solis är marknadsledande globalt med 500+ GW installerad effekt. I pitchen: 'Solis driver fler solanläggningar än något annat märke i världen.'";
  }

  // ── SOLINTEG INVERTER ──
  if (q.includes("solinteg") || q.includes("integ-m") || q.includes("integ m")) {
    return "Solinteg INTEG-M hybridväxelriktare (10-20kW, 3-fas). Specifikationer: 30A PV-ingång, 40A batteriladdning/urladdning, 7 olika driftlägen inkl. Time-of-Use (ToU) för spotprisoptimering. Max PV: 20 kW. Stödjer parallellkoppling för större installationer. Bra prisläge jämfört med Solis — perfekt för priskänsliga kunder som ändå vill ha 3-fas och ToU. WiFi/LAN-uppkoppling för monitorering via app. I pitchen mot Solis: Solinteg är mer prisvärd, Solis har högre verkningsgrad och snabbare backup-switch.";
  }

  // ── SAJ INVERTER ──
  if (q.includes("saj") || q.includes("hs3")) {
    return "SAJ HS3 — all-in-one energilagring. Integrerad hybridväxelriktare + batterihantering i samma enhet. Stödjer upp till 8 batterimoduler. Inbyggt BMS (Battery Management System). Fördel: färre komponenter = enklare installation, färre felpunkter. Perfekt för installatörer som vill ha en clean setup. I samtalet: 'SAJ är plug-and-play — en enhet istället för tre separata.' Bra för kunder som värderar enkelhet.";
  }

  // ── INVERTER COMPARISON ──
  if (q.includes("växelriktare") || q.includes("inverter") || q.includes("hybrid")) {
    return "Vårt växelriktarsortiment — tre nivåer:\n\n🔵 SOLIS S6-EH3P (5-18kW): Premiumval. 98,5% verkningsgrad, IP66, <10ms backup, 160% PV-överdim. Globalt marknadsledande.\n\n🟢 SOLINTEG INTEG-M (10-20kW): Prisvärt. 7 driftlägen, ToU-stöd, 40A laddström. Bästa bang-for-buck.\n\n🟡 SAJ HS3: All-in-one. Integrerad BMS, upp till 8 moduler, enklast installation.\n\nAlla tre fungerar med Eway-batterier och Enershare Battery Core. Matcha rätt: Solis för premiumkunder, Solinteg för prisjägare, SAJ för enkelhet.";
  }

  // ── CHARGEAMPS LUNA ──
  if (q.includes("chargeamps") || q.includes("charge amps") || q.includes("luna")) {
    return "ChargeAmps Luna — premiumladdare för elbil. Specifikationer: upp till 22 kW (3-fas), Type 2-kontakt, RFID-autentisering, ISO 15118-stöd (framtidssäkert för plug-and-charge). Uppkoppling: 4G + WiFi. Stilren skandinavisk design — ser ut som en designprodukt, inte en industribox. 5 års garanti. Perfekt för villaägare som redan investerar i sol+batteri — komplettera med laddbox. I pitchen: 'Ladda bilen med din egen solel — ChargeAmps Luna styr laddningen automatiskt när elen är som billigast.'";
  }

  // ── ZAPTEC GO 2 ──
  if (q.includes("zaptec") || q.includes("go 2") || q.includes("go2")) {
    return "Zaptec Go 2 — smart laddbox. Specifikationer: upp till 22 kW (3-fas), IP54, MID Class B-mätare inbyggd (energimätning godkänd för fakturering), 4G + WiFi + BLE. Kompakt design, robust. Stödjer dynamisk lastbalansering — perfekt för flerfamiljshus och BRF:er med begränsad kapacitet. I jämförelse med ChargeAmps Luna: Zaptec har bättre MID-mätare (Class B vs standard), ChargeAmps har snyggare design och ISO 15118. Zaptec = funktionellt val, Luna = premiumval.";
  }

  // ── EV CHARGING GENERAL ──
  if (q.includes("ladda") || q.includes("elbil") || q.includes("laddbox") || q.includes("laddare") || q.includes("ev")) {
    return "Laddboxar i vårt sortiment:\n\n⚡ ChargeAmps Luna: 22kW, skandinavisk premium, RFID, ISO 15118, 4G+WiFi, 5 års garanti. Bäst för villaägare.\n\n⚡ Zaptec Go 2: 22kW, MID Class B-mätare, lastbalansering, 4G+WiFi+BLE. Bäst för BRF/flerfamilj.\n\nBåda stödjer smart laddning med spotpris — ladda bilen när elen är billigast. Kopplat till sol+batteri = ladda med egen solel. I samtalet: 'Du producerar redan el med panelerna, lagrar den i batteriet, och laddar bilen gratis. Hela kretsloppet.' Det är en kraftfull pitch.";
  }

  // ── SUNGROW SMART METER ──
  if (q.includes("sungrow") || q.includes("smartmätare") || q.includes("smart mätare") || q.includes("mätare") || q.includes("dtsu")) {
    return "Sungrow DTSU666-20 smartmätare — ögonen i systemet. 3-fas energimätning med 6 CT-ingångar (strömtransformatorer). RS485-kommunikation. Class 1-noggrannhet. Lagrar data i upp till 10 år. Mätaren är kritisk för att hybrid-systemet ska fungera optimalt — den ser exakt hur mycket som produceras, förbrukas, och lagras i realtid. Utan korrekt mätare tappar kunden 5-15% av sin potentiella besparing. I pitchen: 'Mätaren är hjärnan — utan den kör systemet i blindo.'";
  }

  // ── ENEQUI ENERGY MANAGEMENT ──
  if (q.includes("enequi") || q.includes("energistyrning") || q.includes("energihantering") || q.includes("smart styrning") || q.includes("optimering")) {
    return "Enequi Core — AI-driven energistyrning. Analyserar spotpriser i realtid, väderprognos, och kundens förbrukningsmönster. Optimerar automatiskt: när batteriet laddar/urladdar, när elbilen laddar, när värmepumpen körs. Resultat: upp till 50% lägre elräkning enligt Enequi. Det är INTE bara en app — det är en AI som fattar beslut varje kvart. I pitchen: 'Enequi är som att ha en energikonsult som jobbar 24/7 åt dig, helt gratis efter installation.' Starkt merförsäljningsargument ovanpå sol+batteri.";
  }

  // ── SYSTEM/HELHET ──
  if (q.includes("system") || q.includes("helhet") || q.includes("komplett") || q.includes("paket") || q.includes("hela")) {
    return "Vårt kompletta energisystem:\n\n☀️ Solpaneler → producerar el dagtid\n🔋 Eway batteri (7,68-491 kWh) → lagrar överskottet\n⚡ Hybridväxelriktare (Solis/Solinteg/SAJ) → styr flödet\n📊 Sungrow smartmätare → mäter allt i realtid\n🧠 Enequi Core → AI-optimerar hela systemet\n🚗 ChargeAmps/Zaptec → laddar elbilen med solel\n\nResultat: kunden producerar, lagrar, optimerar, och använder sin egen el. Oberoende av elnätet. I pitchen: 'Det här är inte en produkt — det är ett komplett energisystem som betalar tillbaka sig självt.'";
  }

  // ── ORIGINAL CATEGORIES (enhanced with product names) ──
  if (q.includes("prismatisk") || q.includes("pouch") || q.includes("cell")) {
    return "Prismatiska LFP-celler — det som sitter i våra Eway-batterier. 6000+ cykler, ~10% kapacitetstapp efter 10 år. Pouch-celler (konkurrenter): ~3000 cykler, ~20% tapp. Eway använder CATL/EVE prismatiska celler med inbyggt aerosolbrandskydd — det är unik säkerhetsnivå. I kundsamtalet: 'Våra Eway-batterier har samma celltyp som används i elbilar och industri — inte de billiga pouch-cellerna som tappar halva kapaciteten på 5 år.'";
  }

  if (q.includes("garanti")) {
    return "Garantier i vårt sortiment: Eway batteri: 10 års garanti. Solis växelriktare: 10 år (utökningsbar till 25). Solinteg: 10 år. ChargeAmps Luna: 5 år. Zaptec Go 2: 5 år. Sungrow smartmätare: lagrar data i 10 år. Batterierna garanteras hålla minst 80% kapacitet under garantitiden. I samtalet: nämn garantin PROAKTIVT — 'Vi står bakom produkterna med 10 års garanti, och om 10 år har du sparat mer än hela investeringen.'";
  }

  if (q.includes("kapacitet") || q.includes("kwh") || q.includes("storlek") || q.includes("dimensionering")) {
    return "Dimensionering med Eway: Varje modul = 7,68 kWh. Stackbart till 64 moduler (491 kWh). Typisk villa: 1-2 moduler (7,68-15,36 kWh). Med elbil: 2-3 moduler (15,36-23,04 kWh). Stort hus + pool + elbil: 3-4 moduler. Fördelen: kunden börjar med vad de behöver idag och bygger ut senare. Använd ALLTID kundens exakta förbrukningsdata — 'Visa mig din senaste elräkning så räknar jag ut exakt vad du behöver.'";
  }

  if (q.includes("pris") || q.includes("kost") || q.includes("investering") || q.includes("betala")) {
    return "Prismodellen: framea ALDRIG totalpriset först. Börja med besparingen. Med Eway-batteri + Solis/Solinteg-växelriktare + Enequi-styrning kan typisk villa spara 8-15 kkr/år. Med elbil och ChargeAmps/Zaptec: ytterligare 5-10 kkr. Payback: 5-8 år, sen 10+ år ren vinst. Finansiering: 'De flesta kunder delar upp kostnaden — månadskostnaden är ofta LÄGRE än besparingen från dag ett.' Sälj hela systemet, inte enskilda produkter.";
  }

  if (q.includes("arbitrage") || q.includes("timpris") || q.includes("nätnytta") || q.includes("spotpris")) {
    return "Arbitrage med vårt system: Enequi Core analyserar spotpriser → styr Eway-batteriet att ladda vid låg spot (natt, typiskt 30-50 öre) → urladdar vid hög spot (dag, typiskt 1-2 kr). Skillnad: 1-3 kr/kWh. Med 15 kWh batteri = upp till 45 kr/dag = ~1350 kr/månad bara på arbitrage. Nätnytta: elbolag betalar för grid-balansering. Enequi hanterar detta automatiskt. I pitchen: 'Ditt batteri tjänar pengar åt dig medan du sover — Enequi ser till det.'";
  }

  if (q.includes("installation") || q.includes("montering") || q.includes("plats") || q.includes("garage")) {
    return "Installation: Eway-batteriet är IP65 — fungerar utomhus, garage, källare, teknikrum. Vikt: 71 kg/modul, vägghängd eller golvstående. Typisk installation: 1 dag för batteri + växelriktare + mätare. Eway → kopplas till Solis/Solinteg/SAJ-växelriktare → Sungrow-mätare övervakar. ChargeAmps/Zaptec laddbox: separat men kan installeras samma dag. Alltid certifierad elektriker. SAJ HS3 = enklaste installationen (all-in-one).";
  }

  if (q.includes("sol") || q.includes("panel") || q.includes("produktion")) {
    return "Solpaneler + vårt system: Utan batteri: ~30% egenanvändning. MED Eway-batteri + Enequi: ~70-85% egenanvändning. Solis-växelriktaren hanterar 160% PV-överdimensionering — kunden kan ha fler paneler utan att byta växelriktare. Sungrow-mätaren ser exakt hur mycket som produceras vs förbrukas. Enequi optimerar: lagra i batteri, ladda elbil, eller sälj till nätet — allt automatiskt baserat på spotpris. 'Du kastar pengar varje solig dag utan batteri.'";
  }

  if (q.includes("konkurrent") || q.includes("jämför") || q.includes("annan") || q.includes("tesla") || q.includes("powerwall")) {
    return "Vs konkurrenter — prata ALDRIG skit, utbilda istället. Vs Tesla Powerwall: Eway har LFP (6000+ cykler) vs Teslas NMC (lägre livslängd). Eway är stackbart till 491 kWh, Powerwall max 3 enheter. Eway har aerosolbrandskydd. Vs billiga kinabatterier: kontrollera cellkemi, garanti, och lokal service. Vår styrka: komplett system (Eway + Solis/Solinteg + Enequi + Sungrow + ChargeAmps/Zaptec) — konkurrenter säljer enskilda produkter. 'Vi levererar hela lösningen, inte bara en box på väggen.'";
  }

  if (q.includes("backup") || q.includes("strömavbrott") || q.includes("nödström")) {
    return "Backup med vårt system: Solis-växelriktaren kopplar om på <10 millisekunder vid strömavbrott — kunden märker knappt av det. Eway-batteriet levererar strömmen. 15 kWh = ca 8-12 timmar backup för normalt hushåll. Solinteg och SAJ har också backup men med något längre omkopplingstid. Eway:s IP65-klassning + aerosolbrandskydd = trygg drift. 'Om grannen sitter i mörker under stormen, du har fortfarande ström, värme, och internet.'";
  }

  if (q.includes("lfp") || q.includes("lithium") || q.includes("kemi")) {
    return "LFP (Lithium Iron Phosphate) — det som sitter i ALLA våra batterier (Eway + Enershare). Fördelar vs NMC: säkrast (ingen termisk rusning), 6000+ cykler, ~10% kapacitetstapp. Eway lägger till aerosolbaserat brandskydd ovanpå det. NMC (Tesla, vissa konkurrenter): högre energidensitet men kortare livslängd + risk. LFP = branschstandard. I pitchen: 'Vi använder samma kemi som i elbilar — men med extra brandskydd. Det finns inget säkrare batteri på marknaden.'";
  }

  // ── KOMPATIBILITET ──
  if (q.includes("kompatib") || q.includes("passar") || q.includes("fungerar med") || q.includes("matcha")) {
    return "Kompatibilitet i vårt sortiment: Eway-batteri fungerar med Solis, Solinteg, och SAJ. Enershare Battery Core fungerar med ALLT: SunGrow, GoodWe, Solis, Deye/Sunsynk, Solinteg, Hoymiles, Afore, Sinexcel. Sungrow-mätaren fungerar med alla våra växelriktare (RS485). Enequi Core integrerar hela systemet. Om kunden redan har en växelriktare: kolla Enershare-listan först — vi kan nästan alltid matcha. 'Vi anpassar oss efter ditt system, inte tvärtom.'";
  }

  // ── WIFI/MONITORERING ──
  if (q.includes("wifi") || q.includes("app") || q.includes("monitor") || q.includes("övervakning") || q.includes("uppkoppl")) {
    return "Monitorering: Alla våra produkter är uppkopplade. Solis: WiFi/4G, SolisCloud-app. Solinteg: WiFi/LAN, egen app. SAJ: WiFi, eSAJ-app. ChargeAmps: 4G+WiFi, ChargeAmps-app. Zaptec: 4G+WiFi+BLE, Zaptec Portal. Sungrow-mätare: RS485 till växelriktare. Enequi Core: samlar ALL data i en dashboard. Kunden ser produktion, förbrukning, lagring, laddning — allt i realtid. I pitchen: 'Du ser exakt vad varje krona gör i appen.'";
  }

  return "Bra fråga! Jag kan svara om hela vårt sortiment: Eway-batterier, Enershare Battery Core, växelriktare (Solis, Solinteg, SAJ), laddboxar (ChargeAmps Luna, Zaptec Go 2), Sungrow smartmätare, Enequi energistyrning — plus dimensionering, priser, installation, arbitrage, backup, cellkemi, och konkurrentjämförelser. Ställ en mer specifik fråga!";
}

// ── DISC TEST: 50 FRÅGOR (mix vardag + jobb, subtila formuleringar) ──
const DISC_QUESTIONS = [
  // ═══ WORK (9 frågor) ═══
  { aspect: "WORK", q: "Du får välja mellan två jobb med samma lön. Vilket lockar mer?", options: [
    { text: "Det där jag har eget ansvar och sätter mina egna mål", type: "R" },
    { text: "Det där jag jobbar i ett kreativt team med mycket folk", type: "Y" },
    { text: "Det med tydliga rutiner och schysst arbetsmiljö", type: "Gr" },
    { text: "Det där jag får specialisera mig och bli riktigt bra på något", type: "B" }
  ]},
  { aspect: "WORK", q: "Du sitter i ett möte som spårar ur och inget händer. Vad gör du?", options: [
    { text: "Tar ordet och styr tillbaka till beslut", type: "R" },
    { text: "Försöker lyfta energin med en ny idé eller infallsvinkel", type: "Y" },
    { text: "Inväntar att nån annan tar tag i det", type: "Gr" },
    { text: "Pekar på att vi avvikit från agendan", type: "B" }
  ]},
  { aspect: "WORK", q: "En kollega levererar halvdåligt arbete som påverkar dig. Hur reagerar du?", options: [
    { text: "Säger till direkt — det måste fixas nu", type: "R" },
    { text: "Tar det med kollegan över en kaffe, informellt", type: "Y" },
    { text: "Fixar det tyst själv för att slippa dålig stämning", type: "Gr" },
    { text: "Dokumenterar problemet och tar upp det sakligt", type: "B" }
  ]},
  { aspect: "WORK", q: "Du har en ledig timme på kontoret utan inplanerat. Vad gör du?", options: [
    { text: "Ringer prospekts och jagar nya deals", type: "R" },
    { text: "Snackar med kollegorna, nätverkar, brainstormar", type: "Y" },
    { text: "Går igenom mina uppgifter och ser vad jag kan föra framåt", type: "Gr" },
    { text: "Fördjupar mig i produktkunskap eller analyserar data", type: "B" }
  ]},
  { aspect: "WORK", q: "Du blir erbjuden en ny roll som kräver att du lär om helt. Vad tänker du?", options: [
    { text: "Spännande utmaning — jag tar den om den leder uppåt", type: "R" },
    { text: "Kul med nåt nytt, nya människor, variation", type: "Y" },
    { text: "Jag vill veta mer innan — hur påverkar det min vardag?", type: "Gr" },
    { text: "Intressant, men jag behöver förstå hela bilden först", type: "B" }
  ]},
  { aspect: "WORK", q: "Chefen frågar vem som vill leda ett nytt projekt. Vad gör du?", options: [
    { text: "Räcker upp handen — jag leder gärna", type: "R" },
    { text: "Kollar vilka andra som är med och hoppar på om teamet är kul", type: "Y" },
    { text: "Bidrar gärna men föredrar att nån annan tar rodret", type: "Gr" },
    { text: "Frågar först vad målet och tidsramen är", type: "B" }
  ]},
  { aspect: "WORK", q: "Vad gör dig mest frustrerad en vanlig arbetsdag?", options: [
    { text: "Att saker tar för lång tid och ingen fattar beslut", type: "R" },
    { text: "Att sitta ensam utan att få bolla med nån", type: "Y" },
    { text: "Att planer ändras utan förvarning", type: "Gr" },
    { text: "Att folk tar beslut utan tillräckligt underlag", type: "B" }
  ]},
  { aspect: "WORK", q: "Du ska starta dagen. Vad gör du först?", options: [
    { text: "Kollar vad som är viktigast och sätter igång direkt", type: "R" },
    { text: "Tar en kopp kaffe och pratar med teamet", type: "Y" },
    { text: "Går igenom min to-do-lista och börjar med det som ligger närmast", type: "Gr" },
    { text: "Prioriterar baserat på deadlines och vad som kräver mest fokus", type: "B" }
  ]},
  { aspect: "WORK", q: "Du hittar ett bättre sätt att göra en uppgift, men det bryter mot rutinen. Vad gör du?", options: [
    { text: "Kör det nya sättet — resultat trumfar process", type: "R" },
    { text: "Testar det och berättar för alla om det funkar", type: "Y" },
    { text: "Kollar med chefen innan jag ändrar nåt", type: "Gr" },
    { text: "Analyserar varför det gamla sättet finns innan jag byter", type: "B" }
  ]},

  // ═══ SALES (9 frågor) ═══
  { aspect: "SALES", q: "Du ringer en kund som inte svarat på tre mail. Vad säger du?", options: [
    { text: "Rakt på sak: du förlorar pengar varje dag utan det här", type: "R" },
    { text: "Hej! Tänkte på dig — har du hunnit kolla?", type: "Y" },
    { text: "Hej, jag ville bara höra om du har några frågor jag kan hjälpa med", type: "Gr" },
    { text: "Hej, jag har uppdaterat kalkylen med nya siffror — vill du att jag skickar?", type: "B" }
  ]},
  { aspect: "SALES", q: "Kunden frågar: 'Varför ska jag välja er?' Vad svarar du?", options: [
    { text: "Vi levererar resultat, punkt slut. Kolla våra siffror.", type: "R" },
    { text: "Vi bryr oss på riktigt — du kommer märka det redan efter första samtalet", type: "Y" },
    { text: "Vi tar hand om hela processen så du slipper oroa dig", type: "Gr" },
    { text: "Vi har marknadens bästa produkt sett till specifikationer och garanti", type: "B" }
  ]},
  { aspect: "SALES", q: "Du märker att kunden inte lyssnar ordentligt under samtalet. Vad gör du?", options: [
    { text: "Ställer en rak fråga som tvingar dem att fokusera", type: "R" },
    { text: "Byter vinkel, berättar en historia som fångar intresset", type: "Y" },
    { text: "Frågar om det är en bättre tid att prata", type: "Gr" },
    { text: "Sammanfattar det viktigaste i tre korta punkter", type: "B" }
  ]},
  { aspect: "SALES", q: "Du har en dag med noll stängda deals. Hur hanterar du kvällen?", options: [
    { text: "Frustrerad men laddad — imorgon kör jag dubbelt", type: "R" },
    { text: "Ringer en kompis, pratar bort det, byter fokus", type: "Y" },
    { text: "Orolig — funderar på vad jag kunde gjort annorlunda", type: "Gr" },
    { text: "Går igenom samtalen och identifierar vad som gick snett", type: "B" }
  ]},
  { aspect: "SALES", q: "Kunden säger: 'Grannen fick det billigare.' Vad tänker du?", options: [
    { text: "Bra, då vet vi var ribban ligger — vi slår det med bättre produkt", type: "R" },
    { text: "Ah, intressant! Vet du vad grannen fick? Vi kan säkert matcha", type: "Y" },
    { text: "Det förstår jag. Låt mig visa vad som ingår hos oss", type: "Gr" },
    { text: "Vilka specifikationer hade grannens system? Så jämför vi korrekt", type: "B" }
  ]},
  { aspect: "SALES", q: "Du ska förbereda ett säljsamtal imorgon. Hur lägger du tiden?", options: [
    { text: "Kort research, kör på känsla — jag läser kunden live", type: "R" },
    { text: "Kollar deras sociala medier, hittar gemensamma intressen", type: "Y" },
    { text: "Går igenom förra samtalet och förbereder svar på troliga invändningar", type: "Gr" },
    { text: "Bygger en kalkyl och samlar all data om deras situation", type: "B" }
  ]},
  { aspect: "SALES", q: "Du har en kund som gillar dig men aldrig tar beslut. Vad gör du?", options: [
    { text: "Ger en deadline — erbjudandet gäller till fredag", type: "R" },
    { text: "Bjuder på en kaffe och pratar igenom det face-to-face", type: "Y" },
    { text: "Frågar vad som håller dem tillbaka och lyssnar noga", type: "Gr" },
    { text: "Skickar en sammanfattning med alla svar på deras frågor", type: "B" }
  ]},
  { aspect: "SALES", q: "Mitt i ett samtal märker du att du pitchat fel produkt. Vad gör du?", options: [
    { text: "Korrigerar snabbt och pivoterar utan att göra en grej av det", type: "R" },
    { text: "Skrattar åt mig själv och säger 'Vet du vad, jag har nåt ännu bättre'", type: "Y" },
    { text: "Ber om ursäkt och förklarar att jag vill ge rätt rekommendation", type: "Gr" },
    { text: "Pausar, förklarar vad som skiljer produkterna åt och varför den andra passar bättre", type: "B" }
  ]},
  { aspect: "SALES", q: "Du stänger en stor deal. Vad gör du direkt efteråt?", options: [
    { text: "Ringer nästa prospekt — momentumet ska utnyttjas", type: "R" },
    { text: "Firar med teamet och berättar hur det gick", type: "Y" },
    { text: "Skickar ett tack-meddelande till kunden och dokumenterar", type: "Gr" },
    { text: "Går igenom vad som funkade för att replikera det", type: "B" }
  ]},

  // ═══ STRESS (8 frågor) ═══
  { aspect: "STRESS", q: "Datorn kraschar och du förlorar en timmes arbete. Vad gör du?", options: [
    { text: "Svär till och gör om det snabbt — ingen tid att sörja", type: "R" },
    { text: "Suckar högt, berättar för alla, och börjar om med humor", type: "Y" },
    { text: "Blir stressad men börjar tyst göra om det", type: "Gr" },
    { text: "Kollar om det finns autosave och lär mig hur jag undviker det i framtiden", type: "B" }
  ]},
  { aspect: "STRESS", q: "Du ska hålla en presentation om 30 minuter och märker ett fel i materialet. Vad gör du?", options: [
    { text: "Fixar det snabbt och kör — ingen kommer märka", type: "R" },
    { text: "Nämner det och gör det till en grej: 'Ni får live-versionen!'", type: "Y" },
    { text: "Blir nervös och försöker fixa det ordentligt innan", type: "Gr" },
    { text: "Korrigerar det noggrant — hellre sen än felaktig", type: "B" }
  ]},
  { aspect: "STRESS", q: "Två kollegor bråkar öppet och du sitter mitt emellan. Vad gör du?", options: [
    { text: "Bryter in och säger att vi löser det här nu", type: "R" },
    { text: "Försöker lätta stämningen med humor", type: "Y" },
    { text: "Håller mig utanför men kollar sen att alla mår bra", type: "Gr" },
    { text: "Lyssnar på båda och försöker förstå sakfrågan", type: "B" }
  ]},
  { aspect: "STRESS", q: "Du vaknar en söndag och inser att du glömt skicka en viktig offert på fredag. Vad gör du?", options: [
    { text: "Skickar den direkt med ett kort 'Här kommer den'", type: "R" },
    { text: "Ringer kunden, skämtar lite om helgjobb, skickar", type: "Y" },
    { text: "Mår dåligt men skickar den med en ursäkt", type: "Gr" },
    { text: "Kollar igenom offerten en extra gång och skickar med en förklaring", type: "B" }
  ]},
  { aspect: "STRESS", q: "Du hamnar i en trafikstockning och kommer bli sen till ett kundmöte. Vad tänker du?", options: [
    { text: "Ringer och säger jag är 10 min sen, rakt på sak", type: "R" },
    { text: "Ringer, snackar lite, gör det till nåt positivt", type: "Y" },
    { text: "Stressar och oroar mig för vad kunden tänker", type: "Gr" },
    { text: "Ringer, meddelar exakt tid, och förbereder mig mentalt", type: "B" }
  ]},
  { aspect: "STRESS", q: "Din chef ger dig feedback du inte håller med om. Vad gör du?", options: [
    { text: "Säger att jag inte håller med och förklarar varför", type: "R" },
    { text: "Tar emot det, men ventilerar sen med en kollega", type: "Y" },
    { text: "Nickar och tar till mig det, även om det skaver", type: "Gr" },
    { text: "Frågar efter specifika exempel för att kunna utvärdera", type: "B" }
  ]},
  { aspect: "STRESS", q: "Du har jobbat hårt i veckor utan resultat. Hur påverkas du?", options: [
    { text: "Irriterad men driven — det ska fan vända", type: "R" },
    { text: "Tappar energi men hittar motivation genom att prata med folk", type: "Y" },
    { text: "Börjar tvivla på mig själv och ifrågasätter min approach", type: "Gr" },
    { text: "Analyserar vad som inte funkar och justerar strategin", type: "B" }
  ]},
  { aspect: "STRESS", q: "En kund ringer och är arg över nåt som inte var ditt fel. Vad gör du?", options: [
    { text: "Lyssnar kort, tar ansvar, löser det — inga ursäkter", type: "R" },
    { text: "Validerar känslan, lugnar ner, vänder det till nåt positivt", type: "Y" },
    { text: "Lyssnar tålmodigt och ber om ursäkt, fixar det", type: "Gr" },
    { text: "Reder ut exakt vad som hänt och förklarar steg för steg", type: "B" }
  ]},

  // ═══ DECIDE (8 frågor) ═══
  { aspect: "DECIDE", q: "Du ska välja restaurang för kvällen. Hur går det till?", options: [
    { text: "Bestämmer snabbt — 'Vi kör dit' — ingen diskussion", type: "R" },
    { text: "Frågar vad alla är sugna på och föreslår nåt kul", type: "Y" },
    { text: "Går på det som de flesta verkar vilja", type: "Gr" },
    { text: "Kollar betyg och meny online innan jag bestämmer", type: "B" }
  ]},
  { aspect: "DECIDE", q: "Du ska köpa ny telefon. Hur gör du?", options: [
    { text: "Tar den senaste modellen — behöver inte jämföra", type: "R" },
    { text: "Frågar kompisar vad de har och vad de gillar", type: "Y" },
    { text: "Kollar vad jag hade innan och tar något liknande", type: "Gr" },
    { text: "Läser recensioner, jämför specifikationer, kollar priser", type: "B" }
  ]},
  { aspect: "DECIDE", q: "Du erbjuds biljetter till en gala imorgon kväll. Du har inga planer. Vad gör du?", options: [
    { text: "Ja, absolut — spontanitet driver mig", type: "R" },
    { text: "Kul! Vem mer kommer? Jag är med!", type: "Y" },
    { text: "Hmm, jag hade tänkt ta det lugnt... men kanske", type: "Gr" },
    { text: "Vad är det för gala? Jag vill veta mer först", type: "B" }
  ]},
  { aspect: "DECIDE", q: "Din partner vill boka en resa. Hur deltar du i planeringen?", options: [
    { text: "Jag bestämmer destination och bokar — klart", type: "R" },
    { text: "Älskar att drömma ihop — vi kan åka dit, eller dit!", type: "Y" },
    { text: "Jag är med på det mesta, säg vad du vill", type: "Gr" },
    { text: "Jag kollar väder, priser, och logistik innan vi bestämmer", type: "B" }
  ]},
  { aspect: "DECIDE", q: "Du ska renovera hemma och har tre offerter. Hur väljer du?", options: [
    { text: "Snabbaste leveranstiden — jag vill att det blir klart", type: "R" },
    { text: "Den hantverkare jag hade bäst personkemi med", type: "Y" },
    { text: "Den som rekommenderas av nån jag litar på", type: "Gr" },
    { text: "Den med mest detaljerad offert och bäst pris/kvalitet", type: "B" }
  ]},
  { aspect: "DECIDE", q: "Du har två sätt att lösa ett problem. Ett är snabbt, ett är grundligare. Vad väljer du?", options: [
    { text: "Det snabba — fixa nu, optimera sen", type: "R" },
    { text: "Beror på vem som påverkas — jag kollar med dem", type: "Y" },
    { text: "Det grundligare — vill inte behöva göra om det", type: "Gr" },
    { text: "Det grundligare — men jag vill förstå varför det är bättre först", type: "B" }
  ]},
  { aspect: "DECIDE", q: "En kompis frågar dig om råd i ett viktigt beslut. Hur ger du råd?", options: [
    { text: "Rak feedback — 'Gör så här, det är bäst'", type: "R" },
    { text: "Pratar igenom det, delar egna erfarenheter, peppar", type: "Y" },
    { text: "Lyssnar noga och bekräftar vad de själva tänker", type: "Gr" },
    { text: "Ställer frågor och hjälper dem väga för- och nackdelar", type: "B" }
  ]},
  { aspect: "DECIDE", q: "Du ser en möjlighet som kan ge bra resultat men innebär risk. Vad gör du?", options: [
    { text: "Kör — risk är en del av spelet", type: "R" },
    { text: "Kollar om nån vill vara med och testar tillsammans", type: "Y" },
    { text: "Funderar ett tag — vill inte förhasta mig", type: "Gr" },
    { text: "Räknar på det: vad är worst case vs best case?", type: "B" }
  ]},

  // ═══ CONFLICT (8 frågor) ═══
  { aspect: "CONFLICT", q: "Du är på middag med vänner och nån säger nåt du tycker är helt fel. Vad gör du?", options: [
    { text: "Säger emot direkt — fakta är fakta", type: "R" },
    { text: "Gör en skämtsam kommentar som utmanar utan att det blir tungt", type: "Y" },
    { text: "Låter det passera — det är inte värt en diskussion nu", type: "Gr" },
    { text: "Frågar hur de menar och lägger fram min syn sakligt", type: "B" }
  ]},
  { aspect: "CONFLICT", q: "En kund klagar offentligt om er på sociala medier. Hur reagerar du?", options: [
    { text: "Svarar direkt, rakt — vi tar ansvar och fixar det", type: "R" },
    { text: "Svarar personligt och varmt, bjuder in till dialog", type: "Y" },
    { text: "Vill helst inte svara offentligt — tar det privat", type: "Gr" },
    { text: "Svarar med fakta och en tydlig förklaring av vad som hänt", type: "B" }
  ]},
  { aspect: "CONFLICT", q: "Du och en kollega har totalt olika åsikt i en viktig fråga. Vad händer?", options: [
    { text: "Jag argumenterar för min sak tills vi landar", type: "R" },
    { text: "Vi pratar igenom det — oftast hittar vi nåt bra i mitten", type: "Y" },
    { text: "Jag ger efter om det inte är superviktigt", type: "Gr" },
    { text: "Vi lägger fram fakta och ser vad datan säger", type: "B" }
  ]},
  { aspect: "CONFLICT", q: "Nån tar åt sig äran för nåt du gjort. Vad gör du?", options: [
    { text: "Konfronterar dem direkt — det är mitt arbete", type: "R" },
    { text: "Nämner det inför gruppen, halvt skämtsamt", type: "Y" },
    { text: "Sväller det men tänker på det länge", type: "Gr" },
    { text: "Tar upp det privat och dokumenterar mitt bidrag", type: "B" }
  ]},
  { aspect: "CONFLICT", q: "Du ska ge negativ feedback till nån i teamet. Hur gör du?", options: [
    { text: "Rakt ut — 'Det här funkar inte, fixa det'", type: "R" },
    { text: "Inleder positivt, tar det svåra, avslutar positivt", type: "Y" },
    { text: "Tar det försiktigt och frågar hur de själva tycker det går", type: "Gr" },
    { text: "Ger specifika exempel och konkreta förslag på förbättring", type: "B" }
  ]},
  { aspect: "CONFLICT", q: "Du sitter i kö och nån tränger sig förbi dig. Vad gör du?", options: [
    { text: "Säger till direkt — 'Ursäkta, kön börjar där bak'", type: "R" },
    { text: "Kommenterar nåt halvhögt med den bredvid mig", type: "Y" },
    { text: "Suckar inombords men säger inget", type: "Gr" },
    { text: "Funderar på om det finns en anledning och noterar", type: "B" }
  ]},
  { aspect: "CONFLICT", q: "Du måste säga nej till nåt du blivit ombedd att göra. Hur gör du?", options: [
    { text: "Rakt nej — 'Hinner inte, prioriterar annat'", type: "R" },
    { text: "Förklarar varför och föreslår en annan lösning", type: "Y" },
    { text: "Svårt att säga nej — försöker hitta ett sätt att hjälpa ändå", type: "Gr" },
    { text: "Förklarar logiskt varför det inte funkar just nu", type: "B" }
  ]},
  { aspect: "CONFLICT", q: "Nån avbryter dig mitt i en mening under ett möte. Vad gör du?", options: [
    { text: "Avbryter tillbaka — 'Låt mig göra klart'", type: "R" },
    { text: "Går med i det nya ämnet, kommer tillbaka sen", type: "Y" },
    { text: "Tystnar och väntar på min tur", type: "Gr" },
    { text: "Antecknar det jag skulle säga och tar upp det senare", type: "B" }
  ]},

  // ═══ SOCIAL (8 frågor) ═══
  { aspect: "SOCIAL", q: "Du kommer till en fest där du inte känner nån. Vad gör du?", options: [
    { text: "Går rakt fram till nån intressant och presenterar mig", type: "R" },
    { text: "Börjar prata med den som är närmast — energin tar mig vidare", type: "Y" },
    { text: "Letar efter nån som också verkar ny och pratar försiktigt", type: "Gr" },
    { text: "Observerar rummet en stund innan jag väljer vem jag pratar med", type: "B" }
  ]},
  { aspect: "SOCIAL", q: "Din vän berättar om ett problem. Vad gör du instinktivt?", options: [
    { text: "Föreslår en lösning direkt", type: "R" },
    { text: "Delar en liknande erfarenhet och visar att jag förstår", type: "Y" },
    { text: "Lyssnar och visar att jag finns där", type: "Gr" },
    { text: "Ställer frågor för att förstå hela bilden", type: "B" }
  ]},
  { aspect: "SOCIAL", q: "Du ska beskriva dig själv i tre ord till nån du nyss träffat. Vad säger du?", options: [
    { text: "Målmedveten, snabb, bestämd", type: "R" },
    { text: "Social, nyfiken, positiv", type: "Y" },
    { text: "Lojal, lugn, omtänksam", type: "Gr" },
    { text: "Grundlig, ärlig, eftertänksam", type: "B" }
  ]},
  { aspect: "SOCIAL", q: "Du planerar teamaktivitet för jobbet. Vad föreslår du?", options: [
    { text: "Nåt tävlingsinriktat — go-kart, escape room", type: "R" },
    { text: "Nåt socialt — AW, middag, bowling", type: "Y" },
    { text: "Nåt avslappnat — picknick, promenad, matlagning", type: "Gr" },
    { text: "Nåt som alla kan delta i — frågar vad folk vill", type: "B" }
  ]},
  { aspect: "SOCIAL", q: "Hur laddar du batterierna efter en tung vecka?", options: [
    { text: "Gör nåt aktivt — träning, projekt, nåt produktivt", type: "R" },
    { text: "Umgås med folk — vänner, familj, nåt kul ihop", type: "Y" },
    { text: "Tar det lugnt hemma — soffa, film, bara vara", type: "Gr" },
    { text: "Gör nåt för mig själv — läser, lär mig nåt, reflekterar", type: "B" }
  ]},
  { aspect: "SOCIAL", q: "Du får ett SMS från en okänd säljare. Vad gör du?", options: [
    { text: "Ignorerar eller svarar kort om det verkar relevant", type: "R" },
    { text: "Svarar om det verkar intressant — man vet aldrig", type: "Y" },
    { text: "Blir lite obekväm och ignorerar", type: "Gr" },
    { text: "Kollar upp vem det är och företaget innan jag svarar", type: "B" }
  ]},
  { aspect: "SOCIAL", q: "Du ska introducera dig i en ny grupp. Vad nämner du?", options: [
    { text: "Vad jag gör och vad jag åstadkommit", type: "R" },
    { text: "Nåt personligt och kul som folk minns", type: "Y" },
    { text: "Kort och enkelt — namn, roll, glad att vara här", type: "Gr" },
    { text: "Min bakgrund och vad jag kan bidra med", type: "B" }
  ]},
  { aspect: "SOCIAL", q: "Det är fredagskväll och du har inga planer. Vad gör du?", options: [
    { text: "Fixar nåt — jag gillar inte att sitta still", type: "R" },
    { text: "Ringer runt och ser om nån vill hitta på nåt", type: "Y" },
    { text: "Njuter av lugnet — äntligen en kväll utan planer", type: "Gr" },
    { text: "Gör nåt jag inte haft tid med under veckan", type: "B" }
  ]},
];

// ── DISC PROFILER (med superpowers, blindspots, matrix, calibration) ──
const DISC_PROFILES_FULL = {
  R: {
    name: "RÖD", archetype: "The Dominator", color: "#FF3B3B",
    oneLiner: "Du är en closer. Du driver, du pressar, du vinner. Men din styrka är också din blindspot.",
    superpowers: ["Du stänger snabbt. Du tvekar inte att gå på avslut.", "Du hanterar kundrejektion utan att det påverkar dig.", "Du kör hårda förhandlingar och backar inte från högt pris.", "Röda och blåa kunder respekterar dig direkt."],
    blindspots: ["Du kör över gröna och blåa kunder.", "Du lyssnar dåligt — du har redan bestämt svaret.", "Du avbryter kunder. Ofta. Utan att märka det.", "Du tappar deals på grund av för mycket push."],
    biggestTrap: "Att pusha för hårt på fel typ av kund. Grön kund säger 'jag vill tänka' — du går hårdare — de stänger ner — dealen är död.",
    mustDoMore: ["LYSSNA. Ställ 3 frågor innan du pitchar.", "Sänk tempot med gröna och blåa.", "Pausa efter en fråga.", "Visa empati."],
    mustDoLess: ["Avbryta kunden.", "Pressa när du känner motstånd.", "Prata om hur bra produkten är.", "Ignorera varningssignaler."],
    matrix: {
      R: { title: "Till RÖD kund", text: "NATURLIG MATCH. Kör på ditt sätt. Båda vill till avslut. Varning: maktkamp kan uppstå." },
      Y: { title: "Till GUL kund", text: "SÄNK TEMPOT, LÄGG TILL VÄRME. 2 min small talk. Skratta. Stäng med social proof, inte ROI." },
      Gr: { title: "Till GRÖN kund", text: "KRITISKT LÄGE. Din stil krossar gröna. Tala långsammare, pausa, INTE avbryt. Din instinkt — ignorera." },
      B: { title: "Till BLÅ kund", text: "SÄNK TEMPOT, HÖJ PRECISIONEN. Exakta siffror. Aldrig 'ungefär'. Om du inte vet: kolla upp, aldrig bluffa." }
    },
    calibration: "Jag ska LYSSNA. 3 frågor innan jag pitchar. Tystnad är okej. Kundens tempo styr mitt."
  },
  Y: {
    name: "GUL", archetype: "The Influencer", color: "#FFBE0B",
    oneLiner: "Du är rummets energi. Men din charm stänger inte deals — det gör strukturen du saknar.",
    superpowers: ["Du bygger rapport inom 30 sekunder.", "Du säljer med entusiasm som smittar.", "Mästare på social proof och storytelling.", "Kunder vill prata med dig igen."],
    blindspots: ["Du pratar för mycket.", "Du går inte på avslut i tid.", "Du hoppar över detaljer blåa kunder behöver.", "Du säljer på känsla och lovar saker du inte kan leverera."],
    biggestTrap: "Att bygga relation utan att stänga. Världens bästa samtal, ingen deal. Charm är inte en close.",
    mustDoMore: ["STRUKTURERA. Följ flödet.", "Gå på avslut senast minut 15-20.", "Ha siffror redo.", "Var KORT med blåa kunder."],
    mustDoLess: ["Prata. Kunden ska prata 70%.", "Hoppa mellan ämnen.", "Lova på känsla.", "Skoja bort svåra frågor."],
    matrix: {
      R: { title: "Till RÖD kund", text: "SKÄR NER SNACKET. Max 2 min intro, sen siffror. Gå på avslut direkt. Hoppa över rapport." },
      Y: { title: "Till GUL kund", text: "NATURLIG MATCH. Risk: ni pratar bort samtalet. Sätt timer: 20 min = avslut oavsett." },
      Gr: { title: "Till GRÖN kund", text: "SÄNK ENERGIN. Din energi är för mycket. Tala långsammare, pausa. Trygghet, inte entusiasm." },
      B: { title: "Till BLÅ kund", text: "KRITISKT LÄGE. Fakta över feeling. Kalkyl, spec, garanti. Din gul-pitch = 'oseriös säljare' i deras huvud." }
    },
    calibration: "Jag ska FOKUSERA. Max 20 min till avslut. Specifika frågor, inte stories. Kunden pratar mer än jag."
  },
  Gr: {
    name: "GRÖN", archetype: "The Connector", color: "#06FFA5",
    oneLiner: "Du är säljaren kunder vill ha som vän. Men vänskap stänger inte deals — du gör, om du vågar fråga.",
    superpowers: ["Du bygger djup förtroende. Kunder återkommer i åratal.", "Gröna och oroliga kunder köper av dig.", "Bäst på uppföljning och kundvård.", "Ingen känner sig pressad av dig."],
    blindspots: ["Du går inte på avslut.", "Du tappar deals till konkurrenter som ringde imorse.", "Du är för rädd att pressa.", "Du tappar röda och gula kunder — ditt lugn känns som apati."],
    biggestTrap: "Att vänta. Du ger kunden tid de inte behövde. Medan du är taktfull är nån annan mer direkt.",
    mustDoMore: ["GÅ PÅ AVSLUT. Det är ditt jobb.", "Ge deadlines.", "Var direkt även när det känns obekvämt.", "Följ upp SAMMA DAG."],
    mustDoLess: ["Vänta på kundens initiativ.", "Anpassa tills du är osynlig.", "Ursäkta dig för att du ringer.", "Lägga på utan next step."],
    matrix: {
      R: { title: "Till RÖD kund", text: "KRITISKT LÄGE. Din stil borrar ihjäl röda. Snabba upp, rakt på sak, INTE mjukt. Din instinkt — ignorera." },
      Y: { title: "Till GUL kund", text: "HÖJ ENERGIN. Din stil är för mjuk. Matcha deras energi. Om du är för lugn tänker de du inte är övertygad." },
      Gr: { title: "Till GRÖN kund", text: "NATURLIG MATCH. Risk: ingen går på avslut. TVINGA dig själv att fråga." },
      B: { title: "Till BLÅ kund", text: "TILLÄGG PRECISION. Mjukheten är okej, men data också. Kalkyl redo. Annars = 'kan inte produkten'." }
    },
    calibration: "Jag ska GÅ PÅ AVSLUT. Det är mitt jobb. Att inte fråga är respektlöst mot kundens tid."
  },
  B: {
    name: "BLÅ", archetype: "The Analyst", color: "#3A86FF",
    oneLiner: "Du är den säljare kunder litar på. Men analys stänger inte deals — beslut gör det.",
    superpowers: ["Teknisk expert. Blåa och röda kunder köper kompetens.", "Exakta kalkyler. Du vinner på fakta.", "Bygger ethos genom djupkunskap.", "Skeptiska kunder blir dina bästa kunder."],
    blindspots: ["Du pratar för tekniskt.", "Du ger för mycket info. Kunden paralyseras.", "Du går inte på avslut förrän ALL data är klar.", "Du analyserar förlorade deals istället för att agera."],
    biggestTrap: "Att paralysera kunden med information. 5 PDF:er, 3 kalkyler. Kunden blir överväldigad, gör inget.",
    mustDoMore: ["FÖRENKLA. Säg färre saker.", "Gå på avslut med 90% data, inte 100%.", "Matcha kundens tempo.", "Storytelling med gula och gröna."],
    mustDoLess: ["Överförklara detaljer.", "Skicka 20-sidiga offerter.", "Vänta tills 'allt är perfekt'.", "Tro att kunden vill ha lika mycket info som du."],
    matrix: {
      R: { title: "Till RÖD kund", text: "SNABBA UPP. Skär 70% av infon. Ge: ROI, payback, totalbelopp. Rekommendation, inte alternativ." },
      Y: { title: "Till GUL kund", text: "KRITISKT LÄGE. Lägg till värme. Börja med rapport. Varva siffror med story. Gul köper personen." },
      Gr: { title: "Till GRÖN kund", text: "SÄNK DETALJNIVÅN. Trygghet, inte teknik. Din djupa förklaring — skippa. 'Vi tar hand om allt.'" },
      B: { title: "Till BLÅ kund", text: "NATURLIG MATCH. Risk: analys-paralys. Ge deadline. Jobba med att STÄNGA, inte presentera." }
    },
    calibration: "Jag ska FÖRENKLA. Kunden behöver inte all info. Avslut med 90%. Matcha tempo."
  }
};

// ── DATA: INVÄNDNINGSHANTERING ──
const OBJECTIONS = [
  { inv: "Jag måste kolla med min fru/man", kat: "Partner", meaning: "Kunden vågar inte ta beslut ensam. Eller: partnern styr ekonomin. Eller: det är en ursäkt.", handling: "\"Det förstår jag helt. De flesta av våra kunder tar det här beslutet tillsammans. Berätta — är din partner generellt positiv till att ni sparar pengar på elen, eller är hen mer skeptisk?\"", follow: "\"Vad tror du att din partner skulle behöva höra för att känna sig trygg med det här?\"" },
  { inv: "Vi bestämmer saker ihop", kat: "Partner", meaning: "Samma som ovan, men starkare formulerat. Kunden är inte beslutsfattaren.", handling: "\"Absolut, och det tycker jag är bra. Vad jag brukar göra är att vi bokar ett kort samtal där ni båda är med. Funkar det ikväll eller imorgon?\"", follow: "\"Finns det nåt specifikt du tror att hen kommer undra över?\"" },
  { inv: "Det är för dyrt", kat: "Pris", meaning: "Kunden ser inte värdet relativt kostnaden.", handling: "\"Jag hör dig. Vad betalar du i snitt per månad för el just nu? Med batteri sparar du [Y kr/år], batteriet betalar sig på [Z år]. Sen är det ren vinst i 15+ år.\"", follow: "\"Om du visste att du sparar [Y kr] om året — skulle priset fortfarande kännas för högt?\"" },
  { inv: "Jag har fått billigare offerter", kat: "Pris", meaning: "Kunden jämför äpplen med päron. Billigare = sämre celler.", handling: "\"Bra att du jämför! Fick du prismatiska celler eller pouch-celler? Billigare alternativ använder pouch som tappar kapacitet snabbare. Våra 6000+ cykler.\"", follow: "\"Vill du att jag gör en jämförelse så du ser vad du får i båda fallen?\"" },
  { inv: "Jag vill ha fler offerter först", kat: "Pris", meaning: "Kunden är i research-läge. Behöver trygghet.", handling: "\"Smart. Se till att du jämför cellkemi, cykellivslängd, garanti, och service. Vill du att jag skickar en checklista?\"", follow: "\"Vad är viktigast — pris, kvalitet, eller tryggheten i garantin?\"" },
  { inv: "Ni är inte lokala", kat: "Trovärdighet", meaning: "Orolig att ingen kommer om nåt går fel.", handling: "\"Vi har [X] installationer i ditt område, servicepartner i [stad]. Garantin gäller oavsett, vi är på plats inom [X] dagar.\"", follow: "\"Vad oroar du dig mest — installationen eller servicen efteråt?\"" },
  { inv: "Vi har andra saker just nu", kat: "Timing", meaning: "Batteriet är inte top-of-mind. Ingen urgency.", handling: "\"Varje månad utan batteri förlorar du [X kr]. 6 månader = [6X kr] du aldrig får tillbaka. Vi fixar allt — du behöver knappt lyfta ett finger.\"", follow: "\"Om det inte tar mer än 20 min av din tid — värt att titta på siffrorna?\"" },
  { inv: "Batteripriser kommer sjunka", kat: "Timing", meaning: "Tror att vänta = smart. Glömmer förlust varje månad.", handling: "\"Priserna har sjunkit historiskt. Men subventioner kan ändras, och varje månad betalar du fullt pris. Kunder som väntade 2023 förlorade 12-15 månaders besparing.\"", follow: "\"Hur mycket betalar du i el per månad? Då räknar vi vad det kostar att vänta.\"" },
  { inv: "Jag vill tänka på det", kat: "Undvikande", meaning: "Klassisk brush-off. Inte tillräckligt starka skäl att agera NU.", handling: "\"Absolut. Vad specifikt vill du fundera på — priset, om det passar er situation, eller nåt annat? Så ger jag rätt underlag.\"", follow: "\"Om du hade all info just nu — skulle du vilja gå vidare?\"" },
  { inv: "Jag tror inte det lönar sig", kat: "Skepticism", meaning: "Dålig koll på elräkningar eller hört gammal info.", handling: "\"Okej, vi kollar! Vad betalar du per kWh? Solproduktion? Med de siffrorna sparar du [X kr/år]. Payback på [Y] år. Och det är UTAN nätnytta och arbitrage.\"", follow: "\"Om siffrorna visar payback på [Y] år och sen [X kr/år] i 15 år — intressant?\"" },
  { inv: "Jag har aldrig hört om er", kat: "Trovärdighet", meaning: "Vill veta att du inte är flyby-night. Social proof behövs.", handling: "\"Vi har gjort [X] installationer i [region]. [Garanti], partner [Y] i branschen [Z] år. Jag skickar references.\"", follow: "\"Vad gör att du känner dig trygg — recensioner, garanti, eller prata med nån som har det?\"" },
  { inv: "Vi har ingen plats", kat: "Praktisk", meaning: "Tänker på gamla klumpiga batterier.", handling: "\"Du behöver typ en bokhyllas väggyta. Garage, källare, eller utomhus i skåp. Jag skickar mått och bilder.\"", follow: "\"Har du garage eller förråd? Då löser vi det.\"" },
  { inv: "Hur vet jag att ni finns om 10 år?", kat: "Trovärdighet", meaning: "Djup risk-oro. Tänker långsiktigt.", handling: "\"Garantin är försäkrad och gäller oavsett vad som händer med oss. Batterierna är standardkomponenter — vilken elektriker kan serva dem.\"", follow: "\"Vill du att jag skickar garantivillkoren?\"" },
  { inv: "Jag vill göra egen research först", kat: "Undvikande", meaning: "Vill ha kontroll. Vill inte bli sålda till.", handling: "\"Bra! Jag skickar en guide med vad du ska kolla — cellkemi, cykellivslängd, garanti, kapacitet. Så jämför du rätt saker.\"", follow: "\"Vad vill du ta reda på? Kanske sparar jag dig tid redan nu.\"" },
];

// ── DATA: AVSLUTSTEKNIKER ──
const CLOSES = [
  { name: "Assumptive Close", desc: "Anta att de köper. Fråga aldrig 'vill du köpa?'", example: "\"Bra, då bokar vi hembesök [dag]. Förmiddag eller eftermiddag?\"", signal: "\"Hur lång tid tar installationen?\" — de planerar ägandeskap", difficulty: "LÄTT", disc: { R: "PRIMÄR", Y: "BRA", Gr: "FÖRSIKTIG", B: "UNDVIK som första" } },
  { name: "Alternativ-close", desc: "Ge kunden två JA-alternativ, aldrig ja/nej.", example: "\"Nästa vecka eller slutet av månaden — vilken funkar?\"", signal: "Nickar, ställer praktiska frågor", difficulty: "LÄTT", disc: { R: "BRA", Y: "PRIMÄR", Gr: "BRA", B: "BRA om logiskt motiverat" } },
  { name: "Sammanfattnings-close", desc: "Stapla alla fördelar tills det totala värdet är överväldigande.", example: "\"Ni sparar [X kr/år], backup, 15 års garanti, månadskostnad lägre än elräkningen. Hur låter det?\"", signal: "\"Låter bra\" men tar inte initiativ", difficulty: "MEDEL", disc: { R: "UNDVIK", Y: "BRA", Gr: "PRIMÄR", B: "BRA som setup" } },
  { name: "Sharp Angle Close", desc: "Kund ställer krav → du löser det → kopplar till åtagande.", example: "\"Om jag kan boka er före midsommar — kör vi då?\"", signal: "\"Kan ni göra X?\" = köpsignal", difficulty: "MEDEL", disc: { R: "PRIMÄR", Y: "BRA", Gr: "FÖRSIKTIG", B: "BRA om tekniskt" } },
  { name: "Takeaway Close", desc: "Antyda att det kanske inte passar dem. Reversal psychology.", example: "\"Det kanske inte är rätt tidpunkt för er. Inte alla kan just nu.\"", signal: "Intresserad men agerar inte efter 2+ closes", difficulty: "SVÅR", disc: { R: "PRIMÄR", Y: "STARK", Gr: "UNDVIK", B: "UNDVIK" } },
  { name: "Tystnad-close", desc: "Ställ frågan. Håll käft. Den som pratar först förlorar.", example: "\"Ska vi köra?\" [TYST]", signal: "Kunden tänker men säger inte nej", difficulty: "SVÅR", disc: { R: "EXTREMT EFFEKTIV", Y: "SVÅR", Gr: "BRA", B: "BRA" } },
  { name: "Puppy Dog Close", desc: "Micro-commitment. Testa ett litet steg som leder till köp.", example: "\"Vi gör en gratis beräkning först. Om siffrorna ser bra ut pratar vi vidare.\"", signal: "\"Jag vill inte binda mig\"", difficulty: "LÄTT", disc: { R: "UNDVIK", Y: "BRA", Gr: "PRIMÄR", B: "BRA" } },
  { name: "Urgency Close", desc: "Tidsbegränsning — vänta har en kostnad. Måste vara VERKLIG.", example: "\"Vi har [X] installationstider kvar. Kan inte hålla den här tiden.\"", signal: "\"Vi tar det efter semestern\" utan riktig anledning", difficulty: "MEDEL", disc: { R: "BRA", Y: "PRIMÄR", Gr: "FÖRSIKTIG", B: "SVAG" } },
  { name: "Empati-close", desc: "Validera tveksamheten genuint, reframera beslutet som tryggt.", example: "\"Jag förstår att det känns stort. Du har redan investerat [X kr] i sol. Det här handlar om att få ut det du betalat för.\"", signal: "\"Det känns stort\" — rädsla, inte ointresse", difficulty: "MEDEL", disc: { R: "UNDVIK", Y: "BRA", Gr: "PRIMÄR", B: "SVAG" } },
  { name: "Kalkyl-close", desc: "Låt siffrorna tala. Presentera kalkylen och stäng.", example: "\"Ni sparar [X kr/år]. Batteriet kostar [Y kr]. Betalt efter [Z] år. 15+ år ren besparing. Ska vi gå vidare?\"", signal: "Kunden har gett alla siffror", difficulty: "LÄTT", disc: { R: "PRIMÄR", Y: "KOMPLEMENT", Gr: "BRA", B: "PRIMÄR" } },
];

// ── DATA: SPIN FRÅGOR ──
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
    { q: "Har du funderat på vad som händer med elpriset framöver?", why: "Skapar framtidsoro. Batteri ger kontroll.", listen: "Oro = bra. 'Bryr mig inte' = byt vinkel." },
    { q: "Händer det att strömmen går hos er?", why: "Backup-argumentet. Starkt för familjer.", listen: "Upplevt avbrott = guld." },
    { q: "Känner du att ni får tillräckligt bra betalt för elen ni säljer tillbaka?", why: "Triggar insikt om dålig ersättning.", listen: "'Nej' = öppning. 'Vet inte' = utbildningstillfälle." },
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
    { q: "Tänk om du kunde tjäna pengar på din el medan du sover — intressant?", why: "Nätnytta/aggregering. Overraskningsmoment.", listen: "Nyfikenhet = du har deras uppmärksamhet." },
    { q: "Om det fanns ett sätt att göra din solinvestering 2-3x mer lönsam — vill du veta hur?", why: "Framtidsvisionen. Stark för alla typer.", listen: "Ja = öppen dörr." },
    { q: "Vad skulle det betyda för er att aldrig mer oroa sig för elpriser?", why: "Emotionellt slut-argument.", listen: "Trygghet, kontroll, frihet." },
    { q: "Om batteriet betalar sig självt via besparingen — ser du nån anledning att INTE göra det?", why: "Direkt closing-fråga inbäddad.", listen: "Invändningar = hantera. Inget svar = gå på avslut." },
  ],
};

// ── DISC PROFILER (enkel vy) ──
const DISC_PROFILES = {
  R: {
    name: "Röd (Dominant)", icon: "⚡", short: "Röd",
    recognize: "Bestämd, kort i svaren, vill ha kontroll. Avbryter. Pratar om resultat och pengar.",
    drive: "Vinst och kontroll. Vill vinna. Hatar att förlora pengar.",
    fear: "Att bli lurad. Att förlora pengar. Att inte ha kontroll.",
    tempo: "SNABBT. Rakt på sak. Max 2 min intro, sen siffror.",
    say: "\"Det sparar dig [X kr/år] och du får ROI på [Y] år. Bästa systemet. Punkt.\"",
    avoid: "Vaga löften, 'det beror på', 'du kanske vill tänka på det'",
    close: "Direkt: \"Ska vi köra? Jag fixar allt.\"",
    followUp: "Kort SMS med siffror och CTA.",
    primary: "LOGOS — hårda siffror", secondary: "ETHOS — visa koll",
  },
  Y: {
    name: "Gul (Influencer)", icon: "☀️", short: "Gul",
    recognize: "Pratar mycket, entusiastisk, avviker. Gillar att skoja. Nämner grannar/vänner.",
    drive: "Social status. Vill vara först. Gillar ny teknik.",
    fear: "Att missa nåt. Att andra har det bättre. FOMO.",
    tempo: "ENERGISKT. Matcha energi. Humor, storytelling. Låt dem prata.",
    say: "\"Tänk dig att du är den första i kvarteret med det här.\"",
    avoid: "Torra siffror utan story. Att avbryta dem. Att vara för seriös.",
    close: "Social proof + FOMO: \"Vi har bara [X] tider kvar i april.\"",
    followUp: "Personligt: \"Kul samtal! Ledig tid nästa vecka. Sugen?\"",
    primary: "PATHOS — social proof, FOMO", secondary: "ETHOS — de köper dig",
  },
  Gr: {
    name: "Grön (Stabil)", icon: "🌿", short: "Grön",
    recognize: "Lugn, trevlig, få frågor. Svårt att läsa. Vill inte bråka.",
    drive: "Trygghet för familjen. Konsensus med partner. Harmoni.",
    fear: "Att göra fel. Att partnern blir arg. Problem.",
    tempo: "LUGNT. Ge tid. Forcera inte. Mjuka frågor. Tystnad ok.",
    say: "\"Vi tar hand om allt. Ni behöver inte tänka. Om nåt krånglar, ring oss.\"",
    avoid: "Press, deadlines, 'nu eller aldrig'. De stänger ner.",
    close: "Trygghet: \"Steg för steg. Inget bindande. Känns det okej?\"",
    followUp: "Omtänksamt: \"Ville höra om ni hunnit prata om det? Ingen stress.\"",
    primary: "PATHOS — trygghet, familj", secondary: "LOGOS — lugna siffror",
  },
  B: {
    name: "Blå (Analytisk)", icon: "🔬", short: "Blå",
    recognize: "Detaljerade frågor. Vill ha data. Skeptisk. Metodisk.",
    drive: "Rätt beslut baserat på fakta. Noggrannhet.",
    fear: "Att missa detalj. Att data inte stämmer. Irrationellt beslut.",
    tempo: "METODISKT. Strukturerad. Ha data redo. Skynda inte.",
    say: "\"Exakt cellkemi, cykellivslängd, garantivillkor. Allt dokumenterat.\"",
    avoid: "Avrundade siffror, 'ungefär', känsloargument utan data.",
    close: "Data-close: \"Baserat på siffrorna — ser du anledning att INTE gå vidare?\"",
    followUp: "Dokumenterat: \"Bifogar spec + ROI-kalkyl. Hunnit gå igenom?\"",
    primary: "LOGOS — exakta siffror", secondary: "ETHOS — teknisk trovärdighet",
  },
};

// ── DATA: SAMTALSBLUEPRINTS ──
const CALL_BLUEPRINTS = {
  1: {
    title: "SAMTAL 1 — Etablera allt",
    subtitle: "Varje punkt ska vara klarerad innan du lägger på. Missar du en punkt förlängs säljcykeln. Missar du tre är dealen troligtvis död.",
    timing: "20-25 minuter",
    sections: [
      { name: "1. DISC-identifiering", time: "Min 0-2", goal: "Identifiera persontyp inom 2 minuter.", steps: ["Lyssna på hälsningen (10 sek avslöjar typ)", "Ställ öppen fråga: 'Berätta om era solpaneler'", "Bekräfta läsning — anpassa tempo direkt"] },
      { name: "2. Kvalificering", time: "Min 2-4", goal: "Kan de köpa? Har de mandat?", steps: ["Äger de huset?", "Har de solpaneler?", "Vem bestämmer? (Partner involverad?)", "Timing — aktivt läge eller bara nyfikna?"] },
      { name: "3. Datainsamling", time: "Min 4-8", goal: "ALL data för exakt kalkyl.", steps: ["Systemstorlek (kW)", "Växelriktare/inverter", "Elförbrukning (kWh/år)", "Egenanvändningsgrad", "Elbil?", "Elavtal (rörligt/fast/timpris?)"] },
      { name: "4. Ekonomisk smärta", time: "Min 8-14", goal: "Kvantifiera vad det KOSTAR att inte ha batteri.", steps: ["5 pengaläckorna: säljer billigt/köper dyrt, nätavgifter, effekttoppar, arbitrage, nätnytta", "Räkna LIVE med kundens siffror", "Visa vad de redan förlorat (sunk cost)", "Bryt ner till per dag (\"44 kr om dagen\")", "Framtidsprojektion 5 + 10 år"] },
      { name: "5. Motivation mapping", time: "Min 14-16", goal: "Ta reda på VARFÖR de skaffade sol.", steps: ["Ekonomi → batteri på ekonomi", "Miljö → grön el dygnet runt", "Kontroll → oberoende av elnätet", "Social → grannarna tar nästa steg"] },
      { name: "6. Ethos-position", time: "Genomgående", goal: "Expert, inte säljare.", steps: ["Lär dem prismatiska vs pouch-celler", "Var ärlig om när batteri INTE lönar sig", "Exakta siffror, aldrig 'ungefär'", "Nämn garantin proaktivt", "Lokala installationer som referens"] },
      { name: "7. Emotionell shift", time: "Min 3-15", goal: "Ovetande → Medveten → Obekväm → Motiverad", steps: ["S1: Avslöja gapet (min 3-5)", "S2: Kvantifiera i kronor (min 5-10)", "S3: Kanalisera frustration mot systemet (min 10-12)", "S4: Ge lösningen lugnt (min 12-15)"] },
      { name: "8. Finansieringsframe", time: "Min 5-20", goal: "Priset ska aldrig bli ett hinder.", steps: ["Normalisera tidigt (min 5-8): 'De flesta delar upp'", "Jämför månadskostnad vs besparing", "Cash flow-positiv från dag 1", "Ansökan som del av processen, inte fråga"] },
      { name: "9. Next step", time: "Min 18-22", goal: "Inbokat och bekräftat.", steps: ["Boka med datum + tid (aldrig 'jag hör av mig')", "SMS-bekräftelse INNAN du lägger på", "Ge kunden uppgift (fyll i formulär)", "Sammanfatta samtalet i en mening"] },
    ]
  },
  2: {
    title: "SAMTAL 2 — Presentera & stäng",
    subtitle: "ETT jobb: stänga dealen. Max 15-20 minuter. Du ska inte bygga om caset — du ska landa det.",
    timing: "15-20 minuter",
    sections: [
      { name: "1. Förberedelse", time: "Innan samtal", goal: "Vinns eller förloras INNAN du ringer.", steps: ["Gå igenom formulärsvar", "Räkna ut kalkyl med deras siffror", "Välj systemstorlek + produkt", "Planera close-sekvens baserat på DISC", "Kolla CRM-anteckningar från samtal 1"] },
      { name: "2. Öppning", time: "Min 0-2", goal: "Påminn om varför de ska lyssna.", steps: ["Hänvisa till samtal 1 med specifik detalj", "Bekräfta formulär ifyllt", "Sätt agenda: kalkyl → lösning → next step"] },
      { name: "3. Kalkylpresentation", time: "Min 2-8", goal: "Siffrorna som stänger.", steps: ["Påminn om smärtan (30 sek)", "Presentera besparing — stapla rad för rad", "Presentera investering — hoppa direkt till månadskostnad", "Visa nettot (KILLER-steget)", "Payback + livstidsbesparing"] },
      { name: "4. Produktpresentation", time: "Min 8-10", goal: "Kort, skarp, rekommenderande.", steps: ["EN rekommendation med motivering", "EN differentiator (60 sek max teknik)", "Alternativ bara om de frågar"] },
      { name: "5. Close-sekvens", time: "Min 10-18", goal: "Gå på avslut. Punkt.", steps: ["Steg 1: Assumptive + Tystnad", "Steg 2: Invändning → Sharp Angle", "Steg 3: Sammanfattning + Netto", "Steg 4: Urgency / Takeaway", "Steg 5: Boka samtal 3 med partner"] },
    ]
  },
  3: {
    title: "SAMTAL 3 — Partner-samtalet",
    subtitle: "Partnern har hört kundens version (alltid svagare). Behandla som mini-samtal 1 riktat till partnern. SISTA chansen — 80% dead om du inte stänger.",
    timing: "18-20 minuter",
    sections: [
      { name: "1. Förberedelse", time: "Dagen innan", goal: "Du säljer till TVÅ personer nu.", steps: ["Ring kunden innan — vad tycker partnern?", "Identifiera partnerns persontyp via kunden", "Förbered svar på troliga invändningar", "Gör kunden till din allierade"] },
      { name: "2. Rapport med partner", time: "Min 0-3", goal: "Från 'okänd säljare' till 'kunnig person'.", steps: ["Hälsa på partnern med namn", "Ram: 'Jag är här för att svara på DINA frågor'", "Fråga partnern öppen fråga först"] },
      { name: "3. Mini-pitch", time: "Min 3-8", goal: "Hela caset komprimerat till 5 min.", steps: ["Smärtan (60 sek)", "Redan förlorat (30 sek)", "Lösningen (60 sek)", "Siffrorna (90 sek)", "Social proof (30 sek)"] },
      { name: "4. Partnerns invändningar", time: "Min 8-12", goal: "Skepsis-invändningar, inte nyfikenhet.", steps: ["'Låter för bra' → Visa beräkning", "'Har inte råd' → Finansieringsframe", "'Litar inte på teknik' → LFP + garanti", "'Klarar oss utan' → Kvantifiera förlust", "'Vill researcha' → Ge guide + boka uppföljning"] },
      { name: "5. Close-sekvens", time: "Min 12-18", goal: "EN chans. Låt kunden hjälpa stänga.", steps: ["Kund-endorsed close (kunden säljer)", "Partnerns fråga = din öppning → Sharp Angle", "Gemensamt beslut + Trygghet", "Sista resort: Förlust-framing", "Om total nej: Lär dig och gå vidare"] },
    ]
  }
};

// ── DATA: QUIZ FRÅGOR ──
const QUIZ_QUESTIONS = [
  { q: "Kunden säger 'Jag måste kolla med min fru'. Vad gör du?", options: ["Säger 'jag förstår' och lägger på", "Bokar gemensamt samtal direkt", "Skickar offerten på mail", "Sänker priset"], correct: 1, explanation: "Du vill aldrig avsluta utan next step. Boka samtal 3 med partner." },
  { q: "Vilken close-teknik funkar BÄST mot en Röd persontyp?", options: ["Empati-close", "Puppy Dog Close", "Assumptive Close", "Sammanfattnings-close"], correct: 2, explanation: "Röda respekterar beslutsamhet. Assumptive Close + Kalkyl-close är primära." },
  { q: "Kunden säger 'Det är för dyrt'. Vad gör du FÖRST?", options: ["Sänker priset direkt", "Frågar vad de betalar per månad i el", "Säger att ni har bäst kvalitet", "Erbjuder finansiering direkt"], correct: 1, explanation: "Kvantifiera deras nuvarande kostnad FÖRST, sen visa att batteriet kostar MINDRE." },
  { q: "Vad är den viktigaste sektionen i hela säljprocessen?", options: ["Produktpresentation", "Small talk och rapport", "Ekonomisk smärta — kvantifiera pengaläckor", "Closing-teknik"], correct: 2, explanation: "Utan kvantifierad smärta i kronor har du inget avslut." },
  { q: "En Grön kund verkar intresserad men säger ingenting. Vad gör du?", options: ["Pushar hårdare med urgency", "Ger dem tystnad och tid att tänka", "Avslutar samtalet", "Ber dem prata med partnern"], correct: 1, explanation: "Gröna behöver tid. Forcera inte. Puppy Dog Close eller Empati-close." },
  { q: "När ska du nämna LF Finans FÖRSTA gången?", options: ["Vid avslut, om de tycker det är dyrt", "Minut 5-8, normalisera tidigt", "Aldrig, det visar att det är dyrt", "Bara om de frågar"], correct: 1, explanation: "Plantera fröet i minut 5-8. Vid avslut är det desperat." },
  { q: "Hur vet du att kunden har 'Gul' persontyp?", options: ["Kort och otålig i telefon", "Ställer detaljerade tekniska frågor", "Pratar mycket, entusiastisk, nämner grannar", "Lugn, trevlig, svårt att läsa"], correct: 2, explanation: "Gula pratar mycket, avviker från ämne, gillar att skoja, nämner social kontext." },
  { q: "Kunden har sagt ja till problemet, ja till lösningen, ja till siffrorna. Vad gör du?", options: ["Frågar om de vill köpa", "Antar att de köper — boka direkt", "Skickar mer info per mail", "Ger dem tid att tänka"], correct: 1, explanation: "Gyllene principen: de har redan köpt. Du hjälper dem formalisera." },
  { q: "Vad är skillnaden mellan prismatiska celler och pouch-celler?", options: ["Ingen skillnad", "Prismatiska är billigare men sämre", "Prismatiska håller 6000+ cykler vs 3000", "Pouch-celler är alltid bättre"], correct: 2, explanation: "Prismatiska = 6000+ cykler, 10% kapacitetstapp. Pouch = 3000 cykler, 20% tapp." },
  { q: "Du har försökt 2 closes utan resultat. Vad gör du ALDRIG?", options: ["Provar en tredje teknik", "Bokar samtal 2 med specifik tid", "Säger 'jag hör av mig nästa vecka'", "Ger kunden en uppgift att göra"], correct: 2, explanation: "'Jag hör av mig' = deal dör i 70% av fallen. ALLTID specifik tid." },
  { q: "Vilken ethos-byggare är starkast?", options: ["Prata skit om konkurrenter", "Lär kunden något nytt (prismatiska vs pouch)", "Överdriv besparingssiffrorna", "Nämn hur många installationer i Sverige"], correct: 1, explanation: "Lär dem skillnaden mellan celltyper. De kan inte unhear det. Du = expert." },
  { q: "En Blå kund säger 'Jag vill se all dokumentation först'. Vad gör du?", options: ["Försöker stänga ändå", "Ger dem ALLT. PDF:er, spec, garanti. De kommer tillbaka om data håller.", "Säger att det inte finns", "Minimerar deras oro"], correct: 1, explanation: "Blåa behöver data. Ge dem allt. Om din produkt håller, stänger de själva." },
];

// ── DATA: VECKO-CHECKIN FRÅGOR ──
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

// ═══════════════════════════════════════════
// UTILITY: SHUFFLE
// ═══════════════════════════════════════════
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ═══════════════════════════════════════════
// SVG RADAR CHART COMPONENT
// Used as "profile picture" for each seller
// ═══════════════════════════════════════════
const RadarProfileSVG = ({ aspectScores, size = 200, showLabels = true, className = "" }) => {
  const aspects = ["WORK", "SALES", "STRESS", "DECIDE", "CONFLICT", "SOCIAL"];
  const labels = { WORK: "ARBETE", SALES: "SÄLJ", STRESS: "STRESS", DECIDE: "BESLUT", CONFLICT: "KONFLIKT", SOCIAL: "SOCIALT" };
  const colors = { R: "#FF3B3B", Y: "#FFBE0B", Gr: "#06FFA5", B: "#3A86FF" };

  const center = size / 2;
  const maxRadius = size * 0.36;
  const n = aspects.length;

  const getPoint = (i, radius) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    return { x: center + radius * Math.cos(angle), y: center + radius * Math.sin(angle) };
  };

  // Background rings
  const rings = [1, 2, 3, 4].map(r => {
    const radius = (maxRadius / 4) * r;
    const points = Array.from({ length: n }, (_, i) => getPoint(i, radius));
    return points.map(p => `${p.x},${p.y}`).join(" ");
  });

  // Axis lines
  const axes = Array.from({ length: n }, (_, i) => getPoint(i, maxRadius));

  // Color shapes
  const colorKeys = ["R", "Y", "Gr", "B"];
  const shapes = colorKeys.map(ck => {
    const points = aspects.map((aspect, i) => {
      const pct = (aspectScores[aspect]?.percents?.[ck] || 0) / 100;
      return getPoint(i, maxRadius * pct);
    });
    return { key: ck, color: colors[ck], points: points.map(p => `${p.x},${p.y}`).join(" "), dots: points };
  });

  // Labels
  const labelRadius = maxRadius + (showLabels ? size * 0.08 : 0);
  const labelPoints = aspects.map((aspect, i) => ({
    ...getPoint(i, labelRadius),
    aspect,
    dominant: aspectScores[aspect]?.dominant || "R"
  }));

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className={className} style={{ width: size, height: size }}>
      {/* Background rings */}
      {rings.map((pts, i) => (
        <polygon key={i} points={pts} fill="none" stroke="#1E3A5F" strokeWidth="1" opacity="0.5" />
      ))}
      {/* Axis lines */}
      {axes.map((pt, i) => (
        <line key={i} x1={center} y1={center} x2={pt.x} y2={pt.y} stroke="#1E3A5F" strokeWidth="1" opacity="0.3" />
      ))}
      {/* Color shapes */}
      {shapes.map(s => (
        <g key={s.key}>
          <polygon points={s.points} fill={s.color} fillOpacity="0.15" stroke={s.color} strokeWidth="1.5" strokeOpacity="0.8" />
          {s.dots.map((d, i) => (
            <circle key={i} cx={d.x} cy={d.y} r={size * 0.012} fill={s.color} />
          ))}
        </g>
      ))}
      {/* Labels */}
      {showLabels && labelPoints.map((lp, i) => (
        <g key={i}>
          <text x={lp.x} y={lp.y - 6} textAnchor="middle" dominantBaseline="middle" fill="#E6F1FF" fontSize={size * 0.05} fontWeight="700" fontFamily="Inter,system-ui,sans-serif">{labels[lp.aspect]}</text>
          <text x={lp.x} y={lp.y + 8} textAnchor="middle" dominantBaseline="middle" fill={colors[lp.dominant]} fontSize={size * 0.04} fontWeight="600" fontFamily="Inter,system-ui,sans-serif">{DISC_PROFILES_FULL[lp.dominant]?.name}</text>
        </g>
      ))}
    </svg>
  );
};

// Mini radar (profile picture)
const RadarAvatar = ({ aspectScores, size = 64, dominantColor = "#00D9FF" }) => {
  const aspects = ["WORK", "SALES", "STRESS", "DECIDE", "CONFLICT", "SOCIAL"];
  const colors = { R: "#FF3B3B", Y: "#FFBE0B", Gr: "#06FFA5", B: "#3A86FF" };
  const center = size / 2;
  const maxRadius = size * 0.4;
  const n = aspects.length;

  const getPoint = (i, radius) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    return { x: center + radius * Math.cos(angle), y: center + radius * Math.sin(angle) };
  };

  const ring = Array.from({ length: n }, (_, i) => getPoint(i, maxRadius)).map(p => `${p.x},${p.y}`).join(" ");

  const colorKeys = ["R", "Y", "Gr", "B"];
  const shapes = colorKeys.map(ck => {
    const points = aspects.map((aspect, i) => {
      const pct = (aspectScores?.[aspect]?.percents?.[ck] || 0) / 100;
      return getPoint(i, maxRadius * pct);
    });
    return { key: ck, color: colors[ck], points: points.map(p => `${p.x},${p.y}`).join(" ") };
  });

  return (
    <svg viewBox={`0 0 ${size} ${size}`} style={{ width: size, height: size }}>
      <circle cx={center} cy={center} r={size / 2 - 1} fill="#0A1628" stroke={dominantColor} strokeWidth="2" />
      <polygon points={ring} fill="none" stroke="#1E3A5F" strokeWidth="0.5" opacity="0.5" />
      {shapes.map(s => (
        <polygon key={s.key} points={s.points} fill={s.color} fillOpacity="0.2" stroke={s.color} strokeWidth="1" strokeOpacity="0.7" />
      ))}
    </svg>
  );
};

// ═══════════════════════════════════════════
// KOMPONENTER
// ═══════════════════════════════════════════

const Badge = ({ color, children }) => (
  <span className="inline-block px-2 py-0.5 rounded text-xs font-bold" style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}>{children}</span>
);

const Card = ({ children, className = "", glow = false }) => (
  <div className={`bg-gray-900 border border-gray-700 rounded-lg p-5 ${glow ? "shadow-lg shadow-cyan-900/20" : ""} ${className}`}>
    {children}
  </div>
);

const SectionTitle = ({ icon: Icon, title, subtitle }) => (
  <div className="mb-6">
    <div className="flex items-center gap-3 mb-2">
      {Icon && <Icon size={22} className="text-cyan-400" />}
      <h2 className="text-xl font-bold text-white tracking-wide">{title}</h2>
    </div>
    {subtitle && <p className="text-gray-400 text-sm ml-9">{subtitle}</p>}
  </div>
);

// ═══════════════════════════════════════════
// DISC TEST — ONBOARDING (50 frågor)
// ═══════════════════════════════════════════
const DiscTest = ({ onComplete }) => {
  const [phase, setPhase] = useState("intro"); // intro, quiz, results, pin
  const [name, setName] = useState("");
  const [pin, setPin] = useState(["", "", "", ""]);
  const pinRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState(new Array(DISC_QUESTIONS.length).fill(null));
  const [times, setTimes] = useState(new Array(DISC_QUESTIONS.length).fill(0));
  const [changeCount, setChangeCount] = useState(new Array(DISC_QUESTIONS.length).fill(0));
  const [optionOrder] = useState(() => DISC_QUESTIONS.map(q => shuffle(q.options)));
  const [qStartTime, setQStartTime] = useState(0);
  const [timerDisplay, setTimerDisplay] = useState("0.0s");
  const timerRef = useRef(null);

  const startQuiz = () => {
    if (!name.trim()) return;
    setPhase("quiz");
    setQStartTime(Date.now());
  };

  // Timer effect
  useEffect(() => {
    if (phase !== "quiz") return;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - qStartTime) / 1000;
      setTimerDisplay(elapsed.toFixed(1) + "s");
    }, 100);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase, qStartTime, currentQ]);

  const recordTime = () => {
    const elapsed = Date.now() - qStartTime;
    setTimes(prev => {
      const t = [...prev];
      t[currentQ] = (t[currentQ] || 0) + elapsed;
      return t;
    });
  };

  const selectOption = (type) => {
    if (answers[currentQ] !== null && answers[currentQ] !== type) {
      setChangeCount(prev => { const c = [...prev]; c[currentQ]++; return c; });
    }
    setAnswers(prev => { const a = [...prev]; a[currentQ] = type; return a; });
  };

  const nextQ = () => {
    recordTime();
    if (currentQ < DISC_QUESTIONS.length - 1) {
      setCurrentQ(currentQ + 1);
      setQStartTime(Date.now());
    } else {
      finishTest();
    }
  };

  const prevQ = () => {
    recordTime();
    if (currentQ > 0) {
      setCurrentQ(currentQ - 1);
      setQStartTime(Date.now());
    }
  };

  const calculateAspectScores = () => {
    const aspects = ["WORK", "SALES", "STRESS", "DECIDE", "CONFLICT", "SOCIAL"];
    const result = {};
    aspects.forEach(aspect => {
      const aspectQs = DISC_QUESTIONS.map((q, i) => ({ q, i })).filter(x => x.q.aspect === aspect);
      const scores = { R: 0, Y: 0, Gr: 0, B: 0 };
      aspectQs.forEach(({ i }) => { if (answers[i]) scores[answers[i]]++; });
      const total = scores.R + scores.Y + scores.Gr + scores.B;
      const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
      result[aspect] = {
        dominant: entries[0][0],
        scores,
        total,
        percents: {
          R: total ? (scores.R / total) * 100 : 0,
          Y: total ? (scores.Y / total) * 100 : 0,
          Gr: total ? (scores.Gr / total) * 100 : 0,
          B: total ? (scores.B / total) * 100 : 0
        }
      };
    });
    return result;
  };

  const finishTest = () => {
    recordTime();
    if (timerRef.current) clearInterval(timerRef.current);

    const scores = { R: 0, Y: 0, Gr: 0, B: 0 };
    answers.forEach(a => { if (a) scores[a]++; });
    const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const dominant = entries[0][0];
    const secondary = entries[1][0];

    const totalTime = times.reduce((a, b) => a + b, 0) / 1000;
    const avgTime = totalTime / DISC_QUESTIONS.length;
    const slowThreshold = avgTime * 1.8;
    const slowQuestions = DISC_QUESTIONS.map((q, i) => ({ q: q.q, aspect: q.aspect, i, time: times[i] / 1000 }))
      .filter(x => x.time > slowThreshold)
      .sort((a, b) => b.time - a.time)
      .slice(0, 5);
    const totalChanges = changeCount.reduce((a, b) => a + b, 0);
    const consistencyScore = 100 - Math.min(100, totalChanges * 5);
    const aspectScores = calculateAspectScores();

    const profileData = {
      name: name.trim(),
      discType: dominant,
      secondary,
      scores,
      aspectScores,
      totalTime,
      avgTime,
      slowQuestions,
      totalChanges,
      consistencyScore,
      answers,
      times,
      timestamp: Date.now()
    };

    // Also save to neuralProfiles for compatibility with admin panel
    try {
      let allResults = [];
      const existing = localStorage.getItem("neuralProfiles");
      if (existing) allResults = JSON.parse(existing);
      allResults = allResults.filter(r => r.name !== name.trim());
      allResults.push({
        name: name.trim(),
        timestamp: Date.now(),
        dominant,
        secondary,
        scores,
        aspectScores,
        totalTime,
        avgTime,
        slowQuestions,
        totalChanges,
        consistencyScore,
        answers,
        times
      });
      localStorage.setItem("neuralProfiles", JSON.stringify(allResults));
    } catch (e) { console.error("neuralProfiles save failed:", e); }

    setPhase("results");
    // Store result for display
    window.__discResult = profileData;
  };

  // ── INTRO SCREEN ──
  if (phase === "intro") {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4" style={{ background: "linear-gradient(180deg, #000814 0%, #001D3D 50%, #000814 100%)" }}>
        <div className="max-w-lg w-full">
          <div className="text-center mb-8">
            <div className="text-xs tracking-widest mb-3" style={{ color: "#00D9FF" }}>▸ NEURAL PROFILE v2.1 // SELF-ASSESSMENT</div>
            <h1 className="text-4xl font-black mb-3" style={{ background: "linear-gradient(135deg, #00D9FF 0%, #8338EC 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>WHO ARE YOU</h1>
            <p className="text-gray-400 text-sm tracking-wide">Beteendeprofilering för säljare. Brutal ärlighet aktiverad.</p>
          </div>

          <div className="grid grid-cols-4 gap-3 mb-8">
            {[{ val: "50", lbl: "FRÅGOR" }, { val: "15m", lbl: "TID" }, { val: "6", lbl: "ASPEKTER" }, { val: "T", lbl: "TIMER" }].map((s, i) => (
              <div key={i} className="bg-gray-900 border border-gray-700 p-4 text-center rounded-lg">
                <div className="text-2xl font-black" style={{ color: "#00D9FF" }}>{s.val}</div>
                <div className="text-xs text-gray-500 tracking-widest mt-1">{s.lbl}</div>
              </div>
            ))}
          </div>

          <Card glow className="mb-6">
            <label className="text-xs tracking-widest block mb-2" style={{ color: "#00D9FF" }}>// OPERATÖRSIDENTIFIERING</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              className="w-full bg-gray-950 border border-gray-700 text-white p-3 rounded text-sm focus:border-cyan-500 focus:outline-none font-mono tracking-wide"
              placeholder="Ange ditt namn" onKeyDown={e => e.key === "Enter" && startQuiz()} />
          </Card>

          <Card className="mb-6 border-l-2" style={{ borderLeftColor: "#00D9FF" }}>
            <div className="text-xs tracking-widest mb-3" style={{ color: "#00D9FF" }}>PROTOKOLL</div>
            <div className="space-y-2 text-sm text-gray-300">
              <p>Svara ärligt. Inte vem du vill vara — vem du är.</p>
              <p>Första magkänslan är oftast rätt. Överanalysera inte.</p>
              <p>Timer mäter responstid. Långa pauser = intern konflikt = mer data.</p>
              <p>Alternativen är slumpmässigt ordnade. Du kan inte gissa mönstret.</p>
            </div>
          </Card>

          <button onClick={startQuiz} disabled={!name.trim()}
            className="w-full py-4 rounded font-bold tracking-widest text-sm transition-all disabled:opacity-30"
            style={{ background: "#00D9FF", color: "#000814" }}>
            INITIERA TEST
          </button>
        </div>
      </div>
    );
  }

  // ── QUIZ SCREEN ──
  if (phase === "quiz") {
    const q = DISC_QUESTIONS[currentQ];
    const opts = optionOrder[currentQ];
    const progress = ((currentQ + 1) / DISC_QUESTIONS.length) * 100;
    const elapsed = parseFloat(timerDisplay);
    const isSlow = elapsed > 15;

    return (
      <div className="min-h-screen bg-gray-950 p-4" style={{ background: "linear-gradient(180deg, #000814 0%, #001D3D 50%, #000814 100%)" }}>
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-4 text-sm">
            <div>
              <span className="text-gray-500 text-xs tracking-widest">OPERATÖR</span>
              <div className="text-white font-bold">{name.toUpperCase()}</div>
            </div>
            <div className="text-center">
              <span className="text-gray-500 text-xs tracking-widest">FRÅGA</span>
              <div className="text-white font-bold">{currentQ + 1} / {DISC_QUESTIONS.length}</div>
            </div>
            <div className="text-right">
              <span className="text-gray-500 text-xs tracking-widest">RESPONSTID</span>
              <div className={`font-bold font-mono ${isSlow ? "text-yellow-400" : "text-cyan-400"}`}>{timerDisplay}</div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-gray-800 rounded-full h-1.5 mb-8">
            <div className="h-1.5 rounded-full transition-all duration-300" style={{ width: `${progress}%`, background: "linear-gradient(90deg, #00D9FF, #8338EC)" }} />
          </div>

          {/* Question */}
          <Card glow className="mb-6">
            <div className="text-xs tracking-widest mb-4" style={{ color: "#00D9FF" }}>
              // QUERY {String(currentQ + 1).padStart(3, "0")} // ASPECT: {q.aspect}
            </div>
            <h3 className="text-lg font-bold text-white mb-6">{q.q}</h3>

            <div className="space-y-3">
              {opts.map((opt, i) => (
                <button key={i} onClick={() => selectOption(opt.type)}
                  className={`w-full text-left p-4 rounded border transition-all text-sm ${answers[currentQ] === opt.type
                    ? "border-cyan-500 bg-cyan-900/20 text-white"
                    : "border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-500 hover:bg-gray-750"}`}>
                  {opt.text}
                </button>
              ))}
            </div>
          </Card>

          {/* Navigation */}
          <div className="flex justify-between">
            <button onClick={prevQ} disabled={currentQ === 0}
              className="flex items-center gap-2 px-4 py-2 rounded text-sm font-bold bg-gray-800 text-gray-400 hover:text-white disabled:opacity-30 transition-all">
              <ChevronLeft size={16} /> PREV
            </button>
            <button onClick={nextQ} disabled={answers[currentQ] === null}
              className="flex items-center gap-2 px-6 py-2 rounded text-sm font-bold transition-all disabled:opacity-30"
              style={{ background: answers[currentQ] !== null ? "#00D9FF" : "#333", color: answers[currentQ] !== null ? "#000814" : "#666" }}>
              {currentQ === DISC_QUESTIONS.length - 1 ? "ANALYSERA" : "NÄSTA"} <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── RESULTS SCREEN ──
  if (phase === "results") {
    const result = window.__discResult;
    const profile = DISC_PROFILES_FULL[result.discType];
    const total = result.scores.R + result.scores.Y + result.scores.Gr + result.scores.B;

    return (
      <div className="min-h-screen bg-gray-950 p-4" style={{ background: "linear-gradient(180deg, #000814 0%, #001D3D 50%, #000814 100%)" }}>
        <div className="max-w-3xl mx-auto">
          {/* Hero */}
          <div className="text-center py-8 mb-6">
            <div className="text-xs tracking-widest mb-2" style={{ color: "#00D9FF" }}>// PROFIL IDENTIFIERAD</div>
            <div className="text-5xl font-black mb-2" style={{ color: profile.color }}>{profile.name}</div>
            <div className="text-lg text-gray-400 italic mb-4">{profile.archetype}</div>
            <p className="text-gray-300 max-w-xl mx-auto">{profile.oneLiner}</p>
          </div>

          {/* Score breakdown */}
          <div className="grid grid-cols-4 gap-3 mb-8">
            {[
              { key: "R", name: "RÖD", color: "#FF3B3B" },
              { key: "Y", name: "GUL", color: "#FFBE0B" },
              { key: "Gr", name: "GRÖN", color: "#06FFA5" },
              { key: "B", name: "BLÅ", color: "#3A86FF" },
            ].map(t => (
              <div key={t.key} className="bg-gray-900 border border-gray-700 rounded-lg p-4 text-center">
                <div className="text-xs tracking-widest mb-1" style={{ color: t.color }}>{t.name}</div>
                <div className="text-2xl font-black text-white">{result.scores[t.key]}</div>
                <div className="text-xs text-gray-500">{Math.round((result.scores[t.key] / total) * 100)}%</div>
              </div>
            ))}
          </div>

          {/* Radar */}
          <Card glow className="mb-8 flex flex-col items-center">
            <h3 className="text-sm font-bold tracking-widest mb-4" style={{ color: "#00D9FF" }}>ASPEKTANALYS</h3>
            <RadarProfileSVG aspectScores={result.aspectScores} size={400} />
          </Card>

          {/* Behavioral metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            <Card><div className="text-xs text-gray-500 tracking-widest">TOTAL TID</div><div className="text-xl font-black text-white">{Math.round(result.totalTime)}s</div><div className="text-xs text-gray-500">{Math.round(result.avgTime)}s snitt</div></Card>
            <Card><div className="text-xs text-gray-500 tracking-widest">ÄNDRADE SVAR</div><div className="text-xl font-black text-white">{result.totalChanges}</div><div className="text-xs text-gray-500">{result.totalChanges > 8 ? "Hög osäkerhet" : result.totalChanges > 3 ? "Normalt" : "Hög övertygelse"}</div></Card>
            <Card><div className="text-xs text-gray-500 tracking-widest">KONSISTENS</div><div className="text-xl font-black text-white">{result.consistencyScore}%</div></Card>
            <Card><div className="text-xs text-gray-500 tracking-widest">REFLEKTIONSFRÅGOR</div><div className="text-xl font-black text-white">{result.slowQuestions.length}</div></Card>
          </div>

          {/* Superpowers & Blindspots */}
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <Card className="border-l-2" style={{ borderLeftColor: "#06FFA5" }}>
              <h4 className="text-sm font-bold tracking-widest mb-3" style={{ color: "#06FFA5" }}>SUPERKRAFTER</h4>
              <div className="space-y-2">{profile.superpowers.map((s, i) => <p key={i} className="text-gray-300 text-sm">{s}</p>)}</div>
            </Card>
            <Card className="border-l-2" style={{ borderLeftColor: "#FF3B3B" }}>
              <h4 className="text-sm font-bold tracking-widest mb-3" style={{ color: "#FF3B3B" }}>BLINDSPOTS</h4>
              <div className="space-y-2">{profile.blindspots.map((s, i) => <p key={i} className="text-gray-300 text-sm">{s}</p>)}</div>
            </Card>
          </div>

          {/* Biggest trap */}
          <Card className="mb-6 border-l-2 border-yellow-500">
            <h4 className="text-sm font-bold text-yellow-400 tracking-widest mb-2">STÖRSTA FÄLLAN</h4>
            <p className="text-gray-300 text-sm">{profile.biggestTrap}</p>
          </Card>

          {/* Matrix */}
          <Card glow className="mb-6">
            <h4 className="text-sm font-bold tracking-widest mb-4" style={{ color: "#00D9FF" }}>ANPASSNINGSMATRIS — HUR DU SÄLJER TILL ANDRA</h4>
            <div className="grid md:grid-cols-2 gap-3">
              {["R", "Y", "Gr", "B"].map(k => (
                <div key={k} className="bg-gray-800 rounded p-4 border-l-2" style={{ borderColor: DISC_COLORS[k] }}>
                  <h5 className="font-bold text-sm mb-2" style={{ color: DISC_COLORS[k] }}>{profile.matrix[k].title}</h5>
                  <p className="text-gray-300 text-xs">{profile.matrix[k].text}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* Calibration */}
          <Card className="mb-8 border-l-2" style={{ borderLeftColor: "#06FFA5", background: "rgba(6, 255, 165, 0.05)" }}>
            <h4 className="text-sm font-bold tracking-widest mb-2" style={{ color: "#06FFA5" }}>KALIBRERING — SÄG DET HÄR INNAN VARJE SAMTAL</h4>
            <p className="text-white font-bold italic">"{profile.calibration}"</p>
          </Card>

          {/* Go to PIN creation */}
          <button onClick={() => setPhase("pin")}
            className="w-full py-4 rounded font-bold tracking-widest text-sm transition-all"
            style={{ background: "linear-gradient(135deg, #00D9FF 0%, #8338EC 100%)", color: "#000814" }}>
            VÄLJ DIN PINKOD →
          </button>
        </div>
      </div>
    );
  }

  // ── PIN CREATION SCREEN ──
  if (phase === "pin") {
    const result = window.__discResult;
    const handlePinInput = (idx, val) => {
      if (val.length > 1) val = val.slice(-1);
      if (val && !/^\d$/.test(val)) return;
      const newPin = [...pin];
      newPin[idx] = val;
      setPin(newPin);
      if (val && idx < 3) pinRefs[idx + 1].current?.focus();
    };
    const handlePinKeyDown = (idx, e) => {
      if (e.key === "Backspace" && !pin[idx] && idx > 0) {
        pinRefs[idx - 1].current?.focus();
      }
    };
    const pinComplete = pin.every(d => d !== "");
    const handleFinish = () => {
      if (!pinComplete) return;
      const pinCode = pin.join("");
      const profileWithPin = { ...result, pin: pinCode };
      // Save pin to neuralProfiles too
      try {
        let allResults = JSON.parse(localStorage.getItem("neuralProfiles") || "[]");
        allResults = allResults.map(r => r.name === result.name ? { ...r, pin: pinCode } : r);
        localStorage.setItem("neuralProfiles", JSON.stringify(allResults));
      } catch (e) {}
      onComplete(profileWithPin);
    };

    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4" style={{ background: "linear-gradient(180deg, #000814 0%, #001D3D 50%, #000814 100%)" }}>
        <div className="max-w-md w-full text-center">
          <Lock size={48} className="mx-auto mb-6" style={{ color: "#00D9FF" }} />
          <h2 className="text-2xl font-black text-white mb-2">VÄLJ DIN PINKOD</h2>
          <p className="text-gray-400 text-sm mb-8">4 siffror för att logga in som {result?.name}</p>

          <div className="flex justify-center gap-4 mb-8">
            {pin.map((digit, i) => (
              <input key={i} ref={pinRefs[i]} type="text" inputMode="numeric" maxLength={1}
                value={digit} onChange={e => handlePinInput(i, e.target.value)}
                onKeyDown={e => handlePinKeyDown(i, e)}
                className="w-20 h-24 text-center text-4xl font-black rounded-xl border-2 bg-gray-900 text-white outline-none transition-all focus:shadow-lg"
                style={{ borderColor: digit ? "#00D9FF" : "#1E3A5F", boxShadow: digit ? "0 0 20px rgba(0,217,255,0.2)" : "none" }}
                autoFocus={i === 0} />
            ))}
          </div>

          <button onClick={handleFinish} disabled={!pinComplete}
            className="w-full py-4 rounded font-bold tracking-widest text-sm transition-all disabled:opacity-30"
            style={{ background: pinComplete ? "linear-gradient(135deg, #00D9FF 0%, #8338EC 100%)" : "#333", color: pinComplete ? "#000814" : "#666" }}>
            STARTA TRÄNING →
          </button>
        </div>
      </div>
    );
  }
};

// ═══════════════════════════════════════════
// TEAM VIEW
// ═══════════════════════════════════════════
const TeamView = ({ profile }) => {
  const [profiles, setProfiles] = useState([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("neuralProfiles");
      if (stored) setProfiles(JSON.parse(stored));
    } catch (e) {}
  }, []);

  return (
    <div>
      <SectionTitle icon={Users} title="TEAMET" subtitle="Alla säljares personlighetsprofiler" />

      {profiles.length === 0 ? (
        <Card>
          <p className="text-gray-400 text-sm text-center py-8">Inga profiler skapade ännu. Be dina kollegor göra testet!</p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
          {profiles.map((p, i) => {
            const dominantColor = DISC_COLORS[p.dominant] || "#00D9FF";
            return (
              <div key={i} className="flex flex-col items-center">
                <div className="text-sm font-bold text-white mb-2 tracking-wide">{p.name}</div>
                <RadarAvatar aspectScores={p.aspectScores} size={120} dominantColor={dominantColor} />
                <div className="mt-2 text-xs font-bold tracking-widest" style={{ color: dominantColor }}>
                  {DISC_PROFILES_FULL[p.dominant]?.name || p.dominant}
                </div>
                {p.secondary && (
                  <div className="text-xs text-gray-500 mt-0.5">
                    Sekundär: <span style={{ color: DISC_COLORS[p.secondary] }}>{DISC_SHORT[p.secondary]}</span>
                  </div>
                )}
                <div className="text-xs text-gray-600 mt-1">
                  Konsistens: {p.consistencyScore || "—"}%
                </div>
              </div>
            );
          })}
        </div>
      )}

      {profiles.length > 0 && (
        <Card className="mt-8" glow>
          <h3 className="text-sm font-bold tracking-widest mb-4" style={{ color: "#00D9FF" }}>TEAMFÖRDELNING</h3>
          <div className="grid grid-cols-4 gap-3">
            {["R", "Y", "Gr", "B"].map(k => {
              const count = profiles.filter(p => p.dominant === k).length;
              return (
                <div key={k} className="text-center">
                  <div className="text-2xl font-black" style={{ color: DISC_COLORS[k] }}>{count}</div>
                  <div className="text-xs text-gray-500">{DISC_SHORT[k]}</div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
};

// ── DASHBOARD ──
const Dashboard = ({ profile, checkins }) => {
  const totalCalls = checkins.reduce((s, c) => s + (parseInt(c.answers?.[0]) || 0), 0);
  const totalDeals = checkins.filter(c => c.answers?.[4]?.toLowerCase().includes("ja")).length;
  const streak = checkins.length;
  const fullProfile = DISC_PROFILES_FULL[profile?.discType];
  const insight = generatePersonalInsight(profile);

  return (
    <div>
      <SectionTitle icon={Home} title="DASHBOARD" subtitle={`Välkommen tillbaka, ${profile?.name || "Säljare"}`} />

      {/* Personalized profile card */}
      {profile?.aspectScores && insight && (
        <Card glow className="mb-6">
          <div className="flex items-start gap-6">
            <RadarAvatar aspectScores={profile.aspectScores} size={80} dominantColor={DISC_COLORS[profile.discType]} />
            <div className="flex-1">
              <h3 className="text-lg font-bold text-white">{profile.name}</h3>
              <div className="text-sm font-bold mt-1" style={{ color: DISC_COLORS[profile.discType] }}>{insight.headline}</div>
              <p className="text-gray-400 text-sm mt-2">{insight.selfPortrait}</p>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "SAMTAL TOTALT", val: totalCalls, icon: Phone, color: "text-cyan-400" },
          { label: "DEALS STÄNGDA", val: totalDeals, icon: Target, color: "text-green-400" },
          { label: "VECKO-STREAK", val: streak, icon: Zap, color: "text-yellow-400" },
          { label: "DIN TYP", val: profile?.discType ? DISC_SHORT[profile.discType] : "?", icon: User, color: profile?.discType ? `text-[${DISC_COLORS[profile.discType]}]` : "text-gray-400" },
        ].map((s, i) => (
          <Card key={i} glow>
            <s.icon size={18} className={`${s.color} mb-2`} />
            <div className="text-2xl font-black text-white">{s.val}</div>
            <div className="text-xs text-gray-500 tracking-widest mt-1">{s.label}</div>
          </Card>
        ))}
      </div>

      {/* Daily mantra - personalized per combo */}
      {insight && (
        <Card className="mb-6 border-l-2" style={{ borderLeftColor: DISC_COLORS[profile?.discType], background: `${DISC_COLORS[profile?.discType]}08` }}>
          <h3 className="text-sm font-bold tracking-widest mb-3" style={{ color: DISC_COLORS[profile?.discType] }}>DITT MANTRA IDAG</h3>
          <p className="text-white text-xl font-black italic mb-4">"{insight.dailyMantra}"</p>
        </Card>
      )}

      {/* Hidden conflict insight */}
      {insight?.hiddenConflict && (
        <Card className="mb-6 border-l-2" style={{ borderLeftColor: "#8338EC" }}>
          <div className="text-xs tracking-widest mb-2" style={{ color: "#8338EC" }}>DIN DOLDA SPÄNNING</div>
          <p className="text-gray-300 text-sm">{insight.hiddenConflict}</p>
        </Card>
      )}

      {/* Sales identity */}
      {insight?.salesIdentity && (
        <Card className="mb-6 border-l-2 border-cyan-500">
          <div className="text-xs text-cyan-400 tracking-widest mb-2">DIN SÄLJIDENTITET</div>
          <p className="text-gray-300 text-sm">{insight.salesIdentity}</p>
        </Card>
      )}

      {/* Growth edge */}
      {insight?.growthEdge && (
        <Card className="mb-6 border-l-2" style={{ borderLeftColor: "#06FFA5", background: "rgba(6,255,165,0.05)" }}>
          <div className="text-xs tracking-widest mb-2" style={{ color: "#06FFA5" }}>DIN NÄSTA NIVÅ</div>
          <p className="text-gray-300 text-sm">{insight.growthEdge}</p>
        </Card>
      )}

      {/* Coaching reminder */}
      {fullProfile && (
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <Card className="border-l-2" style={{ borderLeftColor: "#06FFA5" }}>
            <div className="text-xs text-green-400 tracking-widest mb-2">GÖR MER AV</div>
            {fullProfile.mustDoMore.slice(0, 3).map((m, i) => <p key={i} className="text-gray-300 text-sm">{m}</p>)}
          </Card>
          <Card className="border-l-2" style={{ borderLeftColor: "#FF3B3B" }}>
            <div className="text-xs text-red-400 tracking-widest mb-2">GÖR MINDRE AV</div>
            {fullProfile.mustDoLess.slice(0, 3).map((m, i) => <p key={i} className="text-gray-300 text-sm">{m}</p>)}
          </Card>
        </div>
      )}

      <Card>
        <h3 className="text-sm font-bold text-cyan-400 tracking-widest mb-3">SENASTE VECKO-CHECKINS</h3>
        {checkins.length === 0 ? (
          <p className="text-gray-500 text-sm">Inga checkins ännu. Gör din första veckoreflektion!</p>
        ) : (
          <div className="space-y-2">
            {checkins.slice(-5).reverse().map((c, i) => (
              <div key={i} className="flex items-center justify-between border-b border-gray-800 pb-2">
                <span className="text-gray-400 text-sm">{c.date}</span>
                <span className="text-white text-sm">{c.answers?.[0] || 0} samtal, {c.answers?.[4]?.toLowerCase().includes("ja") ? "deal" : "ingen deal"}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

// ── SAMTALSGUIDE (personalized tips per disc type) ──
const CallGuide = ({ profile }) => {
  const [activeCall, setActiveCall] = useState(1);
  const [activeStep, setActiveStep] = useState(0);
  const blueprint = CALL_BLUEPRINTS[activeCall];
  const fullProfile = DISC_PROFILES_FULL[profile?.discType];

  return (
    <div>
      <SectionTitle icon={Phone} title="SAMTALSGUIDE" subtitle="Steg-för-steg blueprint för varje samtal" />

      {/* Personalized tip */}
      {fullProfile && (
        <Card className="mb-4 border-l-2" style={{ borderLeftColor: fullProfile.color, background: `${fullProfile.color}08` }}>
          <div className="text-xs tracking-widest mb-1" style={{ color: fullProfile.color }}>TIPS FÖR DIG SOM {fullProfile.name}</div>
          <p className="text-gray-300 text-sm">
            {profile?.discType === "R" && "Du vill gå snabbt — bra. Men lyssna mer i minut 4-8. Ställ frågor INNAN du pitchar."}
            {profile?.discType === "Y" && "Din energi smittar — använd den. Men håll koll på tiden. Avslut senast minut 20."}
            {profile?.discType === "Gr" && "Du bygger trygghet naturligt. Utmana dig att gå på avslut i steg 9 — det är ditt jobb."}
            {profile?.discType === "B" && "Din kunskap imponerar. Ge MAX 3 tekniska poänger per samtal. Förenkling vinner."}
          </p>
        </Card>
      )}

      <div className="flex gap-2 mb-6">
        {[1, 2, 3].map(n => (
          <button key={n} onClick={() => { setActiveCall(n); setActiveStep(0); }}
            className={`px-4 py-2 rounded text-sm font-bold tracking-wider transition-all ${activeCall === n ? "bg-cyan-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}>
            SAMTAL {n}
          </button>
        ))}
      </div>

      <Card className="mb-4" glow>
        <h3 className="text-lg font-bold text-white mb-1">{blueprint.title}</h3>
        <p className="text-gray-400 text-sm mb-2">{blueprint.subtitle}</p>
        <Badge color="#00D9FF">{blueprint.timing}</Badge>
      </Card>

      <div className="grid lg:grid-cols-4 gap-4">
        <div className="lg:col-span-1">
          <div className="space-y-1">
            {blueprint.sections.map((s, i) => (
              <button key={i} onClick={() => setActiveStep(i)}
                className={`w-full text-left px-3 py-2 rounded text-xs transition-all ${activeStep === i ? "bg-cyan-900/40 border border-cyan-700 text-cyan-300" : "bg-gray-900 text-gray-400 hover:bg-gray-800"}`}>
                <div className="font-bold">{s.name}</div>
                <div className="text-gray-500 mt-0.5">{s.time}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-3">
          <Card glow>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-bold text-white">{blueprint.sections[activeStep].name}</h4>
              <Badge color="#FFBE0B">{blueprint.sections[activeStep].time}</Badge>
            </div>
            <p className="text-cyan-400 text-sm mb-4 font-bold">MÅL: {blueprint.sections[activeStep].goal}</p>
            <div className="space-y-2">
              {blueprint.sections[activeStep].steps.map((step, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded bg-gray-800/50 border border-gray-700">
                  <span className="text-cyan-400 font-bold text-sm mt-0.5">{i + 1}.</span>
                  <span className="text-gray-200 text-sm">{step}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-6">
              <button onClick={() => setActiveStep(Math.max(0, activeStep - 1))} disabled={activeStep === 0}
                className="flex items-center gap-1 text-sm text-gray-400 hover:text-white disabled:opacity-30">
                <ChevronLeft size={16} /> Föregående
              </button>
              <button onClick={() => setActiveStep(Math.min(blueprint.sections.length - 1, activeStep + 1))} disabled={activeStep === blueprint.sections.length - 1}
                className="flex items-center gap-1 text-sm text-cyan-400 hover:text-white disabled:opacity-30">
                Nästa <ChevronRight size={16} />
              </button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

// ── INVÄNDNINGSHANTERING ──
const ObjectionHandler = () => {
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("Alla");
  const categories = ["Alla", ...new Set(OBJECTIONS.map(o => o.kat))];
  const filtered = filter === "Alla" ? OBJECTIONS : OBJECTIONS.filter(o => o.kat === filter);

  return (
    <div>
      <SectionTitle icon={Shield} title="INVÄNDNINGSHANTERING" subtitle="Validera först. Ställ fråga sedan. Pitcha aldrig mot invändningen — gå runt den." />
      <div className="flex flex-wrap gap-2 mb-6">
        {categories.map(c => (
          <button key={c} onClick={() => setFilter(c)}
            className={`px-3 py-1.5 rounded text-xs font-bold tracking-wider ${filter === c ? "bg-cyan-600 text-white" : "bg-gray-800 text-gray-400"}`}>
            {c.toUpperCase()}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        {filtered.map((o, i) => (
          <Card key={i} className="cursor-pointer hover:border-cyan-700 transition-all" glow={selected === i}>
            <div onClick={() => setSelected(selected === i ? null : i)}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-white font-bold text-sm">"{o.inv}"</span>
                <Badge color={o.kat === "Pris" ? "#FF3B3B" : o.kat === "Partner" ? "#FFBE0B" : o.kat === "Timing" ? "#06FFA5" : "#3A86FF"}>{o.kat}</Badge>
              </div>
              {selected === i && (
                <div className="mt-4 space-y-4">
                  <div><span className="text-gray-500 text-xs tracking-widest">VAD KUNDEN MENAR</span><p className="text-gray-300 text-sm mt-1">{o.meaning}</p></div>
                  <div className="bg-gray-800 rounded p-4 border-l-2 border-cyan-500">
                    <span className="text-cyan-400 text-xs tracking-widest">EXAKT VAD DU SÄGER</span>
                    <p className="text-white text-sm mt-1 italic">{o.handling}</p>
                  </div>
                  <div className="bg-gray-800 rounded p-4 border-l-2 border-yellow-500">
                    <span className="text-yellow-400 text-xs tracking-widest">UPPFÖLJNINGSFRÅGA</span>
                    <p className="text-white text-sm mt-1 italic">{o.follow}</p>
                  </div>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

// ── DISC PROFILER ──
const DiscProfiles = ({ profile }) => {
  const [activeDisc, setActiveDisc] = useState(profile?.discType || "R");
  const p = DISC_PROFILES[activeDisc];
  const fullP = DISC_PROFILES_FULL[activeDisc];

  return (
    <div>
      <SectionTitle icon={Users} title="PERSONTYPER (DISC)" subtitle="Identifiera persontypen inom 2 minuter. Anpassa allt: tempo, argument, close-teknik." />

      <div className="flex gap-3 mb-6">
        {Object.entries(DISC_PROFILES).map(([k, v]) => (
          <button key={k} onClick={() => setActiveDisc(k)}
            className={`flex-1 py-3 rounded text-sm font-bold tracking-wider transition-all border ${activeDisc === k ? "border-2 text-white" : "border-gray-700 text-gray-400 hover:border-gray-500"}`}
            style={activeDisc === k ? { borderColor: DISC_COLORS[k], background: `${DISC_COLORS[k]}15`, color: DISC_COLORS[k] } : {}}>
            {v.icon} {v.short}
            {k === profile?.discType && " (DU)"}
          </button>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {[
          { title: "Hur du känner igen dem", content: p.recognize },
          { title: "Största drivkraft", content: p.drive },
          { title: "Största rädsla", content: p.fear },
          { title: "Tempo i samtalet", content: p.tempo },
          { title: "Vad du ska SÄGA", content: p.say },
          { title: "Vad du ALDRIG ska säga", content: p.avoid },
          { title: "Hur du stänger", content: p.close },
          { title: "Uppföljningsstrategi", content: p.followUp },
        ].map((item, i) => (
          <Card key={i}>
            <div className="text-xs text-cyan-400 tracking-widest font-bold mb-2">{item.title.toUpperCase()}</div>
            <p className="text-gray-200 text-sm">{item.content}</p>
          </Card>
        ))}
      </div>

      {/* Personalized matrix from YOUR profile to this customer type */}
      {profile?.discType && fullP && (
        <Card className="mt-6" glow>
          <h3 className="text-sm font-bold text-cyan-400 tracking-widest mb-4">
            DU ({DISC_SHORT[profile.discType]}) → KUND ({DISC_SHORT[activeDisc]})
            {activeDisc === profile.discType && " — NATURLIG MATCH"}
          </h3>
          <p className="text-gray-300 text-sm mb-4">
            {DISC_PROFILES_FULL[profile.discType]?.matrix[activeDisc]?.text || "Anpassa ditt tempo och din approach."}
          </p>
          <div className="grid md:grid-cols-2 gap-3">
            {Object.entries(DISC_PROFILES).map(([k, target]) => (
              <div key={k} className="bg-gray-800 rounded p-4 border-l-2" style={{ borderColor: DISC_COLORS[k] }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-bold text-sm" style={{ color: DISC_COLORS[k] }}>{target.icon} KUND: {target.short}</span>
                  {k === profile.discType && <Badge color="#06FFA5">DIN TYP</Badge>}
                </div>
                <p className="text-gray-300 text-xs">Tempo: {target.tempo.split(".")[0]}</p>
                <p className="text-gray-300 text-xs mt-1">Close: {target.close.split(".")[0]}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

// ── SPIN FRÅGEBATTERI ──
const SpinQuestions = () => {
  const [activePhase, setActivePhase] = useState("situation");
  const phases = [
    { key: "situation", name: "Situation", icon: Eye, color: "#3A86FF", desc: "Förstå kundens nuläge" },
    { key: "problem", name: "Problem", icon: AlertTriangle, color: "#FF3B3B", desc: "Avslöja smärtpunkter" },
    { key: "implication", name: "Implikation", icon: TrendingUp, color: "#FFBE0B", desc: "Förstora konsekvenserna" },
    { key: "needPayoff", name: "Need-Payoff", icon: Lightbulb, color: "#06FFA5", desc: "Kunden säljer till sig själv" },
  ];

  return (
    <div>
      <SectionTitle icon={MessageCircle} title="SPIN FRÅGEBATTERI" subtitle="NEPQ-princip: Den som ställer frågorna styr samtalet." />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {phases.map(p => (
          <button key={p.key} onClick={() => setActivePhase(p.key)}
            className={`p-3 rounded text-left transition-all border ${activePhase === p.key ? "border-2" : "border-gray-700"}`}
            style={activePhase === p.key ? { borderColor: p.color, background: `${p.color}10` } : {}}>
            <p.icon size={18} style={{ color: p.color }} />
            <div className="font-bold text-sm mt-1 text-white">{p.name}</div>
            <div className="text-xs text-gray-500 mt-0.5">{SPIN_QUESTIONS[p.key].length} frågor</div>
          </button>
        ))}
      </div>
      <div className="space-y-3">
        {SPIN_QUESTIONS[activePhase].map((q, i) => (
          <Card key={i}>
            <div className="flex items-start gap-3">
              <span className="text-cyan-400 font-bold text-sm mt-1">{i + 1}</span>
              <div className="flex-1">
                <p className="text-white font-medium text-sm mb-2">"{q.q}"</p>
                <div className="grid md:grid-cols-2 gap-3 mt-3">
                  <div className="bg-gray-800 rounded p-3">
                    <div className="text-xs text-cyan-400 tracking-widest mb-1">VARFÖR DU FRÅGAR</div>
                    <p className="text-gray-300 text-xs">{q.why}</p>
                  </div>
                  <div className="bg-gray-800 rounded p-3">
                    <div className="text-xs text-yellow-400 tracking-widest mb-1">LYSSNA EFTER</div>
                    <p className="text-gray-300 text-xs">{q.listen}</p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

// ── AVSLUTSTEKNIKER (personalized per DISC) ──
const ClosingTechniques = ({ profile }) => {
  const [selected, setSelected] = useState(null);

  return (
    <div>
      <SectionTitle icon={Target} title="AVSLUTSTEKNIKER" subtitle="Du ska alltid gå på avslut. Frågan är inte OM — utan VILKEN teknik och NÄR." />

      <Card className="mb-6 border-l-2 border-cyan-500">
        <p className="text-cyan-400 text-sm font-bold">GYLLENE PRINCIPEN:</p>
        <p className="text-gray-300 text-sm mt-1">Om kunden har sagt ja till problemet, ja till lösningen, och ja till siffrorna — har de redan köpt.</p>
      </Card>

      {/* Personalized recommendation */}
      {profile?.discType && (
        <Card className="mb-6 border-l-2" style={{ borderLeftColor: DISC_COLORS[profile.discType], background: `${DISC_COLORS[profile.discType]}08` }}>
          <div className="text-xs tracking-widest mb-2" style={{ color: DISC_COLORS[profile.discType] }}>REKOMMENDERADE CLOSES FÖR DIG ({DISC_SHORT[profile.discType]})</div>
          <div className="space-y-1 text-sm">
            {CLOSES.filter(c => c.disc[profile.discType] === "PRIMÄR" || c.disc[profile.discType] === "EXTREMT EFFEKTIV").map((c, i) => (
              <p key={i} className="text-white">{c.name} — <span className="text-green-400">{c.disc[profile.discType]}</span></p>
            ))}
          </div>
        </Card>
      )}

      <div className="space-y-3">
        {CLOSES.map((c, i) => (
          <Card key={i} className="cursor-pointer hover:border-cyan-700 transition-all" glow={selected === i}>
            <div onClick={() => setSelected(selected === i ? null : i)}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-white font-bold text-sm">{i + 1}. {c.name}</span>
                <div className="flex gap-2">
                  {profile?.discType && <Badge color={DISC_COLORS[profile.discType]}>{c.disc[profile.discType]}</Badge>}
                  <Badge color={c.difficulty === "LÄTT" ? "#06FFA5" : c.difficulty === "MEDEL" ? "#FFBE0B" : "#FF3B3B"}>{c.difficulty}</Badge>
                </div>
              </div>
              <p className="text-gray-400 text-xs">{c.desc}</p>

              {selected === i && (
                <div className="mt-4 space-y-3">
                  <div className="bg-gray-800 rounded p-4 border-l-2 border-cyan-500">
                    <span className="text-cyan-400 text-xs tracking-widest">EXAKT VAD DU SÄGER</span>
                    <p className="text-white text-sm mt-1 italic">{c.example}</p>
                  </div>
                  <div>
                    <span className="text-yellow-400 text-xs tracking-widest">KÖPSIGNAL SOM TRIGGAR</span>
                    <p className="text-gray-300 text-sm mt-1">{c.signal}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 text-xs tracking-widest">PER PERSONTYP</span>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {Object.entries(c.disc).map(([k, v]) => (
                        <div key={k} className="flex items-center gap-2 text-xs">
                          <span className="font-bold" style={{ color: DISC_COLORS[k] }}>{DISC_SHORT[k]}:</span>
                          <span className="text-gray-300">{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

// ── KÄNSLOR & METOD ──
const EmotionsMethod = () => (
  <div>
    <SectionTitle icon={Heart} title="KÄNSLOR & METOD" subtitle="Kunden köper inte ett batteri. Kunden köper en känsla av kontroll och en rädsla för att förlora pengar." />

    <h3 className="text-sm font-bold text-cyan-400 tracking-widest mb-4">5 KÄNSLOR KUNDEN SKA KÄNNA EFTER SAMTAL 1</h3>
    <div className="space-y-3 mb-8">
      {[
        { num: 1, feel: "Mina solpaneler jobbar inte för mig", trigger: "Visa gapet: säljer billigt, köper dyrt", say: "Du producerar el, säljer billigt, köper tillbaka 3x dyrare." },
        { num: 2, feel: "En förändring måste ske NU", trigger: "Kvantifiera förlust per månad", say: "Varje månad utan batteri kastar du [X kr] i sjön." },
        { num: 3, feel: "Jag har lärt mig nåt nytt", trigger: "Prismatiska vs pouch-celler", say: "Pouch tappar 20% efter 3000 cykler. Prismatiska håller 6000+." },
        { num: 4, feel: "Det var ett bra samtal", trigger: "Var genuint nyfiken. 70% ska kunden prata.", say: "Princip, inte skript. Styr med frågor." },
        { num: 5, feel: "Jag vet exakt vad nästa steg är", trigger: "Sammanfatta explicit. SMS direkt.", say: "Jag skickar formulär. Vi bokar samtal [dag/tid]." },
      ].map(e => (
        <Card key={e.num}>
          <div className="flex items-start gap-3">
            <div className="bg-cyan-900/30 w-8 h-8 rounded flex items-center justify-center text-cyan-400 font-bold text-sm flex-shrink-0">{e.num}</div>
            <div>
              <p className="text-white font-bold text-sm">"{e.feel}"</p>
              <p className="text-gray-400 text-xs mt-1">Trigger: {e.trigger}</p>
              <p className="text-cyan-300 text-xs mt-1 italic">{e.say}</p>
            </div>
          </div>
        </Card>
      ))}
    </div>

    <h3 className="text-sm font-bold text-cyan-400 tracking-widest mb-4">ETHOS / PATHOS / LOGOS</h3>
    <div className="grid md:grid-cols-3 gap-4 mb-8">
      {[
        { name: "ETHOS", sub: "Trovärdighet", color: "#3A86FF", desc: "Kunden litar på dig.", how: "Teknisk kunskap, lokala referenser, ärlighet om nackdelar, specifika siffror, garanti proaktivt" },
        { name: "PATHOS", sub: "Känsla", color: "#FF3B3B", desc: "Kunden KÄNNER att de behöver agera.", how: "Loss aversion, sunk cost, stolthet, frustration mot elbolag, trygghet vid strömavbrott" },
        { name: "LOGOS", sub: "Logik", color: "#06FFA5", desc: "Siffrorna stämmer. Kalkylen håller.", how: "Konkret ROI med DERAS siffror, payback-tid, med vs utan, livstidsbesparing" },
      ].map(p => (
        <Card key={p.name} className="border-t-2" style={{ borderTopColor: p.color }}>
          <div className="text-sm font-black mb-1" style={{ color: p.color }}>{p.name}</div>
          <div className="text-xs text-gray-500 mb-2">{p.sub}</div>
          <p className="text-gray-300 text-xs mb-3">{p.desc}</p>
          <p className="text-gray-400 text-xs">{p.how}</p>
        </Card>
      ))}
    </div>

    <h3 className="text-sm font-bold text-cyan-400 tracking-widest mb-4">VILKEN PELARE PER PERSONTYP</h3>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {[
        { type: "Röd", primary: "LOGOS", secondary: "ETHOS", avoid: "Överdriven PATHOS", color: DISC_COLORS.R },
        { type: "Gul", primary: "PATHOS", secondary: "ETHOS", avoid: "Tung LOGOS", color: DISC_COLORS.Y },
        { type: "Grön", primary: "PATHOS", secondary: "LOGOS", avoid: "Aggressiv LOGOS", color: DISC_COLORS.Gr },
        { type: "Blå", primary: "LOGOS", secondary: "ETHOS", avoid: "Enbart PATHOS", color: DISC_COLORS.B },
      ].map(t => (
        <Card key={t.type}>
          <div className="font-bold text-sm mb-2" style={{ color: t.color }}>{t.type}</div>
          <div className="text-xs text-gray-400">Primärt: <span className="text-white">{t.primary}</span></div>
          <div className="text-xs text-gray-400">Sekundärt: <span className="text-white">{t.secondary}</span></div>
          <div className="text-xs text-red-400 mt-2">Undvik: {t.avoid}</div>
        </Card>
      ))}
    </div>
  </div>
);

// ── QUIZ & TRÄNING ──
const QuizTraining = () => {
  const [started, setStarted] = useState(false);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [showResult, setShowResult] = useState(false);

  const handleAnswer = (idx) => {
    const newAnswers = [...answers, idx];
    setAnswers(newAnswers);
    if (current < QUIZ_QUESTIONS.length - 1) {
      setCurrent(current + 1);
    } else {
      setShowResult(true);
    }
  };

  const score = answers.filter((a, i) => a === QUIZ_QUESTIONS[i].correct).length;

  if (!started) {
    return (
      <div>
        <SectionTitle icon={Brain} title="QUIZ & TRÄNING" subtitle="Testa dina kunskaper — invändningar, closes, DISC, SPIN" />
        <Card glow>
          <div className="text-center py-8">
            <Brain size={48} className="text-cyan-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">{QUIZ_QUESTIONS.length} frågor</h3>
            <p className="text-gray-400 text-sm mb-6">Invändningshantering, avslutstekniker, persontyper, SPIN-metodik</p>
            <button onClick={() => setStarted(true)}
              className="bg-cyan-600 hover:bg-cyan-500 text-white px-8 py-3 rounded font-bold tracking-wider text-sm transition-all">
              STARTA QUIZ
            </button>
          </div>
        </Card>
      </div>
    );
  }

  if (showResult) {
    const pct = Math.round((score / QUIZ_QUESTIONS.length) * 100);
    return (
      <div>
        <SectionTitle icon={Award} title="RESULTAT" subtitle={`${score} av ${QUIZ_QUESTIONS.length} rätt (${pct}%)`} />
        <Card glow className="mb-6">
          <div className="text-center py-4">
            <div className="text-5xl font-black mb-2" style={{ color: pct >= 80 ? "#06FFA5" : pct >= 60 ? "#FFBE0B" : "#FF3B3B" }}>{pct}%</div>
            <p className="text-gray-400 text-sm">{pct >= 80 ? "Starkt! Du har koll." : pct >= 60 ? "Bra grund men öva mer." : "Du behöver gå igenom materialet igen."}</p>
          </div>
        </Card>
        <div className="space-y-3">
          {QUIZ_QUESTIONS.map((q, i) => (
            <Card key={i} className={answers[i] === q.correct ? "border-l-2 border-green-500" : "border-l-2 border-red-500"}>
              <p className="text-white text-sm font-medium mb-2">{i + 1}. {q.q}</p>
              <p className="text-sm mb-1">
                <span className="text-gray-500">Ditt svar: </span>
                <span className={answers[i] === q.correct ? "text-green-400" : "text-red-400"}>{q.options[answers[i]]}</span>
              </p>
              {answers[i] !== q.correct && (
                <p className="text-sm"><span className="text-gray-500">Rätt: </span><span className="text-green-400">{q.options[q.correct]}</span></p>
              )}
              <p className="text-gray-400 text-xs mt-2 italic">{q.explanation}</p>
            </Card>
          ))}
        </div>
        <button onClick={() => { setStarted(false); setCurrent(0); setAnswers([]); setShowResult(false); }}
          className="mt-6 bg-gray-800 text-white px-6 py-2 rounded text-sm font-bold hover:bg-gray-700">
          KÖR IGEN
        </button>
      </div>
    );
  }

  const q = QUIZ_QUESTIONS[current];
  return (
    <div>
      <SectionTitle icon={Brain} title={`FRÅGA ${current + 1} / ${QUIZ_QUESTIONS.length}`} />
      <Card glow>
        <p className="text-white font-bold mb-6">{q.q}</p>
        <div className="space-y-2">
          {q.options.map((opt, i) => (
            <button key={i} onClick={() => handleAnswer(i)}
              className="w-full text-left p-4 rounded bg-gray-800 border border-gray-700 text-gray-200 text-sm hover:border-cyan-500 hover:bg-gray-750 transition-all">
              <span className="text-cyan-400 font-bold mr-2">{String.fromCharCode(65 + i)}.</span> {opt}
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
};

// ── VECKO-CHECKIN ──
const WeeklyCheckin = ({ onSave, checkins }) => {
  const [answers, setAnswers] = useState(Array(WEEKLY_QUESTIONS.length).fill(""));
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    const entry = { date: new Date().toISOString().split("T")[0], answers, timestamp: Date.now() };
    onSave(entry);
    setSaved(true);
  };

  if (saved) {
    return (
      <div>
        <SectionTitle icon={Calendar} title="VECKO-CHECKIN" subtitle="Reflektion sparad!" />
        <Card glow>
          <div className="text-center py-8">
            <CheckCircle size={48} className="text-green-400 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-white">Sparad!</h3>
            <p className="text-gray-400 text-sm mt-2">Bra jobbat. Se din progress i dashboarden.</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <SectionTitle icon={Calendar} title="VECKO-CHECKIN" subtitle="Reflektera över veckan. 3 minuter. Varje fredag." />
      <div className="space-y-4 mb-6">
        {WEEKLY_QUESTIONS.map((q, i) => (
          <Card key={i}>
            <label className="text-sm text-gray-300 font-medium block mb-2">{i + 1}. {q}</label>
            <input type="text" value={answers[i]} onChange={e => { const a = [...answers]; a[i] = e.target.value; setAnswers(a); }}
              className="w-full bg-gray-800 border border-gray-700 text-white p-3 rounded text-sm focus:border-cyan-500 focus:outline-none"
              placeholder="Ditt svar..." />
          </Card>
        ))}
      </div>
      <button onClick={handleSave}
        className="bg-cyan-600 hover:bg-cyan-500 text-white px-8 py-3 rounded font-bold tracking-wider text-sm transition-all">
        SPARA VECKOREFLEKTION
      </button>
      {checkins.length > 0 && (
        <div className="mt-8">
          <h3 className="text-sm font-bold text-cyan-400 tracking-widest mb-4">HISTORIK</h3>
          <div className="space-y-2">
            {checkins.slice().reverse().map((c, i) => (
              <Card key={i}>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">{c.date}</span>
                  <span className="text-gray-500 text-xs">{c.answers[0]} samtal</span>
                </div>
                <p className="text-gray-300 text-xs mt-1">Lärdom: {c.answers[5]}</p>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ── UTVECKLINGSPLAN ──
const DevelopmentPlan = ({ profile, checkins }) => {
  const weekNum = checkins.length;
  const fullProfile = DISC_PROFILES_FULL[profile?.discType];
  const phases = [
    { name: "Vecka 1-2: GRUND", desc: "Lär dig DISC, SPIN-frågor, invändningshantering utantill", tasks: ["Gör personlighetstestet", "Läs alla DISC-profiler", "Memorera topp 5 invändningar", "Öva SPIN-frågor högt", "Kör quiz tills 80%+"] },
    { name: "Vecka 3-4: SAMTALSSTRUKTUR", desc: "Fokus på Samtal 1 blueprint och emotionell shift", tasks: ["Kör 10+ samtal 1", "Identifiera DISC inom 2 min varje samtal", "Använd alla 5 pengaläckorna", "Gå på avslut i VARJE samtal", "Reflektera efter varje samtal"] },
    { name: "Vecka 5-6: CLOSING", desc: "Mästra avslutstekniker och samtal 2-3", tasks: ["Öva alla 10 close-tekniker", "Kör samtal 2 med färdig kalkyl", "Stäng minst 2 deals", "Hantera 3+ invändningar per samtal", "Börja använda Sharp Angle + Takeaway"] },
    { name: "Vecka 7-8: FÖRFINING", desc: "Anpassa per persontyp, öka close rate", tasks: ["Anpassa close-sekvens per DISC", "Kör samtal 3 med partner", "Close rate mål: 25%+", "Mentor junior säljare", "Dokumentera egna framgångsmönster"] },
  ];

  const currentPhase = Math.min(Math.floor(weekNum / 2), phases.length - 1);

  return (
    <div>
      <SectionTitle icon={TrendingUp} title="UTVECKLINGSPLAN" subtitle="8-veckors plan för att bli en vetenskapligt duktig säljare" />

      {/* Personalized focus area */}
      {fullProfile && (
        <Card className="mb-6 border-l-2" style={{ borderLeftColor: fullProfile.color, background: `${fullProfile.color}08` }}>
          <div className="text-xs tracking-widest mb-2" style={{ color: fullProfile.color }}>DITT PERSONLIGA UTVECKLINGSFOKUS ({fullProfile.name})</div>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-green-400 text-xs tracking-widest mb-1">STÄRK</div>
              {fullProfile.mustDoMore.map((m, i) => <p key={i} className="text-gray-300">{m}</p>)}
            </div>
            <div>
              <div className="text-red-400 text-xs tracking-widest mb-1">SLUTA MED</div>
              {fullProfile.mustDoLess.map((m, i) => <p key={i} className="text-gray-300">{m}</p>)}
            </div>
          </div>
        </Card>
      )}

      <Card className="mb-6" glow>
        <div className="flex items-center justify-between mb-4">
          <span className="text-cyan-400 text-xs tracking-widest font-bold">DIN PROGRESS</span>
          <span className="text-white text-sm font-bold">Vecka {weekNum} / 8</span>
        </div>
        <div className="w-full bg-gray-800 rounded-full h-3 mb-2">
          <div className="bg-gradient-to-r from-cyan-500 to-purple-500 h-3 rounded-full transition-all" style={{ width: `${Math.min(100, (weekNum / 8) * 100)}%` }}></div>
        </div>
        <p className="text-gray-400 text-xs">Nuvarande fas: {phases[currentPhase].name}</p>
      </Card>

      <div className="space-y-4">
        {phases.map((phase, i) => (
          <Card key={i} className={`border-l-2 ${i === currentPhase ? "border-cyan-500" : i < currentPhase ? "border-green-500" : "border-gray-700"}`}>
            <div className="flex items-center gap-3 mb-3">
              {i < currentPhase ? <CheckCircle size={18} className="text-green-400" /> : i === currentPhase ? <Zap size={18} className="text-cyan-400" /> : <Clock size={18} className="text-gray-600" />}
              <h4 className="text-white font-bold text-sm">{phase.name}</h4>
            </div>
            <p className="text-gray-400 text-xs mb-3">{phase.desc}</p>
            <div className="space-y-1">
              {phase.tasks.map((task, j) => (
                <div key={j} className="flex items-center gap-2 text-xs">
                  <span className={`${i < currentPhase ? "text-green-400" : "text-gray-600"}`}>{i < currentPhase ? "\u2713" : "\u25CB"}</span>
                  <span className={i <= currentPhase ? "text-gray-300" : "text-gray-600"}>{task}</span>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <h3 className="text-sm font-bold text-yellow-400 tracking-widest mb-3">KPI:er ATT TRACKA</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Samtal / vecka", target: "20+", icon: Phone },
            { label: "Close rate", target: "25%+", icon: Target },
            { label: "DISC-träffsäkerhet", target: "80%+", icon: Users },
            { label: "Quiz-score", target: "90%+", icon: Brain },
          ].map((kpi, i) => (
            <div key={i} className="bg-gray-800 rounded p-3 text-center">
              <kpi.icon size={16} className="text-cyan-400 mx-auto mb-1" />
              <div className="text-white font-bold text-sm">{kpi.target}</div>
              <div className="text-gray-500 text-xs">{kpi.label}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

// ── MIN PROFIL ──
const MyProfile = ({ profile }) => {
  const fullProfile = DISC_PROFILES_FULL[profile?.discType];
  if (!fullProfile || !profile?.aspectScores) return null;

  return (
    <div>
      <SectionTitle icon={User} title="MIN PROFIL" subtitle="Ditt Neural Profile-resultat" />

      <div className="flex flex-col items-center mb-8">
        <div className="text-lg font-bold text-white mb-3">{profile.name}</div>
        <RadarProfileSVG aspectScores={profile.aspectScores} size={350} />
        <div className="mt-4 text-center">
          <div className="text-2xl font-black" style={{ color: fullProfile.color }}>{fullProfile.name}</div>
          <div className="text-gray-400 italic">{fullProfile.archetype}</div>
        </div>
      </div>

      {/* Score breakdown */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {["R", "Y", "Gr", "B"].map(k => {
          const total = (profile.scores?.R || 0) + (profile.scores?.Y || 0) + (profile.scores?.Gr || 0) + (profile.scores?.B || 0);
          return (
            <Card key={k}>
              <div className="text-center">
                <div className="text-xs tracking-widest mb-1" style={{ color: DISC_COLORS[k] }}>{DISC_SHORT[k]}</div>
                <div className="text-xl font-black text-white">{profile.scores?.[k] || 0}</div>
                <div className="text-xs text-gray-500">{total ? Math.round(((profile.scores?.[k] || 0) / total) * 100) : 0}%</div>
              </div>
            </Card>
          );
        })}
      </div>

      <p className="text-gray-300 text-sm mb-6">{fullProfile.oneLiner}</p>

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <Card className="border-l-2" style={{ borderLeftColor: "#06FFA5" }}>
          <h4 className="text-sm font-bold tracking-widest mb-3" style={{ color: "#06FFA5" }}>SUPERKRAFTER</h4>
          {fullProfile.superpowers.map((s, i) => <p key={i} className="text-gray-300 text-sm mb-1">{s}</p>)}
        </Card>
        <Card className="border-l-2" style={{ borderLeftColor: "#FF3B3B" }}>
          <h4 className="text-sm font-bold tracking-widest mb-3" style={{ color: "#FF3B3B" }}>BLINDSPOTS</h4>
          {fullProfile.blindspots.map((s, i) => <p key={i} className="text-gray-300 text-sm mb-1">{s}</p>)}
        </Card>
      </div>

      <Card className="mb-6 border-l-2 border-yellow-500">
        <h4 className="text-sm font-bold text-yellow-400 tracking-widest mb-2">STÖRSTA FÄLLAN</h4>
        <p className="text-gray-300 text-sm">{fullProfile.biggestTrap}</p>
      </Card>

      <Card glow className="mb-6">
        <h4 className="text-sm font-bold tracking-widest mb-4" style={{ color: "#00D9FF" }}>ANPASSNINGSMATRIS</h4>
        <div className="grid md:grid-cols-2 gap-3">
          {["R", "Y", "Gr", "B"].map(k => (
            <div key={k} className="bg-gray-800 rounded p-4 border-l-2" style={{ borderColor: DISC_COLORS[k] }}>
              <h5 className="font-bold text-sm mb-2" style={{ color: DISC_COLORS[k] }}>{fullProfile.matrix[k].title}</h5>
              <p className="text-gray-300 text-xs">{fullProfile.matrix[k].text}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="border-l-2" style={{ borderLeftColor: "#06FFA5", background: "rgba(6, 255, 165, 0.05)" }}>
        <h4 className="text-sm font-bold tracking-widest mb-2" style={{ color: "#06FFA5" }}>KALIBRERING</h4>
        <p className="text-white font-bold italic">"{fullProfile.calibration}"</p>
      </Card>
    </div>
  );
};

// ═══════════════════════════════════════════
// PIN LOGIN SCREEN
// ═══════════════════════════════════════════
const PinLogin = ({ onLogin, onNewUser }) => {
  const [profiles, setProfiles] = useState([]);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [pin, setPin] = useState(["", "", "", ""]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const pinRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];

  useEffect(() => {
    async function loadProfiles() {
      // 1. Load from localStorage
      let localProfiles = [];
      try {
        localProfiles = JSON.parse(localStorage.getItem("neuralProfiles") || "[]").filter(p => p.pin);
      } catch (e) {}

      // 2. Also load from Supabase
      let supabaseProfiles = [];
      try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/salespeople?select=id,name,pin,disc_type,disc_secondary,disc_scores,disc_answers,disc_slow_questions,disc_answer_changes,radar_data,avatar_color`, {
          headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
        });
        if (res.ok) {
          const data = await res.json();
          supabaseProfiles = (data || []).filter(p => p.pin).map(p => ({
            name: p.name,
            pin: p.pin,
            dominant: p.disc_type,
            secondary: p.disc_secondary,
            discType: p.disc_type,
            scores: p.disc_scores,
            aspectScores: p.disc_scores,
            answers: p.disc_answers,
            slowQuestions: p.disc_slow_questions,
            answerChanges: p.disc_answer_changes,
            radarData: p.radar_data,
            supabaseId: p.id,
            _fromSupabase: true
          }));
        }
      } catch (e) { console.warn("Could not load from Supabase:", e); }

      // 3. Merge: Supabase profiles take priority, add local-only profiles
      const merged = [...supabaseProfiles];
      for (const lp of localProfiles) {
        if (!merged.some(sp => sp.name === lp.name)) {
          merged.push(lp);
        }
      }
      setProfiles(merged);
      setLoading(false);
    }
    loadProfiles();
  }, []);

  const handlePinInput = (idx, val) => {
    if (val.length > 1) val = val.slice(-1);
    if (val && !/^\d$/.test(val)) return;
    setError("");
    const newPin = [...pin];
    newPin[idx] = val;
    setPin(newPin);
    if (val && idx < 3) pinRefs[idx + 1].current?.focus();
    // Auto-submit when all 4 digits entered
    if (val && idx === 3) {
      const code = newPin.join("");
      const match = profiles.find(p => p.name === selectedProfile?.name && p.pin === code);
      if (match) {
        // If match is from Supabase, build the right profile object
        if (match._fromSupabase) {
          const sbProfile = {
            name: match.name,
            discType: match.discType || match.dominant,
            secondaryType: match.secondary,
            scores: match.scores,
            aspectScores: match.aspectScores,
            answers: match.answers,
            slowQuestions: match.slowQuestions,
            answerChanges: match.answerChanges,
            radarData: match.radarData,
            pin: match.pin,
            supabaseId: match.supabaseId
          };
          // Persist to localStorage for next time
          localStorage.setItem("salj_profile", JSON.stringify(sbProfile));
          try {
            const all = JSON.parse(localStorage.getItem("neuralProfiles") || "[]");
            if (!all.some(p => p.name === match.name)) {
              all.push({ name: match.name, dominant: match.dominant, secondary: match.secondary, scores: match.scores, aspectScores: match.aspectScores, pin: match.pin, supabaseId: match.supabaseId });
              localStorage.setItem("neuralProfiles", JSON.stringify(all));
            }
          } catch(e){}
          onLogin(sbProfile);
        } else {
          // Local profile match
          try {
            const savedProfile = JSON.parse(localStorage.getItem("salj_profile"));
            if (savedProfile?.name === match.name) { onLogin(savedProfile); return; }
          } catch(e){}
          onLogin({ name: match.name, discType: match.dominant, secondary: match.secondary, scores: match.scores, aspectScores: match.aspectScores, totalTime: match.totalTime, avgTime: match.avgTime, slowQuestions: match.slowQuestions, totalChanges: match.totalChanges, consistencyScore: match.consistencyScore, answers: match.answers, times: match.times, pin: match.pin, timestamp: match.timestamp });
        }
      } else {
        setError("Fel pinkod");
        setPin(["", "", "", ""]);
        setTimeout(() => pinRefs[0].current?.focus(), 100);
      }
    }
  };

  const handlePinKeyDown = (idx, e) => {
    if (e.key === "Backspace" && !pin[idx] && idx > 0) {
      pinRefs[idx - 1].current?.focus();
    }
  };

  // Loading state while fetching from Supabase
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4" style={{ background: "linear-gradient(180deg, #000814 0%, #001D3D 50%, #000814 100%)" }}>
        <div className="max-w-lg w-full text-center">
          <div className="text-xs tracking-widest mb-4" style={{ color: "#00D9FF" }}>▸ PROFFSKONTAKT ACADEMY</div>
          <h1 className="text-3xl font-black text-white mb-3">Säljträning</h1>
          <p className="text-gray-400 text-sm">Laddar profiler...</p>
        </div>
      </div>
    );
  }

  // If no profiles exist, go straight to new user
  if (profiles.length === 0) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4" style={{ background: "linear-gradient(180deg, #000814 0%, #001D3D 50%, #000814 100%)" }}>
        <div className="max-w-lg w-full text-center">
          <div className="text-xs tracking-widest mb-4" style={{ color: "#00D9FF" }}>▸ PROFFSKONTAKT ACADEMY</div>
          <h1 className="text-3xl font-black text-white mb-3">Säljträning</h1>
          <p className="text-gray-400 text-sm mb-8">Ingen profil hittad. Skapa din första.</p>
          <button onClick={onNewUser}
            className="px-8 py-4 rounded font-bold tracking-widest text-sm transition-all"
            style={{ background: "linear-gradient(135deg, #00D9FF 0%, #8338EC 100%)", color: "#000814" }}>
            GÖR PERSONLIGHETSTESTET
          </button>
        </div>
      </div>
    );
  }

  // Profile selection
  if (!selectedProfile) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4" style={{ background: "linear-gradient(180deg, #000814 0%, #001D3D 50%, #000814 100%)" }}>
        <div className="max-w-lg w-full">
          <div className="text-center mb-8">
            <div className="text-xs tracking-widest mb-3" style={{ color: "#00D9FF" }}>▸ PROFFSKONTAKT ACADEMY</div>
            <h1 className="text-3xl font-black text-white mb-2">Välj din profil</h1>
            <p className="text-gray-400 text-sm">Tryck på ditt namn för att logga in</p>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-8">
            {profiles.map((p, i) => (
              <button key={i} onClick={() => { setSelectedProfile(p); setPin(["","","",""]); setTimeout(() => pinRefs[0].current?.focus(), 200); }}
                className="flex flex-col items-center p-5 rounded-xl border-2 bg-gray-900 transition-all hover:border-cyan-600 hover:shadow-lg hover:shadow-cyan-900/20"
                style={{ borderColor: DISC_COLORS[p.dominant] + "44" }}>
                {p.aspectScores ? (
                  <RadarAvatar aspectScores={p.aspectScores} size={80} dominantColor={DISC_COLORS[p.dominant]} />
                ) : (
                  <div className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-black" style={{ background: `${DISC_COLORS[p.dominant]}20`, color: DISC_COLORS[p.dominant] }}>
                    {p.name?.[0]}
                  </div>
                )}
                <div className="text-white font-bold mt-3">{p.name}</div>
                <div className="text-xs font-bold mt-1" style={{ color: DISC_COLORS[p.dominant] }}>
                  {DISC_PROFILES_FULL[p.dominant]?.name || p.dominant}
                </div>
              </button>
            ))}
          </div>

          <div className="text-center">
            <button onClick={onNewUser} className="text-sm text-gray-500 hover:text-cyan-400 transition-all">
              + Ny profil
            </button>
          </div>
        </div>
      </div>
    );
  }

  // PIN entry
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4" style={{ background: "linear-gradient(180deg, #000814 0%, #001D3D 50%, #000814 100%)" }}>
      <div className="max-w-md w-full text-center">
        <button onClick={() => { setSelectedProfile(null); setPin(["","","",""]); setError(""); }}
          className="text-gray-500 hover:text-white text-sm mb-8 flex items-center gap-1 mx-auto">
          <ChevronLeft size={14} /> Tillbaka
        </button>

        {selectedProfile.aspectScores ? (
          <RadarAvatar aspectScores={selectedProfile.aspectScores} size={100} dominantColor={DISC_COLORS[selectedProfile.dominant]} />
        ) : (
          <div className="w-24 h-24 mx-auto rounded-full flex items-center justify-center text-3xl font-black" style={{ background: `${DISC_COLORS[selectedProfile.dominant]}20`, color: DISC_COLORS[selectedProfile.dominant] }}>
            {selectedProfile.name?.[0]}
          </div>
        )}

        <h2 className="text-xl font-black text-white mt-4 mb-1">{selectedProfile.name}</h2>
        <p className="text-gray-400 text-sm mb-8">Ange din pinkod</p>

        <div className="flex justify-center gap-4 mb-4">
          {pin.map((digit, i) => (
            <input key={i} ref={pinRefs[i]} type="text" inputMode="numeric" maxLength={1}
              value={digit} onChange={e => handlePinInput(i, e.target.value)}
              onKeyDown={e => handlePinKeyDown(i, e)}
              className="w-20 h-24 text-center text-4xl font-black rounded-xl border-2 bg-gray-900 text-white outline-none transition-all focus:shadow-lg"
              style={{ borderColor: error ? "#FF3B3B" : digit ? "#00D9FF" : "#1E3A5F", boxShadow: digit ? "0 0 20px rgba(0,217,255,0.2)" : "none" }}
              autoFocus={i === 0} />
          ))}
        </div>

        {error && <p className="text-red-400 text-sm font-bold mb-4">{error}</p>}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════
// AI COACH — Personlig utveckling
// ═══════════════════════════════════════════
const AiCoach = ({ profile }) => {
  const [messages, setMessages] = useState([
    { role: "ai", text: `Hej ${profile?.name || "du"}! Jag är din personliga AI-säljcoach. Jag vet att du är ${DISC_PROFILES_FULL[profile?.discType]?.name || "unik"} — ${DISC_PROFILES_FULL[profile?.discType]?.archetype || ""}. Jag har tillgång till allt utbildningsmaterial, dina tidigare samtal, och din utvecklingsdata. Ställ mig frågor om avslutstekniker, invändningar, SPIN-frågor, persontyper, motivation, samtalsstruktur, eller stress. Varje svar är anpassat efter just DIN profil.` }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", text: userMsg }]);
    setLoading(true);

    // Try Edge Function (real AI) first, fallback to local
    const salespersonId = profile?.supabaseId;
    if (salespersonId) {
      const result = await callEdgeFunction("ai-coach", { question: userMsg, salesperson_id: salespersonId });
      if (result?.message) {
        setMessages(prev => [...prev, { role: "ai", text: result.message }]);
        setLoading(false);
        return;
      }
    }

    // Fallback to local rule-based response
    const response = getCoachResponse(userMsg, profile);
    setMessages(prev => [...prev, { role: "ai", text: response }]);
    setLoading(false);
  };

  return (
    <div>
      <SectionTitle icon={Brain} title="AI SÄLJCOACH" subtitle="Personlig coaching baserat på din profil, historik och utbildningsmaterial" />

      <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden" style={{ height: "calc(100vh - 200px)", display: "flex", flexDirection: "column" }}>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-lg rounded-2xl px-4 py-3 text-sm ${msg.role === "user"
                ? "bg-cyan-600 text-white rounded-br-sm"
                : "bg-gray-800 border border-gray-700 text-gray-200 rounded-bl-sm"}`}>
                {msg.role === "ai" && <Bot size={14} className="inline mr-2 text-cyan-400" />}
                {msg.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-800 border border-gray-700 rounded-2xl rounded-bl-sm px-4 py-3 text-sm text-gray-400">
                <Bot size={14} className="inline mr-2 text-cyan-400 animate-pulse" />
                Tänker...
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="px-4 py-2 flex gap-2 overflow-x-auto border-t border-gray-800">
          {["Hur stänger jag bättre?", "Tips vid invändningar", "Hur hanterar jag stress?", "SPIN-frågor för mig", "Min DISC i kundmöten", "Förbättra mitt samtal 1"].map((s, i) => (
            <button key={i} onClick={() => { setInput(s); }} className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white border border-gray-700 transition-all">
              {s}
            </button>
          ))}
        </div>

        <div className="p-4 border-t border-gray-800 flex gap-3">
          <input type="text" value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && send()}
            placeholder="Ställ en fråga om din säljutveckling..."
            className="flex-1 bg-gray-800 border border-gray-700 text-white p-3 rounded-xl text-sm focus:border-cyan-500 focus:outline-none" />
          <button onClick={send} disabled={!input.trim() || loading}
            className="px-4 rounded-xl transition-all disabled:opacity-30"
            style={{ background: "#00D9FF", color: "#000814" }}>
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════
// AI BATTERIEXPERT — Produktkunskap
// ═══════════════════════════════════════════
const AiBatteryExpert = ({ profile }) => {
  const [messages, setMessages] = useState([
    { role: "ai", text: "Hej! Jag är AI-produktexperten för hela Proffskontakts sortiment — Eway-batterier, Enershare, växelriktare (Solis, Solinteg, SAJ), laddboxar (ChargeAmps Luna, Zaptec Go 2), Sungrow smartmätare, och Enequi energistyrning. Jag har tillgång till alla datablad och ger dig säljargument anpassade efter din profil. Fråga mig vad som helst!" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", text: userMsg }]);
    setLoading(true);

    // Try Edge Function (real AI) first, fallback to local
    const salespersonId = profile?.supabaseId;
    if (salespersonId) {
      const result = await callEdgeFunction("ai-product-expert", { question: userMsg, salesperson_id: salespersonId });
      if (result?.message) {
        setMessages(prev => [...prev, { role: "ai", text: result.message }]);
        setLoading(false);
        return;
      }
    }

    // Fallback to local rule-based response
    const response = getBatteryResponse(userMsg);
    setMessages(prev => [...prev, { role: "ai", text: response }]);
    setLoading(false);
  };

  return (
    <div>
      <SectionTitle icon={Battery} title="AI PRODUKTEXPERT" subtitle="Eway, Solis, Solinteg, SAJ, ChargeAmps, Zaptec, Sungrow, Enequi — hela sortimentet" />

      <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden" style={{ height: "calc(100vh - 200px)", display: "flex", flexDirection: "column" }}>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-lg rounded-2xl px-4 py-3 text-sm ${msg.role === "user"
                ? "bg-green-600 text-white rounded-br-sm"
                : "bg-gray-800 border border-gray-700 text-gray-200 rounded-bl-sm"}`}>
                {msg.role === "ai" && <Battery size={14} className="inline mr-2 text-green-400" />}
                {msg.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-800 border border-gray-700 rounded-2xl rounded-bl-sm px-4 py-3 text-sm text-gray-400">
                <Battery size={14} className="inline mr-2 text-green-400 animate-pulse" />
                Söker i produktdatabasen...
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="px-4 py-2 flex gap-2 overflow-x-auto border-t border-gray-800">
          {["Eway batteri?", "Solis vs Solinteg?", "ChargeAmps Luna?", "Enershare kompatibilitet?", "Enequi styrning?", "Komplett system?", "Zaptec Go 2?", "Sungrow mätare?"].map((s, i) => (
            <button key={i} onClick={() => { setInput(s); }} className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white border border-gray-700 transition-all">
              {s}
            </button>
          ))}
        </div>

        <div className="p-4 border-t border-gray-800 flex gap-3">
          <input type="text" value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && send()}
            placeholder="Fråga om Eway, Solis, Solinteg, ChargeAmps, Enequi..."
            className="flex-1 bg-gray-800 border border-gray-700 text-white p-3 rounded-xl text-sm focus:border-cyan-500 focus:outline-none" />
          <button onClick={send} disabled={!input.trim() || loading}
            className="px-4 rounded-xl transition-all disabled:opacity-30"
            style={{ background: "#06FFA5", color: "#000814" }}>
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════
const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: Home },
  { key: "profile", label: "Min Profil", icon: User },
  { key: "team", label: "Teamet", icon: Users },
  { key: "coach", label: "AI Coach", icon: Brain },
  { key: "battery", label: "Batteriexpert", icon: Battery },
  { key: "callguide", label: "Samtalsguide", icon: Phone },
  { key: "spin", label: "SPIN Frågor", icon: MessageCircle },
  { key: "disc", label: "Persontyper", icon: Eye },
  { key: "objections", label: "Invändningar", icon: Shield },
  { key: "closing", label: "Avslutstekniker", icon: Target },
  { key: "emotions", label: "Känslor & Metod", icon: Heart },
  { key: "quiz", label: "Quiz", icon: Brain },
  { key: "checkin", label: "Vecko-checkin", icon: Calendar },
  { key: "development", label: "Utvecklingsplan", icon: TrendingUp },
];

export default function App() {
  const [profile, setProfile] = useState(() => {
    try { const p = JSON.parse(localStorage.getItem("salj_profile")); return p; } catch { return null; }
  });
  const [checkins, setCheckins] = useState(() => {
    try { return JSON.parse(localStorage.getItem("salj_checkins")) || []; } catch { return []; }
  });
  const [page, setPage] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showNewUser, setShowNewUser] = useState(false);

  useEffect(() => {
    if (profile) localStorage.setItem("salj_profile", JSON.stringify(profile));
  }, [profile]);

  // Auto-sync existing profiles to Supabase if they don't have an ID yet
  useEffect(() => {
    if (profile && !profile.supabaseId) {
      saveSalespersonToSupabase(profile).then(id => {
        if (id) {
          const updated = { ...profile, supabaseId: id };
          setProfile(updated);
          // Also update neuralProfiles in localStorage
          try {
            const all = JSON.parse(localStorage.getItem("neuralProfiles") || "[]");
            const idx = all.findIndex(p => p.name === profile.name && p.pin === profile.pin);
            if (idx >= 0) { all[idx].supabaseId = id; localStorage.setItem("neuralProfiles", JSON.stringify(all)); }
          } catch(e) {}
        }
      });
    }
  }, [profile?.supabaseId]);

  useEffect(() => {
    localStorage.setItem("salj_checkins", JSON.stringify(checkins));
  }, [checkins]);

  const handleCheckin = (entry) => setCheckins([...checkins, entry]);

  const handleTestComplete = async (result) => {
    // Save to Supabase and get UUID
    const supabaseId = await saveSalespersonToSupabase(result);
    const profileWithId = { ...result, supabaseId };
    setProfile(profileWithId);
    setShowNewUser(false);
  };

  // Show new user test flow
  if (showNewUser) {
    return <DiscTest onComplete={handleTestComplete} />;
  }
  if (!profile) {
    // Always show PinLogin first — it now checks both localStorage AND Supabase
    return <PinLogin onLogin={(p) => { setProfile(p); }} onNewUser={() => setShowNewUser(true)} />;
  }

  return (
    <div className="min-h-screen bg-gray-950 flex">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? "w-56" : "w-14"} bg-gray-900 border-r border-gray-800 flex flex-col transition-all duration-300 flex-shrink-0`}>
        <div className="p-3 border-b border-gray-800">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-gray-400 hover:text-white text-xs">
            {sidebarOpen ? "\u25C2" : "\u25B8"}
          </button>
          {sidebarOpen && (
            <div className="mt-2">
              <div className="text-xs text-cyan-400 tracking-widest">PROFFSKONTAKT</div>
              <div className="text-white font-bold text-sm">Säljträning</div>
            </div>
          )}
        </div>

        <nav className="flex-1 py-2 overflow-y-auto">
          {NAV_ITEMS.map(item => (
            <button key={item.key} onClick={() => setPage(item.key)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm transition-all ${page === item.key ? "bg-cyan-900/20 text-cyan-400 border-r-2 border-cyan-400" : "text-gray-400 hover:text-white hover:bg-gray-800"}`}>
              <item.icon size={16} className="flex-shrink-0" />
              {sidebarOpen && <span className="truncate">{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-gray-800">
          {sidebarOpen && (
            <div className="flex items-center gap-2">
              {profile.aspectScores ? (
                <RadarAvatar aspectScores={profile.aspectScores} size={32} dominantColor={DISC_COLORS[profile.discType]} />
              ) : (
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: `${DISC_COLORS[profile.discType]}30`, color: DISC_COLORS[profile.discType] }}>
                  {profile.name?.[0] || "?"}
                </div>
              )}
              <div className="text-xs">
                <div className="text-white font-bold truncate">{profile.name}</div>
                <div style={{ color: DISC_COLORS[profile.discType] }}>{DISC_SHORT[profile.discType]}</div>
              </div>
            </div>
          )}
          <button onClick={() => { setProfile(null); localStorage.removeItem("salj_profile"); }}
            className="mt-2 text-xs text-gray-500 hover:text-red-400 flex items-center gap-1">
            {sidebarOpen && <><LogOut size={12} /> Logga ut</>}
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-6">
          {page === "dashboard" && <Dashboard profile={profile} checkins={checkins} />}
          {page === "profile" && <MyProfile profile={profile} />}
          {page === "team" && <TeamView profile={profile} />}
          {page === "coach" && <AiCoach profile={profile} />}
          {page === "battery" && <AiBatteryExpert profile={profile} />}
          {page === "callguide" && <CallGuide profile={profile} />}
          {page === "spin" && <SpinQuestions />}
          {page === "disc" && <DiscProfiles profile={profile} />}
          {page === "objections" && <ObjectionHandler />}
          {page === "closing" && <ClosingTechniques profile={profile} />}
          {page === "emotions" && <EmotionsMethod />}
          {page === "quiz" && <QuizTraining />}
          {page === "checkin" && <WeeklyCheckin onSave={handleCheckin} checkins={checkins} />}
          {page === "development" && <DevelopmentPlan profile={profile} checkins={checkins} />}
        </div>
      </div>
    </div>
  );
}
