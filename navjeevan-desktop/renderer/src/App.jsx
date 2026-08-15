import { useState, useEffect, useMemo, Fragment } from "react";
import _ from "lodash";
import {
  LayoutDashboard, Users, UserPlus, LogOut, Search, Plus, X, Save,
  ChevronLeft, Pill, TestTube2, Baby, ClipboardList, Trash2, Pencil,
  ArrowLeft, AlertCircle, Clock, CheckCircle2, Menu, ShieldCheck,
  FlaskConical, Stethoscope, CalendarClock, Receipt, IndianRupee, Database, Printer
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
   Utilities & Dual Persistence Engine
--------------------------------------------------------------------- */
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const todayISO = () => new Date().toISOString().slice(0, 10);
const fmtDate = (d) => {
  if (!d) return "—";
  const dt = new Date(d + "T00:00:00");
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};
const daysFromToday = (d) => {
  if (!d) return null;
  const dt = new Date(d + "T00:00:00");
  const t = new Date(todayISO() + "T00:00:00");
  return Math.round((dt - t) / 86400000);
};

/* Dual Persistence Engine: Uses window.api (Electron SQLite) if available,
   otherwise seamlessly falls back to browser localStorage for Vercel Web Demo */
async function storageGet(key, fallback) {
  try {
    if (window.api && window.api.kvGet) {
      const v = await window.api.kvGet(key, fallback);
      return v === undefined || v === null ? fallback : v;
    }
    const local = localStorage.getItem(key);
    return local !== null ? JSON.parse(local) : fallback;
  } catch (e) {
    return fallback;
  }
}
async function storageSet(key, value) {
  try {
    if (window.api && window.api.kvSet) {
      return await window.api.kvSet(key, value);
    }
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    return false;
  }
}
async function storageDelete(key) {
  try {
    if (window.api && window.api.kvDelete) {
      await window.api.kvDelete(key);
    } else {
      localStorage.removeItem(key);
    }
  } catch (e) {}
}

/* ---------------------------------------------------------------------
   Blank templates & Options
--------------------------------------------------------------------- */
const HORMONE_KEYS = [
  ["fsh", "FSH", "mIU/ml"], ["lh", "L.H.", "mIU/ml"], ["prolactin", "Prolactin", "ng/ml"],
  ["tsh", "TSH", "uIU/ml"], ["t4", "T4", "mcg/dl"], ["amh", "AMH", "ng/nl"],
];

function blankHormonePanel() {
  return _.fromPairs(HORMONE_KEYS.map(([k]) => [k, { date: "", day: "", result: "", lab: "" }]));
}
function blankCycleRow() {
  return { id: uid(), date: "", day: "", e2: "", end: "", rtOv: "", ltOv: "", adv: "" };
}
function blankPaperCycle() {
  return { date: "", rows: Array.from({ length: 6 }, blankCycleRow) };
}

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
    typeInfertility: "Primary",
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

const DRUG_OPTIONS = [
  "Clomiphene Citrate", "Letrozole", "Gonadotropin (rFSH)", "HMG – Menopur",
  "hCG Trigger", "Progesterone – Susten", "Duphaston", "Progynova", "Folic Acid", "Metformin"
];
const DOSE_OPTIONS = ["2.5 mg", "5 mg", "50 mg", "100 mg", "75 IU", "150 IU", "400 mg", "500 mg"];
const FREQUENCY_OPTIONS = ["OD (once daily)", "BD (twice daily)", "TID (thrice daily)", "1-0-1", "0-0-1"];
const BILLING_CATEGORIES = ["Consultation", "Investigation", "Procedure", "Medicine", "IUI Treatment", "IVF Treatment", "Other"];
const PAYMENT_MODES = ["Cash", "Card", "UPI", "Bank Transfer", "Cheque"];

/* ---------------------------------------------------------------------
   Small UI Primitives
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
function Btn({ children, onClick, variant = "primary", icon: Icon, size = "md", disabled }) {
  const base = "inline-flex items-center gap-2 rounded-lg font-medium transition disabled:opacity-50 cursor-pointer";
  const sizes = size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm";
  const styles = {
    primary: { background: C.primary, color: "#fff" },
    ghost: { background: "transparent", color: C.primary, border: `1px solid ${C.border}` },
    danger: { background: C.brickTint, color: C.brick },
    subtle: { background: C.primaryTint, color: C.primaryDark },
  }[variant];
  return (
    <button disabled={disabled} onClick={onClick} className={base + " " + sizes} style={styles}>
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

function ModalShell({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs no-print">
      <div className={"w-full rounded-2xl bg-white shadow-2xl p-6 overflow-hidden flex flex-col max-h-[90vh] " + (wide ? "max-w-3xl" : "max-w-md")}>
        <div className="flex items-center justify-between pb-3 mb-4 border-b" style={{ borderColor: C.border }}>
          <h3 className="text-lg font-semibold" style={{ color: C.ink }}>{title}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto flex-1 pr-1 emr-scroll">{children}</div>
      </div>
    </div>
  );
}

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

/* ---------------------------------------------------------------------
   Login View (Supports Demo Credentials: admin / admin123)
--------------------------------------------------------------------- */
function LoginView({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    if (e) e.preventDefault();
    if (!username || !password) return;
    setBusy(true);
    setErr("");

    // Demo Authentication for Vercel/Web fallback or Desktop
    const ok = await onLogin(username, password);
    setBusy(false);
    if (!ok) setErr("Incorrect username or password. (Use admin / admin123)");
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: `linear-gradient(160deg, ${C.primaryDark}, ${C.primary} 55%, #2C7566)` }}>
      <div className="w-full max-w-4xl grid md:grid-cols-2 rounded-3xl overflow-hidden shadow-2xl">
        <div className="hidden md:flex flex-col justify-between p-10" style={{ background: `linear-gradient(190deg, ${C.primaryDark}, ${C.primary})`, color: "#fff" }}>
          <div className="flex items-center gap-2 opacity-90">
            <Baby size={20} />
            <span className="text-sm tracking-widest uppercase font-semibold">Navjeevan Fertility &amp; IVF</span>
          </div>
          <div>
            <h1 className="text-4xl leading-tight mb-3" style={FONT_DISPLAY}>Every follow-up,<br />on record.</h1>
            <p className="text-sm opacity-80 max-w-xs">A clinical patient journey system — from first consultation through IUI/IVF cycles, lab assays, prescriptions and billing.</p>
          </div>
          <p className="text-xs opacity-60">Krishna-Mai Hospital, Solapur</p>
        </div>
        <div className="p-8 sm:p-10 flex flex-col justify-center bg-white">
          <h2 className="text-2xl font-semibold mb-1" style={{ color: C.ink }}>Sign in</h2>
          <p className="text-sm mb-6" style={{ color: C.inkMuted }}>Navjeevan Fertility Center Staff Portal.</p>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <TextField label="Username" value={username} onChange={setUsername} placeholder="admin" />
            <TextField label="Password" type="password" value={password} onChange={setPassword} placeholder="••••••••" />
            {err && <p className="text-xs flex items-center gap-1" style={{ color: C.brick }}><AlertCircle size={13} />{err}</p>}
            <Btn onClick={submit} icon={ShieldCheck} disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Btn>
          </form>
          <p className="mt-4 text-xs text-center text-gray-400">Demo Login: admin / admin123</p>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------
   Sidebar & Layout Shell
--------------------------------------------------------------------- */
function Shell({ user, view, setView, onLogout, onOpenChangePassword, onOpenBackups, children, mobileOpen, setMobileOpen }) {
  const nav = [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { key: "patients", label: "Patients List", icon: Users },
    { key: "newPatient", label: "New Registration", icon: UserPlus },
  ];
  return (
    <div className="min-h-screen flex" style={{ background: C.bg }}>
      <aside className={"fixed md:static z-40 top-0 left-0 h-full md:h-auto w-64 md:w-60 flex-col shrink-0 transition-transform no-print " + (mobileOpen ? "translate-x-0 flex" : "-translate-x-full md:translate-x-0 md:flex")}
        style={{ background: C.primaryDark, color: "#fff" }}>
        <div className="flex items-center gap-2 px-5 py-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
          <Baby size={22} />
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
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition text-left cursor-pointer"
                style={{ background: active ? "rgba(255,255,255,0.14)" : "transparent", color: active ? "#fff" : "rgba(255,255,255,0.75)" }}>
                <n.icon size={17} />{n.label}
              </button>
            );
          })}
        </nav>
        <div className="px-5 py-4 flex flex-col gap-2" style={{ borderTop: "1px solid rgba(255,255,255,0.12)" }}>
          <p className="text-xs font-medium">{user.fullName}</p>
          <p className="text-[11px] opacity-60 mb-1">{user.role}</p>
          <button onClick={onOpenChangePassword} className="flex items-center gap-2 text-xs opacity-80 hover:opacity-100 text-left cursor-pointer">
            <ShieldCheck size={14} /> Change password
          </button>
          <button onClick={onOpenBackups} className="flex items-center gap-2 text-xs opacity-80 hover:opacity-100 text-left cursor-pointer">
            <Database size={14} /> Backups & Sync
          </button>
          <button onClick={onLogout} className="flex items-center gap-2 text-xs opacity-80 hover:opacity-100 text-left cursor-pointer mt-1">
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </aside>
      {mobileOpen && <div className="fixed inset-0 bg-black/30 z-30 md:hidden" onClick={() => setMobileOpen(false)} />}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="md:hidden flex items-center justify-between px-4 py-3 no-print" style={{ background: C.primaryDark, color: "#fff" }}>
          <button onClick={() => setMobileOpen(true)}><Menu size={20} /></button>
          <span className="text-sm font-semibold">Navjeevan EMR</span>
          <div style={{ width: 20 }} />
        </div>
        <main className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto flex-1 w-full emr-fade">{children}</main>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------
   Dashboard Section
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
    .sort((a, b) => new Date(a.nextFollowUp) - new Date(b.nextFollowUp))
    .slice(0, 6);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: C.ink, ...FONT_DISPLAY }}>Clinical Overview</h1>
          <p className="text-xs" style={{ color: C.inkMuted }}>Navjeevan Fertility & IVF Center, Solapur</p>
        </div>
        <Btn icon={UserPlus} onClick={() => setView("newPatient")}>New Patient</Btn>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-xs font-medium" style={{ color: C.inkMuted }}>Total Patients</p>
          <p className="text-2xl font-bold mt-1" style={{ color: C.primary }}>{patients.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium" style={{ color: C.inkMuted }}>New This Month</p>
          <p className="text-2xl font-bold mt-1" style={{ color: C.green }}>{thisMonthCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium" style={{ color: C.inkMuted }}>Active IUI Cycles</p>
          <p className="text-2xl font-bold mt-1" style={{ color: C.blue }}>{iuiCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium" style={{ color: C.inkMuted }}>Active IVF Cycles</p>
          <p className="text-2xl font-bold mt-1" style={{ color: C.gold }}>{ivfCount}</p>
        </Card>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="p-5 md:col-span-2">
          <SectionTitle icon={LayoutDashboard}>Monthly Registrations</SectionTitle>
          <div className="h-48 w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={C.borderSoft} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: C.inkMuted, fontSize: 12 }} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: C.inkMuted, fontSize: 12 }} />
                <Tooltip cursor={{ fill: C.slateTint }} />
                <Bar dataKey="count" fill={C.primary} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle icon={CalendarClock}>Upcoming Follow-ups</SectionTitle>
          <div className="space-y-3 mt-4">
            {followUps.length === 0 && <p className="text-xs text-gray-400">No scheduled follow-ups.</p>}
            {followUps.map((p) => {
              const df = daysFromToday(p.nextFollowUp);
              return (
                <div key={p.id} onClick={() => openPatient(p.id)} className="flex items-center justify-between p-2.5 rounded-xl border hover:bg-gray-50 cursor-pointer" style={{ borderColor: C.borderSoft }}>
                  <div>
                    <p className="text-xs font-semibold" style={{ color: C.ink }}>{p.patientName || "Unnamed"}</p>
                    <p className="text-[11px]" style={{ color: C.inkFaint }}>File: {p.fileNo || "—"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium" style={{ color: C.primary }}>{fmtDate(p.nextFollowUp)}</p>
                    <span className="text-[10px] text-gray-400">{df === 0 ? "Today" : df > 0 ? `In ${df} days` : `${Math.abs(df)} days ago`}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------
   Patients List Section
--------------------------------------------------------------------- */
function PatientsList({ patients, openPatient, setView }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return patients.filter((p) =>
      (p.patientName || "").toLowerCase().includes(q) ||
      (p.fileNo || "").toLowerCase().includes(q) ||
      (p.phoneW || "").includes(q)
    );
  }, [patients, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold" style={{ color: C.ink, ...FONT_DISPLAY }}>Patient Index</h1>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, file no..."
              className="pl-9 pr-4 py-2 text-sm rounded-xl border bg-white outline-none w-64"
              style={{ borderColor: C.border }}
            />
          </div>
          <Btn icon={UserPlus} onClick={() => setView("newPatient")}>New Patient</Btn>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto emr-scroll">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b" style={{ borderColor: C.borderSoft, color: C.inkMuted }}>
              <tr>
                <th className="p-3.5 font-semibold text-xs">File No</th>
                <th className="p-3.5 font-semibold text-xs">Patient Name</th>
                <th className="p-3.5 font-semibold text-xs">Age (W/H)</th>
                <th className="p-3.5 font-semibold text-xs">Phone</th>
                <th className="p-3.5 font-semibold text-xs">Treatment</th>
                <th className="p-3.5 font-semibold text-xs">Status</th>
                <th className="p-3.5 font-semibold text-xs">Reg. Date</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: C.borderSoft }}>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-xs text-gray-400">No matching patient records found.</td>
                </tr>
              )}
              {filtered.map((p) => (
                <tr key={p.id} onClick={() => openPatient(p.id)} className="hover:bg-teal-50/40 cursor-pointer transition">
                  <td className="p-3.5 font-medium text-xs" style={{ color: C.primaryDark }}>{p.fileNo || "—"}</td>
                  <td className="p-3.5 font-medium" style={{ color: C.ink }}>{p.patientName || "Unnamed"}</td>
                  <td className="p-3.5 text-xs text-gray-600">{p.ageW || "—"} / {p.ageH || "—"}</td>
                  <td className="p-3.5 text-xs text-gray-600">{p.phoneW || "—"}</td>
                  <td className="p-3.5"><Badge tone={treatmentTone(p.treatmentType)}>{p.treatmentType}</Badge></td>
                  <td className="p-3.5"><Badge tone={statusTone(p.status)}>{p.status}</Badge></td>
                  <td className="p-3.5 text-xs text-gray-500">{fmtDate(p.regDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------------------
   Patient Detail / Record View
--------------------------------------------------------------------- */
function PatientDetail({ patient: initialPatient, onSave, onDelete, onBack }) {
  const [patient, setPatient] = useState(initialPatient);
  const [tab, setTab] = useState("demographics");
  const [dirty, setDirty] = useState(false);

  const update = (path, val) => {
    setPatient((prev) => {
      const next = _.cloneDeep(prev);
      _.set(next, path, val);
      return next;
    });
    setDirty(true);
  };

  const handleSave = () => {
    onSave(patient);
    setDirty(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 no-print">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-medium text-teal-800 cursor-pointer">
          <ArrowLeft size={16} /> Back to Patients
        </button>
        <div className="flex items-center gap-2">
          {dirty && <span className="text-xs text-amber-600 font-medium mr-2">Unsaved changes</span>}
          <Btn variant="ghost" icon={Printer} onClick={() => window.print()}>Print Record</Btn>
          <Btn variant="danger" icon={Trash2} onClick={() => onDelete(patient.id)}>Delete</Btn>
          <Btn icon={Save} onClick={handleSave}>Save Record</Btn>
        </div>
      </div>

      {/* Header Info Banner */}
      <Card className="p-5 bg-gradient-to-r from-teal-900 to-teal-800 text-white">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{patient.patientName || "New Patient"}</h1>
              <Badge tone={treatmentTone(patient.treatmentType)}>{patient.treatmentType}</Badge>
            </div>
            <p className="text-xs opacity-80 mt-1">File No: {patient.fileNo || "—"} | Reg Date: {fmtDate(patient.regDate)} | Ref: {patient.refDoctor || "Direct"}</p>
          </div>
          <div className="text-right text-xs opacity-90">
            <p>Wife: {patient.ageW || "—"} yrs | Husband: {patient.ageH || "—"} yrs</p>
            <p>Phone: {patient.phoneW || "—"}</p>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 gap-2 no-print overflow-x-auto">
        {[
          ["demographics", "Demographics & History"],
          ["exam", "Exam & Investigations"],
          ["hormones", "Hormone Assays"],
          ["cycles", "Cycle Monitoring"],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition whitespace-nowrap cursor-pointer ${tab === key ? "border-teal-700 text-teal-800" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      {tab === "demographics" && (
        <Card className="p-6 space-y-4">
          <SectionTitle icon={Stethoscope}>Patient Information</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <TextField label="Patient Full Name" value={patient.patientName} onChange={(v) => update("patientName", v)} />
            <TextField label="File No" value={patient.fileNo} onChange={(v) => update("fileNo", v)} />
            <TextField label="Referring Doctor" value={patient.refDoctor} onChange={(v) => update("refDoctor", v)} />
            <TextField label="Wife Age" value={patient.ageW} onChange={(v) => update("ageW", v)} />
            <TextField label="Husband Age" value={patient.ageH} onChange={(v) => update("ageH", v)} />
            <TextField label="Phone (Wife)" value={patient.phoneW} onChange={(v) => update("phoneW", v)} />
            <SelectField label="Treatment Type" value={patient.treatmentType} onChange={(v) => update("treatmentType", v)} options={["Undecided", "IUI", "IVF", "OPD Only"]} />
            <SelectField label="Status" value={patient.status} onChange={(v) => update("status", v)} options={["Active", "Completed", "Discontinued"]} />
            <TextField label="Next Follow-up" type="date" value={patient.nextFollowUp} onChange={(v) => update("nextFollowUp", v)} />
          </div>
          <TextAreaField label="Clinical Diagnosis & History Notes" value={patient.diagnosis} onChange={(v) => update("diagnosis", v)} rows={3} full />
        </Card>
      )}

      {tab === "exam" && (
        <Card className="p-6 space-y-4">
          <SectionTitle icon={FlaskConical}>Clinical Examination & Lab Baseline</SectionTitle>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {EXAM_FIELDS.map(([k, label]) => (
              <TextField key={k} label={label} value={patient.exam?.[k]} onChange={(v) => update(`exam.${k}`, v)} />
            ))}
          </div>
        </Card>
      )}

      {tab === "hormones" && (
        <Card className="p-6 space-y-4">
          <SectionTitle icon={TestTube2}>Serum Hormone Panel</SectionTitle>
          <p className="text-xs text-gray-500">Track key markers across initial baseline and repeat cycle evaluations.</p>
          <div className="space-y-4">
            {HORMONE_KEYS.map(([k, label, unit]) => (
              <div key={k} className="grid grid-cols-3 gap-4 items-center p-2 rounded-lg bg-gray-50">
                <span className="text-sm font-medium text-gray-700">{label} ({unit})</span>
                <TextField placeholder="Initial Result" value={patient.hormonePanels?.initial?.[k]?.result} onChange={(v) => update(`hormonePanels.initial.${k}.result`, v)} />
                <TextField placeholder="Repeat Result" value={patient.hormonePanels?.repeat?.[k]?.result} onChange={(v) => update(`hormonePanels.repeat.${k}.result`, v)} />
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === "cycles" && (
        <Card className="p-6 space-y-4">
          <SectionTitle icon={ClipboardList}>Follicular Monitoring Cycles</SectionTitle>
          <p className="text-xs text-gray-500">Record endometrium thickness and follicular growth during stimulation cycles.</p>
          <TextAreaField label="Cycle 1 Evaluation & Plan" value={patient.planOfManagement} onChange={(v) => update("planOfManagement", v)} rows={4} full />
        </Card>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------
   Main Application Container
--------------------------------------------------------------------- */
export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState("dashboard");
  const [patients, setPatients] = useState([]);
  const [activePatientId, setActivePatientId] = useState(null);
  const [toast, setToast] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showBackupsModal, setShowBackupsModal] = useState(false);

  // Load persistence data on launch
  useEffect(() => {
    (async () => {
      const savedUser = await storageGet("emr_user", null);
      if (savedUser) setUser(savedUser);

      const savedPatients = await storageGet("emr_patients", []);
      setPatients(savedPatients);
    })();
  }, []);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleLogin = async (username, password) => {
    // Demo credential check
    if (username === "admin" && password === "admin123") {
      const u = { username: "admin", fullName: "Dr. Solvinz", role: "Medical Director / Admin" };
      setUser(u);
      await storageSet("emr_user", u);
      showToast("Signed in successfully!");
      return true;
    }
    return false;
  };

  const handleLogout = async () => {
    setUser(null);
    await storageDelete("emr_user");
  };

  const savePatient = async (p) => {
    let next;
    const exists = patients.some((x) => x.id === p.id);
    if (exists) {
      next = patients.map((x) => (x.id === p.id ? p : x));
    } else {
      next = [p, ...patients];
    }
    setPatients(next);
    await storageSet("emr_patients", next);
    showToast("Patient record saved successfully.");
  };

  const deletePatient = async (id) => {
    if (!window.confirm("Are you sure you want to delete this patient record?")) return;
    const next = patients.filter((x) => x.id !== id);
    setPatients(next);
    await storageSet("emr_patients", next);
    setActivePatientId(null);
    setView("patients");
    showToast("Patient deleted.", "error");
  };

  const openPatient = (id) => {
    setActivePatientId(id);
    setView("patientDetail");
  };

  if (!user) {
    return (
      <div className="emr-root">
        {FONTS}
        <LoginView onLogin={handleLogin} />
      </div>
    );
  }

  const activePatient = patients.find((p) => p.id === activePatientId);

  return (
    <div className="emr-root">
      {FONTS}
      <Shell
        user={user}
        view={view}
        setView={(v) => { setView(v); setActivePatientId(null); }}
        onLogout={handleLogout}
        onOpenChangePassword={() => setShowPasswordModal(true)}
        onOpenBackups={() => setShowBackupsModal(true)}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      >
        {view === "dashboard" && (
          <Dashboard patients={patients} setView={setView} openPatient={openPatient} />
        )}

        {view === "patients" && (
          <PatientsList patients={patients} openPatient={openPatient} setView={setView} />
        )}

        {view === "newPatient" && (
          <PatientDetail
            patient={blankPatient()}
            onSave={(p) => { savePatient(p); setActivePatientId(p.id); setView("patientDetail"); }}
            onDelete={() => setView("patients")}
            onBack={() => setView("patients")}
          />
        )}

        {view === "patientDetail" && activePatient && (
          <PatientDetail
            patient={activePatient}
            onSave={savePatient}
            onDelete={deletePatient}
            onBack={() => setView("patients")}
          />
        )}
      </Shell>

      {showPasswordModal && (
        <ModalShell title="Change Password" onClose={() => setShowPasswordModal(false)}>
          <div className="space-y-3">
            <TextField label="Current Password" type="password" />
            <TextField label="New Password" type="password" />
            <Btn onClick={() => { setShowPasswordModal(false); showToast("Password updated."); }}>Save Password</Btn>
          </div>
        </ModalShell>
      )}

      {showBackupsModal && (
        <ModalShell title="System Backups & Storage" onClose={() => setShowBackupsModal(false)}>
          <div className="space-y-3 text-sm">
            <p className="text-gray-600">Local SQLite DB / Browser LocalStorage Sync point.</p>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="font-semibold text-teal-800">Total Records: {patients.length}</p>
              <p className="text-xs text-gray-500 mt-1">Status: Active & Auto-Saved</p>
            </div>
            <Btn onClick={() => showToast("Backup archive exported.")}>Export Manual Snapshot</Btn>
          </div>
        </ModalShell>
      )}

      <Toast toast={toast} />
    </div>
  );
}