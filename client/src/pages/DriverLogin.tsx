import { useState } from 'react';
import { Truck, ChevronRight, ShieldCheck, Phone } from 'lucide-react';

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
    <div className="fixed inset-0 bg-[#050505] flex flex-col items-stretch justify-end p-6 font-sans">
      {/* Dynamic Background Element */}
      <div className="absolute top-[-10%] left-[-10%] w-[120%] h-[60%] bg-green-500/20 blur-[120px] rounded-full pointer-events-none"></div>
      
      <div className="flex-1 flex flex-col items-center justify-center relative z-10 text-center space-y-4">
          <div className="w-24 h-24 bg-green-500 rounded-[36px] flex items-center justify-center shadow-2xl shadow-green-500/40 rotate-12 transition-transform hover:rotate-0 duration-500">
              <Truck className="text-black" size={48} strokeWidth={3} />
          </div>
          <div className="pt-4">
              <h1 className="text-4xl font-black tracking-tighter text-white">BITDOG <span className="text-green-500 italic">FLEET</span></h1>
              <p className="text-gray-500 font-bold text-sm tracking-widest uppercase mt-1">Sua máquina de fazer dinheiro 🛵</p>
          </div>
      </div>

      <div className="relative z-20 space-y-8 pb-10">
          <form onSubmit={handleLogin} className="space-y-4">
              <div className="relative">
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500">
                      <Phone size={20}/>
                  </div>
                  <input 
                    required 
                    type="tel" 
                    placeholder="Seu telefone"
                    value={phone} 
                    onChange={e=>setPhone(e.target.value)} 
                    className="w-full bg-white/5 border border-white/10 p-5 pl-14 rounded-[24px] text-white font-bold text-lg outline-none focus:border-green-500/50 focus:bg-white/10 transition-all placeholder:text-gray-700" 
                  />
              </div>
              <div className="relative">
                   <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500">
                      <ShieldCheck size={20}/>
                  </div>
                  <input 
                    required 
                    type="password" 
                    placeholder="Sua senha"
                    value={password} 
                    onChange={e=>setPassword(e.target.value)} 
                    className="w-full bg-white/5 border border-white/10 p-5 pl-14 rounded-[24px] text-white font-bold text-lg outline-none focus:border-green-500/50 focus:bg-white/10 transition-all placeholder:text-gray-700" 
                  />
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-white text-black py-5 rounded-[28px] font-black text-xl flex items-center justify-center gap-3 shadow-2xl active:scale-95 transition-all disabled:opacity-50 group"
              >
                {loading ? 'CONECTANDO...' : 'INICIAR TURNO'}
                {!loading && <ChevronRight className="group-hover:translate-x-1 transition-transform" />}
              </button>
          </form>

          <div className="flex justify-center flex-col items-center gap-2 opacity-40">
              <p className="text-[10px] font-black tracking-widest uppercase">Tecnologia Segura BitDog v2.0</p>
              <div className="flex gap-1">
                  <div className="w-1 h-1 bg-white rounded-full"></div>
                  <div className="w-1 h-1 bg-white rounded-full"></div>
                  <div className="w-1 h-1 bg-white rounded-full"></div>
              </div>
          </div>
      </div>
    </div>
  );
}
