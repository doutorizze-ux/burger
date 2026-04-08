import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

export default function Login() {
  const [params] = useSearchParams();
  const [isRegister, setIsRegister] = useState(params.get('register') === 'true');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [storeName, setStoreName] = useState('');

  const handleAuth = async (e: any) => {
    e.preventDefault();
    const endpoint = isRegister ? '/api/register' : '/api/login';
    const payload = isRegister ? { storeName, email, password } : { email, password };
    
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if(data.token) {
      localStorage.setItem('token', data.token);
      window.location.href = '/admin';
    } else {
      alert(data.error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-orange-500 rounded-2xl mx-auto flex items-center justify-center text-white text-3xl font-bold shadow-lg shadow-orange-500/30 mb-4">🍔</div>
          <h2 className="text-2xl font-bold text-gray-800">{isRegister ? 'Criar Loja no PitDog.ai' : 'Painel PitDog'}</h2>
          <p className="text-gray-500">{isRegister ? 'Teste grátis por 7 dias. Sem cartão.' : 'Faça login para gerenciar sua loja'}</p>
        </div>
        <form onSubmit={handleAuth} className="space-y-6">
          {isRegister && (
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Nome da Hamburgueria / PitDog</label>
              <input required type="text" value={storeName} onChange={e=>setStoreName(e.target.value)} className="w-full p-4 rounded-xl bg-gray-50 border border-gray-200 outline-none focus:border-orange-500 transition font-medium" />
            </div>
          )}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Email {isRegister && 'do Dono'}</label>
            <input required type="email" value={email} onChange={e=>setEmail(e.target.value)} className="w-full p-4 rounded-xl bg-gray-50 border border-gray-200 outline-none focus:border-orange-500 transition font-medium" />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Senha</label>
            <input required type="password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full p-4 rounded-xl bg-gray-50 border border-gray-200 outline-none focus:border-orange-500 transition font-medium" />
          </div>
          <button type="submit" className="w-full bg-orange-500 text-white font-black text-lg py-4 rounded-xl shadow-xl shadow-orange-500/30 hover:bg-orange-600 transition">
            {isRegister ? '🚀 Criar minha Conta' : 'Entrar na Loja'}
          </button>
        </form>
        <p className="text-center text-sm font-bold text-slate-500 mt-6 cursor-pointer hover:text-orange-500" onClick={()=>setIsRegister(!isRegister)}>
          {isRegister ? 'Já tem uma conta? Fazer Login' : 'Ainda não é assinante? Criar Loja.'}
        </p>
      </div>
    </div>
  );
}
