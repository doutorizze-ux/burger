import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { ShoppingBag, Plus, Minus, CreditCard, Banknote, MapPin, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Catalog() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const customerId = searchParams.get('ref');

  const [tenant, setTenant] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [cart, setCart] = useState<any[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [address, setAddress] = useState('');
  const [payment, setPayment] = useState('PIX');
  const [orderDone, setOrderDone] = useState(false);

  useEffect(() => {
    fetch(`/api/public/catalog/${slug}`)
      .then(res => res.json())
      .then(data => {
        setTenant(data.tenant);
        setCategories(data.categories);
        setLoading(false);
      });
  }, [slug]);

  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(p => p.id === product.id);
      if(existing) return prev.map(p => p.id === product.id ? {...p, quantity: p.quantity + 1} : p);
      return [...prev, { ...product, quantity: 1, extras: [] }];
    });
  };

  const updateQty = (id: string, delta: number) => {
    setCart(prev => prev.map(p => p.id === id ? {...p, quantity: Math.max(0, p.quantity + delta)} : p).filter(p => p.quantity > 0));
  };

  const total = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const finalTotal = total + (tenant?.delivery_fee || 0);

  const placeOrder = async () => {
    if(!address) return alert('Por favor informe o endereço de entrega');
    const orderData = {
      tenant_id: tenant.id,
      customer_id: customerId,
      items: cart.map(c => ({ product_id: c.id, quantity: c.quantity, price: c.price, notes: '' })),
      delivery_address: address,
      payment_method: payment,
      total: finalTotal,
      delivery_fee: tenant.delivery_fee
    };

    const res = await fetch('/api/public/orders', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(orderData)
    });
    
    if(res.ok) {
      setOrderDone(true);
      setCart([]);
    }
  };

  if (loading) return <div className="h-screen w-full flex items-center justify-center bg-gray-50"><div className="animate-spin h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full"></div></div>;
  if (!tenant) return <div className="p-8 text-center text-gray-500">Loja não encontrada</div>;

  if (orderDone) return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
      <CheckCircle2 size={80} className="text-green-500 mb-6" />
      <h2 className="text-3xl font-bold text-gray-800 mb-2">Pedido Confirmado!</h2>
      <p className="text-gray-600 mb-8">Seu pedido foi recebido pela loja e você será notificado no WhatsApp.</p>
      <button onClick={() => setOrderDone(false)} className="px-6 py-3 bg-orange-500 text-white rounded-xl font-semibold shadow-lg">Ver cardápio novamente</button>
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-gray-50 font-sans pb-24">
      {/* Header Banner */}
      <div className="h-48 w-full bg-gradient-to-br from-orange-400 to-red-500 relative">
        <div className="absolute -bottom-10 left-6 w-24 h-24 bg-white rounded-2xl shadow-xl flex items-center justify-center text-3xl overflow-hidden border-4 border-gray-50">
           {tenant.logo_url ? <img src={tenant.logo_url} className="w-full h-full object-cover"/> : '🍔'}
        </div>
      </div>
      
      {/* Store Info */}
      <div className="pt-14 px-6 pb-6 bg-white shadow-sm rounded-b-3xl">
        <h1 className="text-2xl font-bold text-gray-800">{tenant.name}</h1>
        <div className="flex items-center gap-4 mt-2 text-sm text-gray-500 font-medium">
          <span className="flex items-center gap-1"><MapPin size={16}/> Entrega R$ {tenant.delivery_fee?.toFixed(2) || '0.00'}</span>
          <span>•</span>
          <span>Mín. R$ {tenant.min_order_value?.toFixed(2) || '0.00'}</span>
        </div>
      </div>

      {/* Categories Horizontal Scroll */}
      <div className="sticky top-0 bg-gray-50/90 backdrop-blur-md z-10 py-4 px-6 overflow-x-auto hide-scrollbar border-b border-gray-200">
        <div className="flex gap-3">
          {categories.map(c => (
            <div key={c.id} className="min-w-max px-4 py-2 bg-white rounded-full shadow-sm text-gray-700 font-medium cursor-pointer hover:bg-orange-50 border border-gray-100">
              {c.name}
            </div>
          ))}
        </div>
      </div>

      {/* Menu Sections */}
      <div className="px-6 py-6 space-y-8">
        {categories.map(c => (
          <div key={c.id}>
            <h2 className="text-xl font-bold text-gray-800 mb-4">{c.name}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {c.products.map((p: any) => (
                <motion.div whileTap={{ scale: 0.98 }} key={p.id} onClick={() => addToCart(p)} className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-gray-100 cursor-pointer">
                  <div className="pr-4 flex-1">
                    <h3 className="font-semibold text-gray-800">{p.name}</h3>
                    <p className="text-sm text-gray-500 line-clamp-2 my-1">{p.description}</p>
                    <span className="font-bold text-green-600">R$ {p.price.toFixed(2)}</span>
                  </div>
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} className="w-24 h-24 object-cover rounded-xl shadow-sm" />
                  ) : (
                    <div className="w-24 h-24 bg-gray-100 flex items-center justify-center rounded-xl text-gray-400">
                      <ShoppingBag size={24}/>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Floating Cart Button */}
      {cart.length > 0 && (
        <motion.div initial={{ y: 100 }} animate={{ y: 0 }} className="fixed bottom-6 left-6 right-6 z-20">
          <button onClick={() => setIsCartOpen(true)} className="w-full bg-orange-500 text-white rounded-2xl p-4 shadow-xl flex items-center justify-between font-bold text-lg hover:bg-orange-600 transition">
            <div className="bg-orange-600 px-3 py-1 rounded-lg">{cart.reduce((a,c)=>a+c.quantity,0)}</div>
            <span>Ver Carrinho</span>
            <span>R$ {total.toFixed(2)}</span>
          </button>
        </motion.div>
      )}

      {/* Cart Drawer */}
      <AnimatePresence>
        {isCartOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 z-50 flex flex-col justify-end">
            <div className="absolute inset-0" onClick={() => setIsCartOpen(false)} />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25 }} className="bg-white rounded-t-3xl w-full h-[85vh] relative flex flex-col items-center">
              <div className="w-12 h-1.5 bg-gray-300 rounded-full my-4" />
              <div className="w-full flex-1 overflow-y-auto px-6 pb-32">
                <h2 className="text-2xl font-bold mb-6 text-gray-800">Seu Pedido</h2>
                
                {cart.map(c => (
                  <div key={c.id} className="flex items-center justify-between mb-4 bg-gray-50 p-4 rounded-2xl">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-800">{c.name}</h4>
                      <p className="text-orange-600 font-medium">R$ {(c.price * c.quantity).toFixed(2)}</p>
                    </div>
                    <div className="flex items-center gap-3 bg-white px-3 py-1.5 rounded-xl shadow-sm border border-gray-100">
                      <button onClick={()=>updateQty(c.id, -1)} className="text-gray-500"><Minus size={18}/></button>
                      <span className="font-bold w-4 text-center">{c.quantity}</span>
                      <button onClick={()=>updateQty(c.id, 1)} className="text-orange-500"><Plus size={18}/></button>
                    </div>
                  </div>
                ))}

                <div className="mt-8 space-y-6">
                  <div>
                    <h3 className="font-semibold flex items-center gap-2 mb-3 text-gray-700"><MapPin size={18}/> Endereço de Entrega</h3>
                    <input type="text" placeholder="Rua, Número, Bairro, Ponto de ref." className="w-full p-4 rounded-2xl bg-gray-50 border border-gray-200 outline-none focus:border-orange-500" value={address} onChange={(e)=>setAddress(e.target.value)} />
                  </div>
                  <div>
                    <h3 className="font-semibold flex items-center gap-2 mb-3 text-gray-700"><CreditCard size={18}/> Pagamento na Entrega</h3>
                    <div className="flex gap-4">
                      <label className={`flex-1 p-4 rounded-2xl border-2 flex flex-col items-center gap-2 cursor-pointer transition ${payment === 'PIX' ? 'border-orange-500 bg-orange-50 text-orange-600' : 'border-gray-200 text-gray-500'}`}>
                        <input type="radio" className="hidden" checked={payment==='PIX'} onChange={()=>setPayment('PIX')}/>
                        <Banknote size={24}/>
                        <span className="font-semibold">PIX</span>
                      </label>
                      <label className={`flex-1 p-4 rounded-2xl border-2 flex flex-col items-center gap-2 cursor-pointer transition ${payment === 'CARTAO' ? 'border-orange-500 bg-orange-50 text-orange-600' : 'border-gray-200 text-gray-500'}`}>
                        <input type="radio" className="hidden" checked={payment==='CARTAO'} onChange={()=>setPayment('CARTAO')}/>
                        <CreditCard size={24}/>
                        <span className="font-semibold">Cartão</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="mt-8 border-t border-gray-100 pt-6 space-y-3">
                  <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>R$ {total.toFixed(2)}</span></div>
                  <div className="flex justify-between text-gray-500"><span>Taxa de Entrega</span><span>R$ {tenant.delivery_fee?.toFixed(2)}</span></div>
                  <div className="flex justify-between font-bold text-xl text-gray-800 pt-3 border-t border-gray-100">
                    <span>Total</span><span>R$ {finalTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="absolute bottom-0 left-0 right-0 p-6 bg-white border-t border-gray-100">
                <button onClick={placeOrder} className="w-full bg-orange-500 text-white py-4 rounded-2xl font-bold text-lg shadow-lg hover:bg-orange-600">
                  Confirmar Pedido
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
