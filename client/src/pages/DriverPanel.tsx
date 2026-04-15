import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Wallet, Navigation, Phone, X, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'react-toastify';
import { GoogleMap, useJsApiLoader, DirectionsRenderer, Marker } from '@react-google-maps/api';
import { requestForToken, onMessageListener } from '../firebase';
import { uberMapStyle } from '../mapStyles';

let socket: any;

export default function DriverPanel() {
  const [driver, setDriver] = useState<any>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [activeTab, setActiveTab] = useState('requests'); // requests, active, wallet
  
  const [requests, setRequests] = useState<any[]>([]);
  const [myDeliveries, setMyDeliveries] = useState<any[]>([]);
  const [lastLocation, setLastLocation] = useState<any>(null);
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [currentRouteTarget, setCurrentRouteTarget] = useState<string | null>(null);
  const [isSheetExpanded, setIsSheetExpanded] = useState(true);
  const lastEmitRef = useRef<number>(0);

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
        if (data.error) {
           toast.error("Sua sessão expirou. Faça login novamente.");
           window.location.href = '/login/driver';
           return;
        }
        setDriver(data);
        setIsOnline(data.isOnline);
        
        requestForToken().then(fcmToken => {
            if (fcmToken) {
                fetch('/api/fcm-token', {
                    method: 'POST',
                    headers: { ...headers, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: fcmToken })
                });
            }
        });
      });
      
    onMessageListener().then((payload: any) => {
        toast.info(payload.notification.title + ": " + payload.notification.body, {
            position: "top-center",
            autoClose: 10000,
            theme: "colored",
        });
    });
    
    fetch('/api/driver/requests', { headers })
      .then(r => r.json())
      .then(data => {
          if (Array.isArray(data)) setRequests(data);
          else setRequests([]);
      });

    fetch('/api/driver/my-deliveries', { headers })
      .then(r => r.json())
      .then(data => {
          if (Array.isArray(data)) setMyDeliveries(data);
          else setMyDeliveries([]);
      });

    const apiUrl = import.meta.env.VITE_API_URL || '';
    socket = io(apiUrl, { transports: ['websocket', 'polling'] });
    socket.on('connect', () => {
        if (driver?.isOnline && lastLocation) {
             socket.emit('driver_online', { driverId: driver.id, lat: lastLocation.lat, lng: lastLocation.lng });
        }
        // Force re-join global driver namespace so we don't miss calls
        socket.emit('join', 'drivers_global');
    });

    socket.on('new_delivery_request', (req: any) => {
        setRequests(prev => Array.isArray(prev) ? [req, ...prev] : [req]);
        toast.info("🔔 Nova solicitação de entrega!");
    });

    socket.on('delivery_expired', (id: string) => {
        setRequests(prev => Array.isArray(prev) ? prev.filter(r => r.id !== id) : []);
    });

    return () => { socket.disconnect(); };
  }, []);

  // Update real-time location and directions
  useEffect(() => {
    if (!isOnline || !driver) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setLastLocation({ lat, lng });
        const now = Date.now();
        // Max 5s throttle to avoid Prisma connection pooling/locking issues
        if (socket && (now - lastEmitRef.current > 5000)) {
          lastEmitRef.current = now;
          const active = Array.isArray(myDeliveries) ? myDeliveries.find(d => d.order?.status === 'OUT_FOR_DELIVERY') : null;
          socket.emit('driver_location', { 
            driverId: driver.id, 
            lat, 
            lng,
            orderId: active?.order_id,
            tenantId: active?.tenant_id
          });
        }
      },
      (err) => console.error(err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [isOnline, driver, myDeliveries]);

  // Map route logic
  useEffect(() => {
    const active = Array.isArray(myDeliveries) ? myDeliveries.find(d => d.order?.status === 'OUT_FOR_DELIVERY') : null;
    const dest = active?.order?.delivery_address;
    
    if (isLoaded && lastLocation && dest && currentRouteTarget !== dest) {
        const directionsService = new google.maps.DirectionsService();
        directionsService.route(
            {
                origin: lastLocation,
                destination: `${dest}, Brasil`, // Improve geocoding accuracy
                travelMode: google.maps.TravelMode.DRIVING,
                region: 'BR'
            },
            (result, status) => {
                if (status === google.maps.DirectionsStatus.OK) {
                    setDirections(result);
                    setCurrentRouteTarget(dest);
                } else {
                    console.error("Directions error:", status);
                    let errorMsg = "Não foi possível traçar a rota automática. Use o GPS externo.";
                    if (status === "REQUEST_DENIED") {
                         errorMsg = "Erro: A api 'Directions API' do Google Maps não está ativada no seu console do Google Cloud.";
                    } else if (status === "ZERO_RESULTS") {
                         errorMsg = "Nenhuma rota terrestre encontrada entre você e o destino especificado.";
                    }
                    toast.error(errorMsg, { toastId: 'route-error' });
                    setCurrentRouteTarget(dest);
                }
            }
        );
    } else if (!active) {
        setDirections(null);
        setCurrentRouteTarget(null);
    }
  }, [isLoaded, lastLocation, myDeliveries, currentRouteTarget]);

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
        setMyDeliveries(prev => Array.isArray(prev) ? [data, ...prev] : [data]);
        setRequests(prev => Array.isArray(prev) ? prev.filter(r => r.id !== requestId) : []);
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
        setMyDeliveries(prev => Array.isArray(prev) ? prev.filter(d => d.id !== deliveryId) : []);
        toast.success("🎉 Entrega concluída!");
        setActiveTab('requests');
    }
  };

  const activeDeliveries = Array.isArray(myDeliveries) ? myDeliveries.filter(d => d.order?.status !== 'DELIVERED') : [];
  const currentRequests = Array.isArray(requests) ? requests.filter(r => r.status === 'PENDING') : [];

  const openInMaps = (address: string) => {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`, '_blank');
  };

  if (!driver) return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-10">
       <img src="/driver-logo.png" alt="Logo" className="w-32 h-32 rounded-3xl object-contain mb-8 shadow-[0_0_60px_rgba(255,204,0,0.4)] animate-pulse" />
       <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full mb-6"></div>
       <p className="text-primary font-black uppercase tracking-widest text-[10px]">Identificando Piloto...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100 font-sans selection:bg-slate-1000/30 overflow-hidden">
      
      {/* FULL SCREEN DYNAMIC MAP */}
      <div className="fixed inset-0 z-0">
         {isLoaded && lastLocation ? (
             <GoogleMap
                mapContainerStyle={{ width: '100%', height: '100%' }}
                center={lastLocation}
                zoom={17}
                options={{
                    styles: uberMapStyle,
                    disableDefaultUI: true,
                    gestureHandling: 'greedy'
                }}
             >
                {directions && <DirectionsRenderer directions={directions} options={{ suppressMarkers: true, polylineOptions: { strokeColor: '#0ea5e9', strokeWeight: 6, strokeOpacity: 0.9 } }} />}
                <Marker position={lastLocation} icon={{ url: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png", scaledSize: new window.google.maps.Size(25, 41) }} zIndex={50} />
                {directions && <Marker position={directions.routes[0].legs[0].end_location} icon={{ url: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png", scaledSize: new window.google.maps.Size(25, 41) }} zIndex={49} />}
             </GoogleMap>
         ) : (
             <div className="w-full h-full bg-slate-200 animate-pulse flex flex-col items-center justify-center">
                <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mb-4"></div>
                <p className="font-bold text-slate-500 uppercase text-xs">Aguardando GPS...</p>
             </div>
         )}
      </div>

      {/* FLOATING UI OVERLAY */}
      <div className="fixed inset-0 z-10 flex flex-col justify-between pointer-events-none">
          
          {/* FLOATING HEADER */}
          <header className="p-5 flex justify-between items-start pointer-events-auto pt-8">
              <div className="bg-white/90 backdrop-blur-md px-3 py-2 rounded-2xl shadow-lg flex items-center gap-3 border border-slate-100">
                  <div className={`w-3 h-3 rounded-full flex-shrink-0 ${isOnline ? 'bg-primary animate-pulse shadow-[0_0_10px_rgba(255,204,0,0.8)]' : 'bg-slate-300'}`} />
                  <img src="/driver-logo.png" alt="App Logo" className="h-6 w-auto object-contain" />
              </div>
              <div className="flex flex-col gap-2">
                  <button onClick={toggleOnline} className={`px-5 py-3 rounded-full text-[11px] font-black uppercase tracking-widest shadow-lg transition-all ${isOnline ? 'bg-primary text-black' : 'bg-white text-slate-500'}`}>
                      {isOnline ? 'EM TURNO' : 'OFFLINE'}
                  </button>
                  <button onClick={() => { localStorage.removeItem('token'); window.location.href='/login/driver'; }} className="bg-white p-3 rounded-full text-slate-400 shadow-lg self-end active:scale-95"><X size={18}/></button>
              </div>
          </header>

          {/* BOTTOM SHEET */}
          <motion.main 
             initial={false}
             animate={{ y: isSheetExpanded ? '0%' : 'calc(100% - 95px)' }}
             transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
             className="bg-white w-full rounded-t-[32px] shadow-[0_-20px_60px_-15px_rgba(0,0,0,0.3)] pointer-events-auto flex flex-col h-[75vh]"
          >
              <div 
                 className="w-full flex flex-col items-center justify-center pt-3 pb-2 cursor-pointer active:bg-slate-50 transition-colors rounded-t-[32px]"
                 onClick={() => setIsSheetExpanded(!isSheetExpanded)}
              >
                  <div className="w-12 h-1.5 bg-slate-200 flex-shrink-0 rounded-full mb-1" />
                  {isSheetExpanded ? <ChevronDown size={14} className="text-slate-300" /> : <ChevronUp size={14} className="text-slate-300" />}
              </div>

              <div className="flex px-4 pb-0 border-b border-slate-100 flex-shrink-0">
                  {[
                    { id: 'requests', label: 'PEDIDOS', icon: Bell },
                    { id: 'active', label: 'ROTA', icon: Navigation },
                    { id: 'wallet', label: 'CARTEIRA', icon: Wallet }
                  ].map(tab => (
                    <button 
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex-1 flex flex-col items-center justify-center gap-1 pb-3 pt-2 font-black text-[10px] tracking-widest transition-all ${activeTab === tab.id ? 'text-black border-b-2 border-blue-600' : 'text-slate-400'}`}
                    >
                      <tab.icon size={20} className={activeTab === tab.id ? "text-black" : "text-slate-300"} />
                      {tab.label}
                    </button>
                  ))}
              </div>

              <div className="overflow-y-auto px-6 py-6 pb-12 flex-1">
                  {activeTab === 'requests' && (
                      <div className="space-y-4">
                          {currentRequests.length === 0 && (
                              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col flex-1 items-center justify-center py-12">
                                  <div className="relative flex items-center justify-center mb-10 w-32 h-32">
                                      <div className="absolute w-full h-full bg-primary/20 rounded-full animate-ping"></div>
                                      <div className="absolute w-24 h-24 bg-primary/40 rounded-full animate-ping" style={{ animationDelay: '0.4s' }}></div>
                                      <div className="relative w-16 h-16 bg-primary text-black rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(255,204,0,0.6)] z-10">
                                          <Bell size={28} className="animate-bounce" />
                                      </div>
                                  </div>
                                  <h3 className="font-black text-2xl text-slate-800 tracking-tight text-center">Buscando Corridas</h3>
                                  <p className="font-medium text-sm text-slate-500 mt-2 text-center max-w-[200px]">Fique online e aguarde ser chamado na sua região.</p>
                              </motion.div>
                          )}
                          <AnimatePresence>
                            {currentRequests.map(req => (
                                <motion.div key={req.id} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-white border-2 border-slate-100 p-5 rounded-3xl shadow-sm">
                                  <div className="flex justify-between items-center mb-5">
                                      <div className="bg-slate-100 text-black px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest">NOVA CORRIDA</div>
                                      <span className="text-slate-800 font-black text-2xl">R$ {req.order?.delivery_fee?.toFixed(2) || '0.00'}</span>
                                  </div>
                                  <div className="flex flex-col gap-0 mb-6 relative">
                                      <div className="absolute left-1.5 top-3.5 bottom-3 border-l-2 border-dashed border-slate-200"></div>
                                      <div className="flex items-center gap-4 py-1 z-10">
                                          <div className="w-3 h-3 bg-slate-800 rounded-full flex-shrink-0 border-2 border-white ring-2 ring-slate-100" />
                                          <div className="flex pr-2 items-center">
                                              <p className="font-bold text-slate-800 text-sm truncate">{req.order?.tenant?.name || 'Origem Restaurante'}</p>
                                          </div>
                                      </div>
                                      <div className="flex items-center gap-4 py-1 z-10 mt-3">
                                          <div className="w-3 h-3 bg-slate-1000 rounded-sm flex-shrink-0 border-2 border-white ring-2 ring-blue-100" />
                                          <div className="flex pr-2 items-center">
                                              <p className="font-regular text-slate-600 text-sm line-clamp-2">{req.order?.delivery_address}</p>
                                          </div>
                                      </div>
                                  </div>
                                  <button onClick={() => acceptRequest(req.id)} className="w-full bg-primary text-black py-4 rounded-2xl font-black text-[12px] tracking-widest uppercase shadow-lg shadow-black/20 active:scale-[0.98] transition-all">
                                      ACEITAR VIAGEM
                                  </button>
                                </motion.div>
                            ))}
                          </AnimatePresence>
                      </div>
                  )}

                  {activeTab === 'active' && (
                      <div className="space-y-4">
                          {activeDeliveries.length === 0 && (
                              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col flex-1 items-center justify-center py-12">
                                  <div className="w-20 h-20 bg-black text-primary rounded-[28px] rotate-3 flex items-center justify-center mb-6 shadow-2xl shadow-black/20">
                                      <Navigation size={36} className="-rotate-3" />
                                  </div>
                                  <h3 className="font-black text-2xl text-slate-800 tracking-tight text-center">Rota Livre</h3>
                                  <p className="font-medium text-sm text-slate-500 mt-2 text-center max-w-[220px]">Você concluiu todas as suas entregas. Vá para a aba "Pedidos" para aceitar novas viagens.</p>
                              </motion.div>
                          )}
                          {activeDeliveries.map(delivery => (
                              <div key={delivery.id} className="bg-white">
                                 <div className="flex justify-between items-center mb-6">
                                     <h3 className="font-black text-2xl text-slate-800">{delivery.order?.customer?.name || 'Cliente'}</h3>
                                     <button onClick={() => openInMaps(delivery.order.delivery_address)} className="bg-slate-100 text-black px-4 py-2 rounded-full font-black text-[10px] uppercase flex items-center gap-2 active:scale-95 shadow-sm border border-blue-100">
                                         <Navigation size={14}/> GPS APP
                                     </button>
                                 </div>
                                 <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 mb-6">
                                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Destino</p>
                                     <p className="font-bold text-slate-700 text-sm leading-tight">{delivery.order?.delivery_address}</p>
                                 </div>
                                 <div className="flex gap-3">
                                     <button onClick={() => finishDelivery(delivery.id)} className="flex-[3] bg-black text-white py-4 rounded-2xl font-black text-sm tracking-widest flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all">
                                         FINALIZAR CORRIDA
                                     </button>
                                     <button className="flex-1 bg-slate-100 text-slate-600 rounded-2xl flex items-center justify-center active:scale-95 transition-all border border-slate-200">
                                         <Phone size={22}/>
                                     </button>
                                 </div>
                              </div>
                          ))}
                      </div>
                  )}

                  {activeTab === 'wallet' && (
                      <div className="grid grid-cols-2 gap-4">
                          <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100 shadow-sm text-center">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 mt-2">Corridas</p>
                              <p className="text-4xl font-black text-slate-800 mb-2">{activeDeliveries.length}</p>
                          </div>
                          <div className="bg-slate-100 p-5 rounded-3xl border border-blue-100 shadow-sm text-center">
                              <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2 mt-2">Ganhos</p>
                              <p className="text-2xl font-black text-black mb-2 mt-4">R$ {(driver.balance || 0).toFixed(2)}</p>
                          </div>
                      </div>
                  )}
              </div>
          </motion.main>
      </div>
    </div>
  );
}
