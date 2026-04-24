import React, { useState, useEffect } from 'react';
import { 
  Wallet, TrendingUp, PiggyBank, Search, Plus, MoreVertical, 
  CheckCircle2, Calendar, User, FileText, Printer, X, 
  MessageCircle, Edit, Trash2, AlertCircle, RefreshCw, 
  History, ArrowDownRight, ArrowUpRight, Cloud, Download, Upload, ListChecks, Save, FileJson, Trash, Lock
} from 'lucide-react';

import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, addDoc, updateDoc, deleteDoc, writeBatch, query, getDocs } from 'firebase/firestore';

if (typeof window !== 'undefined') {
  window.tailwind = window.tailwind || { config: {} };
}

// 1. CONFIGURACIÓN FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyCBKn0LYIjkSc27lBJ6nzm-V4h2SdI7uz4",
  authDomain: "prestafacil-4e73a.firebaseapp.com",
  projectId: "prestafacil-4e73a",
  storageBucket: "prestafacil-4e73a.firebasestorage.app",
  messagingSenderId: "48360971872",
  appId: "1:48360971872:web:ccbc86eab3deef1e3e6d05"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ID FIJO CRÍTICO: Esto asegura que Vercel y StackBlitz compartan la misma base de datos
const appId = 'prestafacil-produccion-final-v1';

// --- CONFIGURACIÓN DE ACCESO ---
const PIN_ACCESO = "1234"; 

