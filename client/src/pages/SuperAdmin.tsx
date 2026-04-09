import { useState, useEffect } from 'react';
import { PlusCircle, Trash2, Activity, Map as MapIcon } from 'lucide-react';
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';

const mapContainerStyle = {
  width: '100%',
  height: '400px',
  borderRadius: '24px'
};

export default function SuperAdmin() {
  const [stats, setStats] = useState<any>(null);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [newDriver, setNewDriver] = useState({ name: '', phone: '', password: '' });
  
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: (import.meta as any).env.VITE_GOOGLE_MAPS_KEY || ""
  });

  useEffect(() => {
    fetchStats();
    fetchDrivers();
    
    // Refresh drivers location every 10s
    const interval = setInterval(fetchDrivers, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchStats = () => {
    fetch('/api/superadmin/stats', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }})
      .then(r => r.json())
      .then(setStats);
  };

  const fetchDrivers = () => {
    fetch('/api/superadmin/drivers', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }})
      .then(r => r.json())
      .then(setDrivers);
  };

  const addDriver = async (e: any) => {
    e.preventDefault();
    const res = await fetch('/api/superadmin/drivers', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(newDriver)
    });
    if (res.ok) {
        setNewDriver({ name: '', phone: '', password: '' });
        fetchDrivers();
    }
  };

  const deleteDriver = async (id: string) => {
    if (confirm('Deletar este piloto global?')) {
        await fetch(`/api/superadmin/drivers/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
        fetchDrivers();
    }
  };

  const toggleTenantStatus = async (id: string) => {
    await fetch(`/api/superadmin/tenants/${id}/toggle`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    fetchStats();
  };

  if (!stats) return <div className="p-10 font-bold text-center">🔐 Autenticando Mestre...</div>;

  const onlineDrivers = drivers.filter(d => d.isOnline && d.latitude && d.longitude);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-300 font-sans p-10">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-10 border-b border-slate-700 pb-6">
          <div className="w-12 h-12 bg-indigo-500 text-white rounded-xl flex items-center justify-center font-bold text-2xl">👑</div>
          <div>
            <h1 className="text-3xl font-black text-white">SaaS Master Node</h1>
            <p className="text-indigo-400 font-bold">Monitorando Licenças & Frota Uber</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
          <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700 shadow-xl">
            <p className="font-bold text-slate-400 mb-2">Lojas Ativas</p>
            <h2 className="text-4xl font-black text-white">{stats.tenants?.length || 0}</h2>
          </div>
          <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700 shadow-xl">
            <p className="font-bold text-slate-400 mb-2">Ganhos SaaS</p>
            <h2 className="text-4xl font-black text-green-400">R$ {((stats.tenants?.length || 0) * 147).toFixed(2)}</h2>
          </div>
          <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700 shadow-xl">
            <p className="font-bold text-slate-400 mb-2">Pilotos Online</p>
            <h2 className="text-4xl font-black text-orange-400">{drivers.filter(d=>d.isOnline).length}</h2>
          </div>
          <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700 shadow-xl">
            <p className="font-bold text-slate-400 mb-2">Total Frota</p>
            <h2 className="text-4xl font-black text-slate-300">{drivers.length}</h2>
          </div>
        </div>

        {/* Mapa de Operação Real-time */}
        <div className="bg-slate-800 p-8 rounded-[40px] border border-slate-700 shadow-2xl mb-12">
           <h3 className="font-black text-2xl text-white mb-6 flex items-center gap-3"><MapIcon className="text-indigo-400"/> Mapa de Operação Real-time</h3>
           <div className="h-[400px] bg-slate-700 rounded-3xl flex items-center justify-center overflow-hidden border border-slate-600">
              {isLoaded ? (
                <GoogleMap
                   mapContainerStyle={mapContainerStyle}
                   center={onlineDrivers[0] ? { lat: onlineDrivers[0].latitude, lng: onlineDrivers[0].longitude } : { lat: -16.6869, lng: -49.2648 }}
                   zoom={12}
                >
                   {onlineDrivers.map(d => (
                     <Marker 
                       key={d.id} 
                       position={{ lat: d.latitude, lng: d.longitude }}
                       label={{ text: d.name, color: 'white', fontWeight: 'bold' }}
                       icon={{
                           url: "https://cdn-icons-png.flaticon.com/512/2972/2972185.png",
                           scaledSize: new window.google.maps.Size(30,30)
                       }}
                     />
                   ))}
                </GoogleMap>
              ) : (
                <p className="font-bold text-slate-400 animate-pulse">Carregando satélite global...</p>
              )}
           </div>
        </div>

        {/* Gestão de Frota Uber */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
           <div className="bg-slate-800 p-8 rounded-[40px] border border-slate-700 shadow-xl">
              <h3 className="font-bold text-xl text-white mb-6 flex items-center gap-2"><PlusCircle/> Novo Piloto Global</h3>
              <form onSubmit={addDriver} className="space-y-4">
                  <input required placeholder="Nome" value={newDriver.name} onChange={e=>setNewDriver({...newDriver, name:e.target.value})} className="w-full p-4 bg-slate-700 rounded-2xl border border-slate-600 outline-none focus:border-indigo-500 transition-all font-medium" />
                  <input required placeholder="Telefone" value={newDriver.phone} onChange={e=>setNewDriver({...newDriver, phone:e.target.value})} className="w-full p-4 bg-slate-700 rounded-2xl border border-slate-600 outline-none focus:border-indigo-500 transition-all font-medium" />
                  <input required type="password" placeholder="Senha" value={newDriver.password} onChange={e=>setNewDriver({...newDriver, password:e.target.value})} className="w-full p-4 bg-slate-700 rounded-2xl border border-slate-600 outline-none focus:border-indigo-500 transition-all font-medium" />
                  <button className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-2xl transition shadow-lg shadow-indigo-600/20">Contratar para Rede</button>
              </form>
           </div>
           
           <div className="lg:col-span-2 bg-slate-800 p-8 rounded-[40px] border border-slate-700 shadow-xl">
              <h3 className="font-bold text-xl text-white mb-6 flex items-center gap-2"><Activity/> Status da Rede de Entregas</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {drivers.map(d => (
                   <div key={d.id} className="flex items-center justify-between p-5 bg-slate-700/50 rounded-3xl border border-slate-600 group hover:border-indigo-500 transition-all">
                      <div className="flex items-center gap-4">
                         <div className={`w-4 h-4 rounded-full ${d.isOnline ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-slate-600'}`}></div>
                         <div>
                            <p className="font-bold text-white">{d.name}</p>
                            <p className="text-xs text-slate-500">{d.phone}</p>
                         </div>
                      </div>
                      <button onClick={()=>deleteDriver(d.id)} className="text-slate-500 hover:text-red-400 transition-colors"><Trash2 size={24}/></button>
                   </div>
                 ))}
                 {drivers.length === 0 && <p className="col-span-2 text-center py-10 text-slate-500 italic">Nenhum piloto cadastrado na rede global.</p>}
              </div>
           </div>
        </div>

        <div className="bg-slate-800 rounded-[40px] border border-slate-700 p-10 shadow-xl mb-10">
          <h2 className="text-2xl font-black text-white mb-8 border-b border-slate-700 pb-6">Lojas (Tenants) do Ecossistema</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-slate-500 uppercase text-xs font-bold tracking-widest">
                  <th className="pb-6">Loja</th>
                  <th className="pb-6">Status</th>
                  <th className="pb-6">WhatsApp</th>
                  <th className="pb-6">Ações</th>
                </tr>
              </thead>
              <tbody>
                {stats.tenants?.map((t:any) => (
                  <tr key={t.id} className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-all">
                    <td className="py-6 font-bold text-white text-lg">{t.name}</td>
                    <td className="py-6">
                       <span className={`px-4 py-1.5 rounded-full text-xs font-black tracking-wider ${t.status === 'ACTIVE' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                          {t.status === 'ACTIVE' ? 'PLATINUM' : 'BLOCKED'}
                       </span>
                    </td>
                    <td className="py-6 text-slate-400 font-medium">{t.whatsapp_status || 'DESCONECTADO'}</td>
                    <td className="py-6">
                       <button onClick={() => toggleTenantStatus(t.id)} className={`font-black text-sm px-6 py-2 rounded-xl transition-all ${t.status === 'ACTIVE' ? 'bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white' : 'bg-green-500/10 text-green-400 hover:bg-green-500 hover:text-white'}`}>
                           {t.status === 'ACTIVE' ? 'Suspender' : 'Ativar'}
                       </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
