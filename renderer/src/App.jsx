import { useState, useEffect, useMemo, useContext, createContext, Fragment } from "react";
import _ from "lodash";
import {
  LayoutDashboard, Users, UserPlus, LogOut, Search, Plus, X, Save,
  ChevronLeft, Pill, TestTube2, Baby, ClipboardList, Trash2, Pencil,
  ArrowLeft, AlertCircle, Clock, CheckCircle2, Menu, ShieldCheck,
  FlaskConical, Stethoscope, CalendarClock, Database,
  IdCard, Upload, ImagePlus, FileText, Printer, Eye, Star, Copy
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell
} from "recharts";

/* ---------------------------------------------------------------------
   Design tokens
--------------------------------------------------------------------- */
const C = {
  bg: "#F5F7F6",
  card: "#FFFFFF",
  border: "#DEE5E1",
  borderSoft: "#EAEFEC",
  ink: "#1E2B27",
  inkMuted: "#5E6E68",
  inkFaint: "#8A9791",
  primary: "#1F5E52",
  primaryDark: "#153F37",
  primaryTint: "#E8F1EE",
  gold: "#A8791E",
  goldTint: "#FBF1DC",
  blue: "#3D6B8C",
  blueTint: "#E8F1F7",
  brick: "#B3432B",
  brickTint: "#FBEAE5",
  green: "#3F7D5C",
  greenTint: "#EAF5EE",
  slateTint: "#EEF1F0",
};

