import { useState, useEffect, useCallback } from "react";
import "@/App.css";
import axios from "axios";
import { Toaster, toast } from "sonner";
import { 
  Files, 
  Truck, 
  Users, 
  PencilSimple, 
  Plus, 
  Trash, 
  UploadSimple, 
  DownloadSimple,
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
  LockOpen
} from "@phosphor-icons/react";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { saveAs } from 'file-saver';

const BACKEND_URL = (process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000').replace(/\/+$/, '');
const API_CANDIDATES = BACKEND_URL.endsWith('/api')
  ? [BACKEND_URL, BACKEND_URL.replace(/\/api$/, '')]
  : [`${BACKEND_URL}/api`, BACKEND_URL];

const apiRequest = async (method, path, options = {}) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  let lastError;

  for (const baseUrl of API_CANDIDATES) {
    try {
      return await axios({
        method,
        url: `${baseUrl}${normalizedPath}`,
        ...options
      });
    } catch (error) {
      lastError = error;
      if (error?.response?.status !== 404) {
        throw error;
      }
    }
  }

  throw lastError;
};

// Tabs
const TABS = [
  { id: 'principal', label: 'Archivo Principal', icon: Files },
  { id: 'transporte', label: 'Transporte', icon: Truck },
  { id: 'cliente', label: 'Cliente', icon: Users },
  { id: 'gestion', label: 'Gestión', icon: PencilSimple },
];

const PREMIUM_STORAGE_KEY = 'quimbar-premium-unlocked';
const PREMIUM_ACCESS_KEY = process.env.REACT_APP_PREMIUM_KEY || 'QUIMBAR-PREMIUM-2026';

// Format currency
const formatCurrency = (value) => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2
  }).format(value || 0);
};

// Format date
const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-MX', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  } catch {
    return dateStr;
  }
};

const getFilteredRecords = (records, searchTerm, statusFilter) => {
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const meaningfulRecords = records.filter((record) => {
    const hasContent =
      (record.transportista || '').trim() ||
      (record.servicio || '').trim() ||
      Number(record.costo_t || 0) > 0 ||
      Number(record.costo_l || 0) > 0 ||
      Number(record.saldo_a_favor || 0) > 0;
    return Boolean(hasContent);
  });

  return meaningfulRecords.filter((record) => {
    const matchesFilter = statusFilter === 'Todos' || record.status === statusFilter;
    const matchesSearch = !normalizedSearch || [
      record.fecha,
      record.transportista,
      record.servicio,
      record.status
    ].some((field) => String(field || '').toLowerCase().includes(normalizedSearch));
    return matchesFilter && matchesSearch;
  });
};

// Status Badge Component
const StatusBadge = ({ status }) => (
  <span className={status === 'Pagado' ? 'badge-paid' : 'badge-pending'}>
    {status}
  </span>
);

