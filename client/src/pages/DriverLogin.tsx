import { useState } from 'react';
import { Truck } from 'lucide-react';

export default function DriverLogin() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/driver/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password })
      });
      const data = await res.json();
      if (data.token) {
        localStorage.setItem('driverToken', data.token);
        localStorage.setItem('driver', JSON.stringify(data.driver));
        window.location.href = '/driver';
      } else {
        alert(data.error || 'Erro ao fazer login');
      }
    } catch (err) {
      alert('Falha na conexão com o servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
      <div className="max-w-md w-full bg-slate-800 rounded-[40px] shadow-2xl p-8 border border-slate-700">
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-green-500 rounded-[30px] mx-auto flex items-center justify-center shadow-xl shadow-green-500/20 mb-6">
            <Truck className="text-white" size={40} />
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">PitDog Entregas</h2>
          <p className="text-slate-500 font-bold text-sm tracking-wide uppercase mt-1">Portal do Piloto</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Telefone do Piloto</label>
            <input 
              required 
              type="text" 
              placeholder="Ex: 62999999999"
              value={phone} 
              onChange={e=>setPhone(e.target.value)} 
              className="w-full p-4 rounded-2xl bg-slate-700 border border-slate-600 outline-none focus:border-green-500 transition font-bold text-white text-lg placeholder:text-slate-600" 
            />
          </div>
          <div>
            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Senha de Acesso</label>
            <input 
              required 
              type="password" 
              placeholder="••••••"
              value={password} 
              onChange={e=>setPassword(e.target.value)} 
              className="w-full p-4 rounded-2xl bg-slate-700 border border-slate-600 outline-none focus:border-green-500 transition font-bold text-white text-lg placeholder:text-slate-600" 
            />
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-green-600 text-white font-black text-xl py-5 rounded-3xl shadow-xl shadow-green-600/20 hover:bg-green-500 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
          >
            {loading ? 'Entrando...' : 'INICIAR TURNO 🛵'}
          </button>
        </form>
        
        <p className="text-center text-xs font-bold text-slate-600 mt-10">
          Problemas no acesso? Contate o suporte.
        </p>
      </div>
    </div>
  );
}
