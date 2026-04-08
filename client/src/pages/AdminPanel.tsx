import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../App';
import io from 'socket.io-client';
import { QrCode, UtensilsCrossed, LayoutDashboard, Settings, LogOut, Clock, Truck } from 'lucide-react';
import QRCode from 'react-qr-code';

let socket: any;

export default function AdminPanel() {
  const { user } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('orders');
  
  const [orders, setOrders] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [waStatus, setWaStatus] = useState(user?.whatsapp_status);
  const [waQr, setWaQr] = useState('');

  // Form states
  const [newCat, setNewCat] = useState('');
  const [newProd, setNewProd] = useState({ name: '', price: '', category_id: '', description: '' });

  const token = localStorage.getItem('token');
  const headers = { 'Authorization': `Bearer ${token}` };

  useEffect(() => {
    if(!user?.id) return;
    socket = io();
    socket.emit('join', user.tenant_id);
    socket.on('new_order', (o:any) => setOrders(prev => [o, ...prev]));
    socket.on('qr_code', (qr:any) => setWaQr(qr));
    socket.on('whatsapp_status', (st:any) => { setWaStatus(st); if(st==='CONNECTED') setWaQr(''); });

    fetchData();
  }, [user]);

  const fetchData = async () => {
    fetch('/api/orders', {headers}).then(r=>r.json()).then(setOrders);
    fetch('/api/categories', {headers}).then(r=>r.json()).then(setCategories);
    fetch('/api/products', {headers}).then(r=>r.json()).then(setProducts);
  };

  const updateOrderStatus = async (id: string, status: string) => {
    await fetch(`/api/orders/${id}/status`, {
      method: 'PUT', headers: { ...headers, 'Content-Type':'application/json' },
      body: JSON.stringify({ status })
    });
    fetchData();
  };

  const addCategory = async (e:any) => {
    e.preventDefault();
    await fetch('/api/categories', { method: 'POST', headers: { ...headers, 'Content-Type':'application/json' }, body: JSON.stringify({ name: newCat }) });
    setNewCat('');
    fetchData();
  };

  const addProduct = async (e:any) => {
    e.preventDefault();
    await fetch('/api/products', { method: 'POST', headers: { ...headers, 'Content-Type':'application/json' }, body: JSON.stringify(newProd) });
    setNewProd({ name: '', price: '', category_id: '', description: '' });
    fetchData();
  };

  const connectWA = () => {
    fetch('/api/whatsapp/connect', { method: 'POST', headers });
  };

  const logout = () => {
    localStorage.removeItem('token');
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      <div className="w-full md:w-64 bg-white border-r border-gray-200 shadow-sm flex flex-col">
        <div className="p-6 border-b border-gray-100 flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center text-white font-bold text-xl">🍔</div>
          <h1 className="font-bold text-xl text-gray-800">PitDog Pro</h1>
        </div>
        <nav className="p-4 flex-1 space-y-2">
          <button onClick={()=>setActiveTab('orders')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition ${activeTab==='orders'?'bg-orange-50 text-orange-600': 'text-gray-600 hover:bg-gray-50'}`}>
            <LayoutDashboard size={20}/> Pedidos
          </button>
          <button onClick={()=>setActiveTab('menu')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition ${activeTab==='menu'?'bg-orange-50 text-orange-600': 'text-gray-600 hover:bg-gray-50'}`}>
            <UtensilsCrossed size={20}/> Cardápio
          </button>
          <button onClick={()=>setActiveTab('settings')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition ${activeTab==='settings'?'bg-orange-50 text-orange-600': 'text-gray-600 hover:bg-gray-50'}`}>
            <Settings size={20}/> Configurações
          </button>
        </nav>
        <div className="p-4 border-t border-gray-100">
          <button onClick={logout} className="w-full flex items-center gap-3 px-4 py-3 text-red-500 font-medium hover:bg-red-50 rounded-xl transition">
            <LogOut size={20}/> Sair
          </button>
        </div>
      </div>

      <div className="flex-1 p-8 overflow-y-auto">
        <h2 className="text-3xl font-bold text-gray-800 mb-8 capitalize">{activeTab === 'orders' ? 'Pedidos em Tempo Real' : activeTab === 'menu' ? 'Gerenciar Cardápio' : 'Configurações do Sistema'}</h2>

        {activeTab === 'orders' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {['PENDING', 'PREPARING', 'DELIVERED'].map((status) => (
              <div key={status} className="bg-gray-100/50 rounded-2xl p-4 border border-gray-200">
                <h3 className="font-bold text-gray-700 flex items-center gap-2 mb-4 uppercase text-sm">
                  {status === 'PENDING' ? <Clock className="text-orange-500" size={18}/> : status === 'PREPARING' ? <UtensilsCrossed className="text-blue-500" size={18}/> : <Truck className="text-green-500" size={18}/>}
                  {status === 'PENDING' ? 'Aguardando' : status === 'PREPARING' ? 'Preparando' : 'Entregando'}
                </h3>
                <div className="space-y-4">
                  {orders.filter(o=>o.status===status).map(o => (
                    <div key={o.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                      <div className="flex justify-between items-start mb-3">
                        <span className="font-bold text-gray-800">#{o.id.slice(-4)}</span>
                        <span className="text-xs font-semibold bg-green-50 text-green-600 px-2 py-1 rounded-md">R$ {o.total.toFixed(2)}</span>
                      </div>
                      <p className="text-sm font-medium text-gray-600 mb-1">{o.customer?.name}</p>
                      <p className="text-sm text-gray-500 mb-3">{o.delivery_address}</p>
                      <div className="space-y-1 mb-4">
                        {o.items.map((it:any) => (
                          <div key={it.id} className="text-sm text-gray-600">• {it.quantity}x {it.product?.name}</div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        {status === 'PENDING' && <button onClick={()=>updateOrderStatus(o.id, 'PREPARING')} className="flex-1 bg-blue-500 text-white text-sm font-bold py-2 rounded-lg hover:bg-blue-600 transition">Aceitar</button>}
                        {status === 'PREPARING' && <button onClick={()=>updateOrderStatus(o.id, 'DELIVERED')} className="flex-1 bg-green-500 text-white text-sm font-bold py-2 rounded-lg hover:bg-green-600 transition">Despachar</button>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'menu' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="font-bold text-lg mb-4">Adicionar Categoria</h3>
              <form onSubmit={addCategory} className="flex gap-3">
                <input required placeholder="Ex: Sanduíches" value={newCat} onChange={e=>setNewCat(e.target.value)} className="flex-1 p-3 rounded-xl border border-gray-200 outline-none focus:border-orange-500" />
                <button className="bg-orange-500 text-white font-bold px-6 py-3 rounded-xl hover:bg-orange-600 transition">Criar</button>
              </form>
              <div className="mt-6 space-y-2">
                {categories.map(c => <div key={c.id} className="p-3 bg-gray-50 rounded-lg text-gray-700 font-medium">{c.name}</div>)}
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="font-bold text-lg mb-4">Adicionar Produto</h3>
              <form onSubmit={addProduct} className="space-y-4">
                <input required placeholder="Nome do Produto" value={newProd.name} onChange={e=>setNewProd({...newProd, name: e.target.value})} className="w-full p-3 rounded-xl border border-gray-200 outline-none focus:border-orange-500" />
                <div className="flex gap-4">
                  <input required type="number" step="0.01" placeholder="Preço" value={newProd.price} onChange={e=>setNewProd({...newProd, price: e.target.value})} className="w-1/2 p-3 rounded-xl border border-gray-200 outline-none focus:border-orange-500" />
                  <select required value={newProd.category_id} onChange={e=>setNewProd({...newProd, category_id: e.target.value})} className="w-1/2 p-3 rounded-xl border border-gray-200 outline-none focus:border-orange-500 bg-white">
                    <option value="">Categoria...</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <textarea placeholder="Descrição (Opcional)" value={newProd.description} onChange={e=>setNewProd({...newProd, description: e.target.value})} className="w-full p-3 rounded-xl border border-gray-200 outline-none focus:border-orange-500 h-24 resize-none" />
                <button className="w-full bg-orange-500 text-white font-bold px-6 py-3 rounded-xl hover:bg-orange-600 transition">Salvar Produto</button>
              </form>
            </div>
            
            <div className="md:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
               <h3 className="font-bold text-lg mb-4">Produtos Cadastrados</h3>
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                 {products.map(p => (
                   <div key={p.id} className="border border-gray-100 p-4 rounded-xl items-center flex justify-between">
                     <div>
                       <div className="font-semibold text-gray-800">{p.name}</div>
                       <div className="text-orange-600 font-bold">R$ {p.price.toFixed(2)}</div>
                     </div>
                     <div className="text-xs bg-gray-100 px-2 py-1 rounded-md text-gray-600">{p.category?.name}</div>
                   </div>
                 ))}
               </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-xl bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <QrCode size={32}/>
            </div>
            <h3 className="text-2xl font-bold text-gray-800 mb-2">Bot do WhatsApp</h3>
            <p className="text-gray-500 mb-8">Conecte o número do seu atendimento para enviar o cardápio e atualizar os clientes automaticamente.</p>
            
            <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 flex flex-col items-center">
              <div className="flex items-center gap-3 mb-6">
                <span className="font-semibold text-gray-700">Status atual:</span>
                <span className={`px-3 py-1 rounded-full text-sm font-bold ${waStatus==='CONNECTED'?'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                  {waStatus === 'CONNECTED' ? 'Online' : 'Desconectado'}
                </span>
              </div>
              
              {waStatus !== 'CONNECTED' && !waQr && (
                <button onClick={connectWA} className="bg-orange-500 text-white font-bold px-8 py-3 rounded-xl shadow-lg hover:bg-orange-600 transition">
                  Gerar QR Code
                </button>
              )}
              
              {waQr && (
                <div className="bg-white p-4 rounded-xl shadow-sm inline-block">
                  <QRCode value={waQr} size={200} />
                  <p className="text-sm text-gray-500 mt-4 font-medium">Escaneie com o seu WhatsApp</p>
                </div>
              )}
            </div>
            
            <div className="mt-8 text-left bg-blue-50 p-6 rounded-2xl border border-blue-100">
               <h4 className="font-bold text-blue-800 mb-2">Link do seu Cardápio</h4>
               <p className="text-sm text-blue-600 mb-2">Compartilhe este link no Instagram ou envie diretamente para os clientes:</p>
               <div className="bg-white p-3 rounded-xl border border-blue-200 font-mono text-sm text-gray-800 font-medium">
                 {window.location.origin}/catalogo/{user?.slug}
               </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
