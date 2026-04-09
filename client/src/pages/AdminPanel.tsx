import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../App';
import io from 'socket.io-client';
import { QrCode, UtensilsCrossed, LayoutDashboard, Settings, LogOut, Clock, Truck, Users, Activity, TrendingUp, DollarSign, Menu, Bell, Search, PlusCircle, CheckCircle2, ChevronRight, Map as MapIcon } from 'lucide-react';
import QRCode from 'react-qr-code';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';
import { uberMapStyle } from '../mapStyles';

let socket: any;

const mapContainerStyle = {
  width: '100%',
  height: '400px',
  borderRadius: '24px'
};

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

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: (import.meta as any).env.VITE_GOOGLE_MAPS_KEY || ""
  });

  const [activeDriversLocations, setActiveDriversLocations] = useState<any>({});
  const [mapCenter, setMapCenter] = useState({ lat: -16.6869, lng: -49.2648 });

  useEffect(() => {
    fetchData();
    
    // Auto-center user city
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((pos) => {
            setMapCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        });
    }
    
    socket = io();
    socket.emit('join', user?.tenant_id);

    socket.on('new_order', (order: any) => {
        setOrders(prev => [order, ...prev]);
        const audio = new Audio('/notification.mp3');
        audio.play().catch(() => {});
    });

    socket.on('qr_code', (qr: string) => setWaQr(qr));
    socket.on('whatsapp_status', (status: string) => setWaStatus(status));
    
    socket.on('delivery_update_location', ({ lat, lng, driverId }: any) => {
        setActiveDriversLocations((prev: any) => ({ ...prev, [driverId]: { lat, lng } }));
    });

    return () => { socket.disconnect(); };
  }, [user]);

  const fetchData = () => {
    fetch('/api/orders', {headers}).then(r=>r.json()).then(setOrders);
    fetch('/api/categories', {headers}).then(r=>r.json()).then(setCategories);
    fetch('/api/products', {headers}).then(r=>r.json()).then(setProducts);
    fetch('/api/chats', {headers}).then(r=>r.json()).then(setCustomers);
  };

  const loadChat = async (customer: any) => {
    setActiveChatJid(customer.whatsapp_jid || '');
    setChatLoading(true);
    const res = await fetch(`/api/chats/${customer.id}/messages`, { headers });
    const data = await res.json();
    setChatMessages(data);
    setChatLoading(false);
  };

  const handleSendMessage = async (e: any) => {
    e.preventDefault();
    if (!chatInput || !activeChatJid) return;
    const res = await fetch('/api/chat/send', {
        method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ jid: activeChatJid, text: chatInput })
    });
    if (res.ok) {
        setChatMessages([...chatMessages, { text: chatInput, is_from_me: true, created_at: new Date() }]);
        setChatInput('');
    }
  };

  const updateOrderStatus = async (id: string, status: string) => {
    const res = await fetch(`/api/orders/${id}/status`, {
        method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
    });
    if (res.ok) fetchData();
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
            if (waStatus === 'CONNECTED') clearInterval(pollQR);
          }
        } catch(e) {}
      }, 3000);
      
      setTimeout(() => clearInterval(pollQR), 60000);
      
    } catch(e) {}
    setWaLoading(false);
  };

  const logoutWA = async () => {
    await fetch('/api/whatsapp/logout', { method: 'POST', headers });
    setWaStatus('DISCONNECTED');
    setWaQr('');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans overflow-hidden">
      {/* Sidebar Luxo */}
      <aside className="w-80 bg-slate-900 text-slate-400 p-8 flex flex-col gap-8 shadow-2xl relative z-30">
        <div className="flex items-center gap-4 px-2">
          <div className="bg-orange-500 text-white p-2.5 rounded-2xl shadow-lg shadow-orange-500/30">
             <UtensilsCrossed size={28} />
          </div>
          <div>
            <h2 className="text-white text-2xl font-black tracking-tighter">PitDog.ai</h2>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Painel Administrativo</p>
          </div>
        </div>

        <nav className="flex flex-col gap-2 flex-1 pt-4">
          <p className="px-4 text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Monitorando</p>
          <button onClick={()=>setActiveTab('dashboard')} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-medium transition-all ${activeTab==='dashboard'?'bg-orange-500 text-white shadow-md shadow-orange-500/20': 'hover:bg-slate-800 hover:text-white'}`}>
            <LayoutDashboard size={20}/> Dashboard
          </button>
          
          <button onClick={()=>setActiveTab('orders')} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-medium transition-all ${activeTab==='orders'?'bg-orange-500 text-white shadow-md shadow-orange-500/20': 'hover:bg-slate-800 hover:text-white'}`}>
            <Clock size={20}/> Pedidos Ativos
            {orders.filter(o=>o.status === 'PENDING').length > 0 && (
                <span className="ml-auto bg-white text-orange-600 px-2 py-0.5 rounded-lg text-[10px] font-black">{orders.filter(o=>o.status === 'PENDING').length}</span>
            )}
          </button>

          <p className="px-4 text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 mt-8">Gerenciamento</p>
          <button onClick={()=>setActiveTab('catalog')} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-medium transition-all ${activeTab==='catalog'?'bg-orange-500 text-white shadow-md shadow-orange-500/20': 'hover:bg-slate-800 hover:text-white'}`}>
            <PlusCircle size={20}/> Cardápio Digital
          </button>
          
          <button onClick={()=>setActiveTab('chats')} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-medium transition-all ${activeTab==='chats'?'bg-orange-500 text-white shadow-md shadow-orange-500/20': 'hover:bg-slate-800 hover:text-white'}`}>
            <Bell size={20}/> Chat ao Vivo
          </button>
          
          <button onClick={()=>setActiveTab('drivers')} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-medium transition-all ${activeTab==='drivers'?'bg-orange-500 text-white shadow-md shadow-orange-500/20': 'hover:bg-slate-800 hover:text-white'}`}>
            <Truck size={20}/> Rede Entrega (Uber)
          </button>

          <p className="px-4 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 mt-8">Sistema</p>
          <button onClick={()=>setActiveTab('settings')} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-medium transition-all ${activeTab==='settings'?'bg-orange-500 text-white shadow-md shadow-orange-500/20': 'hover:bg-slate-800 hover:text-white'}`}>
            <Settings size={20}/> Configurações
          </button>
          
          <button onClick={() => { localStorage.removeItem('token'); window.location.href='/'; }} className="w-full mt-auto flex items-center gap-3 px-4 py-3.5 rounded-2xl font-medium text-red-400 hover:bg-red-500/10 transition-all">
            <LogOut size={20}/> Sair do Painel
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {/* Header Topo */}
        <header className="h-24 bg-white/70 backdrop-blur-xl border-b border-slate-200 px-10 flex items-center justify-between sticky top-0 z-20">
            <div>
               <h1 className="text-2xl font-black text-slate-800 capitalize">{activeTab.replace('dashboard', 'Visão Geral').replace('catalog', 'Cardápio').replace('orders', 'Pedidos')}</h1>
               <p className="text-xs font-bold text-slate-400 tracking-wide uppercase">Bem-vindo, {user?.name}</p>
            </div>
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100">
                    <span className={`w-2 h-2 rounded-full ${waStatus === 'CONNECTED' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
                    <span className="text-[10px] font-black text-slate-500">{waStatus === 'CONNECTED' ? 'ROBÔ CONECTADO' : 'ROBÔ OFFLINE'}</span>
                </div>
                <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 hover:text-orange-500 cursor-pointer transition-colors shadow-sm">
                   <Bell size={24}/>
                </div>
            </div>
        </header>

        {/* Dynamic Area */}
        <main className="flex-1 overflow-y-auto p-10 bg-slate-50/50">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              {/* === DASHBOARD === */}
              {activeTab === 'dashboard' && (
                <div className="space-y-10">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                    <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100 group hover:shadow-xl hover:shadow-orange-500/5 transition-all">
                       <div className="w-12 h-12 bg-orange-50 text-orange-500 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><TrendingUp size={24}/></div>
                       <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Vendas Hoje</p>
                       <h3 className="text-3xl font-black text-slate-800">R$ {orders.reduce((acc,o)=>acc+o.total, 0).toFixed(2)}</h3>
                    </div>
                    <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100 group hover:shadow-xl hover:shadow-blue-500/5 transition-all">
                       <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><Clock size={24}/></div>
                       <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Pedidos Ativos</p>
                       <h3 className="text-3xl font-black text-slate-800">{orders.filter(o=>o.status === 'PENDING').length}</h3>
                    </div>
                    <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100 group hover:shadow-xl hover:shadow-indigo-500/5 transition-all">
                       <div className="w-12 h-12 bg-indigo-50 text-indigo-500 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><Users size={24}/></div>
                       <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Clientes</p>
                       <h3 className="text-3xl font-black text-slate-800">{customers.length}</h3>
                    </div>
                    <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100 group hover:shadow-xl hover:shadow-green-500/5 transition-all">
                       <div className="w-12 h-12 bg-green-50 text-green-500 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><CheckCircle2 size={24}/></div>
                       <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Concluídos</p>
                       <h3 className="text-3xl font-black text-slate-800">{orders.filter(o=>o.status === 'DELIVERED').length}</h3>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                     <div className="bg-white p-10 rounded-[40px] shadow-sm border border-slate-100">
                        <div className="flex items-center justify-between mb-8">
                           <h3 className="text-xl font-black text-slate-800">Pedidos Recentes</h3>
                           <button onClick={()=>setActiveTab('orders')} className="text-orange-600 text-sm font-bold flex items-center gap-1 hover:underline">Ver todos <ChevronRight size={16}/></button>
                        </div>
                        <div className="space-y-4">
                           {orders.slice(0,5).map(o => (
                              <div key={o.id} className="p-5 bg-slate-50 flex items-center justify-between rounded-3xl border border-slate-100 hover:border-orange-200 transition-all cursor-pointer">
                                 <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center font-black text-slate-400 border border-slate-100 shadow-sm">#{o.id.slice(-4)}</div>
                                    <div>
                                       <p className="font-bold text-slate-800">{o.customer?.name || 'Cliente Anonimo'}</p>
                                       <p className="text-xs font-medium text-slate-500">{new Date(o.created_at).toLocaleTimeString()}</p>
                                    </div>
                                 </div>
                                 <div className="text-right">
                                    <p className="font-black text-slate-800">R$ {o.total.toFixed(2)}</p>
                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${o.status === 'PENDING' ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`}>{o.status}</span>
                                 </div>
                              </div>
                           ))}
                        </div>
                     </div>

                     <div className="flex flex-col gap-10">
                        <div className="bg-gradient-to-br from-indigo-500 to-blue-600 p-10 rounded-[40px] shadow-lg border border-blue-500 text-white flex-1 flex flex-col justify-center relative overflow-hidden">
                           <div className="absolute top-0 right-0 opacity-10 scale-150 transform translate-x-10 -translate-y-10"><UtensilsCrossed size={200}/></div>
                           <h4 className="text-3xl font-black mb-4 relative z-10">Seu Link Mágico</h4>
                           <p className="text-blue-100 font-medium mb-8 text-lg relative z-10 leading-relaxed">Coloque esse link na Bio do seu Instagram. É este link que os clientes vão usar!</p>
                           <div className="bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/20 font-mono text-lg font-bold shadow-inner relative z-10 break-all cursor-copy hover:bg-white/20 transition-colors" onClick={() => navigator.clipboard.writeText(`${window.location.origin}/catalogo/${user?.slug}`)}>
                             {window.location.origin}/catalogo/{user?.slug}
                           </div>
                           <p className="text-center mt-4 text-sm font-bold text-blue-200">Clique no quadrinho para copiar</p>
                        </div>
                     </div>
                  </div>
                </div>
              )}

              {/* === ORDERS === */}
              {activeTab === 'orders' && (
                <div className="space-y-6">
                    <div className="flex flex-wrap gap-4 mb-4">
                        <button className="bg-white px-6 py-2.5 rounded-full text-slate-600 font-bold border border-slate-200 shadow-sm hover:border-orange-500 transition-all">Todos</button>
                        <button className="bg-orange-500 px-6 py-2.5 rounded-full text-white font-bold shadow-md shadow-orange-500/20">Pendentes</button>
                        <button className="bg-white px-6 py-2.5 rounded-full text-slate-600 font-bold border border-slate-200 shadow-sm hover:border-orange-500 transition-all">Em Preparo</button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                       {orders.map(o => (
                          <div key={o.id} className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                             <div className="p-8 border-b border-slate-50">
                                <div className="flex justify-between items-start mb-4">
                                   <div>
                                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Pedido #{o.id.slice(-6)}</p>
                                      <h4 className="text-xl font-black text-slate-800">{o.customer?.name}</h4>
                                   </div>
                                   <div className={`px-4 py-1 rounded-full text-[10px] font-black ${o.status === 'PENDING' ? 'bg-orange-50 text-orange-600' : 'bg-green-50 text-green-600'}`}>{o.status}</div>
                                </div>
                                <div className="bg-slate-50 p-4 rounded-2xl text-slate-500 text-sm font-medium border border-slate-100 leading-relaxed">
                                    {o.items?.map((it:any) => (
                                        <div key={it.id} className="flex justify-between">
                                            <span>{it.quantity}x {it.product.name}</span>
                                            <span className="font-bold">R$ {it.unit_price.toFixed(2)}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-4 flex justify-between text-lg">
                                    <span className="font-bold text-slate-400">Total</span>
                                    <span className="font-black text-slate-800">R$ {o.total.toFixed(2)}</span>
                                </div>
                             </div>
                             <div className="p-6 bg-slate-50 flex gap-3">
                                {o.status === 'PENDING' && (
                                    <>
                                        <button onClick={()=>updateOrderStatus(o.id, 'PREPARING')} className="flex-1 bg-green-500 text-white py-3 rounded-xl font-bold hover:bg-green-600 transition shadow-lg shadow-green-500/20">Confirmar</button>
                                        <button onClick={()=>updateOrderStatus(o.id, 'CANCELLED')} className="flex-1 bg-white text-red-500 border border-red-200 py-3 rounded-xl font-bold hover:bg-red-50 transition">Cancelar</button>
                                    </>
                                )}
                                {o.status === 'PREPARING' && (
                                     <button onClick={()=>updateOrderStatus(o.id, 'DELIVERED')} className="flex-1 bg-orange-600 text-white py-3 rounded-xl font-bold hover:bg-orange-500 transition">ENVIAR PARA ENTREGA 🛵</button>
                                )}
                             </div>
                          </div>
                       ))}
                    </div>
                </div>
              )}

              {/* === CATALOG === */}
              {activeTab === 'catalog' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                   {/* Coluna Esquerda: Categorias */}
                   <div className="bg-white p-10 rounded-[40px] shadow-sm border border-slate-100 h-fit">
                      <h3 className="text-xl font-black mb-6 text-slate-800 flex items-center gap-2"><Menu size={20} className="text-orange-500"/> Categorias de Lanches</h3>
                      <form onSubmit={addCategory} className="flex gap-2 mb-8">
                         <input required placeholder="Nova Categoria..." className="flex-1 p-4 rounded-2xl bg-slate-50 border border-slate-200 outline-none focus:border-orange-500 transition-all font-medium" value={newCat} onChange={e=>setNewCat(e.target.value)} />
                         <button className="bg-slate-900 text-white p-4 rounded-2xl hover:bg-slate-800 transition shadow-lg shadow-slate-900/10"><PlusCircle/></button>
                      </form>
                      <div className="space-y-2">
                         {categories.map(c => (
                            <div key={c.id} className="p-4 rounded-2xl border border-slate-50 flex justify-between items-center group hover:bg-slate-50 transition-colors">
                               <span className="font-bold text-slate-700">{c.name}</span>
                               <span className="text-xs font-black text-slate-300 group-hover:text-orange-500 transition-colors">{c.products?.length || 0} Itens</span>
                            </div>
                         ))}
                      </div>
                   </div>

                   {/* Coluna Direita: Produtos */}
                   <div className="lg:col-span-2 space-y-10">
                      <div className="bg-white p-10 rounded-[40px] shadow-sm border border-slate-100">
                         <div className="flex items-center justify-between mb-8">
                            <h3 className="text-xl font-black text-slate-800">Cardápio Ativo</h3>
                            <button className="bg-orange-500 text-white px-6 py-3 rounded-2xl font-black text-xs hover:bg-orange-600 transition flex items-center gap-2 shadow-lg shadow-orange-500/20">ADICIONAR PRODUTO</button>
                         </div>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {products.map(p => (
                               <div key={p.id} className="p-4 rounded-3xl border border-slate-100 flex gap-4 hover:border-orange-200 transition-all cursor-pointer">
                                  <div className="w-24 h-24 bg-slate-100 rounded-2xl flex-shrink-0"></div>
                                  <div>
                                     <p className="text-[10px] font-black text-orange-500 uppercase">{p.category?.name}</p>
                                     <h5 className="font-black text-slate-800 text-lg">{p.name}</h5>
                                     <p className="text-slate-500 text-xs font-medium mb-2">{p.description?.slice(0,60)}...</p>
                                     <p className="font-black text-green-600">R$ {p.price.toFixed(2)}</p>
                                  </div>
                               </div>
                            ))}
                         </div>
                      </div>
                   </div>
                </div>
              )}

              {/* === CHATS === */}
              {activeTab === 'chats' && (
                <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 h-[calc(100vh-200px)] flex overflow-hidden">
                    <div className="w-96 border-r border-slate-100 flex flex-col">
                        <div className="p-8 border-b border-slate-50">
                            <h3 className="text-xl font-black text-slate-800">Conversas</h3>
                            <div className="relative mt-4">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                                <input placeholder="Buscar cliente..." className="w-full pl-12 pr-4 py-3 bg-slate-50 rounded-2xl outline-none focus:ring-2 focus:ring-orange-500/20" />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            {customers.map(c => (
                                <div key={c.id} onClick={()=>loadChat(c)} className={`p-6 flex items-center gap-4 cursor-pointer hover:bg-slate-50 transition-colors border-l-4 ${activeChatJid === c.whatsapp_jid ? 'border-orange-500 bg-orange-50/10' : 'border-transparent'}`}>
                                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center font-black text-slate-400">
                                      {c.name.charAt(0)}
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                        <p className="font-bold text-slate-800">{c.name}</p>
                                        <p className="text-xs text-slate-400 truncate">{c.chatMessages?.[0]?.text || 'Clique para ver as mensagens'}</p>
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-300">12:35</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="flex-1 flex flex-col bg-slate-50/30">
                        {activeChatJid ? (
                            <>
                                <header className="p-6 bg-white border-b border-slate-100 flex items-center gap-4">
                                    <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center font-bold text-slate-400">?</div>
                                    <h4 className="font-black text-slate-800">Chat com Cliente</h4>
                                </header>
                                <div className="flex-1 p-8 overflow-y-auto space-y-4">
                                    {chatMessages.map((m, idx) => (
                                        <div key={idx} className={`flex ${m.is_from_me ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`p-4 rounded-2xl max-w-md shadow-sm ${m.is_from_me ? 'bg-orange-500 text-white rounded-tr-none' : 'bg-white text-slate-700 border border-slate-100 rounded-tl-none'}`}>
                                                <p className="font-medium">{m.text}</p>
                                                <span className={`text-[9px] font-bold block mt-1 ${m.is_from_me ? 'text-white/60' : 'text-slate-300'}`}>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <footer className="p-6 bg-white border-t border-slate-100">
                                    <form onSubmit={handleSendMessage} className="flex gap-4">
                                        <input value={chatInput} onChange={e=>setChatInput(e.target.value)} placeholder="Digite sua resposta..." className="flex-1 bg-slate-50 p-4 rounded-2xl outline-none focus:ring-2 focus:ring-orange-500/10 font-medium" />
                                        <button className="bg-orange-500 text-white px-8 rounded-2xl font-black hover:bg-orange-600 transition shadow-lg shadow-orange-500/20">ENVIAR</button>
                                    </form>
                                </footer>
                            </>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
                                <Bell size={60} className="mb-4 opacity-20"/>
                                <p className="font-bold">Selecione uma conversa para começar</p>
                            </div>
                        )}
                    </div>
                </div>
              )}

              {/* === REDE ENTREGA (UBER) === */}
              {activeTab === 'drivers' && (
                <div className="space-y-8 animate-in fade-in duration-500 max-w-6xl">
                   <div className="bg-gradient-to-br from-indigo-600 to-blue-700 p-10 rounded-[40px] text-white shadow-2xl relative overflow-hidden">
                      <Truck className="absolute -right-10 -bottom-10 opacity-10 scale-[3]" size={200}/>
                      <div className="relative z-10">
                         <h3 className="text-4xl font-black mb-4">Rede Logística Ativa 🚀</h3>
                         <p className="text-indigo-100 text-lg font-medium mb-8 max-w-xl">
                            Seu PitDog está conectado à **Rede Global Uber**. Os motoboys da região estão sendo monitorados em tempo real.
                         </p>
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-white/10 backdrop-blur-md p-6 rounded-3xl border border-white/20">
                               <p className="text-xs font-bold uppercase tracking-wider text-indigo-200 mb-1">Status da Rede</p>
                               <p className="text-2xl font-black">OPERANTE</p>
                            </div>
                            <div className="bg-white/10 backdrop-blur-md p-6 rounded-3xl border border-white/20">
                               <p className="text-xs font-bold uppercase tracking-wider text-indigo-200 mb-1">Localização</p>
                               <p className="text-2xl font-black">GPS ATIVO</p>
                            </div>
                         </div>
                      </div>
                   </div>

                   {/* Mapa de Monitoramento do Restaurante */}
                   <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm">
                      <h4 className="font-extrabold text-xl mb-6 flex items-center gap-2 text-slate-800"><MapIcon className="text-indigo-500"/> Monitoramento em Tempo Real</h4>
                      <div className="h-[400px] bg-slate-100 rounded-3xl overflow-hidden border border-slate-200 relative">
                         {isLoaded ? (
                            <GoogleMap
                               mapContainerStyle={mapContainerStyle}
                               center={Object.values(activeDriversLocations)[0] as any || mapCenter}
                               zoom={13}
                               options={{
                                   styles: uberMapStyle,
                                   zoomControl: false,
                                   streetViewControl: false,
                                   mapTypeControl: false,
                                   fullscreenControl: false,
                               }}
                            >
                               {Object.keys(activeDriversLocations).map(driverId => (
                                 <Marker 
                                   key={driverId} 
                                   position={activeDriversLocations[driverId]}
                                   icon={{
                                       url: "https://cdn-icons-png.flaticon.com/512/2972/2972185.png",
                                       scaledSize: new window.google.maps.Size(40,40)
                                   }}
                                 />
                               ))}
                            </GoogleMap>
                         ) : (
                            <div className="absolute inset-0 flex items-center justify-center font-bold text-slate-400 animate-pulse">
                               Carregando Satélites de Entrega...
                            </div>
                         )}
                      </div>
                      <p className="mt-4 text-slate-500 text-sm font-medium">
                         Somente os motoboys que aceitaram seus pedidos aparecerão neste mapa.
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
                      {waStatus === 'CONNECTED' ? (
                        <div className="space-y-6">
                          <div className="bg-green-500/10 text-green-600 p-4 rounded-2xl font-black text-sm border border-green-500/20">ESTADO: CONECTADO ✅</div>
                          <button onClick={logoutWA} className="w-full bg-red-500 text-white font-bold py-4 rounded-2xl hover:bg-red-600 transition shadow-lg shadow-red-500/20">Desconectar WhatsApp</button>
                        </div>
                      ) : (
                        <div className="space-y-6">
                           {waQr ? (
                              <div className="bg-white p-6 rounded-3xl border-2 border-slate-200 shadow-inner inline-block mx-auto mb-4">
                                 <QRCode value={waQr} size={200} />
                              </div>
                           ) : (
                              <div className="h-48 flex items-center justify-center border-2 border-dashed border-slate-200 rounded-3xl text-slate-300 font-bold italic">
                                 {waLoading ? 'Gerando QR Code...' : 'Clique abaixo para gerar QR Code'}
                              </div>
                           )}
                           <button onClick={connectWA} disabled={waLoading} className="w-full bg-green-500 text-white font-bold py-4 rounded-2xl hover:bg-green-600 disabled:opacity-50 transition shadow-lg shadow-green-500/20">
                             {waLoading ? 'Iniciando Robô...' : 'Gerar QR Code Agora'}
                           </button>
                        </div>
                      )}
                    </div>
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
