import { useEffect, useState } from 'react';
import { useTutorial } from '../contexts/TutorialContext';
import QRCode from 'react-qr-code';
import io from 'socket.io-client';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';
import { Zap, ShieldCheck, Smartphone, LogOut, CheckCircle2, AlertTriangle } from 'lucide-react';

const socket = io(import.meta.env.VITE_API_URL || '/', {
    transports: ['polling', 'websocket'],
    reconnection: true,
    reconnectionDelay: 1000
});

export const WhatsAppConnect = () => {
    const { user } = useAuth();
    const [qr, setQr] = useState('');
    const [status, setStatus] = useState('DISCONNECTED');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasJoinedRoom, setHasJoinedRoom] = useState(false);

    const { startTutorial, hasSeenTutorial } = useTutorial();

    useEffect(() => {
        if (!hasSeenTutorial('whatsapp')) {
            startTutorial('whatsapp');
        }

        if (!user?.tenant_id) return;

        const joinRoom = () => {
            console.log('[Socket] Solicitando entrada na sala:', user.tenant_id);
            socket.emit('join_room', { room: user.tenant_id });
        };

        if (socket.connected) {
            joinRoom();
        }

        socket.on('connect', joinRoom);

        socket.on('disconnect', (reason) => {
            console.warn('[Socket] Desconectado:', reason);
            setLoading(false);
            setHasJoinedRoom(false);
        });

        api.get('/me').then(res => {
            setStatus(res.data.whatsapp_status);
        });

        socket.emit('join_room', { room: user.tenant_id });

        socket.on('qr_code', (code) => {
            console.log('[Socket] QR Code recebido');
            setQr(code);
            setStatus('SCAN_QR');
            setLoading(false);
        });

        socket.on('whatsapp_status', (s) => {
            console.log('[Socket] Status WhatsApp:', s);
            setStatus(s);
            setLoading(false);
            if (s === 'CONNECTED') setQr('');
        });

        socket.on('joined_room', (data) => {
            console.log('[Socket] Entrou na sala:', data.room);
            setHasJoinedRoom(true);
        });

        // Forced interval to ensure room membership (Safety measure)
        const interval = setInterval(() => {
            if (!hasJoinedRoom && socket.connected) joinRoom();
        }, 5000);

        return () => {
            clearInterval(interval);
            socket.off('qr_code');
            socket.off('whatsapp_status');
            socket.off('joined_room');
            socket.off('connect');
            socket.off('disconnect');
        }
    }, [user?.tenant_id, startTutorial, hasSeenTutorial, hasJoinedRoom]);

    const handleConnect = async () => {
        try {
            setLoading(true);
            setError(null);
            await api.post('/whatsapp/connect');
            // Timeout de segurança: se em 20s não chegar o QR, libera o botão
            setTimeout(() => setLoading(false), 20000);
        } catch (err: any) {
            console.error('[WA] Erro ao iniciar conexão:', err);
            setError('Falha ao iniciar o WhatsApp. Tente novamente em instantes.');
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col gap-6 animate-fade-in-up pb-24 md:pb-0">
            <div className="mb-10">
                <h1 className="text-4xl font-black text-slate-900 mb-2 tracking-tighter">Conexão WhatsApp</h1>
                <p className="text-slate-500 font-medium pb-2">Ative as mensagens automáticas e o bot para seus alunos.</p>
            </div>

            <div id="whatsapp-panel" className="bg-white rounded-[2.5rem] p-8 md:p-12 shadow-sm border border-slate-100 flex flex-col items-center">
                {status === 'CONNECTED' ? (
                    <div className="text-center w-full max-w-lg animate-fade-in p-10">
                        <div className="w-28 h-28 bg-[#22c55e]/10 text-[#22c55e] rounded-full flex items-center justify-center mx-auto mb-10 shadow-inner border-8 border-white">
                            <CheckCircle2 size={56} />
                        </div>
                        <h3 className="text-4xl font-black text-slate-900 mb-4 tracking-tighter">Sistema Conectado</h3>
                        <p className="text-slate-500 font-medium leading-relaxed mb-12">
                            Seu WhatsApp está vinculado com sucesso! O bot já está processando check-ins, envios de treinos e cobranças automáticas.
                        </p>

                        <div className="flex flex-col gap-4">
                            <div className="bg-[#22c55e]/5 border border-[#22c55e]/10 p-6 rounded-[2rem] flex items-center justify-center gap-4 text-[#22c55e] text-xs font-black uppercase tracking-widest mb-6">
                                <div className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse"></div>
                                Automação Ativada e Segura
                            </div>
                            <button
                                onClick={async () => {
                                    if (confirm('Deseja realmente desconectar? Isso parará o atendimento automático.')) {
                                        setLoading(true);
                                        await api.post('/whatsapp/disconnect');
                                        setLoading(false);
                                    }
                                }}
                                className="flex items-center justify-center gap-3 p-6 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-[2rem] transition-all font-black text-xs uppercase tracking-widest"
                            >
                                <LogOut size={20} />
                                Desconectar Dispositivo
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="text-center w-full max-w-sm">
                        {!qr && status !== 'SCAN_QR' && (
                            <div className="animate-fade-in p-10">
                                <div className="w-24 h-24 bg-slate-950 text-primary rounded-[2rem] flex items-center justify-center mx-auto mb-10 shadow-2xl relative">
                                    <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary animate-ping"></div>
                                    <Smartphone size={40} />
                                </div>
                                <h3 className="text-3xl font-black text-slate-900 mb-4 tracking-tighter">Vincular Novo Dispositivo</h3>
                                <p className="text-slate-500 font-medium mb-12 leading-relaxed">
                                    Conecte seu WhatsApp para que o sistema possa enviar treinos, dietas e mensagens de cobrança automaticamente para seus alunos.
                                </p>

                                <div className="bg-orange-500/5 border border-orange-500/10 p-8 rounded-[2rem] mb-12 flex flex-col gap-4 items-center">
                                    <div className="flex items-center gap-3 text-orange-600">
                                        <AlertTriangle size={24} />
                                        <span className="text-sm font-black uppercase tracking-widest">Aviso Importante</span>
                                    </div>
                                    <p className="text-xs font-bold text-slate-600 leading-relaxed text-center max-w-sm">
                                        Não feche a aba durante o processo de conexão. O processo leva cerca de 10 segundos após a leitura do QR Code.
                                    </p>
                                </div>
                                {error && (
                                    <div className="bg-red-50 text-red-500 p-4 rounded-xl mb-6 text-xs font-bold border border-red-100 animate-shake">
                                        {error}
                                    </div>
                                )}
                                <button
                                    onClick={handleConnect}
                                    disabled={loading}
                                    className="w-full bg-primary text-white px-10 py-6 rounded-[2.5rem] font-black hover:bg-primary/80 shadow-2xl shadow-primary/30 disabled:opacity-50 transition-all active:scale-95 flex items-center justify-center gap-3 text-sm uppercase tracking-widest"
                                >
                                    {loading ? (
                                        <>
                                            <div className="w-5 h-5 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                                            Gerando QRCode...
                                        </>
                                    ) : (
                                        <>
                                            <Zap size={24} fill="currentColor" />
                                            CONECTAR WHATSAPP
                                        </>
                                    )}
                                </button>
                            </div>
                        )}

                        {qr && status !== 'CONNECTED' && (
                            <div className="flex flex-col items-center animate-fade-in-up">
                                <div className="bg-slate-900 p-8 md:p-12 rounded-[4rem] shadow-2xl mb-12 relative">
                                    <div className="absolute inset-0 bg-primary/20 blur-[100px] rounded-full -z-10 animate-pulse"></div>
                                    <div className="bg-white p-6 rounded-[2.5rem]">
                                        <QRCode value={qr} size={280} className="w-full h-auto" />
                                    </div>
                                </div>
                                <h3 className="text-3xl font-black text-slate-900 mb-3 tracking-tighter">Escaneie o QR Code</h3>
                                <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] mb-10">Aguardando leitura do dispositivo</p>
                                <div className="flex gap-3 mb-12">
                                    <div className="w-3 h-3 bg-primary rounded-full animate-bounce"></div>
                                    <div className="w-3 h-3 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                    <div className="w-3 h-3 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                </div>

                                <div className="bg-slate-50 p-8 rounded-[2rem] flex flex-col gap-4 items-center max-w-sm border border-slate-100">
                                    <div className="flex items-center gap-3 text-primary">
                                        <ShieldCheck size={24} />
                                        <span className="text-xs font-black uppercase tracking-widest text-slate-800">Conexão Segura</span>
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-400 leading-relaxed text-center uppercase tracking-widest">
                                        Acesse o WhatsApp no seu celular {'>'} Configurações {'>'} Aparelhos Conectados {'>'} Conectar um Aparelho.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
