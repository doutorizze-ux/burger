import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../App';
import io from 'socket.io-client';
import { QrCode, LayoutDashboard, Settings, LogOut, Clock, Truck, Users, TrendingUp, Bell, PlusCircle, CheckCircle2, Map as MapIcon, Menu, X, Power, BarChart3, PieChart, Ticket, Trash2, Package } from 'lucide-react';
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
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: '', price: 0, description: '', image_url: '' });
  const [showExtraModal, setShowExtraModal] = useState(false);
  const [currentProductId, setCurrentProductId] = useState<string | null>(null);
  const [newExtra, setNewExtra] = useState({ name: '', price: 0 });
  
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

    socket.on('driver_offline', ({ driverId }) => {
        setActiveDriversLocations((prev: any) => {
            const newLocs = { ...prev };
            delete newLocs[driverId];
            return newLocs;
        });
    });

        socket.on('driver_offline', ({ driverId }) => {
            setActiveDriversLocations((prev: any) => {
                const newLocs = { ...prev };
                delete newLocs[driverId];
                return newLocs;
            });
        });

        return () => { socket.disconnect(); };
  }, [user]);

  const fetchData = () => {
    fetch('/api/orders', {headers}).then(r=>r.json()).then(setOrders);
    fetch('/api/categories', {headers}).then(r=>r.json()).then(setCategories);
    fetch('/api/products', {headers}).then(r=>r.json()).then(setProducts);
    fetch('/api/chats', {headers}).then(r=>r.json()).then(setCustomers);
    
    fetch('/api/drivers/online', {headers}).then(r=>r.json()).then(data => {
        const locations: any = {};
        data.filter((d:any) => d.latitude).forEach((d:any) => {
            locations[d.id] = { lat: d.latitude, lng: d.longitude, name: d.name };
        });
        setActiveDriversLocations(locations);
    });
    
    fetch('/api/reports/stats', {headers}).then(r=>r.json()).then(setReportStats);
    fetch('/api/coupons', {headers}).then(r=>r.json()).then(setCoupons);

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

  const addProduct = async (e: any) => {
    e.preventDefault();
    if(!selectedCategoryId) return alert('Selecione uma categoria primeiro');
    const res = await fetch('/api/products', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newProduct, category_id: selectedCategoryId })
    });
    if(res.ok) {
        setShowProductModal(false);
        setNewProduct({ name: '', price: 0, description: '', image_url: '' });
        fetchData();
    }
  };

  const addExtra = async (e: any) => {
    e.preventDefault();
    const res = await fetch(`/api/products/${currentProductId}/extras`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(newExtra)
    });
    if(res.ok) {
        setShowExtraModal(false);
        setNewExtra({ name: '', price: 0 });
        fetchData();
    }
  };

  const deleteExtra = async (id: string) => {
    if(!confirm('Remover este adicional?')) return;
    await fetch(`/api/extras/${id}`, { method: 'DELETE', headers });
    fetchData();
  };

  const deleteProduct = async (id: string) => {
    if(!confirm('Excluir este produto permanentemente?')) return;
    await fetch(`/api/products/${id}`, { method: 'DELETE', headers });
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
      <aside className={`fixed inset-y-0 left-0 z-50 w-80 bg-slate-900 text-slate-400 p-8 flex flex-col gap-8 shadow-2xl transition-transform duration-300 lg:relative lg:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
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
          <button onClick={()=>{setActiveTab('dashboard'); setIsMobileMenuOpen(false);}} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-medium transition-all ${activeTab==='dashboard'?'bg-orange-500 text-white shadow-md shadow-orange-500/20': 'hover:bg-slate-800 hover:text-white'}`}>
            <LayoutDashboard size={20}/> Dashboard
          </button>
          <button onClick={()=>{setActiveTab('orders'); setIsMobileMenuOpen(false);}} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-medium transition-all ${activeTab==='orders'?'bg-orange-500 text-white shadow-md shadow-orange-500/20': 'hover:bg-slate-800 hover:text-white'}`}>
            <Clock size={20}/> Pedidos Ativos
          </button>
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
        <header className="h-24 bg-white/70 backdrop-blur-xl border-b border-slate-200 px-10 flex items-center justify-between sticky top-0 z-20">
            <div className="flex items-center gap-4">
                <button className="lg:hidden p-2 text-slate-800 hover:bg-slate-50 rounded-xl" onClick={() => setIsMobileMenuOpen(true)}>
                    <Menu size={24} />
                </button>
                <div>
                  <h1 className="text-2xl font-black text-slate-800 capitalize">{activeTab}</h1>
                  <p className="text-[10px] font-bold text-slate-400 tracking-wide uppercase">PitDog SaaS Node</p>
                </div>
            </div>
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100">
                    <span className={`w-2 h-2 rounded-full ${waStatus === 'CONNECTED' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
                    <span className="text-[10px] font-black text-slate-500 uppercase">{waStatus === 'CONNECTED' ? 'ROBÔ ONLINE' : 'ROBÔ OFFLINE'}</span>
                </div>
            </div>
        </header>

        <main className="flex-1 overflow-y-auto p-10 bg-slate-50/50">
          <AnimatePresence mode="wait">
            <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="h-full">
              {activeTab === 'catalog' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 relative">
                   <div className="bg-white p-10 rounded-[40px] shadow-sm border border-slate-100">
                      <h3 className="text-xl font-black mb-6 text-slate-800">Categorias</h3>
                      <form onSubmit={addCategory} className="flex gap-2 mb-8">
                         <input required placeholder="Nova Categoria..." className="flex-1 p-4 rounded-2xl bg-slate-50 border border-slate-200 outline-none" value={newCat} onChange={e=>setNewCat(e.target.value)} />
                         <button className="bg-slate-900 text-white px-6 rounded-2xl font-black shadow-lg shadow-slate-900/20">+</button>
                      </form>
                    <div className="space-y-3">
                       {categories.map(c => (
                          <div 
                            key={c.id} 
                            onClick={() => setSelectedCategoryId(c.id)}
                            className={`p-5 rounded-3xl cursor-pointer transition-all border ${selectedCategoryId === c.id ? 'bg-orange-500 text-white border-orange-400 shadow-lg shadow-orange-500/20' : 'bg-slate-50 text-slate-700 border-slate-100 hover:bg-slate-100'}`}
                          >
                             <div className="flex justify-between items-center">
                                <span className="font-black text-sm uppercase">{c.name}</span>
                                <div onClick={(e) => { e.stopPropagation(); toggleCategory(c.id); }} className={`w-2 h-2 rounded-full ${c.active ? 'bg-green-400' : 'bg-slate-300'}`}></div>
                             </div>
                          </div>
                       ))}
                    </div>
                  </div>

                  <div className="lg:col-span-2 bg-white p-10 rounded-[40px] shadow-sm border border-slate-100 min-h-[500px]">
                     <div className="flex justify-between items-center mb-10">
                        <div>
                            <h3 className="text-2xl font-black text-slate-800">Produtos</h3>
                            <p className="text-xs text-slate-400 font-bold uppercase">{categories.find(c=>c.id===selectedCategoryId)?.name || 'Todos os itens'}</p>
                        </div>
                        {selectedCategoryId && (
                            <button onClick={()=>setShowProductModal(true)} className="bg-orange-500 text-white px-6 py-3.5 rounded-2xl font-black text-xs shadow-lg shadow-orange-500/30 hover:bg-orange-600 transition-all">
                                + NOVO PRODUTO
                            </button>
                        )}
                     </div>

                     <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pb-20">
                        {products.filter(p => !selectedCategoryId || p.category_id === selectedCategoryId).map(p => (
                           <div key={p.id} className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden flex flex-col hover:shadow-xl transition-all group">
                              <div className="p-8 pb-4">
                                 <div className="flex gap-6 mb-6">
                                    <div className="w-24 h-24 bg-slate-100 rounded-[32px] overflow-hidden shadow-inner flex items-center justify-center border border-slate-50">
                                        {p.image_url ? <img src={p.image_url} className="w-full h-full object-cover" /> : <PlusCircle className="text-slate-200" size={32}/>}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-start mb-1">
                                            <h5 className="font-black text-slate-800 text-base uppercase leading-tight">{p.name}</h5>
                                            <button onClick={()=>toggleProduct(p.id)} className={`p-2 rounded-xl transition-all ${p.active ? 'text-green-500 bg-green-50' : 'text-slate-300 bg-slate-50'}`}>
                                                <Power size={18} />
                                            </button>
                                        </div>
                                        <p className="font-black text-green-600 text-xl mb-2">R$ {p.price.toFixed(2)}</p>
                                    </div>
                                 </div>
                                 
                                 <div className="bg-slate-50 rounded-3xl p-5 border border-slate-100">
                                    <div className="flex justify-between items-center mb-4">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Adicionais / Extras</p>
                                        <button onClick={()=>{setCurrentProductId(p.id); setShowExtraModal(true)}} className="text-[10px] font-black text-orange-500 hover:text-orange-600 px-3 py-1 bg-orange-50 rounded-lg">+ ADD NOVO</button>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {p.extras?.map((ex:any) => (
                                            <div key={ex.id} className="bg-white pl-4 pr-2 py-2 rounded-full border border-slate-100 text-[10px] font-bold text-slate-600 flex items-center gap-2 group/extra">
                                                <span>{ex.name} (+ R${ex.price.toFixed(2)})</span>
                                                <button onClick={()=>deleteExtra(ex.id)} className="w-6 h-6 flex items-center justify-center bg-red-50 text-red-400 rounded-full opacity-0 group-hover/extra:opacity-100 transition-opacity"><Trash2 size={12}/></button>
                                            </div>
                                        ))}
                                        {(!p.extras || p.extras.length === 0) && <p className="text-[10px] text-slate-300 font-medium py-1 italic">Nenhum adicional configurado</p>}
                                    </div>
                                 </div>
                              </div>
                              <div className="px-8 py-5 bg-slate-50 border-t border-slate-100 mt-auto flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={()=>deleteProduct(p.id)} className="text-red-400 hover:text-red-500 transition-colors flex items-center gap-2 text-xs font-bold">
                                      <Trash2 size={16}/> EXCLUIR ITEM
                                  </button>
                              </div>
                           </div>
                        ))}
                        {selectedCategoryId && products.filter(p => !selectedCategoryId || p.category_id === selectedCategoryId).length === 0 && (
                            <div className="col-span-full py-20 text-center opacity-30">
                                <Package size={64} className="mx-auto mb-6 text-slate-300"/>
                                <p className="font-black text-xl text-slate-400">Essa categoria ainda está vazia.</p>
                                <p className="text-slate-400 text-sm mt-2">Clique no botão acima para adicionar o primeiro hambúrguer!</p>
                            </div>
                        )}
                        {!selectedCategoryId && <div className="col-span-full py-20 text-center opacity-30 font-black text-slate-400">SELECIONE UMA CATEGORIA PARA VER OS PRODUTOS</div>}
                     </div>
                  </div>

                  {showProductModal && (
                      <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
                          <motion.div initial={{scale:0.9, opacity:0}} animate={{scale:1, opacity:1}} className="bg-white w-full max-w-lg rounded-[48px] p-12 shadow-2xl relative">
                              <button onClick={()=>setShowProductModal(false)} className="absolute top-10 right-10 text-slate-300 hover:text-slate-800 p-2"><X/></button>
                              <h3 className="text-3xl font-black text-slate-800 mb-2">Novo Item</h3>
                              <p className="text-slate-400 text-sm mb-10 font-medium">Cadastre os detalhes do seu PitDog clássico.</p>
                              
                              <form onSubmit={addProduct} className="space-y-6">
                                  <div className="grid grid-cols-2 gap-5">
                                      <div className="col-span-2">
                                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block px-2">Nome do Produto</label>
                                          <input required value={newProduct.name} onChange={e=>setNewProduct({...newProduct, name: e.target.value})} className="w-full bg-slate-50 p-5 rounded-[24px] border border-slate-200 focus:border-orange-500 outline-none font-bold" placeholder="Ex: X-Salada Especial" />
                                      </div>
                                      <div>
                                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block px-2">Preço de Venda</label>
                                          <input required type="number" step="0.01" value={newProduct.price} onChange={e=>setNewProduct({...newProduct, price: parseFloat(e.target.value)})} className="w-full bg-slate-50 p-5 rounded-[24px] border border-slate-200 focus:border-orange-500 outline-none font-bold" />
                                      </div>
                                      <div>
                                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block px-2">URL da Foto</label>
                                          <input value={newProduct.image_url} onChange={e=>setNewProduct({...newProduct, image_url: e.target.value})} className="w-full bg-slate-50 p-5 rounded-[24px] border border-slate-200 focus:border-orange-500 outline-none font-bold" placeholder="https://..." />
                                      </div>
                                      <div className="col-span-2">
                                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block px-2">Ingredientes / Descrição</label>
                                          <textarea value={newProduct.description} onChange={e=>setNewProduct({...newProduct, description: e.target.value})} className="w-full bg-slate-50 p-5 rounded-[24px] border border-slate-200 focus:border-orange-500 outline-none font-bold h-24" placeholder="Hamburguer 150g, alface, tomate, maionese artesanal..." />
                                      </div>
                                  </div>
                                  <button className="w-full bg-orange-500 text-white py-6 rounded-3xl font-black shadow-lg shadow-orange-500/40 hover:bg-orange-600 transition-all text-sm tracking-widest uppercase">
                                      CADASTRAR ITEM AGORA
                                  </button>
                              </form>
                          </motion.div>
                      </div>
                  )}

                  {showExtraModal && (
                      <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
                          <motion.div initial={{scale:0.9, opacity:0}} animate={{scale:1, opacity:1}} className="bg-white w-full max-w-sm rounded-[48px] p-12 shadow-2xl relative">
                              <button onClick={()=>setShowExtraModal(false)} className="absolute top-10 right-10 text-slate-300 hover:text-slate-800 p-2"><X/></button>
                              <h3 className="text-2xl font-black text-slate-800 mb-2">Adicional</h3>
                              <p className="text-slate-400 text-xs mb-8 font-medium">Configure extras para este produto.</p>
                              
                              <form onSubmit={addExtra} className="space-y-6">
                                  <div>
                                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block px-2">Nome do Extra</label>
                                      <input required value={newExtra.name} onChange={e=>setNewExtra({...newExtra, name: e.target.value})} className="w-full bg-slate-50 p-5 rounded-2xl border border-slate-200 font-bold" placeholder="Ex: + Bacon" />
                                  </div>
                                  <div>
                                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block px-2">Preço (R$)</label>
                                      <input required type="number" step="0.01" value={newExtra.price} onChange={e=>setNewExtra({...newExtra, price: parseFloat(e.target.value)})} className="w-full bg-slate-50 p-5 rounded-2xl border border-slate-200 font-bold" />
                                  </div>
                                  <button className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black shadow-lg shadow-slate-900/10 hover:bg-slate-800 transition-all text-xs tracking-widest">
                                      CONFIRMAR ADICIONAL
                                  </button>
                              </form>
                          </motion.div>
                      </div>
                  )}
                </div>
               )}

              {activeTab === 'dashboard' && (
                <div className="space-y-10">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                    <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100">
                       <TrendingUp size={24} className="text-orange-500 mb-4"/>
                       <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Vendas Hoje</p>
                       <h3 className="text-3xl font-black text-slate-800">R$ {orders.reduce((acc,o)=>acc+o.total, 0).toFixed(2)}</h3>
                    </div>
                    <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100">
                       <Clock size={24} className="text-blue-500 mb-4"/>
                       <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Pedidos Ativos</p>
                       <h3 className="text-3xl font-black text-slate-800">{orders.filter(o=>o.status === 'PENDING').length}</h3>
                    </div>
                    <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100">
                       <Users size={24} className="text-indigo-500 mb-4"/>
                       <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Clientes</p>
                       <h3 className="text-3xl font-black text-slate-800">{customers.length}</h3>
                    </div>
                    <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100">
                       <CheckCircle2 size={24} className="text-green-500 mb-4"/>
                       <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Concluídos</p>
                       <h3 className="text-3xl font-black text-slate-800">{orders.filter(o=>o.status === 'DELIVERED').length}</h3>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                     <div className="bg-white p-10 rounded-[48px] shadow-sm border border-slate-100">
                        <h3 className="text-xl font-black text-slate-800 mb-8 font-bold uppercase tracking-tight">Pedidos Recentes</h3>
                        <div className="space-y-4">
                           {orders.slice(0,5).map(o => (
                              <div key={o.id} className="p-5 bg-slate-50 flex items-center justify-between rounded-3xl border border-slate-100">
                                 <div>
                                    <p className="font-bold text-slate-800">Pedido #{o.id.slice(-4)}</p>
                                    <p className="text-[10px] font-bold text-slate-400">{new Date(o.created_at).toLocaleTimeString()}</p>
                                 </div>
                                 <p className="font-black text-slate-800">R$ {o.total.toFixed(2)}</p>
                              </div>
                           ))}
                        </div>
                     </div>
                     <div className="bg-gradient-to-br from-indigo-500 to-blue-600 p-10 rounded-[48px] shadow-2xl text-white relative overflow-hidden group">
                        <div className="relative z-10">
                            <h4 className="text-3xl font-black mb-4 tracking-tighter">Link do Seu<br/>Cardápio Digital</h4>
                            <div className="bg-white/10 p-5 rounded-2xl border border-white/20 font-mono break-all text-sm mb-6 backdrop-blur-md">
                                {window.location.origin}/catalogo/{user?.slug}
                            </div>
                            <button onClick={() => {
                                navigator.clipboard.writeText(`${window.location.origin}/catalogo/${user?.slug}`);
                                toast.success("Link copiado!");
                            }} className="w-full bg-white text-indigo-600 font-black py-4 rounded-2xl shadow-xl hover:scale-[1.02] transition-all">COPIAR LINK AGORA</button>
                        </div>
                        <LayoutDashboard size={150} className="absolute -right-10 -bottom-10 opacity-10 group-hover:rotate-12 transition-transform" />
                     </div>
                  </div>
                </div>
              )}

              {activeTab === 'orders' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-10">
                   {orders.map(o => (
                      <div key={o.id} className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden flex flex-col hover:shadow-xl transition-all">
                         <div className="p-8 pb-4">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h4 className="text-xl font-black text-slate-800">Pedido #{o.id.slice(-6)}</h4>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{new Date(o.created_at).toLocaleTimeString()}</p>
                                </div>
                                <span className="px-3 py-1 bg-orange-100 text-orange-600 rounded-full text-[10px] font-black uppercase tracking-widest">{o.status}</span>
                            </div>
                            <div className="space-y-3 mb-8 bg-slate-50 p-5 rounded-3xl border border-slate-100 shadow-inner">
                               {o.items?.map((it:any) => (
                                   <div key={it.id} className="text-sm text-slate-600 flex justify-between items-center bg-white/50 p-3 rounded-xl">
                                       <span className="font-bold">{it.quantity}x {it.product.name}</span>
                                       <span className="font-black text-slate-800">R$ {it.unit_price.toFixed(2)}</span>
                                   </div>
                               ))}
                            </div>
                            <div className="flex justify-between text-xl font-black text-slate-800 border-t border-slate-100 pt-5">
                                <span>Total</span>
                                <span className="text-2xl text-orange-500">R$ {o.total.toFixed(2)}</span>
                            </div>
                         </div>
                         <div className="p-6 bg-slate-50 flex gap-3 mt-auto">
                            {o.status === 'PENDING' && (
                                <button onClick={()=>updateOrderStatus(o.id, 'PREPARING')} className="flex-1 bg-green-500 text-white py-4 rounded-2xl font-black shadow-lg shadow-green-500/20 hover:bg-green-600 transition-all">ACEITAR AGORA</button>
                            )}
                            {o.status === 'PREPARING' && (
                                 <button onClick={()=>updateOrderStatus(o.id, 'DELIVERED')} className="flex-1 bg-slate-900 text-white py-4 rounded-2xl font-black shadow-lg shadow-slate-900/20 hover:bg-slate-800 transition-all flex items-center justify-center gap-2">
                                     <Truck size={18}/> ENVIAR ENTREGA
                                 </button>
                            )}
                            {o.status === 'DELIVERED' && (
                                <div className="flex-1 text-center py-4 text-green-600 font-black text-xs uppercase tracking-widest">Produto Entregue</div>
                            )}
                         </div>
                      </div>
                   ))}
                   {orders.length === 0 && <div className="col-span-full py-20 text-center font-black text-slate-300">NENHUM PEDIDO ATIVO NO MOMENTO</div>}
                </div>
              )}

              {activeTab === 'chats' && (
                <div className="bg-white rounded-[48px] shadow-sm border border-slate-100 h-[calc(100vh-250px)] flex flex-col lg:flex-row overflow-hidden">
                    <div className="w-full lg:w-96 border-r border-slate-50 flex flex-col">
                        <div className="p-8 border-b border-slate-50 font-black text-slate-800 uppercase tracking-widest text-xs">Conversas Ativas</div>
                        <div className="flex-1 overflow-y-auto">
                            {customers.map(c => (
                                <div key={c.id} onClick={()=>loadChat(c)} className={`p-6 border-b border-slate-50 cursor-pointer transition-all ${activeChatJid === c.whatsapp_jid ? 'bg-orange-50' : 'hover:bg-slate-50'}`}>
                                    <div className="flex justify-between items-center">
                                        <p className="font-black text-slate-800 uppercase tracking-tight">{c.name}</p>
                                        <p className="text-[9px] font-bold text-slate-400">{c.whatsapp_jid.split('@')[0]}</p>
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Status: Atendido</p>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="flex-1 flex flex-col bg-slate-50/20">
                        {activeChatJid ? (
                            <>
                                <div className="flex-1 p-10 overflow-y-auto space-y-6 scrollbar-hide">
                                    {chatMessages.map((m, idx) => (
                                        <div key={idx} className={`flex ${m.is_from_me ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`p-5 rounded-3xl max-w-lg shadow-sm ${m.is_from_me ? 'bg-orange-500 text-white' : 'bg-white border border-slate-100 text-slate-800'}`}>
                                                <p className="text-sm leading-relaxed font-bold">{m.text}</p>
                                                <p className={`text-[9px] mt-2 font-black opacity-50 ${m.is_from_me ? 'text-white' : 'text-slate-400'}`}>
                                                  {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <form onSubmit={handleSendMessage} className="p-8 bg-white border-t border-slate-50 flex gap-4">
                                    <input value={chatInput} onChange={e=>setChatInput(e.target.value)} placeholder="Escreva sua mensagem aqui..." className="flex-1 bg-slate-50 px-6 py-4 rounded-2xl border border-slate-200 outline-none focus:border-orange-500 font-bold" />
                                    <button className="bg-orange-500 text-white px-10 rounded-2xl font-black shadow-lg shadow-orange-500/20 hover:bg-orange-600 transition-all">ENVIAR</button>
                                </form>
                            </>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-slate-300 font-black py-20 text-center uppercase tracking-widest">
                                <PlusCircle size={60} className="mb-6 opacity-10"/>
                                <p>Selecione um cliente para<br/>iniciar o atendimento pelo robô</p>
                            </div>
                        )}
                    </div>
                </div>
              )}

              {activeTab === 'drivers' && (
                <div className="space-y-10">
                   <div className="bg-slate-900 p-12 rounded-[48px] text-white shadow-2xl relative overflow-hidden group">
                      <div className="relative z-10">
                        <h3 className="text-4xl font-black mb-2 tracking-tighter">Flux Drivers Global 🌐</h3>
                        <p className="opacity-60 text-lg font-medium max-w-md">Gerencie sua rede de entregas em tempo real com rastreamento via WebSocket.</p>
                      </div>
                      <Truck size={180} className="absolute -right-10 -bottom-10 opacity-10 group-hover:translate-x-4 transition-transform text-orange-500" />
                   </div>
                   <div className="bg-white p-10 rounded-[48px] border border-slate-100 shadow-sm">
                      <h4 className="font-black text-xl mb-8 flex items-center gap-3"><MapIcon className="text-orange-500"/> Visualização do Campo</h4>
                      <div className="h-[500px] bg-slate-50 rounded-[40px] overflow-hidden border border-slate-100 shadow-inner translate-z-0">
                         {isLoaded && mapCenter ? (
                            <GoogleMap
                               mapContainerStyle={{width:'100%', height:'100%'}}
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
                                             label={{ text: driverLoc.name || 'Piloto', color: '#f97316', fontWeight: '900', fontSize: '12px' }}
                                             icon={{ url: "https://cdn-icons-png.flaticon.com/512/3721/3721619.png", scaledSize: new window.google.maps.Size(40,40) }} 
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
                         ) : <div className="h-full flex items-center justify-center font-black text-slate-300 animate-pulse uppercase tracking-widest text-xs">Sincronizando satélite...</div>}
                      </div>
                   </div>
                </div>
              )}

              {activeTab === 'reports' && (
                <div className="space-y-12">
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                       <div className="bg-white p-10 rounded-[48px] border border-slate-100 shadow-sm">
                          <BarChart3 size={32} className="text-orange-500 mb-4"/>
                          <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Vendas Acumuladas</p>
                          <h3 className="text-4xl font-black text-slate-800">R$ {reportStats?.totalRevenue?.toFixed(2) || '0.00'}</h3>
                       </div>
                       <div className="bg-white p-10 rounded-[48px] border border-slate-100 shadow-sm">
                          <PieChart size={32} className="text-indigo-500 mb-4"/>
                          <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Fluxo de Pedidos</p>
                          <h3 className="text-4xl font-black text-slate-800">{reportStats?.totalOrders || 0}</h3>
                       </div>
                       <div className="bg-white p-10 rounded-[48px] border border-slate-100 shadow-sm">
                          <CheckCircle2 size={32} className="text-green-500 mb-4"/>
                          <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Entregas Finalizadas</p>
                          <h3 className="text-4xl font-black text-slate-800">{reportStats?.delivered || 0}</h3>
                       </div>
                   </div>
                   
                   <div className="bg-white p-12 rounded-[56px] border border-slate-100 shadow-sm overflow-hidden">
                      <h3 className="text-2xl font-black text-slate-800 mb-10 tracking-tight flex items-center gap-3">
                          Relatório de Ganha-pão <span className="text-slate-300 font-medium font-sans">| Performance Diária</span>
                      </h3>
                      <div className="h-[300px] flex items-end gap-5 overflow-x-auto pb-6 scrollbar-hide">
                         {reportStats?.daily && Object.keys(reportStats.daily).sort().map(day => (
                            <div key={day} className="flex-1 min-w-[60px] flex flex-col items-center gap-4 group">
                               <div 
                                 className="w-full bg-orange-500 rounded-3xl transition-all group-hover:bg-orange-600 relative cursor-pointer" 
                                 style={{ height: `${Math.max(20, (reportStats.daily[day] / Math.max(1, reportStats.totalRevenue || 1)) * 250)}px` }}
                               >
                                   <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] px-3 py-2 rounded-xl opacity-0 group-hover:opacity-100 transition-all font-black whitespace-nowrap z-10 shadow-xl border border-white/10">
                                      R${reportStats.daily[day].toFixed(2)}
                                   </div>
                               </div>
                               <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter whitespace-nowrap">{day.split('-')[2]}/{day.split('-')[1]}</p>
                            </div>
                         ))}
                      </div>
                   </div>
                </div>
              )}

              {activeTab === 'marketing' && (
                  <div className="space-y-12">
                     <div className="bg-white p-12 rounded-[56px] shadow-sm border border-slate-100">
                        <h3 className="text-2xl font-black mb-10 flex items-center gap-3 font-bold uppercase tracking-tight text-slate-800"><Ticket size={32} className="text-orange-500"/> Novo Cupom Promocional</h3>
                        <form onSubmit={createCoupon} className="grid grid-cols-1 md:grid-cols-4 gap-6">
                           <div className="space-y-2">
                             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">Código do Cupom</label>
                             <input placeholder="Ex: PITDOG20" required className="w-full p-5 rounded-3xl bg-slate-50 border border-slate-200 uppercase font-black text-orange-600 outline-none focus:border-orange-500" value={newCoupon.code} onChange={e=>setNewCoupon({...newCoupon, code: e.target.value})} />
                           </div>
                           <div className="space-y-2">
                             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">Tipo de Desconto</label>
                             <select className="w-full p-5 rounded-3xl bg-slate-50 border border-slate-200 font-black outline-none appearance-none" value={newCoupon.type} onChange={e=>setNewCoupon({...newCoupon, type: e.target.value})}>
                                <option value="PERCENT">Porcentagem (%)</option>
                                <option value="FIXED">Valor Fixo (R$)</option>
                             </select>
                           </div>
                           <div className="space-y-2">
                             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">Valor</label>
                             <input type="number" placeholder="0" required className="w-full p-5 rounded-3xl bg-slate-50 border border-slate-200 font-black" value={newCoupon.value} onChange={e=>setNewCoupon({...newCoupon, value: parseFloat(e.target.value)})} />
                           </div>
                           <div className="flex items-end">
                             <button className="w-full bg-slate-900 text-white p-5 rounded-3xl font-black shadow-xl hover:bg-slate-800 transition-all uppercase text-xs tracking-widest">Ativar Cupom</button>
                           </div>
                        </form>
                     </div>

                     <div className="bg-white p-12 rounded-[56px] shadow-sm border border-slate-100">
                        <h3 className="text-2xl font-black mb-10 text-slate-800 uppercase tracking-tight">Campanhas Ativas</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                           {coupons.map(c => (
                              <div key={c.id} className="p-10 bg-slate-900 rounded-[48px] relative group overflow-hidden shadow-2xl">
                                 <div className="absolute top-8 right-8 p-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                    <button onClick={()=>deleteCoupon(c.id)} className="w-10 h-10 flex items-center justify-center bg-red-500/10 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all"><Trash2 size={18}/></button>
                                 </div>
                                 <div className="relative z-10">
                                    <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest mb-4">DESCONTO ATIVO ✨</p>
                                    <h4 className="text-4xl font-black text-white mb-8 tracking-tighter">{c.code}</h4>
                                    <div className="flex justify-between items-end border-t border-white/10 pt-8">
                                       <div>
                                          <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Impacto</p>
                                          <p className="text-2xl font-black text-white">{c.type==='PERCENT'?`${c.value}% OFF`:`R$ ${c.value.toFixed(2)}`}</p>
                                       </div>
                                       <div className="text-right">
                                          <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">Status</p>
                                          <span className="px-3 py-1 bg-green-500 text-white rounded-lg text-[10px] font-black uppercase tracking-widest">Online</span>
                                       </div>
                                    </div>
                                 </div>
                                 <Ticket size={120} className="absolute -left-10 -bottom-10 text-white opacity-[0.03] rotate-12" />
                              </div>
                           ))}
                        </div>
                     </div>
                  </div>
              )}

              {activeTab === 'settings' && (
                 <div className="max-w-4xl mx-auto space-y-12 h-screen">
                    <div className="bg-white p-12 rounded-[56px] shadow-sm border border-slate-100">
                        <h3 className="text-2xl font-black mb-10 text-slate-800 flex items-center gap-3"><Settings size={28} className="text-orange-500"/> Identidade da Marca</h3>
                        <form onSubmit={updateStoreInfo} className="space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                <div className="space-y-6">
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2 block">Nome que Aparece no Cardápio</label>
                                        <input value={storeName} onChange={e=>setStoreName(e.target.value)} className="w-full bg-slate-50 p-5 rounded-3xl border border-slate-200 outline-none focus:border-orange-500 font-black text-lg" />
                                    </div>
                                    <div className="p-8 bg-slate-50 rounded-[40px] border border-dashed border-slate-200 flex flex-col items-center text-center group cursor-pointer hover:bg-slate-100 transition-all">
                                       <div className="w-24 h-24 bg-white rounded-3xl shadow-xl mb-6 flex items-center justify-center overflow-hidden border border-slate-100 group-hover:scale-105 transition-transform">
                                          {logoUrl ? <img src={logoUrl} alt="Preview" className="w-full h-full object-cover" /> : <PlusCircle className="text-slate-200" size={32}/>}
                                       </div>
                                       <label className="bg-slate-900 text-white px-8 py-3 rounded-2xl text-[10px] font-black tracking-widest uppercase cursor-pointer hover:bg-orange-500 transition-colors shadow-lg shadow-slate-900/20">
                                          {isUploading ? 'ENVIANDO...' : 'Trocar Logotipo'}
                                          <input type="file" className="hidden" onChange={handleLogoUpload} accept="image/*" />
                                       </label>
                                    </div>
                                </div>
                                <div className="bg-orange-600 p-12 rounded-[48px] text-white flex flex-col justify-center relative overflow-hidden group">
                                    <div className="relative z-10">
                                        <h4 className="text-2xl font-black mb-4 tracking-tighter">Dica de Sucesso 🚀</h4>
                                        <p className="text-orange-100 text-sm leading-relaxed font-bold">Logos redondas ou quadradas funcionam melhor no chat do WhatsApp e na vitrine do seu cardápio digital.</p>
                                    </div>
                                    <PlusCircle size={150} className="absolute -right-10 -bottom-10 opacity-20 group-hover:scale-110 transition-transform"/>
                                </div>
                            </div>
                            <div className="pt-8 border-t border-slate-50">
                                <button disabled={isUpdating} className="bg-orange-500 text-white px-12 py-5 rounded-3xl font-black shadow-2xl shadow-orange-500/40 hover:bg-orange-600 transition-all disabled:opacity-50 text-xs tracking-widest uppercase">
                                    {isUpdating ? 'PROCESSANDO...' : 'SALVAR IDENTIDADE'}
                                </button>
                            </div>
                        </form>
                    </div>

                    <div className="bg-slate-900 p-12 rounded-[56px] shadow-2xl text-center relative overflow-hidden group">
                        <QrCode size={120} className="mx-auto text-green-500 mb-6 opacity-80 group-hover:scale-110 transition-transform"/>
                        <h3 className="text-3xl font-black mb-4 text-white tracking-tighter">Configuração do Robô</h3>
                        <p className="text-slate-500 text-sm mb-12 max-w-sm mx-auto font-bold uppercase tracking-widest">Escaneie o código para seu PitDog começar a aceitar pedidos automaticamente.</p>
                        
                        {waStatus === 'CONNECTED' ? (
                        <div className="space-y-4">
                            <div className="inline-flex items-center gap-2 bg-green-500/10 text-green-500 px-6 py-2 rounded-full font-black text-[10px] uppercase tracking-widest mb-4">Sincronizado com Sucesso ✅</div>
                            <br/>
                            <button onClick={logoutWA} className="w-full lg:w-auto bg-white/10 text-white px-12 py-5 rounded-3xl font-black border border-white/20 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30 transition-all text-xs tracking-widest uppercase">Desconectar Robô</button>
                        </div>
                        ) : (
                        <div className="space-y-10">
                            {waQr && <div className="bg-white p-8 rounded-[40px] inline-block shadow-2xl border-4 border-slate-800"><QRCode value={waQr} size={200} /></div>}
                            <br/>
                            <button onClick={connectWA} className="w-full lg:w-auto bg-green-500 text-white px-12 py-5 rounded-3xl font-black shadow-2xl shadow-green-500/30 hover:bg-green-600 transition-all text-xs tracking-widest uppercase">Gerar Novo QR Code de Acesso</button>
                        </div>
                        )}
                        <LogOut size={200} className="absolute -left-20 -bottom-20 opacity-[0.02] -rotate-12"/>
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
                polylineOptions: { strokeColor: '#f97316', strokeWeight: 4, strokeOpacity: 1 },
                suppressMarkers: true
            }} 
        />
    );
}