const FONT_DISPLAY = { fontFamily: "'Fraunces', Georgia, serif" };
const FONTS = (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600;700&display=swap');
    * { box-sizing: border-box; }
    body, .emr-root { font-family: 'Inter', system-ui, sans-serif; }
    .emr-root input, .emr-root select, .emr-root textarea { font-family: 'Inter', system-ui, sans-serif; }
    .emr-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
    .emr-scroll::-webkit-scrollbar-thumb { background: #C9D3CE; border-radius: 8px; }
    .emr-fade { animation: emrFade .18s ease; }
    @keyframes emrFade { from { opacity: 0; transform: translateY(3px); } to { opacity: 1; transform: none; } }
    .print-only { display: none; }
    @media print {
      .no-print { display: none !important; }
      .print-only { display: block !important; }
      .emr-root { background: #fff !important; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  `}</style>
);

/* ---------------------------------------------------------------------
   Utilities
--------------------------------------------------------------------- */
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const todayISO = () => new Date().toISOString().slice(0, 10);
const fmtDate = (d) => {
  if (!d) return "—";
  const dt = new Date(d + "T00:00:00");
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};
const monthLabel = (d) => {
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
};
const daysFromToday = (d) => {
  if (!d) return null;
  const dt = new Date(d + "T00:00:00");
  const t = new Date(todayISO() + "T00:00:00");
  return Math.round((dt - t) / 86400000);
};

/* BMI = weight(kg) / height(m)^2. Sr. Insulin & HOMA-IR: (Insulin uIU/ml x
   Fasting Glucose mg/dl) / 405 — the standard HOMA-IR formula. Both are
   derived, read-only display values (recomputed on every change) rather
   than independently-editable fields, so they can never drift out of sync
   with the inputs they come from. */
function calcBMI(heightCm, weightKg) {
  const h = parseFloat(heightCm), w = parseFloat(weightKg);
  if (!h || !w) return "";
  const m = h / 100;
  const bmi = w / (m * m);
  return Number.isFinite(bmi) ? bmi.toFixed(1) : "";
}
function bmiCategory(bmi) {
  const v = parseFloat(bmi);
  if (!v) return "";
  if (v < 18.5) return "Underweight";
  if (v < 25) return "Normal";
  if (v < 30) return "Overweight";
  return "Obese";
}
function calcHOMAIR(insulin, glucose) {
  const i = parseFloat(insulin), g = parseFloat(glucose);
  if (!i || !g) return "";
  const val = (i * g) / 405;
  return Number.isFinite(val) ? val.toFixed(2) : "";
}

/* Photo upload: downscaled client-side to a max 480px edge / JPEG q0.82
   before being stored as a data URL, so a phone photo doesn't balloon the
   patient's JSON record. */
function readImageAsDataURL(file, maxDim = 480) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = () => resolve(reader.result);
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/* Generic file attachment upload (Word/Excel/PDF/images) — unlike
   readImageAsDataURL above, this doesn't downscale (only images can be
   redrawn to a canvas), so it's capped by MAX_FILE_SIZE at the call site
   instead. */
function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

/* Desktop build: persistence goes through window.api (Electron preload →
   IPC → local SQLite), not the browser artifact's window.storage. The
   main process already returns/accepts real JS values (it does its own
   JSON encoding in src/db.js), so no manual JSON parsing is needed here. */
async function storageGet(key, fallback) {
  try {
    const v = await window.api.kvGet(key, fallback);
    return v === undefined || v === null ? fallback : v;
  } catch (e) {
    return fallback;
  }
}
async function storageSet(key, value) {
  try {
    return await window.api.kvSet(key, value);
  } catch (e) {
    return false;
  }
}
async function storageDelete(key) {
  try { await window.api.kvDelete(key); } catch (e) {}
}

/* Web/Vercel build: window.api (Electron preload) doesn't exist, so patient
   records and prescriptions go through the Vercel API routes to Postgres
   instead of local storage. Cycles still use storageGet/storageSet above
   unchanged, which quietly no-op on the web build for now. */
const IS_WEB = typeof window === "undefined" || !window.api;

async function apiFetch(path, options = {}) {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  let body = null;
  try { body = await res.json(); } catch (e) { /* no body */ }
  if (!res.ok) {
    throw new Error((body && body.error) || "Request failed");
  }
  return body;
}

async function loadPatientsRemote() {
  const body = await apiFetch("/api/patients");
  return Array.isArray(body?.patients) ? body.patients : [];
}
async function createPatientRemote(patient) {
  const body = await apiFetch("/api/patients", { method: "POST", body: JSON.stringify(patient) });
  return body?.patient || patient;
}
async function updatePatientRemote(id, patient) {
  const body = await apiFetch(`/api/patients/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(patient) });
  return body?.patient || patient;
}
async function deletePatientRemote(id) {
  await apiFetch(`/api/patients/${encodeURIComponent(id)}`, { method: "DELETE" });
}

async function loadPrescriptionsRemote() {
  const body = await apiFetch("/api/prescriptions");
  return Array.isArray(body?.prescriptions) ? body.prescriptions : [];
}
async function createPrescriptionRemote(rx) {
  const body = await apiFetch("/api/prescriptions", { method: "POST", body: JSON.stringify(rx) });
  return body?.prescription || rx;
}
async function updatePrescriptionRemote(id, rx) {
  const body = await apiFetch(`/api/prescriptions/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(rx) });
  return body?.prescription || rx;
}
async function deletePrescriptionRemote(id) {
  await apiFetch(`/api/prescriptions/${encodeURIComponent(id)}`, { method: "DELETE" });
}

async function loadBackupsRemote() {
  const body = await apiFetch("/api/backups");
  return Array.isArray(body?.backups) ? body.backups : [];
}
async function createBackupRemote() {
  const body = await apiFetch("/api/backups", { method: "POST" });
  return body?.backup;
}
async function restoreBackupRemote(id) {
  return apiFetch(`/api/backups/${encodeURIComponent(id)}`, { method: "POST" });
}

/* ---------------------------------------------------------------------
   Blank templates
--------------------------------------------------------------------- */
function blankPatient() {
  return {
    id: uid(),
    fileNo: "",
    refDoctor: "",
    regDate: todayISO(),
    patientName: "",
    address: "",
    phoneW: "",
    phoneH: "",
    ageW: "",
    eduW: "",
    ageH: "",
    eduH: "",
    occW: "",
    occH: "",
    aadhaarW: "",
    aadhaarH: "",
    photoW: "",
    photoH: "",
    diet: "Veg",
    marriedSince: "",
    typeInfertility: "",
    menstrualHistory: "",
    lmp: "",
    obstetricHistory: "",
    pastFamilyHistory: "",
    exam: {
      stature: "", height: "", weight: "", bmi: "",
      thyroid: "", hirsutism: "", brSecretions: "", secSexChar: "",
      bp: "", tvs: "", tvsUterus: "", tvsEndometrium: "", tvsCavity: "", tvsRightOvary: "", tvsLeftOvary: "",
      rs: "", cvs: "",
    },
    invest: {
      hb: "", urine: "", esr: "", blGroup: "",
      bslFasting: "", bslPP: "", bslRandom: "",
      vdrl: "", hiv: "", hbsAg: "",
      srCreatinine: "", srInsulin: "", homaGlucose: "", homaIR: "",
      rubella: "", papSmear: "", apla: "",
      misc: "",
    },
    hormonePanels: [blankHormonePanelEntry()],
    laparoscopy: { date: "", findings: "" },
    hsg: { date: "", findings: "" },
    hysteroscopy: { date: "", findings: "" },
    pcr: { date: "", result: "" },
    cbnaat: { date: "", result: "" },
    husband: {
      habitsHistory: "", genitalExam: "", miscInvestigations: "", semenAnalysis: [],
      invest: {
        hb: "", urine: "", esr: "", blGroup: "",
        bslFasting: "", bslPP: "", bslRandom: "",
        vdrl: "", hiv: "", hbsAg: "",
        srCreatinine: "", srInsulin: "", homaGlucose: "", homaIR: "",
        misc: "",
      },
    },
    diagnosis: "",
    planOfManagement: "",
    treatmentType: "Undecided",
    status: "Active",
    nextFollowUp: "",
    cycles: [blankPaperCycle()],
    files: [],
    // Field ids the doctor has highlighted as worth revisiting next
    // appointment, mapped to "yellow" | "red" — see HighlightContext.
    // Keys are the same dot-paths set() uses in PatientForm (e.g.
    // "exam.bmi", "husband.invest.hb", "diagnosis").
    highlights: {},
    createdAt: new Date().toISOString(),
  };
}

/* Cap: at most 3 hormone assay tables / 6 monitoring cycles per patient
   (see MAX_HORMONE_PANELS / MAX_CYCLES below, used by the Add buttons). */
function blankHormonePanel() {
  return _.fromPairs(HORMONE_KEYS.map(([k]) => [k, { date: "", day: "", result: "", lab: "" }]));
}
function blankHormonePanelEntry() {
  return { id: uid(), panel: blankHormonePanel() };
}
function blankCycleRow() {
  return { id: uid(), date: "", day: "", e2: "", end: "", rtOv: "", ltOv: "", adv: "" };
}
function blankPaperCycle() {
  return { id: uid(), date: "", rows: Array.from({ length: 9 }, blankCycleRow) };
}
const MAX_HORMONE_PANELS = 3;
const MAX_CYCLES = 6;

/* Migrates a patient record saved under an older schema onto the current
   one: paperCycles {cycle1,cycle2,cycle3} -> cycles: [...] (dynamic,
   max 6); hormonePanels {initial,repeat} -> hormonePanels: [...] (dynamic,
   max 3, "Recepit" retired); invest.bslType/bsl -> the three separate
   Fasting/PP/Random Sugar fields. Only touches records that still have the
   old shape — a record already on the new shape passes through untouched. */
function migrateLegacyShapes(p) {
  if (!p || typeof p !== "object") return p;
  const out = { ...p };

  if (!Array.isArray(out.cycles)) {
    const legacy = out.paperCycles && typeof out.paperCycles === "object"
      ? ["cycle1", "cycle2", "cycle3"].map((k) => out.paperCycles[k]).filter(Boolean)
      : [];
    out.cycles = legacy.length
      ? legacy.map((c) => ({ id: uid(), date: c.date || "", rows: c.rows && c.rows.length ? c.rows : Array.from({ length: 9 }, blankCycleRow) }))
      : [blankPaperCycle()];
  }
  delete out.paperCycles;

  if (!Array.isArray(out.hormonePanels)) {
    const hp = out.hormonePanels && typeof out.hormonePanels === "object" ? out.hormonePanels : {};
    const legacy = [hp.initial, hp.repeat].filter(Boolean);
    out.hormonePanels = legacy.length
      ? legacy.map((panel) => ({ id: uid(), panel }))
      : [blankHormonePanelEntry()];
  }

  const migrateBSL = (invest) => {
    if (!invest || (invest.bslType === undefined && invest.bsl === undefined)) return invest;
    if (invest.bslFasting !== undefined || invest.bslPP !== undefined || invest.bslRandom !== undefined) return invest;
    const next = { ...invest };
    const type = (invest.bslType || "").toLowerCase();
    const val = invest.bsl || "";
    if (val) {
      if (type.includes("pp")) next.bslPP = val;
      else if (type.includes("random")) next.bslRandom = val;
      else next.bslFasting = val; // "Fasting Sugar" or unspecified — keep the value rather than drop it
    }
    delete next.bslType;
    delete next.bsl;
    return next;
  };
  if (out.invest) out.invest = migrateBSL(out.invest);
  if (out.husband?.invest) out.husband = { ...out.husband, invest: migrateBSL(out.husband.invest) };

  return out;
}

/* Fills in any field this update introduced (husband.invest, TVS sub-fields,
   Aadhaar/photo, etc.) on a patient record saved by an older version of the
   form, so editing/viewing a pre-existing patient never hits an undefined
   nested field. Arrays (semen reports, cycle rows) are taken from the real
   record as-is rather than merged index-by-index, so a shorter/edited list
   never gets padded back out with blank rows. */
function normalizePatient(p) {
  if (!p) return blankPatient();
  const migrated = migrateLegacyShapes(p);
  return _.mergeWith({}, blankPatient(), migrated, (destVal, srcVal) => {
    if (Array.isArray(destVal)) return srcVal === undefined ? destVal : srcVal;
  });
}

const EXAM_FIELDS = [
  ["stature", "Stature"], ["height", "Height (cm)"], ["weight", "Weight (kg)"], ["bmi", "BMI"],
  ["thyroid", "Thyroid"], ["hirsutism", "Hirsutism"], ["brSecretions", "Br. Secretions"], ["secSexChar", "Sec. Sex Characters"],
  ["bp", "B.P."], ["tvs", "TVS"],
  ["tvsUterus", "TVS — Uterus"], ["tvsEndometrium", "TVS — Endometrium"], ["tvsCavity", "TVS — Cavity"],
  ["tvsRightOvary", "TVS — Right Ovary"], ["tvsLeftOvary", "TVS — Left Ovary"],
  ["rs", "R.S."], ["cvs", "C.V.S."],
];
const INVEST_FIELDS = [
  ["hb", "Hb"], ["urine", "Urine"], ["esr", "ESR"], ["blGroup", "Bl. Group"],
  ["bslFasting", "BSL — Fasting Sugar"], ["bslPP", "BSL — PP Sugar"], ["bslRandom", "BSL — Random Sugar"],
  ["vdrl", "VDRL"], ["hiv", "HIV"], ["hbsAg", "HBs Ag"],
  ["srCreatinine", "Sr. Creatinine"], ["srInsulin", "Sr. Insulin"],
  ["homaGlucose", "Fasting Glucose (HOMA-IR)"], ["homaIR", "HOMA-IR"],
  ["rubella", "Rubella"], ["papSmear", "Pap Smear"], ["apla", "APLA"],
  ["misc", "Misc."],
];
/* Husband's Investigations panel mirrors the wife's, minus the three
   wife-specific tests (Rubella, Pap Smear, APLA). Derived by filtering
   rather than duplicated, so the two never drift apart. */
const INVEST_FIELDS_HUSBAND = INVEST_FIELDS.filter(([k]) => !["rubella", "papSmear", "apla"].includes(k));

/* Groups consecutive medicine rows that share a drug name, so the same drug
   prescribed at several doses (e.g. a tapering schedule) is shown/printed
   once under its name instead of repeating it per dose — see the "Add
   Another Dose" button in PrescriptionModal, which keeps same-drug rows
   adjacent so they group correctly here. */
function groupMedicines(medicines) {
  const groups = [];
  for (const m of medicines) {
    const last = groups[groups.length - 1];
    if (last && last.name === m.name) last.doses.push(m);
    else groups.push({ name: m.name, doses: [m] });
  }
  return groups;
}

const SEMEN_COLUMNS = [["date", "Date"], ["lab", "Lab"], ["count", "Count"], ["motility", "Motility"], ["pusCells", "Pus Cells"]];

/* Every read-only field in PatientDetail's Overview/Reports that can be
   highlighted, for the "Highlighted for Next Visit" summary card. Ids match
   the dot-paths PatientForm's set() uses for the same field (e.g.
   "exam.bmi", "husband.invest.hb"), so a highlight made while editing and
   one made while reviewing land on the exact same key — see
   HighlightContext. Semen analysis rows use their own stable row id
   ("semen.<rowId>.<column>"). Hormone assay panels and cycle monitoring
   aren't wired up yet — same mechanism would work there too, just not
   requested/done so far. */
function highlightableFields(patient) {
  return [
    { id: "refDoctor", label: "Ref. Doctor", value: patient.refDoctor },
    { id: "address", label: "Address", value: patient.address },
    { id: "phoneW", label: "Phone (W)", value: patient.phoneW },
    { id: "phoneH", label: "Phone (H)", value: patient.phoneH },
    { id: "ageW", label: "Age (W)", value: patient.ageW },
    { id: "ageH", label: "Age (H)", value: patient.ageH },
    { id: "eduW", label: "Education (W)", value: patient.eduW },
    { id: "eduH", label: "Education (H)", value: patient.eduH },
    { id: "occW", label: "Occupation (W)", value: patient.occW },
    { id: "occH", label: "Occupation (H)", value: patient.occH },
    { id: "aadhaarW", label: "Aadhaar (W)", value: patient.aadhaarW },
    { id: "aadhaarH", label: "Aadhaar (H)", value: patient.aadhaarH },
    { id: "marriedSince", label: "Married Since", value: patient.marriedSince },
    { id: "typeInfertility", label: "Type of Infertility", value: patient.typeInfertility },
    { id: "menstrualHistory", label: "Menstrual History", value: patient.menstrualHistory },
    { id: "lmp", label: "LMP", value: patient.lmp },
    { id: "obstetricHistory", label: "Obstetric History", value: patient.obstetricHistory },
    { id: "pastFamilyHistory", label: "Past/Family History", value: patient.pastFamilyHistory },
    ...EXAM_FIELDS.map(([k, label]) => ({ id: `exam.${k}`, label: `Exam — ${label}`, value: patient.exam[k] })),
    ...INVEST_FIELDS.map(([k, label]) => ({ id: `invest.${k}`, label: `Investigation (Wife) — ${label}`, value: patient.invest[k] })),
    ...INVEST_FIELDS_HUSBAND.map(([k, label]) => ({ id: `husband.invest.${k}`, label: `Investigation (Husband) — ${label}`, value: patient.husband.invest[k] })),
    { id: "diagnosis", label: "Diagnosis", value: patient.diagnosis },
    { id: "planOfManagement", label: "Plan of Management", value: patient.planOfManagement },
    { id: "laparoscopy.findings", label: "Laparoscopy", value: patient.laparoscopy.findings },
    { id: "hsg.findings", label: "HSG", value: patient.hsg.findings },
    { id: "hysteroscopy.findings", label: "Hysteroscopy", value: patient.hysteroscopy.findings },
    { id: "pcr.result", label: "PCR", value: patient.pcr.result },
    { id: "cbnaat.result", label: "CBNAAT", value: patient.cbnaat.result },
    ...(patient.husband.semenAnalysis || []).flatMap((r, i) =>
      SEMEN_COLUMNS.map(([key, label]) => ({
        id: `semen.${r.id}.${key}`,
        label: `Semen Analysis #${i + 1} — ${label}`,
        value: key === "date" ? fmtDate(r[key]) : r[key],
      }))
    ),
  ];
}

const OCCUPATION_OPTIONS = [
  "Self Employed", "Business", "Private Job", "Government Job", "Housewife",
  "Worker / Labourer", "Farmer", "Teacher", "Doctor", "Engineer", "Student", "Unemployed", "Retired",
];
const TYPE_INFERTILITY_OPTIONS = ["Primary", "Secondary", "Secondary with BOH"];
const MENSTRUAL_HISTORY_OPTIONS = ["Regular", "Irregular"];
const PRESENT_ABSENT_OPTIONS = ["Present", "Absent"];
const NORMAL_ABNORMAL_OPTIONS = ["Normal", "Abnormal"];
const HORMONE_KEYS = [
  ["fsh", "FSH", "mIU/ml"], ["lh", "L.H.", "mIU/ml"], ["prolactin", "Prolactin", "ng/ml"],
  ["tsh", "TSH", "uIU/ml"], ["t4", "T4", "mcg/dl"], ["amh", "AMH", "ng/nl"],
];

/* Prescription formulary — common OPD / fertility clinic drugs. "Other" always
   available so the doctor is never boxed in by the list. */
const DRUG_OPTIONS = [
  "Clomiphene Citrate", "Letrozole", "Gonadotropin (rFSH) – Gonal-F", "HMG – Menopur",
  "hCG Trigger – Ovitrelle", "hCG Trigger – Pregnyl", "GnRH Agonist – Lupride",
  "GnRH Antagonist – Cetrotide", "GnRH Antagonist – Orgalutran", "Progesterone – Susten",
  "Dydrogesterone – Duphaston", "Estradiol Valerate – Progynova", "Folic Acid", "Metformin",
  "Dexamethasone", "Cabergoline", "Aspirin – Ecosprin", "Doxycycline", "Multivitamin / Prenatal",
];
const DOSE_OPTIONS = [
  "2.5 mg", "5 mg", "50 mg", "100 mg", "150 mg", "200 mg", "250 mg", "400 mg", "500 mg",
  "75 IU", "150 IU", "225 IU", "300 IU", "375 IU", "0.25 mg", "0.5 mg", "1 mg", "2 mg",
  "5000 IU", "10000 IU",
];
const DURATION_OPTIONS = [
  "Single dose", "3 days", "5 days", "7 days", "10 days", "14 days", "21 days",
  "1 month", "2 months", "3 months", "Until next scan", "As advised",
];
const FREQUENCY_OPTIONS = [
  "OD (once daily)", "BD (twice daily)", "TID (thrice daily)", "QID (four times daily)",
  "1-0-1", "1-1-1", "0-0-1", "1-0-0", "SOS (as needed)", "Stat (once now)", "Weekly", "Alternate days",
];
/* Patient file attachments — client-side upload, capped at MAX_FILES so a
   record can't grow unbounded (files are embedded as data URLs in the same
   JSON blob the patient record is saved as, so each one adds directly to
   that payload). */
const MAX_FILES = 10;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB per file
const FILE_ACCEPT = ".doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/jpeg,image/png,application/pdf";

/* ---------------------------------------------------------------------
   Field highlighting — any field can be marked as important by whoever's
   using the form or reviewing the record, so it stands out (bold, red)
   for the next visit. A single HighlightContext (provided by PatientForm
   when editing, and by PatientDetail when reviewing) holds the current
   {fieldId: "red"} map plus a toggle function; every field primitive below
   reads it via useHighlight(highlightId) and renders the same single dot.
   Field ids are the same dot-paths already used by PatientForm's
   set(path, val) (e.g. "exam.bmi", "husband.invest.hb", "diagnosis"), so a
   highlight set while editing shows up identically when just reviewing the
   record, and vice versa. */
const HighlightContext = createContext(null);
function useHighlight(id) {
  const ctx = useContext(HighlightContext);
  if (!ctx || !id) return null;
  return { color: ctx.highlights[id] || null, toggle: (color) => ctx.onToggle(id, color) };
}
function highlightFieldStyle(h) {
  if (!h?.color) return {};
  return { border: `2px solid ${C.brick}`, background: C.brickTint };
}
/* The single toggle dot shown next to a highlightable field's label —
   click to highlight it red, click again to clear. Renders nothing if
   this field isn't wired to a highlight context (highlightId omitted) or
   there's no context (e.g. a page that doesn't support highlighting). */
function HighlightDots({ id }) {
  const h = useHighlight(id);
  if (!h) return null;
  return (
    <button
      type="button"
      className="no-print shrink-0"
      title={h.color ? "Remove highlight" : "Highlight this field"}
      onClick={() => h.toggle(h.color ? null : "red")}
      style={{
        width: 10, height: 10, borderRadius: 999, padding: 0, cursor: "pointer",
        background: h.color ? C.brick : "#fff",
        border: `1.5px solid ${C.brick}`,
      }}
    />
  );
}
function FieldLabel({ label, highlightId }) {
  return (
    <span className="text-xs font-medium flex items-center gap-1.5" style={{ color: C.inkMuted }}>
      {label}<HighlightDots id={highlightId} />
    </span>
  );
}

/* ---------------------------------------------------------------------
   Small UI primitives
--------------------------------------------------------------------- */
function TextField({ label, value, onChange, placeholder, type = "text", full, highlightId }) {
  const h = useHighlight(highlightId);
  return (
    <label className={"flex flex-col gap-1 " + (full ? "col-span-full" : "")}>
      <FieldLabel label={label} highlightId={highlightId} />
      <input
        type={type}
        value={value || ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg px-3 py-2 text-sm outline-none transition"
        style={{ border: `1px solid ${C.border}`, color: C.ink, background: "#fff", ...highlightFieldStyle(h) }}
        onFocus={(e) => (e.target.style.borderColor = C.primary)}
        onBlur={(e) => (e.target.style.borderColor = h?.color ? C.brick : C.border)}
      />
    </label>
  );
}
function SelectField({ label, value, onChange, options, full, placeholder, highlightId }) {
  const h = useHighlight(highlightId);
  return (
    <label className={"flex flex-col gap-1 " + (full ? "col-span-full" : "")}>
      <FieldLabel label={label} highlightId={highlightId} />
      <select
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg px-3 py-2 text-sm outline-none"
        style={{ border: `1px solid ${C.border}`, color: C.ink, background: "#fff", ...highlightFieldStyle(h) }}
      >
        {placeholder && !value && <option value="" disabled>{placeholder}</option>}
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}
/* Text input with a fixed, non-editable unit suffix (e.g. "mm/Hg" for B.P.) */
function TextFieldWithSuffix({ label, value, onChange, suffix, placeholder, highlightId }) {
  const h = useHighlight(highlightId);
  return (
    <label className="flex flex-col gap-1">
      <FieldLabel label={label} highlightId={highlightId} />
      <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ border: `1px solid ${C.border}`, background: "#fff", ...highlightFieldStyle(h) }}>
        <input
          value={value || ""}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 text-sm outline-none min-w-0"
          style={{ color: C.ink, background: "transparent" }}
        />
        <span className="text-xs whitespace-nowrap" style={{ color: C.inkFaint }}>{suffix}</span>
      </div>
    </label>
  );
}
/* Read-only display for a value this update computes automatically (BMI,
   HOMA-IR) so it's visually distinct from fields the doctor types into. */
function ComputedField({ label, value, hint }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium" style={{ color: C.inkMuted }}>{label}</span>
      <input
        readOnly
        value={value || "—"}
        className="rounded-lg px-3 py-2 text-sm outline-none"
        style={{ border: `1px solid ${C.border}`, color: C.ink, background: C.slateTint, cursor: "not-allowed" }}
      />
      {hint && <span className="text-[11px]" style={{ color: C.inkFaint }}>{hint}</span>}
    </label>
  );
}
function BMIField({ value }) {
  return <ComputedField label="BMI (auto-calculated)" value={value} hint={bmiCategory(value) || "weight(kg) ÷ height(m)²"} />;
}
function HomaIRField({ value }) {
  return <ComputedField label="HOMA-IR (auto-calculated)" value={value} hint="(Insulin × Fasting Glucose) ÷ 405" />;
}
/* Photo upload — downscales the image client-side (see readImageAsDataURL)
   and stores it as a data URL, with a thumbnail preview and a way to clear it. */
function PhotoField({ label, value, onChange }) {
  const [busy, setBusy] = useState(false);
  const inputId = useMemo(() => "photo-" + uid(), []);
  const handleFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const dataUrl = await readImageAsDataURL(file);
      onChange(dataUrl);
    } catch (err) {
      /* ignore — user can retry the upload */
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium" style={{ color: C.inkMuted }}>{label}</span>
      <div className="flex items-center gap-3">
        <div className="rounded-lg overflow-hidden flex items-center justify-center shrink-0"
          style={{ width: 64, height: 64, background: C.slateTint, border: `1px solid ${C.border}` }}>
          {value ? <img src={value} alt={label} className="w-full h-full object-cover" /> : <ImagePlus size={20} style={{ color: C.inkFaint }} />}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={inputId} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer w-fit"
            style={{ background: C.primaryTint, color: C.primaryDark }}>
            <Upload size={13} /> {busy ? "Uploading…" : value ? "Change Photo" : "Upload Photo"}
          </label>
          <input id={inputId} type="file" accept="image/*" className="hidden" onChange={handleFile} />
          {value && <button type="button" onClick={() => onChange("")} className="text-xs text-left" style={{ color: C.brick }}>Remove</button>}
        </div>
      </div>
    </div>
  );
}
function DropdownOtherField({ label, value, onChange, options, full, highlightId }) {
  const isKnown = !value || options.includes(value);
  const [showCustom, setShowCustom] = useState(!isKnown);
  const h = useHighlight(highlightId);

  // Belt-and-braces: if the value this field is holding is ever a custom
  // one not in the list — loaded from a saved record, or set some other
  // way — make sure the free-text box is actually showing for it, instead
  // of trusting only the state this instance happened to start with.
  useEffect(() => {
    if (value && !options.includes(value)) setShowCustom(true);
  }, [value, options]);

  return (
    <label className={"flex flex-col gap-1 " + (full ? "col-span-full" : "")}>
      <FieldLabel label={label} highlightId={highlightId} />
      <select
        value={showCustom ? "__other__" : (value || "")}
        onChange={(e) => {
          if (e.target.value === "__other__") { setShowCustom(true); onChange(""); }
          else { setShowCustom(false); onChange(e.target.value); }
        }}
        className="rounded-lg px-3 py-2 text-sm outline-none"
        style={{ border: `1px solid ${C.border}`, color: C.ink, background: "#fff", ...highlightFieldStyle(h) }}
      >
        <option value="">Select…</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
        <option value="__other__">Other (type manually)</option>
      </select>
      {showCustom && (
        <input
          autoFocus
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Enter ${label.toLowerCase()}`}
          className="rounded-lg px-3 py-2 text-sm outline-none mt-1"
          style={{ border: `2px solid ${C.primary}`, color: C.ink, background: "#fff" }}
        />
      )}
    </label>
  );
}
function TextAreaField({ label, value, onChange, rows = 2, full, highlightId }) {
  const h = useHighlight(highlightId);
  return (
    <label className={"flex flex-col gap-1 " + (full ? "col-span-full" : "")}>
      <FieldLabel label={label} highlightId={highlightId} />
      <textarea
        rows={rows}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg px-3 py-2 text-sm outline-none resize-none"
        style={{ border: `1px solid ${C.border}`, color: C.ink, background: "#fff", ...highlightFieldStyle(h) }}
      />
    </label>
  );
}
function Card({ children, className = "", style = {} }) {
  return (
    <div className={"rounded-2xl " + className} style={{ background: C.card, border: `1px solid ${C.border}`, ...style }}>
      {children}
    </div>
  );
}
function SectionTitle({ icon: Icon, children, sub }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      {Icon && <Icon size={17} style={{ color: C.primary }} />}
      <div>
        <h3 className="text-sm font-semibold tracking-wide uppercase" style={{ color: C.primaryDark, letterSpacing: "0.04em" }}>{children}</h3>
        {sub && <p className="text-xs" style={{ color: C.inkFaint }}>{sub}</p>}
      </div>
    </div>
  );
}
function Btn({ children, onClick, variant = "primary", icon: Icon, size = "md", disabled, type = "button" }) {
  const base = "inline-flex items-center gap-2 rounded-lg font-medium transition disabled:opacity-50";
  const sizes = size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm";
  const styles = {
    primary: { background: C.primary, color: "#fff" },
    ghost: { background: "transparent", color: C.primary, border: `1px solid ${C.border}` },
    danger: { background: C.brickTint, color: C.brick },
    subtle: { background: C.primaryTint, color: C.primaryDark },
  }[variant];
  return (
    <button type={type} disabled={disabled} onClick={onClick} className={base + " " + sizes} style={styles}>
      {Icon && <Icon size={size === "sm" ? 14 : 16} />}
      {children}
    </button>
  );
}
function Badge({ children, tone = "slate" }) {
  const tones = {
    slate: { bg: C.slateTint, fg: C.inkMuted },
    green: { bg: C.greenTint, fg: C.green },
    gold: { bg: C.goldTint, fg: C.gold },
    blue: { bg: C.blueTint, fg: C.blue },
    brick: { bg: C.brickTint, fg: C.brick },
  }[tone];
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap" style={{ background: tones.bg, color: tones.fg }}>
      {children}
    </span>
  );
}
function treatmentTone(t) { return t === "IVF" ? "gold" : t === "IUI" ? "blue" : "slate"; }
function statusTone(s) { return s === "Active" ? "green" : s === "Completed" ? "slate" : s === "Discontinued" ? "brick" : "slate"; }

function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className="fixed bottom-5 right-5 z-50 emr-fade">
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium"
        style={{ background: toast.type === "error" ? C.brick : C.primaryDark, color: "#fff" }}>
        {toast.type === "error" ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
        {toast.msg}
      </div>
    </div>
  );
}

/* Clinic letterhead — hidden on screen (see .print-only), shown only at the
   top of a printed page via window.print(), above whichever tab triggered
   the print. */
function Letterhead({ patient }) {
  return (
    <div className="print-only" style={{ marginBottom: 20, paddingBottom: 14, borderBottom: `2px solid ${C.primaryDark}` }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Baby size={26} style={{ color: C.primary }} />
          <div>
            <p className="text-lg font-semibold" style={{ ...FONT_DISPLAY, color: C.primaryDark }}>Navjeevan Fertility &amp; IVF Center</p>
            <p className="text-xs" style={{ color: C.inkMuted }}>Krishna-Mai Hospital, Solapur</p>
          </div>
        </div>
        <p className="text-xs" style={{ color: C.inkMuted }}>Printed: {fmtDate(todayISO())}</p>
      </div>
      {patient && (
        <div className="flex flex-wrap gap-x-6 gap-y-1 mt-3 text-sm" style={{ color: C.ink }}>
          <span><strong>Patient:</strong> {patient.patientName || "Unnamed"}</span>
          <span><strong>File No.:</strong> {patient.fileNo || "—"}</span>
          <span><strong>Age:</strong> {patient.ageW || "—"}</span>
          <span><strong>Ref. Doctor:</strong> {patient.refDoctor || "—"}</span>
        </div>
      )}
    </div>
  );
}

/* A dt/dd pair with the shared yellow/red highlight dots, used for every
   read-only field in Overview/Reports — see highlightableFields() and the
   "Highlighted for Next Visit" summary card. Reads/writes through the same
   HighlightContext the edit form uses, keyed by the same field id, so a
   highlight made in either place shows up in both. */
function HighlightRow({ label, value, highlightId }) {
  const h = useHighlight(highlightId);
  return (
    <Fragment>
      <dt style={{ color: C.inkFaint }}>{label}</dt>
      <dd className="flex items-center gap-1.5" style={{ color: h?.color ? C.brick : C.ink, fontWeight: h?.color ? 600 : 400 }}>
        <span>{value || "—"}</span>
        <HighlightDots id={highlightId} />
      </dd>
    </Fragment>
  );
}

/* Hormone panel table — mirrors the paper's "Hormone Assays" / "Recepit" tables
   (one row per Serum marker, each with its own Date / Day of Cycle / Result / Lab). */
function HormoneTable({ title, panel, editable, onChange, onRemove }) {
  return (
    <div className="rounded-xl p-3" style={{ background: C.slateTint }}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold" style={{ color: C.primaryDark }}>{title}</p>
        {onRemove && <button type="button" onClick={onRemove}><Trash2 size={13} style={{ color: C.inkFaint }} /></button>}
      </div>
      <div className="overflow-x-auto emr-scroll">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left" style={{ color: C.inkFaint }}>
              <th className="pb-1 font-medium text-xs w-32">Date</th>
              <th className="pb-1 font-medium text-xs">Serum</th>
              <th className="pb-1 font-medium text-xs w-24">Day of Cycle</th>
              <th className="pb-1 font-medium text-xs">Result</th>
              <th className="pb-1 font-medium text-xs w-28">Lab</th>
            </tr>
          </thead>
          <tbody>
            {HORMONE_KEYS.map(([k, label, unit]) => {
              const row = panel[k];
              return (
                <tr key={k} style={{ borderTop: `1px solid ${C.border}` }}>
                  {editable ? (
                    <>
                      <td className="py-1 pr-2"><input type="date" value={row.date} onChange={(e) => onChange(k, "date", e.target.value)} className="text-xs rounded px-2 py-1 outline-none w-full" style={{ border: `1px solid ${C.border}`, background: "#fff" }} /></td>
                      <td className="py-1 pr-2 font-medium" style={{ color: C.ink }}>{label}</td>
                      <td className="py-1 pr-2"><input value={row.day} onChange={(e) => onChange(k, "day", e.target.value)} className="text-xs rounded px-2 py-1 outline-none w-full" style={{ border: `1px solid ${C.border}`, background: "#fff" }} /></td>
                      <td className="py-1 pr-2">
                        <div className="flex items-center gap-1">
                          <input value={row.result} onChange={(e) => onChange(k, "result", e.target.value)} className="text-xs rounded px-2 py-1 outline-none w-full" style={{ border: `1px solid ${C.border}`, background: "#fff" }} />
                          <span className="text-[10px] whitespace-nowrap" style={{ color: C.inkFaint }}>{unit}</span>
                        </div>
                      </td>
                      <td className="py-1 pr-2"><input value={row.lab} onChange={(e) => onChange(k, "lab", e.target.value)} className="text-xs rounded px-2 py-1 outline-none w-full" style={{ border: `1px solid ${C.border}`, background: "#fff" }} /></td>
                    </>
                  ) : (
                    <>
                      <td className="py-2">{fmtDate(row.date)}</td>
                      <td className="py-2 font-medium" style={{ color: C.ink }}>{label}</td>
                      <td className="py-2">{row.day || "—"}</td>
                      <td className="py-2">{row.result ? `${row.result} ${unit}` : "—"}</td>
                      <td className="py-2">{row.lab || "—"}</td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* Cycle monitoring grid — mirrors the paper's "Cycle No. 1 / 2 / 3" tables. */
function CycleTable({ label, cycle, editable, onDateChange, onAddRow, onRemoveRow, onUpdateRow, onRemoveCycle }) {
  return (
    <div className="rounded-xl p-3" style={{ background: C.slateTint }}>
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold" style={{ color: C.primaryDark }}>{label}</p>
          {onRemoveCycle && <button type="button" onClick={onRemoveCycle}><Trash2 size={13} style={{ color: C.inkFaint }} /></button>}
        </div>
        {editable ? (
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: C.inkFaint }}>Date</span>
            <input type="date" value={cycle.date} onChange={(e) => onDateChange(e.target.value)} className="text-xs rounded px-2 py-1 outline-none" style={{ border: `1px solid ${C.border}`, background: "#fff" }} />
          </div>
        ) : (
          <span className="text-xs" style={{ color: C.inkFaint }}>Date: {fmtDate(cycle.date)}</span>
        )}
      </div>
      <div className="overflow-x-auto emr-scroll">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left" style={{ color: C.inkFaint }}>
              <th className="pb-1 font-medium text-xs">Date</th><th className="pb-1 font-medium text-xs">Day</th>
              <th className="pb-1 font-medium text-xs">E2</th><th className="pb-1 font-medium text-xs">End</th>
              <th className="pb-1 font-medium text-xs">Rt. Ov.</th><th className="pb-1 font-medium text-xs">Lt. Ov.</th>
              <th className="pb-1 font-medium text-xs">Adv.</th>{editable && <th></th>}
            </tr>
          </thead>
          <tbody>
            {cycle.rows.map((r) => (
              <tr key={r.id} style={{ borderTop: `1px solid ${C.border}` }}>
                {editable ? (
                  <>
                    <td className="py-1 pr-1"><input type="date" value={r.date} onChange={(e) => onUpdateRow(r.id, "date", e.target.value)} className="text-xs rounded px-1.5 py-1 outline-none w-full" style={{ border: `1px solid ${C.border}`, background: "#fff" }} /></td>
                    <td className="py-1 pr-1"><input value={r.day} onChange={(e) => onUpdateRow(r.id, "day", e.target.value)} className="text-xs rounded px-1.5 py-1 outline-none w-14" style={{ border: `1px solid ${C.border}`, background: "#fff" }} /></td>
                    <td className="py-1 pr-1"><input value={r.e2} onChange={(e) => onUpdateRow(r.id, "e2", e.target.value)} className="text-xs rounded px-1.5 py-1 outline-none w-16" style={{ border: `1px solid ${C.border}`, background: "#fff" }} /></td>
                    <td className="py-1 pr-1"><input value={r.end} onChange={(e) => onUpdateRow(r.id, "end", e.target.value)} className="text-xs rounded px-1.5 py-1 outline-none w-16" style={{ border: `1px solid ${C.border}`, background: "#fff" }} /></td>
                    <td className="py-1 pr-1"><input value={r.rtOv} onChange={(e) => onUpdateRow(r.id, "rtOv", e.target.value)} className="text-xs rounded px-1.5 py-1 outline-none w-16" style={{ border: `1px solid ${C.border}`, background: "#fff" }} /></td>
                    <td className="py-1 pr-1"><input value={r.ltOv} onChange={(e) => onUpdateRow(r.id, "ltOv", e.target.value)} className="text-xs rounded px-1.5 py-1 outline-none w-16" style={{ border: `1px solid ${C.border}`, background: "#fff" }} /></td>
                    <td className="py-1 pr-1"><input value={r.adv} onChange={(e) => onUpdateRow(r.id, "adv", e.target.value)} className="text-xs rounded px-1.5 py-1 outline-none w-full" style={{ border: `1px solid ${C.border}`, background: "#fff" }} /></td>
                    <td><button onClick={() => onRemoveRow(r.id)}><Trash2 size={13} style={{ color: C.inkFaint }} /></button></td>
                  </>
                ) : (
                  <>
                    <td className="py-1.5">{fmtDate(r.date)}</td><td className="py-1.5">{r.day || "—"}</td>
                    <td className="py-1.5">{r.e2 || "—"}</td><td className="py-1.5">{r.end || "—"}</td>
                    <td className="py-1.5">{r.rtOv || "—"}</td><td className="py-1.5">{r.ltOv || "—"}</td>
                    <td className="py-1.5">{r.adv || "—"}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editable && <Btn size="sm" variant="subtle" icon={Plus} onClick={onAddRow}>Add Row</Btn>}
    </div>
  );
}

/* ---------------------------------------------------------------------
   Login View
--------------------------------------------------------------------- */
function LoginView({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event?.preventDefault();
    if (busy) return;

    const normalizedUsername = username.trim();
    if (!normalizedUsername || !password) {
      setErr("Enter both your username and password.");
      return;
    }

    setBusy(true);
    setErr("");
    try {
      // Await the parent handler so authentication state updates before unmount.
      const ok = await onLogin(normalizedUsername, password);
      if (!ok) setErr("Incorrect username or password.");
    } catch (error) {
      // Display bridge/IPC failures separately from a rejected password.
      setErr(error instanceof Error ? error.message : "Unable to sign in. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: `linear-gradient(160deg, ${C.primaryDark}, ${C.primary} 55%, #2C7566)` }}>
      <div className="w-full max-w-4xl grid md:grid-cols-2 rounded-3xl overflow-hidden shadow-2xl">
        <div className="hidden md:flex flex-col justify-between p-10" style={{ background: `linear-gradient(190deg, ${C.primaryDark}, ${C.primary})`, color: "#fff" }}>
          <div className="flex items-center gap-2 opacity-90">
            <Baby size={20} />
            <span className="text-sm tracking-widest uppercase">Navjeevan Fertility &amp; IVF Center</span>
          </div>
          <div>
            <h1 className="text-4xl leading-tight mb-3" style={FONT_DISPLAY}>Every follow-up,<br />on record.</h1>
            <p className="text-sm opacity-80 max-w-xs">A patient journey system for the OPD — from first consultation through IUI/IVF cycles, reports, prescriptions and files.</p>
          </div>
          <p className="text-xs opacity-60">Krishna-Mai Hospital, Solapur</p>
        </div>
        <div className="p-8 sm:p-10 flex flex-col justify-center" style={{ background: "#fff" }}>
          <div className="md:hidden flex items-center gap-2 mb-6" style={{ color: C.primary }}>
            <Baby size={20} /><span className="text-sm font-semibold">Navjeevan Fertility &amp; IVF Center</span>
          </div>
          <h2 className="text-xl font-semibold mb-1" style={{ color: C.ink }}>Sign in</h2>
          <p className="text-sm mb-6" style={{ color: C.inkMuted }}>
          </p>
          <form className="flex flex-col gap-3" onSubmit={submit} noValidate>
            <TextField label="Username" value={username} onChange={setUsername} placeholder="admin" />
            <TextField label="Password" type="password" value={password} onChange={setPassword} placeholder="••••••••" />
            {err && <p className="text-xs flex items-center gap-1" style={{ color: C.brick }}><AlertCircle size={13} />{err}</p>}
            {/* Submitting the form supports both clicking Sign in and pressing Enter. */}
            <Btn type="submit" icon={ShieldCheck} disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Btn>
          </form>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------
   Sidebar / Shell
--------------------------------------------------------------------- */
function Shell({ user, view, setView, onLogout, onOpenChangePassword, onOpenBackups, children, mobileOpen, setMobileOpen }) {
  const nav = [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { key: "patients", label: "Patients", icon: Users },
    { key: "newPatient", label: "New Patient", icon: UserPlus },
  ];
  return (
    <div className="min-h-screen flex" style={{ background: C.bg }}>
      <aside
  className={
    "fixed md:sticky md:top-0 z-40 top-0 left-0 h-screen w-64 md:w-60 flex-col shrink-0 transition-transform no-print " +
    (mobileOpen
      ? "translate-x-0 flex"
      : "-translate-x-full md:translate-x-0 md:flex")
  }
  style={{
    background: C.primaryDark,
    color: "#fff"
  }}
>
  
        <div className="flex items-center gap-2 px-5 py-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
          <Baby size={20} />
          <div className="leading-tight">
            <p className="text-sm font-semibold">Navjeevan</p>
            <p className="text-[11px] opacity-70">Fertility &amp; IVF Center</p>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          {nav.map((n) => {
            const active = view === n.key;
            return (
              <button key={n.key} onClick={() => { setView(n.key); setMobileOpen(false); }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition text-left"
                style={{ background: active ? "rgba(255,255,255,0.14)" : "transparent", color: active ? "#fff" : "rgba(255,255,255,0.75)" }}>
                <n.icon size={17} />{n.label}
              </button>
            );
          })}
        </nav>
        <div className="px-5 py-4 flex flex-col gap-2" style={{ borderTop: "1px solid rgba(255,255,255,0.12)" }}>
          <p className="text-xs font-medium">{user.fullName}</p>
          <p className="text-[11px] opacity-60 mb-1">{user.role}</p>
          <button onClick={onOpenChangePassword} className="flex items-center gap-2 text-xs opacity-80 hover:opacity-100 text-left">
            <ShieldCheck size={14} /> Change password
          </button>
          <button onClick={onOpenBackups} className="flex items-center gap-2 text-xs opacity-80 hover:opacity-100 text-left">
            <Database size={14} /> Backups
          </button>
          <button onClick={onLogout} className="flex items-center gap-2 text-xs opacity-80 hover:opacity-100 text-left">
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </aside>
      {mobileOpen && <div className="fixed inset-0 bg-black/30 z-30 md:hidden" onClick={() => setMobileOpen(false)} />}
      <div className="flex-1 min-w-0">
        <div className="md:hidden flex items-center justify-between px-4 py-3 no-print" style={{ background: C.primaryDark, color: "#fff" }}>
          <button onClick={() => setMobileOpen(true)}><Menu size={20} /></button>
          <span className="text-sm font-semibold">Navjeevan EMR</span>
          <div style={{ width: 20 }} />
        </div>
        <main className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto emr-fade">
          {children}
        </main>
      </div>
    </div>
  );
}

function ChangePasswordModal({  onClose, onSave }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (next.length < 6) { setErr("New password must be at least 6 characters."); return; }
    if (next !== confirm) { setErr("New password and confirmation don't match."); return; }
    setBusy(true);
    setErr("");
    const ok = await onSave(current, next);
    setBusy(false);
    if (!ok) setErr("Current password is incorrect.");
  };

  return (
    <ModalShell title="Change Password" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <TextField label="Current Password" type="password" value={current} onChange={setCurrent} />
        <TextField label="New Password" type="password" value={next} onChange={setNext} />
        <TextField label="Confirm New Password" type="password" value={confirm} onChange={setConfirm} />
        {err && <p className="text-xs flex items-center gap-1" style={{ color: C.brick }}><AlertCircle size={13} />{err}</p>}
      </div>
      <div className="flex justify-end gap-2 mt-5">
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn icon={Save} onClick={submit} disabled={busy || !current || !next || !confirm}>{busy ? "Saving…" : "Save Password"}</Btn>
      </div>
    </ModalShell>
  );
}

function BackupsModal({ onClose, backups, onRun, onRestore, onOpenFolder, busy }) {
  const isWeb = !onOpenFolder;
  return (
    <ModalShell title="Backups" onClose={onClose} wide>
      <p className="text-sm mb-4" style={{ color: C.inkMuted }}>
        {isWeb
          ? `Click "Back Up Now" to save a full snapshot of every patient and prescription. The last 30 are kept — restoring one replaces all current data with that snapshot.`
          : "A snapshot is taken automatically on launch, every 6 hours while the app is open, and on close. The last 30 snapshots are kept. Copy the backups folder to a USB drive or cloud-synced folder periodically for off-site protection."}
      </p>
      <div className="flex gap-2 mb-4">
        <Btn size="sm" icon={Save} onClick={onRun} disabled={busy}>{busy ? "Backing up…" : "Back Up Now"}</Btn>
        {onOpenFolder && <Btn size="sm" variant="ghost" onClick={onOpenFolder}>Open Backups Folder</Btn>}
      </div>
      <div className="max-h-72 overflow-y-auto emr-scroll flex flex-col gap-2">
        {backups.length === 0 && <p className="text-sm" style={{ color: C.inkFaint }}>No backups yet.</p>}
        {isWeb
          ? backups.map((b) => (
            <div key={b.id} className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: C.slateTint }}>
              <span className="text-sm" style={{ color: C.ink }}>{new Date(b.createdAt).toLocaleString("en-IN")} · {b.patientCount} patient{b.patientCount === 1 ? "" : "s"}</span>
              <Btn size="sm" variant="ghost" onClick={() => onRestore(b)}>Restore</Btn>
            </div>
          ))
          : backups.map((b) => (
            <div key={b} className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: C.slateTint }}>
              <span className="text-sm" style={{ color: C.ink }}>{b.replace("_", " · ").replace(/-/g, (m) => m)}</span>
              <Btn size="sm" variant="ghost" onClick={() => onRestore(b)}>Restore</Btn>
            </div>
          ))}
      </div>
      <div className="flex justify-end mt-5">
        <Btn variant="ghost" onClick={onClose}>Close</Btn>
      </div>
    </ModalShell>
  );
}

/* ---------------------------------------------------------------------
   Dashboard
--------------------------------------------------------------------- */
function Dashboard({ patients, setView, openPatient }) {
  const now = new Date();
  const monthly = useMemo(() => {
    const buckets = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString("en-IN", { month: "short" }), count: 0 });
    }
    patients.forEach((p) => {
      const d = new Date((p.regDate || p.createdAt || "").slice(0, 10) + "T00:00:00");
      if (isNaN(d)) return;
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const b = buckets.find((x) => x.key === key);
      if (b) b.count += 1;
    });
    return buckets;
  }, [patients]);

  const thisMonthCount = patients.filter((p) => {
    const d = new Date((p.regDate || "").slice(0, 10) + "T00:00:00");
    return !isNaN(d) && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const iuiCount = patients.filter((p) => p.treatmentType === "IUI").length;
  const ivfCount = patients.filter((p) => p.treatmentType === "IVF").length;

  const followUps = patients
    .filter((p) => p.nextFollowUp)
    .map((p) => ({ ...p, delta: daysFromToday(p.nextFollowUp) }))
    .filter((p) => p.delta <= 14)
    .sort((a, b) => a.delta - b.delta);

  const kpis = [
    { label: "Total Patients", value: patients.length, icon: Users, tone: "slate" },
    { label: "Registered This Month", value: thisMonthCount, icon: UserPlus, tone: "green" },
    { label: "IUI Patients", value: iuiCount, icon: TestTube2, tone: "blue" },
    { label: "IVF Patients", value: ivfCount, icon: FlaskConical, tone: "gold" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl" style={FONT_DISPLAY}>Good day, Doctor.</h1>
          <p className="text-sm" style={{ color: C.inkMuted }}>{now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
        </div>
        <Btn icon={UserPlus} onClick={() => setView("newPatient")}>Register Patient</Btn>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <Card key={k.label} className="p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium" style={{ color: C.inkMuted }}>{k.label}</span>
              <k.icon size={16} style={{ color: C.inkFaint }} />
            </div>
            <p className="text-3xl" style={FONT_DISPLAY}>{k.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <Card className="p-5 lg:col-span-2">
          <SectionTitle icon={LayoutDashboard} sub="Last 6 months">Patients Registered per Month</SectionTitle>
          <div style={{ height: 230 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly} margin={{ left: -20, right: 4 }}>
                <CartesianGrid vertical={false} stroke={C.borderSoft} />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: C.inkMuted }} axisLine={{ stroke: C.border }} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: C.inkMuted }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: C.primaryTint }} contentStyle={{ borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 12 }} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={40}>
                  {monthly.map((_, i) => <Cell key={i} fill={i === monthly.length - 1 ? C.primary : "#AFC9C2"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle icon={CalendarClock} sub="Next 14 days">Follow-ups Due</SectionTitle>
          <div className="flex flex-col gap-2 max-h-56 overflow-y-auto emr-scroll pr-1">
            {followUps.length === 0 && <p className="text-sm" style={{ color: C.inkFaint }}>No follow-ups due — nothing is slipping through.</p>}
            {followUps.map((p) => (
              <button key={p.id} onClick={() => openPatient(p.id)} className="w-full text-left flex items-center justify-between rounded-lg px-3 py-2 hover:brightness-95" style={{ background: p.delta < 0 ? C.brickTint : C.slateTint }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: C.ink }}>{p.patientName || "Unnamed"}</p>
                  <p className="text-xs" style={{ color: C.inkMuted }}>{fmtDate(p.nextFollowUp)}</p>
                </div>
                <Badge tone={p.delta < 0 ? "brick" : p.delta <= 3 ? "gold" : "slate"}>
                  {p.delta < 0 ? `${Math.abs(p.delta)}d overdue` : p.delta === 0 ? "Today" : `in ${p.delta}d`}
                </Badge>
              </button>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <SectionTitle icon={Users}>Recently Registered</SectionTitle>
        <div className="overflow-x-auto emr-scroll">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left" style={{ color: C.inkFaint }}>
                <th className="pb-2 font-medium">Patient</th><th className="pb-2 font-medium">Reg. Date</th>
                <th className="pb-2 font-medium">Infertility Type</th><th className="pb-2 font-medium">Treatment</th><th className="pb-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {_.orderBy(patients, ["createdAt"], ["desc"]).slice(0, 6).map((p) => (
                <tr key={p.id} className="cursor-pointer" onClick={() => openPatient(p.id)} style={{ borderTop: `1px solid ${C.borderSoft}` }}>
                  <td className="py-2.5 font-medium" style={{ color: C.ink }}>{p.patientName || "Unnamed"}</td>
                  <td className="py-2.5" style={{ color: C.inkMuted }}>{fmtDate(p.regDate)}</td>
                  <td className="py-2.5" style={{ color: C.inkMuted }}>{p.typeInfertility || "—"}</td>
                  <td className="py-2.5"><Badge tone={treatmentTone(p.treatmentType)}>{p.treatmentType}</Badge></td>
                  <td className="py-2.5"><Badge tone={statusTone(p.status)}>{p.status}</Badge></td>
                </tr>
              ))}
              {patients.length === 0 && <tr><td colSpan={5} className="py-6 text-center" style={{ color: C.inkFaint }}>No patients registered yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------------------
   Patients List
--------------------------------------------------------------------- */
function PatientsList({ patients, openPatient, setView, deletePatient }) {
  const [q, setQ] = useState("");
  const [tFilter, setTFilter] = useState("All");
  const filtered = patients.filter((p) => {
    const matchQ = !q || (p.patientName || "").toLowerCase().includes(q.toLowerCase()) || (p.fileNo || "").toLowerCase().includes(q.toLowerCase());
    const matchT = tFilter === "All" || p.treatmentType === tFilter;
    return matchQ && matchT;
  });
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl" style={FONT_DISPLAY}>Patients</h1>
        <Btn icon={UserPlus} onClick={() => setView("newPatient")}>Register Patient</Btn>
      </div>
      <Card className="p-4">
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="flex items-center gap-2 rounded-lg px-3 py-2 flex-1 min-w-[200px]" style={{ border: `1px solid ${C.border}` }}>
            <Search size={15} style={{ color: C.inkFaint }} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or file no."
              className="text-sm outline-none flex-1" style={{ color: C.ink }} />
          </div>
          <select value={tFilter} onChange={(e) => setTFilter(e.target.value)} className="rounded-lg px-3 py-2 text-sm" style={{ border: `1px solid ${C.border}`, color: C.ink }}>
            {["All", "IUI", "IVF", "Optimization", "Other"].map((o) => <option key={o}>{o}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto emr-scroll">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left" style={{ color: C.inkFaint }}>
                <th className="pb-2 font-medium">File No.</th><th className="pb-2 font-medium">Patient</th>
                <th className="pb-2 font-medium">Age (W/H)</th><th className="pb-2 font-medium">Infertility Type</th>
                <th className="pb-2 font-medium">Treatment</th><th className="pb-2 font-medium">Follow-up</th>
                <th className="pb-2 font-medium">Status</th><th className="pb-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} style={{ borderTop: `1px solid ${C.borderSoft}` }}>
                  <td className="py-2.5" style={{ color: C.inkMuted }}>{p.fileNo || "—"}</td>
                  <td className="py-2.5 font-medium cursor-pointer" style={{ color: C.ink }} onClick={() => openPatient(p.id)}>{p.patientName || "Unnamed"}</td>
                  <td className="py-2.5" style={{ color: C.inkMuted }}>{p.ageW || "—"}/{p.ageH || "—"}</td>
                  <td className="py-2.5" style={{ color: C.inkMuted }}>{p.typeInfertility || "—"}</td>
                  <td className="py-2.5"><Badge tone={treatmentTone(p.treatmentType)}>{p.treatmentType}</Badge></td>
                  <td className="py-2.5" style={{ color: C.inkMuted }}>{fmtDate(p.nextFollowUp)}</td>
                  <td className="py-2.5"><Badge tone={statusTone(p.status)}>{p.status}</Badge></td>
                  <td className="py-2.5 text-right">
                    <button onClick={() => deletePatient(p.id)} title="Delete"><Trash2 size={15} style={{ color: C.inkFaint }} /></button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={8} className="py-8 text-center" style={{ color: C.inkFaint }}>No matching patients.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------------------
   Patient Form (register / edit)
--------------------------------------------------------------------- */
function PatientForm({ initial, onSave, onCancel }) {
  const [data, setData] = useState(() => normalizePatient(initial));
  const [tab, setTab] = useState("basic");
  const set = (path, val) => setData((prev) => _.set(_.cloneDeep(prev), path, val));
  // Highlight ids are flat keys (some containing dots, e.g. "exam.bmi") into
  // data.highlights — set directly rather than through set()/_.set, which
  // would otherwise treat a dotted id as a nested path and create
  // data.highlights.exam.bmi instead of data.highlights["exam.bmi"].
  const toggleHighlight = (id, color) => setData((prev) => {
    const highlights = { ...prev.highlights };
    if (color) highlights[id] = color; else delete highlights[id];
    return { ...prev, highlights };
  });

  // Height/weight and Sr. Insulin/Fasting Glucose drive the auto-calculated
  // BMI and HOMA-IR fields, so their setters recompute the derived value in
  // the same update rather than leaving it to go stale until the next edit.
  const setExamMeasure = (field, val) => setData((prev) => {
    const next = _.set(_.cloneDeep(prev), `exam.${field}`, val);
    next.exam.bmi = calcBMI(next.exam.height, next.exam.weight);
    return next;
  });
  const setWifeHoma = (field, val) => setData((prev) => {
    const next = _.set(_.cloneDeep(prev), `invest.${field}`, val);
    next.invest.homaIR = calcHOMAIR(next.invest.srInsulin, next.invest.homaGlucose);
    return next;
  });
  const setHusbandHoma = (field, val) => setData((prev) => {
    const next = _.set(_.cloneDeep(prev), `husband.invest.${field}`, val);
    next.husband.invest.homaIR = calcHOMAIR(next.husband.invest.srInsulin, next.husband.invest.homaGlucose);
    return next;
  });

  const tabs = [
    { key: "basic", label: "Basic Info & History" },
    { key: "exam", label: "Examination & Investigations" },
    { key: "imaging", label: "Hormone Assays & Imaging" },
    { key: "husband", label: "Husband Investigations" },
    { key: "plan", label: "Diagnosis & Plan" },
  ];

  const updHormonePanel = (panelId, hormoneKey, field, val) => setData((prev) => ({
    ...prev,
    hormonePanels: prev.hormonePanels.map((entry) => entry.id === panelId
      ? { ...entry, panel: { ...entry.panel, [hormoneKey]: { ...entry.panel[hormoneKey], [field]: val } } }
      : entry),
  }));
  const addHormonePanel = () => setData((prev) => (
    prev.hormonePanels.length >= MAX_HORMONE_PANELS ? prev : { ...prev, hormonePanels: [...prev.hormonePanels, blankHormonePanelEntry()] }
  ));
  const removeHormonePanel = (panelId) => setData((prev) => (
    prev.hormonePanels.length <= 1 ? prev : { ...prev, hormonePanels: prev.hormonePanels.filter((entry) => entry.id !== panelId) }
  ));

  const setCycleDate = (cycleId, val) => setData((prev) => ({ ...prev, cycles: prev.cycles.map((c) => c.id === cycleId ? { ...c, date: val } : c) }));
  const addCycleRow = (cycleId) => setData((prev) => ({ ...prev, cycles: prev.cycles.map((c) => c.id === cycleId ? { ...c, rows: [...c.rows, blankCycleRow()] } : c) }));
  const rmCycleRow = (cycleId, rowId) => setData((prev) => ({ ...prev, cycles: prev.cycles.map((c) => c.id === cycleId ? { ...c, rows: c.rows.filter((r) => r.id !== rowId) } : c) }));
  const updCycleRow = (cycleId, rowId, field, val) => setData((prev) => ({ ...prev, cycles: prev.cycles.map((c) => c.id === cycleId ? { ...c, rows: c.rows.map((r) => r.id === rowId ? { ...r, [field]: val } : r) } : c) }));
  const addCycle = () => setData((prev) => (prev.cycles.length >= MAX_CYCLES ? prev : { ...prev, cycles: [...prev.cycles, blankPaperCycle()] }));
  const removeCycle = (cycleId) => setData((prev) => (prev.cycles.length <= 1 ? prev : { ...prev, cycles: prev.cycles.filter((c) => c.id !== cycleId) }));

  const addSemenRow = () => setData((prev) => ({ ...prev, husband: { ...prev.husband, semenAnalysis: [...prev.husband.semenAnalysis, { id: uid(), date: todayISO(), lab: "", count: "", motility: "", pusCells: "" }] } }));
  const rmSemenRow = (id) => setData((prev) => ({ ...prev, husband: { ...prev.husband, semenAnalysis: prev.husband.semenAnalysis.filter((r) => r.id !== id) } }));
  const updSemenRow = (id, key, val) => setData((prev) => ({ ...prev, husband: { ...prev.husband, semenAnalysis: prev.husband.semenAnalysis.map((r) => r.id === id ? { ...r, [key]: val } : r) } }));

  return (
    <HighlightContext.Provider value={{ highlights: data.highlights || {}, onToggle: toggleHighlight }}>
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <button onClick={onCancel}><ArrowLeft size={18} style={{ color: C.inkMuted }} /></button>
        <h1 className="text-2xl" style={FONT_DISPLAY}>{initial ? "Edit Patient" : "Register New Patient"}</h1>
      </div>

      <div className="flex gap-1 overflow-x-auto emr-scroll border-b" style={{ borderColor: C.border }}>
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className="px-4 py-2.5 text-sm font-medium whitespace-nowrap"
            style={{ color: tab === t.key ? C.primary : C.inkFaint, borderBottom: tab === t.key ? `2px solid ${C.primary}` : "2px solid transparent" }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "basic" && (
        <Card className="p-5 flex flex-col gap-6">
          <div>
            <SectionTitle icon={ClipboardList}>Registration</SectionTitle>
            <div className="grid sm:grid-cols-3 gap-4">
              <TextField label="File No." value={data.fileNo} onChange={(v) => set("fileNo", v)} highlightId="fileNo" />
              <TextField label="Ref. by Dr." value={data.refDoctor} onChange={(v) => set("refDoctor", v)} highlightId="refDoctor" />
              <TextField label="Date" type="date" value={data.regDate} onChange={(v) => set("regDate", v)} highlightId="regDate" />
              <TextField label="Patient's Name (Wife)" value={data.patientName} onChange={(v) => set("patientName", v)} full highlightId="patientName" />
              <TextAreaField label="Address" value={data.address} onChange={(v) => set("address", v)} full highlightId="address" />
              <TextField label="Phone (W)" value={data.phoneW} onChange={(v) => set("phoneW", v)} highlightId="phoneW" />
              <TextField label="Phone (H)" value={data.phoneH} onChange={(v) => set("phoneH", v)} highlightId="phoneH" />
              <SelectField label="Diet" value={data.diet} onChange={(v) => set("diet", v)} options={["Veg", "Non-Veg"]} highlightId="diet" />
            </div>
          </div>
          <div>
            <SectionTitle>Age, Education & Occupation</SectionTitle>
            <div className="grid sm:grid-cols-3 gap-4">
              <TextField label="Age (Wife)" value={data.ageW} onChange={(v) => set("ageW", v)} highlightId="ageW" />
              <TextField label="Education (Wife)" value={data.eduW} onChange={(v) => set("eduW", v)} highlightId="eduW" />
              <DropdownOtherField label="Occupation (Wife)" value={data.occW} onChange={(v) => set("occW", v)} options={OCCUPATION_OPTIONS} highlightId="occW" />
              <TextField label="Age (Husband)" value={data.ageH} onChange={(v) => set("ageH", v)} highlightId="ageH" />
              <TextField label="Education (Husband)" value={data.eduH} onChange={(v) => set("eduH", v)} highlightId="eduH" />
              <DropdownOtherField label="Occupation (Husband)" value={data.occH} onChange={(v) => set("occH", v)} options={OCCUPATION_OPTIONS} highlightId="occH" />
            </div>
          </div>
          <div>
            <SectionTitle icon={IdCard}>Identification & Photo</SectionTitle>
            <div className="grid sm:grid-cols-2 gap-6">
              <div className="flex flex-col gap-4">
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkFaint }}>Wife</p>
                <TextField label="Aadhaar Number (Wife)" value={data.aadhaarW} onChange={(v) => set("aadhaarW", v)} placeholder="XXXX XXXX XXXX" highlightId="aadhaarW" />
                <PhotoField label="Photo (Wife)" value={data.photoW} onChange={(v) => set("photoW", v)} />
              </div>
              <div className="flex flex-col gap-4">
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkFaint }}>Husband</p>
                <TextField label="Aadhaar Number (Husband)" value={data.aadhaarH} onChange={(v) => set("aadhaarH", v)} placeholder="XXXX XXXX XXXX" highlightId="aadhaarH" />
                <PhotoField label="Photo (Husband)" value={data.photoH} onChange={(v) => set("photoH", v)} />
              </div>
            </div>
          </div>
          <div>
            <SectionTitle>Fertility & Menstrual History</SectionTitle>
            <div className="grid sm:grid-cols-2 gap-4">
              <TextField label="Married Since" value={data.marriedSince} onChange={(v) => set("marriedSince", v)} highlightId="marriedSince" />
              <SelectField label="Type of Infertility" value={data.typeInfertility} onChange={(v) => set("typeInfertility", v)} options={TYPE_INFERTILITY_OPTIONS} placeholder="Select…" highlightId="typeInfertility" />
              <SelectField label="Menstrual History" value={data.menstrualHistory} onChange={(v) => set("menstrualHistory", v)} options={MENSTRUAL_HISTORY_OPTIONS} placeholder="Select…" highlightId="menstrualHistory" />
              <TextField label="LMP" type="date" value={data.lmp} onChange={(v) => set("lmp", v)} highlightId="lmp" />
              <TextAreaField label="Obstetric History" value={data.obstetricHistory} onChange={(v) => set("obstetricHistory", v)} full highlightId="obstetricHistory" />
              <TextAreaField label="Past / Family History" value={data.pastFamilyHistory} onChange={(v) => set("pastFamilyHistory", v)} full highlightId="pastFamilyHistory" />
            </div>
          </div>
        </Card>
      )}

      {tab === "exam" && (
        <Card className="p-5 flex flex-col gap-6">
          <div>
            <SectionTitle icon={Stethoscope} sub="Wife">Examination</SectionTitle>
            <div className="grid sm:grid-cols-4 gap-4">
              <TextField label="Stature" value={data.exam.stature} onChange={(v) => set("exam.stature", v)} highlightId="exam.stature" />
              <TextField label="Height (cm)" value={data.exam.height} onChange={(v) => setExamMeasure("height", v)} highlightId="exam.height" />
              <TextField label="Weight (kg)" value={data.exam.weight} onChange={(v) => setExamMeasure("weight", v)} highlightId="exam.weight" />
              <BMIField value={data.exam.bmi} />
              <SelectField label="Thyroid" value={data.exam.thyroid} onChange={(v) => set("exam.thyroid", v)} options={PRESENT_ABSENT_OPTIONS} placeholder="Select…" highlightId="exam.thyroid" />
              <SelectField label="Hirsutism" value={data.exam.hirsutism} onChange={(v) => set("exam.hirsutism", v)} options={PRESENT_ABSENT_OPTIONS} placeholder="Select…" highlightId="exam.hirsutism" />
              <SelectField label="Br. Secretions" value={data.exam.brSecretions} onChange={(v) => set("exam.brSecretions", v)} options={PRESENT_ABSENT_OPTIONS} placeholder="Select…" highlightId="exam.brSecretions" />
              <SelectField label="Sec. Sex Characters" value={data.exam.secSexChar} onChange={(v) => set("exam.secSexChar", v)} options={NORMAL_ABNORMAL_OPTIONS} placeholder="Select…" highlightId="exam.secSexChar" />
              <TextFieldWithSuffix label="B.P." value={data.exam.bp} onChange={(v) => set("exam.bp", v)} suffix="mm/Hg" placeholder="120/80" highlightId="exam.bp" />
              <TextField label="TVS" value={data.exam.tvs} onChange={(v) => set("exam.tvs", v)} highlightId="exam.tvs" />
              <TextField label="TVS — Uterus" value={data.exam.tvsUterus} onChange={(v) => set("exam.tvsUterus", v)} highlightId="exam.tvsUterus" />
              <TextField label="TVS — Endometrium" value={data.exam.tvsEndometrium} onChange={(v) => set("exam.tvsEndometrium", v)} highlightId="exam.tvsEndometrium" />
              <TextField label="TVS — Cavity" value={data.exam.tvsCavity} onChange={(v) => set("exam.tvsCavity", v)} highlightId="exam.tvsCavity" />
              <TextField label="TVS — Right Ovary" value={data.exam.tvsRightOvary} onChange={(v) => set("exam.tvsRightOvary", v)} highlightId="exam.tvsRightOvary" />
              <TextField label="TVS — Left Ovary" value={data.exam.tvsLeftOvary} onChange={(v) => set("exam.tvsLeftOvary", v)} highlightId="exam.tvsLeftOvary" />
              <TextField label="R.S." value={data.exam.rs} onChange={(v) => set("exam.rs", v)} highlightId="exam.rs" />
              <TextField label="C.V.S." value={data.exam.cvs} onChange={(v) => set("exam.cvs", v)} highlightId="exam.cvs" />
            </div>
          </div>
          <div>
            <SectionTitle icon={TestTube2} sub="Wife">Investigations</SectionTitle>
            <div className="grid sm:grid-cols-4 gap-4">
              <TextField label="Hb" value={data.invest.hb} onChange={(v) => set("invest.hb", v)} highlightId="invest.hb" />
              <TextField label="Urine" value={data.invest.urine} onChange={(v) => set("invest.urine", v)} highlightId="invest.urine" />
              <TextField label="ESR" value={data.invest.esr} onChange={(v) => set("invest.esr", v)} highlightId="invest.esr" />
              <TextField label="Bl. Group" value={data.invest.blGroup} onChange={(v) => set("invest.blGroup", v)} highlightId="invest.blGroup" />
              <div className="col-span-full -mb-1 mt-1">
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkFaint }}>BSL</p>
              </div>
              <TextField label="Fasting Sugar (mg/dL)" value={data.invest.bslFasting} onChange={(v) => set("invest.bslFasting", v)} highlightId="invest.bslFasting" />
              <TextField label="PP Sugar (mg/dL)" value={data.invest.bslPP} onChange={(v) => set("invest.bslPP", v)} highlightId="invest.bslPP" />
              <TextField label="Random Sugar (mg/dL)" value={data.invest.bslRandom} onChange={(v) => set("invest.bslRandom", v)} highlightId="invest.bslRandom" />
              <TextField label="VDRL" value={data.invest.vdrl} onChange={(v) => set("invest.vdrl", v)} highlightId="invest.vdrl" />
              <TextField label="HIV" value={data.invest.hiv} onChange={(v) => set("invest.hiv", v)} highlightId="invest.hiv" />
              <TextField label="HBs Ag" value={data.invest.hbsAg} onChange={(v) => set("invest.hbsAg", v)} highlightId="invest.hbsAg" />
              <TextField label="Sr. Creatinine" value={data.invest.srCreatinine} onChange={(v) => set("invest.srCreatinine", v)} highlightId="invest.srCreatinine" />
              <TextField label="Sr. Insulin" value={data.invest.srInsulin} onChange={(v) => setWifeHoma("srInsulin", v)} highlightId="invest.srInsulin" />
              <TextField label="Fasting Glucose (for HOMA-IR)" value={data.invest.homaGlucose} onChange={(v) => setWifeHoma("homaGlucose", v)} highlightId="invest.homaGlucose" />
              <HomaIRField value={data.invest.homaIR} />
              <TextField label="Rubella" value={data.invest.rubella} onChange={(v) => set("invest.rubella", v)} highlightId="invest.rubella" />
              <TextField label="Pap Smear" value={data.invest.papSmear} onChange={(v) => set("invest.papSmear", v)} highlightId="invest.papSmear" />
              <TextField label="APLA" value={data.invest.apla} onChange={(v) => set("invest.apla", v)} highlightId="invest.apla" />
              <TextField label="Misc." value={data.invest.misc} onChange={(v) => set("invest.misc", v)} highlightId="invest.misc" />
            </div>
          </div>
        </Card>
      )}

      {tab === "imaging" && (
        <Card className="p-5 flex flex-col gap-6">
          <div>
            <div className="flex items-center justify-between mb-3">
              <SectionTitle icon={FlaskConical} sub="Blood / hormone reports — as on the OPD chart">Hormone Assays</SectionTitle>
              {data.hormonePanels.length < MAX_HORMONE_PANELS && (
                <Btn size="sm" variant="subtle" icon={Plus} onClick={addHormonePanel}>Add Table</Btn>
              )}
            </div>
            <div className="flex flex-col gap-4">
              {data.hormonePanels.map((entry, i) => (
                <HormoneTable key={entry.id} title={`Hormone Assays — Table ${i + 1}`} panel={entry.panel} editable
                  onChange={(k, f, v) => updHormonePanel(entry.id, k, f, v)}
                  onRemove={data.hormonePanels.length > 1 ? () => removeHormonePanel(entry.id) : undefined} />
              ))}
            </div>
          </div>
          <div>
            <SectionTitle sub="Imaging & procedures">Laparoscopy · HSG · Hysteroscopy · PCR · CBNAAT</SectionTitle>
            <div className="grid sm:grid-cols-2 gap-4">
              <TextField label="Laparoscopy Date" type="date" value={data.laparoscopy.date} onChange={(v) => set("laparoscopy.date", v)} highlightId="laparoscopy.date" />
              <TextField label="Laparoscopy Findings" value={data.laparoscopy.findings} onChange={(v) => set("laparoscopy.findings", v)} highlightId="laparoscopy.findings" />
              <TextField label="HSG Date" type="date" value={data.hsg.date} onChange={(v) => set("hsg.date", v)} highlightId="hsg.date" />
              <TextField label="HSG Findings" value={data.hsg.findings} onChange={(v) => set("hsg.findings", v)} highlightId="hsg.findings" />
              <TextField label="Hysteroscopy Date" type="date" value={data.hysteroscopy.date} onChange={(v) => set("hysteroscopy.date", v)} highlightId="hysteroscopy.date" />
              <TextField label="Hysteroscopy Findings" value={data.hysteroscopy.findings} onChange={(v) => set("hysteroscopy.findings", v)} highlightId="hysteroscopy.findings" />
              <TextField label="PCR Date" type="date" value={data.pcr.date} onChange={(v) => set("pcr.date", v)} highlightId="pcr.date" />
              <TextField label="PCR Result" value={data.pcr.result} onChange={(v) => set("pcr.result", v)} highlightId="pcr.result" />
              <TextField label="CBNAAT Date" type="date" value={data.cbnaat.date} onChange={(v) => set("cbnaat.date", v)} highlightId="cbnaat.date" />
              <TextField label="CBNAAT Result" value={data.cbnaat.result} onChange={(v) => set("cbnaat.result", v)} highlightId="cbnaat.result" />
            </div>
          </div>
        </Card>
      )}

      {tab === "husband" && (
        <Card className="p-5 flex flex-col gap-6">
          <div className="grid sm:grid-cols-2 gap-4">
            <TextAreaField label="Habits & Past History" value={data.husband.habitsHistory} onChange={(v) => set("husband.habitsHistory", v)} highlightId="husband.habitsHistory" />
            <TextAreaField label="Genital Examination" value={data.husband.genitalExam} onChange={(v) => set("husband.genitalExam", v)} highlightId="husband.genitalExam" />
            <TextAreaField label="Miscellaneous Investigations" value={data.husband.miscInvestigations} onChange={(v) => set("husband.miscInvestigations", v)} full highlightId="husband.miscInvestigations" />
          </div>
          <div>
            <SectionTitle icon={TestTube2} sub="Husband — same panel as Wife, minus Rubella / Pap Smear / APLA">Investigations</SectionTitle>
            <div className="grid sm:grid-cols-4 gap-4">
              <TextField label="Hb" value={data.husband.invest.hb} onChange={(v) => set("husband.invest.hb", v)} highlightId="husband.invest.hb" />
              <TextField label="Urine" value={data.husband.invest.urine} onChange={(v) => set("husband.invest.urine", v)} highlightId="husband.invest.urine" />
              <TextField label="ESR" value={data.husband.invest.esr} onChange={(v) => set("husband.invest.esr", v)} highlightId="husband.invest.esr" />
              <TextField label="Bl. Group" value={data.husband.invest.blGroup} onChange={(v) => set("husband.invest.blGroup", v)} highlightId="husband.invest.blGroup" />
              <div className="col-span-full -mb-1 mt-1">
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.inkFaint }}>BSL</p>
              </div>
              <TextField label="Fasting Sugar (mg/dL)" value={data.husband.invest.bslFasting} onChange={(v) => set("husband.invest.bslFasting", v)} highlightId="husband.invest.bslFasting" />
              <TextField label="PP Sugar (mg/dL)" value={data.husband.invest.bslPP} onChange={(v) => set("husband.invest.bslPP", v)} highlightId="husband.invest.bslPP" />
              <TextField label="Random Sugar (mg/dL)" value={data.husband.invest.bslRandom} onChange={(v) => set("husband.invest.bslRandom", v)} highlightId="husband.invest.bslRandom" />
              <TextField label="VDRL" value={data.husband.invest.vdrl} onChange={(v) => set("husband.invest.vdrl", v)} highlightId="husband.invest.vdrl" />
              <TextField label="HIV" value={data.husband.invest.hiv} onChange={(v) => set("husband.invest.hiv", v)} highlightId="husband.invest.hiv" />
              <TextField label="HBs Ag" value={data.husband.invest.hbsAg} onChange={(v) => set("husband.invest.hbsAg", v)} highlightId="husband.invest.hbsAg" />
              <TextField label="Sr. Creatinine" value={data.husband.invest.srCreatinine} onChange={(v) => set("husband.invest.srCreatinine", v)} highlightId="husband.invest.srCreatinine" />
              <TextField label="Sr. Insulin" value={data.husband.invest.srInsulin} onChange={(v) => setHusbandHoma("srInsulin", v)} highlightId="husband.invest.srInsulin" />
              <TextField label="Fasting Glucose (for HOMA-IR)" value={data.husband.invest.homaGlucose} onChange={(v) => setHusbandHoma("homaGlucose", v)} highlightId="husband.invest.homaGlucose" />
              <HomaIRField value={data.husband.invest.homaIR} />
              <TextField label="Misc." value={data.husband.invest.misc} onChange={(v) => set("husband.invest.misc", v)} highlightId="husband.invest.misc" />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-3">
              <SectionTitle icon={TestTube2} sub="Andrology reports">Semen Analysis</SectionTitle>
              <Btn size="sm" variant="subtle" icon={Plus} onClick={addSemenRow}>Add Report</Btn>
            </div>
            {data.husband.semenAnalysis.length === 0 && <p className="text-sm" style={{ color: C.inkFaint }}>No semen analysis reports added yet.</p>}
            <div className="overflow-x-auto emr-scroll">
              {data.husband.semenAnalysis.length > 0 && (
                <table className="w-full text-sm">
                  <thead><tr className="text-left" style={{ color: C.inkFaint }}>
                    <th className="pb-1 font-medium text-xs">Date</th><th className="pb-1 font-medium text-xs">Lab</th>
                    <th className="pb-1 font-medium text-xs">Count</th><th className="pb-1 font-medium text-xs">Motility</th>
                    <th className="pb-1 font-medium text-xs">Pus Cells</th><th></th>
                  </tr></thead>
                  <tbody>
                    {data.husband.semenAnalysis.map((r) => (
                      <tr key={r.id}>
                        <td className="py-1 pr-2"><div className="flex items-center gap-1"><input type="date" value={r.date} onChange={(e) => updSemenRow(r.id, "date", e.target.value)} className="text-xs rounded px-2 py-1 outline-none" style={{ border: `1px solid ${C.border}` }} /><HighlightDots id={`semen.${r.id}.date`} /></div></td>
                        <td className="py-1 pr-2"><div className="flex items-center gap-1"><input value={r.lab} onChange={(e) => updSemenRow(r.id, "lab", e.target.value)} className="text-xs rounded px-2 py-1 outline-none w-24" style={{ border: `1px solid ${C.border}` }} /><HighlightDots id={`semen.${r.id}.lab`} /></div></td>
                        <td className="py-1 pr-2"><div className="flex items-center gap-1"><input value={r.count} onChange={(e) => updSemenRow(r.id, "count", e.target.value)} className="text-xs rounded px-2 py-1 outline-none w-24" style={{ border: `1px solid ${C.border}` }} /><HighlightDots id={`semen.${r.id}.count`} /></div></td>
                        <td className="py-1 pr-2"><div className="flex items-center gap-1"><input value={r.motility} onChange={(e) => updSemenRow(r.id, "motility", e.target.value)} className="text-xs rounded px-2 py-1 outline-none w-24" style={{ border: `1px solid ${C.border}` }} /><HighlightDots id={`semen.${r.id}.motility`} /></div></td>
                        <td className="py-1 pr-2"><div className="flex items-center gap-1"><input value={r.pusCells} onChange={(e) => updSemenRow(r.id, "pusCells", e.target.value)} className="text-xs rounded px-2 py-1 outline-none w-24" style={{ border: `1px solid ${C.border}` }} /><HighlightDots id={`semen.${r.id}.pusCells`} /></div></td>
                        <td><button onClick={() => rmSemenRow(r.id)}><Trash2 size={13} style={{ color: C.inkFaint }} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </Card>
      )}

      {tab === "plan" && (
        <Card className="p-5 flex flex-col gap-5">
          <div>
            <SectionTitle icon={ClipboardList}>Diagnosis & Plan of Management</SectionTitle>
            <div className="grid sm:grid-cols-2 gap-4">
              <TextAreaField label="Diagnosis" value={data.diagnosis} onChange={(v) => set("diagnosis", v)} full rows={3} highlightId="diagnosis" />
              <TextAreaField label="Plan of Management" value={data.planOfManagement} onChange={(v) => set("planOfManagement", v)} full rows={3} highlightId="planOfManagement" />
              <SelectField label="Treatment Suggested" value={data.treatmentType} onChange={(v) => set("treatmentType", v)} options={["Optimization", "IUI", "IVF", "Other"]} highlightId="treatmentType" />
              <SelectField label="Status" value={data.status} onChange={(v) => set("status", v)} options={["Active", "Follow-up", "Completed", "Discontinued"]} highlightId="status" />
              <TextField label="Next Follow-up Date" type="date" value={data.nextFollowUp} onChange={(v) => set("nextFollowUp", v)} highlightId="nextFollowUp" />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <SectionTitle icon={CalendarClock} sub="OPD monitoring chart, as printed on the paper form">Cycle Monitoring</SectionTitle>
              {data.cycles.length < MAX_CYCLES && (
                <Btn size="sm" variant="subtle" icon={Plus} onClick={addCycle}>Add Cycle</Btn>
              )}
            </div>
            <div className="flex flex-col gap-4">
              {data.cycles.map((c, i) => (
                <CycleTable key={c.id} label={`Cycle No. ${i + 1}`} cycle={c} editable
                  onDateChange={(v) => setCycleDate(c.id, v)} onAddRow={() => addCycleRow(c.id)}
                  onRemoveRow={(id) => rmCycleRow(c.id, id)} onUpdateRow={(id, f, v) => updCycleRow(c.id, id, f, v)}
                  onRemoveCycle={data.cycles.length > 1 ? () => removeCycle(c.id) : undefined} />
              ))}
            </div>
          </div>
        </Card>
      )}

      <div className="flex gap-3 justify-end pb-6">
        <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
        <Btn icon={Save} onClick={() => onSave(data)}>Save Patient</Btn>
      </div>
    </div>
    </HighlightContext.Provider>
  );
}

/* ---------------------------------------------------------------------
   Patient Detail
--------------------------------------------------------------------- */
function PatientDetail({ patient, prescriptions, cycles, onBack, onEdit, onAddPrescription, onUpdatePrescription, onDeletePrescription, onAddCycle, onAddMonitoring, onAddSemen, onAddFile, onRemoveFile, onSaveHighlights }) {
  const [tab, setTab] = useState("overview");
  const [rxOpen, setRxOpen] = useState(false);
  const [editRxId, setEditRxId] = useState(null);
  const [viewRxId, setViewRxId] = useState(null);
  const [printRxId, setPrintRxId] = useState(null);
  const [cycleOpen, setCycleOpen] = useState(false);
  const [monOpen, setMonOpen] = useState(null);
  const [fileBusy, setFileBusy] = useState(false);
  const [fileError, setFileError] = useState("");
  const [pendingHighlights, setPendingHighlights] = useState(patient.highlights || {});

  // Highlights are toggled locally (from Overview or Reports) and only
  // written back on "Save Highlights" — resync only when navigating to a
  // different patient, so an unrelated patient update elsewhere (a new
  // file, a semen report) never clobbers unsaved toggles.
  useEffect(() => { setPendingHighlights(patient.highlights || {}); }, [patient.id]);
  const toggleHighlight = (id, color) => setPendingHighlights((prev) => {
    const next = { ...prev };
    if (color) next[id] = color; else delete next[id];
    return next;
  });
  const highlightsDirty = !_.isEqual(pendingHighlights, patient.highlights || {});
  const highlightedItems = useMemo(
    () => highlightableFields(patient)
      .filter((f) => pendingHighlights[f.id] && f.value)
      .map((f) => ({ ...f, color: pendingHighlights[f.id] })),
    [patient, pendingHighlights]
  );

  // Printing a single prescription (see the hidden .print-only block below)
  // needs its content committed to the DOM before window.print() reads the
  // page, and needs to clear itself once the print dialog closes so the
  // next print (of a different prescription) doesn't inherit stale state.
  useEffect(() => {
    const reset = () => setPrintRxId(null);
    window.addEventListener("afterprint", reset);
    return () => window.removeEventListener("afterprint", reset);
  }, []);
  const printRx = (id) => { setPrintRxId(id); requestAnimationFrame(() => window.print()); };
  const confirmDeleteRx = (id) => {
    if (window.confirm("Delete this prescription? This cannot be undone.")) onDeletePrescription(id);
  };

  const pRx = prescriptions.filter((r) => r.patientId === patient.id);
  const pCycles = cycles.filter((c) => c.patientId === patient.id);
  const patientFiles = patient.files || [];

  // Any drug name a doctor has ever typed into "Other" on this or any other
  // patient's prescription is folded back into the dropdown here, so it
  // only needs to be typed once — no separate "custom drugs" list to store.
  const drugOptions = useMemo(
    () => _.uniq([...DRUG_OPTIONS, ..._.flatMap(prescriptions, (rx) => (rx.medicines || []).map((m) => m.name))].filter(Boolean).map((s) => s.toUpperCase())),
    [prescriptions]
  );

  return (
    <HighlightContext.Provider value={{ highlights: pendingHighlights, onToggle: toggleHighlight }}>
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3 no-print">
        <button onClick={onBack}><ArrowLeft size={18} style={{ color: C.inkMuted }} /></button>
        {patient.photoW && (
          <img src={patient.photoW} alt="Wife" title="Wife" className="rounded-full object-cover shrink-0" style={{ width: 40, height: 40, border: `1px solid ${C.border}` }} />
        )}
        {patient.photoH && (
          <img src={patient.photoH} alt="Husband" title="Husband" className="rounded-full object-cover shrink-0" style={{ width: 40, height: 40, border: `1px solid ${C.border}` }} />
        )}
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl" style={FONT_DISPLAY}>{patient.patientName || "Unnamed"}</h1>
            <Badge tone={treatmentTone(patient.treatmentType)}>{patient.treatmentType}</Badge>
            <Badge tone={statusTone(patient.status)}>{patient.status}</Badge>
          </div>
          <p className="text-sm" style={{ color: C.inkMuted }}>File No. {patient.fileNo || "—"} · Age {patient.ageW || "—"}/{patient.ageH || "—"} · {patient.typeInfertility || "Infertility type not set"}</p>
        </div>
        {highlightsDirty && (
          <Btn variant="subtle" icon={Save} onClick={() => onSaveHighlights(patient.id, pendingHighlights)}>Save Highlights</Btn>
        )}
        <Btn variant="ghost" icon={Pencil} onClick={onEdit}>Edit</Btn>
      </div>

      {highlightedItems.length > 0 && (
        <Card className="p-4" style={{ background: C.brickTint, border: `1px solid ${C.brick}` }}>
          <div className="flex items-center gap-2 mb-2">
            <Star size={15} style={{ color: C.brick }} fill={C.brick} />
            <p className="text-sm font-semibold" style={{ color: C.primaryDark }}>Highlighted for Next Visit</p>
          </div>
          <ul className="text-sm flex flex-col gap-1">
            {highlightedItems.map((f) => (
              <li key={f.id} style={{ color: C.brick, fontWeight: 600 }}>• <strong>{f.label}:</strong> {f.value}</li>
            ))}
          </ul>
        </Card>
      )}

      <div className="flex gap-1 overflow-x-auto emr-scroll border-b no-print" style={{ borderColor: C.border }}>
        {[["overview", "Overview"], ["reports", "Reports"], ["prescriptions", "Prescriptions"], ["cycles", "IUI / IVF Cycles"], ["files", "Files"]].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className="px-4 py-2.5 text-sm font-medium whitespace-nowrap"
            style={{ color: tab === k ? C.primary : C.inkFaint, borderBottom: tab === k ? `2px solid ${C.primary}` : "2px solid transparent" }}>
            {label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="flex flex-col gap-5">
          <div className="flex justify-end no-print">
            <Btn size="sm" variant="ghost" icon={Printer} onClick={() => window.print()}>Print</Btn>
          </div>
          <Letterhead patient={patient} />
          <div className="grid lg:grid-cols-2 gap-5">
          <Card className="p-5">
            <SectionTitle icon={ClipboardList}>Registration & History</SectionTitle>
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              <HighlightRow label="Ref. Doctor" value={patient.refDoctor} highlightId="refDoctor" />
              <Fragment><dt style={{ color: C.inkFaint }}>Reg. Date</dt><dd style={{ color: C.ink }}>{fmtDate(patient.regDate) || "—"}</dd></Fragment>
              <HighlightRow label="Address" value={patient.address} highlightId="address" />
              <HighlightRow label="Phone (W)" value={patient.phoneW} highlightId="phoneW" />
              <HighlightRow label="Phone (H)" value={patient.phoneH} highlightId="phoneH" />
              <HighlightRow label="Age (W)" value={patient.ageW} highlightId="ageW" />
              <HighlightRow label="Age (H)" value={patient.ageH} highlightId="ageH" />
              <HighlightRow label="Education (W)" value={patient.eduW} highlightId="eduW" />
              <HighlightRow label="Education (H)" value={patient.eduH} highlightId="eduH" />
              <HighlightRow label="Occupation (W)" value={patient.occW} highlightId="occW" />
              <HighlightRow label="Occupation (H)" value={patient.occH} highlightId="occH" />
              <HighlightRow label="Aadhaar (W)" value={patient.aadhaarW} highlightId="aadhaarW" />
              <HighlightRow label="Aadhaar (H)" value={patient.aadhaarH} highlightId="aadhaarH" />
              <HighlightRow label="Married Since" value={patient.marriedSince} highlightId="marriedSince" />
              <HighlightRow label="Type of Infertility" value={patient.typeInfertility} highlightId="typeInfertility" />
              <HighlightRow label="Menstrual History" value={patient.menstrualHistory} highlightId="menstrualHistory" />
              <HighlightRow label="LMP" value={fmtDate(patient.lmp)} highlightId="lmp" />
              <HighlightRow label="Obstetric History" value={patient.obstetricHistory} highlightId="obstetricHistory" />
              <HighlightRow label="Past/Family History" value={patient.pastFamilyHistory} highlightId="pastFamilyHistory" />
            </dl>
          </Card>
          <Card className="p-5">
            <SectionTitle icon={Stethoscope}>Examination (Wife)</SectionTitle>
            <dl className="grid grid-cols-2 gap-y-2 text-sm mb-4">
              {EXAM_FIELDS.map(([k, label]) => (
                <HighlightRow key={k} label={label} value={patient.exam[k]} highlightId={`exam.${k}`} />
              ))}
            </dl>
            <SectionTitle icon={TestTube2}>Investigations (Wife)</SectionTitle>
            <dl className="grid grid-cols-2 gap-y-2 text-sm mb-4">
              {INVEST_FIELDS.map(([k, label]) => (
                <HighlightRow key={k} label={label} value={patient.invest[k]} highlightId={`invest.${k}`} />
              ))}
            </dl>
            <SectionTitle icon={TestTube2} sub="Husband">Investigations (Husband)</SectionTitle>
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              {INVEST_FIELDS_HUSBAND.map(([k, label]) => (
                <HighlightRow key={k} label={label} value={patient.husband.invest[k]} highlightId={`husband.invest.${k}`} />
              ))}
            </dl>
          </Card>
          <Card className="p-5 lg:col-span-2">
            <SectionTitle icon={ClipboardList}>Diagnosis & Plan</SectionTitle>
            <div className="grid sm:grid-cols-2 gap-4 text-sm mb-5">
              <div>
                <HighlightRow label="Diagnosis" value={patient.diagnosis} highlightId="diagnosis" />
              </div>
              <div>
                <HighlightRow label="Plan of Management" value={patient.planOfManagement} highlightId="planOfManagement" />
              </div>
              <div><p className="text-xs mb-1" style={{ color: C.inkFaint }}>Next Follow-up</p><p style={{ color: C.ink }}>{fmtDate(patient.nextFollowUp)}</p></div>
            </div>
            <SectionTitle icon={CalendarClock} sub="OPD monitoring chart">Cycle Monitoring</SectionTitle>
            <div className="flex flex-col gap-4">
              {patient.cycles.map((c, i) => (
                <CycleTable key={c.id} label={`Cycle No. ${i + 1}`} cycle={c} />
              ))}
            </div>
          </Card>
          </div>
        </div>
      )}

      {tab === "reports" && (
        <div className="flex flex-col gap-5">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <SectionTitle icon={FlaskConical} sub="Blood / hormone reports — as on the OPD chart">Hormone Assays</SectionTitle>
              <Btn size="sm" variant="ghost" icon={Pencil} onClick={onEdit}>Edit Reports</Btn>
            </div>
            <div className="flex flex-col gap-4">
              {patient.hormonePanels.map((entry, i) => (
                <HormoneTable key={entry.id} title={`Hormone Assays — Table ${i + 1}`} panel={entry.panel} />
              ))}
            </div>
          </Card>
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <SectionTitle icon={TestTube2} sub="Andrology reports">Semen Analysis (Husband)</SectionTitle>
              <Btn size="sm" variant="subtle" icon={Plus} onClick={() => onAddSemen(patient.id)}>Add Report</Btn>
            </div>
            <div className="overflow-x-auto emr-scroll">
              <table className="w-full text-sm">
                <thead><tr className="text-left" style={{ color: C.inkFaint }}>
                  <th className="pb-2 font-medium">Date</th><th className="pb-2 font-medium">Lab</th><th className="pb-2 font-medium">Count</th>
                  <th className="pb-2 font-medium">Motility</th><th className="pb-2 font-medium">Pus Cells</th>
                </tr></thead>
                <tbody>
                  {patient.husband.semenAnalysis.map((r) => (
                    <tr key={r.id} style={{ borderTop: `1px solid ${C.borderSoft}` }}>
                      {[["date", fmtDate(r.date)], ["lab", r.lab], ["count", r.count], ["motility", r.motility], ["pusCells", r.pusCells]].map(([key, val]) => {
                        const hid = `semen.${r.id}.${key}`;
                        const h = pendingHighlights[hid];
                        return (
                          <td key={key} className="py-2">
                            <span className="inline-flex items-center gap-1.5" style={{ color: h ? C.brick : C.ink, fontWeight: h ? 600 : 400 }}>
                              <span>{val || "—"}</span>
                              <HighlightDots id={hid} />
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  {patient.husband.semenAnalysis.length === 0 && <tr><td colSpan={5} className="py-4 text-center" style={{ color: C.inkFaint }}>No reports yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
          <Card className="p-5">
            <SectionTitle sub="Procedures">Laparoscopy · HSG · Hysteroscopy · PCR · CBNAAT</SectionTitle>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
              {[["Laparoscopy", patient.laparoscopy, "findings", "laparoscopy.findings"], ["HSG", patient.hsg, "findings", "hsg.findings"], ["Hysteroscopy", patient.hysteroscopy, "findings", "hysteroscopy.findings"],
              ["PCR", patient.pcr, "result", "pcr.result"], ["CBNAAT", patient.cbnaat, "result", "cbnaat.result"]].map(([l, v, key, hid]) => {
                const h = pendingHighlights[hid];
                return (
                  <div key={l}>
                    <p className="text-xs mb-1 flex items-center gap-1.5" style={{ color: C.inkFaint }}>{l}<HighlightDots id={hid} /></p>
                    <p style={{ color: h ? C.brick : C.ink, fontWeight: h ? 600 : 400 }}>{fmtDate(v.date)} — {v[key] || "—"}</p>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {tab === "prescriptions" && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3 no-print">
            <SectionTitle icon={Pill}>Prescriptions</SectionTitle>
            <Btn size="sm" icon={Plus} onClick={() => setRxOpen(true)}>New Prescription</Btn>
          </div>
          <div className="flex flex-col gap-3 no-print">
            {_.orderBy(pRx, ["date"], ["desc"]).map((rx) => (
              <div key={rx.id} className="rounded-xl p-4" style={{ background: C.slateTint }}>
                <div className="flex justify-between items-center mb-2">
                  <div>
                    <p className="text-sm font-semibold" style={{ color: C.ink }}>{fmtDate(rx.date)}</p>
                    <p className="text-xs" style={{ color: C.inkFaint }}>{rx.doctor}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button type="button" title="View" onClick={() => setViewRxId(rx.id)}><Eye size={15} style={{ color: C.inkFaint }} /></button>
                    <button type="button" title="Edit" onClick={() => setEditRxId(rx.id)}><Pencil size={15} style={{ color: C.inkFaint }} /></button>
                    <button type="button" title="Delete" onClick={() => confirmDeleteRx(rx.id)}><Trash2 size={15} style={{ color: C.inkFaint }} /></button>
                  </div>
                </div>
                <ul className="text-sm flex flex-col gap-1.5">
                  {groupMedicines(rx.medicines).map((g, gi) => (
                    <li key={gi} style={{ color: C.ink }}>
                      • <strong>{g.name}</strong>
                      {g.doses.length === 1 ? (
                        <> — {g.doses[0].dosage}, {g.doses[0].frequency}{g.doses[0].duration ? `, ${g.doses[0].duration}` : ""} {g.doses[0].instructions && <span style={{ color: C.inkFaint }}>({g.doses[0].instructions})</span>}</>
                      ) : (
                        <ul className="mt-0.5" style={{ paddingLeft: 16 }}>
                          {g.doses.map((d) => (
                            <li key={d.id}>– {d.dosage}, {d.frequency}{d.duration ? `, ${d.duration}` : ""} {d.instructions && <span style={{ color: C.inkFaint }}>({d.instructions})</span>}</li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
                {rx.advice && <p className="text-xs mt-2" style={{ color: C.inkMuted }}>Advice: {rx.advice}</p>}
              </div>
            ))}
            {pRx.length === 0 && <p className="text-sm" style={{ color: C.inkFaint }}>No prescriptions recorded yet.</p>}
          </div>

          {rxOpen && <PrescriptionModal drugOptions={drugOptions} onClose={() => setRxOpen(false)} onSave={(rx) => { onAddPrescription(patient.id, rx); setRxOpen(false); }} />}
          {editRxId && (
            <PrescriptionModal
              drugOptions={drugOptions}
              initial={pRx.find((r) => r.id === editRxId)}
              onClose={() => setEditRxId(null)}
              onSave={(rx) => { onUpdatePrescription({ ...rx, patientId: patient.id }); setEditRxId(null); }}
            />
          )}
          {viewRxId && (() => {
            const rx = pRx.find((r) => r.id === viewRxId);
            if (!rx) return null;
            return (
              <ModalShell title={`Prescription — ${fmtDate(rx.date)}`} onClose={() => setViewRxId(null)} wide>
                <PrescriptionView rx={rx} />
                <div className="flex justify-end gap-2 mt-5">
                  <Btn variant="ghost" icon={Printer} onClick={() => printRx(rx.id)}>Print</Btn>
                  <Btn variant="ghost" onClick={() => setViewRxId(null)}>Close</Btn>
                </div>
              </ModalShell>
            );
          })()}
          {printRxId && (() => {
            const rx = pRx.find((r) => r.id === printRxId);
            if (!rx) return null;
            return (
              <div className="print-only">
                <Letterhead patient={patient} />
                <PrescriptionView rx={rx} />
              </div>
            );
          })()}
        </Card>
      )}

      {tab === "cycles" && (
        <div className="flex flex-col gap-5">
          <div className="flex justify-end">
            <Btn size="sm" icon={Plus} onClick={() => setCycleOpen(true)}>New Cycle</Btn>
          </div>
          {_.orderBy(pCycles, ["startDate"], ["desc"]).map((c) => (
            <Card key={c.id} className="p-5">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Badge tone={treatmentTone(c.type)}>{c.type}</Badge>
                  <p className="text-sm font-semibold" style={{ color: C.ink }}>Cycle {c.cycleNo} · started {fmtDate(c.startDate)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={c.outcome === "Positive" ? "green" : c.outcome === "Negative" ? "brick" : "slate"}>{c.outcome}</Badge>
                  <Btn size="sm" variant="subtle" icon={Plus} onClick={() => setMonOpen(c.id)}>Add Monitoring</Btn>
                </div>
              </div>
              <div className="overflow-x-auto emr-scroll">
                <table className="w-full text-sm">
                  <thead><tr className="text-left" style={{ color: C.inkFaint }}>
                    <th className="pb-2 font-medium">Date</th><th className="pb-2 font-medium">Day</th><th className="pb-2 font-medium">E2</th>
                    <th className="pb-2 font-medium">Endometrium</th><th className="pb-2 font-medium">Rt. Ov.</th><th className="pb-2 font-medium">Lt. Ov.</th><th className="pb-2 font-medium">Advice</th>
                  </tr></thead>
                  <tbody>
                    {c.monitoring.map((m) => (
                      <tr key={m.id} style={{ borderTop: `1px solid ${C.borderSoft}` }}>
                        <td className="py-2">{fmtDate(m.date)}</td><td className="py-2">{m.day || "—"}</td><td className="py-2">{m.e2 || "—"}</td>
                        <td className="py-2">{m.endo || "—"}</td><td className="py-2">{m.rtOv || "—"}</td><td className="py-2">{m.ltOv || "—"}</td><td className="py-2">{m.adv || "—"}</td>
                      </tr>
                    ))}
                    {c.monitoring.length === 0 && <tr><td colSpan={7} className="py-3 text-center" style={{ color: C.inkFaint }}>No monitoring entries yet.</td></tr>}
                  </tbody>
                </table>
              </div>
              {monOpen === c.id && <MonitoringModal onClose={() => setMonOpen(null)} onSave={(entry) => { onAddMonitoring(patient.id, c.id, entry); setMonOpen(null); }} />}
            </Card>
          ))}
          {pCycles.length === 0 && <Card className="p-8 text-center"><p className="text-sm" style={{ color: C.inkFaint }}>No IUI/IVF cycles recorded yet.</p></Card>}
          {cycleOpen && <CycleModal onClose={() => setCycleOpen(false)} onSave={(c) => { onAddCycle(patient.id, c); setCycleOpen(false); }} nextCycleNo={pCycles.length + 1} />}
        </div>
      )}

      {tab === "files" && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <SectionTitle icon={FileText} sub={`${patientFiles.length}/${MAX_FILES} uploaded — Word, Excel, JPG, PNG or PDF`}>Patient Files</SectionTitle>
          </div>
          <div className="flex flex-col gap-2 mb-4">
            {patientFiles.map((f) => (
              <div key={f.id} className="flex items-center justify-between gap-3 rounded-xl p-3" style={{ background: C.slateTint }}>
                <a href={f.dataUrl} download={f.name} className="flex items-center gap-2 text-sm min-w-0" style={{ color: C.ink }}>
                  <FileText size={16} style={{ color: C.inkFaint, flexShrink: 0 }} />
                  <span className="truncate">{f.name}</span>
                </a>
                <button type="button" onClick={() => onRemoveFile(patient.id, f.id)}><Trash2 size={14} style={{ color: C.inkFaint }} /></button>
              </div>
            ))}
            {patientFiles.length === 0 && <p className="text-sm" style={{ color: C.inkFaint }}>No files uploaded yet.</p>}
          </div>
          {patientFiles.length < MAX_FILES && (
            <>
              <label htmlFor="patient-file-input" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer w-fit"
                style={{ background: C.primaryTint, color: C.primaryDark }}>
                <Upload size={13} /> {fileBusy ? "Uploading…" : "Add File"}
              </label>
              <input
                id="patient-file-input"
                type="file"
                accept={FILE_ACCEPT}
                className="hidden"
                disabled={fileBusy}
                onChange={async (e) => {
                  const file = e.target.files && e.target.files[0];
                  e.target.value = "";
                  if (!file) return;
                  setFileError("");
                  if (file.size > MAX_FILE_SIZE) { setFileError("File is larger than 5MB — please choose a smaller file."); return; }
                  setFileBusy(true);
                  try {
                    const dataUrl = await readFileAsDataURL(file);
                    await onAddFile(patient.id, { id: uid(), name: file.name, type: file.type, size: file.size, dataUrl, uploadedAt: new Date().toISOString() });
                  } finally {
                    setFileBusy(false);
                  }
                }}
              />
              {fileError && <p className="text-xs mt-2 flex items-center gap-1" style={{ color: C.brick }}><AlertCircle size={13} />{fileError}</p>}
            </>
          )}
        </Card>
      )}
    </div>
    </HighlightContext.Provider>
  );
}

/* ---------------------------------------------------------------------
   Modals
--------------------------------------------------------------------- */
function ModalShell({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 no-print" style={{ background: "rgba(20,30,27,0.45)" }}>
      <div className={"rounded-2xl p-6 w-full emr-fade max-h-[90vh] overflow-y-auto emr-scroll " + (wide ? "max-w-2xl" : "max-w-md")} style={{ background: "#fff" }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold" style={{ color: C.ink }}>{title}</h3>
          <button onClick={onClose}><X size={18} style={{ color: C.inkFaint }} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function PrescriptionModal({ onClose, onSave, drugOptions = DRUG_OPTIONS, initial }) {
  const [date, setDate] = useState(initial?.date || todayISO());
  const [doctor, setDoctor] = useState(initial?.doctor || "");
  const [advice, setAdvice] = useState(initial?.advice || "");
  const [meds, setMeds] = useState(
    initial?.medicines?.length ? initial.medicines.map((m) => ({ ...m })) : [{ id: uid(), name: "", dosage: "", frequency: "", duration: "", instructions: "" }]
  );
  const addMed = () => setMeds([...meds, { id: uid(), name: "", dosage: "", frequency: "", duration: "", instructions: "" }]);
  const updMed = (id, k, v) => setMeds(meds.map((m) => m.id === id ? { ...m, [k]: v } : m));
  const rmMed = (id) => setMeds(meds.filter((m) => m.id !== id));
  // Same drug, another dose/duration (e.g. a tapering schedule) — carries
  // the drug name over so the doctor doesn't have to pick it again, and
  // inserts right after the source row so the two group together on the
  // printed slip (see groupMedicines).
  const dupMed = (id) => {
    const idx = meds.findIndex((m) => m.id === id);
    if (idx === -1) return;
    const copy = { id: uid(), name: meds[idx].name, dosage: "", frequency: "", duration: "", instructions: "" };
    setMeds([...meds.slice(0, idx + 1), copy, ...meds.slice(idx + 1)]);
  };

  // Medicine names typed into this form (not yet saved) are folded into the
  // dropdown right away, so a custom drug typed for one row is immediately
  // pickable for the next row in the same prescription — not just the next
  // prescription (see the `drugOptions` prop, which only knows about
  // already-saved prescriptions).
  const liveDrugOptions = useMemo(
    () => _.uniq([...drugOptions, ...meds.map((m) => m.name)].filter(Boolean).map((s) => s.toUpperCase())),
    [drugOptions, meds]
  );

  return (
    <ModalShell title={initial ? "Edit Prescription" : "New Prescription"} onClose={onClose} wide>
      <div className="grid sm:grid-cols-2 gap-4 mb-4">
        <TextField label="Date" type="date" value={date} onChange={setDate} />
        <TextField label="Prescribing Doctor" value={doctor} onChange={setDoctor} />
      </div>
      <p className="text-xs font-medium mb-2" style={{ color: C.inkMuted }}>Medicines</p>
      <div className="flex flex-col gap-3 mb-3">
        {meds.map((m) => (
          <div key={m.id} className="grid sm:grid-cols-5 gap-2 items-start rounded-xl p-3" style={{ background: C.slateTint }}>
            <DropdownOtherField label="Drug Name" value={m.name} onChange={(v) => updMed(m.id, "name", v.toUpperCase())} options={liveDrugOptions} />
            <DropdownOtherField label="Dose" value={m.dosage} onChange={(v) => updMed(m.id, "dosage", v)} options={DOSE_OPTIONS} />
            <DropdownOtherField label="Frequency" value={m.frequency} onChange={(v) => updMed(m.id, "frequency", v)} options={FREQUENCY_OPTIONS} />
            <DropdownOtherField label="Duration" value={m.duration} onChange={(v) => updMed(m.id, "duration", v)} options={DURATION_OPTIONS} />
            <div className="flex gap-2 items-start">
              <TextField label="Instructions" value={m.instructions} onChange={(v) => updMed(m.id, "instructions", v)} />
              <button type="button" onClick={() => dupMed(m.id)} className="pt-6" title="Same drug, another dose/duration" disabled={!m.name}>
                <Copy size={15} style={{ color: m.name ? C.inkFaint : "#C9D3CE" }} />
              </button>
              <button type="button" onClick={() => rmMed(m.id)} className="pt-6"><Trash2 size={15} style={{ color: C.inkFaint }} /></button>
            </div>
          </div>
        ))}
      </div>
      <Btn size="sm" variant="subtle" icon={Plus} onClick={addMed}>Add Medicine</Btn>
      <div className="mt-4"><TextAreaField label="General Advice" value={advice} onChange={setAdvice} full /></div>
      <div className="flex justify-end gap-2 mt-5">
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn icon={Save} onClick={() => onSave({ id: initial?.id || uid(), date, doctor, advice, medicines: meds.filter((m) => m.name) })}>{initial ? "Save Changes" : "Save Prescription"}</Btn>
      </div>
    </ModalShell>
  );
}

/* Read-only prescription detail — shared between the View modal (on screen)
   and the hidden print-only block (see printRxId in PatientDetail), so the
   two never drift apart. */
function PrescriptionView({ rx }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <p className="text-sm font-semibold" style={{ color: C.ink }}>{fmtDate(rx.date)}</p>
        <p className="text-xs" style={{ color: C.inkFaint }}>{rx.doctor || "—"}</p>
      </div>
      <div className="overflow-x-auto emr-scroll">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left" style={{ color: C.inkFaint }}>
              <th className="pb-1 font-medium">Drug</th><th className="pb-1 font-medium">Dose</th>
              <th className="pb-1 font-medium">Frequency</th><th className="pb-1 font-medium">Duration</th><th className="pb-1 font-medium">Instructions</th>
            </tr>
          </thead>
          <tbody>
            {groupMedicines(rx.medicines).map((g) => g.doses.map((d, di) => (
              <tr key={d.id} style={{ borderTop: `1px solid ${C.borderSoft}` }}>
                {di === 0 && <td className="py-1.5 font-semibold align-top" rowSpan={g.doses.length} style={{ color: C.ink }}>{g.name}</td>}
                <td className="py-1.5">{d.dosage || "—"}</td>
                <td className="py-1.5">{d.frequency || "—"}</td><td className="py-1.5">{d.duration || "—"}</td><td className="py-1.5">{d.instructions || "—"}</td>
              </tr>
            )))}
          </tbody>
        </table>
      </div>
      {rx.advice && <p className="text-sm mt-3" style={{ color: C.inkMuted }}><strong>Advice:</strong> {rx.advice}</p>}
    </div>
  );
}

function CycleModal({ onClose, onSave, nextCycleNo }) {
  const [type, setType] = useState("IUI");
  const [startDate, setStartDate] = useState(todayISO());
  const [outcome, setOutcome] = useState("Ongoing");
  return (
    <ModalShell title="New Treatment Cycle" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <SelectField label="Treatment Type" value={type} onChange={setType} options={["IUI", "IVF"]} />
        <TextField label="Cycle No." value={nextCycleNo} onChange={() => {}} />
        <TextField label="Start Date" type="date" value={startDate} onChange={setStartDate} />
        <SelectField label="Outcome" value={outcome} onChange={setOutcome} options={["Ongoing", "Positive", "Negative", "Cancelled"]} />
      </div>
      <div className="flex justify-end gap-2 mt-5">
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn icon={Save} onClick={() => onSave({ id: uid(), type, cycleNo: nextCycleNo, startDate, outcome, monitoring: [] })}>Save Cycle</Btn>
      </div>
    </ModalShell>
  );
}

function MonitoringModal({ onClose, onSave }) {
  const [f, setF] = useState({ date: todayISO(), day: "", e2: "", endo: "", rtOv: "", ltOv: "", adv: "" });
  const set = (k, v) => setF({ ...f, [k]: v });
  return (
    <ModalShell title="Add Monitoring Entry" onClose={onClose}>
      <div className="grid sm:grid-cols-2 gap-4">
        <TextField label="Date" type="date" value={f.date} onChange={(v) => set("date", v)} />
        <TextField label="Day" value={f.day} onChange={(v) => set("day", v)} />
        <TextField label="E2" value={f.e2} onChange={(v) => set("e2", v)} />
        <TextField label="Endometrium" value={f.endo} onChange={(v) => set("endo", v)} />
        <TextField label="Rt. Ov." value={f.rtOv} onChange={(v) => set("rtOv", v)} />
        <TextField label="Lt. Ov." value={f.ltOv} onChange={(v) => set("ltOv", v)} />
        <TextAreaField label="Advice" value={f.adv} onChange={(v) => set("adv", v)} full />
      </div>
      <div className="flex justify-end gap-2 mt-5">
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn icon={Save} onClick={() => onSave({ id: uid(), ...f })}>Save Entry</Btn>
      </div>
    </ModalShell>
  );
}

function ReportPickerModal({ title, onClose, onSave, fields }) {
  const [f, setF] = useState(_.fromPairs(fields.map((k) => [k, ""])));
  return (
    <ModalShell title={title} onClose={onClose}>
      <div className="grid sm:grid-cols-2 gap-4">
        {fields.map((k) => <TextField key={k} label={k} value={f[k]} onChange={(v) => setF({ ...f, [k]: v })} />)}
      </div>
      <div className="flex justify-end gap-2 mt-5">
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn icon={Save} onClick={() => onSave(f)}>Save</Btn>
      </div>
    </ModalShell>
  );
}

/* ---------------------------------------------------------------------
   Root App
--------------------------------------------------------------------- */
export default function App() {
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [patients, setPatients] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [cycles, setCycles] = useState([]);
  const [view, setView] = useState("dashboard");
  const [selectedId, setSelectedId] = useState(null);
  const [editingPatient, setEditingPatient] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [semenModalFor, setSemenModalFor] = useState(null);
  const [changePwOpen, setChangePwOpen] = useState(false);
  const [backupsOpen, setBackupsOpen] = useState(false);
  const [backupsList, setBackupsList] = useState([]);
  const [backupBusy, setBackupBusy] = useState(false);

  const showToast = (msg, type = "ok") => { setToast({ msg, type }); setTimeout(() => setToast(null), 2200); };

  // Web: restore the HttpOnly session first. Only after authentication do
  // we query PostgreSQL for patients. This prevents the initial 401 from
  // being mistaken for an empty patient database.
  useEffect(() => {
    (async () => {
      try {
        if (IS_WEB) {
          const session = await apiFetch("/api/auth/me");
          if (session?.authenticated && session.user) {
            setCurrentUser(session.user);
            const p = await loadPatientsRemote();
            setPatients(p.map(normalizePatient));
            const rx = await loadPrescriptionsRemote();
            setPrescriptions(rx);
          }
        } else {
          const p = await storageGet("patients", []);
          setPatients(p.map(normalizePatient));
          const rx = await storageGet("prescriptions", []);
          setPrescriptions(rx);
        }

        const cy = await storageGet("cycles", []);
        setCycles(cy);
      } catch (error) {
        // A missing web session is normal on first load; do not show a false
        // "could not load patients" error before the login screen appears.
        if (!IS_WEB || error.message !== "Request failed") {
          console.error("Initial application load failed:", error);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const persistPatients = async (next) => { setPatients(next); if (!IS_WEB) await storageSet("patients", next); };
  const persistRx = async (next) => { setPrescriptions(next); if (!IS_WEB) await storageSet("prescriptions", next); };
  const persistCycles = async (next) => { setCycles(next); await storageSet("cycles", next); };

  const handleLogin = async (username, password) => {
  const api = window?.api;

  // Web/Vercel build: authenticate against the real session API
  // (/api/auth/login sets the HttpOnly navjeevan_session cookie).
  // The web API accepts either the legacy username "admin" or the
  // canonical email address, so the existing login UI does not change.
  if (typeof api?.login !== "function") {
    try {
      const body = await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: username.trim(), password }),
      });
      if (!body?.user) return false;

      setCurrentUser(body.user);
      // The login request sets the HttpOnly cookie. Load the permanent
      // patient/prescription records only after that cookie exists.
      const remotePatients = await loadPatientsRemote();
      setPatients(remotePatients.map(normalizePatient));
      const remoteRx = await loadPrescriptionsRemote();
      setPrescriptions(remoteRx);
      setView("dashboard");
      setSelectedId(null);
      setEditingPatient(null);
      setMobileOpen(false);
      setBackupsOpen(false);
      return true;
    } catch (error) {
      if (error.message === "Invalid email or password") return false;
      throw new Error("Sign-in service could not be reached. Please try again.");
    }
  }

  try {
    const user = await api.login(username, password);
    if (!user || typeof user !== "object") return false;

    setCurrentUser(user);
    setView("dashboard");
    setSelectedId(null);
    setEditingPatient(null);
    setMobileOpen(false);
    setBackupsOpen(false);
    return true;
    } catch (error) {
      // LoginView presents this as a service problem, not a bad password.
      throw new Error("Sign-in service could not be reached. Restart the desktop application and try again.");
    }
  };
  const handleLogout = async () => {
    if (IS_WEB) {
      try {
        await apiFetch("/api/auth/logout", { method: "POST" });
      } catch (error) {
        console.error("Web logout failed:", error);
      }
    }
    // Clear user-specific navigation and overlays so they cannot reappear on re-login.
    // Do NOT delete patient state or call any patient-delete endpoint.
    setCurrentUser(null);
    setView("dashboard");
    setSelectedId(null);
    setEditingPatient(null);
    setMobileOpen(false);
    setSemenModalFor(null);
    setChangePwOpen(false);
    setBackupsOpen(false);
  };
  const handleChangePassword = async (current, next) => {
  try {
    const result = await window.api.changePassword(current, next);

    if (!result) {
      return false;
    }

    showToast("Password updated.");
    setChangePwOpen(false);
    return true;
  } catch (error) {
    console.error("Change password failed:", error);
    return false;
  }
};

  const refreshBackups = async () => setBackupsList(IS_WEB ? await loadBackupsRemote() : await window.api.backupList());
  const openBackups = async () => {
    try {
      await refreshBackups();
      setBackupsOpen(true);
    } catch (error) {
      showToast(error.message || "Could not load backups.", "error");
    }
  };
  const runBackupNow = async () => {
    setBackupBusy(true);
    try {
      if (IS_WEB) await createBackupRemote();
      else await window.api.backupRun();
      await refreshBackups();
      showToast("Backup complete.");
    } catch (error) {
      showToast(error.message || "Backup failed.", "error");
    } finally {
      setBackupBusy(false);
    }
  };
  const restoreBackup = async (snapshot) => {
    const label = IS_WEB ? new Date(snapshot.createdAt).toLocaleString("en-IN") : snapshot;
    if (!window.confirm(`Restore the backup from ${label}? Any changes made after this backup will be lost.`)) return;
    if (IS_WEB) await restoreBackupRemote(snapshot.id);
    else await window.api.backupRestore(snapshot);
    showToast("Backup restored. Reloading…");
    setTimeout(() => window.location.reload(), 800);
  };

  const openPatient = (id) => { setSelectedId(id); setView("patientDetail"); };

  const savePatient = async (data) => {
    const exists = patients.some((p) => p.id === data.id);
    if (IS_WEB) {
      try {
        data = exists ? await updatePatientRemote(data.id, data) : await createPatientRemote(data);
      } catch (error) {
        showToast(error.message || "Could not save patient.", "error");
        return;
      }
    }
    const next = exists ? patients.map((p) => (p.id === data.id ? data : p)) : [...patients, data];
    await persistPatients(next);
    showToast(exists ? "Patient updated." : "Patient registered.");
    setEditingPatient(null);
    setSelectedId(data.id);
    setView("patientDetail");
  };
  const deletePatient = async (id) => {
    if (IS_WEB) {
      try {
        await deletePatientRemote(id);
      } catch (error) {
        showToast(error.message || "Could not delete patient.", "error");
        return;
      }
    }
    await persistPatients(patients.filter((p) => p.id !== id));
    await persistRx(prescriptions.filter((r) => r.patientId !== id));
    await persistCycles(cycles.filter((c) => c.patientId !== id));
    showToast("Patient record removed.");
  };

  const addPrescription = async (patientId, rx) => {
    let record = { ...rx, patientId };
    if (IS_WEB) {
      try {
        record = await createPrescriptionRemote(record);
      } catch (error) {
        showToast(error.message || "Could not save prescription.", "error");
        return;
      }
    }
    await persistRx([...prescriptions, record]);
    showToast("Prescription saved.");
  };
  const updatePrescription = async (rx) => {
    let record = rx;
    if (IS_WEB) {
      try {
        record = await updatePrescriptionRemote(rx.id, rx);
      } catch (error) {
        showToast(error.message || "Could not update prescription.", "error");
        return;
      }
    }
    await persistRx(prescriptions.map((r) => r.id === rx.id ? record : r));
    showToast("Prescription updated.");
  };
  const deletePrescription = async (id) => {
    if (IS_WEB) {
      try {
        await deletePrescriptionRemote(id);
      } catch (error) {
        showToast(error.message || "Could not delete prescription.", "error");
        return;
      }
    }
    await persistRx(prescriptions.filter((r) => r.id !== id));
    showToast("Prescription deleted.");
  };
  const addCycle = async (patientId, c) => {
    await persistCycles([...cycles, { ...c, patientId }]);
    showToast("Treatment cycle created.");
  };
  const addMonitoring = async (patientId, cycleId, entry) => {
    await persistCycles(cycles.map((c) => c.id === cycleId ? { ...c, monitoring: [...c.monitoring, entry] } : c));
    showToast("Monitoring entry added.");
  };
  const addSemenReport = async (patientId, vals) => {
    const next = patients.map((p) => p.id === patientId ? { ...p, husband: { ...p.husband, semenAnalysis: [...p.husband.semenAnalysis, { id: uid(), date: vals.date || todayISO(), lab: vals.Lab || "", count: vals.Count || "", motility: vals.Motility || "", pusCells: vals["Pus Cells"] || "" }] } } : p);
    if (IS_WEB) {
      const changed = next.find((p) => p.id === patientId);
      try {
        await updatePatientRemote(patientId, changed);
      } catch (error) {
        showToast(error.message || "Could not save semen analysis.", "error");
        return;
      }
    }
    await persistPatients(next);
    showToast("Semen analysis report added.");
  };
  const addFile = async (patientId, file) => {
    const next = patients.map((p) => p.id === patientId ? { ...p, files: [...(p.files || []), file] } : p);
    if (IS_WEB) {
      const changed = next.find((p) => p.id === patientId);
      try {
        await updatePatientRemote(patientId, changed);
      } catch (error) {
        showToast(error.message || "Could not save file.", "error");
        return;
      }
    }
    await persistPatients(next);
    showToast("File uploaded.");
  };
  const saveHighlights = async (patientId, highlights) => {
    const next = patients.map((p) => p.id === patientId ? { ...p, highlights } : p);
    if (IS_WEB) {
      const changed = next.find((p) => p.id === patientId);
      try {
        await updatePatientRemote(patientId, changed);
      } catch (error) {
        showToast(error.message || "Could not save highlights.", "error");
        return;
      }
    }
    await persistPatients(next);
    showToast("Highlights saved.");
  };
  const removeFile = async (patientId, fileId) => {
    const next = patients.map((p) => p.id === patientId ? { ...p, files: (p.files || []).filter((f) => f.id !== fileId) } : p);
    if (IS_WEB) {
      const changed = next.find((p) => p.id === patientId);
      try {
        await updatePatientRemote(patientId, changed);
      } catch (error) {
        showToast(error.message || "Could not remove file.", "error");
        return;
      }
    }
    await persistPatients(next);
    showToast("File removed.");
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg, color: C.inkMuted }}>{FONTS}Loading Navjeevan EMR…</div>;
  }

  if (!currentUser) {
    return <div className="emr-root">{FONTS}<LoginView onLogin={handleLogin} /></div>;
  }

  const selected = patients.find((p) => p.id === selectedId);

  return (
    <div className="emr-root">
      {FONTS}
      <Shell user={currentUser} view={view === "patientDetail" || view === "editPatient" ? "patients" : view} setView={(v) => { setView(v); setEditingPatient(null); }} onLogout={handleLogout} onOpenChangePassword={() => setChangePwOpen(true)} onOpenBackups={openBackups} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen}>
        {view === "dashboard" && <Dashboard patients={patients} setView={setView} openPatient={openPatient} />}
        {view === "patients" && <PatientsList patients={patients} openPatient={openPatient} setView={setView} deletePatient={deletePatient} />}
        {view === "newPatient" && <PatientForm onSave={savePatient} onCancel={() => setView("patients")} />}
        {view === "editPatient" && selected && <PatientForm initial={selected} onSave={savePatient} onCancel={() => { setView("patientDetail"); }} />}
        {view === "patientDetail" && selected && (
          <PatientDetail
            patient={selected}
            prescriptions={prescriptions}
            cycles={cycles}
            onBack={() => setView("patients")}
            onEdit={() => setView("editPatient")}
            onAddPrescription={addPrescription}
            onUpdatePrescription={updatePrescription}
            onDeletePrescription={deletePrescription}
            onAddCycle={addCycle}
            onAddMonitoring={addMonitoring}
            onAddSemen={(pid) => setSemenModalFor(pid)}
            onAddFile={addFile}
            onRemoveFile={removeFile}
            onSaveHighlights={saveHighlights}
          />
        )}
      </Shell>
      {semenModalFor && (
        <ReportPickerModal title="Add Semen Analysis Report" fields={["date", "Lab", "Count", "Motility", "Pus Cells"]}
          onClose={() => setSemenModalFor(null)} onSave={(vals) => { addSemenReport(semenModalFor, vals); setSemenModalFor(null); }} />
      )}
      {changePwOpen && <ChangePasswordModal
  onClose={() => setChangePwOpen(false)}
  onSave={handleChangePassword}
/> }
      {backupsOpen && (
        <BackupsModal onClose={() => setBackupsOpen(false)} backups={backupsList} onRun={runBackupNow} onRestore={restoreBackup}
          onOpenFolder={IS_WEB ? undefined : () => window.api.backupOpenFolder()} busy={backupBusy} />
      )}
      <Toast toast={toast} />
    </div>
  );
}