import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../App';
import io from 'socket.io-client';
import { QrCode, UtensilsCrossed, LayoutDashboard, Settings, LogOut, Clock, Truck, Users, Activity, TrendingUp, DollarSign, Menu, Bell, Search, PlusCircle, CheckCircle2, ChevronRight } from 'lucide-react';
import QRCode from 'react-qr-code';
import { motion, AnimatePresence } from 'framer-motion';

let socket: any;

export default function AdminPanel() {
  const { user } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  const [orders, setOrders] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [waStatus, setWaStatus] = useState(user?.whatsapp_status);
  const [waQr, setWaQr] = useState('');
  
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [activeChatJid, setActiveChatJid] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  // Form states
  const [newCat, setNewCat] = useState('');
  const [newProd, setNewProd] = useState({ name: '', price: '', category_id: '', description: '', extras: [] as any[] });
  const [tempExtraName, setTempExtraName] = useState('');
  const [tempExtraPrice, setTempExtraPrice] = useState('');
  
  const token = localStorage.getItem('token');
  const headers = { 'Authorization': `Bearer ${token}` };

  useEffect(() => {
    if(!user?.id) return;
    socket = io();
    socket.emit('join', user.tenant_id);
    socket.on('new_order', (o:any) => setOrders(prev => [o, ...prev]));
    socket.on('qr_code', (qr:any) => setWaQr(qr));
    socket.on('whatsapp_status', (st:any) => { setWaStatus(st); if(st==='CONNECTED') setWaQr(''); });
    socket.on('chat:new_message', (msg:any) => {
        setChatMessages(prev => [...prev, msg].sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));
    });

    fetchData();
  }, [user]);

  const fetchData = async () => {
    fetch('/api/orders', {headers}).then(r=>r.json()).then(setOrders);
    fetch('/api/categories', {headers}).then(r=>r.json()).then(setCategories);
    fetch('/api/products', {headers}).then(r=>r.json()).then(setProducts);
    fetch('/api/chats', {headers}).then(r=>r.json()).then(setCustomers);
  };

  const loadChat = async (customer: any) => {
    setActiveChatJid(customer.whatsapp_jid || '');
    setChatLoading(true);
    const msgs = await fetch(`/api/chats/${customer.id}/messages`, {headers}).then(r=>r.json());
    if (Array.isArray(msgs)) setChatMessages(msgs);
    setChatLoading(false);
  };

  const sendMessage = async (e:any) => {
     e.preventDefault();
     if(!chatInput.trim() || !activeChatJid) return;
     const text = chatInput;
     setChatInput('');
     // Optimistic update
     setChatMessages(prev => [...prev, { content: text, from_me: true, created_at: new Date().toISOString() }]);
     await fetch('/api/chat/send', { method: 'POST', headers: { ...headers, 'Content-Type':'application/json' }, body: JSON.stringify({ jid: activeChatJid, text }) });
  };

  const updateOrderStatus = async (id: string, status: string) => {
    await fetch(`/api/orders/${id}/status`, {
      method: 'PUT', headers: { ...headers, 'Content-Type':'application/json' },
      body: JSON.stringify({ status })
    });
    fetchData();
  };

  const addCategory = async (e:any) => {
    e.preventDefault();
    await fetch('/api/categories', { method: 'POST', headers: { ...headers, 'Content-Type':'application/json' }, body: JSON.stringify({ name: newCat }) });
    setNewCat('');
    fetchData();
  };

  const addProduct = async (e:any) => {
    e.preventDefault();
    const res = await fetch('/api/products', { method: 'POST', headers: { ...headers, 'Content-Type':'application/json' }, body: JSON.stringify(newProd) });
    const data = await res.json();
    setProducts([...products, data]);
    setNewProd({ name: '', price: '', category_id: '', description: '', extras: [] });
  };

  const [waLoading, setWaLoading] = useState(false);

  const connectWA = async () => {
    setWaLoading(true);
    setWaQr(''); // clear old QR
    try {
      await fetch('/api/whatsapp/connect', { method: 'POST', headers });
      
      // Fallback: poll for QR in case WebSockets are blocked by proxy
      const pollQR = setInterval(async () => {
        try {
          const res = await fetch('/api/whatsapp/qr', { headers });
          const data = await res.json();
          if (data.qr) {
            setWaQr(data.qr);
            setWaLoading(false);
            clearInterval(pollQR);
          }
        } catch(e) {}
      }, 3000);

      // Stop polling after 60s
      setTimeout(() => clearInterval(pollQR), 60000);
    } catch(err) {
      console.error(err);
      setWaLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    window.location.href = '/login';
  };

  // KPIs
  const todayOrders = orders.filter(o => new Date(o.created_at).toDateString() === new Date().toDateString());
  const todayRevenue = todayOrders.reduce((acc, o) => acc + o.total, 0);
  const pendingOrdersCount = orders.filter(o => o.status === 'PENDING').length;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans text-slate-800">
      
      {/* Sidebar Luxuosa */}
      <div className="w-full md:w-72 bg-slate-900 border-r border-slate-800 shadow-2xl flex flex-col z-20 transition-all text-slate-300">
        <div className="p-6 border-b border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-lg shadow-orange-500/30">🍔</div>
          <div>
            <h1 className="font-extrabold text-xl text-white tracking-tight">PitDog Pro</h1>
            <span className="text-xs font-semibold text-orange-400 uppercase tracking-wider">Dashboard Premium</span>
          </div>
        </div>
        <nav className="p-4 flex-1 space-y-1 overflow-y-auto">
          <p className="px-4 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 mt-4">Menu Principal</p>
          
          <button onClick={()=>setActiveTab('dashboard')} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-medium transition-all ${activeTab==='dashboard'?'bg-orange-500 text-white shadow-md shadow-orange-500/20': 'hover:bg-slate-800 hover:text-white'}`}>
            <LayoutDashboard size={20}/> Dashboard
          </button>
          
          <button onClick={()=>setActiveTab('orders')} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-medium transition-all relative ${activeTab==='orders'?'bg-orange-500 text-white shadow-md shadow-orange-500/20': 'hover:bg-slate-800 hover:text-white'}`}>
            <Clock size={20}/> Central de Pedidos
            {pendingOrdersCount > 0 && <span className="absolute right-4 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-bounce">{pendingOrdersCount}</span>}
          </button>
          
          <button onClick={()=>setActiveTab('menu')} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-medium transition-all ${activeTab==='menu'?'bg-orange-500 text-white shadow-md shadow-orange-500/20': 'hover:bg-slate-800 hover:text-white'}`}>
            <UtensilsCrossed size={20}/> Lanches & Cardápio
          </button>

          <button onClick={()=>setActiveTab('crm')} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-medium transition-all ${activeTab==='crm'?'bg-orange-500 text-white shadow-md shadow-orange-500/20': 'hover:bg-slate-800 hover:text-white'}`}>
            <Users size={20}/> Clientes (CRM)
          </button>
          
          <button onClick={()=>setActiveTab('drivers')} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-medium transition-all ${activeTab==='drivers'?'bg-orange-500 text-white shadow-md shadow-orange-500/20': 'hover:bg-slate-800 hover:text-white'}`}>
            <Truck size={20}/> Rede Entrega (Uber)
          </button>

          <p className="px-4 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 mt-8">Sistema</p>
          
          <button onClick={()=>setActiveTab('settings')} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-medium transition-all ${activeTab==='settings'?'bg-orange-500 text-white shadow-md shadow-orange-500/20': 'hover:bg-slate-800 hover:text-white'}`}>
            <Settings size={20}/> Integrações (WhatsApp)
          </button>
        </nav>
        
        <div className="p-6 border-t border-slate-800">
          <div className="flex items-center gap-3 mb-6 bg-slate-800 p-3 rounded-2xl">
            <div className={`w-3 h-3 rounded-full ${waStatus==='CONNECTED'?'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse':'bg-red-500'}`}></div>
            <span className="text-sm font-semibold text-white">{waStatus==='CONNECTED'?'Bot Online':'Bot Offline'}</span>
          </div>
          <button onClick={logout} className="w-full flex items-center justify-center gap-2 px-4 py-3 text-red-400 font-bold hover:bg-slate-800 rounded-xl transition-colors">
            <LogOut size={18}/> Sair do Sistema
          </button>
        </div>
      </div>

      {/* Conteúdo Principal */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-50">
        
        {/* Header Superior Topo */}
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8 shadow-sm shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-black text-slate-800 capitalize tracking-tight flex items-center gap-3">
              {activeTab === 'dashboard' && <><Activity className="text-orange-500"/> Visão Geral</>}
              {activeTab === 'orders' && <><Clock className="text-orange-500"/> Controle de Cozinha</>}
              {activeTab === 'menu' && <><UtensilsCrossed className="text-orange-500"/> Gestão de Cardápio</>}
              {activeTab === 'crm' && <><Users className="text-orange-500"/> Meus Clientes</>}
              {activeTab === 'drivers' && <><Truck className="text-orange-500"/> Gestão de Frota</>}
              {activeTab === 'settings' && <><Settings className="text-orange-500"/> Aparelho e Configurações</>}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="bg-slate-100 p-2.5 rounded-full cursor-pointer hover:bg-slate-200 transition relative">
              <Bell size={20} className="text-slate-600"/>
              {pendingOrdersCount > 0 && <div className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-white"></div>}
            </div>
            <div className="h-10 w-10 bg-gradient-to-r from-orange-400 to-orange-500 rounded-full border-2 border-white shadow-md"></div>
          </div>
        </header>

        {/* Área Scrollável */}
        <main className="flex-1 overflow-y-auto p-8 hide-scrollbar">
          <AnimatePresence mode="wait">
            <motion.div key={activeTab} initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} exit={{opacity:0, y:-20}} transition={{duration:0.2}}>
              
              {/* === DASHBOARD === */}
              {activeTab === 'dashboard' && (
                <div className="space-y-8">
                  {/* Cards KPIs */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between relative overflow-hidden group hover:shadow-md transition-shadow">
                      <div className="absolute -right-6 -top-6 bg-green-50 w-24 h-24 rounded-full group-hover:scale-150 transition-transform duration-500"></div>
                      <div className="relative z-10">
                        <p className="text-slate-500 font-semibold mb-1">Faturamento Hoje</p>
                        <h3 className="text-3xl font-black text-slate-800">R$ {todayRevenue.toFixed(2)}</h3>
                      </div>
                      <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center text-green-600 relative z-10"><DollarSign size={28}/></div>
                    </div>
                    
                    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between relative overflow-hidden group hover:shadow-md transition-shadow">
                      <div className="absolute -right-6 -top-6 bg-orange-50 w-24 h-24 rounded-full group-hover:scale-150 transition-transform duration-500"></div>
                      <div className="relative z-10">
                        <p className="text-slate-500 font-semibold mb-1">Pedidos Hoje</p>
                        <h3 className="text-3xl font-black text-slate-800">{todayOrders.length} lanches</h3>
                      </div>
                      <div className="w-14 h-14 bg-orange-100 rounded-2xl flex items-center justify-center text-orange-600 relative z-10"><TrendingUp size={28}/></div>
                    </div>

                    <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 rounded-3xl shadow-lg border border-slate-700 flex items-center justify-between text-white relative overflow-hidden">
                      <div className="absolute right-0 bottom-0 opacity-10"><UtensilsCrossed size={120}/></div>
                      <div className="relative z-10">
                        <p className="text-slate-400 font-medium mb-1">Cardápio Online</p>
                        <h3 className="text-xl font-bold">{products.length} Produtos Ativos</h3>
                        <a href={`/catalogo/${user?.slug}`} target="_blank" className="inline-flex mt-3 items-center text-orange-400 text-sm font-bold hover:text-orange-300">Ver meu portal <ChevronRight size={16}/></a>
                      </div>
                    </div>
                  </div>

                  {/* Gráfico Fake / Atividade Recente */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
                       <div className="flex justify-between items-center mb-6">
                         <h3 className="font-bold text-lg text-slate-800">Fluxo da Semana</h3>
                         <select className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-semibold outline-none focus:border-orange-500"><option>Últimos 7 dias</option></select>
                       </div>
                       <div className="h-64 flex items-end gap-2 w-full">
                         {/* Barras decorativas do dashboard para visual premium */}
                         {[30, 50, 40, 70, 90, 60, 100].map((h, i) => (
                           <div key={i} className="flex-1 bg-orange-100 rounded-t-xl group relative">
                             <div className="absolute bottom-0 w-full bg-gradient-to-t from-orange-500 to-orange-400 rounded-t-xl transition-all duration-500 group-hover:bg-orange-600" style={{height:`${h}%`}}></div>
                           </div>
                         ))}
                       </div>
                    </div>
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 overflow-hidden">
                       <h3 className="font-bold text-lg text-slate-800 mb-6">Pedidos Recentes</h3>
                       <div className="space-y-4">
                         {orders.slice(0, 4).map(o => (
                           <div key={o.id} className="flex items-center gap-4">
                             <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center font-bold text-slate-600">#{o.id.slice(-3)}</div>
                             <div>
                               <p className="font-bold text-slate-800">{o.customer?.name || 'Cliente'}</p>
                               <p className="text-xs text-slate-500 font-medium">{new Date(o.created_at).toLocaleTimeString()}</p>
                             </div>
                             <div className="ml-auto font-bold text-green-600">
                               R$ {o.total.toFixed(2)}
                             </div>
                           </div>
                         ))}
                         {orders.length === 0 && <p className="text-slate-500 text-sm italic text-center mt-10">Nenhum pedido ainda.</p>}
                       </div>
                    </div>
                  </div>
                </div>
              )}

              {/* === CENTRAL DE PEDIDOS (KANBAN) === */}
              {activeTab === 'orders' && (
                <div className="h-full">
                  <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 mb-6">
                    <p className="text-slate-500 font-medium">Os pedidos caem aqui em tempo real pelo WhatsApp ou pelo seu Link. Mova-os pelas colunas para notificar o celular do cliente.</p>
                  </div>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-280px)] min-h-[500px]">
                    {/* Coluna 1 PENDING */}
                    <div className="bg-slate-100/50 rounded-3xl p-5 border border-slate-200/60 flex flex-col">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></span> Aguardando Aceitação
                        </h3>
                        <span className="bg-slate-200 text-slate-600 px-3 py-1 rounded-full text-xs font-bold">{orders.filter(o=>o.status==='PENDING').length}</span>
                      </div>
                      <div className="space-y-4 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                        <AnimatePresence>
                          {orders.filter(o=>o.status==='PENDING').map(o => (
                            <motion.div initial={{opacity:0, scale:0.95}} animate={{opacity:1, scale:1}} exit={{opacity:0, scale:0.9}} key={o.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group">
                              <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
                              <div className="flex justify-between items-start mb-2">
                                <span className="font-extrabold text-slate-800">#{o.id.slice(-4)}</span>
                                <span className="text-sm font-black text-green-600 bg-green-50 px-2.5 py-1 rounded-lg">R$ {o.total.toFixed(2)}</span>
                              </div>
                              <p className="font-bold text-slate-700 flex items-center gap-1.5"><Users size={14} className="text-slate-400"/> {o.customer?.name}</p>
                              <div className="mt-3 space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-100">
                                {o.items.map((it:any) => <div key={it.id} className="text-sm text-slate-700 font-medium"><b>{it.quantity}x</b> {it.product?.name}</div>)}
                              </div>
                              <button onClick={()=>updateOrderStatus(o.id, 'PREPARING')} className="w-full mt-4 bg-red-500 text-white font-bold py-3 rounded-xl hover:bg-red-600 transition-colors shadow-md shadow-red-500/20">
                                Aceitar & Preparar
                              </button>
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </div>
                    </div>

                    {/* Coluna 2 PREPARING */}
                    <div className="bg-slate-100/50 rounded-3xl p-5 border border-slate-200/60 flex flex-col">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full bg-blue-500"></span> Na Chapa / Preparando
                        </h3>
                        <span className="bg-slate-200 text-slate-600 px-3 py-1 rounded-full text-xs font-bold">{orders.filter(o=>o.status==='PREPARING').length}</span>
                      </div>
                      <div className="space-y-4 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                         <AnimatePresence>
                          {orders.filter(o=>o.status==='PREPARING').map(o => (
                            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} key={o.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden">
                              <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                              <div className="flex justify-between items-start mb-2">
                                <span className="font-extrabold text-slate-800">#{o.id.slice(-4)}</span>
                              </div>
                              <p className="font-bold text-slate-700">{o.customer?.name}</p>
                              <p className="text-xs text-slate-500 mt-1">End: {o.delivery_address}</p>
                              <button onClick={()=>updateOrderStatus(o.id, 'DELIVERED')} className="w-full mt-4 bg-blue-500 text-white font-bold py-3 rounded-xl hover:bg-blue-600 transition-colors shadow-md shadow-blue-500/20 flex items-center justify-center gap-2">
                                <Truck size={18}/> Saiu para Entrega
                              </button>
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </div>
                    </div>

                    {/* Coluna 3 DELIVERED */}
                     <div className="bg-green-50/50 rounded-3xl p-5 border border-green-100/60 flex flex-col">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-green-800 flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full bg-green-500"></span> Entregues / Finalizados
                        </h3>
                      </div>
                      <div className="space-y-4 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                         <AnimatePresence>
                          {orders.filter(o=>o.status==='DELIVERED').map(o => (
                            <motion.div initial={{opacity:0}} animate={{opacity:1}} key={o.id} className="bg-white p-4 rounded-2xl shadow-sm border border-green-100 relative overflow-hidden opacity-60 hover:opacity-100 transition-opacity">
                              <div className="flex justify-between items-center">
                                <span className="font-bold text-slate-500 line-through">#{o.id.slice(-4)}</span>
                                <CheckCircle2 className="text-green-500" size={20}/>
                              </div>
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* === CARDÁPIO === */}
              {activeTab === 'menu' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Formulários */}
                  <div className="space-y-6">
                    <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="bg-orange-100 p-2 rounded-xl text-orange-600"><Menu size={24}/></div>
                        <h3 className="font-extrabold text-xl text-slate-800">Nova Categoria</h3>
                      </div>
                      <form onSubmit={addCategory} className="flex gap-3">
                        <input required placeholder="Ex: Bebidas" value={newCat} onChange={e=>setNewCat(e.target.value)} className="flex-1 p-4 rounded-2xl bg-slate-50 border border-slate-200 outline-none focus:border-orange-500 focus:bg-white transition-all font-medium text-slate-700" />
                        <button className="bg-slate-900 text-white font-bold px-6 rounded-2xl hover:bg-slate-800 transition-colors shadow-lg"><PlusCircle/></button>
                      </form>
                    </div>

                    <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="bg-orange-100 p-2 rounded-xl text-orange-600"><UtensilsCrossed size={24}/></div>
                        <h3 className="font-extrabold text-xl text-slate-800">Novo Lanche</h3>
                      </div>
                      <form onSubmit={addProduct} className="space-y-5">
                        <input required placeholder="Nome do Sanduíche. Ex: X-Tudo" value={newProd.name} onChange={e=>setNewProd({...newProd, name: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 outline-none focus:border-orange-500 focus:bg-white transition-all font-medium text-slate-700" />
                        
                        <div className="flex gap-4">
                          <div className="relative w-1/2">
                            <span className="absolute left-4 top-4 font-bold text-slate-400">R$</span>
                            <input required type="number" step="0.01" placeholder="0.00" value={newProd.price} onChange={e=>setNewProd({...newProd, price: e.target.value})} className="w-full p-4 pl-12 rounded-2xl bg-slate-50 border border-slate-200 outline-none focus:border-orange-500 focus:bg-white transition-all font-bold text-slate-700" />
                          </div>
                          <select required value={newProd.category_id} onChange={e=>setNewProd({...newProd, category_id: e.target.value})} className="w-1/2 p-4 rounded-2xl bg-slate-50 border border-slate-200 outline-none focus:border-orange-500 focus:bg-white transition-all font-medium text-slate-700 appearance-none">
                            <option value="">Categoria...</option>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </div>
                        
                        <textarea placeholder="Ingredientes e descrição deliciosa..." value={newProd.description} onChange={e=>setNewProd({...newProd, description: e.target.value})} className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 outline-none focus:border-orange-500 focus:bg-white transition-all font-medium text-slate-700 h-24 resize-none" />
                        
                        <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4">
                           <p className="text-sm font-bold text-slate-600 mb-3">Oferecer Adicionais (Bacon, Cheddar...) no Robô</p>
                           <div className="flex gap-2">
                              <input type="text" placeholder="Nome" value={tempExtraName} onChange={e=>setTempExtraName(e.target.value)} className="flex-1 p-2 border border-slate-200 rounded-lg text-sm" />
                              <input type="number" placeholder="R$ 0.00" value={tempExtraPrice} onChange={e=>setTempExtraPrice(e.target.value)} className="w-24 p-2 border border-slate-200 rounded-lg text-sm" />
                              <button type="button" onClick={()=>{
                                if(tempExtraName && tempExtraPrice) {
                                   setNewProd({...newProd, extras: [...newProd.extras, {name: tempExtraName, price: tempExtraPrice}]});
                                   setTempExtraName(''); setTempExtraPrice('');
                                }
                              }} className="bg-green-500 text-white font-bold px-3 border border-slate-200 rounded-lg hover:bg-green-600 text-sm">Add</button>
                           </div>
                           {newProd.extras.length > 0 && <div className="flex flex-wrap gap-2 mt-3">
                              {newProd.extras.map((ex:any, i:number)=>(
                                 <span key={i} className="bg-white border border-slate-200 text-xs font-bold text-slate-700 px-2 py-1 rounded-md flex items-center gap-1">
                                   {ex.name} (+R$ {parseFloat(ex.price).toFixed(2)}) 
                                   <span className="text-red-500 cursor-pointer p-0.5 hover:bg-red-50 rounded" onClick={()=>setNewProd({...newProd, extras: newProd.extras.filter((_, idx)=>idx!==i)})}>x</span>
                                 </span>
                              ))}
                           </div>}
                        </div>

                        <button className="w-full bg-orange-500 text-white font-black text-lg py-4 rounded-2xl shadow-lg shadow-orange-500/30 hover:bg-orange-600 transition-colors">
                          Colocar à Venda!
                        </button>
                      </form>
                    </div>
                  </div>
                  
                  {/* Preview do Cardápio ao lado */}
                  <div className="lg:col-span-2 space-y-6">
                    <h3 className="font-extrabold text-2xl text-slate-800">Seus Lanches</h3>
                    {categories.map(c => (
                      <div key={c.id} className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm">
                        <h4 className="text-xl font-bold text-orange-500 mb-6 border-b border-slate-100 pb-3">{c.name}</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {products.filter(p=>p.category_id === c.id).map(p => (
                            <div key={p.id} className="flex flex-col bg-slate-50 p-5 rounded-2xl border border-slate-200 group hover:border-orange-300 transition-colors">
                               <div className="flex justify-between items-start mb-2">
                                 <h5 className="font-bold text-slate-800 text-lg">{p.name}</h5>
                                 <span className="bg-green-100 text-green-700 font-bold px-3 py-1 rounded-lg">R$ {p.price.toFixed(2)}</span>
                               </div>
                               <p className="text-sm text-slate-500 font-medium leading-relaxed">{p.description}</p>
                            </div>
                          ))}
                          {products.filter(p=>p.category_id === c.id).length === 0 && <span className="text-slate-400 italic">Nenhum produto cadastrado aqui.</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* === CRM CLIENTES === */}
              {activeTab === 'crm' && (
                <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm">
                   <div className="flex justify-between items-center mb-8 border-b border-slate-100 pb-6">
                     <div>
                       <h3 className="text-2xl font-extrabold text-slate-800">Meus Clientes Fiéis</h3>
                       <p className="text-slate-500 font-medium">Bater banco de dados do WhatsApp</p>
                     </div>
                     <div className="relative">
                       <Search className="absolute left-4 top-4 text-slate-400" size={20}/>
                       <input type="text" placeholder="Buscar por número..." className="pl-12 pr-4 py-3 bg-slate-50 rounded-2xl border border-slate-200 w-64 outline-none focus:border-orange-500 font-medium" />
                     </div>
                   </div>
                   
                   <div className="overflow-x-auto">
                     <table className="w-full text-left">
                       <thead>
                         <tr className="text-slate-400 font-bold text-sm uppercase tracking-wider border-b border-slate-100">
                           <th className="pb-4 pl-4">Cliente / Número</th>
                           <th className="pb-4">Qtd Pedidos</th>
                           <th className="pb-4">Total Gasto</th>
                           <th className="pb-4">Ação</th>
                         </tr>
                       </thead>
                       <tbody className="text-slate-700 font-medium">
                         {customers.map((c, i) => (
                           <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                             <td className="py-5 pl-4 flex items-center gap-4">
                               <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-full flex justify-center items-center font-bold">{c.name.charAt(0)}</div>
                               <div>
                                 <p className="font-bold text-slate-800">{c.name}</p>
                                 <p className="text-xs text-slate-500">{c.phone}</p>
                               </div>
                             </td>
                             <td className="py-5 font-bold text-slate-500">{c.orders?.length || 0} pdds</td>
                             <td className="py-5 text-green-600 font-bold">R$ {(c.total_spent || 0).toFixed(2)}</td>
                             <td className="py-5"><button onClick={() => loadChat(c)} className="text-orange-500 font-bold hover:underline">Conversar Live</button></td>
                           </tr>
                         ))}
                       </tbody>
                     </table>
                   </div>
                   
                   {/* Chat Modal / Area Overlay */}
                   {activeChatJid && (
                     <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex justify-end">
                       <div className="w-[500px] h-full bg-white shadow-2xl flex flex-col">
                         <div className="p-6 bg-slate-800 text-white flex justify-between items-center shadow-md z-10">
                           <div className="flex items-center gap-3">
                             <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center font-bold text-xl"><Users/></div>
                             <div>
                               <h4 className="font-extrabold text-lg leading-tight">Chat Ao Vivo</h4>
                               <p className="text-green-400 text-xs font-bold truncate w-48">{activeChatJid}</p>
                             </div>
                           </div>
                           <button onClick={()=>setActiveChatJid('')} className="bg-white/10 hover:bg-white/20 p-2 rounded-xl transition text-white font-bold">&times;</button>
                         </div>
                         
                         <div className="flex-1 bg-slate-50 overflow-y-auto p-4 space-y-4 flex flex-col">
                           {chatLoading ? (
                             <div className="m-auto text-slate-400 font-bold animate-pulse">Carregando mensagens...</div>
                           ) : (
                             chatMessages.map((m, i) => (
                               <div key={i} className={`max-w-[80%] p-3 rounded-2xl text-sm font-medium ${m.from_me ? 'bg-orange-500 text-white self-end rounded-br-none shadow-md shadow-orange-500/20' : 'bg-white border border-slate-200 text-slate-700 self-start rounded-bl-none shadow-sm'}`}>
                                 {m.content}
                                 <span className="block text-[10px] mt-1 opacity-70 w-full text-right">{new Date(m.created_at).toLocaleTimeString().slice(0,5)}</span>
                               </div>
                             ))
                           )}
                         </div>

                         <div className="p-4 bg-white border-t border-slate-100">
                           <form onSubmit={sendMessage} className="flex gap-2">
                             <input value={chatInput} onChange={e=>setChatInput(e.target.value)} type="text" placeholder="Digite uma mensagem..." className="flex-1 p-4 bg-slate-50 rounded-2xl border border-slate-200 outline-none focus:border-orange-500 font-medium transition" />
                             <button type="submit" className="w-14 h-14 bg-orange-500 rounded-2xl text-white font-bold flex shrink-0 items-center justify-center hover:bg-orange-600 transition shadow-lg shadow-orange-500/30">
                               Enviar
                             </button>
                           </form>
                         </div>
                       </div>
                     </div>
                   )}                   

                </div>
              )}

              {/* === FROTA / MOTOBOYS === */}
              {activeTab === 'drivers' && (
                <div className="space-y-8 animate-in fade-in duration-500 max-w-4xl">
                   <div className="bg-gradient-to-br from-indigo-600 to-blue-700 p-10 rounded-[40px] text-white shadow-2xl relative overflow-hidden">
                      <Truck className="absolute -right-10 -bottom-10 opacity-10 scale-[3]" size={200}/>
                      <div className="relative z-10">
                         <h3 className="text-4xl font-black mb-4">Rede Logística Ativa 🚀</h3>
                         <p className="text-indigo-100 text-lg font-medium mb-8 max-w-xl">
                            Seu PitDog está conectado à **Rede Global Uber**. Assim que você confirmar um pedido, os motoboys da região serão notificados automaticamente.
                         </p>
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-white/10 backdrop-blur-md p-6 rounded-3xl border border-white/20">
                               <p className="text-xs font-bold uppercase tracking-wider text-indigo-200 mb-1">Status do Serviço</p>
                               <p className="text-2xl font-black">OPERANTE</p>
                            </div>
                            <div className="bg-white/10 backdrop-blur-md p-6 rounded-3xl border border-white/20">
                               <p className="text-xs font-bold uppercase tracking-wider text-indigo-200 mb-1">Tempo Médio</p>
                               <p className="text-2xl font-black">~12 min</p>
                            </div>
                         </div>
                      </div>
                   </div>
                   
                   <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm">
                      <h4 className="font-extrabold text-xl mb-4 flex items-center gap-2 text-slate-800"><Activity className="text-green-500"/> Como Funciona?</h4>
                      <p className="text-slate-500 leading-relaxed font-medium">
                         Você não precisa gerenciar pilotos. O sistema cuida de tudo: cálculo de rota, chamado do piloto e rastreio em tempo real para seu cliente. Basta focar em fazer o melhor lanche da cidade!
                      </p>
                   </div>
                </div>
              )}

              {/* === SETTINGS / WHATSAPP === */}
              {activeTab === 'settings' && (
                <div className="flex flex-col md:flex-row gap-8">
                  <div className="bg-white p-10 rounded-3xl shadow-sm border border-slate-100 flex-1 max-w-xl text-center">
                    <div className="w-20 h-20 bg-green-50 text-green-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                      <QrCode size={40}/>
                    </div>
                    <h3 className="text-3xl font-extrabold text-slate-800 mb-2">Motor do WhatsApp</h3>
                    <p className="text-slate-500 font-medium mb-10 text-lg leading-relaxed">Conecte o seu celular da loja para que o <strong className="text-green-600">robô trabalhe sozinho</strong> enviando cardápio num instante.</p>
                    
                    <div className="bg-slate-50 p-8 rounded-3xl border border-slate-200">
                      <div className="flex flex-col items-center justify-center gap-4 mb-6">
                        <span className={`px-4 py-1.5 rounded-full text-sm font-bold shadow-sm ${waStatus==='CONNECTED'?'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                          {waStatus === 'CONNECTED' ? '🟢 Conectado & Operando' : '🔴 Desconectado'}
                        </span>
                      </div>
                      
                      {waStatus !== 'CONNECTED' && !waQr && (
                        <button disabled={waLoading} onClick={connectWA} className="w-full bg-slate-900 text-white font-black text-lg py-5 rounded-2xl shadow-xl shadow-slate-900/20 hover:bg-slate-800 transition-all hover:scale-[1.02] disabled:opacity-50 disabled:scale-100 flex justify-center items-center gap-2">
                          {waLoading ? <><div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div> Conectando Robô...</> : 'Gerar QR Code Agora'}
                        </button>
                      )}
                      
                      {waQr && (
                        <motion.div initial={{scale:0.8, opacity:0}} animate={{scale:1, opacity:1}} className="bg-white p-6 rounded-3xl shadow-xl inline-block border border-slate-100">
                          <QRCode value={waQr} size={240} className="rounded-lg" />
                          <p className="text-slate-500 font-bold mt-6 text-sm bg-slate-100 py-2 rounded-xl">Abra o WhatsApp e escaneie!</p>
                        </motion.div>
                      )}
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-indigo-500 to-blue-600 p-10 rounded-3xl shadow-lg border border-blue-500 text-white max-w-md flex flex-col justify-center relative overflow-hidden">
                     <div className="absolute top-0 right-0 opacity-10 scale-150 transform translate-x-10 -translate-y-10"><UtensilsCrossed size={200}/></div>
                     <h4 className="text-3xl font-black mb-4 relative z-10">Seu Link Mágico</h4>
                     <p className="text-blue-100 font-medium mb-8 text-lg relative z-10 leading-relaxed">Coloque esse link na Bio do seu Instagram. É este link que os clientes vão usar!</p>
                     <div className="bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/20 font-mono text-lg font-bold shadow-inner relative z-10 break-all cursor-copy hover:bg-white/20 transition-colors" onClick={() => navigator.clipboard.writeText(`${window.location.origin}/catalogo/${user?.slug}`)}>
                       {window.location.origin}/catalogo/{user?.slug}
                     </div>
                     <p className="text-center mt-4 text-sm font-bold text-blue-200">Clique no quadrinho para copiar</p>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
