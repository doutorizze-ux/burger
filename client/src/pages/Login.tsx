import { useState } from 'react';

export default function Login() {
  const [email, setEmail] = useState('admin@admin.com');
  const [password, setPassword] = useState('123456');

  const handleLogin = async (e: any) => {
    e.preventDefault();
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
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
          <div className="w-16 h-16 bg-orange-500 rounded-2xl mx-auto flex items-center justify-center text-white text-3xl font-bold shadow-lg shadow-orange-500/30 mb-4">
            🍔
          </div>
          <h2 className="text-2xl font-bold text-gray-800">Painel PitDog</h2>
          <p className="text-gray-500">Faça login para gerenciar seus pedidos</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} className="w-full p-4 rounded-xl bg-gray-50 border border-gray-200 outline-none focus:border-orange-500 transition" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Senha</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full p-4 rounded-xl bg-gray-50 border border-gray-200 outline-none focus:border-orange-500 transition" />
          </div>
          <button type="submit" className="w-full bg-orange-500 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-orange-600 transition">Entrar</button>
        </form>
      </div>
    </div>
  );
}
