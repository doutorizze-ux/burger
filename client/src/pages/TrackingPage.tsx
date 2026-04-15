import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { GoogleMap, useJsApiLoader, Marker, DirectionsRenderer } from '@react-google-maps/api';
import { uberDarkMapStyle } from '../mapStyles';

const mapContainerStyle = {
  width: '100%',
  height: '100%'
};

export default function TrackingPage() {
  const { orderId } = useParams();
  const [order, setOrder] = useState<any>(null);
  const [driverLocation, setDriverLocation] = useState<any>(null);
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: (import.meta as any).env.VITE_GOOGLE_MAPS_KEY || ""
  });

  useEffect(() => {
     fetch(`/api/tracking/${orderId}`)
       .then(r => r.json())
       .then(data => {
          setOrder(data);
          if (data.deliveryTrackings && data.deliveryTrackings.length > 0) {
              setDriverLocation({ lat: data.deliveryTrackings[0].latitude, lng: data.deliveryTrackings[0].longitude });
          }
       });

     const apiUrl = import.meta.env.VITE_API_URL || '';
     const socket = io(apiUrl, { transports: ['websocket', 'polling'] });
     socket.emit('join_tracking', orderId);

     socket.on('delivery_update_location', (loc) => {
         setDriverLocation(loc);
     });

     return () => { socket.disconnect(); };
  }, [orderId]);

  useEffect(() => {
    if (!isLoaded || !driverLocation || !order?.delivery_address) {
        setDirections(null);
        return;
    }

    const directionsService = new google.maps.DirectionsService();
    directionsService.route(
        {
            origin: driverLocation,
            destination: order.delivery_address,
            travelMode: google.maps.TravelMode.DRIVING,
        },
        (result, status) => {
            if (status === google.maps.DirectionsStatus.OK) {
                setDirections(result);
            }
        }
    );
  }, [isLoaded, driverLocation, order]);

  if (!order) return <div className="p-10 text-center font-bold">Carregando Rastreamento...</div>;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
        <header className="bg-primary text-black p-4 text-center shadow-md z-10">
           <h1 className="font-black text-xl">Rastreio PitDog</h1>
           <p className="text-sm">Pedido #{order.id.slice(-4)}</p>
        </header>

        <div className="flex-1 bg-slate-300 relative overflow-hidden">
            {isLoaded && driverLocation ? (
                 <GoogleMap
                    mapContainerStyle={mapContainerStyle}
                    center={driverLocation}
                    zoom={15}
                    options={{
                        styles: uberDarkMapStyle,
                        zoomControl: false,
                        streetViewControl: false,
                        mapTypeControl: false,
                        fullscreenControl: false,
                    }}
                 >
                    {directions && (
                         <DirectionsRenderer 
                             directions={directions} 
                             options={{
                                 polylineOptions: { strokeColor: '#0ea5e9', strokeWeight: 6, strokeOpacity: 0.8 },
                                 suppressMarkers: true
                             }} 
                         />
                     )}
                    <Marker 
                        position={driverLocation} 
                        icon={{ url: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png", scaledSize: new window.google.maps.Size(25, 41) }}
                        zIndex={50}
                    />
                    {directions && <Marker position={directions.routes[0].legs[0].end_location} icon={{ url: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png", scaledSize: new window.google.maps.Size(25, 41) }} zIndex={49} />}
                 </GoogleMap>
            ) : (
                <div className="absolute inset-0 flex items-center justify-center flex-col gap-4">
                   <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full"></div>
                   <p className="bg-white/80 p-4 rounded-xl font-bold text-slate-500">
                      ⏱️ {isLoaded ? 'Aguardando localização do motoboy...' : 'Carregando Mapa...'}
                   </p>
                </div>
            )}
        </div>

        <div className="bg-white p-6 rounded-t-3xl shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.3)] z-20">
           <div className="w-12 h-1 bg-slate-200 mx-auto rounded-full mb-6"></div>
           <h2 className="font-bold text-lg text-slate-800">Detalhes da Entrega</h2>
           
           <div className="mt-4 flex flex-col gap-3">
               <div className="flex bg-slate-50 p-4 rounded-xl border border-slate-100 items-center justify-between">
                   <div>
                       <p className="text-[10px] font-bold text-slate-400 uppercase">Status</p>
                       <p className={`font-black ${order.status === 'OUT_FOR_DELIVERY' ? 'text-black' : 'text-black'}`}>
                          {order.status === 'OUT_FOR_DELIVERY' ? 'SAIU PARA ENTREGA' : 'PREPARANDO...'}
                       </p>
                   </div>
                   <div className="text-right">
                       <p className="text-[10px] font-bold text-slate-400 uppercase">Loja</p>
                       <p className="font-bold text-slate-700">{order.tenant?.name}</p>
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
