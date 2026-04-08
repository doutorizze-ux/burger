import { useState, useEffect } from 'react';
import { Users, TrendingUp, DollarSign, Activity } from 'lucide-react';

export default function SuperAdmin() {
  const [stats, setStats] = useState<any>(null);
  
  useEffect(() => {
    fetch('/api/superadmin/stats', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }})
      .then(r => r.json())
      .then(setStats);
  }, []);

  if (!stats) return <div className="p-10 font-bold text-center">🔐 Autenticando Mestre...</div>;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-300 font-sans p-10">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-10 border-b border-slate-700 pb-6">
          <div className="w-12 h-12 bg-indigo-500 text-white rounded-xl flex items-center justify-center font-bold text-2xl">👑</div>
          <div>
            <h1 className="text-3xl font-black text-white">SaaS Master Node</h1>
            <p className="text-indigo-400 font-bold">Monitorando Licenças</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
          <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700">
            <p className="font-bold text-slate-400 mb-2">Lojas Ativas</p>
            <h2 className="text-4xl font-black text-white">{stats.tenants?.length || 0}</h2>
          </div>
          <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700">
            <p className="font-bold text-slate-400 mb-2">Mensalidades MRR</p>
            <h2 className="text-4xl font-black text-green-400">R$ {((stats.tenants?.length || 0) * 147).toFixed(2)}</h2>
          </div>
          <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700">
            <p className="font-bold text-slate-400 mb-2">Lanches Trafegados</p>
            <h2 className="text-4xl font-black text-orange-400">{stats.totalProducts || 0}</h2>
          </div>
          <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700">
            <p className="font-bold text-slate-400 mb-2">Logs do Admin</p>
            <h2 className="text-xl font-bold text-slate-300">Em Operação</h2>
          </div>
        </div>

        <div className="bg-slate-800 rounded-3xl border border-slate-700 p-8">
          <h2 className="text-xl font-bold text-white mb-6 border-b border-slate-700 pb-4">Assinantes Recentes</h2>
          <table className="w-full text-left">
            <thead>
              <tr className="text-slate-500 uppercase text-xs font-bold">
                <th className="pb-4">Loja (Tenant)</th>
                <th className="pb-4">Status Pagamento</th>
                <th className="pb-4">Criado Em</th>
                <th className="pb-4">WhatsApp</th>
                <th className="pb-4">Acesso Clandestino</th>
              </tr>
            </thead>
            <tbody>
              {stats.tenants?.map((t:any) => (
                <tr key={t.id} className="border-b border-slate-700/50">
                  <td className="py-4 font-bold text-white">{t.name}</td>
                  <td className="py-4"><span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-md text-xs font-bold">{t.payment_status}</span></td>
                  <td className="py-4 font-medium text-slate-400">{new Date(t.created_at).toLocaleDateString()}</td>
                  <td className="py-4 font-medium text-slate-400">{t.whatsapp_status}</td>
                  <td className="py-4"><button className="text-indigo-400 font-bold hover:underlinetext-sm">Espionar Dados</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