// Metric Card Component
const MetricCard = ({ label, value, variant = 'default' }) => {
  const colors = {
    default: 'text-slate-900',
    success: 'text-emerald-600',
    danger: 'text-red-600'
  };
  
  return (
    <div className="metric-card" data-testid={`metric-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-2">
        {label}
      </p>
      <p className={`text-2xl font-bold tabular-nums ${colors[variant]}`}>
        {formatCurrency(value)}
      </p>
    </div>
  );
};

// Record Form Component
const RecordForm = ({ record, onSave, onCancel, loading }) => {
  const [form, setForm] = useState({
    fecha: record?.fecha || new Date().toISOString().split('T')[0],
    costo_t: record?.costo_t || 0,
    transportista: record?.transportista || '',
    servicio: record?.servicio || '',
    costo_l: record?.costo_l || 0,
    status: record?.status || 'Pendiente',
    saldo_a_favor: record?.saldo_a_favor || 0
  });

  const total = parseFloat(form.costo_t || 0) + parseFloat(form.costo_l || 0);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...form,
      costo_t: parseFloat(form.costo_t) || 0,
      costo_l: parseFloat(form.costo_l) || 0,
      saldo_a_favor: parseFloat(form.saldo_a_favor) || 0
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold mb-1 text-slate-700">Fecha</label>
          <input
            type="date"
            name="fecha"
            value={form.fecha}
            onChange={handleChange}
            className="form-input w-full"
            data-testid="form-fecha"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1 text-slate-700">Transportista</label>
          <input
            type="text"
            name="transportista"
            value={form.transportista}
            onChange={handleChange}
            className="form-input w-full"
            placeholder="Nombre del transportista"
            data-testid="form-transportista"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold mb-1 text-slate-700">Servicio</label>
        <input
          type="text"
          name="servicio"
          value={form.servicio}
          onChange={handleChange}
          className="form-input w-full"
          placeholder="Descripción del servicio"
          data-testid="form-servicio"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-semibold mb-1 text-slate-700">Costo T</label>
          <input
            type="number"
            name="costo_t"
            value={form.costo_t}
            onChange={handleChange}
            className="form-input w-full tabular-nums"
            step="0.01"
            min="0"
            data-testid="form-costo-t"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1 text-slate-700">Costo L</label>
          <input
            type="number"
            name="costo_l"
            value={form.costo_l}
            onChange={handleChange}
            className="form-input w-full tabular-nums"
            step="0.01"
            min="0"
            data-testid="form-costo-l"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1 text-slate-700">Total (calculado)</label>
          <div className="form-input w-full bg-slate-100 tabular-nums font-medium">
            {formatCurrency(total)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold mb-1 text-slate-700">Status</label>
          <select
            name="status"
            value={form.status}
            onChange={handleChange}
            className="form-input w-full"
            data-testid="form-status"
          >
            <option value="Pendiente">Pendiente</option>
            <option value="Pagado">Pagado</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1 text-slate-700">Saldo a Favor</label>
          <input
            type="number"
            name="saldo_a_favor"
            value={form.saldo_a_favor}
            onChange={handleChange}
            className="form-input w-full tabular-nums"
            step="0.01"
            min="0"
            data-testid="form-saldo"
          />
        </div>
      </div>

      <div className="flex gap-3 pt-4">
        <button
          type="submit"
          className="btn-primary flex-1"
          disabled={loading}
          data-testid="form-submit"
        >
          {loading ? <SpinnerGap className="spinner" size={20} /> : <Plus size={20} />}
          {record ? 'Actualizar' : 'Guardar'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="btn-secondary"
          data-testid="form-cancel"
        >
          <X size={20} />
          Cancelar
        </button>
      </div>
    </form>
  );
};

// Main App Component
function App() {
  const [activeTab, setActiveTab] = useState('principal');
  const [records, setRecords] = useState([]);
  const [totals, setTotals] = useState({ total_pendiente: 0, total_pagado: 0, total_costo_l_pendiente: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploads, setUploads] = useState([]);
  const [loadingUploadId, setLoadingUploadId] = useState(null);
  const [clearingAll, setClearingAll] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('quimbar-theme') === 'dark');
  const [isPremiumUnlocked, setIsPremiumUnlocked] = useState(() => localStorage.getItem(PREMIUM_STORAGE_KEY) === '1');
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [premiumKeyInput, setPremiumKeyInput] = useState('');

  const fetchUploads = useCallback(async () => {
    try {
      const uploadsRes = await apiRequest('get', '/uploads');
      setUploads(uploadsRes.data || []);
    } catch (error) {
      console.error('Error fetching uploads:', error);
    }
  }, []);

  // Fetch records
  const fetchRecords = useCallback(async () => {
    try {
      const [recordsRes, totalsRes] = await Promise.all([
        apiRequest('get', '/records'),
        apiRequest('get', '/totals')
      ]);
      setRecords(recordsRes.data);
      setTotals(totalsRes.data);
    } catch (error) {
      console.error('Error fetching records:', error);
      toast.error('Error al cargar los registros');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecords();
    fetchUploads();
  }, [fetchRecords, fetchUploads]);

  useEffect(() => {
    localStorage.setItem('quimbar-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    localStorage.setItem(PREMIUM_STORAGE_KEY, isPremiumUnlocked ? '1' : '0');
  }, [isPremiumUnlocked]);

  // Save record
  const handleSaveRecord = async (data) => {
    setSaving(true);
    try {
      if (selectedRecord) {
        await apiRequest('put', `/records/${selectedRecord.id}`, { data });
        toast.success('Registro actualizado');
      } else {
        await apiRequest('post', '/records', { data });
        toast.success('Registro creado');
      }
      setShowForm(false);
      setSelectedRecord(null);
      fetchRecords();
    } catch (error) {
      console.error('Error saving record:', error);
      toast.error('Error al guardar el registro');
    } finally {
      setSaving(false);
    }
  };

  // Delete record
  const handleDeleteRecord = async (id) => {
    if (!isPremiumUnlocked) {
      toast.error('Borrar registros es una función Premium');
      return;
    }

    try {
      await apiRequest('delete', `/records/${id}`);
      toast.success('Registro eliminado');
      setShowDeleteConfirm(null);
      fetchRecords();
    } catch (error) {
      console.error('Error deleting record:', error);
      toast.error('Error al eliminar el registro');
    }
  };

  // Upload Excel
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await apiRequest('post', '/upload-excel', {
        data: formData,
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success(`${response.data.records_imported} registros importados`);
      if (response.data.errors?.length) {
        toast.warning(`${response.data.errors.length} errores encontrados`);
      }
      fetchRecords();
      fetchUploads();
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error(error.response?.data?.detail || 'Error al procesar el archivo');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  // Export to Excel
  const exportToExcel = () => {
    const filteredRecords = getFilteredRecords(records, searchTerm, statusFilter);
    const sectionName = activeTab === 'principal' ? 'general' : activeTab;

    let header = [];
    let rows = [];
    let columnWidths = [];

    if (activeTab === 'transporte') {
      header = ['FECHA', 'COSTO T', 'TRANSPORTISTA', 'SERVICIO'];
      rows = filteredRecords.map((r) => [
        formatDate(r.fecha),
        Number(r.costo_t || 0),
        r.transportista || '-',
        r.servicio || '-',
      ]);
      columnWidths = [{ wch: 14 }, { wch: 12 }, { wch: 24 }, { wch: 52 }];
    } else if (activeTab === 'cliente') {
      header = ['FECHA', 'SERVICIO', 'COSTO L', 'STATUS'];
      rows = filteredRecords.map((r) => [
        formatDate(r.fecha),
        r.servicio || '-',
        Number(r.costo_l || 0),
        (r.status || '').toUpperCase(),
      ]);
      const totalPendienteCliente = filteredRecords
        .filter((r) => r.status === 'Pendiente')
        .reduce((sum, r) => sum + Number(r.costo_l || 0), 0);
      rows.push([]);
      rows.push(['', 'TOTAL PENDIENTE', totalPendienteCliente, '']);
      columnWidths = [{ wch: 14 }, { wch: 56 }, { wch: 12 }, { wch: 14 }];
    } else {
      header = ['FECHA', 'COSTO T', 'TRANSPORTISTA', 'SERVICIO', 'COSTO L', 'STATUS', 'TOTAL', 'SALDO A FAVOR'];
      rows = filteredRecords.map((r) => [
        formatDate(r.fecha),
        Number(r.costo_t || 0),
        r.transportista || '-',
        r.servicio || '-',
        Number(r.costo_l || 0),
        (r.status || '').toUpperCase(),
        Number(r.total || 0),
        Number(r.saldo_a_favor || 0),
      ]);

      const totalPendiente = filteredRecords
        .filter((r) => r.status === 'Pendiente')
        .reduce((sum, r) => sum + Number(r.total || 0), 0);
      const totalPagado = filteredRecords
        .filter((r) => r.status === 'Pagado')
        .reduce((sum, r) => sum + Number(r.total || 0), 0);
      const saldoPendiente = filteredRecords
        .filter((r) => r.status === 'Pendiente')
        .reduce((sum, r) => sum + Number(r.saldo_a_favor || 0), 0);

      rows.push([]);
      rows.push(['', '', '', '', '', 'TOTAL PENDIENTE', totalPendiente, saldoPendiente]);
      rows.push(['', '', '', '', '', 'TOTAL PAGADO', totalPagado, '']);
      columnWidths = [{ wch: 14 }, { wch: 12 }, { wch: 24 }, { wch: 52 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 15 }];
    }

    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: header.length - 1, r: 0 } }) };
    ws['!cols'] = columnWidths;

    const moneyColumns = activeTab === 'transporte'
      ? [1]
      : activeTab === 'cliente'
        ? [2]
        : [1, 4, 6, 7];
    for (let rowIdx = 1; rowIdx <= rows.length; rowIdx += 1) {
      for (const colIdx of moneyColumns) {
        const cellRef = XLSX.utils.encode_cell({ c: colIdx, r: rowIdx });
        if (ws[cellRef] && typeof ws[cellRef].v === 'number') {
          ws[cellRef].z = '$ #,##0.00';
        }
      }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Registros');
    
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `quimbar_${sectionName}_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Excel exportado');
  };

  // Export to PDF
  const exportToPDF = () => {
    if (!isPremiumUnlocked) {
      toast.error('Exportar PDF es una función Premium');
      return;
    }

    const doc = new jsPDF();
    const filteredRecords = getFilteredRecords(records, searchTerm, statusFilter);
    
    doc.setFontSize(18);
    doc.text('Sistema de Quimbar - Reporte', 14, 22);
    doc.setFontSize(10);
    doc.text(`Fecha: ${new Date().toLocaleDateString('es-MX')}`, 14, 30);

    let tableHead = [];
    let tableData = [];

    if (activeTab === 'transporte') {
      tableHead = [['Fecha', 'Costo T', 'Transportista', 'Servicio']];
      tableData = filteredRecords.map((r) => [
        r.fecha,
        formatCurrency(r.costo_t),
        r.transportista,
        r.servicio,
      ]);
    } else if (activeTab === 'cliente') {
      tableHead = [['Fecha', 'Servicio', 'Costo L', 'Status']];
      tableData = filteredRecords.map((r) => [
        r.fecha,
        r.servicio,
        formatCurrency(r.costo_l),
        r.status,
      ]);
    } else {
      tableHead = [['Fecha', 'Costo T', 'Transportista', 'Servicio', 'Costo L', 'Status', 'Total', 'Saldo']];
      tableData = filteredRecords.map((r) => [
        r.fecha,
        formatCurrency(r.costo_t),
        r.transportista,
        r.servicio,
        formatCurrency(r.costo_l),
        r.status,
        formatCurrency(r.total),
        formatCurrency(r.saldo_a_favor),
      ]);
    }

    autoTable(doc, {
      head: tableHead,
      body: tableData,
      startY: 40,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [0, 47, 167] }
    });

    const totalAPagar = activeTab === 'transporte'
      ? filteredRecords.reduce((sum, r) => sum + Number(r.costo_t || 0), 0)
      : activeTab === 'cliente'
        ? filteredRecords.reduce((sum, r) => sum + Number(r.costo_l || 0), 0)
        : filteredRecords.reduce((sum, r) => sum + Number(r.total || 0), 0);

    let finalY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(10);
    doc.text(`Total a pagar: ${formatCurrency(totalAPagar)}`, 14, finalY);

    if (activeTab === 'principal') {
      const totalPendiente = filteredRecords
        .filter((r) => r.status === 'Pendiente')
        .reduce((sum, r) => sum + Number(r.total || 0), 0);
      const totalPagado = filteredRecords
        .filter((r) => r.status === 'Pagado')
        .reduce((sum, r) => sum + Number(r.total || 0), 0);
      finalY += 6;
      doc.text(`Total Pendiente: ${formatCurrency(totalPendiente)}`, 14, finalY);
      doc.text(`Total Pagado: ${formatCurrency(totalPagado)}`, 14, finalY + 6);
    }

    doc.save(`quimbar_reporte_${new Date().toISOString().split('T')[0]}.pdf`);
    toast.success('PDF exportado');
  };

  // Edit record
  const handleEdit = (record) => {
    if (!isPremiumUnlocked) {
      toast.error('Editar registros es una función Premium');
      return;
    }
    setSelectedRecord(record);
    setShowForm(true);
  };

  const handleUnlockPremium = () => {
    if (premiumKeyInput.trim() === PREMIUM_ACCESS_KEY) {
      setIsPremiumUnlocked(true);
      setShowPremiumModal(false);
      setPremiumKeyInput('');
      toast.success('Modo Premium activado');
      return;
    }
    toast.error('Clave incorrecta');
  };

  const totalSaldoFavor = records.reduce((sum, record) => sum + Number(record.saldo_a_favor || 0), 0);

  // Render table based on active tab
  const renderTable = () => {
    const filteredRecords = getFilteredRecords(records, searchTerm, statusFilter);

    if (loading) {
      return (
        <div className="empty-state">
          <SpinnerGap className="spinner inline-block" size={32} />
          <p className="mt-2">Cargando registros...</p>
        </div>
      );
    }

    if (filteredRecords.length === 0) {
      return (
        <div className="empty-state" data-testid="empty-state">
          <Warning size={48} className="mx-auto mb-4 text-slate-400" />
          <p className="text-lg font-medium">
            {records.length === 0 ? 'No hay registros' : 'Sin resultados para los filtros actuales'}
          </p>
          <p className="text-sm mt-1">
            {records.length === 0 ? 'Sube un archivo Excel o agrega un nuevo registro' : 'Prueba con otra búsqueda o cambia el filtro'}
          </p>
        </div>
      );
    }

    if (activeTab === 'principal') {
      return (
        <div className="table-scroll">
          <table className="data-table" data-testid="table-principal">
            <thead>
              <tr>
                <th>Fecha</th>
                <th className="text-right">Costo T</th>
                <th>Transportista</th>
                <th>Servicio</th>
                <th className="text-right">Costo L</th>
                <th>Status</th>
                <th className="text-right">Total</th>
                <th className="text-right">Saldo a Favor</th>
                <th className="text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map(record => (
                <tr key={record.id} data-testid={`row-${record.id}`}>
                  <td>{formatDate(record.fecha)}</td>
                  <td className="text-right tabular-nums">{formatCurrency(record.costo_t)}</td>
                  <td>{record.transportista || '-'}</td>
                  <td>{record.servicio || '-'}</td>
                  <td className="text-right tabular-nums">{formatCurrency(record.costo_l)}</td>
                  <td><StatusBadge status={record.status} /></td>
                  <td className="text-right tabular-nums font-medium">{formatCurrency(record.total)}</td>
                  <td className="text-right tabular-nums">{formatCurrency(record.saldo_a_favor)}</td>
                  <td className="text-center">
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() => handleEdit(record)}
                        className="p-1 hover:bg-slate-100 rounded"
                        title="Editar"
                        data-testid={`edit-${record.id}`}
                        disabled={!isPremiumUnlocked}
                      >
                        <PencilSimple size={18} className={isPremiumUnlocked ? 'text-slate-600' : 'text-slate-300'} />
                      </button>
                      <button
                        onClick={() => {
                          if (!isPremiumUnlocked) {
                            toast.error('Borrar registros es una función Premium');
                            return;
                          }
                          setShowDeleteConfirm(record.id);
                        }}
                        className="p-1 hover:bg-red-50 rounded"
                        title="Eliminar"
                        data-testid={`delete-${record.id}`}
                        disabled={!isPremiumUnlocked}
                      >
                        <Trash size={18} className={isPremiumUnlocked ? 'text-red-500' : 'text-slate-300'} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (activeTab === 'transporte') {
      return (
        <div className="table-scroll">
          <table className="data-table" data-testid="table-transporte">
            <thead>
              <tr>
                <th>Fecha</th>
                <th className="text-right">Costo T</th>
                <th>Transportista</th>
                <th>Servicio</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map(record => (
                <tr key={record.id}>
                  <td>{formatDate(record.fecha)}</td>
                  <td className="text-right tabular-nums">{formatCurrency(record.costo_t)}</td>
                  <td>{record.transportista || '-'}</td>
                  <td>{record.servicio || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (activeTab === 'cliente') {
      return (
        <div className="table-scroll">
          <table className="data-table" data-testid="table-cliente">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Servicio</th>
                <th className="text-right">Costo L</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map(record => (
                <tr key={record.id}>
                  <td>{formatDate(record.fecha)}</td>
                  <td>{record.servicio || '-'}</td>
                  <td className="text-right tabular-nums">{formatCurrency(record.costo_l)}</td>
                  <td><StatusBadge status={record.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    return null;
  };

  const handleLoadUploadedFile = async (uploadId) => {
    setLoadingUploadId(uploadId);
    try {
      await apiRequest('post', `/uploads/${uploadId}/load`);
      toast.success('Archivo cargado en la tabla');
      fetchRecords();
    } catch (error) {
      console.error('Error loading uploaded file:', error);
      toast.error(error.response?.data?.detail || 'No se pudo cargar el archivo');
    } finally {
      setLoadingUploadId(null);
    }
  };

  const handleDeleteUploadedFile = async (uploadId) => {
    try {
      await apiRequest('delete', `/uploads/${uploadId}`);
      toast.success('Archivo eliminado del historial');
      fetchUploads();
    } catch (error) {
      console.error('Error deleting uploaded file:', error);
      toast.error(error.response?.data?.detail || 'No se pudo eliminar el archivo');
    }
  };

  const handleClearAllData = async () => {
    const confirmed = window.confirm('¿Seguro que quieres borrar todos los registros y todo el historial de archivos?');
    if (!confirmed) return;

    setClearingAll(true);
    try {
      await Promise.all([
        apiRequest('delete', '/records'),
        apiRequest('delete', '/uploads')
      ]);
      toast.success('Se borraron todos los datos de la aplicación');
      setSearchTerm('');
      setStatusFilter('Todos');
      await Promise.all([fetchRecords(), fetchUploads()]);
    } catch (error) {
      console.error('Error clearing all data:', error);
      toast.error(error.response?.data?.detail || 'No se pudieron borrar todos los datos');
    } finally {
      setClearingAll(false);
    }
  };

  return (
    <div className={`app-container ${darkMode ? 'dark-theme' : ''}`}>
      <Toaster position="top-right" richColors />
      
      {/* Header */}
      <header className="app-header">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900" data-testid="app-title">
              Sistema de Quimbar
            </h1>
            <p className="text-sm text-slate-500">Primo Ale - Gestión de Registros</p>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <label className="btn-primary cursor-pointer">
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
                disabled={uploading}
                data-testid="upload-input"
              />
              {uploading ? <SpinnerGap className="spinner" size={20} /> : <UploadSimple size={20} />}
              Subir Excel
            </label>
            <button onClick={exportToExcel} className="btn-secondary" data-testid="export-excel">
              <FileXls size={20} />
              Excel
            </button>
            {isPremiumUnlocked ? (
              <button onClick={exportToPDF} className="btn-secondary" data-testid="export-pdf">
                <FilePdf size={20} />
                PDF
              </button>
            ) : (
              <button onClick={() => setShowPremiumModal(true)} className="btn-secondary" data-testid="premium-pdf-lock">
                <Lock size={20} />
                PDF Premium
              </button>
            )}
            <button
              onClick={handleClearAllData}
              className="btn-danger"
              data-testid="clear-all-btn"
              disabled={clearingAll}
            >
              {clearingAll ? <SpinnerGap className="spinner" size={20} /> : <Trash size={20} />}
              Borrar todo
            </button>
            <button
              onClick={() => setDarkMode(prev => !prev)}
              className="btn-theme"
              data-testid="theme-toggle-btn"
            >
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
              {darkMode ? 'Tema claro' : 'Tema oscuro'}
            </button>
            <button
              onClick={() => {
                if (isPremiumUnlocked) {
                  setIsPremiumUnlocked(false);
                  toast.success('Modo Premium desactivado');
                } else {
                  setShowPremiumModal(true);
                }
              }}
              className="btn-secondary"
              data-testid="premium-toggle-btn"
            >
              {isPremiumUnlocked ? <LockOpen size={20} /> : <Lock size={20} />}
              {isPremiumUnlocked ? 'Premium activo' : 'Activar Premium'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
        {/* Tabs - Desktop */}
        <div className="hidden md:flex border-b border-slate-300 mb-6">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab.id
                  ? 'text-[#002FA7] border-[#002FA7]'
                  : 'text-slate-500 border-transparent hover:text-slate-700'
              }`}
              data-testid={`tab-${tab.id}`}
            >
              <tab.icon size={20} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Totals Panel */}
        {(activeTab === 'principal' || activeTab === 'cliente') && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {activeTab === 'principal' && (
              <>
                <MetricCard label="Total Pendiente" value={totals.total_pendiente} variant="danger" />
                <MetricCard label="Total Pagado" value={totals.total_pagado} variant="success" />
                <MetricCard 
                  label="Total General" 
                  value={totals.total_pendiente + totals.total_pagado} 
                />
                {isPremiumUnlocked && (
                  <MetricCard
                    label="Total Saldo a Favor"
                    value={totalSaldoFavor}
                    variant="success"
                  />
                )}
              </>
            )}
            {activeTab === 'cliente' && (
              <MetricCard 
                label="Total Costo L Pendiente" 
                value={totals.total_costo_l_pendiente} 
                variant="danger" 
              />
            )}
          </div>
        )}

        {/* Actions Bar */}
        {activeTab !== 'gestion' && (
          <div className="flex flex-col gap-3 mb-4 md:flex-row md:justify-between md:items-center">
            <p className="text-sm text-slate-500">
              {records.length} registro{records.length !== 1 ? 's' : ''}
            </p>
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              {isPremiumUnlocked ? (
                <div className="search-input-wrapper">
                  <MagnifyingGlass size={18} className="text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar fecha, transportista o servicio"
                    className="search-input"
                    data-testid="search-input"
                  />
                </div>
              ) : (
                <button
                  className="btn-secondary"
                  onClick={() => setShowPremiumModal(true)}
                  data-testid="premium-search-lock"
                >
                  <Lock size={16} />
                  Barra de Búsqueda (Premium)
                </button>
              )}

              <div className="filter-chip-group" data-testid="status-filter">
                {['Todos', 'Pendiente', 'Pagado'].map((filterOption) => (
                  <button
                    key={filterOption}
                    onClick={() => setStatusFilter(filterOption)}
                    className={`filter-chip ${statusFilter === filterOption ? 'active' : ''}`}
                    data-testid={`status-filter-${filterOption.toLowerCase()}`}
                  >
                    {filterOption}
                  </button>
                ))}
              </div>

              {activeTab === 'principal' && (
                <button
                  onClick={() => { setSelectedRecord(null); setShowForm(true); }}
                  className="btn-primary"
                  data-testid="add-record-btn"
                >
                  <Plus size={20} />
                  Añadir Registro
                </button>
              )}
            </div>
          </div>
        )}

        {/* Upload history */}
        {activeTab !== 'gestion' && (
          <div className="upload-history mb-6">
            <div className="upload-history-header">
              <h3><ClockCounterClockwise size={18} /> Historial de archivos</h3>
            </div>
            {uploads.length === 0 ? (
              <p className="upload-history-empty">Aún no has subido archivos.</p>
            ) : (
              <div className="upload-history-list">
                {uploads.map((upload) => (
                  <div className="upload-history-item" key={upload.id}>
                    <div>
                      <p className="upload-history-name">{upload.filename}</p>
                      <p className="upload-history-meta">
                        {upload.records_count} registros • {formatDate(upload.uploaded_at)}
                      </p>
                    </div>
                    <div className="upload-history-actions">
                      <button
                        className="btn-secondary"
                        onClick={() => handleLoadUploadedFile(upload.id)}
                        disabled={loadingUploadId === upload.id}
                      >
                        {loadingUploadId === upload.id ? <SpinnerGap className="spinner" size={16} /> : <FolderOpen size={16} />}
                        Cargar
                      </button>
                      <button
                        className="btn-danger"
                        onClick={() => handleDeleteUploadedFile(upload.id)}
                      >
                        <TrashSimple size={16} />
                        Borrar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Content */}
        {activeTab === 'gestion' ? (
          <div className="table-container p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-6">
              {selectedRecord ? 'Editar Registro' : 'Nuevo Registro'}
            </h2>
            <RecordForm
              record={selectedRecord}
              onSave={handleSaveRecord}
              onCancel={() => { setShowForm(false); setSelectedRecord(null); setActiveTab('principal'); }}
              loading={saving}
            />
          </div>
        ) : (
          <div className="table-container">
            {renderTable()}
          </div>
        )}
      </main>

      {/* Mobile Navigation */}
      <nav className="mobile-nav md:hidden">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-col items-center gap-1 px-3 py-2 text-xs font-medium rounded transition-colors ${
              activeTab === tab.id
                ? 'text-[#002FA7] bg-blue-50'
                : 'text-slate-500'
            }`}
            data-testid={`mobile-tab-${tab.id}`}
          >
            <tab.icon size={24} weight={activeTab === tab.id ? 'fill' : 'regular'} />
            <span className="truncate max-w-[60px]">{tab.label.split(' ')[0]}</span>
          </button>
        ))}
      </nav>

      {/* Form Modal */}
      {showForm && activeTab !== 'gestion' && (
        <>
          <div className="dialog-overlay" onClick={() => { setShowForm(false); setSelectedRecord(null); }} />
          <div className="dialog-content">
            <h2 className="text-xl font-bold text-slate-900 mb-6">
              {selectedRecord ? 'Editar Registro' : 'Nuevo Registro'}
            </h2>
            <RecordForm
              record={selectedRecord}
              onSave={handleSaveRecord}
              onCancel={() => { setShowForm(false); setSelectedRecord(null); }}
              loading={saving}
            />
          </div>
        </>
      )}

      {showPremiumModal && (
        <>
          <div className="dialog-overlay" onClick={() => setShowPremiumModal(false)} />
          <div className="dialog-content">
            <h2 className="text-xl font-bold text-slate-900 mb-2">Activar modo Premium</h2>
            <p className="text-sm text-slate-500 mb-4">
              Ingresa tu clave para habilitar PDF, búsqueda, total saldo a favor y edición/borrado.
            </p>
            <input
              type="password"
              value={premiumKeyInput}
              onChange={(e) => setPremiumKeyInput(e.target.value)}
              className="form-input w-full"
              placeholder="Clave Premium"
              data-testid="premium-key-input"
            />
            <div className="flex gap-3 mt-4">
              <button className="btn-primary flex-1" onClick={handleUnlockPremium} data-testid="premium-key-submit">
                Activar
              </button>
              <button className="btn-secondary" onClick={() => setShowPremiumModal(false)}>
                Cancelar
              </button>
            </div>
          </div>
        </>
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <>
          <div className="dialog-overlay" onClick={() => setShowDeleteConfirm(null)} />
          <div className="dialog-content text-center">
            <Warning size={48} className="mx-auto text-red-500 mb-4" />
            <h3 className="text-lg font-bold text-slate-900 mb-2">¿Eliminar registro?</h3>
            <p className="text-slate-500 mb-6">Esta acción no se puede deshacer.</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => handleDeleteRecord(showDeleteConfirm)}
                className="btn-danger"
                data-testid="confirm-delete"
              >
                <Trash size={20} />
                Eliminar
              </button>
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="btn-secondary"
                data-testid="cancel-delete"
              >
                Cancelar
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default App;
