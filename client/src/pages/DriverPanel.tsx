import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { Truck, MapPin, Navigation, Package, LogOut, Bell, Zap, Clock, ShieldCheck } from 'lucide-react';
import { GoogleMap, useJsApiLoader, DirectionsRenderer, Marker } from '@react-google-maps/api';
import { uberMapStyle } from '../mapStyles';
import { Capacitor, registerPlugin } from '@capacitor/core';

const BackgroundGeolocation = registerPlugin<any>('BackgroundGeolocation');

let socket: any;

const mapContainerStyle = {
  width: '100%',
  height: '100%',
};

const defaultCenter = { lat: -16.6869, lng: -49.2648 };

export default function DriverPanel() {
  const [driver, setDriver] = useState<any>(null);
  const [requests, setRequests] = useState<any[]>([]);
  const [myDeliveries, setMyDeliveries] = useState<any[]>([]);
  const activeDeliveries = myDeliveries.filter(d => d.order.status !== 'DELIVERED');
  const [activeTab, setActiveTab] = useState<'requests' | 'active'>('requests');
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number} | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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
  }, []);

  useEffect(() => {
    if (!driver || !isOnline) return;

    let hasJoined = false;
    let watcherId: string | null = null;
    let browserWatchId: number | null = null;

    const emitLocation = (loc: {lat: number, lng: number}) => {
        setCurrentLocation(loc);
        if (socket && driver && isOnline) {
            if (!hasJoined) {
                socket.emit('driver_online', { driverId: driver.id, ...loc });
                hasJoined = true;
            }

            socket.emit('driver_location', { 
                driverId: driver.id, 
                ...loc,
                orderId: myDeliveries[0]?.order_id || null, 
                tenant_id: myDeliveries[0]?.order?.tenant_id || null
            });
        }
    };

    const startTracking = async () => {
        if (Capacitor.isNativePlatform()) {
            try {
                watcherId = await BackgroundGeolocation.addWatcher(
                    {
                        backgroundMessage: "Rastreando sua localização para entregas...",
                        backgroundTitle: "PitDog Pilot Ativo",
                        requestPermissions: true,
                        stale: false,
                        distanceFilter: 3 
                    },
                    (location: any) => {
                        if (location) {
                            emitLocation({ lat: location.latitude, lng: location.longitude });
                        }
                    }
                );
            } catch (err) {
                console.error("Background GPS Error:", err);
            }
        } else {
            // Browser Fallback
            if (navigator.geolocation) {
                browserWatchId = navigator.geolocation.watchPosition(
                    (pos) => emitLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                    (err) => console.error(err),
                    { enableHighAccuracy: true }
                );
            }
        }
    };

    startTracking();

    return () => {
        if (watcherId) {
            BackgroundGeolocation.removeWatcher({ id: watcherId });
        }
        if (browserWatchId !== null) {
            navigator.geolocation.clearWatch(browserWatchId);
        }
    };
  }, [driver, isOnline, myDeliveries]);

  useEffect(() => {
    if (!isLoaded || !currentLocation || activeDeliveries.length === 0) {
        setDirections(null);
        return;
    }

    const delivery = activeDeliveries[0];
    const directionsService = new google.maps.DirectionsService();

    directionsService.route(
        {
            origin: currentLocation,
            destination: delivery.order.delivery_address,
            travelMode: google.maps.TravelMode.DRIVING,
        },
        (result, status) => {
            if (status === google.maps.DirectionsStatus.OK) {
                setDirections(result);
            }
        }
    );
  }, [isLoaded, currentLocation, activeDeliveries]);

  const initSocket = (driverId: string, token: string | null) => {
    socket = io({ auth: { token } });
    socket.emit('join', `driver_${driverId}`); 
    
    socket.on('new_delivery_request', (req: any) => {
        setRequests(prev => [req, ...prev]);
        if (audioRef.current) {
            audioRef.current.play().catch(() => {});
        }
        // Vibrate if available
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    });

    const headers = { 'Authorization': `Bearer ${token}` };
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
        const headers = { 'Authorization': `Bearer ${localStorage.getItem('driverToken')}` };
        fetch(`/api/driver/deliveries/${driver.id}`, { headers }).then(r=>r.json()).then(setMyDeliveries);
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
        const headers = { 'Authorization': `Bearer ${localStorage.getItem('driverToken')}` };
        fetch(`/api/driver/deliveries/${driver.id}`, { headers }).then(r=>r.json()).then(setMyDeliveries);
    }
  };

  const openInMaps = (address: string) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    window.open(url, '_blank');
  };

  if (!driver) return null;


  return (
    <div className="fixed inset-0 bg-[#050505] text-white font-sans overflow-hidden flex flex-col">
      <audio ref={audioRef} src="/notification.mp3" />
      
      {/* Dynamic Background Map */}
      <div className={`absolute inset-0 z-0 transition-all duration-1000 ${activeDeliveries.length > 0 && activeTab === 'active' ? 'opacity-100 grayscale-0' : 'opacity-40 grayscale pointer-events-none'}`}>
        {isLoaded && (
            <GoogleMap
                mapContainerStyle={mapContainerStyle}
                center={currentLocation || defaultCenter}
                zoom={15}
                options={{ 
                    styles: uberMapStyle, 
                    disableDefaultUI: true,
                    zoomControl: false,
                    streetViewControl: false,
                    mapTypeControl: false,
                }}
            >
                {directions && (
                    <DirectionsRenderer 
                        directions={directions} 
                        options={{
                            polylineOptions: { 
                                strokeColor: '#4f46e5', 
                                strokeOpacity: 0.8, 
                                strokeWeight: 6 
                            },
                            suppressMarkers: false 
                        }} 
                    />
                )}
                
                {currentLocation && !directions && (
                    <Marker 
                        position={currentLocation}
                        icon={{
                            url: "https://cdn-icons-png.flaticon.com/512/2972/2972185.png",
                            scaledSize: new window.google.maps.Size(40, 40)
                        }}
                    />
                )}
            </GoogleMap>
        )}
      </div>

      {/* Header Overlay */}
      <header className="relative z-10 p-6 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
            <h1 className="text-xl font-black tracking-tighter">BITDOG <span className="text-green-500">PILOT</span></h1>
        </div>
        <div className="flex items-center gap-4">
            <button 
               onClick={() => setIsOnline(!isOnline)} 
               className={`px-4 py-2 rounded-full font-bold text-xs transition-all ${isOnline ? 'bg-green-600/20 text-green-400 border border-green-500/30' : 'bg-red-600/20 text-red-400 border border-red-500/30'}`}
            >
               {isOnline ? 'EM TURNO' : 'OFFLINE'}
            </button>
            <button onClick={() => { localStorage.removeItem('driver'); window.location.href='/'; }} className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-md">
                <LogOut size={18}/>
            </button>
        </div>
      </header>

      {/* Hero Stats */}
      <div className="relative z-10 px-6 pt-2 pb-6 grid grid-cols-2 gap-4">
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[28px] p-4">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1 flex items-center gap-1">
                  <Clock size={10}/> Hoje
              </p>
              <h3 className="text-2xl font-black">{myDeliveries.filter(d=>d.order.status === 'DELIVERED').length}</h3>
              <p className="text-[10px] text-gray-400 uppercase font-bold">Corridas</p>
          </div>
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[28px] p-4">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1 flex items-center gap-1">
                  <Zap size={10} className="text-yellow-400"/> Ganhos
              </p>
              <h3 className="text-2xl font-black text-green-400">R$ {(myDeliveries.filter(d=>d.order.status === 'DELIVERED').length * 7).toFixed(2)}</h3>
              <p className="text-[10px] text-gray-400 uppercase font-bold">Estimados</p>
          </div>
      </div>

      {/* Main Panel Area */}
      <main className="relative z-20 flex-1 bg-white/5 backdrop-blur-2xl rounded-t-[48px] border-t border-white/10 flex flex-col overflow-hidden">
          
          {/* Navigation Bar */}
          <div className="p-6 flex gap-4">
              <button 
                onClick={() => setActiveTab('requests')} 
                className={`flex-1 flex gap-2 items-center justify-center py-4 rounded-2xl font-black text-sm transition-all relative ${activeTab === 'requests' ? 'bg-white text-black shadow-lg shadow-white/10' : 'bg-white/5 text-gray-400'}`}
              >
                  <Bell size={18}/> DISPONÍVEIS
                  {requests.length > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-orange-500 text-white rounded-full text-[10px] flex items-center justify-center border-2 border-black">{requests.length}</span>}
              </button>
              <button 
                onClick={() => setActiveTab('active')} 
                className={`flex-1 flex gap-2 items-center justify-center py-4 rounded-2xl font-black text-sm transition-all ${activeTab === 'active' ? 'bg-white text-black shadow-lg shadow-white/10' : 'bg-white/5 text-gray-400'}`}
              >
                  <Navigation size={18}/> EM CURSO
                  {activeDeliveries.length > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 text-white rounded-full text-[10px] flex items-center justify-center border-2 border-black">{activeDeliveries.length}</span>}
              </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 pb-24 scrollbar-hide">
              {activeTab === 'requests' && (
                  <div className="space-y-4">
                      {requests.length === 0 && (
                          <div className="text-center py-16 opacity-30 flex flex-col items-center">
                              <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mb-4">
                                  <Package size={32}/>
                              </div>
                              <p className="font-bold text-sm">Procurando pedidos ao seu redor...</p>
                          </div>
                      )}
                      {requests.map(req => (
                          <div key={req.id} className="bg-indigo-600 rounded-[36px] p-6 shadow-2xl border border-white/10 animate-in slide-in-from-bottom-5 duration-500">
                              <div className="flex justify-between items-start mb-6">
                                  <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                                          <ShieldCheck size={20} className="text-indigo-200"/>
                                      </div>
                                      <div>
                                          <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest leading-none mb-1">REDE PITDOG</p>
                                          <h4 className="text-lg font-black text-white">{req.order?.tenant?.name || 'PitDog Store'}</h4>
                                      </div>
                                  </div>
                                  <div className="bg-white/20 px-3 py-1 rounded-full text-xs font-black text-white">R$ 7,50 FIXO</div>
                              </div>

                              <div className="flex items-center gap-3 mb-6 bg-black/20 p-4 rounded-2xl">
                                  <MapPin className="text-indigo-200" size={18}/>
                                  <div className="flex-1">
                                      <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-tighter">ENTREGA EM</p>
                                      <p className="font-bold text-white text-sm leading-tight line-clamp-2">{req.order.address}</p>
                                  </div>
                              </div>

                              <button 
                                onClick={() => acceptRequest(req.id)}
                                className="w-full bg-white text-indigo-600 py-5 rounded-[22px] font-black text-lg shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3"
                              >
                                  PEGAR PEDIDO <Zap size={20} fill="currentColor"/>
                              </button>
                          </div>
                      ))}
                  </div>
              )}

              {activeTab === 'active' && (
                  <div className="space-y-4">
                      {activeDeliveries.length === 0 && (
                          <div className="text-center py-16 opacity-30 flex flex-col items-center">
                              <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mb-4">
                                  <Truck size={32}/>
                              </div>
                              <p className="font-bold text-sm">Nenhuma entrega em curso.</p>
                          </div>
                      )}
                      {activeDeliveries.map(delivery => (
                          <div key={delivery.id} className="bg-slate-800/80 backdrop-blur-md rounded-[36px] p-6 border border-white/10 shadow-2xl">
                              <div className="flex justify-between items-center mb-6">
                                  <span className="px-3 py-1 bg-green-500/10 text-green-400 rounded-lg text-[10px] font-black uppercase">Entrega Iniciada</span>
                                  <span className="text-xs font-bold text-gray-500">#{delivery.order.id.slice(-4)}</span>
                              </div>
                              
                              <div className="flex items-center gap-4 mb-6">
                                  <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center text-3xl">🏠</div>
                                  <div>
                                      <h4 className="text-xl font-black text-white">{delivery.order.customer.name}</h4>
                                      <p className="text-xs font-bold text-gray-400">Cliente Relevante</p>
                                  </div>
                              </div>

                              <div 
                                onClick={() => openInMaps(delivery.order.address)}
                                className="bg-black/20 p-5 rounded-[22px] border border-white/5 mb-6 active:bg-black/40 transition-all cursor-pointer"
                              >
                                  <div className="flex justify-between items-center mb-2">
                                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Endereço de Destino</p>
                                      <Navigation size={14} className="text-blue-400"/>
                                  </div>
                                  <p className="font-black text-slate-200 text-sm">{delivery.order.address}</p>
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                  <button onClick={() => openInMaps(delivery.order.address)} className="bg-slate-700/50 text-white py-4 rounded-xl font-black text-xs flex items-center justify-center gap-2 border border-white/5">
                                      MAPAS
                                  </button>
                                  <button onClick={() => completeDelivery(delivery.id)} className="bg-green-600 text-white py-4 rounded-xl font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-green-600/20">
                                      ENTREGUE
                                  </button>
                              </div>
                          </div>
                      ))}
                  </div>
              )}
          </div>
      </main>

      {/* Persistent Status Bar */}
      <div className="fixed bottom-0 left-0 right-0 h-2 px-6 pb-8 bg-gradient-to-t from-black to-transparent pointer-events-none flex items-end justify-center">
            <div className="w-12 h-1.5 bg-white/20 rounded-full mb-4"></div>
      </div>
    </div>
  );
}
