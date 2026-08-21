import { useState, useEffect, useMemo, Fragment } from "react";
import _ from "lodash";
import {
  LayoutDashboard, Users, UserPlus, LogOut, Search, Plus, X, Save,
  ChevronLeft, Pill, TestTube2, Baby, ClipboardList, Trash2, Pencil,
  ArrowLeft, AlertCircle, Clock, CheckCircle2, Menu, ShieldCheck,
  FlaskConical, Stethoscope, CalendarClock, Receipt, IndianRupee, Database
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
    @media print {
      .no-print { display: none !important; }
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
    diet: "Veg",
    marriedSince: "",
    typeInfertility: "",
    menstrualHistory: "",
    lmp: "",
    obstetricHistory: "",
    pastFamilyHistory: "",
    exam: { stature: "", height: "", weight: "", bmi: "", thyroid: "", hirsutism: "", brSecretions: "", secSexChar: "", bp: "", tvs: "", rs: "", cvs: "" },
    invest: { hb: "", urine: "", esr: "", hiv: "", blGroup: "", bsl: "", hbsAg: "", srCreatinine: "", srInsulin: "", misc: "" },
    hormonePanels: { initial: blankHormonePanel(), repeat: blankHormonePanel() },
    laparoscopy: { date: "", findings: "" },
    hsg: { date: "", findings: "" },
    hysteroscopy: { date: "", findings: "" },
    pcr: { date: "", result: "" },
    cbnaat: { date: "", result: "" },
    husband: { habitsHistory: "", genitalExam: "", miscInvestigations: "", semenAnalysis: [] },
    diagnosis: "",
    planOfManagement: "",
    treatmentType: "Undecided",
    status: "Active",
    nextFollowUp: "",
    paperCycles: { cycle1: blankPaperCycle(), cycle2: blankPaperCycle(), cycle3: blankPaperCycle() },
    createdAt: new Date().toISOString(),
  };
}

function blankHormonePanel() {
  return _.fromPairs(HORMONE_KEYS.map(([k]) => [k, { date: "", day: "", result: "", lab: "" }]));
}
function blankCycleRow() {
  return { id: uid(), date: "", day: "", e2: "", end: "", rtOv: "", ltOv: "", adv: "" };
}
function blankPaperCycle() {
  return { date: "", rows: Array.from({ length: 9 }, blankCycleRow) };
}

const EXAM_FIELDS = [
  ["stature", "Stature"], ["height", "Height (cm)"], ["weight", "Weight (kg)"], ["bmi", "BMI"],
  ["thyroid", "Thyroid"], ["hirsutism", "Hirsutism"], ["brSecretions", "Br. Secretions"], ["secSexChar", "Sec. Sex Characters"],
  ["bp", "B.P."], ["tvs", "TVS"], ["rs", "R.S."], ["cvs", "C.V.S."],
];
const INVEST_FIELDS = [
  ["hb", "Hb"], ["urine", "Urine"], ["esr", "ESR"], ["hiv", "HIV"],
  ["blGroup", "Bl. Group"], ["bsl", "BSL"], ["hbsAg", "HBs Ag"],
  ["srCreatinine", "Sr. Creatinine"], ["srInsulin", "Sr. Insulin"], ["misc", "Misc."],
];
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
const BILLING_CATEGORIES = ["Consultation", "Investigation", "Procedure", "Medicine", "IUI Treatment", "IVF Treatment", "Other"];
const PAYMENT_MODES = ["Cash", "Card", "UPI", "Bank Transfer", "Cheque", "Other"];

