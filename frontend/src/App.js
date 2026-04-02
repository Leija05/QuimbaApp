import { useState, useEffect, useMemo } from "react";
import "@/App.css";
import axios from "axios";
import {
  Files,
  Truck,
  Users,
  PencilSimple,
  Plus,
  Trash,
  UploadSimple,
  FilePdf,
  FileXls,
  X,
  SpinnerGap,
  Warning,
  MagnifyingGlass,
  ClockCounterClockwise,
  FolderOpen,
  TrashSimple,
  Moon,
  Sun,
  Lock,
  LockOpen,
  FloppyDisk,
  ArrowsClockwise,
  Download,
  Copy,
  CalendarBlank,
  Bell,
  ChartLine
} from "@phosphor-icons/react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { saveAs } from "file-saver";

const STORAGE_KEYS = {
  premium: "quimbar-premium-unlocked",
  theme: "quimbar-theme",
  favoriteFilters: "quimbar-favorite-filters"
};

const PREMIUM_ACCESS_KEY = process.env.REACT_APP_PREMIUM_KEY || "QUIMBAR-PREMIUM-2026";
const BACKEND_URL = (process.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");
const API_CANDIDATES = BACKEND_URL.endsWith("/api")
  ? [BACKEND_URL, BACKEND_URL.replace(/\/api$/, "")]
  : [`${BACKEND_URL}/api`, BACKEND_URL];

const apiRequest = async (method, path, options = {}) => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  let lastError;
  for (const baseUrl of API_CANDIDATES) {
    try {
      return await axios({ method, url: `${baseUrl}${normalizedPath}`, timeout: 4000, ...options });
    } catch (error) {
      lastError = error;
      if (error?.response?.status !== 404) {
        throw error;
      }
    }
  }
  throw lastError;
};

const TABS = [
  { id: "principal", label: "Archivo Principal", icon: Files },
  { id: "transporte", label: "Transporte", icon: Truck },
  { id: "cliente", label: "Cliente", icon: Users },
  { id: "gestion", label: "Gestión", icon: PencilSimple }
];

const formatCurrency = (value) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 }).format(value || 0);
const formatDate = (dateStr) => (!dateStr ? "-" : new Date(dateStr).toLocaleDateString("es-MX", { year: "numeric", month: "short", day: "numeric" }));
const toNumber = (value) => Number.parseFloat(value || 0) || 0;
const todayISO = () => new Date().toISOString().split("T")[0];
const readJSON = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const applyFilters = (records, searchTerm, statusFilter, premiumFilters, premiumEnabled) => {
  const normalizedSearch = searchTerm.trim().toLowerCase();
  return records.filter((record) => {
    const matchesStatus = statusFilter === "Todos" || record.status === statusFilter;
    const matchesSearch =
      !normalizedSearch ||
      [record.fecha, record.transportista, record.servicio, record.status].some((field) =>
        String(field || "").toLowerCase().includes(normalizedSearch)
      );

    if (!premiumEnabled) return matchesStatus && matchesSearch;

    const dateOk =
      (!premiumFilters.from || new Date(record.fecha) >= new Date(premiumFilters.from)) &&
      (!premiumFilters.to || new Date(record.fecha) <= new Date(premiumFilters.to));
    const transportistaOk = !premiumFilters.transportista || (record.transportista || "").toLowerCase().includes(premiumFilters.transportista.toLowerCase());
    const servicioOk = !premiumFilters.servicio || (record.servicio || "").toLowerCase().includes(premiumFilters.servicio.toLowerCase());
    const premiumStatusOk = !premiumFilters.status || premiumFilters.status === "Todos" || record.status === premiumFilters.status;

    return matchesStatus && matchesSearch && dateOk && transportistaOk && servicioOk && premiumStatusOk;
  });
};

const StatusBadge = ({ status }) => <span className={status === "Pagado" ? "badge-paid" : "badge-pending"}>{status}</span>;

const TAB_COLUMNS = {
  principal: ["fecha", "costo_t", "transportista", "servicio", "costo_l", "status", "total", "saldo_a_favor", "acciones"],
  transporte: ["fecha", "costo_t", "transportista", "servicio"],
  cliente: ["fecha", "servicio", "costo_l", "status"]
};

const COLUMN_LABELS = {
  fecha: "Fecha",
  costo_t: "Costo T",
  transportista: "Transportista",
  servicio: "Servicio",
  costo_l: "Costo L",
  status: "Status",
  total: "Total",
  saldo_a_favor: "Saldo a favor",
  acciones: "Acciones"
};

