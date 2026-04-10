import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../App';
import io from 'socket.io-client';
import { QrCode, LayoutDashboard, Settings, LogOut, Clock, Truck, Users, TrendingUp, Bell, PlusCircle, CheckCircle2, Map as MapIcon, Menu, X, Power, BarChart3, PieChart, Ticket, Trash2 } from 'lucide-react';
import QRCode from 'react-qr-code';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleMap, useJsApiLoader, Marker, DirectionsRenderer } from '@react-google-maps/api';
import { uberMapStyle } from '../mapStyles';
import { requestForToken, onMessageListener } from '../firebase';
import { toast } from 'react-toastify';

let socket: any;

const mapContainerStyle = {
  width: '100%',
  height: '400px',
  borderRadius: '24px'
};

export default function AdminPanel() {
  const { user, setUser } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const [orders, setOrders] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [waStatus, setWaStatus] = useState(user?.whatsapp_status);
  const [waQr, setWaQr] = useState('');
  
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [activeChatJid, setActiveChatJid] = useState('');

  // Branding Settings
  const [storeName, setStoreName] = useState(user?.name || '');
  const [logoUrl, setLogoUrl] = useState(user?.logo_url || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const [reportStats, setReportStats] = useState<any>(null);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [newCoupon, setNewCoupon] = useState({ code: '', type: 'PERCENT', value: 0, min_order: 0 });
  const [isAlarmPlaying, setIsAlarmPlaying] = useState(false);
  const [alarmAudio] = useState(new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3')); // Loud doorbell/alarm

  const [newCat, setNewCat] = useState('');
  
  const token = localStorage.getItem('token');
  const headers = { 'Authorization': `Bearer ${token}` };

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: (import.meta as any).env.VITE_GOOGLE_MAPS_KEY || ""
  });

  const [activeDriversLocations, setActiveDriversLocations] = useState<any>({});
  const [mapCenter, setMapCenter] = useState<{lat: number, lng: number} | null>(null);

  useEffect(() => {
    alarmAudio.loop = true;
    return () => {
        alarmAudio.pause();
    };
  }, [alarmAudio]);

  const stopAlarm = () => {
    setIsAlarmPlaying(false);
    alarmAudio.pause();
    alarmAudio.currentTime = 0;
  };

  useEffect(() => {
    fetchData();
    
    // Auto-center user city
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((pos) => {
            setMapCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        }, () => {
             console.log("GPS Blocked");
        });
    }
    
    socket = io();
    socket.emit('join', user?.tenant_id);
    socket.emit('join', 'drivers_global');

    socket.on('new_order', (order: any) => {
        setOrders(prev => [order, ...prev]);
        setIsAlarmPlaying(true);
        alarmAudio.play().catch(e => console.log("Audio block:", e));
        toast.success("🍔 NOVO PEDIDO RECEBIDO!", { position: "top-center", autoClose: 10000 });
    });

    socket.on('qr_code', (qr: string) => setWaQr(qr));
    socket.on('whatsapp_status', (status: string) => setWaStatus(status));
    
    socket.on('delivery_update_location', (update: any) => {
        const { lat, lng, driverId, driver, orderId } = update;
        setActiveDriversLocations((prev: any) => ({ 
            ...prev, 
            [driverId]: { ...(prev[driverId] || driver || {}), lat, lng, orderId } 
        }));
    });

    return () => { socket.disconnect(); };
  }, [user]);

  const fetchData = () => {
    fetch('/api/orders', {headers}).then(r=>r.json()).then(setOrders);
    fetch('/api/categories', {headers}).then(r=>r.json()).then(setCategories);
    fetch('/api/products', {headers}).then(r=>r.json()).then(setProducts);
    fetch('/api/chats', {headers}).then(r=>r.json()).then(setCustomers);
    
    // Initial drivers load
    fetch('/api/drivers/online', {headers}).then(r=>r.json()).then(data => {
        const locations: any = {};
        data.filter((d:any) => d.latitude).forEach((d:any) => {
            locations[d.id] = { lat: d.latitude, lng: d.longitude, name: d.name };
        });
        setActiveDriversLocations(locations);
    });
    fetch('/api/reports/stats', {headers}).then(r=>r.json()).then(setReportStats);
    fetch('/api/coupons', {headers}).then(r=>r.json()).then(setCoupons);

    // Firebase Push Notifications
    requestForToken().then(fcmToken => {
        if (fcmToken) {
            fetch('/api/fcm-token', {
                method: 'POST',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: fcmToken })
            });
        }
    });

    onMessageListener().then((payload : any) => {
        setIsAlarmPlaying(true);
        alarmAudio.play().catch(e => console.log("Audio block:", e));
        toast.info(payload.notification.title + ": " + payload.notification.body, {
            position: "top-right",
            autoClose: 5000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
            theme: "colored",
        });
        fetchData();
    });
  };

  const loadChat = async (customer: any) => {
    setActiveChatJid(customer.whatsapp_jid || '');
    const res = await fetch(`/api/chats/${customer.id}/messages`, { headers });
    const data = await res.json();
    setChatMessages(data);
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

  const connectWA = async () => {
    setWaQr('');
    try {
      await fetch('/api/whatsapp/connect', { method: 'POST', headers });
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
  };

  const logoutWA = async () => {
    setWaQr('');
  };

  const updateStoreInfo = async (e: any) => {
    e.preventDefault();
    setIsUpdating(true);
    try {
        const res = await fetch('/api/tenant', {
            method: 'PUT',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: storeName, logo_url: logoUrl })
        });
        if (res.ok) {
            const updatedTenant = await res.json();
            setUser(updatedTenant);
            alert('Configurações salvas com sucesso!');
        }
    } catch(e) {}
    setIsUpdating(false);
  };

  const handleLogoUpload = async (e: any) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
        const res = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        const data = await res.json();
        if (data.url) setLogoUrl(data.url);
    } catch(e) {}
    setIsUploading(false);
  };

  const toggleProduct = async (id: string) => {
    await fetch(`/api/products/${id}/toggle`, { method: 'PUT', headers });
    fetchData();
  };

  const toggleCategory = async (id: string) => {
    await fetch(`/api/categories/${id}/toggle`, { method: 'PUT', headers });
    fetchData();
  };

  const createCoupon = async (e: any) => {
    e.preventDefault();
    const res = await fetch('/api/coupons', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(newCoupon)
    });
    if (res.ok) {
        setNewCoupon({ code: '', type: 'PERCENT', value: 0, min_order: 0 });
        alert('Cupom criado com sucesso!');
        fetchData();
    }
  };

  const deleteCoupon = async (id: string) => {
    if(!confirm('Deseja excluir este cupom?')) return;
    await fetch(`/api/coupons/${id}`, { method: 'DELETE', headers });
    fetchData();
  };

  return (
    <div onClick={stopAlarm} className="min-h-screen bg-slate-50 flex font-sans overflow-hidden relative">
       {isAlarmPlaying && (
         <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-red-600 text-white px-8 py-4 rounded-full shadow-2xl animate-bounce flex items-center gap-3 cursor-pointer">
            <Bell className="animate-ring" />
            <span className="font-black">NOVO PEDIDO! CLIQUE PARA PARAR O ALERTA</span>
         </div>
       )}
      {/* Sidebar - Backdrop for mobile */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      <aside className={`
        fixed inset-y-0 left-0 z-50 w-80 bg-slate-900 text-slate-400 p-8 flex flex-col gap-8 shadow-2xl transition-transform duration-300 lg:relative lg:translate-x-0
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex items-center justify-between lg:justify-start gap-4 px-2">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl shadow-lg shadow-orange-500/30 overflow-hidden flex items-center justify-center bg-orange-500 text-white font-bold text-xl">
               {logoUrl ? <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" /> : "🍔"}
            </div>
            <div>
              <h2 className="text-white text-xl font-black tracking-tighter truncate max-w-[120px]">{storeName || 'PitDog.ai'}</h2>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Painel Administrativo</p>
            </div>
          </div>
          <button className="lg:hidden text-slate-400 p-2 hover:bg-slate-800 rounded-xl" onClick={() => setIsMobileMenuOpen(false)}>
            <X size={24} />
          </button>
        </div>

        <nav className="flex flex-col gap-2 flex-1 pt-4 overflow-y-auto">
          <p className="px-4 text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Monitorando</p>
          <button onClick={()=>{setActiveTab('dashboard'); setIsMobileMenuOpen(false);}} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-medium transition-all ${activeTab==='dashboard'?'bg-orange-500 text-white shadow-md shadow-orange-500/20': 'hover:bg-slate-800 hover:text-white'}`}>
            <LayoutDashboard size={20}/> Dashboard
          </button>
          <button onClick={()=>{setActiveTab('orders'); setIsMobileMenuOpen(false);}} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-medium transition-all ${activeTab==='orders'?'bg-orange-500 text-white shadow-md shadow-orange-500/20': 'hover:bg-slate-800 hover:text-white'}`}>
            <Clock size={20}/> Pedidos Ativos
          </button>
          <p className="px-4 text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 mt-8">Gerenciamento</p>
          <button onClick={()=>{setActiveTab('catalog'); setIsMobileMenuOpen(false);}} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-medium transition-all ${activeTab==='catalog'?'bg-orange-500 text-white shadow-md shadow-orange-500/20': 'hover:bg-slate-800 hover:text-white'}`}>
            <PlusCircle size={20}/> Cardápio Digital
          </button>
          <button onClick={()=>{setActiveTab('chats'); setIsMobileMenuOpen(false);}} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-medium transition-all ${activeTab==='chats'?'bg-orange-500 text-white shadow-md shadow-orange-500/20': 'hover:bg-slate-800 hover:text-white'}`}>
            <Bell size={20}/> Chat ao Vivo
          </button>
          <button onClick={()=>{setActiveTab('drivers'); setIsMobileMenuOpen(false);}} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-medium transition-all ${activeTab==='drivers'?'bg-orange-500 text-white shadow-md shadow-orange-500/20': 'hover:bg-slate-800 hover:text-white'}`}>
            <Truck size={20}/> Rede Entrega (Uber)
          </button>
          <button onClick={()=>{setActiveTab('reports'); setIsMobileMenuOpen(false);}} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-medium transition-all ${activeTab==='reports'?'bg-orange-500 text-white shadow-md shadow-orange-500/20': 'hover:bg-slate-800 hover:text-white'}`}>
            <TrendingUp size={20}/> Relatórios
          </button>
          <button onClick={()=>{setActiveTab('marketing'); setIsMobileMenuOpen(false);}} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-medium transition-all ${activeTab==='marketing'?'bg-orange-500 text-white shadow-md shadow-orange-500/20': 'hover:bg-slate-800 hover:text-white'}`}>
            <Ticket size={20}/> Cupons (Marketing)
          </button>
          <button onClick={()=>{setActiveTab('settings'); setIsMobileMenuOpen(false);}} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-medium transition-all ${activeTab==='settings'?'bg-orange-500 text-white shadow-md shadow-orange-500/20': 'hover:bg-slate-800 hover:text-white'}`}>
            <Settings size={20}/> Configurações
          </button>
          <button onClick={() => { localStorage.removeItem('token'); window.location.href='/'; }} className="w-full mt-auto flex items-center gap-3 px-4 py-3.5 rounded-2xl font-medium text-red-400 hover:bg-red-500/10 transition-all">
            <LogOut size={20}/> Sair do Painel
          </button>
        </nav>
      </aside>

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-20 lg:h-24 bg-white/70 backdrop-blur-xl border-b border-slate-200 px-6 lg:px-10 flex items-center justify-between sticky top-0 z-20">
            <div className="flex items-center gap-4">
                <button className="lg:hidden p-2 text-slate-800 hover:bg-slate-50 rounded-xl" onClick={() => setIsMobileMenuOpen(true)}>
                    <Menu size={24} />
                </button>
                <div>
                  <h1 className="text-xl lg:text-2xl font-black text-slate-800 capitalize">{activeTab}</h1>
                  <p className="text-[10px] font-bold text-slate-400 tracking-wide uppercase">PitDog SaaS Node</p>
                </div>
            </div>
            <div className="flex items-center gap-3 lg:gap-6">
                <div className="flex items-center gap-2 bg-slate-50 px-3 lg:px-4 py-2 rounded-2xl border border-slate-100">
                    <span className={`w-2 h-2 rounded-full ${waStatus === 'CONNECTED' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
                    <span className="hidden sm:inline text-[10px] font-black text-slate-500">{waStatus === 'CONNECTED' ? 'ROBÔ CONECTADO' : 'ROBÔ OFFLINE'}</span>
                </div>
            </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-10 bg-slate-50/50">
          <AnimatePresence mode="wait">
            <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="h-full">
              {activeTab === 'dashboard' && (
                <div className="space-y-10">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-8">
                    <div className="bg-white p-6 lg:p-8 rounded-[32px] shadow-sm border border-slate-100">
                       <TrendingUp size={24} className="text-orange-500 mb-4"/>
                       <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Vendas Hoje</p>
                       <h3 className="text-2xl lg:text-3xl font-black text-slate-800">R$ {orders.reduce((acc,o)=>acc+o.total, 0).toFixed(2)}</h3>
                    </div>
                    <div className="bg-white p-6 lg:p-8 rounded-[32px] shadow-sm border border-slate-100">
                       <Clock size={24} className="text-blue-500 mb-4"/>
                       <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Pedidos Ativos</p>
                       <h3 className="text-2xl lg:text-3xl font-black text-slate-800">{orders.filter(o=>o.status === 'PENDING').length}</h3>
                    </div>
                    <div className="bg-white p-6 lg:p-8 rounded-[32px] shadow-sm border border-slate-100">
                       <Users size={24} className="text-indigo-500 mb-4"/>
                       <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Clientes</p>
                       <h3 className="text-2xl lg:text-3xl font-black text-slate-800">{customers.length}</h3>
                    </div>
                    <div className="bg-white p-6 lg:p-8 rounded-[32px] shadow-sm border border-slate-100">
                       <CheckCircle2 size={24} className="text-green-500 mb-4"/>
                       <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Concluídos</p>
                       <h3 className="text-2xl lg:text-3xl font-black text-slate-800">{orders.filter(o=>o.status === 'DELIVERED').length}</h3>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10">
                     <div className="bg-white p-6 lg:p-10 rounded-[40px] shadow-sm border border-slate-100">
                        <h3 className="text-xl font-black text-slate-800 mb-8">Pedidos Recentes</h3>
                        <div className="space-y-4">
                           {orders.slice(0,5).map(o => (
                              <div key={o.id} className="p-4 lg:p-5 bg-slate-50 flex items-center justify-between rounded-3xl border border-slate-100">
                                 <div>
                                    <p className="font-bold text-slate-800 text-sm lg:text-base">Pedido #{o.id.slice(-4)}</p>
                                    <p className="text-[10px] lg:text-xs font-medium text-slate-500">{new Date(o.created_at).toLocaleTimeString()}</p>
                                 </div>
                                 <p className="font-black text-slate-800 text-sm lg:text-base">R$ {o.total.toFixed(2)}</p>
                              </div>
                           ))}
                        </div>
                     </div>
                     <div className="bg-gradient-to-br from-indigo-500 to-blue-600 p-6 lg:p-10 rounded-[40px] shadow-lg text-white">
                        <h4 className="text-xl lg:text-2xl font-black mb-4">Link do Pedido</h4>
                        <div className="bg-white/10 p-4 rounded-xl border border-white/20 font-mono break-all text-xs lg:text-sm mb-4">
                           {window.location.origin}/catalogo/{user?.slug}
                        </div>
                        <button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/catalogo/${user?.slug}`)} className="w-full bg-white text-indigo-600 font-bold py-3 rounded-xl">Copiar Link</button>
                     </div>
                  </div>
                </div>
              )}

              {activeTab === 'orders' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                   {orders.map(o => (
                      <div key={o.id} className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                         <div className="p-8">
                            <h4 className="text-xl font-black text-slate-800 mb-4">Pedido #{o.id.slice(-6)}</h4>
                            <div className="space-y-2 mb-6">
                               {o.items?.map((it:any) => (
                                   <div key={it.id} className="text-sm text-slate-500 flex justify-between">
                                       <span>{it.quantity}x {it.product.name}</span>
                                       <span className="font-bold">R$ {it.unit_price.toFixed(2)}</span>
                                   </div>
                               ))}
                            </div>
                            <div className="flex justify-between text-lg font-black text-slate-800 border-t pt-4">
                                <span>Total</span>
                                <span>R$ {o.total.toFixed(2)}</span>
                            </div>
                         </div>
                         <div className="p-6 bg-slate-50 flex gap-3">
                            {o.status === 'PENDING' && (
                                <button onClick={()=>updateOrderStatus(o.id, 'PREPARING')} className="flex-1 bg-green-500 text-white py-3 rounded-xl font-bold">Aceitar</button>
                            )}
                            {o.status === 'PREPARING' && (
                                 <button onClick={()=>updateOrderStatus(o.id, 'DELIVERED')} className="flex-1 bg-orange-600 text-white py-3 rounded-xl font-bold">Enviar Entrega 🛵</button>
                            )}
                         </div>
                      </div>
                   ))}
                </div>
              )}

              {activeTab === 'catalog' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                   <div className="bg-white p-10 rounded-[40px] shadow-sm border border-slate-100">
                      <h3 className="text-xl font-black mb-6 text-slate-800">Categorias</h3>
                      <form onSubmit={addCategory} className="flex gap-2 mb-8">
                         <input required className="flex-1 p-4 rounded-2xl bg-slate-50 border border-slate-200 outline-none" value={newCat} onChange={e=>setNewCat(e.target.value)} />
                         <button className="bg-slate-900 text-white p-4 rounded-2xl">+</button>
                      </form>
                    <div className="space-y-3">
                       {categories.map(c => (
                          <div key={c.id} className="p-4 rounded-2xl bg-slate-50 font-bold border border-slate-100 flex justify-between items-center group">
                             <span className={c.active ? '' : 'text-slate-400 line-through'}>{c.name}</span>
                             <button onClick={()=>toggleCategory(c.id)} className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase transition-all ${c.active ? 'bg-green-100 text-green-600 hover:bg-orange-100 hover:text-orange-600' : 'bg-slate-200 text-slate-500 hover:bg-green-100 hover:text-green-600'}`}>
                                {c.active ? 'Ativo' : 'Pausado'}
                             </button>
                          </div>
                       ))}
                    </div>
                 </div>
                 <div className="lg:col-span-2 bg-white p-6 lg:p-10 rounded-[40px] shadow-sm border border-slate-100 overflow-hidden">
                    <h3 className="text-xl font-black mb-6">Produtos e Disponibilidade</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20">
                       {products.map(p => (
                          <div key={p.id} className={`p-4 rounded-3xl border transition-all flex items-center justify-between ${p.active ? 'border-slate-50 bg-white' : 'border-slate-100 bg-slate-50 opacity-60'}`}>
                             <div className="flex gap-4 items-center">
                                <div className="w-14 h-14 bg-slate-100 rounded-xl flex items-center justify-center overflow-hidden">
                                    {p.image_url ? <img src={p.image_url} className="w-full h-full object-cover" /> : <PlusCircle className="text-slate-200"/>}
                                </div>
                                <div>
                                   <h5 className="font-bold text-slate-800 text-sm">{p.name}</h5>
                                   <p className="font-black text-green-600 text-sm">R$ {p.price.toFixed(2)}</p>
                                </div>
                             </div>
                             <button onClick={()=>toggleProduct(p.id)} className={`p-2.5 rounded-xl border transition-all ${p.active ? 'bg-green-50 text-green-600 border-green-100 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-100' : 'bg-slate-200 text-slate-500 border-slate-300 hover:bg-green-50 hover:text-green-600 hover:border-green-100'}`}>
                                <Power size={18} />
                             </button>
                          </div>
                       ))}
                    </div>
                 </div>
                </div>
              )}

              {activeTab === 'chats' && (
                <div className="bg-white rounded-[32px] lg:rounded-[40px] shadow-sm border border-slate-100 h-[calc(100vh-120px)] lg:h-[calc(100vh-250px)] flex flex-col lg:flex-row overflow-hidden">
                    <div className={`w-full lg:w-80 border-r border-slate-100 flex flex-col ${activeChatJid ? 'hidden lg:flex' : 'flex'}`}>
                        <div className="p-6 lg:p-8 border-b border-slate-50 font-black flex justify-between items-center">
                          <span>Clientes</span>
                          <span className="lg:hidden text-[10px] bg-slate-100 px-2 py-1 rounded-md">Toque para abrir</span>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            {customers.map(c => (
                                <div key={c.id} onClick={()=>loadChat(c)} className={`p-5 lg:p-6 border-b border-slate-50 cursor-pointer transition-colors ${activeChatJid === c.whatsapp_jid ? 'bg-orange-50' : 'hover:bg-slate-50'}`}>
                                    <p className="font-bold text-slate-800">{c.name}</p>
                                    <p className="text-[10px] text-slate-400 mt-1">{c.whatsapp_jid}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className={`flex-1 flex flex-col ${!activeChatJid ? 'hidden lg:flex' : 'flex'}`}>
                        {activeChatJid ? (
                            <>
                                <div className="p-4 lg:hidden border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
                                   <button onClick={() => setActiveChatJid('')} className="p-2 bg-white rounded-xl shadow-sm border border-slate-200">
                                      <X size={18} />
                                   </button>
                                   <p className="font-bold text-slate-800">{customers.find(c => c.whatsapp_jid === activeChatJid)?.name}</p>
                                </div>
                                <div className="flex-1 p-6 lg:p-8 overflow-y-auto space-y-4 bg-slate-50/20">
                                    {chatMessages.map((m, idx) => (
                                        <div key={idx} className={`flex ${m.is_from_me ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`p-4 rounded-2xl max-w-[85%] lg:max-w-md ${m.is_from_me ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20' : 'bg-white border border-slate-100 text-slate-800 shadow-sm'}`}>
                                                <p className="text-sm leading-relaxed">{m.text}</p>
                                                <p className={`text-[9px] mt-1.5 opacity-60 ${m.is_from_me ? 'text-white' : 'text-slate-400'}`}>
                                                  {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <form onSubmit={handleSendMessage} className="p-4 lg:p-6 border-t bg-white flex gap-2">
                                    <input value={chatInput} onChange={e=>setChatInput(e.target.value)} placeholder="Digite sua mensagem..." className="flex-1 bg-slate-50 p-4 rounded-xl border border-slate-200 outline-none focus:border-orange-500 transition-colors" />
                                    <button className="bg-orange-500 text-white px-6 lg:px-8 rounded-xl font-black hover:bg-orange-600 transition-colors shadow-lg shadow-orange-500/30">ENVIAR</button>
                                </form>
                            </>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-slate-300 font-bold p-10 text-center">
                                <Bell size={40} className="mb-4 opacity-20"/>
                                <p>Selecione um cliente para<br/>iniciar o atendimento</p>
                            </div>
                        )}
                    </div>
                </div>
              )}

              {activeTab === 'drivers' && (
                <div className="space-y-6 lg:space-y-8">
                   <div className="bg-indigo-600 p-6 lg:p-10 rounded-[32px] lg:rounded-[40px] text-white shadow-xl relative overflow-hidden">
                      <div className="relative z-10">
                        <h3 className="text-2xl lg:text-3xl font-black mb-2">Rede Entrega Global 🛵</h3>
                        <p className="opacity-80 text-sm lg:text-base">Seu estabelecimento está conectado à rede central de pilotos.</p>
                      </div>
                      <div className="absolute -right-10 -bottom-10 opacity-20 scale-150">
                        <Truck size={120} />
                      </div>
                   </div>
                   <div className="bg-white p-6 lg:p-8 rounded-[32px] lg:rounded-[40px] border border-slate-100 shadow-sm">
                      <h4 className="font-black text-lg lg:text-xl mb-6 flex items-center gap-2"><MapIcon/> Mapa Real-Time</h4>
                      <div className="h-[300px] lg:h-[400px] bg-slate-50 rounded-3xl overflow-hidden border">
                         {isLoaded && mapCenter ? (
                            <GoogleMap
                               mapContainerStyle={mapContainerStyle}
                               center={Object.values(activeDriversLocations)[0] as any || mapCenter}
                               zoom={14}
                               options={{ styles: uberMapStyle, disableDefaultUI: true, zoomControl: true }}
                            >
                               {Object.keys(activeDriversLocations).map(id => {
                                   const driverLoc = activeDriversLocations[id];
                                   const activeOrder = orders.find(o => o.id === driverLoc.orderId);
                                   
                                   return (
                                       <div key={id}>
                                           <Marker 
                                             position={driverLoc} 
                                             label={{ text: driverLoc.name || 'Piloto', color: 'orange', fontWeight: 'bold' }}
                                             icon={{ url: "https://cdn-icons-png.flaticon.com/512/3721/3721619.png", scaledSize: new window.google.maps.Size(30,30) }} 
                                           />
                                           {activeOrder && (
                                               <AdminRouteRenderer 
                                                   origin={driverLoc} 
                                                   destination={activeOrder.delivery_address} 
                                               />
                                           )}
                                       </div>
                                   );
                               })}
                            </GoogleMap>
                         ) : <div className="h-full flex items-center justify-center font-bold text-slate-300 animate-pulse text-sm">Carregando mapa...</div>}
                      </div>
                   </div>
                </div>
              )}

              {activeTab === 'reports' && (
                  <div className="space-y-10">
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100">
                           <BarChart3 size={32} className="text-orange-500 mb-4"/>
                           <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Vendas (Mensal)</p>
                           <h3 className="text-3xl font-black text-slate-800">R$ {reportStats?.totalRevenue?.toFixed(2) || '0.00'}</h3>
                        </div>
                        <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100">
                           <PieChart size={32} className="text-indigo-500 mb-4"/>
                           <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Total Pedidos</p>
                           <h3 className="text-3xl font-black text-slate-800">{reportStats?.totalOrders || 0}</h3>
                        </div>
                        <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100">
                           <CheckCircle2 size={32} className="text-green-500 mb-4"/>
                           <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Entregas Sucesso</p>
                           <h3 className="text-3xl font-black text-slate-800">{reportStats?.delivered || 0}</h3>
                        </div>
                     </div>

                     <div className="bg-white p-10 rounded-[40px] shadow-sm border border-slate-100">
                        <h3 className="text-xl font-black mb-8">Performance por Dia (Ganha-pão)</h3>
                        <div className="h-[250px] flex items-end gap-2 lg:gap-4 overflow-x-auto pb-4 scrollbar-hide">
                           {reportStats?.daily && Object.keys(reportStats.daily).sort().map(day => (
                              <div key={day} className="flex-1 min-w-[40px] flex flex-col items-center gap-2 group">
                                 <div 
                                   className="w-full bg-orange-500 rounded-t-xl transition-all group-hover:bg-orange-600 relative" 
                                   style={{ height: `${Math.max(10, (reportStats.daily[day] / Math.max(1, reportStats.totalRevenue || 1)) * 200)}px` }}
                                 >
                                     <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                        R${reportStats.daily[day].toFixed(0)}
                                     </div>
                                 </div>
                                 <p className="text-[10px] font-bold text-slate-400 truncate w-full text-center">{day.split('-')[2]}/{day.split('-')[1]}</p>
                              </div>
                           ))}
                           {!reportStats?.daily && <p className="w-full text-center text-slate-400 font-bold py-20">Nenhum dado para exibir ainda.</p>}
                        </div>
                     </div>
                  </div>
               )}

               {activeTab === 'marketing' && (
                  <div className="space-y-10">
                     <div className="bg-white p-10 rounded-[40px] shadow-sm border border-slate-100">
                        <h3 className="text-xl font-black mb-8 flex items-center gap-2 font-bold"><Ticket size={24}/> Criar Novo Cupom de Desconto</h3>
                        <form onSubmit={createCoupon} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                           <input placeholder="Ex: PITDOG20" required className="p-4 rounded-2xl bg-slate-50 border border-slate-200 uppercase font-bold" value={newCoupon.code} onChange={e=>setNewCoupon({...newCoupon, code: e.target.value})} />
                           <select className="p-4 rounded-2xl bg-slate-50 border border-slate-200 font-bold" value={newCoupon.type} onChange={e=>setNewCoupon({...newCoupon, type: e.target.value})}>
                              <option value="PERCENT">Porcentagem (%)</option>
                              <option value="FIXED">Valor Fixo (R$)</option>
                           </select>
                           <input type="number" placeholder="Valor" required className="p-4 rounded-2xl bg-slate-50 border border-slate-200 font-bold" value={newCoupon.value} onChange={e=>setNewCoupon({...newCoupon, value: parseFloat(e.target.value)})} />
                           <button className="bg-orange-500 text-white p-4 rounded-2xl font-black hover:bg-orange-600 transition-all">CRIAR CUPOM</button>
                        </form>
                     </div>

                     <div className="bg-white p-10 rounded-[40px] shadow-sm border border-slate-100">
                        <h3 className="text-xl font-black mb-8 font-bold">Cupons Ativos</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                           {coupons.map(c => (
                              <div key={c.id} className="p-6 bg-slate-50 rounded-[32px] border border-slate-100 relative group overflow-hidden">
                                 <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={()=>deleteCoupon(c.id)} className="p-2 bg-red-50 text-red-500 rounded-xl hover:bg-red-100"><Trash2 size={16}/></button>
                                 </div>
                                 <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest mb-2">CÓDIGO</p>
                                 <h4 className="text-2xl font-black text-slate-800 mb-4">{c.code}</h4>
                                 <div className="flex justify-between items-end">
                                    <div>
                                       <p className="text-[10px] font-bold text-slate-400 uppercase">Desconto</p>
                                       <p className="font-black text-slate-700">{c.type==='PERCENT'?`${c.value}%`:`R$ ${c.value.toFixed(2)}`}</p>
                                    </div>
                                    <div className="text-right">
                                       <p className="text-[10px] font-bold text-slate-400 uppercase">Status</p>
                                       <span className="px-3 py-1 bg-green-100 text-green-600 rounded-full text-[10px] font-bold">ATIVO</span>
                                    </div>
                                 </div>
                              </div>
                           ))}
                           {coupons.length === 0 && <p className="col-span-full py-10 text-center text-slate-400 italic font-medium">Você ainda não criou nenhum cupom promocional.</p>}
                        </div>
                     </div>
                  </div>
               )}

               {activeTab === 'settings' && (
                 <div className="max-w-4xl mx-auto space-y-8">
                    <div className="bg-white p-8 lg:p-10 rounded-[40px] shadow-sm border border-slate-100">
                        <h3 className="text-xl font-black mb-8 text-slate-800 flex items-center gap-2"><Settings size={20}/> Perfil do Estabelecimento</h3>
                        
                        <form onSubmit={updateStoreInfo} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">Nome da Hamburgueria / PitDog</label>
                                        <input 
                                          value={storeName} 
                                          onChange={e=>setStoreName(e.target.value)} 
                                          className="w-full bg-slate-50 p-4 rounded-2xl border border-slate-200 outline-none focus:border-orange-500 transition-colors font-bold"
                                        />
                                    </div>
                                    <div className="p-6 bg-slate-50 rounded-3xl border border-dashed border-slate-200 flex flex-col items-center text-center">
                                       <div className="w-20 h-20 bg-white rounded-2xl shadow-sm mb-4 flex items-center justify-center overflow-hidden border border-slate-100">
                                          {logoUrl ? <img src={logoUrl} alt="Preview" className="w-full h-full object-cover" /> : <PlusCircle className="text-slate-200"/>}
                                       </div>
                                       <label className="bg-slate-900 text-white px-6 py-2 rounded-xl text-xs font-bold cursor-pointer hover:bg-slate-800 transition-all">
                                          {isUploading ? 'Enviando...' : 'Carregar Logo'}
                                          <input type="file" className="hidden" onChange={handleLogoUpload} accept="image/*" />
                                       </label>
                                       <p className="text-[10px] text-slate-400 mt-2 font-medium">PNG ou JPG. Recomendado 512x512px.</p>
                                    </div>
                                </div>
                                <div className="bg-orange-50 p-8 rounded-[32px] border border-orange-100 flex flex-col justify-center">
                                    <h4 className="font-bold text-orange-900 mb-2">Dica de Branding</h4>
                                    <p className="text-sm text-orange-800/70 leading-relaxed">Uma logo bem definida e um nome cativante ajudam na retenção de clientes no seu cardápio digital.</p>
                                </div>
                            </div>
                            <div className="pt-4 border-t border-slate-50">
                                <button disabled={isUpdating} className="bg-orange-500 text-white px-10 py-4 rounded-2xl font-black shadow-lg shadow-orange-500/30 hover:bg-orange-600 transition-all disabled:opacity-50">
                                    {isUpdating ? 'SALVANDO...' : 'SALVAR ALTERAÇÕES'}
                                </button>
                            </div>
                        </form>
                    </div>

                    <div className="bg-white p-8 lg:p-10 rounded-[40px] shadow-sm border border-slate-100 text-center">
                        <QrCode size={40} className="mx-auto text-green-500 mb-4"/>
                        <h3 className="text-xl font-black mb-2">Conexão WhatsApp</h3>
                        <p className="text-sm text-slate-400 mb-8 max-w-xs mx-auto">Mantenha seu robô conectado para enviar atualizações de pedidos automaticamente.</p>
                        
                        {waStatus === 'CONNECTED' ? (
                        <button onClick={logoutWA} className="w-full lg:w-auto bg-red-50 text-red-500 px-10 py-4 rounded-2xl font-bold border border-red-100 hover:bg-red-100 transition-all">Desconectar Robô</button>
                        ) : (
                        <div className="space-y-6">
                            {waQr && <div className="bg-white p-4 border rounded-3xl inline-block shadow-sm"><QRCode value={waQr} size={180}/></div>}
                            <button onClick={connectWA} className="w-full lg:w-auto bg-green-500 text-white px-10 py-4 rounded-2xl font-bold shadow-lg shadow-green-500/20 hover:bg-green-600 transition-all">Gerar Novo QR Code</button>
                        </div>
                        )}
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

function AdminRouteRenderer({ origin, destination }: { origin: any, destination: string }) {
    const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);

    useEffect(() => {
        const directionsService = new google.maps.DirectionsService();
        directionsService.route(
            {
                origin,
                destination,
                travelMode: google.maps.TravelMode.DRIVING,
            },
            (result, status) => {
                if (status === google.maps.DirectionsStatus.OK) {
                    setDirections(result);
                }
            }
        );
    }, [origin, destination]);

    if (!directions) return null;
    return (
        <DirectionsRenderer 
            directions={directions} 
            options={{
                polylineOptions: { strokeColor: '#f97316', strokeWeight: 4, strokeOpacity: 0.6 },
                suppressMarkers: true
            }} 
        />
    );
}
