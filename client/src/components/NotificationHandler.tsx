import { useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-toastify';
import { MessageSquare } from 'lucide-react';

const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:3000');

export const NotificationHandler = () => {
    const { user } = useAuth();
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        // Initialize audio
        audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');

        if (user?.tenant_id) {
            socket.emit('join', user.tenant_id);

            socket.on('attendance:requested', (data: { memberName: string }) => {
                // Play sound
                if (audioRef.current) {
                    audioRef.current.play().catch(err => console.error('[Audio] Error playing notification sound:', err));
                }

                // Show Toast
                toast.info(
                    <div className="flex items-center gap-3">
                        <div className="bg-primary/10 p-2 rounded-lg text-primary">
                            <MessageSquare size={20} />
                        </div>
                        <div>
                            <p className="font-black text-sm text-slate-900">Solicitação de Atendimento</p>
                            <p className="text-xs text-slate-500">O aluno <span className="font-bold text-primary">{data.memberName}</span> quer falar com você!</p>
                        </div>
                    </div>,
                    {
                        position: "top-right",
                        autoClose: 10000,
                        hideProgressBar: false,
                        closeOnClick: true,
                        pauseOnHover: true,
                        draggable: true,
                    }
                );
            });
        }

        return () => {
            socket.off('attendance:requested');
        };
    }, [user?.tenant_id]);

    return null; // This component doesn't render anything
};
