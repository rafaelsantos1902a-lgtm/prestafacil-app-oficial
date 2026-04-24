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
  
  // Formularios
  const [migrationText, setMigrationText] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [newLoanForm, setNewLoanForm] = useState({
    client: '', phone: '', calcMethod: 'interes', capital: '', interestRate: '', fixedQuota: '', installments: '', freqDays: 15
  });
  const [editForm, setEditForm] = useState({ client: '', phone: '', debt: '', remaining: '', status: '' });
  const [cashForm, setCashForm] = useState({ type: 'INYECCION', amount: '', concept: '' });

  useEffect(() => {
    const initAuth = async () => {
      try { await signInAnonymously(auth); } 
      catch (error) { console.error("Error Auth"); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => { if (u) setUser(u); });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !isAuthenticated) return;
    const unsubLoans = onSnapshot(collection(db, 'artifacts', appId, 'users', user.uid, 'loans'), (s) => {
      setLoans(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubTrans = onSnapshot(collection(db, 'artifacts', appId, 'users', user.uid, 'transactions'), (s) => {
      const t = s.docs.map(d => ({ id: d.id, ...d.data() }));
      t.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
      setTransactions(t);
    });
    return () => { unsubLoans(); unsubTrans(); };
  }, [user, isAuthenticated]);

  const handleLogin = (e) => {
    e.preventDefault();
    if (pinInput === PIN_ACCESO) { setIsAuthenticated(true); } 
    else { setSystemMessage("❌ PIN incorrecto"); setPinInput(''); }
  };

  // Cálculos Dashboard (Estilo exacto image_6d84fb)
  const cajaDisponible = transactions.reduce((t, tr) => tr.type === 'RETIRO' ? t - Number(tr.amount || 0) : t + Number(tr.amount || 0), 0);
  const capitalEnCalle = loans.reduce((t, l) => l.status === 'ACTIVO' ? t + Number(l.remaining || 0) : t, 0);
  const gananciaProyectada = loans.reduce((t, l) => t + (Number(l.debt || 0) - Number(l.principal || (l.debt/1.2) || 0)), 0);
  const totalRecaudado = transactions.reduce((t, tr) => tr.concept?.toLowerCase().includes('pago') || tr.concept?.toLowerCase().includes('abono') || tr.concept?.toLowerCase().includes('cobro') ? t + Number(tr.amount || 0) : t, 0);

  const formatMoney = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(n) || 0);

  const parseSafeDate = (dateStr) => {
    if (!dateStr) return new Date();
    // Si la fecha viene en formato DD/MM/YYYY
    if (dateStr.includes('/')) {
      const [d, m, y] = dateStr.split('/');
      return new Date(`${y}-${m}-${d}`);
    }
    return new Date(dateStr);
  };

  const calculateSchedule = (loan) => {
    if (!loan) return [];
    const schedule = [];
    const startDate = parseSafeDate(loan.date);
    const freq = Number(loan.freqDays || 15);
    const totalInst = Number(loan.installments || 1);
    const quotaAmount = (Number(loan.debt || 0) / totalInst);
    
    for (let i = 1; i <= totalInst; i++) {
      const dueDate = new Date(startDate);
      dueDate.setDate(startDate.getDate() + (freq * i));
      schedule.push({ 
        num: i, 
        date: isNaN(dueDate.getTime()) ? 'Fecha Pendiente' : dueDate.toLocaleDateString('es-DO'), 
        amount: quotaAmount 
      });
    }
    return schedule;
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
          client: item.client || 'Sin nombre', phone: item.phone || '',
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
      setShowMigrationModal(false); setSystemMessage("✅ Sincronización Exitosa");
    } catch (e) { setSystemMessage("❌ Error en JSON"); }
  };

  const handleSaveNewLoan = async (e) => {
    e.preventDefault();
    const cap = parseFloat(newLoanForm.capital);
    const inst = parseInt(newLoanForm.installments);
    const total = newLoanForm.calcMethod === 'fija' ? parseFloat(newLoanForm.fixedQuota) * inst : cap + (cap * (parseFloat(newLoanForm.interestRate) / 100));
    try {
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'loans'), { 
        client: newLoanForm.client, phone: newLoanForm.phone, date: new Date().toISOString().split('T')[0], 
        progress: 0, debt: total, remaining: total, principal: cap, status: 'ACTIVO', freqDays: parseInt(newLoanForm.freqDays), installments: inst
      });
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'transactions'), { 
        type: 'RETIRO', amount: cap, concept: `Préstamo: ${newLoanForm.client}`, date: new Date().toISOString() 
      });
      setShowNewLoanModal(false);
      setNewLoanForm({ client: '', phone: '', calcMethod: 'interes', capital: '', interestRate: '', fixedQuota: '', installments: '', freqDays: 15 });
    } catch (e) { console.error(e); }
  };

  const handleProcessPayment = async (e) => {
    e.preventDefault();
    const monto = parseFloat(paymentAmount) || 0;
    const resta = Math.max(0, currentLoan.remaining - monto);
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'loans', currentLoan.id), { 
        remaining: resta, progress: Math.round(((currentLoan.debt - resta) / currentLoan.debt) * 100), status: resta === 0 ? 'PAGADO' : 'ACTIVO' 
      });
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'transactions'), { 
        type: 'INYECCION', amount: monto, concept: `Cobro: ${currentLoan.client}`, date: new Date().toISOString() 
      });
      setShowPaymentModal(false); setShowReceiptModal(true);
    } catch (e) { console.error(e); }
  };

  const closeAllModals = () => { 
    setShowPaymentModal(false); setShowReceiptModal(false); setShowNewLoanModal(false); 
    setShowCashModal(false); setShowMigrationModal(false); 
    setShowScheduleModal(false); setShowEditModal(false); setCurrentLoan(null); setSystemMessage(null);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-6 font-sans">
        <div className="bg-white rounded-[3rem] p-12 w-full max-w-sm shadow-2xl text-center border-t-8 border-blue-600">
          <div className="bg-slate-100 w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm"><Lock className="w-8 h-8 text-blue-600" /></div>
          <h1 className="text-2xl font-black text-slate-800 mb-1">PrestaFácil CRM</h1>
          <p className="text-slate-400 font-bold mb-8 uppercase text-[9px] tracking-widest">Acceso Privado</p>
          <form onSubmit={handleLogin} className="space-y-5">
            <input type="password" placeholder="PIN" value={pinInput} onChange={(e)=>setPinInput(e.target.value)} className="w-full border-2 border-slate-50 p-5 rounded-2xl text-center text-3xl font-black tracking-[0.4em] outline-none focus:border-blue-600 bg-slate-50 shadow-inner" autoFocus />
            <button type="submit" className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl hover:bg-blue-700 active:scale-95 transition-all">Ingresar</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans text-slate-800 pb-20 relative text-sm">
      <style>{`@media print { body * { visibility: hidden; } #receipt-printable-area, #receipt-printable-area * { visibility: visible; } #receipt-printable-area { position: absolute; left: 0; top: 0; width: 100%; } }`}</style>
      
      <nav className="bg-white border-b px-10 py-6 flex justify-between items-center sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-slate-900 p-2 rounded-xl"><PiggyBank className="w-7 h-7 text-white" /></div>
          <span className="text-3xl font-black tracking-tight text-slate-900">PrestaFácil CRM</span>
        </div>
        <button onClick={() => setShowMigrationModal(true)} className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-black text-[11px] uppercase flex items-center gap-3 hover:bg-black transition-all shadow-xl"><Upload className="w-5 h-5" /> Restaurar Sistema</button>
      </nav>

      {systemMessage && (
        <div className="fixed top-6 right-6 z-[200] bg-slate-900 text-white p-5 rounded-2xl shadow-2xl animate-in slide-in-from-top-4 flex items-center gap-4 border border-slate-700">
          <AlertCircle className="w-6 h-6 text-blue-400" />
          <p className="font-bold pr-4">{systemMessage}</p>
          <button onClick={() => setSystemMessage(null)} className="p-1 hover:bg-slate-800 rounded-full"><X className="w-4 h-4" /></button>
        </div>
      )}

      <main className="max-w-[1600px] mx-auto px-10 py-12">
        {/* DASHBOARD INDICADORES (ESTILO image_6d84fb) */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-16">
          <div className="bg-[#1e293b] rounded-[2.5rem] p-9 relative overflow-hidden shadow-2xl border-b-[10px] border-blue-500">
            <div className="flex justify-between items-start relative z-10">
              <p className="text-slate-400 uppercase tracking-widest text-[11px] font-black">Caja Disponible</p>
              <button onClick={() => setShowCashModal(true)} className="bg-slate-700/50 text-[10px] px-5 py-2.5 rounded-xl text-white hover:bg-slate-700 font-bold border border-slate-600 flex items-center gap-2 uppercase tracking-widest">Cuadrar</button>
            </div>
            <h2 className="text-6xl font-black mt-5 relative z-10 text-emerald-400 tracking-tighter">{formatMoney(cajaDisponible)}</h2>
            <p className="text-slate-500 text-[10px] font-bold mt-2 relative z-10 tracking-widest uppercase">Dinero real en mano</p>
            <Wallet className="absolute -right-8 -bottom-8 w-44 h-44 text-white opacity-5" />
          </div>

          <div className="bg-white rounded-[2.5rem] p-9 border border-slate-100 flex justify-between items-center shadow-sm hover:shadow-md transition-all">
            <div><p className="text-slate-400 text-[11px] font-black uppercase tracking-widest mb-2">Capital Vivo (En Calle)</p><h2 className="text-4xl font-black text-slate-800 tracking-tight">{formatMoney(capitalEnCalle)}</h2><p className="text-slate-400 text-[10px] font-bold mt-1">Capital pendiente de retorno</p></div>
            <div className="bg-blue-50 p-6 rounded-[2rem] text-blue-600 shadow-inner"><TrendingUp className="w-10 h-10" /></div>
          </div>

          <div className="bg-white rounded-[2.5rem] p-9 border border-slate-100 flex justify-between items-center shadow-sm hover:shadow-md transition-all">
            <div><p className="text-slate-400 text-[11px] font-black uppercase tracking-widest mb-2">Ganancia Proyectada</p><h2 className="text-4xl font-black text-emerald-600 tracking-tight">{formatMoney(gananciaProyectada)}</h2></div>
            <div className="bg-emerald-50 p-6 rounded-[2rem] text-emerald-600 shadow-inner"><ArrowUpRight className="w-10 h-10" /></div>
          </div>

          <div className="bg-white rounded-[2.5rem] p-9 border border-slate-100 flex justify-between items-center shadow-sm hover:shadow-md transition-all">
            <div><p className="text-slate-400 text-[11px] font-black uppercase tracking-widest mb-2">Total Recaudado</p><h2 className="text-4xl font-black text-slate-700 tracking-tight">{formatMoney(totalRecaudado)}</h2></div>
            <div className="bg-slate-50 p-6 rounded-[2rem] text-slate-600 shadow-inner"><Wallet className="w-10 h-10" /></div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-end mb-12 gap-8">
          <div>
            <h2 className="text-4xl font-black text-slate-900 tracking-tight mb-6">Préstamos Activos</h2>
            <div className="bg-white p-2 rounded-[1.75rem] border border-slate-100 flex shadow-sm inline-flex">
              <button onClick={() => setActiveTab('activos')} className={`px-12 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all ${activeTab === 'activos' ? 'bg-slate-900 text-white shadow-2xl' : 'text-slate-400 hover:text-slate-600'}`}>Activos</button>
              <button onClick={() => setActiveTab('historial')} className={`px-12 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all ${activeTab === 'historial' ? 'bg-slate-900 text-white shadow-2xl' : 'text-slate-400 hover:text-slate-600'}`}>Finalizados</button>
            </div>
          </div>
          <button onClick={() => setShowNewLoanModal(true)} className="bg-slate-900 text-white px-12 py-6 rounded-[2rem] font-black uppercase text-[13px] tracking-[0.2em] shadow-2xl hover:scale-[1.03] active:scale-95 transition-all flex items-center gap-4"><Plus className="w-6 h-6 border-2 rounded-full p-0.5" /> Nuevo Préstamo</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
          {loans.filter(l => activeTab === 'activos' ? l.status === 'ACTIVO' : (l.status === 'PAGADO' || l.status === 'RENOVADO')).map((l) => (
            <div key={l.id} className="bg-white rounded-[3.5rem] border border-slate-100 p-10 shadow-sm hover:shadow-2xl transition-all relative overflow-hidden group">
              <div className="flex justify-between items-start mb-8">
                <div className="max-w-[70%]">
                  <h3 className="font-black text-3xl text-slate-900 leading-tight mb-2 truncate">{l.client}</h3>
                  <p className="text-[12px] text-slate-400 font-bold uppercase flex items-center tracking-widest"><Calendar className="w-4 h-4 mr-2 text-blue-500" /> {l.date}</p>
                </div>
                <span className={`text-[10px] font-black px-5 py-2.5 rounded-full border uppercase tracking-widest shadow-sm ${l.status === 'ACTIVO' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>{l.status}</span>
              </div>
              
              <div className="mb-10 bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100 shadow-inner">
                <div className="flex justify-between text-[12px] font-black uppercase mb-4 text-slate-500 tracking-widest"><span>Progreso de Pago</span><span>{l.progress || 0}%</span></div>
                <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden shadow-sm"><div className={`h-full transition-all duration-1000 ${l.status === 'ACTIVO' ? 'bg-blue-600' : 'bg-emerald-500'}`} style={{ width: `${l.progress || 0}%` }}></div></div>
              </div>

              <div className="flex justify-between mb-12 px-2">
                <div><p className="text-slate-400 text-[11px] font-black uppercase tracking-widest mb-3">Monto Total</p><h4 className="font-black text-slate-700 text-2xl tracking-tighter">{formatMoney(l.debt)}</h4></div>
                <div className="text-right"><p className="text-slate-400 text-[11px] font-black uppercase tracking-widest mb-3">Resta Actual</p><h4 className={`font-black text-4xl tracking-tighter ${l.status === 'ACTIVO' ? 'text-blue-600' : 'text-slate-400'}`}>{formatMoney(l.remaining)}</h4></div>
              </div>

              {/* BOTONES DE ACCIÓN (ESTILO image_6d84fb) */}
              <div className="flex items-center justify-between pt-8 border-t-2 border-slate-50">
                <button onClick={() => { setCurrentLoan(l); setPaymentAmount(''); setShowPaymentModal(true); }} className="flex items-center gap-3 font-black text-[12px] uppercase tracking-[0.2em] text-slate-900 hover:text-blue-600 transition-all">
                  <Wallet className="w-6 h-6" /> Abonar
                </button>
                
                <button onClick={() => { 
                  const schedule = calculateSchedule(l);
                  setCurrentLoan({...l, schedule});
                  setShowScheduleModal(true);
                }} className="flex items-center gap-3 font-black text-[12px] uppercase tracking-[0.2em] text-slate-500 hover:text-blue-500 transition-all">
                  <ListChecks className="w-6 h-6" /> Detalle
                </button>

                <button onClick={async () => { if(window.confirm("¿Borrar?")) await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'loans', l.id)); }} className="flex items-center gap-3 font-black text-[12px] uppercase tracking-[0.2em] text-slate-400 hover:text-red-500 transition-all">
                  <Trash2 className="w-6 h-6" /> Borrar
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* MODAL PLAN DE PAGOS (CALENDARIO) */}
      {showScheduleModal && currentLoan && (
        <div className="fixed inset-0 bg-slate-900/80 z-[200] flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white rounded-[4rem] w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-slate-900 p-12 text-white flex justify-between items-center border-b border-slate-800">
              <div><h2 className="text-3xl font-black uppercase tracking-widest mb-1">Calendario Sugerido</h2><p className="text-slate-400 font-bold">{currentLoan.client}</p></div>
              <button onClick={closeAllModals}><X className="w-8 h-8 text-slate-400" /></button>
            </div>
            <div className="p-12 overflow-y-auto bg-[#f8fafc]" id="receipt-printable-area">
              <div className="space-y-5">
                {(currentLoan.schedule || []).map((inst) => (
                  <div key={inst.num} className="bg-white p-8 rounded-[2rem] border border-slate-100 flex justify-between items-center shadow-sm">
                    <div className="flex items-center gap-6">
                      <div className="w-16 h-16 bg-slate-900 text-white rounded-[1.5rem] flex items-center justify-center font-black text-2xl">{inst.num}</div>
                      <div><p className="font-black text-slate-400 uppercase text-[11px] mb-1">Fecha de Cobro</p><p className="font-black text-slate-800 text-2xl">{inst.date}</p></div>
                    </div>
                    <div className="text-right"><p className="font-black text-slate-400 uppercase text-[11px] mb-1">Cuota</p><p className="font-black text-slate-900 text-3xl">{formatMoney(inst.amount)}</p></div>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-10 bg-white border-t flex gap-6">
              <button onClick={() => {
                let text = `📅 *CALENDARIO - PRESTAFÁCIL*%0A👤 *Cliente:* ${currentLoan.client}%0A---------------------------%0A`;
                currentLoan.schedule.forEach(s => { text += `🔹 Cuota ${s.num}: ${s.date} - ${formatMoney(s.amount)}%0A`; });
                window.open(`https://wa.me/1${currentLoan.phone?.replace(/\D/g, '')}?text=${text}`, '_blank');
              }} className="flex-1 bg-[#25D366] text-white py-7 rounded-[2.5rem] font-black uppercase text-[13px] flex justify-center items-center gap-4"><MessageCircle className="w-7 h-7" /> WhatsApp</button>
              <button onClick={() => window.print()} className="flex-1 bg-slate-100 py-7 rounded-[2.5rem] font-black flex items-center justify-center gap-4 text-slate-600 transition-all"><Printer className="w-7 h-7" /> Imprimir</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PAGO Y RECIBO */}
      {showPaymentModal && currentLoan && (
        <div className="fixed inset-0 bg-slate-900/60 z-[200] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[4.5rem] w-full max-w-md p-14 shadow-2xl text-center text-slate-900">
            <h3 className="font-black uppercase text-[12px] text-slate-400 tracking-[0.6em] mb-12">Registrar Cobro</h3>
            <p className="font-black text-5xl mb-4 tracking-tighter">{currentLoan.client}</p>
            <div className="bg-slate-50 p-12 rounded-[3rem] mb-12 border border-slate-100 shadow-inner"><p className="text-6xl font-black text-slate-900 tracking-tighter">{formatMoney(currentLoan.remaining)}</p><p className="text-[12px] font-black uppercase text-slate-400 mt-4 tracking-[0.3em]">Deuda Pendiente</p></div>
            <input type="number" step="any" required value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} className="w-full border-2 border-slate-100 p-12 rounded-[3rem] text-8xl font-black text-center outline-none border-blue-100 focus:border-blue-500 mb-12 bg-blue-50/20 text-blue-600 shadow-inner" placeholder="0.00" autoFocus/>
            <button onClick={handleProcessPayment} className="w-full bg-blue-600 text-white py-9 rounded-[2.5rem] font-black uppercase text-[14px] shadow-2xl hover:bg-blue-700 transition-all active:scale-95">Confirmar Abono</button>
            <button onClick={closeAllModals} className="mt-10 text-slate-400 font-black text-[12px] uppercase w-full py-4 hover:text-slate-600">Cancelar</button>
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
              <p className="font-black text-slate-900 text-3xl tracking-tight">{currentLoan?.client}</p>
              <p className="text-slate-400 text-[11px] font-black uppercase mt-3 tracking-[0.3em]">{new Date().toLocaleString()}</p>
              <div className="bg-[#f8fafc] p-8 rounded-[3rem] mt-16 border border-slate-100 flex justify-between items-center shadow-inner"><span className="text-[12px] font-black uppercase text-slate-400 tracking-widest">Saldo Restante</span><span className="font-black text-slate-800 text-2xl">{formatMoney(currentLoan?.remaining)}</span></div>
            </div>
            <div className="p-12 bg-[#f8fafc] space-y-5 border-t border-slate-100">
              <button onClick={() => {
                const text = `🧾 *RECIBO DE PAGO - PRESTAFÁCIL*%0A👤 *Cliente:* ${currentLoan.client}%0A💵 *Monto Pagado:* ${formatMoney(paymentAmount)}%0A📉 *Resta:* ${formatMoney(currentLoan.remaining)}%0A📅 *Fecha:* ${new Date().toLocaleDateString()}%0A✅ _¡Gracias!_`;
                window.open(`https://wa.me/1${currentLoan.phone?.replace(/\D/g, '')}?text=${text}`, '_blank');
              }} className="w-full bg-[#25D366] text-white py-7 rounded-[2.5rem] font-black uppercase text-[12px] tracking-[0.3em] flex justify-center items-center gap-5 shadow-xl shadow-emerald-100 hover:bg-[#128c7e] transition-all"><MessageCircle className="w-7 h-7" /> WhatsApp</button>
              <button onClick={() => window.print()} className="w-full bg-white border-2 border-slate-200 text-slate-600 py-5 rounded-[2.5rem] font-black uppercase text-[12px] flex items-center justify-center gap-4 hover:bg-slate-50 transition-all"><Printer className="w-6 h-6" /> Imprimir</button>
              <button onClick={closeAllModals} className="w-full bg-slate-900 text-white py-6 rounded-[2.5rem] font-black uppercase text-[12px] mt-4">Terminar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODALES TÉCNICOS (RESTORE / CASH) */}
      {showMigrationModal && (
        <div className="fixed inset-0 bg-slate-900/80 z-[200] flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white rounded-[4rem] w-full max-w-3xl shadow-2xl p-14">
            <h2 className="text-3xl font-black uppercase tracking-widest text-slate-900 mb-10">Restauración de Sistema</h2>
            <textarea value={migrationText} onChange={(e) => setMigrationText(e.target.value)} className="w-full h-[500px] border-2 p-10 rounded-[3rem] bg-[#f8fafc] font-mono text-[11px] mb-12 outline-none focus:border-blue-500 shadow-inner" placeholder='Pega tu JSON aquí...'></textarea>
            <div className="grid grid-cols-2 gap-8">
                <button onClick={() => handleMigrateData(true)} className="bg-red-50 text-red-600 border-2 border-red-100 py-8 rounded-[3rem] font-black uppercase text-[12px] hover:bg-red-100 transition-all shadow-sm"><Trash className="w-5 h-5 mx-auto mb-2" /> Borrar y Restaurar Todo</button>
                <button onClick={() => handleMigrateData(false)} className="bg-slate-900 text-white py-8 rounded-[3rem] font-black uppercase text-[12px] hover:bg-black transition-all shadow-2xl shadow-slate-200"><Cloud className="w-5 h-5 mx-auto mb-2" /> Solo Importar Nuevos</button>
            </div>
          </div>
        </div>
      )}

      {showCashModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-[200] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[4rem] w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="bg-slate-900 px-16 py-12 flex justify-between text-white font-black uppercase tracking-[0.5em] text-[13px] items-center"><h3>Gestión de Capital Real</h3><button onClick={closeAllModals} className="hover:rotate-90 transition-all p-2"><X className="w-8 h-8 text-slate-400" /></button></div>
            <div className="p-16 bg-[#f8fafc] flex-1 overflow-y-auto">
              <form onSubmit={async (e) => {
                e.preventDefault();
                await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'transactions'), { ...cashForm, amount: Number(cashForm.amount), date: new Date().toISOString() });
                setCashForm({ type: 'INYECCION', amount: '', concept: '' });
                setSystemMessage("✅ Caja actualizada");
              }} className="bg-white p-12 rounded-[3.5rem] border border-slate-100 mb-12 shadow-sm">
                <div className="grid grid-cols-2 gap-10 mb-10 text-slate-900">
                  <div className="col-span-1"><label className="block font-black text-[11px] uppercase text-slate-400 mb-5 ml-2 tracking-widest">Tipo</label><select value={cashForm.type} onChange={(e) => setCashForm({...cashForm, type: e.target.value})} className="w-full border-2 border-slate-50 p-6 rounded-[2rem] font-black bg-[#f8fafc] outline-none focus:border-blue-400 transition-all cursor-pointer"><option value="INYECCION">Inyección (+)</option><option value="RETIRO">Retiro (-)</option></select></div>
                  <div className="col-span-1"><label className="block font-black text-[11px] uppercase text-slate-400 mb-5 ml-2 tracking-widest">Monto ($)</label><input type="number" step="any" placeholder="0.00" required value={cashForm.amount} onChange={(e) => setCashForm({...cashForm, amount: e.target.value})} className="w-full border-2 border-slate-50 p-6 rounded-[2rem] font-black text-4xl bg-[#f8fafc] outline-none focus:border-blue-400 transition-all shadow-inner text-blue-600"/></div>
                  <div className="col-span-2"><label className="block font-black text-[11px] uppercase text-slate-400 mb-5 ml-2 tracking-widest">Concepto / Motivo</label><input type="text" placeholder="Motivo del movimiento..." required value={cashForm.concept} onChange={(e) => setCashForm({...cashForm, concept: e.target.value})} className="w-full border-2 border-slate-50 p-6 rounded-[2rem] font-bold bg-[#f8fafc] shadow-inner text-slate-700"/></div>
                </div>
                <button type="submit" className="w-full py-8 rounded-[3rem] text-white font-black uppercase text-[14px] tracking-[0.5em] bg-slate-900 hover:bg-black transition-all shadow-2xl active:scale-95 shadow-slate-200">Aplicar Ajuste en Caja</button>
              </form>
              <div className="bg-white rounded-[3.5rem] border border-slate-100 overflow-hidden shadow-sm">
                <div className="p-12 bg-slate-50 border-b font-black text-[13px] uppercase text-slate-500 tracking-[0.4em]">Historial de Caja</div>
                <div className="divide-y divide-slate-100">
                  {(transactions || []).map(t => (
                    <div key={t.id} className="p-12 flex justify-between items-center hover:bg-slate-50 transition-colors group">
                      <div className="flex items-center gap-10">
                        <div className={`p-6 rounded-[2rem] transition-all shadow-md ${t.type === 'RETIRO' ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-500'}`}>{t.type === 'RETIRO' ? <ArrowUpRight className="w-8 h-8" /> : <ArrowDownRight className="w-8 h-8" />}</div>
                        <div><p className="font-black text-slate-900 text-2xl mb-1.5 tracking-tight">{t.concept || 'Movimiento'}</p><p className="text-[12px] font-black uppercase text-slate-400 tracking-widest">{new Date(t.date).toLocaleString()}</p></div>
                      </div>
                      <p className={`font-black text-3xl tracking-tighter ${t.type === 'RETIRO' ? 'text-red-500' : 'text-emerald-500'}`}>{t.type === 'RETIRO' ? '-' : '+'}{formatMoney(t.amount)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showNewLoanModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-[200] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[4.5rem] w-full max-w-2xl shadow-2xl p-14 max-h-[90vh] overflow-y-auto border border-slate-100">
            <h2 className="text-3xl font-black mb-14 border-b pb-8 flex justify-between items-center uppercase tracking-widest text-[14px] text-slate-900">Nuevo Desembolso <button onClick={closeAllModals} className="hover:rotate-90 transition-all"><X className="w-10 h-10 text-slate-300" /></button></h2>
            <form onSubmit={handleSaveNewLoan} className="space-y-10">
              <div><label className="block font-black text-[12px] uppercase text-slate-400 mb-4 ml-2 tracking-widest">Nombre del Cliente</label><input required value={newLoanForm.client} onChange={(e)=>setNewLoanForm({...newLoanForm, client: e.target.value})} className="w-full border-2 border-slate-50 p-8 rounded-[2.5rem] outline-none font-black text-2xl bg-[#f8fafc] focus:border-blue-500 shadow-inner" placeholder="Escriba nombre..."/></div>
              <div><label className="block font-black text-[12px] uppercase text-slate-400 mb-4 ml-2 tracking-widest">Teléfono</label><input type="text" required value={newLoanForm.phone} onChange={(e) => setNewLoanForm({...newLoanForm, phone: e.target.value})} className="w-full border-2 border-slate-50 p-8 rounded-[2.5rem] outline-none font-black text-xl bg-[#f8fafc] shadow-inner" placeholder="Ej: 8091234567"/></div>
              <div><label className="block font-black text-[12px] uppercase text-slate-400 mb-4 ml-2 tracking-widest">Capital a Entregar ($)</label><input type="number" required value={newLoanForm.capital} onChange={(e) => setNewLoanForm({...newLoanForm, capital: e.target.value})} className="w-full border-2 border-slate-50 p-10 rounded-[3rem] font-black text-6xl bg-[#f8fafc] text-slate-900 shadow-inner tracking-tighter"/></div>
              <div className="grid grid-cols-2 gap-10">
                <div><label className="block font-black text-[12px] uppercase text-slate-400 mb-4 ml-2 tracking-widest">Cuotas</label><input type="number" required value={newLoanForm.installments} onChange={(e) => setNewLoanForm({...newLoanForm, installments: e.target.value})} className="w-full border-2 border-slate-50 p-8 rounded-[2.5rem] font-black bg-[#f8fafc] shadow-inner text-center text-3xl"/></div>
                <div><label className="block font-black text-[12px] uppercase text-slate-400 mb-4 ml-2 tracking-widest">Frecuencia (Días)</label><select value={newLoanForm.freqDays} onChange={(e) => setNewLoanForm({...newLoanForm, freqDays: e.target.value})} className="w-full border-2 border-slate-50 p-8 rounded-[2.5rem] font-black bg-[#f8fafc] shadow-inner text-center text-xl"><option value="1">Diario</option><option value="7">Semanal</option><option value="15">Quincenal</option><option value="30">Mensual</option></select></div>
              </div>
              <div className="bg-slate-50 p-12 rounded-[4rem] border border-slate-100 text-center">
                <div className="flex gap-14 mb-8 justify-center font-black text-[12px] uppercase tracking-[0.4em]">
                  <label className="flex items-center gap-4 cursor-pointer"><input type="radio" className="w-6 h-6" checked={newLoanForm.calcMethod === 'interes'} onChange={() => setNewLoanForm({...newLoanForm, calcMethod: 'interes'})} /> % Interés</label>
                  <label className="flex items-center gap-4 cursor-pointer"><input type="radio" className="w-6 h-6" checked={newLoanForm.calcMethod === 'fija'} onChange={() => setNewLoanForm({...newLoanForm, calcMethod: 'fija'})} /> $ Cuota Fija</label>
                </div>
                {newLoanForm.calcMethod === 'interes' ? (
                  <input type="number" placeholder="Ej. 13 (%)" required value={newLoanForm.interestRate} onChange={(e) => setNewLoanForm({...newLoanForm, interestRate: e.target.value})} className="w-full border-2 border-slate-100 p-8 rounded-[2.5rem] font-black text-center text-4xl shadow-md text-blue-600"/>
                ) : (
                  <input type="number" placeholder="Cuota ($)" required value={newLoanForm.fixedQuota} onChange={(e) => setNewLoanForm({...newLoanForm, fixedQuota: e.target.value})} className="w-full border-2 border-slate-100 p-8 rounded-[2.5rem] font-black text-center text-4xl shadow-md text-blue-600"/>
                )}
              </div>
              <button type="submit" className="w-full bg-blue-600 text-white py-10 rounded-[3.5rem] font-black uppercase text-[16px] tracking-[0.5em] shadow-2xl hover:bg-blue-700 active:scale-95 transition-all">Autorizar Préstamo</button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}