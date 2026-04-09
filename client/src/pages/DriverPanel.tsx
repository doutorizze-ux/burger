import { useState } from 'react';
import { io } from 'socket.io-client';

export default function DriverPanel() {
  const [driver, setDriver] = useState<any>(null);
  const [requests, setRequests] = useState<any[]>([]);
  const [isOnline, setIsOnline] = useState(false);
  const [socket, setSocket] = useState<any>(null);
  
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  const login = async (e: any) => {
    e.preventDefault();
    const res = await fetch('/api/driver/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password })
    });
    if (res.ok) {
      const data = await res.json();
      localStorage.setItem('driver_token', data.token);
      setDriver(data.driver);
      loadRequests(data.token);
      initSocket(data.driver.id);
    } else {
      alert('Login Invalido');
    }
  };

  const loadRequests = async (token: string) => {
    const res = await fetch('/api/driver/requests', { headers: { 'Authorization': `Bearer ${token}` } });
    if (res.ok) {
      const data = await res.json();
      setRequests(data);
    }
  };

  const initSocket = (driverId: string) => {
    const newSocket = io();
    setSocket(newSocket);
    newSocket.on('new_delivery_request', (req) => {
       setRequests(prev => [req, ...prev]);
       const audio = new Audio('/notification.mp3');
       audio.play().catch(()=>{});
    });
    
    newSocket.on('delivery_accepted', ({ requestId }) => {
       setRequests(prev => prev.filter(r => r.id !== requestId));
    });
    
    newSocket.on('delivery_expired', ({ requestId }) => {
       setRequests(prev => prev.filter(r => r.id !== requestId));
    });

    if (navigator.geolocation) {
         navigator.geolocation.watchPosition((pos) => {
             const lat = pos.coords.latitude;
             const lng = pos.coords.longitude;
             if (isOnline) {
                 newSocket.emit('driver_location', { driverId, lat, lng });
             }
         }, console.error, { enableHighAccuracy: true });
    }
  };

  const toggleOnline = () => {
    if (!socket || !driver) return;
    const nextState = !isOnline;
    setIsOnline(nextState);
    if (nextState) {
       navigator.geolocation.getCurrentPosition((pos) => {
           socket.emit('driver_online', { driverId: driver.id, lat: pos.coords.latitude, lng: pos.coords.longitude });
       });
    } else {
       socket.emit('driver_offline', { driverId: driver.id });
    }
  };

  const acceptDelivery = async (reqId: string) => {
    const res = await fetch(`/api/driver/accept/${reqId}`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${localStorage.getItem('driver_token')}` }
    });
    if (res.ok) {
        alert('CORRIDA ACEITA! Vai lá filhão!');
        setRequests(prev => prev.map(r => r.id === reqId ? { ...r, status: 'ACCEPTED' } : r));
    } else {
        alert('Alguém foi mais rápido ou corrida expirou!');
        setRequests(prev => prev.filter(r => r.id !== reqId));
    }
  };

  const finishDelivery = async (reqId: string) => {
    const res = await fetch(`/api/driver/finish/${reqId}`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${localStorage.getItem('driver_token')}` }
    });
    if (res.ok) {
        alert('ENTREGA FINALIZADA! Boa! 🚀');
        setRequests(prev => prev.filter(r => r.id !== reqId));
    } else {
        alert('Erro ao finalizar.');
    }
  };

  if (!driver) {
     return (
        <div className="min-h-screen bg-zinc-900 flex items-center justify-center p-4">
            <form onSubmit={login} className="bg-zinc-800 p-8 rounded-xl w-full max-w-sm flex flex-col gap-4">
               <h2 className="text-white text-2xl font-black text-center mb-4">🏍️ Portal Motoboy</h2>
               <input className="p-3 rounded-md bg-zinc-700 text-white" placeholder="Telefone" value={phone} onChange={e=>setPhone(e.target.value)} />
               <input className="p-3 rounded-md bg-zinc-700 text-white" type="password" placeholder="Senha" value={password} onChange={e=>setPassword(e.target.value)} />
               <button className="bg-orange-600 text-white p-3 rounded-md font-bold mt-2 hover:bg-orange-500">Entrar na Pista</button>
            </form>
        </div>
     );
  }

  return (
    <div className="min-h-screen bg-zinc-900 text-white font-sans">
       <header className="p-6 bg-zinc-800 flex justify-between items-center border-b border-zinc-700">
           <div>
              <h1 className="text-xl font-black">PitDog Motor</h1>
              <p className="text-sm text-zinc-400">Piloto: {driver.name}</p>
           </div>
           <button onClick={toggleOnline} className={`px-6 py-2 rounded-full font-bold transition-all ${isOnline ? 'bg-green-600 shadow-lg shadow-green-500/30' : 'bg-zinc-700 text-zinc-400'}`}>
               {isOnline ? '🟢 ONLINE' : '⚫ OFFLINE'}
           </button>
       </header>

       <div className="p-6">
           <h2 className="text-lg font-bold mb-4">Corridas Disponíveis</h2>
           {!isOnline && <div className="p-4 bg-orange-900/30 text-orange-400 rounded-lg text-center mb-6">Fique Online para receber corridas</div>}
           
           <div className="flex flex-col gap-4">
               {requests.map(req => (
                   <div key={req.id} className={`bg-zinc-800 p-5 rounded-xl border ${req.status === 'ACCEPTED' ? 'border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'border-zinc-700'} flex flex-col gap-3`}>
                       <div className="flex justify-between items-start">
                           <div>
                              <h3 className="font-bold text-lg">Pedido #{req.order_id.slice(-4)}</h3>
                              <p className="text-orange-400 font-bold">R$ {req.order?.delivery_fee?.toFixed(2) || '0.00'}</p>
                           </div>
                           {req.status === 'ACCEPTED' ? (
                               <span className="bg-blue-600 px-3 py-1 rounded-md text-xs font-bold text-white">EM ANDAMENTO</span>
                           ) : (
                               <span className="bg-orange-600 px-3 py-1 rounded-md text-xs font-bold animate-pulse text-white">NOVA</span>
                           )}
                       </div>
                       
                       <div className="bg-zinc-700/50 p-2 rounded-lg mb-2">
                           <p className="text-[10px] uppercase font-bold text-zinc-400">Restaurante:</p>
                           <p className="text-sm font-bold text-orange-200">🍔 {req.order?.tenant?.name || 'PitDog Desconhecido'}</p>
                       </div>

                       <div className="bg-zinc-900 p-3 rounded-md">
                          <p className="text-sm text-zinc-400">Destino:</p>
                          <p className="font-medium text-zinc-200">{req.order?.delivery_address || 'Endereço não informado'}</p>
                       </div>
                       
                       {req.status === 'ACCEPTED' ? (
                           <button onClick={() => finishDelivery(req.id)} className="w-full mt-2 bg-blue-600 hover:bg-blue-500 text-white p-4 rounded-lg font-black text-lg">
                               ENTREGUE ✅
                           </button>
                       ) : (
                           <button onClick={() => acceptDelivery(req.id)} className="w-full mt-2 bg-green-600 hover:bg-green-500 text-white p-4 rounded-lg font-black text-lg">
                               ACEITAR CORRIDA 🛵
                           </button>
                       )}
                   </div>
               ))}
               {requests.length === 0 && isOnline && (
                   <div className="text-center text-zinc-500 py-10">Buscando corridas...</div>
               )}
           </div>
       </div>
    </div>
  );
}
