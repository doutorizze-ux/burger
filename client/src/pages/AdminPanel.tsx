import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../App';
import io from 'socket.io-client';
import { QrCode, LayoutDashboard, Settings, LogOut, Clock, Truck, Users, TrendingUp, Bell, PlusCircle, CheckCircle2, Map as MapIcon } from 'lucide-react';
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
    await fetch('/api/whatsapp/logout', { method: 'POST', headers });
    setWaStatus('DISCONNECTED');
    setWaQr('');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans overflow-hidden">
      <aside className="w-80 bg-slate-900 text-slate-400 p-8 flex flex-col gap-8 shadow-2xl relative z-30">
        <div className="flex items-center gap-4 px-2">
          <div className="bg-orange-500 text-white p-2.5 rounded-2xl shadow-lg shadow-orange-500/30 font-bold text-xl flex items-center justify-center">🍔</div>
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

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-24 bg-white/70 backdrop-blur-xl border-b border-slate-200 px-10 flex items-center justify-between sticky top-0 z-20">
            <div>
               <h1 className="text-2xl font-black text-slate-800 capitalize">{activeTab}</h1>
               <p className="text-xs font-bold text-slate-400 tracking-wide uppercase">PitDog SaaS Node</p>
            </div>
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100">
                    <span className={`w-2 h-2 rounded-full ${waStatus === 'CONNECTED' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
                    <span className="text-[10px] font-black text-slate-500">{waStatus === 'CONNECTED' ? 'ROBÔ CONECTADO' : 'ROBÔ OFFLINE'}</span>
                </div>
            </div>
        </header>

        <main className="flex-1 overflow-y-auto p-10 bg-slate-50/50">
          <AnimatePresence mode="wait">
            <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="h-full">
              {activeTab === 'dashboard' && (
                <div className="space-y-10">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                    <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100">
                       <TrendingUp size={24} className="text-orange-500 mb-4"/>
                       <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Vendas Hoje</p>
                       <h3 className="text-3xl font-black text-slate-800">R$ {orders.reduce((acc,o)=>acc+o.total, 0).toFixed(2)}</h3>
                    </div>
                    <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100">
                       <Clock size={24} className="text-blue-500 mb-4"/>
                       <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Pedidos Ativos</p>
                       <h3 className="text-3xl font-black text-slate-800">{orders.filter(o=>o.status === 'PENDING').length}</h3>
                    </div>
                    <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100">
                       <Users size={24} className="text-indigo-500 mb-4"/>
                       <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Clientes</p>
                       <h3 className="text-3xl font-black text-slate-800">{customers.length}</h3>
                    </div>
                    <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100">
                       <CheckCircle2 size={24} className="text-green-500 mb-4"/>
                       <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Concluídos</p>
                       <h3 className="text-3xl font-black text-slate-800">{orders.filter(o=>o.status === 'DELIVERED').length}</h3>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                     <div className="bg-white p-10 rounded-[40px] shadow-sm border border-slate-100">
                        <h3 className="text-xl font-black text-slate-800 mb-8">Pedidos Recentes</h3>
                        <div className="space-y-4">
                           {orders.slice(0,5).map(o => (
                              <div key={o.id} className="p-5 bg-slate-50 flex items-center justify-between rounded-3xl border border-slate-100">
                                 <div>
                                    <p className="font-bold text-slate-800">Pedido #{o.id.slice(-4)}</p>
                                    <p className="text-xs font-medium text-slate-500">{new Date(o.created_at).toLocaleTimeString()}</p>
                                 </div>
                                 <p className="font-black text-slate-800">R$ {o.total.toFixed(2)}</p>
                              </div>
                           ))}
                        </div>
                     </div>
                     <div className="bg-gradient-to-br from-indigo-500 to-blue-600 p-10 rounded-[40px] shadow-lg text-white">
                        <h4 className="text-2xl font-black mb-4">Link do Pedido</h4>
                        <div className="bg-white/10 p-4 rounded-xl border border-white/20 font-mono break-all text-sm mb-4">
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
                      <div className="space-y-2">
                         {categories.map(c => (
                            <div key={c.id} className="p-4 rounded-2xl bg-slate-50 font-bold border border-slate-100 flex justify-between">
                               <span>{c.name}</span>
                            </div>
                         ))}
                      </div>
                   </div>
                   <div className="lg:col-span-2 bg-white p-10 rounded-[40px] shadow-sm border border-slate-100">
                      <h3 className="text-xl font-black mb-6">Produtos Ativos</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         {products.map(p => (
                            <div key={p.id} className="p-4 rounded-3xl border border-slate-50 flex gap-4">
                               <div className="w-16 h-16 bg-slate-100 rounded-xl"></div>
                               <div>
                                  <h5 className="font-bold text-slate-800">{p.name}</h5>
                                  <p className="font-black text-green-600">R$ {p.price.toFixed(2)}</p>
                               </div>
                            </div>
                         ))}
                      </div>
                   </div>
                </div>
              )}

              {activeTab === 'chats' && (
                <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 h-[calc(100vh-250px)] flex overflow-hidden">
                    <div className="w-80 border-r border-slate-100 flex flex-col">
                        <div className="p-8 border-b border-slate-50 font-black">Clientes</div>
                        <div className="flex-1 overflow-y-auto">
                            {customers.map(c => (
                                <div key={c.id} onClick={()=>loadChat(c)} className={`p-6 border-b border-slate-50 cursor-pointer ${activeChatJid === c.whatsapp_jid ? 'bg-orange-50' : ''}`}>
                                    <p className="font-bold">{c.name}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="flex-1 flex flex-col">
                        {activeChatJid ? (
                            <>
                                <div className="flex-1 p-8 overflow-y-auto space-y-4">
                                    {chatMessages.map((m, idx) => (
                                        <div key={idx} className={`flex ${m.is_from_me ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`p-4 rounded-2xl max-w-md ${m.is_from_me ? 'bg-orange-500 text-white' : 'bg-slate-100'}`}>
                                                {m.text}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <form onSubmit={handleSendMessage} className="p-6 border-t flex gap-2">
                                    <input value={chatInput} onChange={e=>setChatInput(e.target.value)} className="flex-1 bg-slate-50 p-4 rounded-xl" />
                                    <button className="bg-orange-500 text-white px-8 rounded-xl font-black">ENVIAR</button>
                                </form>
                            </>
                        ) : (
                            <div className="flex-1 flex items-center justify-center text-slate-300 font-bold">Selecione um chat</div>
                        )}
                    </div>
                </div>
              )}

              {activeTab === 'drivers' && (
                <div className="space-y-8">
                   <div className="bg-indigo-600 p-10 rounded-[40px] text-white shadow-xl">
                      <h3 className="text-3xl font-black mb-2">Rede Entrega Global 🛵</h3>
                      <p className="opacity-80">Seu estabelecimento está conectado à rede central de pilotos.</p>
                   </div>
                   <div className="bg-white p-8 rounded-[40px] border border-slate-100">
                      <h4 className="font-black text-xl mb-6 flex items-center gap-2"><MapIcon/> Mapa Real-Time</h4>
                      <div className="h-[400px] bg-slate-50 rounded-3xl overflow-hidden border">
                         {isLoaded && mapCenter ? (
                            <GoogleMap
                               mapContainerStyle={mapContainerStyle}
                               center={Object.values(activeDriversLocations)[0] as any || mapCenter}
                               zoom={14}
                               options={{ styles: uberMapStyle }}
                            >
                               {Object.keys(activeDriversLocations).map(id => (
                                 <Marker key={id} position={activeDriversLocations[id]} icon={{ url: "https://cdn-icons-png.flaticon.com/512/2972/2972185.png", scaledSize: new window.google.maps.Size(40,40) }} />
                               ))}
                            </GoogleMap>
                         ) : <div className="h-full flex items-center justify-center font-bold text-slate-300 animate-pulse">Detectando sua cidade...</div>}
                      </div>
                   </div>
                </div>
              )}

              {activeTab === 'settings' && (
                <div className="bg-white p-10 rounded-[40px] shadow-sm max-w-md mx-auto text-center">
                    <QrCode size={60} className="mx-auto text-green-500 mb-4"/>
                    <h3 className="text-2xl font-black mb-8">Status do Robô</h3>
                    {waStatus === 'CONNECTED' ? (
                       <button onClick={logoutWA} className="w-full bg-red-500 text-white py-4 rounded-2xl font-bold">Desconectar WhatsApp</button>
                    ) : (
                       <div className="space-y-6">
                          {waQr && <div className="bg-white p-4 border rounded-xl inline-block"><QRCode value={waQr} size={180}/></div>}
                          <button onClick={connectWA} className="w-full bg-green-500 text-white py-4 rounded-2xl font-bold">Gerar Novo QR Code</button>
                       </div>
                    )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
