import React, { useState, useEffect } from 'react';
import { 
  Wallet, TrendingUp, PiggyBank, Search, Plus, MoreVertical, 
  CheckCircle2, Calendar, User, FileText, Printer, X, 
  MessageCircle, Edit, Trash2, AlertCircle, RefreshCw, 
  History, ArrowDownRight, ArrowUpRight, Cloud, Download, Upload, ListChecks, Save, FileJson, Trash, Lock,
  Phone, Home, Briefcase, Check
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

const appId = 'prestafacil-produccion-final-v1';
const PIN_ACCESO = "1234"; 

export default function App() {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [loans, setLoans] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [activeTab, setActiveTab] = useState('activos');
  const [authError, setAuthError] = useState(null);
  const [systemMessage, setSystemMessage] = useState(null);
  
  // Modales
  const [currentLoan, setCurrentLoan] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showNewLoanModal, setShowNewLoanModal] = useState(false);
  const [showCashModal, setShowCashModal] = useState(false);
  const [showMigrationModal, setShowMigrationModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showContractModal, setShowContractModal] = useState(false);
  const [showRenewModal, setShowRenewModal] = useState(false);
  
  // Formularios
  const [migrationText, setMigrationText] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [newLoanForm, setNewLoanForm] = useState({
    client: '', phone: '', idNumber: '', address: '', workplace: '', calcMethod: 'interes', capital: '', interestRate: '', fixedQuota: '', installments: '', freqDays: 15
  });
  const [editForm, setEditForm] = useState({ client: '', phone: '', idNumber: '', address: '', workplace: '', debt: '', remaining: '', status: '' });
  const [renewForm, setRenewForm] = useState({ capital: '', calcMethod: 'interes', interestRate: '', fixedQuota: '', installments: '' });
  const [cashForm, setCashForm] = useState({ type: 'INYECCION', amount: '', concept: '' });

  useEffect(() => {
    const initAuth = async () => {
      try { await signInAnonymously(auth); } 
      catch (error) { setAuthError("Error de conexión con Firebase."); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => { if (u) setUser(u); });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !isAuthenticated) return;
    const unsubLoans = onSnapshot(collection(db, 'artifacts', appId, 'users', user.uid, 'loans'), (s) => {
      setLoans(s.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => setAuthError("Error leyendo préstamos."));

    const unsubTrans = onSnapshot(collection(db, 'artifacts', appId, 'users', user.uid, 'transactions'), (s) => {
      const t = s.docs.map(d => ({ id: d.id, ...d.data() }));
      t.sort((a, b) => new Date(b.date) - new Date(a.date));
      setTransactions(t);
    });

    return () => { unsubLoans(); unsubTrans(); };
  }, [user, isAuthenticated]);

  const handleLogin = (e) => {
    e.preventDefault();
    if (pinInput === PIN_ACCESO) { setIsAuthenticated(true); } 
    else { setSystemMessage("❌ PIN incorrecto"); setPinInput(''); }
  };

  // Cálculos Globales
  const cajaDisponible = transactions.reduce((t, tr) => tr.type === 'RETIRO' ? t - tr.amount : t + tr.amount, 0);
  const capitalEnCalle = loans.reduce((t, l) => l.status === 'ACTIVO' ? t + l.remaining : t, 0);
  const gananciaProyectada = loans.reduce((t, l) => t + (Number(l.debt || 0) - Number(l.principal || (l.debt/1.2) || 0)), 0);
  const totalRecaudado = transactions.reduce((t, tr) => tr.concept?.toLowerCase().includes('pago') || tr.concept?.toLowerCase().includes('abono') || tr.concept?.toLowerCase().includes('cobro') ? t + Number(tr.amount || 0) : t, 0);
  
  const uniqueClients = Array.from(new Set(loans.map(l => l.client))).map(name => loans.find(l => l.client === name));

  const formatMoney = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);

  const handleClientNameChange = (e) => {
    const name = e.target.value;
    const existingClient = uniqueClients.find(c => c.client === name);
    setNewLoanForm({ 
      ...newLoanForm, 
      client: name, 
      phone: existingClient ? existingClient.phone : newLoanForm.phone,
      idNumber: existingClient ? (existingClient.idNumber || '') : newLoanForm.idNumber,
      address: existingClient ? (existingClient.address || '') : newLoanForm.address,
      workplace: existingClient ? (existingClient.workplace || '') : newLoanForm.workplace
    });
  };

  const calculateAdvancedSchedule = (loan) => {
    if (!loan) return [];
    const schedule = [];
    const datePart = loan.date?.includes('/') ? loan.date.split('/').reverse().join('-') : loan.date;
    const startDate = new Date(datePart || new Date());
    const freq = Number(loan.freqDays || 15);
    const totalInst = Number(loan.installments || 1) > 0 ? Number(loan.installments || 1) : 1;
    const quotaAmount = (Number(loan.debt || 0) / totalInst);
    
    let totalPaid = Number(loan.debt || 0) - Number(loan.remaining || 0);
    let currentRemaining = Number(loan.debt || 0);

    for (let i = 1; i <= totalInst; i++) {
      const dueDate = new Date(startDate);
      dueDate.setDate(startDate.getDate() + (freq * i));
      
      let isPaid = false;
      if (totalPaid >= quotaAmount - 0.05) {
        isPaid = true;
        totalPaid -= quotaAmount;
      } else {
        totalPaid = 0;
      }

      currentRemaining -= quotaAmount;

      schedule.push({ 
        num: i, 
        date: isNaN(dueDate.getTime()) ? 'Pendiente' : dueDate.toLocaleDateString('es-DO', {day: '2-digit', month: 'short'}), 
        amount: quotaAmount,
        remaining: Math.max(0, currentRemaining),
        status: isPaid ? 'PAGADO' : 'PENDIENTE'
      });
    }
    return schedule;
  };

  const handleExportBackup = () => {
    const data = { loans, transactions };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `backup_prestafacil_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  const handleMigrateData = async (clearFirst = false) => {
    if (!migrationText.trim()) return;
    try {
      const batch = writeBatch(db);
      if (clearFirst) {
        loans.forEach(l => batch.delete(doc(db, 'artifacts', appId, 'users', user.uid, 'loans', l.id)));
        transactions.forEach(t => batch.delete(doc(db, 'artifacts', appId, 'users', user.uid, 'transactions', t.id)));
        await batch.commit();
      }
      let parsed = JSON.parse(migrationText);
      const dataLoans = Array.isArray(parsed) ? parsed : (parsed.loans || []);
      const dataCash = parsed.capitalHistory || parsed.transactions || [];
      for (const item of dataLoans) {
        const totalDebt = parseFloat(item.totalDebt || item.debt || 0);
        const paid = parseFloat(item.paid || 0);
        await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'loans'), {
          client: item.client || 'Sin nombre', phone: item.phone || '', idNumber: item.idNumber || '', address: item.address || '', workplace: item.workplace || '',
          date: item.startDate || item.date || new Date().toISOString().split('T')[0],
          progress: totalDebt > 0 ? Math.round((paid / totalDebt) * 100) : 0,
          principal: item.principal || (totalDebt / 1.2),
          debt: totalDebt, remaining: totalDebt - paid,
          status: (item.status === 'completed' || paid >= totalDebt) ? 'PAGADO' : 'ACTIVO',
          freqDays: Number(item.freqDays || 15), installments: Number(item.term || item.installments || 1)
        });
      }
      for (const cashItem of dataCash) {
        await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'transactions'), {
          type: (Number(cashItem.amount) >= 0) ? 'INYECCION' : 'RETIRO',
          amount: Math.abs(Number(cashItem.amount || 0)),
          concept: cashItem.note || cashItem.concept || 'Migración',
          date: cashItem.date || new Date().toISOString()
        });
      }
      setShowMigrationModal(false); setMigrationText(''); setSystemMessage("✅ Sincronización Exitosa");
    } catch (e) { setSystemMessage("❌ Error en JSON"); }
  };

  const handleSaveNewLoan = async (e) => {
    e.preventDefault();
    const cap = parseFloat(newLoanForm.capital);
    const inst = parseInt(newLoanForm.installments);
    let total = 0;

    if (newLoanForm.calcMethod === 'fija') {
      total = parseFloat(newLoanForm.fixedQuota) * inst;
    } else {
      total = cap + (cap * (parseFloat(newLoanForm.interestRate) / 100));
    }

    if (cap > cajaDisponible) return alert("No hay fondos suficientes en caja para prestar esta cantidad.");

    try {
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'loans'), { 
        client: newLoanForm.client, phone: newLoanForm.phone, idNumber: newLoanForm.idNumber, address: newLoanForm.address, workplace: newLoanForm.workplace,
        date: new Date().toLocaleDateString('es-DO'), 
        progress: 0, debt: total, remaining: total, principal: cap, status: 'ACTIVO', freqDays: parseInt(newLoanForm.freqDays), installments: inst
      });
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'transactions'), { 
        type: 'RETIRO', amount: cap, concept: `Desembolso Préstamo - ${newLoanForm.client}`, date: new Date().toISOString() 
      });
      setShowNewLoanModal(false);
      setNewLoanForm({ client: '', phone: '', idNumber: '', address: '', workplace: '', calcMethod: 'interes', capital: '', interestRate: '', fixedQuota: '', installments: '', freqDays: 15 });
    } catch (e) { setAuthError("Error al crear préstamo."); }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!window.confirm("⚠️ ¿Desea modificar los valores de este registro?")) return;
    try {
      const d = Number(editForm.debt);
      const r = Number(editForm.remaining);
      await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'loans', currentLoan.id), {
        ...editForm, debt: d, remaining: r, progress: Math.round(((d - r) / d) * 100) || 0
      });
      setShowEditModal(false);
      setSystemMessage("✅ Registro actualizado.");
    } catch (e) { setAuthError("Error al editar."); }
  };

  const handleProcessRenewal = async (e) => {
    e.preventDefault();
    if (!user || !currentLoan) return;

    const newCap = parseFloat(renewForm.capital);
    const inst = parseInt(renewForm.installments);
    const netoAEntregar = newCap - currentLoan.remaining;

    if (netoAEntregar < 0) return alert("El nuevo capital debe ser mayor a la deuda actual pendiente.");
    if (netoAEntregar > cajaDisponible) return alert(`Fondos insuficientes. Necesitas ${formatMoney(netoAEntregar)} en caja.`);

    let newTotalDebt = 0;
    if (renewForm.calcMethod === 'fija') {
      newTotalDebt = parseFloat(renewForm.fixedQuota) * inst;
    } else {
      newTotalDebt = newCap + (newCap * (parseFloat(renewForm.interestRate) / 100));
    }

    try {
      await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'loans', currentLoan.id), { 
        status: 'RENOVADO', remaining: 0, progress: 100 
      });
      
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'loans'), { 
        client: currentLoan.client, phone: currentLoan.phone, idNumber: currentLoan.idNumber, address: currentLoan.address, workplace: currentLoan.workplace,
        date: new Date().toLocaleDateString('es-DO'), 
        progress: 0, debt: newTotalDebt, remaining: newTotalDebt, principal: newCap, status: 'ACTIVO', freqDays: currentLoan.freqDays || 15, installments: inst
      });

      if (netoAEntregar > 0) {
        await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'transactions'), { 
          type: 'RETIRO', amount: netoAEntregar, concept: `Renovación (Neto Entregado) - ${currentLoan.client}`, date: new Date().toISOString() 
        });
      }

      setShowRenewModal(false);
      alert("Préstamo renovado exitosamente.");
    } catch (e) { setAuthError("Error al renovar préstamo."); }
  };

  const handleProcessPayment = async (e) => {
    e.preventDefault();
    if (!user || !currentLoan) return;
    const monto = parseFloat(paymentAmount) || 0;
    const resta = Math.max(0, currentLoan.remaining - monto);
    
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'loans', currentLoan.id), { 
        remaining: resta, progress: Math.round(((currentLoan.debt - resta) / currentLoan.debt) * 100), status: resta === 0 ? 'PAGADO' : 'ACTIVO' 
      });
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'transactions'), { 
        type: 'INYECCION', amount: monto, concept: `Abono Cuota - ${currentLoan.client}`, date: new Date().toISOString() 
      });
      setShowPaymentModal(false); 
      setShowReceiptModal(true);
    } catch (e) { setAuthError("Error al registrar pago."); }
  };

  const handleSaveCashTransaction = async (e) => {
    e.preventDefault();
    const monto = parseFloat(cashForm.amount);
    if (cashForm.type === 'RETIRO' && monto > cajaDisponible) return alert("No hay fondos suficientes.");
    try {
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'transactions'), { ...cashForm, amount: monto, date: new Date().toISOString() });
      setCashForm({ type: 'INYECCION', amount: '', concept: '' });
    } catch (e) { setAuthError("Error en caja."); }
  };

  const handleWhatsAppShare = () => {
    const text = `🧾 *RECIBO DE PAGO - PRESTAFÁCIL*%0A👤 *Cliente:* ${currentLoan.client}%0A💵 *Monto Pagado:* ${formatMoney(paymentAmount)}%0A📉 *Saldo Pendiente:* ${formatMoney(currentLoan.remaining)}%0A📅 *Fecha:* ${new Date().toLocaleDateString()}%0A✅ _¡Gracias por su cumplimiento!_`;
    window.open(`https://wa.me/1${currentLoan.phone?.replace(/\D/g, '')}?text=${text}`, '_blank');
  };

  const closeAllModals = () => { setShowPaymentModal(false); setShowReceiptModal(false); setShowNewLoanModal(false); setShowCashModal(false); setShowRenewModal(false); setShowScheduleModal(false); setShowEditModal(false); setShowContractModal(false); setCurrentLoan(null); setSystemMessage(null); };

  const activeLoans = loans.filter(l => l.status === 'ACTIVO');
  const pastLoans = loans.filter(l => l.status === 'PAGADO' || l.status === 'RENOVADO');
  const displayLoans = activeTab === 'activos' ? activeLoans : pastLoans;

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 font-sans">
        <div className="bg-white rounded-[3rem] p-12 w-full max-w-md shadow-2xl text-center">
          <div className="bg-slate-100 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-8"><Lock className="w-10 h-10 text-blue-600" /></div>
          <h1 className="text-3xl font-black text-slate-900 mb-2">PrestaFácil</h1>
          <p className="text-slate-400 font-bold mb-8 uppercase text-[10px] tracking-widest">Acceso Privado</p>
          <form onSubmit={handleLogin} className="space-y-6">
            <input type="password" placeholder="PIN" value={pinInput} onChange={(e)=>setPinInput(e.target.value)} className="w-full border-2 p-6 rounded-[1.5rem] text-center text-4xl font-black tracking-[0.5em] outline-none focus:border-blue-500 bg-white text-slate-900 shadow-inner" autoFocus />
            <button type="submit" className="w-full bg-blue-600 text-white py-6 rounded-[1.5rem] font-black uppercase text-[12px] shadow-xl hover:bg-blue-700 transition-all">Ingresar</button>
          </form>
          {systemMessage && <p className="mt-4 text-red-500 font-bold text-xs uppercase">{systemMessage}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-20 relative text-sm">
      <style>{`
        @media print {
          body { background-color: white !important; margin: 0; padding: 0; }
          nav, main, .no-print { display: none !important; }
          .fixed { position: relative !important; inset: auto !important; background: transparent !important; padding: 0 !important; }
          .max-h-\\[90vh\\] { max-height: none !important; }
          .overflow-y-auto { overflow: visible !important; }
          .shadow-2xl { box-shadow: none !important; border: none !important; }
        }
      `}</style>
      
      <nav className="bg-white border-b px-6 py-4 flex justify-between items-center sticky top-0 z-10 shadow-sm no-print">
        <div className="flex items-center gap-2">
          <div className="bg-slate-900 p-2 rounded-lg"><PiggyBank className="w-5 h-5 text-white" /></div>
          <span className="text-xl font-bold">PrestaFácil CRM</span>
        </div>
        <button onClick={() => setShowMigrationModal(true)} className="bg-slate-100 text-slate-600 px-4 py-2 rounded-full font-black text-[10px] uppercase flex items-center gap-2 hover:bg-slate-200 transition-all"><Upload className="w-3.5 h-3.5" /> Restaurar</button>
      </nav>

      {authError && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 mx-4 mt-4 rounded-r-lg flex items-start gap-3 no-print">
          <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
          <div><p className="font-bold text-amber-900">Aviso</p><p className="text-xs text-amber-700">{authError}</p></div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-8 no-print">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8 text-slate-900">
          <div className="bg-slate-900 rounded-2xl p-5 relative overflow-hidden shadow-lg shadow-slate-900/20 border-b-[4px] border-blue-500">
            <div className="flex justify-between items-start relative z-10">
              <p className="text-slate-400 uppercase tracking-widest text-[9px] font-black">Caja Disponible</p>
              <button onClick={() => setShowCashModal(true)} className="bg-slate-800 text-[9px] px-2 py-1 rounded-md flex items-center gap-1.5 text-white hover:bg-slate-700 font-black transition-colors">
                <History className="w-3 h-3" /> GESTIONAR
              </button>
            </div>
            <h2 className="text-3xl font-black mt-2 relative z-10 text-white tracking-tight">{formatMoney(cajaDisponible)}</h2>
            <Wallet className="absolute -right-4 -bottom-4 w-20 h-20 text-slate-800 opacity-50" />
          </div>
          
          <div className="bg-white rounded-2xl p-5 border flex justify-between items-center shadow-sm">
            <div><p className="text-slate-400 text-[9px] font-black uppercase tracking-wider mb-1">Capital en Calle</p><h2 className="text-2xl font-black">{formatMoney(capitalEnCalle)}</h2></div>
            <TrendingUp className="text-blue-100 w-8 h-8" />
          </div>

          <div className="bg-white rounded-2xl p-5 border flex justify-between items-center shadow-sm">
            <div><p className="text-slate-400 text-[9px] font-black uppercase tracking-wider mb-1">Ganancia Proyectada</p><h2 className="text-2xl font-black text-emerald-600">{formatMoney(gananciaProyectada)}</h2></div>
            <ArrowUpRight className="text-emerald-100 w-8 h-8" />
          </div>

          <div className="bg-white rounded-2xl p-5 border flex justify-between items-center shadow-sm">
            <div><p className="text-slate-400 text-[9px] font-black uppercase tracking-wider mb-1">Total Recaudado</p><h2 className="text-2xl font-black text-slate-700">{formatMoney(totalRecaudado)}</h2></div>
            <Wallet className="text-slate-200 w-8 h-8" />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
          <div className="bg-white p-1 rounded-xl border flex shadow-sm">
            <button onClick={() => setActiveTab('activos')} className={`px-6 py-2 rounded-lg font-black text-[10px] uppercase transition-all ${activeTab === 'activos' ? 'bg-slate-100 text-slate-900' : 'text-slate-400'}`}>Activos</button>
            <button onClick={() => setActiveTab('historial')} className={`px-6 py-2 rounded-lg font-black text-[10px] uppercase transition-all ${activeTab === 'historial' ? 'bg-slate-100 text-slate-900' : 'text-slate-400'}`}>Historial</button>
          </div>
          <button onClick={() => setShowNewLoanModal(true)} className="w-full sm:w-auto bg-blue-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 justify-center text-xs shadow-lg shadow-blue-100 hover:bg-blue-700 transition-colors">
            <Plus className="w-4 h-4" /> NUEVO PRÉSTAMO
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {displayLoans.length === 0 ? (
            <div className="col-span-full py-20 text-center border-2 border-dashed rounded-2xl text-slate-300 flex flex-col items-center justify-center">
                <CheckCircle2 className="w-12 h-12 text-slate-200 mb-2" />
                <p className="font-black uppercase text-xs text-slate-400">No hay registros.</p>
            </div>
          ) : (
            displayLoans.map((l) => (
              <div key={l.id} className="bg-white rounded-2xl border p-5 shadow-sm hover:shadow-md transition-all group">
                <div className="flex justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-lg text-slate-900">{l.client}</h3>
                    <div className="flex items-center text-slate-400 text-[10px] font-bold uppercase mt-1"><Calendar className="w-3 h-3 mr-1" /> {l.date}</div>
                  </div>
                  <span className={`text-[9px] font-black px-2 py-1 rounded-full border uppercase tracking-widest ${l.status === 'ACTIVO' ? 'bg-blue-50 text-blue-600 border-blue-100' : l.status === 'RENOVADO' ? 'bg-purple-50 text-purple-600 border-purple-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>{l.status}</span>
                </div>
                
                <div className="mb-5 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <div className="flex justify-between text-[9px] font-black uppercase mb-1.5 text-slate-500"><span>Progreso de Pago</span><span>{l.progress}%</span></div>
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden shadow-inner">
                    <div className={`h-full transition-all duration-500 ${l.status === 'ACTIVO' ? 'bg-blue-600' : 'bg-emerald-500'}`} style={{ width: `${l.progress}%` }}></div>
                  </div>
                </div>

                <div className="flex justify-between mb-5 px-1">
                  <div><p className="text-slate-400 text-[9px] font-black uppercase tracking-widest mb-1">Total</p><p className="font-bold text-slate-700">{formatMoney(l.debt)}</p></div>
                  <div className="text-right"><p className="text-slate-400 text-[9px] font-black uppercase tracking-widest mb-1">Pendiente</p><p className={`font-black text-xl ${l.status === 'ACTIVO' ? 'text-blue-600' : 'text-slate-400'}`}>{formatMoney(l.remaining)}</p></div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  {l.status === 'ACTIVO' ? (
                    <button onClick={() => { setCurrentLoan(l); setPaymentAmount(''); setShowPaymentModal(true); }} className="flex items-center gap-2 font-black text-[10px] uppercase tracking-widest text-slate-900 hover:text-blue-600 transition-colors">
                      <Wallet className="w-4 h-4" /> Abonar
                    </button>
                  ) : (
                    <span className="font-black text-[10px] uppercase text-emerald-500 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Pagado</span>
                  )}
                  
                  <button onClick={() => { 
                    const schedule = calculateAdvancedSchedule(l);
                    setCurrentLoan({...l, schedule});
                    setShowScheduleModal(true);
                  }} className="flex items-center gap-2 font-black text-[10px] uppercase tracking-widest text-slate-500 hover:text-blue-500 transition-colors">
                    <ListChecks className="w-4 h-4" /> Plan
                  </button>

                  <div className="flex gap-1">
                    <button onClick={() => { setCurrentLoan(l); setShowContractModal(true); }} title="Contrato" className="p-2 hover:bg-blue-50 rounded-full text-slate-400 hover:text-blue-600 transition-all"><FileText className="w-4 h-4" /></button>
                    <button onClick={() => { setCurrentLoan(l); setEditForm({client: l.client, phone: l.phone, idNumber: l.idNumber || '', address: l.address || '', workplace: l.workplace || '', debt: l.debt, remaining: l.remaining, status: l.status}); setShowEditModal(true); }} title="Editar" className="p-2 hover:bg-amber-50 rounded-full text-slate-400 hover:text-amber-500 transition-all"><Edit className="w-4 h-4" /></button>
                    <button onClick={async () => { if(window.confirm("¿Borrar?")) await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'loans', l.id)); }} title="Borrar" className="p-2 hover:bg-red-50 rounded-full text-slate-400 hover:text-red-500 transition-all"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {/* MODAL PLAN DE PAGOS (DETALLADO) */}
      {showScheduleModal && currentLoan && (
        <div className="fixed inset-0 bg-slate-900/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-lg w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="bg-[#1e293b] p-6 text-white relative no-print">
              <button onClick={closeAllModals} className="absolute top-6 right-6 text-slate-400 hover:text-white"><X className="w-6 h-6" /></button>
              <h2 className="text-2xl font-black mb-4">{currentLoan.client}</h2>
              <div className="space-y-2 text-slate-300 text-xs font-bold mb-6">
                 <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-slate-400" /> {currentLoan.phone || 'N/A'}</div>
                 <div className="flex items-center gap-2"><Home className="w-4 h-4 text-slate-400" /> {currentLoan.address || 'N/A'}</div>
                 <div className="flex items-center gap-2"><Briefcase className="w-4 h-4 text-slate-400" /> {currentLoan.workplace || 'N/A'}</div>
              </div>
              <div className="text-slate-400 text-xs font-bold">
                Inicio: {currentLoan.date} <span className="mx-2">•</span> Total: <span className="text-white">{formatMoney(currentLoan.debt)}</span>
              </div>
            </div>

            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center no-print">
              <span className="text-slate-500 font-black text-[11px] uppercase tracking-widest">Progreso de Pagos</span>
              <span className="bg-blue-50 text-blue-600 font-black text-[10px] px-3 py-1.5 rounded uppercase tracking-wider">
                {currentLoan.progress === 100 ? 'Completado (100%)' : `En Progreso (${currentLoan.progress || 0}%)`}
              </span>
            </div>

            <div className="overflow-y-auto bg-white flex-1" id="receipt-printable-area">
               <div className="text-center mb-6 mt-6 hidden">
                 <h2 className="text-2xl font-black uppercase">PRESTAFÁCIL CRM</h2>
                 <p className="font-bold text-sm uppercase tracking-widest">Plan de Pagos: {currentLoan.client}</p>
               </div>
               <div className="grid grid-cols-5 gap-4 px-6 py-4 border-b text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white sticky top-0 z-10">
                 <div>#</div>
                 <div>Fecha</div>
                 <div>Monto</div>
                 <div>Saldo Restante</div>
                 <div className="text-right">Estado</div>
               </div>
               <div className="divide-y divide-slate-50">
                  {calculateAdvancedSchedule(currentLoan).map((inst, idx) => (
                     <div key={inst.num} className={`grid grid-cols-5 gap-4 px-6 py-4 items-center text-xs font-bold ${idx % 2 === 0 ? 'bg-slate-50/50' : 'bg-white'}`}>
                        <div className="text-slate-900">{inst.num}</div>
                        <div className="text-slate-600">{inst.date}</div>
                        <div className="text-slate-900">{formatMoney(inst.amount)}</div>
                        <div className="text-slate-400">{formatMoney(inst.remaining)}</div>
                        <div className="text-right flex justify-end">
                           {inst.status === 'PAGADO' ? <Check className="w-5 h-5 text-emerald-500" /> : <span className="text-slate-400">Pendiente</span>}
                        </div>
                     </div>
                  ))}
               </div>
            </div>

            <div className="p-6 bg-white border-t flex justify-end gap-4 no-print">
              <button onClick={() => {
                let text = `📅 *PLAN DE PAGOS - PRESTAFÁCIL*%0A👤 *Cliente:* ${currentLoan.client}%0A---------------------------%0A`;
                calculateAdvancedSchedule(currentLoan).forEach(s => { text += `🔹 Cuota ${s.num}: ${s.date} - ${formatMoney(s.amount)} (${s.status})%0A`; });
                window.open(`https://wa.me/1${currentLoan.phone?.replace(/\D/g, '')}?text=${text}`, '_blank');
              }} className="bg-[#25D366] text-white px-6 py-3 rounded-lg font-black uppercase text-[10px] flex items-center gap-2 shadow-md hover:bg-[#128c7e] transition-all"><MessageCircle className="w-4 h-4" /> Enviar por WhatsApp</button>
              <button onClick={() => window.print()} className="bg-slate-100 px-6 py-3 rounded-lg font-black uppercase text-[10px] flex items-center gap-2 text-slate-600 hover:bg-slate-200 transition-all"><Printer className="w-4 h-4" /> Imprimir Plan</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONTRATO DE PAGO */}
      {showContractModal && currentLoan && (
        <div className="fixed inset-0 bg-slate-900/80 z-[200] flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-slate-900 p-8 text-white flex justify-between items-center no-print">
              <h2 className="text-xl font-black uppercase tracking-widest">Contrato de Préstamo</h2>
              <button onClick={closeAllModals}><X /></button>
            </div>
            <div className="p-14 overflow-y-auto bg-white" id="receipt-printable-area">
              <div className="text-center mb-10 border-b-2 pb-6">
                <h1 className="text-2xl font-black text-slate-900 uppercase">PRESTAFÁCIL Soluciones Financieras</h1>
                <p className="text-[9px] font-bold text-slate-500 tracking-[0.4em] mt-2">PAGARÉ NOTARIAL Y CONTRATO DE PRÉSTAMO DE DINERO</p>
              </div>
              <div className="space-y-4 text-slate-900 text-[10px] leading-relaxed text-justify">
                <p>Entre la entidad **PRESTAFÁCIL**, en lo adelante denominada **EL ACREEDOR**, y por la otra parte el Sr./Sra. <span className="font-black border-b border-slate-900 px-2 uppercase">{currentLoan.client}</span>, portador(a) de la cédula de identidad No. <span className="font-black border-b border-slate-900 px-2">{currentLoan.idNumber || '________________'}</span>, con domicilio de residencia en <span className="font-black border-b border-slate-900 px-2 uppercase">{currentLoan.address || '________________'}</span> y laborando actualmente en <span className="font-black border-b border-slate-900 px-2 uppercase">{currentLoan.workplace || '________________'}</span>, en lo adelante denominado **EL DEUDOR**, se ha convenido el presente contrato bajo las siguientes cláusulas:</p>
                <p><strong>PRIMERO:</strong> EL DEUDOR reconoce deber y se obliga a pagar a EL ACREEDOR la suma de <span className="font-black text-slate-900 text-[11px]">{formatMoney(currentLoan.debt)}</span> por concepto de capital e intereses del préstamo recibido en esta fecha a su entera satisfacción.</p>
                <p><strong>SEGUNDO:</strong> EL DEUDOR se compromete a pagar dicha suma mediante <span className="font-black">{currentLoan.installments} cuotas</span> periódicas, según el calendario de pagos entregado adjunto a este documento.</p>
                <p><strong>TERCERO:</strong> El retraso en el pago de cualquier cuota generará un interés por mora del 5% semanal sobre el saldo vencido. La falta de pago de dos (2) cuotas consecutivas hará que la totalidad de la deuda sea **exigible inmediatamente**, perdiendo EL DEUDOR el beneficio del término acordado.</p>
                <p><strong>CUARTO:</strong> EL DEUDOR autoriza expresamente a EL ACREEDOR a consultar y reportar su historial crediticio en los burós de información económica autorizados en el país.</p>
                <p><strong>QUINTO:</strong> EL DEUDOR declara que en caso de litigio judicial, todos los gastos legales, honorarios de abogados y costas procesales correrán por su exclusiva cuenta.</p>
                <div className="grid grid-cols-2 gap-12 mt-16 pt-8">
                  <div className="text-center">
                    <div className="border-t border-slate-900 pt-2">
                      <p className="font-black uppercase text-[9px]">EL DEUDOR (Firma)</p>
                      <p className="text-[8px] text-slate-500">Cédula: {currentLoan.idNumber || '________________'}</p>
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="border-t border-slate-900 pt-2">
                      <p className="font-black uppercase text-[9px]">POR PRESTAFÁCIL</p>
                      <p className="text-[8px] text-slate-500">Sello y Firma Autorizada</p>
                    </div>
                  </div>
                </div>
                <div className="text-center mt-10 text-[8px] text-slate-400">
                  Documento emitido el {new Date().toLocaleString('es-DO')}
                </div>
              </div>
            </div>
            <div className="p-8 bg-slate-50 border-t flex gap-4 no-print">
              <button onClick={() => window.print()} className="flex-1 bg-slate-900 text-white py-4 rounded-[1.25rem] font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-3"><Printer className="w-5 h-5" /> Imprimir Contrato</button>
              <button onClick={closeAllModals} className="flex-1 bg-white border-2 py-4 rounded-[1.25rem] font-black uppercase text-[10px] text-slate-500">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NUEVO PRÉSTAMO CON SELECCIÓN DE CLIENTES */}
      {showNewLoanModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm no-print">
          <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl p-7 text-slate-900 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-black mb-6 border-b pb-4 flex justify-between items-center uppercase tracking-[0.2em] text-[10px]">Crear Nuevo Préstamo <button onClick={closeAllModals} className="text-slate-400"><X /></button></h2>
            <datalist id="clientsList">{uniqueClients.map((c, i) => <option key={i} value={c?.client || ''} />)}</datalist>
            <form onSubmit={handleSaveNewLoan} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block font-black text-[9px] uppercase text-slate-400 mb-1 ml-1">Cliente (Busca o escribe nuevo)</label>
                  <input list="clientsList" required value={newLoanForm.client || ''} onChange={handleClientNameChange} className="w-full border p-3 rounded-xl outline-none font-bold focus:border-blue-500 bg-white text-slate-900" placeholder="Nombre del cliente"/>
                </div>
                <div>
                  <label className="block font-black text-[9px] uppercase text-slate-400 mb-1 ml-1">No. Cédula</label>
                  <input required value={newLoanForm.idNumber || ''} onChange={(e)=>setNewLoanForm({...newLoanForm, idNumber: e.target.value})} className="w-full border p-3 rounded-xl outline-none font-bold focus:border-blue-500 bg-white text-slate-900" placeholder="000-0000000-0"/>
                </div>
                <div>
                  <label className="block font-black text-[9px] uppercase text-slate-400 mb-1 ml-1">Teléfono</label>
                  <input type="text" required value={newLoanForm.phone || ''} onChange={(e) => setNewLoanForm({...newLoanForm, phone: e.target.value})} className="w-full border p-3 rounded-xl outline-none font-bold focus:border-blue-500 bg-white text-slate-900" placeholder="8090000000"/>
                </div>
                <div className="col-span-2">
                  <label className="block font-black text-[9px] uppercase text-slate-400 mb-1 ml-1">Dirección de Residencia</label>
                  <input required value={newLoanForm.address || ''} onChange={(e)=>setNewLoanForm({...newLoanForm, address: e.target.value})} className="w-full border p-3 rounded-xl outline-none font-bold focus:border-blue-500 bg-white text-slate-900" placeholder="Calle, No., Sector..."/>
                </div>
                <div className="col-span-2">
                  <label className="block font-black text-[9px] uppercase text-slate-400 mb-1 ml-1">Lugar de Trabajo</label>
                  <input required value={newLoanForm.workplace || ''} onChange={(e)=>setNewLoanForm({...newLoanForm, workplace: e.target.value})} className="w-full border p-3 rounded-xl outline-none font-bold focus:border-blue-500 bg-white text-slate-900" placeholder="Empresa o Negocio..."/>
                </div>
                <div className="col-span-2">
                  <label className="block font-black text-[9px] uppercase text-slate-400 mb-1 ml-1">Capital a Entregar ($)</label>
                  <input type="number" required value={newLoanForm.capital || ''} onChange={(e) => setNewLoanForm({...newLoanForm, capital: e.target.value})} className="w-full border p-3 rounded-xl font-black text-lg focus:border-blue-500 bg-white text-slate-900"/>
                </div>
                <div className="col-span-2 bg-slate-100 p-3 rounded-xl mt-2">
                  <label className="block font-black text-[9px] uppercase text-slate-500 mb-2">Método de Cálculo</label>
                  <div className="flex gap-4 mb-2">
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-900"><input type="radio" checked={newLoanForm.calcMethod === 'interes'} onChange={() => setNewLoanForm({...newLoanForm, calcMethod: 'interes'})} /> Tasa de Interés (%)</label>
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-900"><input type="radio" checked={newLoanForm.calcMethod === 'fija'} onChange={() => setNewLoanForm({...newLoanForm, calcMethod: 'fija'})} /> Monto Fijo por Cuota ($)</label>
                  </div>
                  {newLoanForm.calcMethod === 'interes' ? (
                    <input type="number" step="any" placeholder="Ej. 15 (%)" required value={newLoanForm.interestRate || ''} onChange={(e) => setNewLoanForm({...newLoanForm, interestRate: e.target.value})} className="w-full border p-3 rounded-xl font-bold focus:border-blue-500 bg-white text-slate-900"/>
                  ) : (
                    <input type="number" step="any" placeholder="Ej. 500 ($ por cuota)" required value={newLoanForm.fixedQuota || ''} onChange={(e) => setNewLoanForm({...newLoanForm, fixedQuota: e.target.value})} className="w-full border p-3 rounded-xl font-bold focus:border-blue-500 bg-white text-slate-900"/>
                  )}
                </div>
                <div className="col-span-2">
                  <label className="block font-black text-[9px] uppercase text-slate-400 mb-1 ml-1">Cantidad Total de Cuotas y Frecuencia</label>
                  <div className="flex gap-2">
                     <input type="number" required value={newLoanForm.installments || ''} onChange={(e) => setNewLoanForm({...newLoanForm, installments: e.target.value})} className="w-1/2 border p-3 rounded-xl font-bold focus:border-blue-500 bg-white text-slate-900"/>
                     <select value={newLoanForm.freqDays || 15} onChange={(e) => setNewLoanForm({...newLoanForm, freqDays: e.target.value})} className="w-1/2 border p-3 rounded-xl font-bold text-[10px] uppercase bg-white text-slate-900"><option value="1">Diario</option><option value="7">Semanal</option><option value="15">Quincenal</option><option value="30">Mensual</option></select>
                  </div>
                </div>
              </div>
              <button type="submit" className="w-full bg-blue-600 text-white py-4 rounded-xl font-black uppercase text-[10px] tracking-[0.2em] mt-4 shadow-xl hover:bg-blue-700">Crear Préstamo</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDICIÓN */}
      {showEditModal && currentLoan && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm no-print">
          <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl p-7 text-slate-900 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-black mb-4 border-b pb-4 flex justify-between items-center text-amber-600 uppercase tracking-widest text-[10px]"><span className="flex items-center gap-2"><Edit className="w-4 h-4"/> Editar Información</span><button onClick={closeAllModals} className="text-slate-400"><X /></button></h2>
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div><label className="block font-black text-[9px] uppercase text-slate-400 mb-1 ml-1 tracking-widest">Nombre Cliente</label><input type="text" required value={editForm.client || ''} onChange={(e)=>setEditForm({...editForm, client: e.target.value})} className="w-full border p-3 rounded-xl font-bold bg-white text-slate-900 focus:border-amber-400 outline-none"/></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block font-black text-[9px] uppercase text-slate-400 mb-1 ml-1 tracking-widest">Cédula</label><input type="text" required value={editForm.idNumber || ''} onChange={(e)=>setEditForm({...editForm, idNumber: e.target.value})} className="w-full border p-3 rounded-xl font-bold bg-white text-slate-900 focus:border-amber-400"/></div>
                <div><label className="block font-black text-[9px] uppercase text-slate-400 mb-1 ml-1 tracking-widest">Teléfono</label><input type="text" required value={editForm.phone || ''} onChange={(e)=>setEditForm({...editForm, phone: e.target.value})} className="w-full border p-3 rounded-xl font-bold bg-white text-slate-900 focus:border-amber-400"/></div>
              </div>
              <div><label className="block font-black text-[9px] uppercase text-slate-400 mb-1 ml-1 tracking-widest">Dirección</label><input type="text" required value={editForm.address || ''} onChange={(e)=>setEditForm({...editForm, address: e.target.value})} className="w-full border p-3 rounded-xl font-bold bg-white text-slate-900 focus:border-amber-400"/></div>
              <div><label className="block font-black text-[9px] uppercase text-slate-400 mb-1 ml-1 tracking-widest">Lugar de Trabajo</label><input type="text" required value={editForm.workplace || ''} onChange={(e)=>setEditForm({...editForm, workplace: e.target.value})} className="w-full border p-3 rounded-xl font-bold bg-white text-slate-900 focus:border-amber-400"/></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block font-black text-[9px] uppercase text-slate-400 mb-1 ml-1 tracking-widest">Deuda Inicial ($)</label><input type="number" required value={editForm.debt || ''} onChange={(e)=>setEditForm({...editForm, debt: e.target.value})} className="w-full border p-3 rounded-xl font-black bg-white text-slate-900"/></div>
                <div><label className="block font-black text-[9px] uppercase text-slate-400 mb-1 ml-1 tracking-widest">Resta Actual ($)</label><input type="number" required value={editForm.remaining || ''} onChange={(e)=>setEditForm({...editForm, remaining: e.target.value})} className="w-full border p-3 rounded-xl font-black bg-white text-red-600"/></div>
              </div>
              <button type="submit" className="w-full bg-slate-900 text-white py-4 rounded-xl font-black uppercase text-[10px] tracking-[0.2em] mt-4 shadow-xl hover:bg-black transition-all">Guardar Cambios</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PAGO Y RECIBO */}
      {showPaymentModal && currentLoan && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm no-print">
          <div className="bg-white rounded-3xl w-full max-w-sm p-7 shadow-2xl text-center text-slate-900">
            <h3 className="font-black uppercase text-[9px] text-slate-400 tracking-[0.3em] mb-7">Registrar Abono</h3>
            <p className="font-black text-2xl mb-1">{currentLoan.client}</p>
            <div className="bg-slate-50 p-5 rounded-2xl mb-7 border border-slate-100 shadow-inner">
                <p className="text-3xl font-black text-slate-900 tracking-tighter">{formatMoney(currentLoan.remaining)}</p>
                <p className="text-[9px] font-black uppercase text-slate-400 mt-1">Saldo por Cobrar</p>
            </div>
            <input type="number" step="any" required value={paymentAmount || ''} onChange={(e) => setPaymentAmount(e.target.value)} className="w-full border-2 p-5 rounded-2xl text-4xl font-black text-center outline-none border-blue-100 focus:border-blue-500 mb-7 bg-white text-blue-600 shadow-inner" placeholder="0.00"/>
            <button onClick={handleProcessPayment} className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-xl hover:bg-blue-700">Confirmar Cobro</button>
            <button onClick={closeAllModals} className="mt-4 text-slate-400 font-black text-[9px] uppercase tracking-widest w-full py-2">Cancelar</button>
          </div>
        </div>
      )}

      {showReceiptModal && (
        <div className="fixed inset-0 bg-slate-900/75 z-50 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="p-10 text-center" id="receipt-printable-area">
              <h2 className="text-2xl font-black mb-8 border-b-2 pb-6 text-slate-900">PRESTAFÁCIL</h2>
              <p className="uppercase text-[9px] font-black tracking-[0.4em] text-slate-400 mb-2">Recibo de Ingreso</p>
              <h3 className="text-5xl font-black text-emerald-600 my-6">{formatMoney(paymentAmount)}</h3>
              <p className="font-black text-slate-900 text-lg">{currentLoan?.client}</p>
              <div className="bg-slate-50 p-4 rounded-2xl mt-6 border flex justify-between items-center">
                  <span className="text-[9px] font-black uppercase text-slate-400">Nuevo Saldo</span>
                  <span className="font-black">{formatMoney(currentLoan?.remaining)}</span>
              </div>
            </div>
            <div className="p-6 bg-slate-50 space-y-3 border-t no-print">
              <button onClick={handleWhatsAppShare} className="w-full bg-[#25D366] text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest flex justify-center items-center gap-3"><MessageCircle className="w-5 h-5" /> Enviar por WhatsApp</button>
              <button onClick={() => window.print()} className="w-full bg-white border-2 border-slate-200 text-slate-600 py-4 rounded-[1.5rem] font-black uppercase text-[11px] flex items-center justify-center gap-3 hover:bg-slate-50 transition-all"><Printer className="w-5 h-5" /> Imprimir</button>
              <button onClick={closeAllModals} className="w-full bg-slate-900 text-white py-3 rounded-2xl font-black text-[9px] uppercase tracking-widest">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL GESTIÓN DE CAJA */}
      {showCashModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm no-print">
          <div className="bg-white rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="bg-slate-900 px-6 py-4 flex justify-between text-white font-black uppercase tracking-[0.2em] text-[10px] items-center">
              <h3>Control de Efectivo</h3><button onClick={closeAllModals}><X className="text-slate-400 hover:text-white" /></button>
            </div>
            <div className="p-6 bg-slate-50 flex-1 overflow-y-auto">
              <form onSubmit={handleSaveCashTransaction} className="bg-white p-5 rounded-2xl border mb-6 shadow-sm">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div><select value={cashForm.type} onChange={(e) => setCashForm({...cashForm, type: e.target.value})} className="w-full border p-3 rounded-xl font-bold text-xs bg-white text-slate-900"><option value="INYECCION">Inyección (+)</option><option value="RETIRO">Retiro (-)</option></select></div>
                  <div><input type="number" step="any" placeholder="Monto ($)" required value={cashForm.amount || ''} onChange={(e) => setCashForm({...cashForm, amount: e.target.value})} className="w-full border p-3 rounded-xl font-black bg-white text-slate-900"/></div>
                  <div className="col-span-2"><input type="text" placeholder="Motivo / Concepto" required value={cashForm.concept || ''} onChange={(e) => setCashForm({...cashForm, concept: e.target.value})} className="w-full border p-3 rounded-xl font-bold text-xs bg-white text-slate-900"/></div>
                </div>
                <button type="submit" className="w-full py-4 rounded-xl text-white font-black uppercase text-[10px] tracking-[0.2em] bg-slate-900 hover:bg-black">Registrar Movimiento</button>
              </form>
              <div className="bg-white rounded-2xl border overflow-hidden">
                <div className="p-4 bg-slate-100 border-b font-black text-[10px] uppercase text-slate-500">Historial</div>
                <div className="divide-y divide-slate-100">
                  {transactions.map(t => (
                    <div key={t.id} className="p-4 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl ${t.type === 'RETIRO' ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>{t.type === 'RETIRO' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}</div>
                        <div><p className="font-bold text-xs text-slate-900">{t.concept}</p><p className="text-[9px] font-black uppercase text-slate-400 mt-0.5">{new Date(t.date).toLocaleString()}</p></div>
                      </div>
                      <p className={`font-black text-sm ${t.type === 'RETIRO' ? 'text-red-600' : 'text-emerald-600'}`}>{t.type === 'RETIRO' ? '-' : '+'}{formatMoney(t.amount)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL RESTAURACIÓN */}
      {showMigrationModal && (
        <div className="fixed inset-0 bg-slate-900/80 z-[200] flex items-center justify-center p-4 backdrop-blur-md no-print">
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl shadow-2xl p-10">
            <h2 className="text-xl font-black uppercase tracking-widest text-slate-800 mb-6">Restauración</h2>
            <textarea value={migrationText} onChange={(e) => setMigrationText(e.target.value)} className="w-full h-64 border-2 p-4 rounded-xl bg-white text-slate-900 font-mono text-[10px] mb-6 outline-none focus:border-blue-500 shadow-inner" placeholder='Pega JSON aquí...'></textarea>
            <div className="grid grid-cols-2 gap-4">
                <button onClick={() => handleMigrateData(true)} className="bg-red-50 text-red-600 border border-red-100 py-4 rounded-xl font-black uppercase text-[10px] hover:bg-red-100 transition-all flex items-center justify-center gap-2"><Trash className="w-4 h-4" /> Borrar e Importar</button>
                <button onClick={() => handleMigrateData(false)} className="bg-slate-900 text-white py-4 rounded-xl font-black uppercase text-[10px] hover:bg-black flex items-center justify-center gap-2 transition-all"><Cloud className="w-4 h-4" /> Solo Importar</button>
            </div>
            <button onClick={closeAllModals} className="mt-4 w-full text-slate-400 font-bold text-xs">Cancelar</button>
          </div>
        </div>
      )}

    </div>
  );
}