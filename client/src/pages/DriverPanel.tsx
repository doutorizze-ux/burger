import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { Truck, MapPin, Navigation, CheckCircle, Package, LogOut } from 'lucide-react';
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';
import { uberMapStyle } from '../mapStyles';

let socket: any;

const mapContainerStyle = {
  width: '100%',
  height: '300px',
  borderRadius: '24px'
};

export default function DriverPanel() {
  const [driver, setDriver] = useState<any>(null);
  const [requests, setRequests] = useState<any[]>([]);
  const [myDeliveries, setMyDeliveries] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'requests' | 'active'>('requests');
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number} | null>(null);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: (import.meta as any).env.VITE_GOOGLE_MAPS_KEY || ""
  });

  useEffect(() => {
    const savedDriver = localStorage.getItem('driver');
    if (savedDriver) {
        const d = JSON.parse(savedDriver);
        setDriver(d);
        initSocket(d.id, localStorage.getItem('driverToken'));
    } else {
        window.location.href = '/login/driver';
    }

    let hasJoined = false;
    const watchId = navigator.geolocation.watchPosition(
        (pos) => {
            const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            setCurrentLocation(loc);
            
            if (socket && driver) {
                if (!hasJoined) {
                    socket.emit('driver_online', { driverId: driver.id, ...loc });
                    hasJoined = true;
                }

                socket.emit('driver_location', { 
                    driverId: driver.id, 
                    ...loc,
                    orderId: myDeliveries[0]?.order_id || null, 
                    tenantId: myDeliveries[0]?.order?.tenant_id || null
                });
            }
        },
        (err) => console.error(err),
        { enableHighAccuracy: true }
    );

    return () => {
        navigator.geolocation.clearWatch(watchId);
        if (socket) socket.disconnect();
    };
  }, []);

  const initSocket = (driverId: string, token: string | null) => {
    socket = io({ auth: { token } });
    socket.emit('join', `driver_${driverId}`); 
    
    socket.on('new_delivery_request', (req: any) => {
        setRequests(prev => [req, ...prev]);
        new Audio('/notification.mp3').play().catch(() => {});
    });

    // Initial fetch
    const headers = { 'Authorization': `Bearer ${localStorage.getItem('driverToken')}` };
    fetch('/api/driver/requests', { headers }).then(r=>r.json()).then(setRequests);
    fetch(`/api/driver/deliveries/${driverId}`, { headers }).then(r=>r.json()).then(setMyDeliveries);
  };

  const acceptRequest = async (requestId: string) => {
    const res = await fetch(`/api/driver/accept/${requestId}`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${localStorage.getItem('driverToken')}`,
          'Content-Type': 'application/json' 
        }
    });
    if (res.ok) {
        setRequests(prev => prev.filter(r => r.id !== requestId));
        fetch(`/api/driver/deliveries/${driver.id}`).then(r=>r.json()).then(setMyDeliveries);
        setActiveTab('active');
    }
  };

  const completeDelivery = async (requestId: string) => {
    const res = await fetch(`/api/driver/finish/${requestId}`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${localStorage.getItem('driverToken')}`,
          'Content-Type': 'application/json' 
        }
    });
    if (res.ok) {
        fetch(`/api/driver/deliveries/${driver.id}`).then(r=>r.json()).then(setMyDeliveries);
    }
  };

  const openInMaps = (address: string) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    window.open(url, '_blank');
  };

  if (!driver) return null;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans pb-20">
      {/* Header Estilo Uber Driver */}
      <header className="p-6 bg-slate-800 border-b border-slate-700 sticky top-0 z-30 flex justify-between items-center shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center shadow-lg shadow-green-500/20">
             <Truck className="text-white" size={24}/>
          </div>
          <div>
            <h1 className="font-black text-xl tracking-tighter">PitDog Entregas</h1>
            <p className="text-[10px] font-bold text-green-400 uppercase tracking-widest flex items-center gap-1">
               <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span> Online
            </p>
          </div>
        </div>
        <button onClick={() => { localStorage.removeItem('driver'); window.location.href='/'; }} className="p-3 bg-slate-700 rounded-2xl text-slate-400 hover:text-white transition-colors">
           <LogOut size={20}/>
        </button>
      </header>

      {/* Mapa de Monitoramento do App */}
      <div className="p-4">
          <div className="bg-slate-800 rounded-[32px] overflow-hidden border border-slate-700 p-2 shadow-2xl">
                {isLoaded && currentLocation ? (
                    <GoogleMap
                        mapContainerStyle={mapContainerStyle}
                        center={currentLocation}
                        zoom={15}
                        options={{ styles: uberMapStyle, disableDefaultUI: true }}
                    >
                        <Marker 
                            position={currentLocation} 
                            icon={{ url: "https://cdn-icons-png.flaticon.com/512/2972/2972185.png", scaledSize: new window.google.maps.Size(40,40) }} 
                        />
                    </GoogleMap>
                ) : (
                    <div className="h-[300px] flex items-center justify-center text-slate-500 font-bold bg-slate-800 animate-pulse">
                        Sincronizando GPS...
                    </div>
                )}
          </div>
      </div>

      <main className="p-6 space-y-6">
        {/* Tabs de Navegação */}
        <div className="flex bg-slate-800 p-1.5 rounded-2xl border border-slate-700 shadow-inner">
            <button onClick={() => setActiveTab('requests')} className={`flex-1 py-3 rounded-xl font-black text-sm transition-all ${activeTab === 'requests' ? 'bg-slate-700 text-white shadow-md' : 'text-slate-500'}`}>Sorteios ({requests.length})</button>
            <button onClick={() => setActiveTab('active')} className={`flex-1 py-3 rounded-xl font-black text-sm transition-all ${activeTab === 'active' ? 'bg-slate-700 text-white shadow-md' : 'text-slate-500'}`}>Em Curso ({myDeliveries.filter(d=>d.order.status !== 'DELIVERED').length})</button>
        </div>

        {/* Lista de Chamadas */}
        {activeTab === 'requests' && (
            <div className="space-y-4">
                {requests.length === 0 && (
                    <div className="text-center py-20 opacity-30">
                        <Package size={60} className="mx-auto mb-4"/>
                        <p className="font-bold">Aguardando novos pedidos...</p>
                    </div>
                )}
                {requests.map(req => (
                    <div key={req.id} className="bg-indigo-600 p-6 rounded-[32px] shadow-xl border border-indigo-500 animate-in zoom-in duration-300">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mb-1">Novo Pedido no Painel</p>
                                <h3 className="text-2xl font-black text-white">{req.order?.tenant?.name || 'Restaurante'}</h3>
                            </div>
                            <div className="bg-white/20 px-4 py-2 rounded-2xl font-black text-white">R$ {req.order.total.toFixed(2)}</div>
                        </div>
                        <div className="flex items-center gap-3 mb-6 bg-black/10 p-4 rounded-2xl">
                            <MapPin className="text-indigo-200" size={20}/>
                            <p className="font-bold text-sm text-indigo-50 leading-tight">{req.order.address}</p>
                        </div>
                        <button onClick={() => acceptRequest(req.id)} className="w-full bg-white text-indigo-600 py-4 rounded-2xl font-black text-lg shadow-xl hover:scale-[1.02] active:scale-95 transition-all">ACEITAR AGORA</button>
                    </div>
                ))}
            </div>
        )}

        {/* Entregas Ativas */}
        {activeTab === 'active' && (
            <div className="space-y-4">
                {myDeliveries.filter(d=>d.order.status !== 'DELIVERED').map(delivery => (
                    <div key={delivery.id} className="bg-slate-800 p-6 rounded-[32px] border border-slate-700 shadow-xl">
                        <div className="flex justify-between items-center mb-6">
                            <span className="px-3 py-1 bg-blue-500/10 text-blue-400 rounded-lg text-[10px] font-black uppercase">Em Entrega</span>
                            <span className="font-black text-emerald-400">R$ {delivery.order.total.toFixed(2)}</span>
                        </div>
                        <h4 className="text-xl font-black mb-4">🏠 {delivery.order.customer.name}</h4>
                        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-700 mb-6 group cursor-pointer hover:border-blue-500/50 transition-colors" onClick={() => openInMaps(delivery.order.address)}>
                             <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">Endereço de Destino <Navigation size={12}/></p>
                             <p className="font-bold text-slate-200">{delivery.order.address}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                           <button onClick={() => openInMaps(delivery.order.address)} className="bg-slate-700 text-white p-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:bg-slate-600 transition-colors shadow-lg">
                              <Navigation size={18}/> NAVEGAR
                           </button>
                           <button onClick={() => completeDelivery(delivery.id)} className="bg-green-600 text-white p-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:bg-green-500 transition-colors shadow-lg shadow-green-500/10">
                              <CheckCircle size={18}/> CONCLUIR
                           </button>
                        </div>
                    </div>
                ))}
            </div>
        )}
      </main>
    </div>
  );
}