export default function App() {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [loans, setLoans] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [activeTab, setActiveTab] = useState('activos');
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [authError, setAuthError] = useState(null);
  
  // Modales
  const [currentLoan, setCurrentLoan] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showNewLoanModal, setShowNewLoanModal] = useState(false);
  const [showCashModal, setShowCashModal] = useState(false);
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [showMigrationModal, setShowMigrationModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [systemMessage, setSystemMessage] = useState(null);
  
  // Formularios
  const [migrationText, setMigrationText] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [newLoanForm, setNewLoanForm] = useState({
    client: '', phone: '', calcMethod: 'interes', capital: '', interestRate: '', fixedQuota: '', installments: '', freqDays: 15
  });
  const [editForm, setEditForm] = useState({ client: '', phone: '', debt: '', remaining: '', status: '' });
  const [cashForm, setCashForm] = useState({ type: 'INYECCION', amount: '', concept: '' });

  // Autenticación Base
  useEffect(() => {
    const initAuth = async () => {
      try { await signInAnonymously(auth); } 
      catch (error) { setAuthError("⚠️ Error de conexión a Firebase."); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => { if (u) setUser(u); });
    return () => unsubscribe();
  }, []);

  // Carga de Datos Segura
  useEffect(() => {
    if (!user || !isAuthenticated) return;
    
    const unsubLoans = onSnapshot(collection(db, 'artifacts', appId, 'users', user.uid, 'loans'), (s) => {
      setLoans(s.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error("Error préstamos:", err));

    const unsubTrans = onSnapshot(collection(db, 'artifacts', appId, 'users', user.uid, 'transactions'), (s) => {
      const t = s.docs.map(d => ({ id: d.id, ...d.data() }));
      t.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
      setTransactions(t);
    }, (err) => console.error("Error transacciones:", err));

    return () => { unsubLoans(); unsubTrans(); };
  }, [user, isAuthenticated]);

  const handleLogin = (e) => {
    e.preventDefault();
    if (pinInput === PIN_ACCESO) {
      setIsAuthenticated(true);
      setSystemMessage("🔓 Acceso Correcto.");
    } else {
      setSystemMessage("❌ PIN incorrecto.");
      setPinInput('');
    }
  };

  // Cálculos con protección contra valores nulos (Evita pantalla negra)
  const cajaDisponible = (transactions || []).reduce((t, tr) => {
    const amt = Number(tr.amount || 0);
    return tr.type === 'RETIRO' ? t - amt : t + amt;
  }, 0);
  
  const capitalEnCalle = (loans || []).reduce((t, l) => {
    return l.status === 'ACTIVO' ? t + Number(l.remaining || 0) : t;
  }, 0);
  
  const uniqueClients = Array.from(new Set((loans || []).map(l => l.client || '')))
    .filter(name => name !== '')
    .map(name => loans.find(l => l.client === name));

  const formatMoney = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(n) || 0);

  // MIGRACIÓN Y BACKUP
  const handleExportBackup = () => {
    const data = { loans, transactions, exportDate: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_prestafacil_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  const handleMigrateData = async (clearFirst = false) => {
    if (!migrationText.trim()) return;
    try {
      if (clearFirst) {
        const batch = writeBatch(db);
        loans.forEach(l => batch.delete(doc(db, 'artifacts', appId, 'users', user.uid, 'loans', l.id)));
        transactions.forEach(t => batch.delete(doc(db, 'artifacts', appId, 'users', user.uid, 'transactions', t.id)));
        await batch.commit();
      }

      let parsed = JSON.parse(migrationText);
      const dataLoans = Array.isArray(parsed) ? parsed : (parsed.loans || []);
      const dataCash = parsed.capitalHistory || parsed.transactions || [];
      
      const loansRef = collection(db, 'artifacts', appId, 'users', user.uid, 'loans');
      const transRef = collection(db, 'artifacts', appId, 'users', user.uid, 'transactions');
      
      for (const item of dataLoans) {
        const totalDebt = parseFloat(item.totalDebt || item.debt || 0);
        const paid = parseFloat(item.paid || 0);
        await addDoc(loansRef, {
          client: item.client || 'Sin nombre',
          phone: item.phone || '',
          date: item.startDate || item.date || new Date().toLocaleDateString('es-DO'),
          progress: totalDebt > 0 ? Math.round((paid / totalDebt) * 100) : 0,
          debt: totalDebt,
          remaining: totalDebt - paid,
          status: (item.status === 'completed' || item.paid >= item.debt) ? 'PAGADO' : 'ACTIVO',
          freqDays: Number(item.freqDays || 15),
          installments: Number(item.term || 1)
        });
      }

      for (const cashItem of dataCash) {
        await addDoc(transRef, {
          type: (Number(cashItem.amount) >= 0) ? 'INYECCION' : 'RETIRO',
          amount: Math.abs(Number(cashItem.amount || 0)),
          concept: cashItem.note || cashItem.concept || 'Migración',
          date: cashItem.date || new Date().toISOString()
        });
      }
      setSystemMessage("✅ Datos restaurados con éxito.");
      setShowMigrationModal(false);
      setMigrationText('');
    } catch (e) { setSystemMessage("❌ Error en el archivo JSON."); }
  };

  const calculateSchedule = (loan) => {
    if (!loan) return [];
    const schedule = [];
    const startDate = new Date(loan.date);
    const freq = Number(loan.freqDays || 15);
    const totalInst = Number(loan.installments || 1);
    const quotaAmount = (Number(loan.debt || 0) / totalInst);
    for (let i = 1; i <= totalInst; i++) {
      const dueDate = new Date(startDate);
      dueDate.setDate(startDate.getDate() + (freq * i));
      schedule.push({ num: i, date: dueDate.toLocaleDateString('es-DO'), amount: quotaAmount });
    }
    return schedule;
  };

  const handleWhatsAppSchedule = () => {
    const sched = calculateSchedule(currentLoan);
    let text = `📅 *PLAN DE PAGOS - PRESTAFÁCIL*%0A👤 *Cliente:* ${currentLoan.client}%0A---------------------------%0A`;
    sched.forEach(s => { text += `🔹 Cuota ${s.num}: ${s.date} - ${formatMoney(s.amount)}%0A`; });
    window.open(`https://wa.me/1${currentLoan?.phone?.replace(/\D/g, '')}?text=${text}`, '_blank');
  };

  const handleClientNameChange = (e) => {
    const name = e.target.value;
    const existing = uniqueClients.find(c => c?.client?.toLowerCase() === name.toLowerCase());
    setNewLoanForm({ ...newLoanForm, client: name, phone: existing ? existing.phone : newLoanForm.phone });
  };

  const handleSaveNewLoan = async (e) => {
    e.preventDefault();
    const cap = parseFloat(newLoanForm.capital);
    const inst = parseInt(newLoanForm.installments);
    const total = newLoanForm.calcMethod === 'fija' ? parseFloat(newLoanForm.fixedQuota) * inst : cap + (cap * (parseFloat(newLoanForm.interestRate) / 100));
    if (cap > cajaDisponible) return setSystemMessage("⚠️ Caja insuficiente.");
    try {
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'loans'), { 
        client: newLoanForm.client, phone: newLoanForm.phone, date: new Date().toLocaleDateString('es-DO'), 
        progress: 0, debt: total, remaining: total, status: 'ACTIVO', freqDays: parseInt(newLoanForm.freqDays), installments: inst
      });
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'transactions'), { 
        type: 'RETIRO', amount: cap, concept: `Préstamo: ${newLoanForm.client}`, date: new Date().toISOString() 
      });
      setShowNewLoanModal(false);
      setNewLoanForm({ client: '', phone: '', calcMethod: 'interes', capital: '', interestRate: '', fixedQuota: '', installments: '', freqDays: 15 });
    } catch (e) { console.error(e); }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!window.confirm("⚠️ ¿Modificar valores reales del registro?")) return;
    try {
      const d = Number(editForm.debt);
      const r = Number(editForm.remaining);
      await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'loans', currentLoan.id), {
        ...editForm, debt: d, remaining: r, progress: Math.round(((d - r) / d) * 100) || 0
      });
      setShowEditModal(false);
      setSystemMessage("✅ Registro actualizado.");
    } catch (e) { setSystemMessage("Error al editar."); }
  };

  const handleProcessPayment = async (e) => {
    e.preventDefault();
    if (!currentLoan) return;
    const monto = parseFloat(paymentAmount) || 0;
    const resta = Math.max(0, currentLoan.remaining - monto);
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'loans', currentLoan.id), { 
        remaining: resta, progress: Math.round(((currentLoan.debt - resta) / currentLoan.debt) * 100), status: resta === 0 ? 'PAGADO' : 'ACTIVO' 
      });
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'transactions'), { 
        type: 'INYECCION', amount: monto, concept: `Pago Recibido: ${currentLoan.client}`, date: new Date().toISOString() 
      });
      setShowPaymentModal(false); setShowReceiptModal(true);
    } catch (e) { console.error(e); }
  };

  const handleSaveCashTransaction = async (e) => {
    e.preventDefault();
    const monto = parseFloat(cashForm.amount);
    if (cashForm.type === 'RETIRO' && monto > cajaDisponible) return setSystemMessage("⚠️ Saldo insuficiente.");
    try {
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'transactions'), { ...cashForm, amount: monto, date: new Date().toISOString() });
      setCashForm({ type: 'INYECCION', amount: '', concept: '' });
      setSystemMessage("✅ Caja ajustada.");
    } catch (e) { console.error(e); }
  };

  const closeAllModals = () => { 
    setShowPaymentModal(false); setShowReceiptModal(false); setShowNewLoanModal(false); 
    setShowCashModal(false); setShowRenewModal(false); setShowMigrationModal(false); 
    setShowScheduleModal(false); setShowEditModal(false); setCurrentLoan(null); setSystemMessage(null);
  };

  // --- LOGIN ---
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4 font-sans">
        <div className="bg-white rounded-[2.5rem] p-10 w-full max-sm shadow-2xl text-center border-t-8 border-blue-600">
          <div className="bg-slate-100 w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm"><Lock className="w-8 h-8 text-blue-600" /></div>
          <h1 className="text-2xl font-black text-slate-800 mb-1">PrestaFácil CRM</h1>
          <p className="text-slate-400 font-bold mb-8 uppercase text-[9px] tracking-widest">Acceso Privado</p>
          <form onSubmit={handleLogin} className="space-y-5">
            <input 
              type="password" 
              placeholder="Introduce PIN" 
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              className="w-full border-2 border-slate-50 p-5 rounded-2xl text-center text-3xl font-black tracking-[0.4em] outline-none focus:border-blue-600 bg-slate-50 shadow-inner"
              autoFocus
            />
            <button type="submit" className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl hover:bg-blue-700 transition-all">Ingresar</button>
          </form>
          {systemMessage && <p className="mt-4 text-red-500 font-bold text-xs">{systemMessage}</p>}
        </div>
      </div>
    );
  }

  // --- DASHBOARD ---
  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans text-slate-800 pb-20 relative text-sm">
      <style>{`@media print { body * { visibility: hidden; } #receipt-printable-area, #receipt-printable-area * { visibility: visible; } #receipt-printable-area { position: absolute; left: 0; top: 0; width: 100%; } }`}</style>
      
      <nav className="bg-white border-b px-6 py-4 flex justify-between items-center sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-2"><div className="bg-slate-900 p-2 rounded-lg"><PiggyBank className="w-5 h-5 text-white" /></div><span className="text-xl font-bold tracking-tight text-slate-900">PrestaFácil CRM</span></div>
        <div className="flex gap-2">
            <button onClick={handleExportBackup} title="Bajar Backup" className="bg-white border p-2 rounded-full hover:bg-slate-50 text-slate-600 shadow-sm transition-all"><Download className="w-4 h-4" /></button>
            <button onClick={() => setShowMigrationModal(true)} className="bg-slate-900 text-white px-5 py-2 rounded-full font-bold text-xs flex items-center gap-2 hover:bg-black transition-all shadow-md"><Upload className="w-4 h-4" /> Restaurar</button>
        </div>
      </nav>

      {systemMessage && (
        <div className="fixed top-6 right-6 z-[200] bg-slate-900 text-white p-5 rounded-2xl shadow-2xl animate-in slide-in-from-top-4 flex items-center gap-4 border border-slate-700">
          <AlertCircle className="w-6 h-6 text-blue-400" />
          <p className="font-bold pr-4">{systemMessage}</p>
          <button onClick={() => setSystemMessage(null)} className="p-1 hover:bg-slate-800 rounded-full"><X className="w-4 h-4" /></button>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-slate-900 rounded-[2.5rem] p-8 relative overflow-hidden shadow-2xl border-2 border-slate-800">
            <div className="flex justify-between items-start relative z-10">
              <p className="text-slate-400 uppercase tracking-widest text-[10px] font-black">Caja Disponible</p>
              <button onClick={() => setShowCashModal(true)} className="bg-slate-800 text-[10px] px-4 py-2 rounded-xl text-white hover:bg-slate-700 font-bold">AJUSTAR</button>
            </div>
            <h2 className="text-5xl font-black mt-3 relative z-10 text-white tracking-tighter">{formatMoney(cajaDisponible)}</h2>
            <Wallet className="absolute -right-6 -bottom-6 w-36 h-36 text-white opacity-5" />
          </div>
          <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 flex justify-between items-center shadow-sm">
            <div><p className="text-slate-400 text-[10px] font-black uppercase tracking-wider mb-1.5">Capital en Calle</p><h2 className="text-3xl font-black text-slate-800 tracking-tight">{formatMoney(capitalEnCalle)}</h2></div>
            <div className="bg-blue-50 p-5 rounded-[2rem] text-blue-600 shadow-inner"><TrendingUp className="w-8 h-8" /></div>
          </div>
          <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 flex justify-between items-center shadow-sm">
            <div><p className="text-slate-400 text-[10px] font-black uppercase tracking-wider mb-1.5">Activos</p><h2 className="text-3xl font-black text-emerald-600 tracking-tight">{loans.filter(l=>l.status==='ACTIVO').length}</h2></div>
            <div className="bg-emerald-50 p-5 rounded-[2rem] text-emerald-600 shadow-inner"><User className="w-8 h-8" /></div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
          <div className="bg-white p-1.5 rounded-[1.5rem] border border-slate-100 flex shadow-sm">
            <button onClick={() => setActiveTab('activos')} className={`px-10 py-3.5 rounded-2xl font-black text-[10px] uppercase transition-all ${activeTab === 'activos' ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}>Activos</button>
            <button onClick={() => setActiveTab('historial')} className={`px-10 py-3.5 rounded-2xl font-black text-[10px] uppercase transition-all ${activeTab === 'historial' ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}>Finalizados</button>
          </div>
          <button onClick={() => setShowNewLoanModal(true)} className="w-full sm:w-auto bg-blue-600 text-white px-12 py-4.5 rounded-[2rem] font-black uppercase text-[11px] tracking-[0.2em] shadow-2xl hover:bg-blue-700 transition-all flex items-center justify-center gap-2 hover:scale-[1.03] active:scale-95"><Plus className="w-5 h-5" /> Nuevo Préstamo</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {loans.filter(l => activeTab === 'activos' ? l.status === 'ACTIVO' : (l.status === 'PAGADO' || l.status === 'RENOVADO')).length === 0 ? (
            <div className="col-span-full py-40 text-center border-2 border-dashed rounded-[4rem] text-slate-300 flex flex-col items-center justify-center bg-white/50 shadow-inner">
                <FileJson className="w-20 h-20 mb-6 text-slate-100" />
                <p className="font-black uppercase text-[12px] tracking-[0.3em] text-slate-400">Sin datos registrados</p>
            </div>
          ) : (
            loans.filter(l => activeTab === 'activos' ? l.status === 'ACTIVO' : (l.status === 'PAGADO' || l.status === 'RENOVADO')).map((l) => (
              <div key={l.id} className="bg-white rounded-[3rem] border border-slate-100 p-8 shadow-sm hover:shadow-2xl transition-all relative group overflow-hidden">
                <div className="flex justify-between items-start mb-6">
                  <div className="max-w-[75%]">
                    <h3 className="font-black text-2xl text-slate-900 leading-tight mb-1.5 truncate">{l.client}</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase flex items-center"><Calendar className="w-3.5 h-3.5 mr-2 text-blue-500" /> {l.date}</p>
                  </div>
                  <span className={`text-[9px] font-black px-4 py-2 rounded-full border uppercase tracking-widest shadow-sm ${l.status === 'ACTIVO' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>{l.status}</span>
                </div>
                
                <div className="mb-8 bg-slate-50 p-6 rounded-[2rem] border border-slate-100 shadow-inner">
                  <div className="flex justify-between text-[11px] font-black uppercase mb-3 text-slate-500"><span>Pagado</span><span>{l.progress || 0}%</span></div>
                  <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden shadow-sm"><div className={`h-full transition-all duration-1000 ${l.status === 'ACTIVO' ? 'bg-blue-600' : 'bg-emerald-500'}`} style={{ width: `${l.progress || 0}%` }}></div></div>
                </div>

                <div className="flex justify-between mb-8 px-2">
                  <div><p className="text-slate-400 text-[11px] font-black uppercase tracking-widest mb-1.5">Total</p><p className="font-black text-slate-700 text-lg">{formatMoney(l.debt)}</p></div>
                  <div className="text-right"><p className="text-slate-400 text-[11px] font-black uppercase tracking-widest mb-1.5">Saldo</p><p className={`font-black text-2xl ${l.status === 'ACTIVO' ? 'text-blue-600' : 'text-slate-400'}`}>{formatMoney(l.remaining)}</p></div>
                </div>

                <div className="flex gap-3 relative">
                  {l.status === 'ACTIVO' ? (
                    <button onClick={() => { setCurrentLoan(l); setPaymentAmount(''); setShowPaymentModal(true); setActiveDropdown(null); }} className="flex-1 bg-slate-900 text-white py-4.5 rounded-[1.5rem] font-black text-[11px] uppercase tracking-widest hover:bg-black transition-all shadow-xl">Abonar</button>
                  ) : (
                    <div className="flex-1 bg-slate-50 text-slate-400 py-4.5 rounded-[1.5rem] font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 border border-slate-100">Finalizado</div>
                  )}
                  <button onClick={() => setActiveDropdown(activeDropdown === l.id ? null : l.id)} className="p-4.5 border border-slate-100 rounded-[1.5rem] text-slate-400 hover:bg-slate-50 transition-all shadow-sm active:scale-90"><MoreVertical className="w-6 h-6" /></button>
                  
                  {activeDropdown === l.id && (
                    <div className="absolute right-0 bottom-full mb-4 bg-white border border-slate-100 shadow-2xl rounded-[2rem] py-3 z-[150] w-64 font-bold overflow-hidden animate-in fade-in slide-in-from-bottom-4">
                      <button onClick={() => { setCurrentLoan(l); setShowScheduleModal(true); setActiveDropdown(null); }} className="w-full text-left px-7 py-4.5 hover:bg-slate-50 text-slate-700 flex items-center gap-4 text-xs font-black uppercase border-b border-slate-50"><ListChecks className="w-5 h-5 text-blue-500" /> Plan Sugerido</button>
                      <button onClick={() => { setCurrentLoan(l); setEditForm({client: l.client, phone: l.phone, debt: l.debt, remaining: l.remaining, status: l.status}); setShowEditModal(true); setActiveDropdown(null); }} className="w-full text-left px-7 py-4.5 hover:bg-slate-50 text-slate-700 flex items-center gap-4 text-xs font-black uppercase border-b border-slate-50"><Edit className="w-5 h-5 text-amber-500" /> Editar Registro</button>
                      <button onClick={async () => { if(window.confirm("¿Seguro que desea eliminar?")) await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'loans', l.id)); setActiveDropdown(null); }} className="w-full text-left px-7 py-4.5 hover:bg-red-50 text-red-600 flex items-center gap-4 text-xs font-black uppercase transition-colors"><Trash2 className="w-5 h-5" /> Eliminar</button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {/* MODAL PLAN DE PAGOS */}
      {showScheduleModal && currentLoan && (
        <div className="fixed inset-0 bg-slate-900/80 z-[200] flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white rounded-[4rem] w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-slate-900 p-12 text-white flex justify-between items-center border-b border-slate-800">
              <div><h2 className="text-3xl font-black uppercase tracking-widest mb-1">Calendario</h2><p className="text-slate-400 font-bold">{currentLoan.client}</p></div>
              <button onClick={closeAllModals} className="p-3 hover:bg-slate-800 rounded-full transition-colors"><X className="w-8 h-8" /></button>
            </div>
            <div className="p-12 overflow-y-auto bg-[#f8fafc]" id="receipt-printable-area">
              <div className="space-y-4">
                {calculateSchedule(currentLoan).map((inst) => (
                  <div key={inst.num} className="bg-white p-7 rounded-[2rem] border border-slate-100 flex justify-between items-center shadow-sm">
                    <div className="flex items-center gap-6">
                      <div className="w-14 h-14 bg-slate-900 text-white rounded-3xl flex items-center justify-center font-black text-xl shadow-lg">{inst.num}</div>
                      <div><p className="font-black text-slate-400 uppercase text-[10px] tracking-[0.2em] mb-1">Fecha Sugerida</p><p className="font-black text-slate-800 text-xl">{inst.date}</p></div>
                    </div>
                    <div className="text-right"><p className="font-black text-slate-400 uppercase text-[10px] mb-1">Monto Cuota</p><p className="font-black text-slate-900 text-2xl">{formatMoney(inst.amount)}</p></div>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-10 bg-white border-t flex gap-5">
              <button onClick={handleWhatsAppSchedule} className="flex-1 bg-[#25D366] text-white py-6 rounded-[2rem] font-black uppercase text-[12px] tracking-[0.2em] flex justify-center items-center gap-4 shadow-2xl hover:bg-[#128c7e] transition-all"><MessageCircle className="w-6 h-6" /> Enviar por WhatsApp</button>
              <button onClick={() => window.print()} className="flex-1 bg-slate-100 py-6 rounded-[2rem] font-black uppercase text-[12px] tracking-[0.2em] flex items-center justify-center gap-4 text-slate-600 hover:bg-slate-200 transition-all"><Printer className="w-6 h-6" /> Imprimir Plan</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDICIÓN */}
      {showEditModal && currentLoan && (
        <div className="fixed inset-0 bg-slate-900/60 z-[200] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[3.5rem] w-full max-w-xl shadow-2xl p-12">
            <h2 className="text-2xl font-black mb-10 border-b pb-6 flex justify-between items-center text-amber-600 uppercase tracking-widest text-[12px]"><span className="flex items-center gap-4"><Edit className="w-6 h-6"/> Editar Información Real</span><button onClick={closeAllModals}><X className="w-7 h-7" /></button></h2>
            <form onSubmit={handleSaveEdit} className="space-y-7">
              <div><label className="block font-black text-[11px] uppercase text-slate-400 mb-3 ml-2 tracking-widest">Nombre del Cliente</label><input type="text" required value={editForm.client} onChange={(e)=>setEditForm({...editForm, client: e.target.value})} className="w-full border-2 p-6 rounded-[1.75rem] font-bold bg-slate-50 outline-none focus:border-amber-400 transition-all shadow-inner"/></div>
              <div><label className="block font-black text-[11px] uppercase text-slate-400 mb-3 ml-2 tracking-widest">Número Telefónico</label><input type="text" required value={editForm.phone} onChange={(e)=>setEditForm({...editForm, phone: e.target.value})} className="w-full border-2 p-6 rounded-[1.75rem] font-bold bg-slate-50 outline-none focus:border-amber-400 shadow-inner"/></div>
              <div className="grid grid-cols-2 gap-8">
                <div><label className="block font-black text-[11px] uppercase text-slate-400 mb-3 ml-2 tracking-widest">Deuda Inicial ($)</label><input type="number" required value={editForm.debt} onChange={(e)=>setEditForm({...editForm, debt: e.target.value})} className="w-full border-2 p-6 rounded-[1.75rem] font-black bg-slate-50 shadow-inner"/></div>
                <div><label className="block font-black text-[11px] uppercase text-slate-400 mb-3 ml-2 tracking-widest">Resta Actual ($)</label><input type="number" required value={editForm.remaining} onChange={(e)=>setEditForm({...editForm, remaining: e.target.value})} className="w-full border-2 p-6 rounded-[1.75rem] font-black bg-slate-50 text-red-600 shadow-inner"/></div>
              </div>
              <button type="submit" className="w-full bg-slate-900 text-white py-7 rounded-[2rem] font-black uppercase text-[12px] tracking-[0.3em] shadow-2xl flex items-center justify-center gap-4 mt-6 hover:bg-black transition-all active:scale-95"><Save className="w-6 h-6" /> Guardar Cambios Manuales</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL RESTAURACIÓN */}
      {showMigrationModal && (
        <div className="fixed inset-0 bg-slate-900/80 z-[200] flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white rounded-[3.5rem] w-full max-w-2xl shadow-2xl p-12">
            <div className="flex justify-between items-center mb-10"><h2 className="text-2xl font-black uppercase tracking-widest text-slate-800">Restauración de Sistema</h2><button onClick={closeAllModals}><X className="w-7 h-7" /></button></div>
            <textarea value={migrationText} onChange={(e) => setMigrationText(e.target.value)} className="w-full h-80 border-2 p-8 rounded-[2.5rem] bg-[#f8fafc] font-mono text-[10px] mb-10 outline-none focus:border-blue-500 shadow-inner" placeholder='Pegue aquí el contenido JSON...'></textarea>
            <div className="grid grid-cols-2 gap-6">
                <button onClick={() => handleMigrateData(true)} className="bg-red-50 text-red-600 border border-red-100 py-6 rounded-[2rem] font-black uppercase text-[11px] hover:bg-red-100 transition-all flex items-center justify-center gap-3"><Trash className="w-4 h-4" /> Borrar e Importar</button>
                <button onClick={() => handleMigrateData(false)} className="bg-slate-900 text-white py-6 rounded-[2rem] font-black uppercase text-[11px] hover:bg-black transition-all flex items-center justify-center gap-3"><Cloud className="w-4 h-4" /> Solo Importar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NUEVO PRÉSTAMO */}
      {showNewLoanModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-[200] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[3.5rem] w-full max-w-xl shadow-2xl p-12 max-h-[90vh] overflow-y-auto border border-slate-100">
            <h2 className="text-2xl font-black mb-12 border-b pb-8 flex justify-between items-center uppercase tracking-widest text-[12px] text-slate-800">Nuevo Desembolso <button onClick={closeAllModals} className="hover:rotate-90 transition-all"><X className="w-8 h-8 text-slate-300" /></button></h2>
            <datalist id="clientsList">{uniqueClients.map((c, i) => <option key={i} value={c?.client} />)}</datalist>
            <form onSubmit={handleSaveNewLoan} className="space-y-8">
              <div><label className="block font-black text-[11px] uppercase text-slate-400 mb-3 ml-2 tracking-widest">Nombre Completo</label><input list="clientsList" required value={newLoanForm.client} onChange={handleClientNameChange} className="w-full border-2 p-6 rounded-[1.75rem] outline-none font-bold bg-[#f8fafc] focus:border-blue-500 shadow-inner" placeholder="Escriba o seleccione..."/></div>
              <div><label className="block font-black text-[11px] uppercase text-slate-400 mb-3 ml-2 tracking-widest">Teléfono</label><input type="text" required value={newLoanForm.phone} onChange={(e) => setNewLoanForm({...newLoanForm, phone: e.target.value})} className="w-full border-2 p-6 rounded-[1.75rem] outline-none font-bold bg-[#f8fafc] shadow-inner" placeholder="Ej. 8090000000"/></div>
              <div><label className="block font-black text-[11px] uppercase text-slate-400 mb-3 ml-2 tracking-widest">Capital ($)</label><input type="number" required value={newLoanForm.capital} onChange={(e) => setNewLoanForm({...newLoanForm, capital: e.target.value})} className="w-full border-2 p-6 rounded-[1.75rem] font-black text-4xl bg-[#f8fafc] text-slate-900 shadow-inner"/></div>
              <div className="grid grid-cols-2 gap-8">
                <div><label className="block font-black text-[11px] uppercase text-slate-400 mb-3 ml-2 tracking-widest">Cant. Cuotas</label><input type="number" required value={newLoanForm.installments} onChange={(e) => setNewLoanForm({...newLoanForm, installments: e.target.value})} className="w-full border-2 p-6 rounded-[1.75rem] font-black bg-[#f8fafc] shadow-inner text-center text-xl"/></div>
                <div><label className="block font-black text-[11px] uppercase text-slate-400 mb-3 ml-2 tracking-widest">Frecuencia</label><select value={newLoanForm.freqDays} onChange={(e) => setNewLoanForm({...newLoanForm, freqDays: e.target.value})} className="w-full border-2 p-6 rounded-[1.75rem] font-bold bg-[#f8fafc] shadow-inner text-center outline-none text-lg cursor-pointer"><option value="1">Diario</option><option value="7">Semanal</option><option value="15">Quincenal</option><option value="30">Mensual</option></select></div>
              </div>
              <div className="bg-slate-100 p-10 rounded-[3rem] border border-slate-200">
                <div className="flex gap-12 mb-7 justify-center font-black text-[11px] uppercase tracking-[0.2em]">
                  <label className="flex items-center gap-4 cursor-pointer"><input type="radio" className="w-5 h-5" checked={newLoanForm.calcMethod === 'interes'} onChange={() => setNewLoanForm({...newLoanForm, calcMethod: 'interes'})} /> % Interés</label>
                  <label className="flex items-center gap-4 cursor-pointer"><input type="radio" className="w-5 h-5" checked={newLoanForm.calcMethod === 'fija'} onChange={() => setNewLoanForm({...newLoanForm, calcMethod: 'fija'})} /> $ Cuota Fija</label>
                </div>
                {newLoanForm.calcMethod === 'interes' ? (
                  <input type="number" placeholder="Ej. 13 (%)" required value={newLoanForm.interestRate} onChange={(e) => setNewLoanForm({...newLoanForm, interestRate: e.target.value})} className="w-full border-2 p-6 rounded-[1.75rem] font-black text-center shadow-sm text-2xl"/>
                ) : (
                  <input type="number" placeholder="Monto fijo cada cuota ($)" required value={newLoanForm.fixedQuota} onChange={(e) => setNewLoanForm({...newLoanForm, fixedQuota: e.target.value})} className="w-full border-2 p-6 rounded-[1.75rem] font-black text-center shadow-sm text-2xl"/>
                )}
              </div>
              <button type="submit" className="w-full bg-blue-600 text-white py-7 rounded-[2.5rem] font-black uppercase text-[12px] tracking-[0.3em] shadow-2xl hover:bg-blue-700 hover:translate-y-[-4px] active:scale-95 transition-all">Autorizar Préstamo</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PAGO Y RECIBO */}
      {showPaymentModal && currentLoan && (
        <div className="fixed inset-0 bg-slate-900/60 z-[200] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[4rem] w-full max-w-md p-12 shadow-2xl text-center text-slate-900 border border-slate-100">
            <h3 className="font-black uppercase text-[12px] text-slate-400 tracking-[0.5em] mb-12">Registrar Cobro</h3>
            <p className="font-black text-4xl mb-3 tracking-tight">{currentLoan.client}</p>
            <div className="bg-slate-50 p-10 rounded-[2.5rem] mb-12 border border-slate-100 shadow-inner"><p className="text-6xl font-black text-slate-900 tracking-tighter">{formatMoney(currentLoan.remaining)}</p><p className="text-[11px] font-black uppercase text-slate-400 mt-4 tracking-[0.2em]">Deuda Pendiente</p></div>
            <input type="number" step="any" required value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} className="w-full border-2 p-10 rounded-[3rem] text-7xl font-black text-center outline-none border-blue-100 focus:border-blue-500 mb-12 bg-blue-50/20 text-blue-600 shadow-inner" placeholder="0.00"/>
            <button onClick={handleProcessPayment} className="w-full bg-blue-600 text-white py-8 rounded-[2.5rem] font-black uppercase text-[12px] tracking-[0.3em] shadow-2xl shadow-blue-200 hover:bg-blue-700 hover:translate-y-[-2px] transition-all active:scale-95">Confirmar Abono</button>
            <button onClick={closeAllModals} className="mt-8 text-slate-400 font-black text-[12px] uppercase tracking-[0.4em] w-full py-3 hover:text-slate-600 transition-colors">Cancelar</button>
          </div>
        </div>
      )}

      {showReceiptModal && (
        <div className="fixed inset-0 bg-slate-900/80 z-[250] flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white rounded-[4.5rem] w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="p-16 text-center" id="receipt-printable-area">
              <div className="bg-slate-900 w-24 h-24 rounded-[2.5rem] flex items-center justify-center mx-auto mb-12 shadow-2xl"><PiggyBank className="w-12 h-12 text-white" /></div>
              <h2 className="text-3xl font-black mb-12 border-b-4 border-double pb-10 text-slate-900 tracking-tighter uppercase font-mono">PrestaFácil</h2>
              <p className="uppercase text-[11px] font-black tracking-[0.6em] text-slate-400 mb-4">Recibo de Ingreso</p>
              <h3 className="text-8xl font-black text-emerald-600 my-12 tracking-tighter">{formatMoney(paymentAmount)}</h3>
              <div className="space-y-2">
                <p className="font-black text-slate-900 text-3xl tracking-tight">{currentLoan?.client}</p>
                <p className="text-slate-400 text-[11px] font-black uppercase mt-3 tracking-[0.3em]">{new Date().toLocaleString()}</p>
              </div>
              <div className="bg-[#f8fafc] p-8 rounded-[3rem] mt-16 border border-slate-100 flex justify-between items-center shadow-inner"><span className="text-[12px] font-black uppercase text-slate-400 tracking-widest">Resta</span><span className="font-black text-slate-800 text-2xl">{formatMoney(currentLoan?.remaining)}</span></div>
            </div>
            <div className="p-12 bg-[#f8fafc] space-y-5 border-t border-slate-100">
              <button onClick={handleWhatsAppShare} className="w-full bg-[#25D366] text-white py-7 rounded-[2.5rem] font-black uppercase text-[12px] tracking-[0.3em] flex justify-center items-center gap-5 shadow-xl shadow-emerald-100 hover:bg-[#128c7e] transition-all"><MessageCircle className="w-7 h-7" /> Enviar por WhatsApp</button>
              <button onClick={() => window.print()} className="w-full bg-white border-2 border-slate-200 text-slate-600 py-5 rounded-[2.5rem] font-black uppercase text-[12px] flex items-center justify-center gap-4 hover:bg-slate-50 transition-all"><Printer className="w-6 h-6" /> PDF / Impresora</button>
              <button onClick={closeAllModals} className="w-full bg-slate-900 text-white py-6 rounded-[2.5rem] font-black uppercase text-[12px] mt-4">Finalizar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL GESTIÓN DE CAJA */}
      {showCashModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-[200] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[3.5rem] w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="bg-slate-900 px-14 py-12 flex justify-between text-white font-black uppercase tracking-[0.5em] text-[12px] items-center"><h3>Gestión de Capital Real</h3><button onClick={closeAllModals} className="hover:rotate-90 transition-all p-2"><X className="w-8 h-8 text-slate-400" /></button></div>
            <div className="p-12 bg-[#f8fafc] flex-1 overflow-y-auto">
              <form onSubmit={handleSaveCashTransaction} className="bg-white p-12 rounded-[3rem] border border-slate-100 mb-12 shadow-sm">
                <div className="grid grid-cols-2 gap-10 mb-10 text-slate-900">
                  <div className="col-span-1"><label className="block font-black text-[11px] uppercase text-slate-400 mb-4 ml-2 tracking-widest">Operación</label><select value={cashForm.type} onChange={(e) => setCashForm({...cashForm, type: e.target.value})} className="w-full border-2 p-6 rounded-[1.75rem] font-bold bg-[#f8fafc] outline-none focus:border-blue-400 transition-all cursor-pointer"><option value="INYECCION">Inyección de Fondos (+)</option><option value="RETIRO">Retiro Personal (-)</option></select></div>
                  <div className="col-span-1"><label className="block font-black text-[11px] uppercase text-slate-400 mb-4 ml-2 tracking-widest">Monto ($)</label><input type="number" step="any" placeholder="0.00" required value={cashForm.amount} onChange={(e) => setCashForm({...cashForm, amount: e.target.value})} className="w-full border-2 p-6 rounded-[1.75rem] font-black text-3xl bg-[#f8fafc] outline-none focus:border-blue-400 transition-all shadow-inner"/></div>
                  <div className="col-span-2"><label className="block font-black text-[11px] uppercase text-slate-400 mb-4 ml-2 tracking-widest">Motivo / Concepto</label><input type="text" placeholder="Ej. Saldo inicial real" required value={cashForm.concept} onChange={(e) => setCashForm({...cashForm, concept: e.target.value})} className="w-full border-2 p-6 rounded-[1.75rem] font-bold bg-[#f8fafc] shadow-inner"/></div>
                </div>
                <button type="submit" className="w-full py-7 rounded-[2.5rem] text-white font-black uppercase text-[12px] bg-slate-900 hover:bg-black transition-all">Aplicar Ajuste en Caja</button>
              </form>
              <div className="bg-white rounded-[3rem] border border-slate-100 overflow-hidden shadow-sm">
                <div className="p-10 bg-slate-50 border-b font-black text-[12px] uppercase text-slate-500 tracking-[0.3em]">Registro de Caja</div>
                <div className="divide-y divide-slate-100">
                  {(transactions || []).map(t => (
                    <div key={t.id} className="p-10 flex justify-between items-center hover:bg-slate-50 transition-colors group">
                      <div className="flex items-center gap-8">
                        <div className={`p-5 rounded-[2rem] transition-all shadow-sm ${t.type === 'RETIRO' ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-500'}`}>{t.type === 'RETIRO' ? <ArrowUpRight className="w-7 h-7" /> : <ArrowDownRight className="w-7 h-7" />}</div>
                        <div><p className="font-black text-slate-900 text-lg mb-1">{t.concept || 'Movimiento'}</p><p className="text-[11px] font-black uppercase text-slate-400 tracking-widest">{t.date ? new Date(t.date).toLocaleString() : '---'}</p></div>
                      </div>
                      <p className={`font-black text-2xl tracking-tighter ${t.type === 'RETIRO' ? 'text-red-500' : 'text-emerald-500'}`}>{t.type === 'RETIRO' ? '-' : '+'}{formatMoney(t.amount)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}