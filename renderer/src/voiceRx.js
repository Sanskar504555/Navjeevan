/* Voice dictation for the prescription form: turns a spoken prescription
   (transcribed by the browser's Web Speech API, en-IN) into the form's
   fields. Pure functions only, so this can be tested outside the browser;
   the recognizer itself lives in VoiceDictation (App.jsx).

   Expected way of speaking (any field order within a medicine):
     "Letrozole 2.5 mg once daily for 5 days quantity 5 tablets from day 2
      next Folic acid 5 mg once daily for 3 months after food
      doctor Patil  advice avoid heavy exercise"

   Medicine names are the part that has to be right, so they are never
   taken on trust: each one is matched against the drug list by spelling
   and by sound (see matchDrug), and anything short of a clear match comes
   back flagged with suggestions for the doctor to confirm. */

/* ---------- text helpers ---------- */

const UNITS = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };

// "two point five" -> "2.5", "twenty one" -> "21", "five thousand" -> "5000",
// but "one zero one" stays "1 0 1" (a 1-0-1 frequency, not a hundred and one).
function wordsToDigits(text) {
  const words = text.split(/\s+/).filter(Boolean);
  const out = [];
  let i = 0;
  while (i < words.length) {
    const w = words[i];
    if (!(w in UNITS) && !(w in TENS)) { out.push(w); i++; continue; }
    let current = 0, total = 0, last = null;
    while (i < words.length) {
      const t = words[i];
      if (t in TENS) {
        if (last !== null) break;
        current = TENS[t]; last = "tens";
      } else if (t in UNITS) {
        if (last === "tens" && UNITS[t] > 0 && UNITS[t] < 10) { current += UNITS[t]; last = "unit"; }
        else if (last === null || last === "scale") { current += UNITS[t]; last = "unit"; }
        else break;
      } else if (t === "hundred" && last !== null && last !== "scale") {
        current *= 100; last = "scale";
      } else if (t === "thousand" && last !== null) {
        total += (current || 1) * 1000; current = 0; last = "scale";
      } else break;
      i++;
    }
    let value = String(total + current);
    // "point five" after a number -> decimal
    if (words[i] === "point" && words[i + 1] in UNITS) {
      i++;
      let decimals = "";
      while (i < words.length && words[i] in UNITS && UNITS[words[i]] < 10) { decimals += UNITS[words[i]]; i++; }
      value += `.${decimals}`;
    }
    out.push(value);
  }
  return out.join(" ");
}