const MetricCard = ({ label, value, variant = "default" }) => {
  const colors = { default: "text-slate-900", success: "text-emerald-600", danger: "text-red-600" };
  return (
    <div className="metric-card" data-testid={`metric-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-2">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${colors[variant]}`}>{formatCurrency(value)}</p>
    </div>
  );
};

const RecordForm = ({ record, onSave, onCancel, loading }) => {
  const [form, setForm] = useState({
    fecha: record?.fecha || todayISO(),
    costo_t: record?.costo_t || 0,
    transportista: record?.transportista || "",
    servicio: record?.servicio || "",
    costo_l: record?.costo_l || 0,
    status: record?.status || "Pendiente",
    saldo_a_favor: record?.saldo_a_favor || 0
  });

  const total = toNumber(form.costo_t) + toNumber(form.costo_l);
  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          ...form,
          costo_t: toNumber(form.costo_t),
          costo_l: toNumber(form.costo_l),
          saldo_a_favor: toNumber(form.saldo_a_favor)
        });
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold mb-1 text-slate-700">Fecha</label>
          <input type="date" name="fecha" value={form.fecha} onChange={handleChange} className="form-input w-full" required />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1 text-slate-700">Transportista</label>
          <input type="text" name="transportista" value={form.transportista} onChange={handleChange} className="form-input w-full" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-semibold mb-1 text-slate-700">Servicio/Cliente</label>
        <input type="text" name="servicio" value={form.servicio} onChange={handleChange} className="form-input w-full" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-semibold mb-1 text-slate-700">Costo T</label>
          <input type="number" name="costo_t" value={form.costo_t} onChange={handleChange} className="form-input w-full" step="0.01" min="0" />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1 text-slate-700">Costo L</label>
          <input type="number" name="costo_l" value={form.costo_l} onChange={handleChange} className="form-input w-full" step="0.01" min="0" />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1 text-slate-700">Total</label>
          <div className="form-input w-full bg-slate-100 tabular-nums font-medium">{formatCurrency(total)}</div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold mb-1 text-slate-700">Status</label>
          <select name="status" value={form.status} onChange={handleChange} className="form-input w-full">
            <option value="Pendiente">Pendiente</option>
            <option value="Pagado">Pagado</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1 text-slate-700">Saldo a favor</label>
          <input type="number" name="saldo_a_favor" value={form.saldo_a_favor} onChange={handleChange} className="form-input w-full" step="0.01" min="0" />
        </div>
      </div>
      <div className="flex gap-3 pt-4">
        <button type="submit" className="btn-primary flex-1" disabled={loading}>{loading ? <SpinnerGap className="spinner" size={20} /> : <Plus size={20} />}{record ? "Actualizar" : "Guardar"}</button>
        <button type="button" onClick={onCancel} className="btn-secondary"><X size={20} />Cancelar</button>
      </div>
    </form>
  );
};

