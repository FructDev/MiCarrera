"use client";

import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  Filter,
  GraduationCap,
  LayoutDashboard,
  LockKeyhole,
  Menu,
  Moon,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  Target,
  Trash2,
  TrendingUp,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type CourseStatus =
  | "passed"
  | "in_progress"
  | "pending"
  | "failed"
  | "withdrawn"
  | "transferred";

type Course = {
  id: string;
  code: string;
  name: string;
  credits: number;
  term: number;
  status: CourseStatus;
  grade?: number;
  progress?: number;
  prerequisites: string[];
  attempts: number;
  notes?: string;
};

type Profile = {
  studentName: string;
  university: string;
  degree: string;
  studentId: string;
  startYear: number;
  totalCredits: number;
  scale: 4 | 5;
  passingGrade: number;
  periodLabel: "Semestre" | "Cuatrimestre" | "Trimestre";
  graduationDate: string;
};

type PlannedCourse = { courseId: string; term: string; expectedGrade: number };
type DocumentMeta = { id: string; name: string; type: string; date: string; rows: number };
type AppData = {
  profile: Profile;
  courses: Course[];
  plans: PlannedCourse[];
  documents: DocumentMeta[];
};

type Metrics = {
  approved: Course[];
  inProgress: Course[];
  pending: Course[];
  failed: Course[];
  approvedCredits: number;
  progress: number;
  index: number;
};

type ImportedCourse = Partial<Course> & { name: string };

const COURSE_NAMES = [
  "Orientación Universitaria", "Matemática I", "Introducción a la Programación", "Lengua Española", "Inglés I",
  "Matemática II", "Programación I", "Física General", "Redacción Técnica", "Inglés II",
  "Matemática Discreta", "Programación II", "Estadística", "Circuitos Digitales", "Ética Profesional",
  "Estructuras de Datos", "Bases de Datos I", "Sistemas Operativos", "Contabilidad General", "Metodología de la Investigación",
  "Ingeniería de Software I", "Redes de Computadoras", "Diseño de Interfaces", "Arquitectura de Computadores", "Electiva I",
  "Desarrollo Web", "Análisis de Algoritmos", "Administración de Bases de Datos", "Gestión de Proyectos TI", "Electiva II",
  "Desarrollo Móvil", "Computación en la Nube", "Inteligencia Artificial", "Calidad de Software",
  "Programación III", "Bases de Datos II", "Seguridad de la Información", "Ingeniería de Software II", "Emprendimiento Tecnológico",
  "Ciencia de Datos", "DevOps", "Auditoría de Sistemas", "Electiva III", "Práctica Profesional",
  "Sistemas Distribuidos", "Gobierno de TI", "Seminario de Grado", "Electiva IV", "Investigación Aplicada",
  "Trabajo de Grado I", "Trabajo de Grado II",
];

const SAMPLE_GRADES = [
  94, 86, 91, 88, 93, 82, 90, 87, 92, 89, 85, 96, 84, 90, 88, 91, 86,
  93, 81, 89, 95, 87, 90, 84, 92, 88, 91, 86, 94, 83, 90, 89, 93, 87,
];

const makeSampleCourses = (): Course[] =>
  COURSE_NAMES.map((name, index) => {
    const term = index < 30 ? Math.floor(index / 5) + 1 : index < 34 ? 7 : index < 39 ? (index === 34 ? 7 : 8) : index < 44 ? (index === 39 ? 8 : 9) : 10;
    const status: CourseStatus = index < 34 ? "passed" : index < 39 ? "in_progress" : "pending";
    const code = `IS-${String(index + 101).padStart(3, "0")}`;
    const prerequisite = index >= 10 && index % 5 !== 4 ? [`IS-${String(index - 9 + 100).padStart(3, "0")}`] : [];
    return {
      id: `course-${index + 1}`,
      code,
      name,
      credits: index < 6 ? 5 : 4,
      term,
      status,
      grade: status === "passed" ? SAMPLE_GRADES[index] : status === "in_progress" ? [88, 92, 90, 86, 89][index - 34] : undefined,
      progress: status === "in_progress" ? [70, 60, 65, 48, 55][index - 34] : status === "passed" ? 100 : 0,
      prerequisites: prerequisite,
      attempts: 1,
    };
  });

const INITIAL_DATA: AppData = {
  profile: {
    studentName: "Luis Fructuoso",
    university: "Universidad Tecnológica del Caribe",
    degree: "Ingeniería de Software",
    studentId: "2026-0001",
    startYear: 2023,
    totalCredits: 210,
    scale: 4,
    passingGrade: 70,
    periodLabel: "Semestre",
    graduationDate: "2027-08",
  },
  courses: makeSampleCourses(),
  plans: [],
  documents: [],
};

const STATUS_META: Record<CourseStatus, { label: string; short: string }> = {
  passed: { label: "Aprobada", short: "Aprobada" },
  in_progress: { label: "En curso", short: "Cursando" },
  pending: { label: "Pendiente", short: "Pendiente" },
  failed: { label: "Reprobada", short: "Reprobada" },
  withdrawn: { label: "Retirada", short: "Retirada" },
  transferred: { label: "Convalidada", short: "Convalidada" },
};

const DB_NAME = "mi-carrera-db";
const STORE_NAME = "academic-data";
const DATA_KEY = "current";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function loadStoredData(): Promise<AppData | null> {
  if (typeof indexedDB === "undefined") return null;
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).get(DATA_KEY);
    request.onsuccess = () => resolve((request.result as AppData) ?? null);
    request.onerror = () => reject(request.error);
  });
}