function normalize(text) {
  let t = ` ${text.toLowerCase()} `
    .replace(/[–—]/g, " ")
    .replace(/[,;:!?"()]/g, " ")
    .replace(/\.(?!\d)/g, " ")   // full stops, but keep decimals like 2.5
    .replace(/\//g, " ")
    .replace(/\s+/g, " ");
  t = wordsToDigits(t);
  t = ` ${t} `
    .replace(/(\d+)\s+point\s+(\d+)/g, "$1.$2")
    .replace(/(\d)\s*(mg|mcg|ml|iu)\b/g, "$1 $2")
    .replace(/\b(?:milligrams?|mgs|m g)\b/g, "mg")
    .replace(/\b(?:micrograms?|mcgs)\b/g, "mcg")
    .replace(/\b(?:international units?|i u|units?)\b/g, "iu")
    .replace(/\b(?:millilit(?:er|re)s?|m l)\b/g, "ml")
    .replace(/\b(?:grams?|gms?)\b/g, "g")
    .replace(/\s+/g, " ");
  return t.trim();
}

const titleCase = (s) => s.replace(/\b[a-z]/g, (c) => c.toUpperCase());
const capitalize = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/* ---------- drug-name matching ---------- */

const lettersOnly = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

// A rough sound-alike key, tuned for how speech recognition mangles drug
// names ("duphaston" -> "do faston", "letrozole" -> "letrozol"): unify
// letters that sound alike, drop vowels after the first letter, collapse
// repeats.
function phonetic(s) {
  let t = s.toLowerCase().replace(/[^a-z]/g, "");
  if (!t) return "";
  t = t.replace(/ph/g, "f").replace(/gh/g, "g").replace(/ck/g, "k").replace(/q/g, "k").replace(/x/g, "ks")
    .replace(/c(?=[eiy])/g, "s").replace(/c/g, "k").replace(/z/g, "s").replace(/th/g, "t")
    .replace(/w/g, "v").replace(/y/g, "i").replace(/dg/g, "j").replace(/h/g, "");
  if (!t) return "";
  t = t[0] + t.slice(1).replace(/[aeiou]/g, "");
  return t.replace(/(.)\1+/g, "$1");
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}
const similarity = (a, b) => (a && b ? 1 - levenshtein(a, b) / Math.max(a.length, b.length) : 0);

// "HCG TRIGGER – OVITRELLE" can be said as the generic, the brand or both;
// "GONADOTROPIN (RFSH) – GONAL-F" as any of its three names; "CLOMIPHENE
// CITRATE" as just "clomiphene" (a long, distinctive first word only).
function aliasesOf(drug) {
  const parts = drug.split(/\s+[–—-]\s+|[/()]/).map((p) => p.trim()).filter(Boolean);
  const firstWords = parts.map((p) => p.split(/\s+/)).filter((w) => w.length > 1 && w[0].length >= 7).map((w) => w[0]);
  return [...new Set([drug, ...parts, ...firstWords])];
}

function scoreAgainst(heard, alias) {
  const ak = lettersOnly(alias);
  const hk = lettersOnly(heard);
  if (!ak || !hk) return 0;
  const text = similarity(hk, ak);
  // Short names/abbreviations (HMG, rFSH) sound alike too easily — demand
  // they are heard exactly.
  if (ak.length < 5) return text === 1 ? 1 : text * 0.7;
  const sound = similarity(phonetic(heard), phonetic(alias));
  return Math.max(text, sound * 0.92);
}

const CONFIDENT = 0.85;
const POSSIBLE = 0.6;

/* Finds the drug list entry best matching the spoken words. Returns
   { name, status, heard, suggestions } where status is
   "ok"      — a clear match, filled in;
   "check"   — probably this drug, filled in but flagged for confirmation;
   "unknown" — nothing close; the heard words are filled in as typed. */
export function matchDrug(heardText, drugOptions) {
  const heard = heardText.trim();
  const words = heard.split(/\s+/).filter(Boolean);
  const best = new Map(); // drug -> score
  for (let len = 1; len <= Math.min(5, words.length); len++) {
    for (let start = 0; start + len <= words.length; start++) {
      const windowText = words.slice(start, start + len).join(" ");
      for (const drug of drugOptions) {
        for (const alias of aliasesOf(drug)) {
          const s = scoreAgainst(windowText, alias);
          if (s > (best.get(drug) || 0)) best.set(drug, s);
        }
      }
    }
  }
  const ranked = [...best.entries()].sort((a, b) => b[1] - a[1]);
  const [top, second] = ranked;
  const suggestions = ranked.filter(([, s]) => s >= 0.45).slice(0, 3).map(([d]) => d);
  const heardUpper = heard.toUpperCase();

  if (top && top[1] >= CONFIDENT && (!second || top[1] - second[1] >= 0.08)) {
    return { name: top[0], status: "ok", heard, suggestions: [] };
  }
  if (top && top[1] >= POSSIBLE) {
    return { name: top[0], status: "check", heard, suggestions };
  }
  return { name: heardUpper, status: "unknown", heard, suggestions };
}

/* ---------- per-medicine field extraction ---------- */

const FREQUENCIES = [
  [/\b([01])\s*-?\s*([01])\s*-?\s*([01])\b/, (m) => `${m[1]}-${m[2]}-${m[3]}`],
  [/\b(?:four times|4 times|qid|q i d)\b(?: a day| daily| in a day)?/, () => "QID (four times daily)"],
  [/\b(?:thrice|three times|3 times|tid|tds|t i d|t d s)\b(?: a day| daily| in a day)?/, () => "TID (thrice daily)"],
  [/\b(?:twice|two times|2 times|bd|bid|b d|b i d)\b(?: a day| daily| in a day)?/, () => "BD (twice daily)"],
  [/\b(?:once a week|once weekly|weekly|every week)\b/, () => "Weekly"],
  [/\b(?:alternate days?|every other day|alternate day)\b/, () => "Alternate days"],
  [/\b(?:sos|s o s|as needed|as and when required|when required|if needed|if required)\b/, () => "SOS (as needed)"],
  [/\b(?:stat|immediately|right away|once now)\b/, () => "Stat (once now)"],
  [/\b(?:once daily|once a day|once in a day|one time a day|1 time a day|od|o d|every day|daily|once)\b/, () => "OD (once daily)"],
];

const DURATIONS = [
  [/\bfrom day (\d+) (?:to|till|until|up to) day (\d+)\b/, (m) => `Day ${m[1]} to Day ${m[2]}`],
  [/\b(?:for )?(\d+) (days?|weeks?|months?)\b/, (m) => {
    const n = Number(m[1]);
    if (m[2].startsWith("day")) return n === 1 ? "1 day" : `${n} days`;
    if (m[2].startsWith("week")) return { 1: "7 days", 2: "14 days", 3: "21 days" }[n] || `${n} weeks`;
    return n === 1 ? "1 month" : `${n} months`;
  }],
  [/\bsingle dose\b/, () => "Single dose"],
  [/\b(?:until|till) (?:the )?next scan\b/, () => "Until next scan"],
  [/\bas advised\b/, () => "As advised"],
];

const INSTRUCTION_PHRASES = [
  [/\bafter (?:food|meals?|eating|breakfast|lunch|dinner)\b/, (m) => capitalize(m[0])],
  [/\bbefore (?:food|meals?|eating|breakfast|lunch|dinner)\b/, (m) => capitalize(m[0])],
  [/\b(?:on )?(?:an )?empty stomach\b/, () => "Empty stomach"],
  [/\b(?:at )?bed ?time\b|\bat night\b/, () => "At bedtime"],
  [/\bin the morning\b/, () => "In the morning"],
  [/\bwith (?:milk|water)\b/, (m) => capitalize(m[0])],
  [/\bfrom day (\d+)(?: of (?:the )?(?:cycle|period|menses))?\b(?! (?:to|till|until|up to) day)/, (m) => `From day ${m[1]}`],
  [/\b(?:subcutaneous(?:ly)?|s c|sc injection)\b/, () => "Subcutaneous"],
  [/\b(?:intramuscular(?:ly)?|i m injection)\b/, () => "Intramuscular"],
  [/\b(?:vaginally|per vaginal(?:ly)?|p v)\b/, () => "Vaginally"],
];

const FORM_WORDS = "give|start|take|add|prescribe|and|the|a|an|tablet|tablets|tab|tabs|capsule|capsules|cap|caps|injection|injections|inj|syrup|syp|medicine|drug|ointment|gel|sachet|cream|of|is";

function findFirst(patterns, text, taken) {
  for (const [re, fmt] of patterns) {
    const m = re.exec(text);
    if (m && !overlaps(m.index, m.index + m[0].length, taken)) {
      return { value: fmt(m), start: m.index, end: m.index + m[0].length };
    }
  }
  return null;
}
const overlaps = (s, e, spans) => spans.some((sp) => s < sp.end && e > sp.start);

function parseMedicine(segment, drugOptions) {
  const t = normalize(segment);
  const spans = [];
  const take = (hit) => { if (hit) spans.push(hit); return hit ? hit.value : ""; };

  // Explicit "instructions …" takes the rest of the medicine as free text.
  let instructions = "";
  const explicit = /\binstructions? (.+)$/.exec(t);
  if (explicit) {
    instructions = capitalize(explicit[1].trim());
    spans.push({ start: explicit.index, end: t.length });
  }

  const qty = /\b(?:quantity|qty|total|dispense)(?: of)? (\d+)(?: (tablets?|tabs?|capsules?|caps?|injections?|inj|vials?|strips?|sachets?|bottles?|ml))?\b/.exec(t);
  let quantity = "";
  if (qty && !overlaps(qty.index, qty.index + qty[0].length, spans)) {
    const unit = qty[2] ? qty[2].replace(/^tablets?$|^tabs$/, "tabs").replace(/^capsules?$|^caps$/, "caps").replace(/^injections?$/, "inj") : "";
    quantity = unit ? `${qty[1]} ${unit}` : qty[1];
    spans.push({ start: qty.index, end: qty.index + qty[0].length });
  }

  let dosage = "";
  const doseRe = /\b(\d+(?:\.\d+)?) (mg|mcg|iu|ml|g)\b/g;
  let dm;
  while ((dm = doseRe.exec(t))) {
    if (!overlaps(dm.index, dm.index + dm[0].length, spans)) {
      dosage = `${dm[1]} ${dm[2] === "iu" ? "IU" : dm[2]}`;
      spans.push({ start: dm.index, end: dm.index + dm[0].length });
      break;
    }
  }

  const duration = take(findFirst(DURATIONS, t, spans));
  const frequency = take(findFirst(FREQUENCIES, t, spans));

  if (!explicit) {
    const found = [];
    for (const [re, fmt] of INSTRUCTION_PHRASES) {
      const m = re.exec(t);
      if (m && !overlaps(m.index, m.index + m[0].length, spans)) {
        found.push({ value: fmt(m), start: m.index, end: m.index + m[0].length });
      }
    }
    found.sort((a, b) => a.start - b.start).forEach((f) => spans.push(f));
    instructions = found.map((f) => f.value).join(", ");
  }

  // The drug name is whatever was said before the first recognised field;
  // if the doctor led with a field instead, it's what's left once every
  // recognised field is blanked out.
  const firstField = spans.length ? Math.min(...spans.map((s) => s.start)) : t.length;
  let namePart = t.slice(0, firstField);
  if (!namePart.trim()) {
    namePart = spans.reduce((acc, s) => acc.slice(0, s.start) + " ".repeat(s.end - s.start) + acc.slice(s.end), t);
  }
  namePart = namePart
    .replace(new RegExp(`^(?:\\s*\\b(?:${FORM_WORDS})\\b)+`), "")
    .replace(/\b(?:for|at|with|of|and)\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
  // "Ecosprin 75" — a bare number right after the name is its strength.
  const bare = /^(.*\D)\s(\d+(?:\.\d+)?)$/.exec(namePart);
  if (bare && !dosage) { namePart = bare[1].trim(); dosage = bare[2]; }

  if (!namePart) return null;
  const match = matchDrug(namePart, drugOptions);
  return { name: match.name, dosage, frequency, duration, quantity, instructions, match };
}

/* ---------- whole-prescription parsing ---------- */

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const isoDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Reads a date from the start of `text`; returns { date, rest }.
function parseDatePhrase(text, now) {
  const t = normalize(text);
  const rel = /^(?:is )?(today|tomorrow|yesterday)\b/.exec(t);
  if (rel) {
    const d = new Date(now);
    d.setDate(d.getDate() + { today: 0, tomorrow: 1, yesterday: -1 }[rel[1]]);
    return { date: isoDate(d), rest: t.slice(rel[0].length) };
  }
  const monthAlt = MONTHS.join("|");
  const dm = new RegExp(`^(?:is )?(\\d{1,2})(?:st|nd|rd|th)?(?: of)? (${monthAlt})(?: (\\d{4}))?\\b`).exec(t)
    || new RegExp(`^(?:is )?(${monthAlt}) (\\d{1,2})(?:st|nd|rd|th)?(?: (\\d{4}))?\\b`).exec(t);
  if (dm) {
    const [day, month] = /^\d/.test(dm[1]) ? [Number(dm[1]), dm[2]] : [Number(dm[2]), dm[1]];
    const year = dm[3] ? Number(dm[3]) : now.getFullYear();
    const d = new Date(year, MONTHS.indexOf(month), day);
    if (d.getDate() === day) return { date: isoDate(d), rest: t.slice(dm[0].length) };
  }
  return { date: "", rest: text };
}

// Reads a doctor's name (up to three words) from the start of `text`,
// stopping at anything that looks like the start of a medicine.
function parseDoctorPhrase(text, drugOptions) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const name = [];
  let i = 0;
  while (i < words.length && /^(?:is|name|dr\.?|doctor)$/i.test(words[i])) i++;
  while (i < words.length && name.length < 3) {
    const w = words[i];
    if (/\d/.test(w) || new RegExp(`^(?:${FORM_WORDS}|next)$`, "i").test(w)) break;
    if (name.length && matchDrug(w, drugOptions).status === "ok") break;
    name.push(w.replace(/[.,]$/, ""));
    i++;
  }
  return { doctor: name.length ? `Dr. ${titleCase(name.join(" ").toLowerCase())}` : "", rest: words.slice(i).join(" ") };
}

const SECTION_RE = /\b(general advice|advice|advise|prescribing doctor|prescribed by|doctor|date)\b/gi;
// "next" separates medicines — except in "until next scan/visit/cycle".
const MEDICINE_SPLIT_RE = /\bnext(?: medicine| drug| one)?\b(?! (?:scan|visit|period|cycle|menses|day|week|month|follow|usg|sonography|appointment))/i;

/* Parses a whole dictated prescription. Returns
   { date, doctor, advice, medicines: [{ name, dosage, frequency, duration,
   quantity, instructions, match }] } with "" for anything not spoken. */
export function parseDictation(transcript, drugOptions, now = new Date()) {
  const result = { date: "", doctor: "", advice: "", medicines: [] };
  const text = ` ${transcript} `.replace(/\s+/g, " ");

  // Split into labelled sections: text before any keyword is medicines.
  const pieces = [];
  let lastIndex = 0, label = "meds";
  for (const m of text.matchAll(SECTION_RE)) {
    pieces.push({ label, text: text.slice(lastIndex, m.index) });
    const k = m[1].toLowerCase();
    label = k.includes("advi") ? "advice" : k === "date" ? "date" : "doctor";
    lastIndex = m.index + m[0].length;
  }
  pieces.push({ label, text: text.slice(lastIndex) });

  let medsText = "";
  for (const p of pieces) {
    if (p.label === "advice") {
      const a = p.text.replace(/^\s*(?:is|:)\s*/i, "").trim();
      if (a) result.advice = result.advice ? `${result.advice} ${capitalize(a)}` : capitalize(a);
    } else if (p.label === "doctor") {
      const { doctor, rest } = parseDoctorPhrase(p.text, drugOptions);
      if (doctor) result.doctor = doctor;
      medsText += ` ${rest}`;
    } else if (p.label === "date") {
      const { date, rest } = parseDatePhrase(p.text, now);
      if (date) result.date = date;
      medsText += ` ${rest}`;
    } else {
      medsText += ` ${p.text}`;
    }
  }

  result.medicines = medsText
    .split(MEDICINE_SPLIT_RE)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => parseMedicine(s, drugOptions))
    .filter(Boolean);
  return result;
}