function App() {
  const [activeTab, setActiveTab] = useState("principal");
  const [records, setRecords] = useState([]);
  const [uploads, setUploads] = useState([]);
  const [favoriteFilters, setFavoriteFilters] = useState(() => readJSON(STORAGE_KEYS.favoriteFilters, []));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [loadingUploadId, setLoadingUploadId] = useState(null);
  const [clearingAll, setClearingAll] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem(STORAGE_KEYS.theme) === "dark");
  const [isPremiumUnlocked, setIsPremiumUnlocked] = useState(() => localStorage.getItem(STORAGE_KEYS.premium) === "1");
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [premiumKeyInput, setPremiumKeyInput] = useState("");
  const [premiumFilters, setPremiumFilters] = useState({ from: "", to: "", transportista: "", servicio: "", status: "Todos" });
  const [selectedIds, setSelectedIds] = useState([]);
  const [serverBooting, setServerBooting] = useState(true);
  const [backendAvailable, setBackendAvailable] = useState(false);
  const [noticeModal, setNoticeModal] = useState({ open: false, title: "", message: "" });
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);
  const [showFavoriteFilterModal, setShowFavoriteFilterModal] = useState(false);
  const [favoriteFilterInput, setFavoriteFilterInput] = useState("");

  const showNotice = (message, title = "Aviso") => setNoticeModal({ open: true, title, message });

  useEffect(() => localStorage.setItem(STORAGE_KEYS.favoriteFilters, JSON.stringify(favoriteFilters)), [favoriteFilters]);
  useEffect(() => localStorage.setItem(STORAGE_KEYS.theme, darkMode ? "dark" : "light"), [darkMode]);
  useEffect(() => localStorage.setItem(STORAGE_KEYS.premium, isPremiumUnlocked ? "1" : "0"), [isPremiumUnlocked]);

  useEffect(() => {
    const loadFromBackend = async () => {
      const maxAttempts = 8;
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
          const [recordsRes, uploadsRes] = await Promise.all([apiRequest("get", "/records"), apiRequest("get", "/uploads")]);
          setRecords(recordsRes.data || []);
          setUploads(uploadsRes.data || []);
          setBackendAvailable(true);
          setServerBooting(false);
          return;
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 900));
        }
      }
      setBackendAvailable(false);
      setServerBooting(false);
      showNotice("No se pudo conectar con quimbar-server.exe. Reinicia la app.", "Error");
    };
    loadFromBackend();
  }, []);

  const totals = useMemo(() => {
    const total_pendiente = records.filter((r) => r.status === "Pendiente").reduce((sum, r) => sum + toNumber(r.total), 0);
    const total_pagado = records.filter((r) => r.status === "Pagado").reduce((sum, r) => sum + toNumber(r.total), 0);
    const total_costo_l_pendiente = records.filter((r) => r.status === "Pendiente").reduce((sum, r) => sum + toNumber(r.costo_l), 0);
    return { total_pendiente, total_pagado, total_costo_l_pendiente };
  }, [records]);

  const filteredRecords = useMemo(
    () => applyFilters(records, searchTerm, statusFilter, premiumFilters, isPremiumUnlocked),
    [records, searchTerm, statusFilter, premiumFilters, isPremiumUnlocked]
  );
  const currentColumns = TAB_COLUMNS[activeTab] || TAB_COLUMNS.principal;

  const premiumAnalytics = useMemo(() => {
    const groupedByMonth = records.reduce((acc, record) => {
      const key = (record.fecha || todayISO()).slice(0, 7);
      if (!acc[key]) acc[key] = { month: key, pendiente: 0, pagado: 0, total: 0 };
      const amount = toNumber(record.total);
      acc[key].total += amount;
      acc[key][record.status === "Pagado" ? "pagado" : "pendiente"] += amount;
      return acc;
    }, {});

    const topTransportistas = Object.entries(
      records.reduce((acc, r) => {
        const key = (r.transportista || "Sin transportista").trim();
        acc[key] = (acc[key] || 0) + toNumber(r.total);
        return acc;
      }, {})
    )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    const topClientes = Object.entries(
      records.reduce((acc, r) => {
        const key = (r.servicio || "Sin cliente").trim();
        acc[key] = (acc[key] || 0) + toNumber(r.costo_l);
        return acc;
      }, {})
    )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    const overdue = records.filter((r) => r.status === "Pendiente" && (Date.now() - new Date(r.fecha).getTime()) / (1000 * 60 * 60 * 24) > 30);
    const incomplete = records.filter((r) => !r.transportista || !r.servicio);
    const upcoming = records.filter((r) => r.status === "Pendiente" && (new Date(r.fecha).getTime() - Date.now()) / (1000 * 60 * 60 * 24) <= 7);

    return {
      monthData: Object.values(groupedByMonth).sort((a, b) => (a.month > b.month ? 1 : -1)).slice(-6),
      topTransportistas,
      topClientes,
      overdue,
      incomplete,
      upcoming
    };
  }, [records]);

  const reloadBackendData = async () => {
    const [recordsRes, uploadsRes] = await Promise.all([apiRequest("get", "/records"), apiRequest("get", "/uploads")]);
    setRecords(recordsRes.data || []);
    setUploads(uploadsRes.data || []);
  };

  const handleSaveRecord = async (data) => {
    setSaving(true);
    try {
      if (!backendAvailable) throw new Error("backend_unavailable");
      if (selectedRecord) {
        await apiRequest("put", `/records/${selectedRecord.id}`, { data });
      } else {
        await apiRequest("post", "/records", { data });
      }
      await reloadBackendData();
      showNotice(selectedRecord ? "Registro actualizado" : "Registro creado", "Éxito");
      setShowForm(false);
      setSelectedRecord(null);
    } catch {
      showNotice("No se pudo guardar el registro", "Error");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRecord = async (id) => {
    if (!isPremiumUnlocked) return showNotice("Borrar registros es Premium", "Premium");
    if (!backendAvailable) return showNotice("Servidor no disponible", "Error");
    await apiRequest("delete", `/records/${id}`);
    await reloadBackendData();
    setShowDeleteConfirm(null);
    showNotice("Registro eliminado", "Éxito");
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (serverBooting) {
      showNotice("Espera un momento a que termine de iniciar el servidor y vuelve a subir el archivo.", "Servidor iniciando");
      e.target.value = "";
      return;
    }
    if (!backendAvailable) {
      showNotice("No se detectó quimbar-server.exe en ejecución.", "Error");
      e.target.value = "";
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await apiRequest("post", "/upload-excel", {
        data: formData,
        headers: { "Content-Type": "multipart/form-data" }
      });
      await reloadBackendData();
      showNotice(`${response.data?.records_imported || 0} registros importados`, "Éxito");
    } catch {
      showNotice("Error al procesar el Excel", "Error");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const exportToExcel = () => {
    const exportColumns = currentColumns.filter((column) => column !== "acciones");
    const rows = filteredRecords.map((record) => (
      exportColumns.reduce((acc, column) => {
        const key = COLUMN_LABELS[column]?.toUpperCase() || column.toUpperCase();
        if (column === "fecha") acc[key] = record.fecha;
        else if (column === "status") acc[key] = record.status || "-";
        else if (["costo_t", "costo_l", "total", "saldo_a_favor"].includes(column)) acc[key] = toNumber(record[column]);
        else acc[key] = record[column] || "-";
        return acc;
      }, {})
    ));

    if (activeTab === "cliente") {
      rows.push({});
      rows.push({
        [COLUMN_LABELS.servicio.toUpperCase()]: "TOTAL PENDIENTE",
        [COLUMN_LABELS.costo_l.toUpperCase()]: toNumber(totals.total_costo_l_pendiente)
      });
    }

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, TABS.find((tab) => tab.id === activeTab)?.label || "Registros");
    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `quimbar_${activeTab}_${todayISO()}.xlsx`);
    showNotice("Excel exportado", "Éxito");
  };

  const exportToPDF = () => {
    if (!isPremiumUnlocked) return showNotice("Exportar PDF es Premium", "Premium");
    const exportColumns = currentColumns.filter((column) => column !== "acciones");
    const header = exportColumns.map((column) => COLUMN_LABELS[column]);
    const body = filteredRecords.map((record) => (
      exportColumns.map((column) => {
        if (column === "fecha") return formatDate(record.fecha);
        if (column === "status") return record.status || "-";
        if (["costo_t", "costo_l", "total", "saldo_a_favor"].includes(column)) return formatCurrency(record[column]);
        return record[column] || "-";
      })
    ));

    if (activeTab === "cliente") {
      const summaryRow = exportColumns.map((column) => {
        if (column === "servicio") return "TOTAL PENDIENTE";
        if (column === "costo_l") return formatCurrency(totals.total_costo_l_pendiente);
        return "";
      });
      body.push(summaryRow);
    }

    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`Sistema de Quimbar - ${TABS.find((tab) => tab.id === activeTab)?.label || "Reporte"}`, 14, 20);
    autoTable(doc, {
      startY: 30,
      head: [header],
      body
    });
    doc.save(`quimbar_reporte_${activeTab}_${todayISO()}.pdf`);
    showNotice("PDF exportado", "Éxito");
  };

  const handleMassStatusChange = async (status) => {
    if (!selectedIds.length) return;
    if (!backendAvailable) return showNotice("Servidor no disponible", "Error");
    const selected = records.filter((r) => selectedIds.includes(r.id));
    await Promise.all(selected.map((record) => apiRequest("put", `/records/${record.id}`, { data: { status } })));
    await reloadBackendData();
    showNotice(`Se actualizaron ${selectedIds.length} registros`, "Éxito");
  };

  const handleMassDelete = async () => {
    if (!selectedIds.length) return;
    if (!backendAvailable) return showNotice("Servidor no disponible", "Error");
    await Promise.all(selectedIds.map((id) => apiRequest("delete", `/records/${id}`)));
    await reloadBackendData();
    setSelectedIds([]);
    showNotice("Registros eliminados por lote", "Éxito");
  };

  const handleMassDuplicate = async () => {
    if (!selectedIds.length) return;
    if (!backendAvailable) return showNotice("Servidor no disponible", "Error");
    const selected = records.filter((r) => selectedIds.includes(r.id));
    await Promise.all(selected.map((record) => apiRequest("post", "/records", {
      data: {
        fecha: record.fecha,
        costo_t: record.costo_t,
        transportista: record.transportista,
        servicio: record.servicio,
        costo_l: record.costo_l,
        status: record.status,
        saldo_a_favor: record.saldo_a_favor
      }
    })));
    await reloadBackendData();
    showNotice(`${selected.length} registros duplicados`, "Éxito");
  };

  const handleLoadUploadedFile = async (uploadId) => {
    setLoadingUploadId(uploadId);
    if (!backendAvailable) {
      setLoadingUploadId(null);
      return showNotice("Servidor no disponible", "Error");
    }
    await apiRequest("post", `/uploads/${uploadId}/load`);
    await reloadBackendData();
    showNotice("Historial cargado", "Éxito");
    setLoadingUploadId(null);
  };

  const handleDeleteUploadedFile = async (uploadId) => {
    if (!backendAvailable) return showNotice("Servidor no disponible", "Error");
    await apiRequest("delete", `/uploads/${uploadId}`);
    await reloadBackendData();
    showNotice("Archivo eliminado del historial", "Éxito");
  };

  const handleClearAllData = async () => {
    setShowClearAllConfirm(true);
  };

  const confirmClearAllData = async () => {
    setClearingAll(true);
    setShowClearAllConfirm(false);
    if (!backendAvailable) {
      setClearingAll(false);
      return showNotice("Servidor no disponible", "Error");
    }
    await Promise.all([apiRequest("delete", "/records"), apiRequest("delete", "/uploads")]);
    await reloadBackendData();
    setFavoriteFilters([]);
    setSearchTerm("");
    setStatusFilter("Todos");
    setSelectedIds([]);
    setClearingAll(false);
    showNotice("Todos los datos fueron eliminados", "Éxito");
  };

  const handleSaveFavoriteFilter = () => {
    if (!isPremiumUnlocked) return showNotice("Guardar filtros favoritos es Premium", "Premium");
    setFavoriteFilterInput("");
    setShowFavoriteFilterModal(true);
  };

  const confirmSaveFavoriteFilter = () => {
    const name = favoriteFilterInput.trim();
    if (!name) return showNotice("Escribe un nombre para el filtro favorito.", "Falta información");
    setFavoriteFilters((prev) => [{ id: crypto.randomUUID(), name, filters: premiumFilters }, ...prev]);
    setShowFavoriteFilterModal(false);
    setFavoriteFilterInput("");
    showNotice("Filtro favorito guardado", "Éxito");
  };

  const handleExportBackup = () => {
    const payload = { version: 1, exported_at: new Date().toISOString(), records, uploads, favoriteFilters };
    saveAs(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }), `quimbar_backup_${todayISO()}.json`);
    showNotice("Backup exportado", "Éxito");
  };

  return (
    <div className={`app-container ${darkMode ? "dark-theme" : ""}`}>
      <header className="app-header">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Sistema de Quimbar</h1>
            <p className="text-sm text-slate-500">
              {serverBooting
                ? "Iniciando servidor local en 127.0.0.1:8000..."
                : backendAvailable
                  ? "Conectado a quimbar-server.exe (127.0.0.1:8000)"
                  : "Error: quimbar-server.exe no disponible"} • Gestión de Registros
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="btn-primary cursor-pointer">
              <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} className="hidden" disabled={uploading} />
              {uploading ? <SpinnerGap className="spinner" size={20} /> : <UploadSimple size={20} />}Subir Excel
            </label>
            <button onClick={exportToExcel} className="btn-secondary"><FileXls size={20} />Excel</button>
            <button onClick={isPremiumUnlocked ? exportToPDF : () => setShowPremiumModal(true)} className="btn-secondary">{isPremiumUnlocked ? <FilePdf size={20} /> : <Lock size={20} />}{isPremiumUnlocked ? "PDF" : "PDF Premium"}</button>
            <button onClick={handleClearAllData} className="btn-danger" disabled={clearingAll}>{clearingAll ? <SpinnerGap className="spinner" size={20} /> : <Trash size={20} />}Borrar todo</button>
            <button onClick={() => setDarkMode((prev) => !prev)} className="btn-theme">{darkMode ? <Sun size={20} /> : <Moon size={20} />}{darkMode ? "Tema claro" : "Tema oscuro"}</button>
            <button onClick={() => (isPremiumUnlocked ? setIsPremiumUnlocked(false) : setShowPremiumModal(true))} className="btn-secondary">{isPremiumUnlocked ? <LockOpen size={20} /> : <Lock size={20} />}{isPremiumUnlocked ? "Premium activo" : "Activar Premium"}</button>
          </div>
        </div>
      </header>

      <main className="main-content max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
        <div className="hidden md:flex border-b border-slate-300 mb-6">
          {TABS.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${activeTab === tab.id ? "text-[#002FA7] border-[#002FA7]" : "text-slate-500 border-transparent hover:text-slate-700"}`}>
              <tab.icon size={20} />
              {tab.label}
            </button>
          ))}
        </div>

        {(activeTab === "principal" || activeTab === "cliente") && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {activeTab === "principal" && (
              <>
                <MetricCard label="Total Pendiente" value={totals.total_pendiente} variant="danger" />
                <MetricCard label="Total Pagado" value={totals.total_pagado} variant="success" />
              </>
            )}
            {activeTab === "cliente" && <MetricCard label="Total Pendiente" value={totals.total_costo_l_pendiente} variant="danger" />}
          </div>
        )}

        {isPremiumUnlocked && activeTab === "principal" && (
          <div className="premium-grid mb-6">
            <div className="premium-card">
              <h3><ChartLine size={16} /> Dashboard avanzado (6 meses)</h3>
              {premiumAnalytics.monthData.length === 0 ? <p>Sin datos</p> : premiumAnalytics.monthData.map((m) => <p key={m.month}>{m.month}: Pendiente {formatCurrency(m.pendiente)} · Pagado {formatCurrency(m.pagado)} · Total {formatCurrency(m.total)}</p>)}
            </div>
            <div className="premium-card">
              <h3><Bell size={16} /> Alertas</h3>
              <p>Pagos vencidos (+30 días): {premiumAnalytics.overdue.length}</p>
              <p>Registros incompletos: {premiumAnalytics.incomplete.length}</p>
              <p>Próximos cobros (7 días): {premiumAnalytics.upcoming.length}</p>
            </div>
            <div className="premium-card">
              <h3><CalendarBlank size={16} /> Top</h3>
              <p className="font-semibold mt-1">Transportistas</p>
              {premiumAnalytics.topTransportistas.map(([name, value]) => <p key={name}>{name}: {formatCurrency(value)}</p>)}
              <p className="font-semibold mt-2">Clientes/Servicios</p>
              {premiumAnalytics.topClientes.map(([name, value]) => <p key={name}>{name}: {formatCurrency(value)}</p>)}
            </div>
          </div>
        )}

        {activeTab !== "gestion" && (
          <div className="flex flex-col gap-3 mb-4 md:flex-row md:justify-between md:items-center">
            <p className="text-sm text-slate-500">{records.length} registros</p>
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="search-input-wrapper"><MagnifyingGlass size={18} className="text-slate-400" /><input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Buscar" className="search-input" /></div>
              <div className="filter-chip-group">
                {["Todos", "Pendiente", "Pagado"].map((f) => <button key={f} onClick={() => setStatusFilter(f)} className={`filter-chip ${statusFilter === f ? "active" : ""}`}>{f}</button>)}
              </div>
              {activeTab === "principal" && <button onClick={() => { setSelectedRecord(null); setShowForm(true); }} className="btn-primary"><Plus size={20} />Añadir Registro</button>}
            </div>
          </div>
        )}

        {isPremiumUnlocked && activeTab === "principal" && (
          <div className="premium-toolbar mb-4">
            <div className="premium-filters">
              <input type="date" className="form-input" value={premiumFilters.from} onChange={(e) => setPremiumFilters((prev) => ({ ...prev, from: e.target.value }))} />
              <input type="date" className="form-input" value={premiumFilters.to} onChange={(e) => setPremiumFilters((prev) => ({ ...prev, to: e.target.value }))} />
              <input type="text" className="form-input" placeholder="Transportista" value={premiumFilters.transportista} onChange={(e) => setPremiumFilters((prev) => ({ ...prev, transportista: e.target.value }))} />
              <input type="text" className="form-input" placeholder="Cliente/Servicio" value={premiumFilters.servicio} onChange={(e) => setPremiumFilters((prev) => ({ ...prev, servicio: e.target.value }))} />
              <button className="btn-secondary" onClick={handleSaveFavoriteFilter}><FloppyDisk size={16} />Guardar filtro</button>
              <select className="form-input" onChange={(e) => { const f = favoriteFilters.find((x) => x.id === e.target.value); if (f) setPremiumFilters(f.filters); }} defaultValue="">
                <option value="">Filtros favoritos</option>
                {favoriteFilters.map((f) => <option value={f.id} key={f.id}>{f.name}</option>)}
              </select>
            </div>
            <div className="premium-bulk">
              <button className="btn-secondary" onClick={() => handleMassStatusChange("Pagado")}><ArrowsClockwise size={16} />Marcar pagado</button>
              <button className="btn-secondary" onClick={() => handleMassStatusChange("Pendiente")}><ArrowsClockwise size={16} />Marcar pendiente</button>
              <button className="btn-secondary" onClick={handleMassDuplicate}><Copy size={16} />Duplicar</button>
              <button className="btn-danger" onClick={handleMassDelete}><Trash size={16} />Eliminar lote</button>
              <button className="btn-secondary" onClick={handleExportBackup}><Download size={16} />Backup</button>
            </div>
          </div>
        )}

        {activeTab !== "gestion" && (
          <div className="upload-history mb-6">
            <div className="upload-history-header"><h3><ClockCounterClockwise size={18} /> Historial de archivos</h3></div>
            {uploads.length === 0 ? <p className="upload-history-empty">Aún no has subido archivos.</p> : (
              <div className="upload-history-list">
                {uploads.map((upload) => (
                  <div className="upload-history-item" key={upload.id}>
                    <div>
                      <p className="upload-history-name">{upload.filename}</p>
                      <p className="upload-history-meta">{upload.records_count} registros • {formatDate(upload.uploaded_at)}</p>
                    </div>
                    <div className="upload-history-actions">
                      <button className="btn-secondary" onClick={() => handleLoadUploadedFile(upload.id)} disabled={loadingUploadId === upload.id}>{loadingUploadId === upload.id ? <SpinnerGap className="spinner" size={16} /> : <FolderOpen size={16} />}Cargar</button>
                      <button className="btn-danger" onClick={() => handleDeleteUploadedFile(upload.id)}><TrashSimple size={16} />Borrar</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "gestion" ? (
          <div className="table-container p-6"><h2 className="text-xl font-bold text-slate-900 mb-6">{selectedRecord ? "Editar Registro" : "Nuevo Registro"}</h2><RecordForm record={selectedRecord} onSave={handleSaveRecord} onCancel={() => { setShowForm(false); setSelectedRecord(null); setActiveTab("principal"); }} loading={saving} /></div>
        ) : (
          <div className="table-container">
            {loading ? (
              <div className="empty-state"><SpinnerGap className="spinner inline-block" size={32} /><p className="mt-2">Cargando...</p></div>
            ) : filteredRecords.length === 0 ? (
              <div className="empty-state"><Warning size={48} className="mx-auto mb-4 text-slate-400" /><p className="text-lg font-medium">No hay registros</p></div>
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      {isPremiumUnlocked && activeTab === "principal" && <th></th>}
                      {currentColumns.map((column) => {
                        const numericCol = ["costo_t", "costo_l", "total", "saldo_a_favor"].includes(column);
                        const centerCol = column === "acciones";
                        return (
                          <th key={column} className={numericCol ? "text-right" : centerCol ? "text-center" : ""}>
                            {COLUMN_LABELS[column]}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.map((record) => (
                      <tr key={record.id} className={selectedIds.includes(record.id) ? "row-selected" : ""}>
                        {isPremiumUnlocked && activeTab === "principal" && <td><input type="checkbox" checked={selectedIds.includes(record.id)} onChange={() => setSelectedIds((prev) => (prev.includes(record.id) ? prev.filter((id) => id !== record.id) : [...prev, record.id]))} /></td>}
                        {currentColumns.includes("fecha") && <td>{formatDate(record.fecha)}</td>}
                        {currentColumns.includes("costo_t") && <td className="text-right tabular-nums">{formatCurrency(record.costo_t)}</td>}
                        {currentColumns.includes("transportista") && <td>{record.transportista || "-"}</td>}
                        {currentColumns.includes("servicio") && <td>{record.servicio || "-"}</td>}
                        {currentColumns.includes("costo_l") && <td className="text-right tabular-nums">{formatCurrency(record.costo_l)}</td>}
                        {currentColumns.includes("status") && <td><StatusBadge status={record.status} /></td>}
                        {currentColumns.includes("total") && <td className="text-right tabular-nums">{formatCurrency(record.total)}</td>}
                        {currentColumns.includes("saldo_a_favor") && <td className="text-right tabular-nums">{formatCurrency(record.saldo_a_favor)}</td>}
                        {currentColumns.includes("acciones") && (
                          <td className="text-center">
                            <div className="flex justify-center gap-2">
                              <button
                                onClick={() => { if (!isPremiumUnlocked) return; setSelectedRecord(record); setShowForm(true); }}
                                className="p-1 hover:bg-slate-100 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                                disabled={!isPremiumUnlocked}
                                title={isPremiumUnlocked ? "Editar registro" : "Disponible solo en Premium"}
                              >
                                <PencilSimple size={18} />
                              </button>
                              <button
                                onClick={() => { if (!isPremiumUnlocked) return; setShowDeleteConfirm(record.id); }}
                                className="p-1 hover:bg-red-50 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                                disabled={!isPremiumUnlocked}
                                title={isPremiumUnlocked ? "Eliminar registro" : "Disponible solo en Premium"}
                              >
                                <Trash size={18} className="text-red-500" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      {showForm && activeTab !== "gestion" && (
        <>
          <div className="dialog-overlay" onClick={() => { setShowForm(false); setSelectedRecord(null); }} />
          <div className="dialog-content">
            <h2 className="text-xl font-bold text-slate-900 mb-6">{selectedRecord ? "Editar Registro" : "Nuevo Registro"}</h2>
            <RecordForm record={selectedRecord} onSave={handleSaveRecord} onCancel={() => { setShowForm(false); setSelectedRecord(null); }} loading={saving} />
          </div>
        </>
      )}

      {showPremiumModal && (
        <>
          <div className="dialog-overlay" onClick={() => setShowPremiumModal(false)} />
          <div className="dialog-content">
            <h2 className="text-xl font-bold text-slate-900 mb-2">Activar Premium</h2>
            <p className="text-sm text-slate-500 mb-4">Incluye filtros pro, dashboard, alertas, edición masiva y backup avanzado.</p>
            <input type="password" value={premiumKeyInput} onChange={(e) => setPremiumKeyInput(e.target.value)} className="form-input w-full" placeholder="Clave Premium" />
            <div className="flex gap-3 mt-4">
              <button className="btn-primary flex-1" onClick={() => {
                if (premiumKeyInput.trim() !== PREMIUM_ACCESS_KEY) return showNotice("Clave incorrecta", "Error");
                setIsPremiumUnlocked(true);
                setShowPremiumModal(false);
                setPremiumKeyInput("");
                showNotice("Premium activado", "Éxito");
              }}>Activar</button>
              <button className="btn-secondary" onClick={() => setShowPremiumModal(false)}>Cancelar</button>
            </div>
          </div>
        </>
      )}

      {showDeleteConfirm && (
        <>
          <div className="dialog-overlay" onClick={() => setShowDeleteConfirm(null)} />
          <div className="dialog-content text-center">
            <Warning size={48} className="mx-auto text-red-500 mb-4" />
            <h3 className="text-lg font-bold text-slate-900 mb-2">¿Eliminar registro?</h3>
            <p className="text-slate-500 mb-6">Esta acción no se puede deshacer.</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => handleDeleteRecord(showDeleteConfirm)} className="btn-danger"><Trash size={20} />Eliminar</button>
              <button onClick={() => setShowDeleteConfirm(null)} className="btn-secondary">Cancelar</button>
            </div>
          </div>
        </>
      )}

      {showClearAllConfirm && (
        <>
          <div className="dialog-overlay" onClick={() => setShowClearAllConfirm(false)} />
          <div className="dialog-content text-center">
            <Warning size={48} className="mx-auto text-red-500 mb-4" />
            <h3 className="text-lg font-bold text-slate-900 mb-2">¿Borrar todos los datos?</h3>
            <p className="text-slate-500 mb-6">Se eliminarán todos los registros e historial de archivos.</p>
            <div className="flex gap-3 justify-center">
              <button onClick={confirmClearAllData} className="btn-danger"><Trash size={20} />Sí, borrar todo</button>
              <button onClick={() => setShowClearAllConfirm(false)} className="btn-secondary">Cancelar</button>
            </div>
          </div>
        </>
      )}

      {showFavoriteFilterModal && (
        <>
          <div className="dialog-overlay" onClick={() => setShowFavoriteFilterModal(false)} />
          <div className="dialog-content">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Guardar filtro favorito</h3>
            <p className="text-slate-500 mb-4">Escribe un nombre para identificar este filtro.</p>
            <input
              className="form-input w-full"
              value={favoriteFilterInput}
              onChange={(e) => setFavoriteFilterInput(e.target.value)}
              placeholder="Ej. Pendientes de abril"
            />
            <div className="flex gap-3 justify-end mt-4">
              <button onClick={() => setShowFavoriteFilterModal(false)} className="btn-secondary">Cancelar</button>
              <button onClick={confirmSaveFavoriteFilter} className="btn-primary">Guardar</button>
            </div>
          </div>
        </>
      )}

      {noticeModal.open && (
        <>
          <div className="dialog-overlay" onClick={() => setNoticeModal({ open: false, title: "", message: "" })} />
          <div className="dialog-content text-center">
            <h3 className="text-lg font-bold text-slate-900 mb-2">{noticeModal.title}</h3>
            <p className="text-slate-600 mb-6">{noticeModal.message}</p>
            <button className="btn-primary" onClick={() => setNoticeModal({ open: false, title: "", message: "" })}>Aceptar</button>
          </div>
        </>
      )}
    </div>
  );
}

export default App;
