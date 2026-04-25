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

const appId = 'prestafacil-produccion-final-v1';
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
  
  // Formularios
  const [paymentAmount, setPaymentAmount] = useState('');
  const [newLoanForm, setNewLoanForm] = useState({
    client: '', phone: '', calcMethod: 'interes', capital: '', interestRate: '', fixedQuota: '', installments: ''
  });
  const [renewForm, setRenewForm] = useState({
    capital: '', calcMethod: 'interes', interestRate: '', fixedQuota: '', installments: ''
  });
  const [cashForm, setCashForm] = useState({ type: 'INYECCION', amount: '', concept: '' });

  // Autenticación
  useEffect(() => {
    const initAuth = async () => {
      try { await signInAnonymously(auth); } 
      catch (error) { setAuthError("Error de conexión con Firebase."); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => { if (u) setUser(u); });
    return () => unsubscribe();
  }, []);

  // Carga de Datos Compartida
  useEffect(() => {
    if (!user || !isAuthenticated) return;
    const unsubLoans = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'loans'), (s) => {
      setLoans(s.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => setAuthError("Error leyendo préstamos."));

    const unsubTrans = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'transactions'), (s) => {
      const t = s.docs.map(d => ({ id: d.id, ...d.data() }));
      t.sort((a, b) => new Date(b.date) - new Date(a.date));
      setTransactions(t);
    });

    return () => { unsubLoans(); unsubTrans(); };
  }, [user, isAuthenticated]);

  const handleLogin = (e) => {
    e.preventDefault();
    if (pinInput === PIN_ACCESO) { setIsAuthenticated(true); } 
    else { alert("❌ PIN incorrecto"); setPinInput(''); }
  };

  // Cálculos Globales
  const cajaDisponible = transactions.reduce((t, tr) => tr.type === 'RETIRO' ? t - tr.amount : t + tr.amount, 0);
  const capitalEnCalle = loans.reduce((t, l) => l.status === 'ACTIVO' ? t + l.remaining : t, 0);
  
  // Lista única de clientes para autocompletar
  const uniqueClients = Array.from(new Set(loans.map(l => l.client)))
    .map(name => loans.find(l => l.client === name));

  const formatMoney = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);

  // MANEJO DE CLIENTES EXISTENTES (Autocompletar teléfono)
  const handleClientNameChange = (e) => {
    const name = e.target.value;
    const existingClient = uniqueClients.find(c => c.client === name);
    setNewLoanForm({ 
      ...newLoanForm, 
      client: name, 
      phone: existingClient ? existingClient.phone : newLoanForm.phone 
    });
  };

  // NUEVO PRÉSTAMO
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
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'loans'), { 
        client: newLoanForm.client, phone: newLoanForm.phone, 
        date: new Date().toLocaleDateString('es-DO'), 
        progress: 0, debt: total, remaining: total, status: 'ACTIVO' 
      });
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'transactions'), { 
        type: 'RETIRO', amount: cap, concept: `Desembolso Préstamo - ${newLoanForm.client}`, date: new Date().toISOString() 
      });
      setShowNewLoanModal(false);
      setNewLoanForm({ client: '', phone: '', calcMethod: 'interes', capital: '', interestRate: '', fixedQuota: '', installments: '' });
    } catch (e) { setAuthError("Error al crear préstamo."); }
  };

  // RENOVACIÓN DE PRÉSTAMO
  const openRenew = (loan) => {
    setCurrentLoan(loan);
    setRenewForm({ capital: '', calcMethod: 'interes', interestRate: '', fixedQuota: '', installments: '' });
    setShowRenewModal(true);
    setActiveDropdown(null);
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
      // 1. Cerrar préstamo viejo
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'loans', currentLoan.id), { 
        status: 'RENOVADO', remaining: 0, progress: 100 
      });
      
      // 2. Crear préstamo nuevo
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'loans'), { 
        client: currentLoan.client, phone: currentLoan.phone, 
        date: new Date().toLocaleDateString('es-DO'), 
        progress: 0, debt: newTotalDebt, remaining: newTotalDebt, status: 'ACTIVO' 
      });

      // 3. Transacción de caja (solo sale la diferencia)
      if (netoAEntregar > 0) {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'transactions'), { 
          type: 'RETIRO', amount: netoAEntregar, concept: `Renovación (Neto Entregado) - ${currentLoan.client}`, date: new Date().toISOString() 
        });
      }

      setShowRenewModal(false);
      alert("Préstamo renovado exitosamente.");
    } catch (e) { setAuthError("Error al renovar préstamo."); }
  };

  // PAGOS
  const handleProcessPayment = async (e) => {
    e.preventDefault();
    if (!user || !currentLoan) return;
    const monto = parseFloat(paymentAmount) || 0;
    const resta = Math.max(0, currentLoan.remaining - monto);
    
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'loans', currentLoan.id), { 
        remaining: resta, progress: Math.round(((currentLoan.debt - resta) / currentLoan.debt) * 100), status: resta === 0 ? 'PAGADO' : 'ACTIVO' 
      });
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'transactions'), { 
        type: 'INYECCION', amount: monto, concept: `Abono Cuota - ${currentLoan.client}`, date: new Date().toISOString() 
      });
      setShowPaymentModal(false); 
      setShowReceiptModal(true);
    } catch (e) { setAuthError("Error al registrar pago."); }
  };

  // CAJA
  const handleSaveCashTransaction = async (e) => {
    e.preventDefault();
    const monto = parseFloat(cashForm.amount);
    if (cashForm.type === 'RETIRO' && monto > cajaDisponible) return alert("No hay fondos suficientes.");
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'transactions'), { ...cashForm, amount: monto, date: new Date().toISOString() });
      setCashForm({ type: 'INYECCION', amount: '', concept: '' });
    } catch (e) { setAuthError("Error en caja."); }
  };

  // RESTAURACIÓN GLOBAL (Usa la ruta pública)
  const handleMigrateData = async (clearFirst = false) => {
    if (!migrationText.trim()) return;
    try {
      const batch = writeBatch(db);
      if (clearFirst) {
        loans.forEach(l => batch.delete(doc(db, 'artifacts', appId, 'public', 'data', 'loans', l.id)));
        transactions.forEach(t => batch.delete(doc(db, 'artifacts', appId, 'public', 'data', 'transactions', t.id)));
        await batch.commit();
      }
      let parsed = JSON.parse(migrationText);
      const dataLoans = Array.isArray(parsed) ? parsed : (parsed.loans || []);
      const dataCash = parsed.capitalHistory || parsed.transactions || [];
      
      for (const item of dataLoans) {
        const totalDebt = parseFloat(item.totalDebt || item.debt || 0);
        const paid = parseFloat(item.paid || 0);
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'loans'), {
          client: item.client || 'Sin nombre', phone: item.phone || '', idNumber: item.idNumber || '', address: item.address || '', workplace: item.workplace || '',
          date: item.startDate || item.date || new Date().toLocaleDateString('es-DO'),
          progress: totalDebt > 0 ? Math.round((paid / totalDebt) * 100) : 0,
          principal: item.principal || (totalDebt / 1.2),
          debt: totalDebt, remaining: totalDebt - paid,
          status: (item.status === 'completed' || paid >= totalDebt) ? 'PAGADO' : 'ACTIVO',
          freqDays: Number(item.freqDays || 15), installments: Number(item.term || item.installments || 1)
        });
      }

      for (const cashItem of dataCash) {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'transactions'), {
          type: (Number(cashItem.amount) >= 0) ? 'INYECCION' : 'RETIRO',
          amount: Math.abs(Number(cashItem.amount || 0)),
          concept: cashItem.note || cashItem.concept || 'Migración',
          date: cashItem.date || new Date().toISOString()
        });
      }
      setShowMigrationModal(false); setMigrationText(''); alert("✅ Restauración exitosa para todos los dispositivos.");
    } catch (e) { alert("❌ Error al leer el archivo JSON."); }
  };

  // WHATSAPP
  const handleWhatsAppShare = () => {
    const text = `🧾 *RECIBO DE PAGO - PRESTAFÁCIL*%0A👤 *Cliente:* ${currentLoan.client}%0A💵 *Monto Pagado:* ${formatMoney(paymentAmount)}%0A📉 *Saldo Pendiente:* ${formatMoney(currentLoan.remaining)}%0A📅 *Fecha:* ${new Date().toLocaleDateString()}%0A✅ _¡Gracias por su cumplimiento!_`;
    window.open(`https://wa.me/1${currentLoan.phone?.replace(/\D/g, '')}?text=${text}`, '_blank');
  };

  const closeAllModals = () => { setShowPaymentModal(false); setShowReceiptModal(false); setShowNewLoanModal(false); setShowCashModal(false); setShowRenewModal(false); setShowMigrationModal(false); setCurrentLoan(null); };

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
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-20 relative text-sm">
      <style>{`@media print { body * { visibility: hidden; } #receipt-printable-area, #receipt-printable-area * { visibility: visible; } #receipt-printable-area { position: absolute; left: 0; top: 0; width: 100%; } }`}</style>
      
      <nav className="bg-white border-b px-6 py-4 flex justify-between items-center sticky top-0 z-10 shadow-sm no-print">
        <div className="flex items-center gap-2">
          <div className="bg-slate-900 p-2 rounded-lg"><PiggyBank className="w-5 h-5 text-white" /></div>
          <span className="text-xl font-bold">PrestaFácil CRM</span>
        </div>
        <button onClick={() => setShowMigrationModal(true)} className="bg-slate-50 border border-slate-200 text-slate-600 px-4 py-2 rounded-full font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-slate-100 transition-all">
          <Upload className="w-4 h-4" /> Restaurar
        </button>
      </nav>

      {authError && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 mx-4 mt-4 rounded-r-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
          <div><p className="font-bold text-amber-900">Aviso</p><p className="text-xs text-amber-700">{authError}</p></div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 text-slate-900">
          <div className="bg-slate-900 rounded-2xl p-6 relative overflow-hidden shadow-lg shadow-slate-900/20">
            <div className="flex justify-between items-start relative z-10">
              <p className="text-slate-400 uppercase tracking-widest text-[10px] font-black">Caja Disponible</p>
              <button onClick={() => setShowCashModal(true)} className="bg-slate-800 text-[10px] px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-white hover:bg-slate-700 font-black transition-colors">
                <History className="w-3 h-3" /> GESTIONAR
              </button>
            </div>
            <h2 className="text-4xl font-black mt-2 relative z-10 text-white tracking-tight">{formatMoney(cajaDisponible)}</h2>
            <Wallet className="absolute -right-4 -bottom-4 w-24 h-24 text-slate-800 opacity-50" />
          </div>
          
          <div className="bg-white rounded-2xl p-6 border flex justify-between items-center shadow-sm">
            <div><p className="text-slate-400 text-[10px] font-black uppercase tracking-wider">Capital en Calle</p><h2 className="text-3xl font-black">{formatMoney(capitalEnCalle)}</h2></div>
            <TrendingUp className="text-blue-100 w-10 h-10" />
          </div>
        </div>

        {/* Controles */}
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
          <div className="bg-white p-1 rounded-xl border flex shadow-sm">
            <button onClick={() => setActiveTab('activos')} className={`px-6 py-2 rounded-lg font-black text-[10px] uppercase transition-all ${activeTab === 'activos' ? 'bg-slate-100 text-slate-900' : 'text-slate-400'}`}>Activos</button>
            <button onClick={() => setActiveTab('historial')} className={`px-6 py-2 rounded-lg font-black text-[10px] uppercase transition-all ${activeTab === 'historial' ? 'bg-slate-100 text-slate-900' : 'text-slate-400'}`}>Historial</button>
          </div>
          <button onClick={() => setShowNewLoanModal(true)} className="w-full sm:w-auto bg-blue-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 justify-center text-xs shadow-lg shadow-blue-100 hover:bg-blue-700 transition-colors">
            <Plus className="w-4 h-4" /> NUEVO PRÉSTAMO
          </button>
        </div>

        {/* Lista de Préstamos */}
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

                <div className="flex gap-2 border-t pt-4 relative">
                  {l.status === 'ACTIVO' ? (
                    <button onClick={() => { setCurrentLoan(l); setPaymentAmount(''); setShowPaymentModal(true); setActiveDropdown(null); }} className="flex-1 bg-slate-900 text-white py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-black transition-all">Abonar</button>
                  ) : (
                    <button className="flex-1 bg-slate-50 text-slate-500 py-2.5 rounded-xl font-black flex items-center justify-center gap-2 text-[10px] uppercase tracking-widest cursor-default"><CheckCircle2 className="w-4 h-4" /> Cerrado</button>
                  )}
                  <button onClick={() => { setCurrentLoan(l); setActiveDropdown(activeDropdown === l.id ? null : l.id); }} className="p-2 border rounded-xl text-slate-400 hover:bg-slate-50 transition-colors"><MoreVertical className="w-5 h-5" /></button>
                  
                  {activeDropdown === l.id && (
                    <div className="absolute right-0 bottom-full mb-2 bg-white border shadow-2xl rounded-xl py-2 z-20 w-48 font-bold overflow-hidden border-slate-100">
                      
                      {l.status === 'ACTIVO' && <button onClick={() => openRenew(l)} className="w-full text-left px-4 py-3 hover:bg-blue-50 text-blue-700 flex items-center gap-2 text-xs font-black uppercase border-t border-slate-50"><RefreshCw className="w-4 h-4" /> Renovar Préstamo</button>}
                      
                      <button onClick={async () => { if(window.confirm("¿Seguro que desea eliminarlo permanentemente de la base compartida?")) { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'loans', l.id)); setActiveDropdown(null); } }} className="w-full text-left px-4 py-3 hover:bg-red-50 text-red-600 flex items-center gap-2 text-xs font-black uppercase border-t"><Trash2 className="w-4 h-4" /> Eliminar</button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {/* MODAL NUEVO PRÉSTAMO CON SELECCIÓN DE CLIENTES */}
      {showNewLoanModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl p-7 text-slate-900 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-black mb-6 border-b pb-4 flex justify-between items-center uppercase tracking-[0.2em] text-[10px]">Crear Nuevo Préstamo <button onClick={closeAllModals} className="text-slate-400"><X /></button></h2>
            
            <datalist id="clientsList">
              {uniqueClients.map((c, i) => <option key={i} value={c?.client || ''} />)}
            </datalist>

            <form onSubmit={handleSaveNewLoan} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block font-black text-[9px] uppercase text-slate-400 mb-1 ml-1">Cliente (Busca o escribe nuevo)</label>
                  <input list="clientsList" required value={newLoanForm.client || ''} onChange={handleClientNameChange} className="w-full border p-3 rounded-xl outline-none font-bold focus:border-blue-500 bg-white text-slate-900" placeholder="Nombre del cliente"/>
                </div>
                <div className="col-span-2">
                  <label className="block font-black text-[9px] uppercase text-slate-400 mb-1 ml-1">Teléfono</label>
                  <input type="text" required value={newLoanForm.phone || ''} onChange={(e) => setNewLoanForm({...newLoanForm, phone: e.target.value})} className="w-full border p-3 rounded-xl outline-none font-bold focus:border-blue-500 bg-white text-slate-900" placeholder="8090000000"/>
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
                  <label className="block font-black text-[9px] uppercase text-slate-400 mb-1 ml-1">Cantidad Total de Cuotas</label>
                  <input type="number" required value={newLoanForm.installments || ''} onChange={(e) => setNewLoanForm({...newLoanForm, installments: e.target.value})} className="w-full border p-3 rounded-xl font-bold focus:border-blue-500 bg-white text-slate-900"/>
                </div>
              </div>
              <button type="submit" className="w-full bg-blue-600 text-white py-4 rounded-xl font-black uppercase text-[10px] tracking-[0.2em] mt-4 shadow-xl hover:bg-blue-700">Crear Préstamo</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL RENOVACIÓN */}
      {showRenewModal && currentLoan && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl p-7 text-slate-900 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-black mb-4 border-b pb-4 flex justify-between items-center text-purple-600 uppercase tracking-widest text-[10px]">
              <span className="flex items-center gap-2"><RefreshCw className="w-4 h-4"/> Renovar Préstamo</span>
              <button onClick={closeAllModals} className="text-slate-400"><X /></button>
            </h2>
            
            <div className="bg-slate-50 p-4 rounded-xl mb-4 border border-slate-200">
              <p className="font-bold">{currentLoan.client}</p>
              <div className="flex justify-between mt-2 font-black text-sm">
                <span className="text-slate-500">Deuda Pendiente Actual:</span>
                <span className="text-red-500">{formatMoney(currentLoan.remaining)}</span>
              </div>
            </div>

            <form onSubmit={handleProcessRenewal} className="space-y-4">
              <div>
                <label className="block font-black text-[9px] uppercase text-slate-400 mb-1 ml-1">Nuevo Capital Total Solicitado ($)</label>
                <input type="number" required value={renewForm.capital || ''} onChange={(e) => setRenewForm({...renewForm, capital: e.target.value})} className="w-full border-2 p-3 rounded-xl font-black text-xl focus:border-purple-500 text-purple-700 bg-white text-slate-900"/>
                {parseFloat(renewForm.capital) > 0 && (
                  <p className="text-xs font-bold text-emerald-600 mt-2 bg-emerald-50 p-2 rounded-lg">
                    Efectivo a entregar al cliente hoy: {formatMoney(parseFloat(renewForm.capital) - currentLoan.remaining)}
                  </p>
                )}
              </div>

              <div className="bg-slate-100 p-3 rounded-xl mt-2">
                  <label className="block font-black text-[9px] uppercase text-slate-500 mb-2">Nuevo Método de Cálculo</label>
                  <div className="flex gap-4 mb-2">
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-900"><input type="radio" checked={renewForm.calcMethod === 'interes'} onChange={() => setRenewForm({...renewForm, calcMethod: 'interes'})} /> Tasa (%)</label>
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-900"><input type="radio" checked={renewForm.calcMethod === 'fija'} onChange={() => setRenewForm({...renewForm, calcMethod: 'fija'})} /> Monto Fijo ($)</label>
                  </div>
                  {renewForm.calcMethod === 'interes' ? (
                    <input type="number" step="any" placeholder="Tasa de Interés (%)" required value={renewForm.interestRate || ''} onChange={(e) => setRenewForm({...renewForm, interestRate: e.target.value})} className="w-full border p-3 rounded-xl font-bold focus:border-purple-500 bg-white text-slate-900"/>
                  ) : (
                    <input type="number" step="any" placeholder="Monto fijo por cuota ($)" required value={renewForm.fixedQuota || ''} onChange={(e) => setRenewForm({...renewForm, fixedQuota: e.target.value})} className="w-full border p-3 rounded-xl font-bold focus:border-purple-500 bg-white text-slate-900"/>
                  )}
              </div>

              <div>
                <label className="block font-black text-[9px] uppercase text-slate-400 mb-1 ml-1">Nuevas Cuotas</label>
                <input type="number" required value={renewForm.installments || ''} onChange={(e) => setRenewForm({...renewForm, installments: e.target.value})} className="w-full border p-3 rounded-xl font-bold focus:border-purple-500 bg-white text-slate-900"/>
              </div>

              <button type="submit" className="w-full bg-purple-600 text-white py-4 rounded-xl font-black uppercase text-[10px] tracking-[0.2em] mt-4 shadow-xl hover:bg-purple-700">Confirmar Renovación</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PAGO Y RECIBO */}
      {showPaymentModal && currentLoan && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-sm p-7 shadow-2xl text-center text-slate-900">
            <h3 className="font-black uppercase text-[9px] text-slate-400 tracking-[0.3em] mb-7">Registrar Abono</h3>
            <p className="font-black text-2xl mb-1">{currentLoan.client}</p>
            <div className="bg-slate-50 p-5 rounded-2xl mb-7 border border-slate-100 shadow-inner">
                <p className="text-3xl font-black text-slate-900 tracking-tighter">{formatMoney(currentLoan.remaining)}</p>
                <p className="text-[9px] font-black uppercase text-slate-400 mt-1">Saldo por Cobrar</p>
            </div>
            <input type="number" step="any" required value={paymentAmount || ''} onChange={(e) => setPaymentAmount(e.target.value)} className="w-full border-2 p-5 rounded-2xl text-4xl font-black text-center outline-none border-blue-100 focus:border-blue-500 mb-7 bg-white text-blue-600" placeholder="0.00"/>
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
            <div className="p-6 bg-slate-50 space-y-3 border-t">
              <button onClick={handleWhatsAppShare} className="w-full bg-[#25D366] text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest flex justify-center items-center gap-3"><MessageCircle className="w-5 h-5" /> Enviar por WhatsApp</button>
              <button onClick={closeAllModals} className="w-full bg-slate-900 text-white py-3 rounded-2xl font-black text-[9px] uppercase tracking-widest">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL GESTIÓN DE CAJA */}
      {showCashModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
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

      {/* MODAL RESTAURACIÓN (TEXTAREA ORIGINAL) */}
      {showMigrationModal && (
        <div className="fixed inset-0 bg-slate-900/80 z-[200] flex items-center justify-center p-4 backdrop-blur-md no-print">
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl shadow-2xl p-10">
            <h2 className="text-xl font-black uppercase tracking-widest text-slate-800 mb-6">Restaurar Sistema</h2>
            <textarea value={migrationText} onChange={(e) => setMigrationText(e.target.value)} className="w-full h-64 border-2 p-4 rounded-xl bg-slate-50 text-slate-900 font-mono text-[10px] mb-6 outline-none focus:border-blue-500 shadow-inner" placeholder='Pega tu código JSON aquí...'></textarea>
            <div className="grid grid-cols-2 gap-4">
                <button onClick={() => handleMigrateData(true)} className="bg-red-50 text-red-600 border border-red-100 py-4 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-red-100 transition-all flex items-center justify-center gap-2"><Trash className="w-4 h-4" /> Borrar e Importar</button>
                <button onClick={() => handleMigrateData(false)} className="bg-slate-900 text-white py-4 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-black flex items-center justify-center gap-2 transition-all"><Cloud className="w-4 h-4" /> Solo Importar</button>
            </div>
            <button onClick={closeAllModals} className="mt-4 w-full text-slate-400 font-bold text-xs uppercase tracking-widest hover:text-slate-600">Cancelar</button>
          </div>
        </div>
      )}

    </div>
  );
}
