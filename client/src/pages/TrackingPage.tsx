import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';

export default function TrackingPage() {
  const { orderId } = useParams();
  const [order, setOrder] = useState<any>(null);
  const [driverLocation, setDriverLocation] = useState<any>(null);

  useEffect(() => {
     fetch(`/api/tracking/${orderId}`)
       .then(r => r.json())
       .then(data => {
          setOrder(data);
          if (data.deliveryTrackings && data.deliveryTrackings.length > 0) {
              setDriverLocation({ lat: data.deliveryTrackings[0].latitude, lng: data.deliveryTrackings[0].longitude });
          }
       });

     const socket = io();
     socket.emit('join_tracking', orderId);

     socket.on('delivery_update_location', (loc) => {
         setDriverLocation(loc);
     });

     return () => { socket.disconnect(); };
  }, [orderId]);

  if (!order) return <div className="p-10 text-center font-bold">Carregando Rastreamento...</div>;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
        <header className="bg-orange-600 text-white p-4 text-center shadow-md z-10">
           <h1 className="font-black text-xl">Rastreio PitDog</h1>
           <p className="text-sm">Pedido #{order.id.slice(-4)}</p>
        </header>

        {/* Fake Map Box to simulate map without API Key overhead for this demo */}
        <div className="flex-1 bg-slate-300 relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
            
            {driverLocation ? (
                 <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
                    <div className="animate-bounce bg-white p-2 rounded-full shadow-xl">
                       <span className="text-4xl">🛵</span>
                    </div>
                    <div className="bg-slate-800 text-white text-xs font-bold px-3 py-1 rounded-full mt-2 shadow-lg">
                       MOTOBOY A CAMINHO
                    </div>
                    <p className="mt-2 text-slate-500 font-bold text-[10px]">
                       (GPS: {driverLocation.lat.toFixed(4)}, {driverLocation.lng.toFixed(4)})
                    </p>
                 </div>
            ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                   <p className="bg-white/80 p-4 rounded-xl font-bold translate-y-10 text-slate-500">
                      ⏱️ Aguardando Motoboy compartilhar rotas...
                   </p>
                </div>
            )}
        </div>

        <div className="bg-white p-6 rounded-t-3xl shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.3)] z-20">
           <div className="w-12 h-1 bg-slate-200 mx-auto rounded-full mb-6"></div>
           <h2 className="font-bold text-lg text-slate-800">Detalhes da Entrega</h2>
           
           <div className="mt-4 flex flex-col gap-3">
               <div className="flex bg-slate-50 p-4 rounded-xl border border-slate-100 items-center justify-between">
                   <div className="font-bold text-slate-500">Status</div>
                   <div className={`font-black ${order.status === 'OUT_FOR_DELIVERY' ? 'text-blue-500' : 'text-orange-500'}`}>
                      {order.status === 'OUT_FOR_DELIVERY' ? 'SAIU PARA ENTREGA' : 'PREPARANDO...'}
                   </div>
               </div>
               
               <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                   <div className="font-bold text-slate-500 text-sm mb-1">Entregar em:</div>
                   <div className="font-bold text-slate-800 leading-tight">
                      {order.delivery_address}
                   </div>
               </div>
           </div>
        </div>
    </div>
  );
}
