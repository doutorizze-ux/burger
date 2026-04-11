import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import { Truck, Bell, Wallet, MapPin, CheckCircle2, Navigation, Star, Phone, Package, Zap, X, Map as MapIcon, ChevronRight } from 'lucide-react';
import { toast } from 'react-toastify';
import { GoogleMap, useJsApiLoader, DirectionsRenderer, Marker } from '@react-google-maps/api';
import { uberMapStyle } from '../mapStyles';

let socket: any;

const mapContainerStyle = {
  width: '100%',
  height: '100%',
  borderRadius: '32px'
};

export default function DriverPanel() {
  const [driver, setDriver] = useState<any>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [activeTab, setActiveTab] = useState('requests'); // requests, active, wallet
  
  const [requests, setRequests] = useState<any[]>([]);
  const [myDeliveries, setMyDeliveries] = useState<any[]>([]);
  const [lastLocation, setLastLocation] = useState<any>(null);
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: (import.meta as any).env.VITE_GOOGLE_MAPS_KEY || ""
  });

  const token = localStorage.getItem('token');
  const headers = { 'Authorization': `Bearer ${token}` };

  useEffect(() => {
    fetch('/api/driver/me', { headers })
      .then(r => r.json())
      .then(data => {
        setDriver(data);
        setIsOnline(data.isOnline);
      });
    
    fetch('/api/driver/requests', { headers }).then(r => r.json()).then(setRequests);
    fetch('/api/driver/my-deliveries', { headers }).then(r => r.json()).then(setMyDeliveries);

    socket = io();

    socket.on('new_delivery_request', (req: any) => {
        setRequests(prev => [req, ...prev]);
        toast.info("🔔 Nova solicitação de entrega disponível!");
    });

    socket.on('delivery_expired', (id: string) => {
        setRequests(prev => prev.filter(r => r.id !== id));
    });

    return () => { socket.disconnect(); };
  }, []);

  // Update real-time location and directions
  useEffect(() => {
    if (!isOnline) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setLastLocation({ lat, lng });
        if (socket) {
          // If we have an active delivery, send its ID too
          const active = myDeliveries.find(d => d.order.status === 'OUT_FOR_DELIVERY');
          socket.emit('driver_location', { 
            driverId: driver?.id, 
            lat, 
            lng,
            orderId: active?.order_id,
            tenantId: active?.tenant_id
          });
        }
      },
      (err) => console.error(err),
      { enableHighAccuracy: true, distanceFilter: 10 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [isOnline, driver, myDeliveries]);

  // Map route logic
  useEffect(() => {
    const active = myDeliveries.find(d => d.order.status === 'OUT_FOR_DELIVERY');
    if (isLoaded && lastLocation && active?.order?.delivery_address) {
        const directionsService = new google.maps.DirectionsService();
        directionsService.route(
            {
                origin: lastLocation,
                destination: active.order.delivery_address,
                travelMode: google.maps.TravelMode.DRIVING,
            },
            (result, status) => {
                if (status === google.maps.DirectionsStatus.OK) {
                    setDirections(result);
                }
            }
        );
    } else {
        setDirections(null);
    }
  }, [isLoaded, lastLocation, myDeliveries]);

  const toggleOnline = () => {
    const newStatus = !isOnline;
    setIsOnline(newStatus);
    fetch('/api/driver/status', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ isOnline: newStatus })
    });
    
    if (newStatus) {
        navigator.geolocation.getCurrentPosition((pos) => {
            const { latitude: lat, longitude: lng } = pos.coords;
            socket.emit('driver_online', { driverId: driver?.id, lat, lng });
        });
    } else {
        socket.emit('driver_offline', { driverId: driver?.id });
    }
  };

  const acceptRequest = async (requestId: string) => {
    const res = await fetch(`/api/driver/accept/${requestId}`, { method: 'POST', headers });
    if (res.ok) {
        const data = await res.json();
        setMyDeliveries([data, ...myDeliveries]);
        setRequests(requests.filter(r => r.id !== requestId));
        setActiveTab('active');
        toast.success("✅ Corrida aceita!");
    } else {
        const err = await res.json();
        toast.error(err.error || "Erro ao aceitar");
    }
  };

  const finishDelivery = async (deliveryId: string) => {
    const res = await fetch(`/api/driver/finish/${deliveryId}`, { method: 'POST', headers });
    if (res.ok) {
        setMyDeliveries(myDeliveries.filter(d => d.id !== deliveryId));
        toast.success("🎉 Entrega concluída!");
        setActiveTab('requests');
    }
  };

  const activeDeliveries = myDeliveries.filter(d => d.order.status !== 'DELIVERED');

  const openInMaps = (address: string) => {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`, '_blank');
  };

  if (!driver) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-green-500/30">
      
      {/* Dynamic Uber-Like Background Map */}
      <div className="fixed inset-0 z-0 opacity-40">
         {isLoaded && lastLocation && (
             <GoogleMap
                mapContainerStyle={{ width: '100%', height: '100%' }}
                center={lastLocation}
                zoom={17}
                options={{
                    styles: uberMapStyle,
                    disableDefaultUI: true,
                    gestureHandling: 'none'
                }}
             >
                <Marker position={lastLocation} icon={{ url: "https://cdn-icons-png.flaticon.com/512/3721/3721619.png", scaledSize: new window.google.maps.Size(40, 40) }} />
             </GoogleMap>
         )}
         {!lastLocation && <div className="w-full h-full bg-slate-900 animate-pulse" />}
      </div>

      <header className="relative z-10 p-6 flex justify-between items-center bg-gradient-to-b from-slate-900 to-transparent">
          <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-500 animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-red-500'}`} />
              <h1 className="text-xl font-black italic tracking-tighter">FLUX<span className="text-green-500">DRIVER</span></h1>
          </div>
          <div className="flex gap-3">
              <button onClick={toggleOnline} className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${isOnline ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-slate-800 text-slate-400 border border-white/5'}`}>
                  {isOnline ? 'EM TURNO' : 'OFFLINE'}
              </button>
              <button className="bg-slate-800 p-2 rounded-xl text-slate-400 border border-white/5"><X size={20}/></button>
          </div>
      </header>

      <main className="relative z-10 p-6 pt-2">
          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-slate-900/60 backdrop-blur-xl p-5 rounded-[32px] border border-white/5">
                  <div className="flex items-center gap-2 text-gray-500 mb-2">
                    <Clock size={14}/>
                    <span className="text-[10px] font-black uppercase tracking-widest">Hoje</span>
                  </div>
                  <p className="text-3xl font-black">{activeDeliveries.length}</p>
                  <p className="text-[10px] font-bold text-gray-600 uppercase">Corridas</p>
              </div>
              <div className="bg-slate-900/60 backdrop-blur-xl p-5 rounded-[32px] border border-white/5">
                  <div className="flex items-center gap-2 text-gray-500 mb-2">
                    <Zap size={14} className="text-yellow-500"/>
                    <span className="text-[10px] font-black uppercase tracking-widest">Ganhos</span>
                  </div>
                  <p className="text-3xl font-black text-green-500">R$ {(driver.balance || 0).toFixed(2)}</p>
                  <p className="text-[10px] font-bold text-gray-600 uppercase">Estimados</p>
              </div>
          </div>

          {/* Tab Navigation */}
          <div className="bg-slate-900/80 backdrop-blur-2xl p-2 rounded-[32px] flex mb-8 border border-white/5">
              {[
                { id: 'requests', label: 'PEDIDOS', icon: Bell },
                { id: 'active', label: 'ATIVO', icon: Navigation },
                { id: 'wallet', label: 'CARTEIRA', icon: Wallet }
              ].map(tab => (
                <button 
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-[24px] font-black text-[10px] tracking-widest transition-all ${activeTab === tab.id ? 'bg-white text-slate-950 shadow-xl' : 'text-slate-500'}`}
                >
                  <tab.icon size={16}/> {tab.label}
                </button>
              ))}
          </div>

          <div className="pb-32">
              {activeTab === 'requests' && (
                  <div className="space-y-4">
                      {requests.length === 0 && (
                          <div className="text-center py-16 opacity-30 flex flex-col items-center">
                              <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mb-4">
                                  <Bell size={32}/>
                              </div>
                              <p className="font-bold text-sm">Aguardando novos pedidos...</p>
                          </div>
                      )}
                      <AnimatePresence>
                        {requests.map(req => (
                            <motion.div 
                              key={req.id} 
                              initial={{ y: 20, opacity: 0 }} 
                              animate={{ y: 0, opacity: 1 }}
                              className="bg-slate-900 p-6 rounded-[40px] border border-white/5 shadow-2xl"
                            >
                              <div className="flex justify-between items-center mb-6">
                                  <div className="bg-orange-500/10 text-orange-500 px-3 py-1 rounded-full text-[10px] font-black">NOVO PEDIDO</div>
                                  <span className="text-white font-black text-xl">R$ {req.order.delivery_fee.toFixed(2)}</span>
                              </div>
                              <div className="flex items-center gap-4 mb-6">
                                  <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-2xl">🍔</div>
                                  <div>
                                      <h4 className="font-black text-white uppercase">{req.order.tenant.name}</h4>
                                      <p className="text-[10px] font-bold text-gray-500 tracking-widest">Loja de Origem</p>
                                  </div>
                              </div>
                              <div className="bg-black/40 p-4 rounded-3xl border border-white/5 mb-6">
                                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Destino</p>
                                  <p className="font-bold text-sm text-slate-300">{req.order.delivery_address}</p>
                              </div>
                              <button onClick={() => acceptRequest(req.id)} className="w-full bg-green-500 text-slate-950 py-5 rounded-[24px] font-black text-xs tracking-widest uppercase shadow-lg shadow-green-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-3">
                                  PEGAR PEDIDO <Zap size={20} fill="currentColor"/>
                              </button>
                            </motion.div>
                        ))}
                      </AnimatePresence>
                  </div>
              )}

              {activeTab === 'active' && (
                  <div className="space-y-6">
                      {activeDeliveries.length === 0 && (
                          <div className="text-center py-16 opacity-30 flex flex-col items-center">
                              <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mb-4">
                                  <Truck size={32}/>
                              </div>
                              <p className="font-bold text-sm">Nenhuma entrega em curso.</p>
                          </div>
                      )}
                      
                      {activeDeliveries.map(delivery => (
                          <div key={delivery.id} className="space-y-4">
                             {/* Floating Interactive Map */}
                             <div className="h-[350px] bg-slate-800 rounded-[48px] overflow-hidden border-4 border-slate-900 shadow-2xl relative">
                                {isLoaded && lastLocation ? (
                                    <GoogleMap
                                        mapContainerStyle={mapContainerStyle}
                                        center={lastLocation}
                                        zoom={15}
                                        options={{
                                            styles: uberMapStyle,
                                            disableDefaultUI: true,
                                        }}
                                    >
                                        {directions && <DirectionsRenderer directions={directions} options={{ polylineOptions: { strokeColor: '#22c55e', strokeWeight: 6 } }} />}
                                        <Marker position={lastLocation} icon={{ url: "https://cdn-icons-png.flaticon.com/512/3721/3721619.png", scaledSize: new window.google.maps.Size(40, 40) }} />
                                    </GoogleMap>
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-slate-900">
                                        <div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full" />
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Iniciando Navegação...</p>
                                    </div>
                                )}
                                
                                <div className="absolute top-6 left-6 right-6 flex justify-between">
                                     <button onClick={() => openInMaps(delivery.order.delivery_address)} className="bg-blue-600 text-white px-5 py-3 rounded-2xl font-black text-[10px] uppercase flex items-center gap-2 shadow-xl active:scale-95">
                                         <Navigation size={16}/> GPS EXTERNO
                                     </button>
                                     <div className="bg-slate-900/90 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/10 text-[10px] font-black text-green-400">
                                         #{delivery.order.id.slice(-4)}
                                     </div>
                                </div>
                             </div>

                             {/* Delivery Details Card */}
                             <div className="bg-slate-900 p-8 rounded-[48px] border border-white/5 shadow-2xl">
                                <div className="flex items-center gap-5 mb-8">
                                    <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center text-3xl">🏠</div>
                                    <div>
                                        <h4 className="text-2xl font-black text-white">{delivery.order.customer.name}</h4>
                                        <p className="text-xs font-bold text-gray-500">Cliente • {delivery.order.payment_method}</p>
                                    </div>
                                </div>

                                <div className="bg-black/30 p-6 rounded-[32px] border border-white/5 mb-8">
                                    <div className="flex justify-between items-center mb-3">
                                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Endereço</p>
                                        <MapPin size={14} className="text-blue-400"/>
                                    </div>
                                    <p className="font-black text-slate-200 text-sm leading-tight">{delivery.order.delivery_address}</p>
                                </div>

                                <div className="flex gap-4">
                                    <button onClick={() => finishDelivery(delivery.id)} className="flex-[2] bg-green-500 text-slate-950 py-6 rounded-3xl font-black text-sm tracking-widest uppercase shadow-lg shadow-green-500/20 active:scale-95 transition-all">
                                        ENTREGUE ✅
                                    </button>
                                    <button className="flex-1 bg-slate-800 text-white rounded-3xl flex items-center justify-center border border-white/5 active:scale-95 transition-all">
                                        <Phone size={24}/>
                                    </button>
                                </div>
                             </div>
                          </div>
                      ))}
                  </div>
              )}
          </div>
      </main>
    </div>
  );
}