/* ---------------------------------------------------------------------
   Small UI primitives
--------------------------------------------------------------------- */
function TextField({ label, value, onChange, placeholder, type = "text", full }) {
  return (
    <label className={"flex flex-col gap-1 " + (full ? "col-span-full" : "")}>
      <span className="text-xs font-medium" style={{ color: C.inkMuted }}>{label}</span>
      <input
        type={type}
        value={value || ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg px-3 py-2 text-sm outline-none transition"
        style={{ border: `1px solid ${C.border}`, color: C.ink, background: "#fff" }}
        onFocus={(e) => (e.target.style.borderColor = C.primary)}
        onBlur={(e) => (e.target.style.borderColor = C.border)}
      />
    </label>
  );
}
function SelectField({ label, value, onChange, options, full }) {
  return (
    <label className={"flex flex-col gap-1 " + (full ? "col-span-full" : "")}>
      <span className="text-xs font-medium" style={{ color: C.inkMuted }}>{label}</span>
      <select
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg px-3 py-2 text-sm outline-none"
        style={{ border: `1px solid ${C.border}`, color: C.ink, background: "#fff" }}
      >
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}
function DropdownOtherField({ label, value, onChange, options, full }) {
  const isKnown = !value || options.includes(value);
  const [showCustom, setShowCustom] = useState(!isKnown);
  return (
    <label className={"flex flex-col gap-1 " + (full ? "col-span-full" : "")}>
      <span className="text-xs font-medium" style={{ color: C.inkMuted }}>{label}</span>
      <select
        value={showCustom ? "__other__" : (value || "")}
        onChange={(e) => {
          if (e.target.value === "__other__") { setShowCustom(true); onChange(""); }
          else { setShowCustom(false); onChange(e.target.value); }
        }}
        className="rounded-lg px-3 py-2 text-sm outline-none"
        style={{ border: `1px solid ${C.border}`, color: C.ink, background: "#fff" }}
      >
        <option value="">Select…</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
        <option value="__other__">Other (type manually)</option>
      </select>
      {showCustom && (
        <input
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Enter ${label.toLowerCase()}`}
          className="rounded-lg px-3 py-2 text-sm outline-none mt-1"
          style={{ border: `1px solid ${C.border}`, color: C.ink, background: "#fff" }}
        />
      )}
    </label>
  );
}
function TextAreaField({ label, value, onChange, rows = 2, full }) {
  return (
    <label className={"flex flex-col gap-1 " + (full ? "col-span-full" : "")}>
      <span className="text-xs font-medium" style={{ color: C.inkMuted }}>{label}</span>
      <textarea
        rows={rows}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg px-3 py-2 text-sm outline-none resize-none"
        style={{ border: `1px solid ${C.border}`, color: C.ink, background: "#fff" }}
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

/* Hormone panel table — mirrors the paper's "Hormone Assays" / "Recepit" tables
   (one row per Serum marker, each with its own Date / Day of Cycle / Result / Lab). */
function HormoneTable({ title, panel, editable, onChange }) {
  return (
    <div className="rounded-xl p-3" style={{ background: C.slateTint }}>
      <p className="text-xs font-semibold mb-2" style={{ color: C.primaryDark }}>{title}</p>
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
function CycleTable({ label, cycle, editable, onDateChange, onAddRow, onRemoveRow, onUpdateRow }) {
  return (
    <div className="rounded-xl p-3" style={{ background: C.slateTint }}>
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <p className="text-sm font-semibold" style={{ color: C.primaryDark }}>{label}</p>
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
            <p className="text-sm opacity-80 max-w-xs">A patient journey system for the OPD — from first consultation through IUI/IVF cycles, reports, prescriptions and billing.</p>
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
  }}>

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
  return (
    <ModalShell title="Backups" onClose={onClose} wide>
      <p className="text-sm mb-4" style={{ color: C.inkMuted }}>
        A snapshot is taken automatically on launch, every 6 hours while the app is open, and on close.
        The last {backups.length ? "30" : "0"} snapshots are kept. Copy the backups folder to a USB drive
        or cloud-synced folder periodically for off-site protection.
      </p>
      <div className="flex gap-2 mb-4">
        <Btn size="sm" icon={Save} onClick={onRun} disabled={busy}>{busy ? "Backing up…" : "Back Up Now"}</Btn>
        <Btn size="sm" variant="ghost" onClick={onOpenFolder}>Open Backups Folder</Btn>
      </div>
      <div className="max-h-72 overflow-y-auto emr-scroll flex flex-col gap-2">
        {backups.length === 0 && <p className="text-sm" style={{ color: C.inkFaint }}>No backups yet.</p>}
        {backups.map((b) => (
          <div key={b} className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: C.slateTint }}>
            <span className="text-sm" style={{ color: C.ink }}>{b.replace("_", " · ").replace(/-/g, (m, i) => m)}</span>
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
function Dashboard({ patients, billingItems, payments, setView, openPatient }) {
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

  const isThisMonth = (d) => { const dt = new Date((d || "").slice(0, 10) + "T00:00:00"); return !isNaN(dt) && dt.getMonth() === now.getMonth() && dt.getFullYear() === now.getFullYear(); };
  const totalBilled = billingItems.reduce((s, b) => s + (Number(b.amount) || 0), 0);
  const totalPaid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const outstanding = totalBilled - totalPaid;
  const collectedThisMonth = payments.filter((p) => isThisMonth(p.date)).reduce((s, p) => s + (Number(p.amount) || 0), 0);

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

      <div className="grid sm:grid-cols-3 gap-4">
        <Card className="p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl" style={{ background: C.primaryTint }}><Receipt size={18} style={{ color: C.primary }} /></div>
          <div><p className="text-xs" style={{ color: C.inkMuted }}>Total Billed (all-time)</p><p className="text-xl" style={FONT_DISPLAY}>₹{totalBilled.toLocaleString("en-IN")}</p></div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl" style={{ background: C.greenTint }}><IndianRupee size={18} style={{ color: C.green }} /></div>
          <div><p className="text-xs" style={{ color: C.inkMuted }}>Collected This Month</p><p className="text-xl" style={FONT_DISPLAY}>₹{collectedThisMonth.toLocaleString("en-IN")}</p></div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl" style={{ background: C.brickTint }}><AlertCircle size={18} style={{ color: C.brick }} /></div>
          <div><p className="text-xs" style={{ color: C.inkMuted }}>Outstanding Dues</p><p className="text-xl" style={FONT_DISPLAY}>₹{outstanding.toLocaleString("en-IN")}</p></div>
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
            {["All", "IUI", "IVF", "Undecided", "Other"].map((o) => <option key={o}>{o}</option>)}
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
  const [data, setData] = useState(initial || blankPatient());
  const [tab, setTab] = useState("basic");
  const set = (path, val) => setData((prev) => _.set(_.cloneDeep(prev), path, val));

  const tabs = [
    { key: "basic", label: "Basic Info & History" },
    { key: "exam", label: "Examination & Investigations" },
    { key: "imaging", label: "Hormone Assays & Imaging" },
    { key: "husband", label: "Husband Investigations" },
    { key: "plan", label: "Diagnosis & Plan" },
  ];

  const updHormonePanel = (panelKey, hormoneKey, field, val) => setData((prev) => _.set(_.cloneDeep(prev), `hormonePanels.${panelKey}.${hormoneKey}.${field}`, val));

  const addSemenRow = () => setData((prev) => ({ ...prev, husband: { ...prev.husband, semenAnalysis: [...prev.husband.semenAnalysis, { id: uid(), date: todayISO(), lab: "", count: "", motility: "", pusCells: "" }] } }));
  const rmSemenRow = (id) => setData((prev) => ({ ...prev, husband: { ...prev.husband, semenAnalysis: prev.husband.semenAnalysis.filter((r) => r.id !== id) } }));
  const updSemenRow = (id, key, val) => setData((prev) => ({ ...prev, husband: { ...prev.husband, semenAnalysis: prev.husband.semenAnalysis.map((r) => r.id === id ? { ...r, [key]: val } : r) } }));

  const setCycleDate = (cycleKey, val) => set(`paperCycles.${cycleKey}.date`, val);
  const addCycleRow = (cycleKey) => setData((prev) => ({ ...prev, paperCycles: { ...prev.paperCycles, [cycleKey]: { ...prev.paperCycles[cycleKey], rows: [...prev.paperCycles[cycleKey].rows, blankCycleRow()] } } }));
  const rmCycleRow = (cycleKey, rowId) => setData((prev) => ({ ...prev, paperCycles: { ...prev.paperCycles, [cycleKey]: { ...prev.paperCycles[cycleKey], rows: prev.paperCycles[cycleKey].rows.filter((r) => r.id !== rowId) } } }));
  const updCycleRow = (cycleKey, rowId, field, val) => setData((prev) => ({ ...prev, paperCycles: { ...prev.paperCycles, [cycleKey]: { ...prev.paperCycles[cycleKey], rows: prev.paperCycles[cycleKey].rows.map((r) => r.id === rowId ? { ...r, [field]: val } : r) } } }));

  return (
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
              <TextField label="File No." value={data.fileNo} onChange={(v) => set("fileNo", v)} />
              <TextField label="Ref. by Dr." value={data.refDoctor} onChange={(v) => set("refDoctor", v)} />
              <TextField label="Date" type="date" value={data.regDate} onChange={(v) => set("regDate", v)} />
              <TextField label="Patient's Name (Wife)" value={data.patientName} onChange={(v) => set("patientName", v)} full />
              <TextAreaField label="Address" value={data.address} onChange={(v) => set("address", v)} full />
              <TextField label="Phone (W)" value={data.phoneW} onChange={(v) => set("phoneW", v)} />
              <TextField label="Phone (H)" value={data.phoneH} onChange={(v) => set("phoneH", v)} />
              <SelectField label="Diet" value={data.diet} onChange={(v) => set("diet", v)} options={["Veg", "Non-Veg"]} />
            </div>
          </div>
          <div>
            <SectionTitle>Age, Education & Occupation</SectionTitle>
            <div className="grid sm:grid-cols-3 gap-4">
              <TextField label="Age (Wife)" value={data.ageW} onChange={(v) => set("ageW", v)} />
              <TextField label="Education (Wife)" value={data.eduW} onChange={(v) => set("eduW", v)} />
              <TextField label="Occupation (Wife)" value={data.occW} onChange={(v) => set("occW", v)} />
              <TextField label="Age (Husband)" value={data.ageH} onChange={(v) => set("ageH", v)} />
              <TextField label="Education (Husband)" value={data.eduH} onChange={(v) => set("eduH", v)} />
              <TextField label="Occupation (Husband)" value={data.occH} onChange={(v) => set("occH", v)} />
            </div>
          </div>
          <div>
            <SectionTitle>Fertility & Menstrual History</SectionTitle>
            <div className="grid sm:grid-cols-2 gap-4">
              <TextField label="Married Since" value={data.marriedSince} onChange={(v) => set("marriedSince", v)} />
              <TextField label="Type of Infertility" value={data.typeInfertility} onChange={(v) => set("typeInfertility", v)} placeholder="Primary / Secondary" />
              <TextField label="Menstrual History" value={data.menstrualHistory} onChange={(v) => set("menstrualHistory", v)} />
              <TextField label="LMP" type="date" value={data.lmp} onChange={(v) => set("lmp", v)} />
              <TextAreaField label="Obstetric History" value={data.obstetricHistory} onChange={(v) => set("obstetricHistory", v)} full />
              <TextAreaField label="Past / Family History" value={data.pastFamilyHistory} onChange={(v) => set("pastFamilyHistory", v)} full />
            </div>
          </div>
        </Card>
      )}

      {tab === "exam" && (
        <Card className="p-5 flex flex-col gap-6">
          <div>
            <SectionTitle icon={Stethoscope} sub="Wife">Examination</SectionTitle>
            <div className="grid sm:grid-cols-4 gap-4">
              {EXAM_FIELDS.map(([k, label]) => (
                <TextField key={k} label={label} value={data.exam[k]} onChange={(v) => set(`exam.${k}`, v)} />
              ))}
            </div>
          </div>
          <div>
            <SectionTitle icon={TestTube2} sub="Wife">Investigations</SectionTitle>
            <div className="grid sm:grid-cols-4 gap-4">
              {INVEST_FIELDS.map(([k, label]) => (
                <TextField key={k} label={label} value={data.invest[k]} onChange={(v) => set(`invest.${k}`, v)} />
              ))}
            </div>
          </div>
        </Card>
      )}

      {tab === "imaging" && (
        <Card className="p-5 flex flex-col gap-6">
          <div>
            <SectionTitle icon={FlaskConical} sub="Blood / hormone reports — as on the OPD chart">Hormone Assays</SectionTitle>
            <div className="flex flex-col gap-4">
              <HormoneTable title="Hormone Assays" panel={data.hormonePanels.initial} editable onChange={(k, f, v) => updHormonePanel("initial", k, f, v)} />
              <HormoneTable title="Recepit (Repeat)" panel={data.hormonePanels.repeat} editable onChange={(k, f, v) => updHormonePanel("repeat", k, f, v)} />
            </div>
          </div>
          <div>
            <SectionTitle sub="Imaging & procedures">Laparoscopy · HSG · Hysteroscopy · PCR · CBNAAT</SectionTitle>
            <div className="grid sm:grid-cols-2 gap-4">
              <TextField label="Laparoscopy Date" type="date" value={data.laparoscopy.date} onChange={(v) => set("laparoscopy.date", v)} />
              <TextField label="Laparoscopy Findings" value={data.laparoscopy.findings} onChange={(v) => set("laparoscopy.findings", v)} />
              <TextField label="HSG Date" type="date" value={data.hsg.date} onChange={(v) => set("hsg.date", v)} />
              <TextField label="HSG Findings" value={data.hsg.findings} onChange={(v) => set("hsg.findings", v)} />
              <TextField label="Hysteroscopy Date" type="date" value={data.hysteroscopy.date} onChange={(v) => set("hysteroscopy.date", v)} />
              <TextField label="Hysteroscopy Findings" value={data.hysteroscopy.findings} onChange={(v) => set("hysteroscopy.findings", v)} />
              <TextField label="PCR Date" type="date" value={data.pcr.date} onChange={(v) => set("pcr.date", v)} />
              <TextField label="PCR Result" value={data.pcr.result} onChange={(v) => set("pcr.result", v)} />
              <TextField label="CBNAAT Date" type="date" value={data.cbnaat.date} onChange={(v) => set("cbnaat.date", v)} />
              <TextField label="CBNAAT Result" value={data.cbnaat.result} onChange={(v) => set("cbnaat.result", v)} />
            </div>
          </div>
        </Card>
      )}

      {tab === "husband" && (
        <Card className="p-5 flex flex-col gap-6">
          <div className="grid sm:grid-cols-2 gap-4">
            <TextAreaField label="Habits & Past History" value={data.husband.habitsHistory} onChange={(v) => set("husband.habitsHistory", v)} />
            <TextAreaField label="Genital Examination" value={data.husband.genitalExam} onChange={(v) => set("husband.genitalExam", v)} />
            <TextAreaField label="Miscellaneous Investigations" value={data.husband.miscInvestigations} onChange={(v) => set("husband.miscInvestigations", v)} full />
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
                        <td className="py-1 pr-2"><input type="date" value={r.date} onChange={(e) => updSemenRow(r.id, "date", e.target.value)} className="text-xs rounded px-2 py-1 outline-none" style={{ border: `1px solid ${C.border}` }} /></td>
                        <td className="py-1 pr-2"><input value={r.lab} onChange={(e) => updSemenRow(r.id, "lab", e.target.value)} className="text-xs rounded px-2 py-1 outline-none w-24" style={{ border: `1px solid ${C.border}` }} /></td>
                        <td className="py-1 pr-2"><input value={r.count} onChange={(e) => updSemenRow(r.id, "count", e.target.value)} className="text-xs rounded px-2 py-1 outline-none w-24" style={{ border: `1px solid ${C.border}` }} /></td>
                        <td className="py-1 pr-2"><input value={r.motility} onChange={(e) => updSemenRow(r.id, "motility", e.target.value)} className="text-xs rounded px-2 py-1 outline-none w-24" style={{ border: `1px solid ${C.border}` }} /></td>
                        <td className="py-1 pr-2"><input value={r.pusCells} onChange={(e) => updSemenRow(r.id, "pusCells", e.target.value)} className="text-xs rounded px-2 py-1 outline-none w-24" style={{ border: `1px solid ${C.border}` }} /></td>
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
              <TextAreaField label="Diagnosis" value={data.diagnosis} onChange={(v) => set("diagnosis", v)} full rows={3} />
              <TextAreaField label="Plan of Management" value={data.planOfManagement} onChange={(v) => set("planOfManagement", v)} full rows={3} />
              <SelectField label="Treatment Suggested" value={data.treatmentType} onChange={(v) => set("treatmentType", v)} options={["Undecided", "IUI", "IVF", "Other"]} />
              <SelectField label="Status" value={data.status} onChange={(v) => set("status", v)} options={["Active", "Follow-up", "Completed", "Discontinued"]} />
              <TextField label="Next Follow-up Date" type="date" value={data.nextFollowUp} onChange={(v) => set("nextFollowUp", v)} />
            </div>
          </div>
          <div>
            <SectionTitle icon={CalendarClock} sub="OPD monitoring chart, as printed on the paper form">Cycle Monitoring — Cycle No. 1, 2 & 3</SectionTitle>
            <div className="flex flex-col gap-4">
              <CycleTable label="Cycle No. 1" cycle={data.paperCycles.cycle1} editable
                onDateChange={(v) => setCycleDate("cycle1", v)} onAddRow={() => addCycleRow("cycle1")}
                onRemoveRow={(id) => rmCycleRow("cycle1", id)} onUpdateRow={(id, f, v) => updCycleRow("cycle1", id, f, v)} />
              <CycleTable label="Cycle No. 2" cycle={data.paperCycles.cycle2} editable
                onDateChange={(v) => setCycleDate("cycle2", v)} onAddRow={() => addCycleRow("cycle2")}
                onRemoveRow={(id) => rmCycleRow("cycle2", id)} onUpdateRow={(id, f, v) => updCycleRow("cycle2", id, f, v)} />
              <CycleTable label="Cycle No. 3" cycle={data.paperCycles.cycle3} editable
                onDateChange={(v) => setCycleDate("cycle3", v)} onAddRow={() => addCycleRow("cycle3")}
                onRemoveRow={(id) => rmCycleRow("cycle3", id)} onUpdateRow={(id, f, v) => updCycleRow("cycle3", id, f, v)} />
            </div>
          </div>
        </Card>
      )}

      <div className="flex gap-3 justify-end pb-6">
        <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
        <Btn icon={Save} onClick={() => onSave(data)}>Save Patient</Btn>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------
   Patient Detail
--------------------------------------------------------------------- */
function PatientDetail({ patient, prescriptions, cycles, billingItems, payments, onBack, onEdit, onAddPrescription, onAddCycle, onAddMonitoring, onAddSemen, onAddBillingItem, onRemoveBillingItem, onAddPayment, onRemovePayment }) {
  const [tab, setTab] = useState("overview");
  const [rxOpen, setRxOpen] = useState(false);
  const [cycleOpen, setCycleOpen] = useState(false);
  const [monOpen, setMonOpen] = useState(null);
  const [billOpen, setBillOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);

  const pRx = prescriptions.filter((r) => r.patientId === patient.id);
  const pCycles = cycles.filter((c) => c.patientId === patient.id);
  const pBilling = billingItems.filter((b) => b.patientId === patient.id);
  const pPayments = payments.filter((p) => p.patientId === patient.id);
  const totalBilled = pBilling.reduce((s, b) => s + (Number(b.amount) || 0), 0);
  const totalPaid = pPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const balance = totalBilled - totalPaid;
  const billStatus = totalBilled === 0 ? "No Charges" : balance <= 0 ? "Paid" : totalPaid > 0 ? "Partial" : "Due";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3 no-print">
        <button onClick={onBack}><ArrowLeft size={18} style={{ color: C.inkMuted }} /></button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl" style={FONT_DISPLAY}>{patient.patientName || "Unnamed"}</h1>
            <Badge tone={treatmentTone(patient.treatmentType)}>{patient.treatmentType}</Badge>
            <Badge tone={statusTone(patient.status)}>{patient.status}</Badge>
          </div>
          <p className="text-sm" style={{ color: C.inkMuted }}>File No. {patient.fileNo || "—"} · Age {patient.ageW || "—"}/{patient.ageH || "—"} · {patient.typeInfertility || "Infertility type not set"}</p>
        </div>
        <Btn variant="ghost" icon={Pencil} onClick={onEdit}>Edit</Btn>
      </div>

      <div className="flex gap-1 overflow-x-auto emr-scroll border-b no-print" style={{ borderColor: C.border }}>
        {[["overview", "Overview"], ["reports", "Reports"], ["prescriptions", "Prescriptions"], ["cycles", "IUI / IVF Cycles"], ["billing", "Billing"]].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className="px-4 py-2.5 text-sm font-medium whitespace-nowrap"
            style={{ color: tab === k ? C.primary : C.inkFaint, borderBottom: tab === k ? `2px solid ${C.primary}` : "2px solid transparent" }}>
            {label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid lg:grid-cols-2 gap-5">
          <Card className="p-5">
            <SectionTitle icon={ClipboardList}>Registration & History</SectionTitle>
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              {[["Ref. Doctor", patient.refDoctor], ["Reg. Date", fmtDate(patient.regDate)], ["Address", patient.address], ["Phone (W)", patient.phoneW], ["Phone (H)", patient.phoneH],
              ["Married Since", patient.marriedSince], ["Menstrual History", patient.menstrualHistory], ["LMP", fmtDate(patient.lmp)],
              ["Obstetric History", patient.obstetricHistory], ["Past/Family History", patient.pastFamilyHistory]].map(([l, v]) => (
                <Fragment key={l}>
                  <dt style={{ color: C.inkFaint }}>{l}</dt><dd style={{ color: C.ink }}>{v || "—"}</dd>
                </Fragment>
              ))}
            </dl>
          </Card>
          <Card className="p-5">
            <SectionTitle icon={Stethoscope}>Examination (Wife)</SectionTitle>
            <dl className="grid grid-cols-2 gap-y-2 text-sm mb-4">
              {EXAM_FIELDS.map(([k, label]) => (
                <Fragment key={k}>
                  <dt style={{ color: C.inkFaint }}>{label}</dt><dd style={{ color: C.ink }}>{patient.exam[k] || "—"}</dd>
                </Fragment>
              ))}
            </dl>
            <SectionTitle icon={TestTube2}>Investigations (Wife)</SectionTitle>
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              {INVEST_FIELDS.map(([k, label]) => (
                <Fragment key={k}>
                  <dt style={{ color: C.inkFaint }}>{label}</dt><dd style={{ color: C.ink }}>{patient.invest[k] || "—"}</dd>
                </Fragment>
              ))}
            </dl>
          </Card>
          <Card className="p-5 lg:col-span-2">
            <SectionTitle icon={ClipboardList}>Diagnosis & Plan</SectionTitle>
            <div className="grid sm:grid-cols-2 gap-4 text-sm mb-5">
              <div><p className="text-xs mb-1" style={{ color: C.inkFaint }}>Diagnosis</p><p style={{ color: C.ink }}>{patient.diagnosis || "—"}</p></div>
              <div><p className="text-xs mb-1" style={{ color: C.inkFaint }}>Plan of Management</p><p style={{ color: C.ink }}>{patient.planOfManagement || "—"}</p></div>
              <div><p className="text-xs mb-1" style={{ color: C.inkFaint }}>Next Follow-up</p><p style={{ color: C.ink }}>{fmtDate(patient.nextFollowUp)}</p></div>
            </div>
            <SectionTitle icon={CalendarClock} sub="OPD monitoring chart">Cycle Monitoring — Cycle No. 1, 2 & 3</SectionTitle>
            <div className="flex flex-col gap-4">
              <CycleTable label="Cycle No. 1" cycle={patient.paperCycles.cycle1} />
              <CycleTable label="Cycle No. 2" cycle={patient.paperCycles.cycle2} />
              <CycleTable label="Cycle No. 3" cycle={patient.paperCycles.cycle3} />
            </div>
          </Card>
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
              <HormoneTable title="Hormone Assays" panel={patient.hormonePanels.initial} />
              <HormoneTable title="Recepit (Repeat)" panel={patient.hormonePanels.repeat} />
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
                      <td className="py-2">{fmtDate(r.date)}</td><td className="py-2">{r.lab || "—"}</td><td className="py-2">{r.count || "—"}</td>
                      <td className="py-2">{r.motility || "—"}</td><td className="py-2">{r.pusCells || "—"}</td>
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
              {[["Laparoscopy", patient.laparoscopy], ["HSG", patient.hsg], ["Hysteroscopy", patient.hysteroscopy]].map(([l, v]) => (
                <div key={l}><p className="text-xs mb-1" style={{ color: C.inkFaint }}>{l}</p><p style={{ color: C.ink }}>{fmtDate(v.date)} — {v.findings || "—"}</p></div>
              ))}
              <div><p className="text-xs mb-1" style={{ color: C.inkFaint }}>PCR</p><p style={{ color: C.ink }}>{fmtDate(patient.pcr.date)} — {patient.pcr.result || "—"}</p></div>
              <div><p className="text-xs mb-1" style={{ color: C.inkFaint }}>CBNAAT</p><p style={{ color: C.ink }}>{fmtDate(patient.cbnaat.date)} — {patient.cbnaat.result || "—"}</p></div>
            </div>
          </Card>
        </div>
      )}

      {tab === "prescriptions" && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <SectionTitle icon={Pill}>Prescriptions</SectionTitle>
            <Btn size="sm" icon={Plus} onClick={() => setRxOpen(true)}>New Prescription</Btn>
          </div>
          <div className="flex flex-col gap-3">
            {_.orderBy(pRx, ["date"], ["desc"]).map((rx) => (
              <div key={rx.id} className="rounded-xl p-4" style={{ background: C.slateTint }}>
                <div className="flex justify-between items-center mb-2">
                  <p className="text-sm font-semibold" style={{ color: C.ink }}>{fmtDate(rx.date)}</p>
                  <p className="text-xs" style={{ color: C.inkFaint }}>{rx.doctor}</p>
                </div>
                <ul className="text-sm flex flex-col gap-1">
                  {rx.medicines.map((m) => (
                    <li key={m.id} style={{ color: C.ink }}>• {m.name} — {m.dosage}, {m.frequency}{m.duration ? `, ${m.duration}` : ""} {m.instructions && <span style={{ color: C.inkFaint }}>({m.instructions})</span>}</li>
                  ))}
                </ul>
                {rx.advice && <p className="text-xs mt-2" style={{ color: C.inkMuted }}>Advice: {rx.advice}</p>}
              </div>
            ))}
            {pRx.length === 0 && <p className="text-sm" style={{ color: C.inkFaint }}>No prescriptions recorded yet.</p>}
          </div>
          {rxOpen && <PrescriptionModal onClose={() => setRxOpen(false)} onSave={(rx) => { onAddPrescription(patient.id, rx); setRxOpen(false); }} />}
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

      {tab === "billing" && (
        <div className="flex flex-col gap-5">
          <div className="grid sm:grid-cols-4 gap-4 no-print">
            <Card className="p-4"><p className="text-xs mb-1" style={{ color: C.inkMuted }}>Total Billed</p><p className="text-2xl" style={FONT_DISPLAY}>₹{totalBilled.toLocaleString("en-IN")}</p></Card>
            <Card className="p-4"><p className="text-xs mb-1" style={{ color: C.inkMuted }}>Total Paid</p><p className="text-2xl" style={FONT_DISPLAY}>₹{totalPaid.toLocaleString("en-IN")}</p></Card>
            <Card className="p-4"><p className="text-xs mb-1" style={{ color: C.inkMuted }}>Balance Due</p><p className="text-2xl" style={FONT_DISPLAY}>₹{balance.toLocaleString("en-IN")}</p></Card>
            <Card className="p-4 flex flex-col justify-between"><p className="text-xs mb-1" style={{ color: C.inkMuted }}>Status</p><Badge tone={billStatus === "Paid" ? "green" : billStatus === "Partial" ? "gold" : billStatus === "Due" ? "brick" : "slate"}>{billStatus}</Badge></Card>
          </div>

          <Card className="p-5 print-invoice">
            <div className="flex items-center justify-between mb-1">
              <div>
                <h2 className="text-lg font-semibold" style={{ color: C.ink }}>Invoice — {patient.patientName || "Unnamed"}</h2>
                <p className="text-xs" style={{ color: C.inkFaint }}>Navjeevan Fertility & IVF Center, Krishna-Mai Hospital, Solapur · File No. {patient.fileNo || "—"} · {fmtDate(todayISO())}</p>
              </div>
              <div className="flex gap-2 no-print">
                <Btn size="sm" variant="ghost" onClick={() => window.print()}>Print / Save PDF</Btn>
                <Btn size="sm" icon={Plus} onClick={() => setBillOpen(true)}>Add Charge</Btn>
              </div>
            </div>
            <div className="overflow-x-auto emr-scroll mt-4">
              <table className="w-full text-sm">
                <thead><tr className="text-left" style={{ color: C.inkFaint }}>
                  <th className="pb-2 font-medium">Date</th><th className="pb-2 font-medium">Category</th><th className="pb-2 font-medium">Description</th>
                  <th className="pb-2 font-medium text-right">Amount</th><th className="pb-2 font-medium no-print"></th>
                </tr></thead>
                <tbody>
                  {_.orderBy(pBilling, ["date"], ["desc"]).map((b) => (
                    <tr key={b.id} style={{ borderTop: `1px solid ${C.borderSoft}` }}>
                      <td className="py-2">{fmtDate(b.date)}</td><td className="py-2"><Badge>{b.category}</Badge></td>
                      <td className="py-2">{b.description || "—"}</td><td className="py-2 text-right">₹{(Number(b.amount) || 0).toLocaleString("en-IN")}</td>
                      <td className="py-2 no-print"><button onClick={() => onRemoveBillingItem(b.id)}><Trash2 size={14} style={{ color: C.inkFaint }} /></button></td>
                    </tr>
                  ))}
                  {pBilling.length === 0 && <tr><td colSpan={5} className="py-4 text-center" style={{ color: C.inkFaint }}>No charges recorded yet.</td></tr>}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: `2px solid ${C.border}` }}>
                    <td colSpan={3} className="py-2 text-right font-semibold" style={{ color: C.ink }}>Total Billed</td>
                    <td className="py-2 text-right font-semibold" style={{ color: C.ink }}>₹{totalBilled.toLocaleString("en-IN")}</td><td className="no-print"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between mb-3 no-print">
              <SectionTitle icon={ClipboardList}>Payments Received</SectionTitle>
              <Btn size="sm" variant="subtle" icon={Plus} onClick={() => setPayOpen(true)}>Record Payment</Btn>
            </div>
            <div className="overflow-x-auto emr-scroll">
              <table className="w-full text-sm">
                <thead><tr className="text-left" style={{ color: C.inkFaint }}>
                  <th className="pb-2 font-medium">Date</th><th className="pb-2 font-medium">Mode</th><th className="pb-2 font-medium">Note</th>
                  <th className="pb-2 font-medium text-right">Amount</th><th className="pb-2 font-medium no-print"></th>
                </tr></thead>
                <tbody>
                  {_.orderBy(pPayments, ["date"], ["desc"]).map((p) => (
                    <tr key={p.id} style={{ borderTop: `1px solid ${C.borderSoft}` }}>
                      <td className="py-2">{fmtDate(p.date)}</td><td className="py-2">{p.mode}</td><td className="py-2">{p.note || "—"}</td>
                      <td className="py-2 text-right">₹{(Number(p.amount) || 0).toLocaleString("en-IN")}</td>
                      <td className="py-2 no-print"><button onClick={() => onRemovePayment(p.id)}><Trash2 size={14} style={{ color: C.inkFaint }} /></button></td>
                    </tr>
                  ))}
                  {pPayments.length === 0 && <tr><td colSpan={5} className="py-4 text-center" style={{ color: C.inkFaint }}>No payments recorded yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
          {billOpen && <BillingItemModal onClose={() => setBillOpen(false)} onSave={(item) => { onAddBillingItem(patient.id, item); setBillOpen(false); }} />}
          {payOpen && <PaymentModal onClose={() => setPayOpen(false)} onSave={(p) => { onAddPayment(patient.id, p); setPayOpen(false); }} />}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------
   Modals
--------------------------------------------------------------------- */
function ModalShell({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(20,30,27,0.45)" }}>
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

function PrescriptionModal({ onClose, onSave }) {
  const [date, setDate] = useState(todayISO());
  const [doctor, setDoctor] = useState("");
  const [advice, setAdvice] = useState("");
  const [meds, setMeds] = useState([{ id: uid(), name: "", dosage: "", frequency: "", duration: "", instructions: "" }]);
  const addMed = () => setMeds([...meds, { id: uid(), name: "", dosage: "", frequency: "", duration: "", instructions: "" }]);
  const updMed = (id, k, v) => setMeds(meds.map((m) => m.id === id ? { ...m, [k]: v } : m));
  const rmMed = (id) => setMeds(meds.filter((m) => m.id !== id));

  return (
    <ModalShell title="New Prescription" onClose={onClose} wide>
      <div className="grid sm:grid-cols-2 gap-4 mb-4">
        <TextField label="Date" type="date" value={date} onChange={setDate} />
        <TextField label="Prescribing Doctor" value={doctor} onChange={setDoctor} />
      </div>
      <p className="text-xs font-medium mb-2" style={{ color: C.inkMuted }}>Medicines</p>
      <div className="flex flex-col gap-3 mb-3">
        {meds.map((m) => (
          <div key={m.id} className="grid sm:grid-cols-5 gap-2 items-start rounded-xl p-3" style={{ background: C.slateTint }}>
            <DropdownOtherField label="Drug Name" value={m.name} onChange={(v) => updMed(m.id, "name", v)} options={DRUG_OPTIONS} />
            <DropdownOtherField label="Dose" value={m.dosage} onChange={(v) => updMed(m.id, "dosage", v)} options={DOSE_OPTIONS} />
            <DropdownOtherField label="Frequency" value={m.frequency} onChange={(v) => updMed(m.id, "frequency", v)} options={FREQUENCY_OPTIONS} />
            <DropdownOtherField label="Duration" value={m.duration} onChange={(v) => updMed(m.id, "duration", v)} options={DURATION_OPTIONS} />
            <div className="flex gap-2 items-start">
              <TextField label="Instructions" value={m.instructions} onChange={(v) => updMed(m.id, "instructions", v)} />
              <button onClick={() => rmMed(m.id)} className="pt-6"><Trash2 size={15} style={{ color: C.inkFaint }} /></button>
            </div>
          </div>
        ))}
      </div>
      <Btn size="sm" variant="subtle" icon={Plus} onClick={addMed}>Add Medicine</Btn>
      <div className="mt-4"><TextAreaField label="General Advice" value={advice} onChange={setAdvice} full /></div>
      <div className="flex justify-end gap-2 mt-5">
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn icon={Save} onClick={() => onSave({ id: uid(), date, doctor, advice, medicines: meds.filter((m) => m.name) })}>Save Prescription</Btn>
      </div>
    </ModalShell>
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

function BillingItemModal({ onClose, onSave }) {
  const [date, setDate] = useState(todayISO());
  const [category, setCategory] = useState(BILLING_CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  return (
    <ModalShell title="Add Charge" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <TextField label="Date" type="date" value={date} onChange={setDate} />
        <SelectField label="Category" value={category} onChange={setCategory} options={BILLING_CATEGORIES} />
        <TextField label="Description" value={description} onChange={setDescription} placeholder="e.g. IUI Cycle 2 — procedure charge" />
        <TextField label="Amount (₹)" type="number" value={amount} onChange={setAmount} />
      </div>
      <div className="flex justify-end gap-2 mt-5">
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn icon={Save} onClick={() => onSave({ id: uid(), date, category, description, amount })} disabled={!amount}>Save Charge</Btn>
      </div>
    </ModalShell>
  );
}

function PaymentModal({ onClose, onSave }) {
  const [date, setDate] = useState(todayISO());
  const [mode, setMode] = useState(PAYMENT_MODES[0]);
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState("");
  return (
    <ModalShell title="Record Payment" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <TextField label="Date" type="date" value={date} onChange={setDate} />
        <SelectField label="Mode" value={mode} onChange={setMode} options={PAYMENT_MODES} />
        <TextField label="Note" value={note} onChange={setNote} placeholder="e.g. Advance for IVF cycle" />
        <TextField label="Amount (₹)" type="number" value={amount} onChange={setAmount} />
      </div>
      <div className="flex justify-end gap-2 mt-5">
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn icon={Save} onClick={() => onSave({ id: uid(), date, mode, note, amount })} disabled={!amount}>Save Payment</Btn>
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
  const [billingItems, setBillingItems] = useState([]);
  const [payments, setPayments] = useState([]);
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

  // Desktop build: no auto-login. Every launch requires a password —
  // this is a deliberate choice for shared clinic front-desk computers.
  useEffect(() => {
    (async () => {
      const p = await storageGet("patients", []);
      const rx = await storageGet("prescriptions", []);
      const cy = await storageGet("cycles", []);
      const bi = await storageGet("billingItems", []);
      const pay = await storageGet("payments", []);
      setPatients(p);
      setPrescriptions(rx);
      setCycles(cy);
      setBillingItems(bi);
      setPayments(pay);
      setLoading(false);
    })();
  }, []);

  const persistPatients = async (next) => { setPatients(next); await storageSet("patients", next); };
  const persistRx = async (next) => { setPrescriptions(next); await storageSet("prescriptions", next); };
  const persistCycles = async (next) => { setCycles(next); await storageSet("cycles", next); };
  const persistBilling = async (next) => { setBillingItems(next); await storageSet("billingItems", next); };
  const persistPayments = async (next) => { setPayments(next); await storageSet("payments", next); };

  const handleLogin = async (username, password) => {
  const api = window?.api;

  // Web/Vercel preview mode
  if (typeof api?.login !== "function") {
    setCurrentUser({
      username: username.trim() || "preview",
      fullName: "Preview User",
      role: "UI Preview",
    });
    setView("dashboard");
    setSelectedId(null);
    setEditingPatient(null);
    setMobileOpen(false);
    setBackupsOpen(false);
    return true;
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
      return true;
    } catch (error) {
      // LoginView presents this as a service problem, not a bad password.
      throw new Error("Sign-in service could not be reached. Restart the desktop application and try again.");
    }
  };
  const handleLogout = () => {
    // Clear user-specific navigation and overlays so they cannot reappear on re-login.
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

  const refreshBackups = async () => setBackupsList(await window.api.backupList());
  const openBackups = async () => { await refreshBackups(); setBackupsOpen(true); };
  const runBackupNow = async () => {
    setBackupBusy(true);
    await window.api.backupRun();
    await refreshBackups();
    setBackupBusy(false);
    showToast("Backup complete.");
  };
  const restoreBackup = async (snapshotName) => {
    if (!window.confirm(`Restore "${snapshotName}"? Any changes made after this backup will be lost.`)) return;
    await window.api.backupRestore(snapshotName);
    showToast("Backup restored. Reloading…");
    setTimeout(() => window.location.reload(), 800);
  };

  const openPatient = (id) => { setSelectedId(id); setView("patientDetail"); };

  const savePatient = async (data) => {
    const exists = patients.some((p) => p.id === data.id);
    const next = exists ? patients.map((p) => (p.id === data.id ? data : p)) : [...patients, data];
    await persistPatients(next);
    showToast(exists ? "Patient updated." : "Patient registered.");
    setEditingPatient(null);
    setSelectedId(data.id);
    setView("patientDetail");
  };
  const deletePatient = async (id) => {
    await persistPatients(patients.filter((p) => p.id !== id));
    await persistRx(prescriptions.filter((r) => r.patientId !== id));
    await persistCycles(cycles.filter((c) => c.patientId !== id));
    await persistBilling(billingItems.filter((b) => b.patientId !== id));
    await persistPayments(payments.filter((p) => p.patientId !== id));
    showToast("Patient record removed.");
  };

  const addPrescription = async (patientId, rx) => {
    await persistRx([...prescriptions, { ...rx, patientId }]);
    showToast("Prescription saved.");
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
    await persistPatients(next);
    showToast("Semen analysis report added.");
  };
  const addBillingItem = async (patientId, item) => {
    await persistBilling([...billingItems, { ...item, patientId }]);
    showToast("Charge added to bill.");
  };
  const removeBillingItem = async (id) => {
    await persistBilling(billingItems.filter((b) => b.id !== id));
    showToast("Charge removed.");
  };
  const addPayment = async (patientId, p) => {
    await persistPayments([...payments, { ...p, patientId }]);
    showToast("Payment recorded.");
  };
  const removePayment = async (id) => {
    await persistPayments(payments.filter((p) => p.id !== id));
    showToast("Payment entry removed.");
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
        {view === "dashboard" && <Dashboard patients={patients} billingItems={billingItems} payments={payments} setView={setView} openPatient={openPatient} />}
        {view === "patients" && <PatientsList patients={patients} openPatient={openPatient} setView={setView} deletePatient={deletePatient} />}
        {view === "newPatient" && <PatientForm onSave={savePatient} onCancel={() => setView("patients")} />}
        {view === "editPatient" && selected && <PatientForm initial={selected} onSave={savePatient} onCancel={() => { setView("patientDetail"); }} />}
        {view === "patientDetail" && selected && (
          <PatientDetail
            patient={selected}
            prescriptions={prescriptions}
            cycles={cycles}
            billingItems={billingItems}
            payments={payments}
            onBack={() => setView("patients")}
            onEdit={() => setView("editPatient")}
            onAddPrescription={addPrescription}
            onAddCycle={addCycle}
            onAddMonitoring={addMonitoring}
            onAddSemen={(pid) => setSemenModalFor(pid)}
            onAddBillingItem={addBillingItem}
            onRemoveBillingItem={removeBillingItem}
            onAddPayment={addPayment}
            onRemovePayment={removePayment}
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
          onOpenFolder={() => window.api.backupOpenFolder()} busy={backupBusy} />
      )}
      <Toast toast={toast} />
    </div>
  );
}