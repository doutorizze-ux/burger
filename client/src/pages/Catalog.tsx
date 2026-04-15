import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { ShoppingBag, Plus, Minus, CreditCard, Banknote, MapPin, CheckCircle2, X, FastForward } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { useJsApiLoader, Autocomplete } from '@react-google-maps/api';
import { useRef } from 'react';

const libraries: ("places")[] = ["places"];

export default function Catalog() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const initialCustomerId = searchParams.get('ref');

  const [tenant, setTenant] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [cart, setCart] = useState<any[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Checkout Info
  const [address, setAddress] = useState('');
  const [payment, setPayment] = useState('PIX');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [orderDone, setOrderDone] = useState(false);

  // Partial Selection Modal
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [tempExtras, setTempExtras] = useState<any[]>([]);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: (import.meta as any).env.VITE_GOOGLE_MAPS_KEY || "",
    libraries
  });

  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  const onPlaceChanged = () => {
      if (autocompleteRef.current) {
          const place = autocompleteRef.current.getPlace();
          if (place && place.formatted_address) {
              setAddress(place.formatted_address);
          } else if (place && place.name) {
              setAddress(place.name); // Fallback
          }
      }
  };

  useEffect(() => {
    fetch(`/api/public/catalog/${slug}`)
      .then(res => res.json())
      .then(data => {
        setTenant(data.tenant);
        setCategories(data.categories);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [slug]);

  const openProduct = (product: any) => {
    setSelectedProduct(product);
    setTempExtras([]); // Reset extras selection
  };

  const toggleExtra = (extra: any) => {
    setTempExtras(prev => {
      const exists = prev.find(e => e.id === extra.id);
      if (exists) return prev.filter(e => e.id !== extra.id);
      return [...prev, extra];
    });
  };

  const confirmAddToCart = () => {
    if (!selectedProduct) return;
    
    setCart(prev => {
      // For simplicity, we treat product+extras combo as unique or just add new line
      // Given many combos, it's safer to just add as a new item or match exact combo
      const newItem = {
        ...selectedProduct,
        cartId: Date.now() + Math.random(), // Unique item in cart
        quantity: 1,
        selectedExtras: [...tempExtras],
        totalPrice: selectedProduct.price + tempExtras.reduce((acc, e) => acc + e.price, 0)
      };
      return [...prev, newItem];
    });
    
    setSelectedProduct(null);
    setTempExtras([]);
    toast.success('Adicionado ao carrinho!');
  };

  const updateQty = (cartId: any, delta: number) => {
    setCart(prev => prev.map(p => p.cartId === cartId ? {...p, quantity: Math.max(0, p.quantity + delta)} : p).filter(p => p.quantity > 0));
  };

  const total = cart.reduce((acc, item) => acc + (item.totalPrice * item.quantity), 0);
  const finalTotal = total + (tenant?.delivery_fee || 0);

  const placeOrder = async () => {
    if (!address) return toast.error('Informe o endereço de entrega');
    if (!initialCustomerId && (!customerName || !customerPhone)) {
        return toast.error('Informe seu nome e telefone');
    }
    if (tenant?.min_order_value && total < tenant.min_order_value) {
        return toast.error(`Pedido mínimo é R$ ${tenant.min_order_value.toFixed(2)}`);
    }

    setIsPlacingOrder(true);
    
    const orderData = {
      tenant_id: tenant.id,
      customer_id: initialCustomerId,
      // Fallback for anonymous users: the backend should handle creating a customer if ID is null
      guest_info: !initialCustomerId ? { name: customerName, phone: customerPhone } : null,
      items: cart.map(c => ({ 
        product_id: c.id, 
        quantity: c.quantity, 
        price: c.totalPrice, 
        notes: '',
        extras: c.selectedExtras
      })),
      delivery_address: address,
      payment_method: payment,
      total: finalTotal,
      delivery_fee: tenant.delivery_fee
    };

    try {
        const res = await fetch('/api/public/orders', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(orderData)
        });
        
        const result = await res.json();

        if (res.ok) {
          setOrderDone(true);
          setCart([]);
          setIsCartOpen(false);
        } else {
           toast.error(result.error || 'Erro ao processar pedido');
        }
    } catch (e) {
        toast.error('Erro de conexão com o servidor');
    } finally {
        setIsPlacingOrder(false);
    }
  };

  if (loading) return <div className="h-screen w-full flex items-center justify-center bg-white"><div className="animate-spin h-10 w-10 border-4 border-orange-500 border-t-transparent rounded-full"></div></div>;
  if (!tenant) return <div className="h-screen flex items-center justify-center p-8 text-center text-gray-500 font-bold">Loja não encontrada ou link expirado</div>;

  if (orderDone) return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} className="min-h-screen bg-white flex flex-col items-center justify-center p-8 text-center">
      <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-8">
        <CheckCircle2 size={50} className="text-green-500" />
      </div>
      <h2 className="text-4xl font-black text-gray-900 mb-4 tracking-tighter">PEDIDO REALIZADO!</h2>
      <p className="text-gray-500 mb-10 text-lg">Seu pedido foi recebido pela <b>{tenant.name}</b>.<br/>Fique de olho no seu WhatsApp para atualizações!</p>
      <button onClick={() => setOrderDone(false)} className="w-full max-w-xs py-5 bg-primary text-black rounded-3xl font-black shadow-xl shadow-black/20 text-lg uppercase tracking-widest">Ver Cardápio</button>
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-32">
      {/* Premium Header */}
      <div className="relative h-64 w-full overflow-hidden">
        <div className="absolute inset-0 bg-gray-900">
           {tenant.logo_url && <img src={tenant.logo_url} className="w-full h-full object-cover opacity-40 blur-sm scale-110" />}
           <div className="absolute inset-0 bg-gradient-to-t from-slate-50 to-transparent" />
        </div>
        
        <div className="absolute bottom-0 left-0 right-0 p-8 flex items-end gap-6">
           <div className="w-28 h-28 bg-white rounded-[32px] shadow-2xl flex items-center justify-center text-4xl overflow-hidden border-4 border-white flex-shrink-0">
               {tenant.logo_url ? <img src={tenant.logo_url} className="w-full h-full object-cover"/> : '🍔'}
           </div>
           <div className="mb-2">
              <h1 className="text-3xl font-black text-gray-900 tracking-tighter leading-none mb-2">{tenant.name}</h1>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 bg-white/80 backdrop-blur-md rounded-full text-[10px] font-black text-black border border-orange-100 flex items-center gap-1">
                   <MapPin size={10}/> ENTREGA: R$ {tenant.delivery_fee?.toFixed(2)}
                </span>
                <span className="px-3 py-1 bg-white/80 backdrop-blur-md rounded-full text-[10px] font-black text-gray-500 border border-gray-100 italic">
                   MIN: R$ {tenant.min_order_value?.toFixed(2)}
                </span>
              </div>
           </div>
        </div>
      </div>

      {/* Categories Bar */}
      <div className="sticky top-0 bg-white/80 backdrop-blur-xl z-30 py-4 px-6 overflow-x-auto border-b border-slate-100 flex gap-4 scrollbar-hide">
          {categories.map(c => (
            <a key={c.id} href={`#cat-${c.id}`} className="min-w-max px-5 py-2.5 bg-slate-50 hover:bg-slate-1000 hover:text-white rounded-2xl text-slate-600 font-black text-xs uppercase tracking-widest transition-all">
              {c.name}
            </a>
          ))}
      </div>

      {/* Menu Body */}
      <div className="px-6 py-8 space-y-12 max-w-4xl mx-auto">
        {categories.map(c => (
          <div key={c.id} id={`cat-${c.id}`} className="scroll-mt-24">
            <h2 className="text-2xl font-black text-gray-900 mb-6 flex items-center gap-3">
               <span className="w-2 h-8 bg-slate-1000 rounded-full" /> {c.name.toUpperCase()}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {c.products.map((p: any) => (
                <motion.div 
                  whileTap={{ scale: 0.97 }} 
                  key={p.id} 
                  onClick={() => openProduct(p)} 
                  className="flex bg-white p-5 rounded-[32px] shadow-sm border border-slate-100 cursor-pointer hover:shadow-xl transition-all relative group"
                >
                  <div className="flex-1 pr-4">
                    <h3 className="font-black text-gray-800 text-lg tracking-tight mb-1 group-hover:text-black transition-colors uppercase">{p.name}</h3>
                    <p className="text-xs text-gray-400 font-medium line-clamp-2 mb-4 leading-relaxed">{p.description}</p>
                    <div className="flex items-center justify-between">
                       <span className="font-black text-xl text-green-600">R$ {p.price.toFixed(2)}</span>
                       <div className="bg-orange-100 text-black p-2 rounded-xl group-hover:bg-slate-1000 group-hover:text-white transition-all">
                          <Plus size={18} />
                       </div>
                    </div>
                  </div>
                  <div className="w-28 h-28 bg-slate-50 flex-shrink-0 rounded-3xl overflow-hidden border border-slate-100 shadow-inner">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-200"><ShoppingBag size={32}/></div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Product Detail Modal (Selection) */}
      <AnimatePresence>
        {selectedProduct && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={()=>setSelectedProduct(null)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="relative bg-white w-full max-w-lg sm:rounded-[48px] rounded-t-[48px] overflow-hidden flex flex-col max-h-[90vh]">
               <button onClick={()=>setSelectedProduct(null)} className="absolute top-6 right-6 z-10 p-3 bg-white/20 hover:bg-white/40 backdrop-blur-md rounded-full text-white sm:text-slate-800 sm:bg-slate-100">
                  <X size={20}/>
               </button>
               
               <div className="h-48 sm:h-64 bg-slate-200 relative">
                  {selectedProduct.image_url ? <img src={selectedProduct.image_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-300 bg-slate-100"><ShoppingBag size={64}/></div>}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-6 left-8">
                     <h3 className="text-2xl font-black text-white uppercase tracking-tighter">{selectedProduct.name}</h3>
                  </div>
               </div>

               <div className="p-8 flex-1 overflow-y-auto">
                  <p className="text-slate-500 font-medium mb-8 leading-relaxed italic border-l-4 border-orange-500 pl-4">{selectedProduct.description}</p>
                  
                  {selectedProduct.extras && selectedProduct.extras.length > 0 && (
                    <div className="space-y-4">
                       <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Turbine seu pedido (Extras)</h4>
                       {selectedProduct.extras.map((ex: any) => (
                         <div key={ex.id} onClick={()=>toggleExtra(ex)} className={`p-5 rounded-3xl border-2 transition-all cursor-pointer flex justify-between items-center ${tempExtras.find(e=>e.id===ex.id) ? 'border-orange-500 bg-slate-100 shadow-md' : 'border-slate-100 hover:border-slate-200'}`}>
                            <div>
                               <p className={`font-black uppercase text-sm ${tempExtras.find(e=>e.id===ex.id) ? 'text-black' : 'text-slate-700'}`}>{ex.name}</p>
                               <p className="text-xs font-bold text-green-600">+ R$ {ex.price.toFixed(2)}</p>
                            </div>
                            <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${tempExtras.find(e=>e.id===ex.id) ? 'bg-slate-1000 border-orange-500 text-white' : 'border-slate-200'}`}>
                               {tempExtras.find(e=>e.id===ex.id) ? <CheckCircle2 size={16}/> : <Plus size={16}/>}
                            </div>
                         </div>
                       ))}
                    </div>
                  )}
                  {(!selectedProduct.extras || selectedProduct.extras.length === 0) && (
                    <div className="py-10 text-center text-slate-300 font-bold uppercase text-[10px] tracking-widest">Este item não possui adicionais</div>
                  )}
               </div>

               <div className="p-8 border-t border-slate-100 bg-slate-50 flex gap-4">
                  <div className="flex-1">
                     <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Total do Item</p>
                     <p className="text-2xl font-black text-gray-900 leading-none">R$ {(selectedProduct.price + tempExtras.reduce((acc,e)=>acc+e.price,0)).toFixed(2)}</p>
                  </div>
                  <button onClick={confirmAddToCart} className="flex-[2] bg-primary text-black rounded-2xl font-black shadow-lg shadow-black/20 hover:bg-primary border-black border transition-all flex items-center justify-center gap-3 active:scale-95 text-xs tracking-widest">
                     ADICIONAR AGORA <ShoppingBag size={18}/>
                  </button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Fixed Footer Bar (Cart Access) */}
      <AnimatePresence>
        {cart.length > 0 && (
          <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }} className="fixed bottom-0 left-0 right-0 z-50 p-6 bg-white/70 backdrop-blur-xl border-t border-slate-200">
            <button onClick={() => setIsCartOpen(true)} className="w-full max-w-4xl mx-auto bg-black text-white rounded-3xl p-5 shadow-2xl flex items-center justify-between font-black text-xs tracking-widest uppercase hover:bg-slate-800 transition-all active:scale-[0.98]">
              <div className="flex items-center gap-4">
                <div className="bg-primary text-black w-10 h-10 rounded-xl flex items-center justify-center text-lg">{cart.length}</div>
                <span>Ver sacola de lanches</span>
              </div>
              <span className="text-xl">R$ {total.toFixed(2)}</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cart Drawer (Visual Overhaul) */}
      <AnimatePresence>
        {isCartOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex flex-col justify-end lg:items-center">
            <div className="absolute inset-0" onClick={() => setIsCartOpen(false)} />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="relative bg-white lg:rounded-t-[56px] rounded-t-[48px] w-full max-w-3xl h-[95vh] flex flex-col shadow-2xl">
              <div className="flex-1 overflow-y-auto px-10 pt-12 pb-48 scrollbar-hide">
                <h2 className="text-4xl font-black mb-10 text-gray-900 tracking-tighter">SUA SACOLA 🛍️</h2>
                
                <div className="space-y-6">
                  {cart.map(c => (
                    <div key={c.cartId} className="bg-slate-50 p-6 rounded-[32px] border border-slate-100 flex items-center gap-6">
                      <div className="w-16 h-16 bg-white rounded-2xl flex-shrink-0 flex items-center justify-center text-2xl shadow-sm border border-slate-100">
                         {c.image_url ? <img src={c.image_url} className="w-full h-full object-cover rounded-2xl"/> : '🍔'}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-black text-slate-800 uppercase text-sm leading-tight">{c.name}</h4>
                        <div className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-widest space-y-0.5">
                           {c.selectedExtras.map((e:any) => <div key={e.id}>+ {e.name} (+ R$ {e.price.toFixed(2)})</div>)}
                           {c.selectedExtras.length === 0 && <div>Lanche Original</div>}
                        </div>
                        <p className="text-lg font-black text-black mt-2">R$ {(c.totalPrice * c.quantity).toFixed(2)}</p>
                      </div>
                      <div className="flex flex-col items-center gap-2 bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
                        <button onClick={()=>updateQty(c.cartId, 1)} className="text-black hover:scale-110 active:scale-90 transition-all"><Plus size={20}/></button>
                        <span className="font-black text-lg w-6 text-center">{c.quantity}</span>
                        <button onClick={()=>updateQty(c.cartId, -1)} className="text-slate-300 hover:text-red-400 transition-all"><Minus size={20}/></button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Personalized Delivery Fields */}
                <div className="mt-12 space-y-10">
                  {!initialCustomerId && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4 mb-2 block">Seu Nome</label>
                        <input required placeholder="Ex: João Silva" className="w-full p-5 rounded-[24px] bg-slate-50 border border-slate-200 outline-none focus:border-orange-500 font-bold" value={customerName} onChange={e=>setCustomerName(e.target.value)} />
                      </div>
                      <div className="col-span-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4 mb-2 block">WhatsApp</label>
                        <input required placeholder="(62) 99999-9999" className="w-full p-5 rounded-[24px] bg-slate-50 border border-slate-200 outline-none focus:border-orange-500 font-bold text-black" value={customerPhone} onChange={e=>setCustomerPhone(e.target.value)} />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4 mb-2 block flex items-center gap-2"><MapPin size={12}/> Onde entregamos?</label>
                    {isLoaded ? (
                        <Autocomplete
                            onLoad={(ref) => autocompleteRef.current = ref}
                            onPlaceChanged={onPlaceChanged}
                            options={{ componentRestrictions: { country: "br" } }}
                        >
                            <input 
                                type="text" 
                                placeholder="Busque seu endereço igual no Uber/iFood..." 
                                className="w-full p-6 rounded-[28px] bg-slate-50 border border-slate-200 outline-none focus:border-orange-500 font-bold" 
                                value={address} 
                                onChange={(e)=>setAddress(e.target.value)} 
                            />
                        </Autocomplete>
                    ) : (
                        <input type="text" placeholder="Rua, Número, Bairro, e Complemento" className="w-full p-6 rounded-[28px] bg-slate-50 border border-slate-200 outline-none focus:border-orange-500 font-bold" value={address} onChange={(e)=>setAddress(e.target.value)} />
                    )}
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4 mb-3 block flex items-center gap-2"><CreditCard size={12}/> Como vai pagar?</label>
                    <div className="flex gap-4">
                      {['PIX', 'CARTÃO', 'DINHEIRO'].map(m => (
                        <label key={m} className={`flex-1 p-5 rounded-[28px] border-2 flex flex-col items-center gap-2 cursor-pointer transition-all ${payment === m ? 'border-orange-500 bg-slate-100/50 text-black scale-[1.02] shadow-lg shadow-black/20' : 'border-slate-100 bg-slate-50 text-slate-400 opacity-60'}`}>
                          <input type="radio" className="hidden" checked={payment===m} onChange={()=>setPayment(m)}/>
                          {m === 'PIX' ? <FastForward size={24}/> : m === 'DINHEIRO' ? <Banknote size={24}/> : <CreditCard size={24}/>}
                          <span className="font-black text-[10px] uppercase tracking-widest">{m}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-12 border-t border-slate-100 pt-8 space-y-4">
                  <div className="flex justify-between text-slate-400 font-bold text-sm uppercase"><span>Subtotal</span><span>R$ {total.toFixed(2)}</span></div>
                  <div className="flex justify-between text-slate-400 font-bold text-sm uppercase"><span>Taxa Fixa ({tenant.name})</span><span>R$ {tenant.delivery_fee?.toFixed(2)}</span></div>
                  <div className="flex justify-between font-black text-3xl text-gray-900 pt-6 border-t border-slate-100 tracking-tighter">
                    <span>TOTAL</span><span>R$ {finalTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="absolute bottom-0 left-0 right-0 p-10 bg-white border-t border-slate-100">
                <button 
                   disabled={isPlacingOrder}
                   onClick={placeOrder} 
                   className={`w-full bg-primary text-black py-6 rounded-3xl font-black text-lg shadow-2xl shadow-black/20 hover:bg-primary border-black border transition-all active:scale-[0.98] ${isPlacingOrder ? 'opacity-50' : ''}`}
                >
                  {isPlacingOrder ? 'PROCESSANDO...' : 'FINALIZAR E ENVIAR 🚀'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