async function saveStoredData(data: AppData) {
  if (typeof indexedDB === "undefined") return;
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(data, DATA_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function pointsForGrade(grade: number, scale: 4 | 5) {
  if (scale === 5) {
    if (grade >= 90) return 5;
    if (grade >= 80) return 4;
    if (grade >= 70) return 3;
    if (grade >= 60) return 2;
    return 0;
  }
  if (grade >= 90) return 4;
  if (grade >= 85) return 3.5;
  if (grade >= 80) return 3;
  if (grade >= 75) return 2.5;
  if (grade >= 70) return 2;
  if (grade >= 60) return 1;
  return 0;
}

function calculateIndex(courses: Course[], scale: 4 | 5) {
  const graded = courses.filter((course) => typeof course.grade === "number" && ["passed", "failed"].includes(course.status));
  const credits = graded.reduce((sum, course) => sum + course.credits, 0);
  if (!credits) return 0;
  return graded.reduce((sum, course) => sum + pointsForGrade(course.grade ?? 0, scale) * course.credits, 0) / credits;
}

function formatGraduation(value: string) {
  if (!value) return "Sin definir";
  const [year, month] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("es-DO", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function downloadFile(content: BlobPart, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function escapeCsv(value: string | number | undefined) {
  const text = value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function parseCsv(text: string): ImportedCourse[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return parseAcademicText(text);
  const splitLine = (line: string) => line.split(/,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/).map((cell) => cell.trim().replace(/^\"|\"$/g, ""));
  const headers = splitLine(lines[0]).map((h) => h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
  return lines.slice(1).map((line, idx) => {
    const cells = splitLine(line);
    const get = (...names: string[]) => {
      const i = headers.findIndex((header) => names.some((name) => header.includes(name)));
      return i >= 0 ? cells[i] : "";
    };
    const rawStatus = get("estado", "status").toLowerCase();
    const grade = Number(get("nota", "calificacion", "grade"));
    const status: CourseStatus = rawStatus.includes("curso") ? "in_progress" : rawStatus.includes("repro") ? "failed" : rawStatus.includes("retir") ? "withdrawn" : rawStatus.includes("conval") ? "transferred" : rawStatus.includes("apro") ? "passed" : Number.isFinite(grade) && grade > 0 ? (grade >= 70 ? "passed" : "failed") : "pending";
    return {
      id: `import-${Date.now()}-${idx}`,
      code: get("codigo", "code") || `MAT-${idx + 1}`,
      name: get("materia", "asignatura", "nombre", "course") || `Materia ${idx + 1}`,
      credits: Number(get("credito", "credit")) || 3,
      term: Number(get("periodo", "semestre", "cuatrimestre", "term")) || 1,
      grade: Number.isFinite(grade) && grade > 0 ? grade : undefined,
      status,
      prerequisites: get("prerrequisito", "prerequisite").split(/[;|]/).map((v) => v.trim()).filter(Boolean),
      attempts: Number(get("intento", "attempt")) || 1,
    };
  });
}

function parseAcademicText(text: string): ImportedCourse[] {
  const lines = text.split(/\r?\n/).map((line) => line.replace(/\s+/g, " ").trim()).filter((line) => line.length > 4);
  const results: ImportedCourse[] = [];
  const pattern = /^([A-ZÁÉÍÓÚÑ]{2,8}[\s-]?\d{2,5})\s+(.+?)(?:\s+(\d(?:\.\d)?))?(?:\s+(\d{2,3}))?$/i;
  lines.forEach((line, idx) => {
    const match = line.match(pattern);
    if (!match) return;
    const grade = match[4] ? Number(match[4]) : undefined;
    results.push({
      id: `text-${Date.now()}-${idx}`,
      code: match[1].replace(/\s+/g, "-").toUpperCase(),
      name: match[2].trim(),
      credits: Number(match[3]) || 3,
      term: 1,
      status: grade !== undefined ? (grade >= 70 ? "passed" : "failed") : "pending",
      grade,
      prerequisites: [],
      attempts: 1,
    });
  });
  return results;
}

const NAV_ITEMS = [
  { id: "dashboard", label: "Resumen", icon: LayoutDashboard },
  { id: "curriculum", label: "Mi pensum", icon: BookOpen },
  { id: "current", label: "Cursos actuales", icon: CalendarDays },
  { id: "progress", label: "Mi progreso", icon: BarChart3 },
  { id: "planner", label: "Planificador", icon: Target },
  { id: "simulator", label: "Simulador", icon: TrendingUp },
  { id: "documents", label: "Documentos", icon: FileText },
  { id: "settings", label: "Configuración", icon: Settings },
] as const;

type ViewId = (typeof NAV_ITEMS)[number]["id"];

function ProgressRing({ value, size = 184 }: { value: number; size?: number }) {
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="progress-ring" style={{ width: size, height: size }} aria-label={`${value}% de la carrera completado`}>
      <svg viewBox="0 0 100 100" role="img">
        <circle className="ring-track" cx="50" cy="50" r={radius} />
        <circle className="ring-value" cx="50" cy="50" r={radius} strokeDasharray={circumference} strokeDashoffset={circumference * (1 - value / 100)} />
      </svg>
      <div className="ring-copy"><strong>{value}%</strong><span>Progreso</span></div>
    </div>
  );
}

function StatusBadge({ status }: { status: CourseStatus }) {
  return <span className={`status-badge status-${status}`}><span className="status-dot" />{STATUS_META[status].short}</span>;
}

function Modal({ title, children, onClose, wide = false }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={`modal ${wide ? "modal-wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <header className="modal-header"><div><span className="eyebrow">Mi Carrera</span><h2 id="modal-title">{title}</h2></div><button className="icon-button" onClick={onClose} aria-label="Cerrar"><X size={20} /></button></header>
        {children}
      </section>
    </div>
  );
}

export default function CareerApp() {
  const [data, setData] = useState<AppData>(INITIAL_DATA);
  const [hydrated, setHydrated] = useState(false);
  const [activeView, setActiveView] = useState<ViewId>("dashboard");
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light";
    return localStorage.getItem("mi-carrera-theme") === "dark" ? "dark" : "light";
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    loadStoredData().then((stored) => stored && setData(stored)).finally(() => setHydrated(true));
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("mi-carrera-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!hydrated) return;
    const timeout = window.setTimeout(() => saveStoredData(data), 220);
    return () => window.clearTimeout(timeout);
  }, [data, hydrated]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if ("serviceWorker" in navigator && location.protocol !== "http:") navigator.serviceWorker.register("./sw.js").catch(() => undefined);
  }, []);

  const metrics = useMemo(() => {
    const approved = data.courses.filter((course) => ["passed", "transferred"].includes(course.status));
    const inProgress = data.courses.filter((course) => course.status === "in_progress");
    const pending = data.courses.filter((course) => course.status === "pending");
    const failed = data.courses.filter((course) => course.status === "failed");
    const approvedCredits = approved.reduce((sum, course) => sum + course.credits, 0);
    const progress = Math.min(100, Math.round((approvedCredits / Math.max(1, data.profile.totalCredits)) * 100));
    return { approved, inProgress, pending, failed, approvedCredits, progress, index: calculateIndex(data.courses, data.profile.scale) };
  }, [data]);

  const navigate = (view: ViewId) => {
    setActiveView(view);
    setSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const updateCourse = (course: Course) => {
    setData((current) => ({ ...current, courses: current.courses.map((item) => item.id === course.id ? course : item) }));
    setSelectedCourse(course);
    setToast("Materia actualizada correctamente");
  };

  const addImportedCourses = (rows: ImportedCourse[], document: DocumentMeta, mode: "curriculum" | "record") => {
    setData((current) => {
      let courses = [...current.courses];
      if (mode === "curriculum") {
        const meaningfulExisting = courses.filter((course) => !course.id.startsWith("course-"));
        courses = meaningfulExisting.length ? meaningfulExisting : [];
        rows.forEach((row, index) => {
          courses.push({
            id: row.id ?? `imported-${Date.now()}-${index}`,
            code: row.code ?? `MAT-${index + 1}`,
            name: row.name,
            credits: Number(row.credits) || 3,
            term: Number(row.term) || 1,
            status: row.status ?? "pending",
            grade: row.grade,
            progress: row.status === "passed" ? 100 : 0,
            prerequisites: row.prerequisites ?? [],
            attempts: row.attempts ?? 1,
          });
        });
      } else {
        rows.forEach((row) => {
          const index = courses.findIndex((course) => course.code.toLowerCase() === row.code?.toLowerCase() || course.name.toLowerCase() === row.name.toLowerCase());
          if (index >= 0) courses[index] = { ...courses[index], grade: row.grade, status: row.status ?? courses[index].status, attempts: row.attempts ?? courses[index].attempts };
          else courses.push({ id: row.id ?? crypto.randomUUID(), code: row.code ?? "S/C", name: row.name, credits: row.credits ?? 3, term: row.term ?? 1, status: row.status ?? "pending", grade: row.grade, progress: row.status === "passed" ? 100 : 0, prerequisites: row.prerequisites ?? [], attempts: row.attempts ?? 1 });
        });
      }
      const totalCredits = mode === "curriculum" ? courses.reduce((sum, course) => sum + course.credits, 0) : current.profile.totalCredits;
      return { ...current, courses, profile: { ...current.profile, totalCredits: totalCredits || current.profile.totalCredits }, documents: [document, ...current.documents] };
    });
    setToast(`${rows.length} materias importadas`);
  };

  return (
    <div className="app-shell">
      <Sidebar activeView={activeView} navigate={navigate} open={sidebarOpen} close={() => setSidebarOpen(false)} onImport={() => setImportOpen(true)} />
      <div className="app-column">
        <Topbar data={data} onMenu={() => setSidebarOpen(true)} theme={theme} setTheme={setTheme} notificationsOpen={notificationsOpen} setNotificationsOpen={setNotificationsOpen} />
        <main className="main-content">
          {activeView === "dashboard" && <Dashboard data={data} metrics={metrics} navigate={navigate} selectCourse={setSelectedCourse} />}
          {activeView === "curriculum" && <Curriculum data={data} selectCourse={setSelectedCourse} />}
          {activeView === "current" && <CurrentCourses courses={metrics.inProgress} selectCourse={setSelectedCourse} updateCourse={updateCourse} />}
          {activeView === "progress" && <ProgressView data={data} metrics={metrics} />}
          {activeView === "planner" && <Planner data={data} setData={setData} />}
          {activeView === "simulator" && <Simulator data={data} metrics={metrics} />}
          {activeView === "documents" && <Documents data={data} setData={setData} onImport={() => setImportOpen(true)} showToast={setToast} />}
          {activeView === "settings" && <SettingsView data={data} setData={setData} showToast={setToast} />}
        </main>
      </div>
      <nav className="mobile-nav" aria-label="Navegación móvil">
        {NAV_ITEMS.slice(0, 6).map((item) => <button key={item.id} className={activeView === item.id ? "active" : ""} onClick={() => navigate(item.id)}><item.icon size={19} /><span>{item.label.replace("Cursos actuales", "Cursos")}</span></button>)}
      </nav>
      {selectedCourse && <CourseEditor course={selectedCourse} profile={data.profile} courses={data.courses} onSave={updateCourse} onClose={() => setSelectedCourse(null)} />}
      {importOpen && <ImportWizard profile={data.profile} onClose={() => setImportOpen(false)} onImport={addImportedCourses} />}
      {toast && <div className="toast"><CheckCircle2 size={19} />{toast}</div>}
    </div>
  );
}

function Sidebar({ activeView, navigate, open, close, onImport }: { activeView: ViewId; navigate: (id: ViewId) => void; open: boolean; close: () => void; onImport: () => void }) {
  return <><div className={`sidebar-overlay ${open ? "show" : ""}`} onClick={close} /><aside className={`sidebar ${open ? "open" : ""}`}>
    <div className="brand"><div className="brand-mark"><GraduationCap size={25} /></div><span>Mi Carrera</span><button className="sidebar-close" onClick={close} aria-label="Cerrar menú"><X size={20} /></button></div>
    <nav className="side-nav" aria-label="Navegación principal">{NAV_ITEMS.map((item) => <button key={item.id} className={activeView === item.id ? "active" : ""} onClick={() => navigate(item.id)}><item.icon size={20} /><span>{item.label}</span>{activeView === item.id && <ChevronRight className="nav-arrow" size={16} />}</button>)}</nav>
    <button className="import-sidebar" onClick={onImport}><Upload size={18} /><span>Importar documento</span></button>
    <div className="privacy-note"><ShieldCheck size={17} /><span>Tus datos permanecen en este dispositivo.</span></div>
  </aside></>;
}

function Topbar({ data, onMenu, theme, setTheme, notificationsOpen, setNotificationsOpen }: { data: AppData; onMenu: () => void; theme: "light" | "dark"; setTheme: (theme: "light" | "dark") => void; notificationsOpen: boolean; setNotificationsOpen: (value: boolean) => void }) {
  const initials = data.profile.studentName.split(" ").slice(0, 2).map((part) => part[0]).join("");
  return <header className="topbar">
    <button className="icon-button menu-button" onClick={onMenu} aria-label="Abrir menú"><Menu size={21} /></button>
    <div className="university"><div className="university-crest"><BookOpen size={20} /></div><div><strong>{data.profile.university}</strong><span>{data.profile.degree}</span></div></div>
    <div className="top-actions">
      <button className="icon-button" onClick={() => setTheme(theme === "light" ? "dark" : "light")} aria-label={theme === "light" ? "Activar modo oscuro" : "Activar modo claro"}>{theme === "light" ? <Moon size={19} /> : <Sun size={19} />}</button>
      <div className="notification-wrap"><button className="icon-button" onClick={() => setNotificationsOpen(!notificationsOpen)} aria-label="Ver notificaciones"><Bell size={19} /><span className="notification-count">3</span></button>{notificationsOpen && <div className="notification-panel"><div className="notification-title"><strong>Actualizaciones</strong><button onClick={() => setNotificationsOpen(false)}><X size={16} /></button></div><div className="notification-item"><CheckCircle2 size={17} /><span><strong>Buen ritmo académico</strong>Has completado más de la mitad de tu carrera.</span></div><div className="notification-item"><Clock3 size={17} /><span><strong>5 materias en curso</strong>Actualiza tu progreso cuando tengas nuevas notas.</span></div><div className="notification-item"><Target size={17} /><span><strong>Planificación disponible</strong>Prepara tu próximo período.</span></div></div>}</div>
      <div className="profile-chip"><div className="avatar">{initials}</div><div><strong>{data.profile.studentName}</strong><span>Estudiante · {data.profile.studentId}</span></div><ChevronDown size={16} /></div>
    </div>
  </header>;
}

function Dashboard({ data, metrics, navigate, selectCourse }: { data: AppData; metrics: Metrics; navigate: (id: ViewId) => void; selectCourse: (course: Course) => void }) {
  const periods = Math.max(...data.courses.map((course) => course.term), 1);
  return <div className="page-stack dashboard-page">
    <section className="career-hero">
      <div className="hero-copy"><span className="eyebrow">Tu trayectoria académica</span><h1>{data.profile.degree}</h1><p>Tu esfuerzo de hoy construye el impacto de mañana. Sigue avanzando.</p><div className="hero-actions"><button className="button primary" onClick={() => navigate("curriculum")}><BookOpen size={18} />Ver mi pensum</button><button className="button secondary" onClick={() => navigate("simulator")}><TrendingUp size={18} />Simular índice</button></div></div>
      <ProgressRing value={metrics.progress} />
      <div className="hero-stats"><div><span className="metric-icon blue"><GraduationCap size={19} /></span><p><strong>{metrics.approvedCredits} de {data.profile.totalCredits}</strong><span>Créditos acumulados</span></p></div><div><span className="metric-icon green"><CheckCircle2 size={19} /></span><p><strong>{metrics.approved.length} aprobadas</strong><span>Materias completadas</span></p></div><div><span className="metric-icon purple"><BookOpen size={19} /></span><p><strong>{metrics.inProgress.length} cursando</strong><span>Período actual</span></p></div><div><span className="metric-icon gray"><Clock3 size={19} /></span><p><strong>{metrics.pending.length} pendientes</strong><span>Por completar</span></p></div></div>
      <div className="index-card"><span>Índice acumulado</span><strong>{metrics.index.toFixed(2)}<small>/{data.profile.scale.toFixed(2)}</small></strong><div className="index-divider" /><div className="graduation"><span className="metric-icon green"><CalendarDays size={19} /></span><p><span>Proyección de egreso</span><strong>{formatGraduation(data.profile.graduationDate)}</strong></p></div></div>
    </section>
    <section><SectionHeader icon={BookOpen} title={`Cursos actuales (${metrics.inProgress.length})`} action={<button className="text-button" onClick={() => navigate("current")}>Ver todos <ArrowRight size={16} /></button>} /><div className="current-grid">{metrics.inProgress.slice(0, 3).map((course) => <CurrentCard key={course.id} course={course} onClick={() => selectCourse(course)} />)}</div></section>
    <section className="curriculum-preview card"><SectionHeader icon={BookOpen} title="Mi pensum — Vista de avance" action={<button className="button compact secondary" onClick={() => navigate("curriculum")}>Ver mi pensum</button>} /><div className="legend"><span><i className="passed" />Aprobada</span><span><i className="in-progress" />En curso</span><span><i className="pending" />Pendiente</span><span><i className="failed" />Requiere atención</span></div><div className="term-timeline">{Array.from({ length: periods }, (_, i) => i + 1).map((term) => { const courses = data.courses.filter((course) => course.term === term); const passed = courses.filter((course) => ["passed", "transferred"].includes(course.status)).length; const active = courses.some((course) => course.status === "in_progress"); return <button key={term} className={`timeline-term ${passed === courses.length ? "complete" : active ? "active" : ""}`} onClick={() => navigate("curriculum")}><span>{term}º {data.profile.periodLabel}</span><i>{passed === courses.length ? <Check size={14} /> : active ? <BookOpen size={13} /> : term}</i><strong>{passed}/{courses.length}</strong></button>; })}</div></section>
  </div>;
}

function SectionHeader({ icon: Icon, title, action }: { icon: typeof BookOpen; title: string; action?: React.ReactNode }) { return <div className="section-header"><div><Icon size={20} /><h2>{title}</h2></div>{action}</div>; }

function CurrentCard({ course, onClick }: { course: Course; onClick: () => void }) { return <button className="current-card" onClick={onClick}><div className="course-icon"><BookOpen size={22} /></div><div className="course-card-main"><span className="course-code">{course.code}</span><strong>{course.name}</strong><StatusBadge status={course.status} /></div><strong className="course-grade">{course.grade ?? "—"}</strong><MoreHorizontal className="card-menu" size={19} /><div className="course-progress"><span style={{ width: `${course.progress ?? 0}%` }} /></div><div className="course-meta"><span>Créditos: {course.credits}</span><span>{course.progress ?? 0}% del curso</span></div></button>; }

function Curriculum({ data, selectCourse }: { data: AppData; selectCourse: (course: Course) => void }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<CourseStatus | "all">("all");
  const terms = Array.from(new Set(data.courses.map((course) => course.term))).sort((a, b) => a - b);
  const visible = (course: Course) => (filter === "all" || course.status === filter) && `${course.code} ${course.name}`.toLowerCase().includes(search.toLowerCase());
  return <div className="page-stack"><PageTitle eyebrow="Mapa académico" title="Mi pensum" description="Explora tu carrera por períodos, identifica prerrequisitos y descubre qué materias puedes cursar próximamente." />
    <div className="toolbar card"><label className="search-field"><Search size={18} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por código o materia…" /></label><div className="filter-pills"><Filter size={17} />{(["all", "passed", "in_progress", "pending", "failed"] as const).map((value) => <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{value === "all" ? "Todas" : STATUS_META[value].short}</button>)}</div></div>
    <div className="curriculum-board">{terms.map((term) => { const courses = data.courses.filter((course) => course.term === term && visible(course)); const total = data.courses.filter((course) => course.term === term); const completed = total.filter((course) => ["passed", "transferred"].includes(course.status)).length; return <section className="term-column" key={term}><header><div><span>{term}º</span><h2>{data.profile.periodLabel}</h2></div><strong>{completed}/{total.length}</strong></header><div className="term-progress"><span style={{ width: `${total.length ? completed / total.length * 100 : 0}%` }} /></div><div className="term-courses">{courses.length ? courses.map((course) => <button key={course.id} className={`curriculum-course ${course.status}`} onClick={() => selectCourse(course)}><div><StatusIcon status={course.status} /><span><small>{course.code} · {course.credits} cr.</small><strong>{course.name}</strong></span></div>{course.prerequisites.length > 0 && <span className="prereq"><LockKeyhole size={12} />{course.prerequisites.length}</span>} {typeof course.grade === "number" && <b>{course.grade}</b>}</button>) : <div className="empty-term">Sin coincidencias</div>}</div></section>; })}</div>
  </div>;
}

function StatusIcon({ status }: { status: CourseStatus }) { if (status === "passed" || status === "transferred") return <span className="state-icon"><Check size={13} /></span>; if (status === "in_progress") return <span className="state-icon"><BookOpen size={13} /></span>; if (status === "failed") return <span className="state-icon"><AlertCircle size={13} /></span>; return <span className="state-icon"><Clock3 size={13} /></span>; }

function CurrentCourses({ courses, selectCourse, updateCourse }: { courses: Course[]; selectCourse: (course: Course) => void; updateCourse: (course: Course) => void }) {
  const totalCredits = courses.reduce((sum, course) => sum + course.credits, 0);
  const average = courses.length ? Math.round(courses.reduce((sum, course) => sum + (course.grade ?? 0), 0) / courses.length) : 0;
  return <div className="page-stack"><PageTitle eyebrow="Período activo" title="Cursos actuales" description="Actualiza tus avances y mantén una fotografía clara de tu carga académica." />
    <div className="mini-metrics"><MetricCard icon={BookOpen} label="Materias inscritas" value={courses.length} color="blue" /><MetricCard icon={GraduationCap} label="Créditos actuales" value={totalCredits} color="purple" /><MetricCard icon={TrendingUp} label="Promedio provisional" value={average || "—"} color="green" /></div>
    <div className="course-list card">{courses.map((course) => <article key={course.id} className="course-row"><div className="course-icon"><BookOpen size={21} /></div><div className="course-row-title"><small>{course.code}</small><strong>{course.name}</strong><span>{course.credits} créditos</span></div><div className="inline-progress"><label>Avance <strong>{course.progress ?? 0}%</strong></label><input type="range" min="0" max="100" value={course.progress ?? 0} onChange={(e) => updateCourse({ ...course, progress: Number(e.target.value) })} aria-label={`Avance de ${course.name}`} /></div><div className="grade-box"><span>Nota actual</span><strong>{course.grade ?? "—"}</strong></div><button className="icon-button" onClick={() => selectCourse(course)} aria-label={`Editar ${course.name}`}><Pencil size={18} /></button></article>)}{!courses.length && <EmptyState icon={BookOpen} title="No tienes materias en curso" text="Marca materias como 'En curso' desde tu pensum." />}</div>
  </div>;
}

function MetricCard({ icon: Icon, label, value, color }: { icon: typeof BookOpen; label: string; value: string | number; color: string }) { return <div className="metric-card card"><span className={`metric-icon ${color}`}><Icon size={21} /></span><div><span>{label}</span><strong>{value}</strong></div></div>; }

function ProgressView({ data, metrics }: { data: AppData; metrics: Metrics }) {
  const terms = Array.from(new Set(data.courses.filter((course) => typeof course.grade === "number").map((course) => course.term))).sort((a, b) => a - b);
  const termIndexes = terms.map((term) => ({ term, value: calculateIndex(data.courses.filter((course) => course.term <= term), data.profile.scale) }));
  const max = data.profile.scale;
  const gradeBands = [{ label: "90–100", count: 0 }, { label: "80–89", count: 0 }, { label: "70–79", count: 0 }, { label: "< 70", count: 0 }];
  data.courses.filter((course) => typeof course.grade === "number" && course.status !== "in_progress").forEach((course) => { const grade = course.grade ?? 0; gradeBands[grade >= 90 ? 0 : grade >= 80 ? 1 : grade >= 70 ? 2 : 3].count++; });
  const maxBand = Math.max(...gradeBands.map((band) => band.count), 1);
  return <div className="page-stack"><PageTitle eyebrow="Resultados" title="Mi progreso" description="Analiza cómo has evolucionado y dónde concentrar tu próximo esfuerzo." />
    <div className="progress-summary"><div className="card progress-main"><ProgressRing value={metrics.progress} size={200} /><div><span className="eyebrow">Progreso total</span><h2>{metrics.approvedCredits} créditos aprobados</h2><p>Te faltan {Math.max(0, data.profile.totalCredits - metrics.approvedCredits)} créditos para completar el programa.</p><div className="progress-breakdown"><span><b>{metrics.approved.length}</b>Aprobadas</span><span><b>{metrics.inProgress.length}</b>En curso</span><span><b>{metrics.pending.length}</b>Pendientes</span></div></div></div><div className="card index-spotlight"><span>Índice actual</span><strong>{metrics.index.toFixed(2)}</strong><small>de {data.profile.scale.toFixed(2)}</small><div className="index-gauge"><span style={{ width: `${metrics.index / max * 100}%` }} /></div><p><Sparkles size={16} /> Rendimiento académico sólido</p></div></div>
    <div className="analytics-grid"><section className="card chart-card"><SectionHeader icon={TrendingUp} title="Evolución del índice" /><div className="line-chart" aria-label="Gráfico de evolución del índice"><svg viewBox="0 0 720 250" preserveAspectRatio="none"><defs><linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2457E6" stopOpacity=".25"/><stop offset="100%" stopColor="#2457E6" stopOpacity="0"/></linearGradient></defs>{[0,1,2,3,4].map((n) => <line key={n} x1="45" x2="700" y1={25+n*48} y2={25+n*48} className="grid-line" />)}<polyline className="area-line" points={`45,225 ${termIndexes.map((item, i) => `${45 + (i + 1) * (650 / Math.max(1, termIndexes.length))},${225 - item.value / max * 190}`).join(" ")} 700,225`} fill="url(#chartFill)"/><polyline className="value-line" points={termIndexes.map((item, i) => `${45 + (i + 1) * (650 / Math.max(1, termIndexes.length))},${225 - item.value / max * 190}`).join(" ")} />{termIndexes.map((item, i) => <circle key={item.term} cx={45 + (i + 1) * (650 / Math.max(1, termIndexes.length))} cy={225 - item.value / max * 190} r="5" className="chart-dot" />)}</svg><div className="chart-labels">{termIndexes.map((item) => <span key={item.term}>{item.term}º</span>)}</div></div></section><section className="card chart-card"><SectionHeader icon={BarChart3} title="Distribución de notas" /><div className="bar-chart">{gradeBands.map((band, index) => <div key={band.label}><span>{band.label}</span><div><i style={{ height: `${Math.max(8, band.count / maxBand * 100)}%` }} className={`bar-${index}`} /></div><strong>{band.count}</strong></div>)}</div></section></div>
  </div>;
}

function Planner({ data, setData }: { data: AppData; setData: React.Dispatch<React.SetStateAction<AppData>> }) {
  const candidates = data.courses.filter((course) => course.status === "pending" && course.prerequisites.every((code) => data.courses.some((item) => item.code === code && ["passed", "transferred"].includes(item.status))));
  const plannedIds = data.plans.map((plan) => plan.courseId);
  const credits = data.plans.reduce((sum, plan) => sum + (data.courses.find((course) => course.id === plan.courseId)?.credits ?? 0), 0);
  const toggle = (course: Course) => setData((current) => ({ ...current, plans: plannedIds.includes(course.id) ? current.plans.filter((plan) => plan.courseId !== course.id) : [...current.plans, { courseId: course.id, term: "Próximo período", expectedGrade: 85 }] }));
  return <div className="page-stack"><PageTitle eyebrow="Próximo paso" title="Planificador académico" description="Construye un próximo período realista usando únicamente materias desbloqueadas." />
    <div className="planner-layout"><section className="card planner-candidates"><SectionHeader icon={Sparkles} title="Materias disponibles" /><p className="section-copy">Cumples los prerrequisitos de estas asignaturas.</p><div className="candidate-list">{candidates.map((course) => <button key={course.id} className={plannedIds.includes(course.id) ? "selected" : ""} onClick={() => toggle(course)}><span className="candidate-check">{plannedIds.includes(course.id) ? <Check size={15} /> : <Plus size={15} />}</span><span><small>{course.code}</small><strong>{course.name}</strong></span><b>{course.credits} cr.</b></button>)}{!candidates.length && <EmptyState icon={LockKeyhole} title="Sin materias desbloqueadas" text="Revisa tus prerrequisitos o completa el período actual." />}</div></section>
    <aside className="card plan-summary"><span className="eyebrow">Escenario</span><h2>Próximo período</h2><div className="credit-orbit"><strong>{credits}</strong><span>créditos</span></div><div className={`workload ${credits > 20 ? "high" : credits > 14 ? "medium" : "good"}`}><span>{credits > 20 ? "Carga alta" : credits > 14 ? "Carga moderada" : "Carga equilibrada"}</span><i style={{ width: `${Math.min(100, credits / 24 * 100)}%` }} /></div><div className="planned-list">{data.plans.map((plan) => { const course = data.courses.find((item) => item.id === plan.courseId); return course ? <div key={course.id}><CheckCircle2 size={16} /><span>{course.name}</span><button onClick={() => toggle(course)} aria-label="Quitar"><X size={15} /></button></div> : null; })}</div><button className="button primary full" disabled={!data.plans.length}><Save size={17} />Guardar planificación</button></aside></div>
  </div>;
}

function Simulator({ data, metrics }: { data: AppData; metrics: Metrics }) {
  const candidates = data.courses.filter((course) => ["in_progress", "pending"].includes(course.status)).slice(0, 8);
  const [grades, setGrades] = useState<Record<string, number>>(() => Object.fromEntries(candidates.map((course) => [course.id, course.grade ?? 85])));
  const projectedCourses = [...data.courses.filter((course) => !grades[course.id]), ...candidates.filter((course) => grades[course.id]).map((course) => ({ ...course, grade: grades[course.id], status: grades[course.id] >= data.profile.passingGrade ? "passed" as const : "failed" as const }))];
  const projected = calculateIndex(projectedCourses, data.profile.scale);
  const difference = projected - metrics.index;
  return <div className="page-stack"><PageTitle eyebrow="Proyección" title="Simulador de índice" description="Prueba escenarios sin modificar tu historial académico real." />
    <div className="simulator-layout"><section className="card simulator-form"><SectionHeader icon={TrendingUp} title="Calificaciones esperadas" /><div className="simulation-list">{candidates.map((course) => <div key={course.id}><span><small>{course.code} · {course.credits} cr.</small><strong>{course.name}</strong></span><label><input type="number" min="0" max="100" value={grades[course.id]} onChange={(e) => setGrades((current) => ({ ...current, [course.id]: Math.max(0, Math.min(100, Number(e.target.value))) }))} /><em>/100</em></label></div>)}</div></section>
    <aside className="card simulation-result"><div className="simulation-icon"><TrendingUp size={26} /></div><span>Índice proyectado</span><strong>{projected.toFixed(2)}<small>/{data.profile.scale.toFixed(2)}</small></strong><div className={`difference ${difference >= 0 ? "positive" : "negative"}`}>{difference >= 0 ? "+" : ""}{difference.toFixed(2)} frente al actual</div><div className="comparison"><span>Actual <b>{metrics.index.toFixed(2)}</b></span><ArrowRight size={18} /><span>Proyección <b>{projected.toFixed(2)}</b></span></div><p><CircleHelp size={16} />Esta proyección aplica la escala configurada y pondera cada materia por sus créditos.</p></aside></div>
  </div>;
}

function Documents({ data, setData, onImport, showToast }: { data: AppData; setData: React.Dispatch<React.SetStateAction<AppData>>; onImport: () => void; showToast: (message: string) => void }) {
  const backupRef = useRef<HTMLInputElement>(null);
  const exportJson = () => { downloadFile(JSON.stringify(data, null, 2), `mi-carrera-respaldo-${new Date().toISOString().slice(0, 10)}.json`, "application/json"); showToast("Respaldo descargado"); };
  const exportCsv = () => { const header = "codigo,materia,creditos,periodo,estado,nota,prerrequisitos\n"; const rows = data.courses.map((course) => [course.code, course.name, course.credits, course.term, STATUS_META[course.status].label, course.grade, course.prerequisites.join(";")].map(escapeCsv).join(",")).join("\n"); downloadFile(header + rows, "mi-pensum.csv", "text/csv;charset=utf-8"); showToast("Pensum exportado en CSV"); };
  const restore = async (file?: File) => { if (!file) return; try { const restored = JSON.parse(await file.text()) as AppData; if (!restored.profile || !Array.isArray(restored.courses)) throw new Error(); setData(restored); showToast("Respaldo restaurado correctamente"); } catch { showToast("El archivo no es un respaldo válido"); } };
  return <div className="page-stack"><PageTitle eyebrow="Control y privacidad" title="Documentos y respaldos" description="Importa tu información, descarga copias y recupera tu progreso cuando lo necesites." />
    <div className="document-actions"><button className="action-card primary-action" onClick={onImport}><span><Upload size={24} /></span><div><strong>Importar pensum o récord</strong><p>PDF, imagen, Excel, CSV o JSON.</p></div><ArrowRight size={20} /></button><button className="action-card" onClick={exportJson}><span><FileJson size={24} /></span><div><strong>Crear respaldo completo</strong><p>Guarda perfil, materias y planificación.</p></div><Download size={20} /></button><button className="action-card" onClick={exportCsv}><span><FileSpreadsheet size={24} /></span><div><strong>Exportar pensum</strong><p>Compatible con Excel y Google Sheets.</p></div><Download size={20} /></button><button className="action-card" onClick={() => backupRef.current?.click()}><span><RotateCcw size={24} /></span><div><strong>Restaurar respaldo</strong><p>Recupera un archivo JSON anterior.</p></div><Upload size={20} /></button><input ref={backupRef} hidden type="file" accept="application/json,.json" onChange={(e) => restore(e.target.files?.[0])} /></div>
    <section className="card document-history"><SectionHeader icon={FileText} title="Historial de importaciones" /><div className="document-table"><div className="document-head"><span>Documento</span><span>Tipo</span><span>Materias</span><span>Fecha</span></div>{data.documents.map((document) => <div className="document-row" key={document.id}><span><FileText size={18} /><strong>{document.name}</strong></span><span>{document.type}</span><span>{document.rows}</span><span>{new Intl.DateTimeFormat("es-DO").format(new Date(document.date))}</span></div>)}{!data.documents.length && <EmptyState icon={FileText} title="Aún no has importado documentos" text="La aplicación incluye datos de demostración. Importa tu pensum para comenzar con información real." />}</div></section>
  </div>;
}

function SettingsView({ data, setData, showToast }: { data: AppData; setData: React.Dispatch<React.SetStateAction<AppData>>; showToast: (message: string) => void }) {
  const [profile, setProfile] = useState(data.profile);
  const save = () => { setData((current) => ({ ...current, profile })); showToast("Configuración guardada"); };
  const reset = () => { if (confirm("¿Restaurar los datos de demostración? Se reemplazará la información actual.")) { setData(INITIAL_DATA); showToast("Datos de demostración restaurados"); } };
  return <div className="page-stack"><PageTitle eyebrow="Personalización" title="Configuración académica" description="Adapta los cálculos y la experiencia a las reglas de tu universidad." />
    <section className="card settings-card"><SectionHeader icon={GraduationCap} title="Perfil académico" /><div className="form-grid"><Field label="Nombre del estudiante"><input value={profile.studentName} onChange={(e) => setProfile({ ...profile, studentName: e.target.value })} /></Field><Field label="Matrícula"><input value={profile.studentId} onChange={(e) => setProfile({ ...profile, studentId: e.target.value })} /></Field><Field label="Universidad" wide><input value={profile.university} onChange={(e) => setProfile({ ...profile, university: e.target.value })} /></Field><Field label="Carrera" wide><input value={profile.degree} onChange={(e) => setProfile({ ...profile, degree: e.target.value })} /></Field><Field label="Año de ingreso"><input type="number" value={profile.startYear} onChange={(e) => setProfile({ ...profile, startYear: Number(e.target.value) })} /></Field><Field label="Proyección de egreso"><input type="month" value={profile.graduationDate} onChange={(e) => setProfile({ ...profile, graduationDate: e.target.value })} /></Field></div></section>
    <section className="card settings-card"><SectionHeader icon={Settings} title="Reglas de cálculo" /><div className="form-grid"><Field label="Tipo de período"><select value={profile.periodLabel} onChange={(e) => setProfile({ ...profile, periodLabel: e.target.value as Profile["periodLabel"] })}><option>Semestre</option><option>Cuatrimestre</option><option>Trimestre</option></select></Field><Field label="Escala del índice"><select value={profile.scale} onChange={(e) => setProfile({ ...profile, scale: Number(e.target.value) as 4 | 5 })}><option value="4">Escala de 4.00</option><option value="5">Escala de 5.00</option></select></Field><Field label="Nota mínima para aprobar"><input type="number" min="0" max="100" value={profile.passingGrade} onChange={(e) => setProfile({ ...profile, passingGrade: Number(e.target.value) })} /></Field><Field label="Créditos totales"><input type="number" value={profile.totalCredits} onChange={(e) => setProfile({ ...profile, totalCredits: Number(e.target.value) })} /></Field></div><div className="settings-actions"><button className="button danger-ghost" onClick={reset}><RotateCcw size={17} />Restaurar demostración</button><button className="button primary" onClick={save}><Save size={17} />Guardar cambios</button></div></section>
  </div>;
}

function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) { return <label className={`field ${wide ? "wide" : ""}`}><span>{label}</span>{children}</label>; }

function PageTitle({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) { return <header className="page-title"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></header>; }

function EmptyState({ icon: Icon, title, text }: { icon: typeof BookOpen; title: string; text: string }) { return <div className="empty-state"><span><Icon size={24} /></span><strong>{title}</strong><p>{text}</p></div>; }

function CourseEditor({ course, profile, courses, onSave, onClose }: { course: Course; profile: Profile; courses: Course[]; onSave: (course: Course) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(course);
  const prerequisiteNames = draft.prerequisites.map((code) => courses.find((item) => item.code === code)?.name ?? code);
  return <Modal title="Detalle de la materia" onClose={onClose}><div className="course-editor"><div className="course-editor-heading"><div className="course-icon large"><BookOpen size={25} /></div><div><span>{draft.code} · {draft.credits} créditos</span><h3>{draft.name}</h3><StatusBadge status={draft.status} /></div></div><div className="form-grid"><Field label="Estado"><select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as CourseStatus })}>{Object.entries(STATUS_META).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}</select></Field><Field label="Calificación"><input type="number" min="0" max="100" value={draft.grade ?? ""} placeholder="0–100" onChange={(e) => setDraft({ ...draft, grade: e.target.value ? Number(e.target.value) : undefined })} /></Field><Field label="Créditos"><input type="number" min="1" max="12" value={draft.credits} onChange={(e) => setDraft({ ...draft, credits: Number(e.target.value) })} /></Field><Field label={profile.periodLabel}><input type="number" min="1" value={draft.term} onChange={(e) => setDraft({ ...draft, term: Number(e.target.value) })} /></Field><Field label="Intentos"><input type="number" min="1" value={draft.attempts} onChange={(e) => setDraft({ ...draft, attempts: Number(e.target.value) })} /></Field><Field label="Avance"><input type="number" min="0" max="100" value={draft.progress ?? 0} onChange={(e) => setDraft({ ...draft, progress: Number(e.target.value) })} /></Field><Field label="Notas" wide><textarea value={draft.notes ?? ""} placeholder="Observaciones, profesor, sección…" onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></Field></div>{prerequisiteNames.length > 0 && <div className="prerequisite-box"><LockKeyhole size={17} /><div><strong>Prerrequisitos</strong><p>{prerequisiteNames.join(", ")}</p></div></div>}<div className="modal-actions"><button className="button secondary" onClick={onClose}>Cancelar</button><button className="button primary" onClick={() => onSave(draft)}><Save size={17} />Guardar materia</button></div></div></Modal>;
}

function ImportWizard({ profile, onClose, onImport }: { profile: Profile; onClose: () => void; onImport: (rows: ImportedCourse[], document: DocumentMeta, mode: "curriculum" | "record") => void }) {
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState<"curriculum" | "record">("curriculum");
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ImportedCourse[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const processFile = async () => {
    if (!file) return;
    setProcessing(true); setError(""); setProgress(8);
    try {
      const extension = file.name.split(".").pop()?.toLowerCase();
      let parsed: ImportedCourse[] = [];
      if (extension === "json") {
        const json = JSON.parse(await file.text());
        const source = Array.isArray(json) ? json : Array.isArray(json.courses) ? json.courses : [];
        parsed = source.map((row: Record<string, unknown>, index: number) => ({ id: String(row.id ?? `json-${index}`), code: String(row.code ?? row.codigo ?? `MAT-${index + 1}`), name: String(row.name ?? row.nombre ?? row.materia ?? `Materia ${index + 1}`), credits: Number(row.credits ?? row.creditos ?? 3), term: Number(row.term ?? row.periodo ?? 1), status: (row.status ?? row.estado ?? "pending") as CourseStatus, grade: row.grade === undefined && row.nota === undefined ? undefined : Number(row.grade ?? row.nota), prerequisites: Array.isArray(row.prerequisites) ? row.prerequisites as string[] : [], attempts: Number(row.attempts ?? 1) }));
      } else if (extension === "csv" || extension === "txt") parsed = parseCsv(await file.text());
      else if (["xlsx", "xls"].includes(extension ?? "")) {
        setProgress(25); const XLSX = await import("xlsx"); const workbook = XLSX.read(await file.arrayBuffer()); const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[workbook.SheetNames[0]]); parsed = parseCsv(csv);
      } else if (extension === "pdf") {
        setProgress(25); const pdfjs = await import("pdfjs-dist"); pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString(); const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise; let text = ""; for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) { setProgress(25 + Math.round(pageNumber / pdf.numPages * 45)); const page = await pdf.getPage(pageNumber); const content = await page.getTextContent(); text += content.items.map((item) => "str" in item ? item.str : "").join(" ") + "\n"; } parsed = parseAcademicText(text);
      } else if (["png", "jpg", "jpeg", "webp"].includes(extension ?? "")) {
        setProgress(18); const { createWorker } = await import("tesseract.js"); const worker = await createWorker("spa", 1, { logger: (message) => { if (message.status === "recognizing text") setProgress(20 + Math.round((message.progress ?? 0) * 65)); } }); const result = await worker.recognize(file); await worker.terminate(); parsed = parseAcademicText(result.data.text);
      }
      if (!parsed.length) throw new Error("No se detectaron materias. Prueba con CSV/Excel o un documento más nítido.");
      setRows(parsed); setProgress(100); setStep(3);
    } catch (err) { setError(err instanceof Error ? err.message : "No pudimos leer este documento."); }
    finally { setProcessing(false); }
  };

  const confirmImport = () => { if (!file) return; onImport(rows, { id: crypto.randomUUID(), name: file.name, type: mode === "curriculum" ? "Pensum" : "Récord académico", date: new Date().toISOString(), rows: rows.length }, mode); onClose(); };
  const updateRow = (index: number, patch: Partial<ImportedCourse>) => setRows((current) => current.map((row, i) => i === index ? { ...row, ...patch } : row));
  return <Modal title="Importar información académica" onClose={onClose} wide><div className="wizard-steps">{["Tipo", "Documento", "Revisión"].map((label, index) => <div key={label} className={step >= index + 1 ? "active" : ""}><span>{step > index + 1 ? <Check size={14} /> : index + 1}</span><strong>{label}</strong></div>)}</div>
    <div className="wizard-body">{step === 1 && <div className="type-selection"><button className={mode === "curriculum" ? "selected" : ""} onClick={() => setMode("curriculum")}><BookOpen size={27} /><strong>Importar pensum</strong><p>Materias, créditos, períodos y prerrequisitos.</p><span>{mode === "curriculum" && <Check size={15} />}</span></button><button className={mode === "record" ? "selected" : ""} onClick={() => setMode("record")}><BarChart3 size={27} /><strong>Importar récord</strong><p>Calificaciones y estados de materias cursadas.</p><span>{mode === "record" && <Check size={15} />}</span></button><div className="privacy-banner"><ShieldCheck size={20} /><div><strong>Procesamiento privado</strong><p>El documento se analiza en tu navegador y no se envía a un servidor.</p></div></div></div>}
    {step === 2 && <div><button className={`dropzone ${file ? "has-file" : ""}`} onClick={() => fileRef.current?.click()}><input ref={fileRef} type="file" hidden accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.csv,.txt,.json" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setError(""); }} />{file ? <><CheckCircle2 size={34} /><strong>{file.name}</strong><span>{(file.size / 1024 / 1024).toFixed(2)} MB · Selecciona para cambiar</span></> : <><Upload size={34} /><strong>Selecciona o arrastra tu documento</strong><span>PDF, imagen, Excel, CSV o JSON · máximo recomendado 15 MB</span></>}</button>{processing && <div className="processing"><div><span style={{ width: `${progress}%` }} /></div><p>Analizando documento… {progress}%</p></div>}{error && <div className="error-banner"><AlertCircle size={18} />{error}</div>}<div className="format-help"><FileText size={18} /><p><strong>Mejor resultado:</strong> usa Excel/CSV con columnas código, materia, créditos, período, estado y nota. Los PDF e imágenes siempre pasan por revisión.</p></div></div>}
    {step === 3 && <div className="review-step"><div className="review-summary"><CheckCircle2 size={20} /><span><strong>{rows.length} materias detectadas</strong>Revisa los datos antes de importarlos.</span></div><div className="review-table"><div className="review-head"><span>Código</span><span>Materia</span><span>Cr.</span><span>Período</span><span>Nota</span><span /></div>{rows.map((row, index) => <div className="review-row" key={row.id ?? index}><input value={row.code ?? ""} onChange={(e) => updateRow(index, { code: e.target.value })} /><input value={row.name} onChange={(e) => updateRow(index, { name: e.target.value })} /><input type="number" value={row.credits ?? 3} onChange={(e) => updateRow(index, { credits: Number(e.target.value) })} /><input type="number" value={row.term ?? 1} onChange={(e) => updateRow(index, { term: Number(e.target.value) })} /><input type="number" placeholder="—" value={row.grade ?? ""} onChange={(e) => { const grade = e.target.value ? Number(e.target.value) : undefined; updateRow(index, { grade, status: grade === undefined ? row.status : grade >= profile.passingGrade ? "passed" : "failed" }); }} /><button onClick={() => setRows((current) => current.filter((_, i) => i !== index))} aria-label="Eliminar fila"><Trash2 size={16} /></button></div>)}</div></div>}</div>
    <div className="wizard-actions"><button className="button secondary" onClick={() => step === 1 ? onClose() : setStep((current) => current - 1)}>{step === 1 ? "Cancelar" : "Atrás"}</button>{step === 1 && <button className="button primary" onClick={() => setStep(2)}>Continuar <ArrowRight size={17} /></button>}{step === 2 && <button className="button primary" disabled={!file || processing} onClick={processFile}>{processing ? "Analizando…" : "Analizar documento"}</button>}{step === 3 && <button className="button primary" disabled={!rows.length} onClick={confirmImport}><Check size={17} />Importar {rows.length} materias</button>}</div>
  </Modal>;
}
