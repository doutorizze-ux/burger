import { useState, useEffect, useCallback } from 'react';
import { useTutorial } from '../contexts/TutorialContext';
import { Cpu, Wifi, CheckCircle, Download, ShieldCheck, XCircle, Clock } from 'lucide-react';
import clsx from 'clsx';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';
import io from 'socket.io-client';

const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:3000');

interface GateEvent {
    id: string;
    name: string;
    status: 'GRANTED' | 'DENIED';
    time: string;
    reason?: string;
}


interface SocketGateData {
    memberName: string;
    timestamp: string;
    reason?: string;
}

export const Turnstiles = () => {
    const { user } = useAuth();
    const [selectedBrand, setSelectedBrand] = useState('generic');
    const [token, setToken] = useState('Carregando...');
    const [recentEvents, setRecentEvents] = useState<GateEvent[]>([]);

    const { startTutorial, hasSeenTutorial } = useTutorial();

    const fetchConfig = useCallback(async () => {
        try {
            const res = await api.get('/gate/config');
            setToken(res.data.gate_token);
            setSelectedBrand(res.data.turnstile_brand || 'generic');
        } catch (err) {
            console.error('Error fetching config:', err);
        }
    }, []);

    const fetchRecentLogs = useCallback(async () => {
        try {
            const res = await api.get('/logs');
            const uniqueEvents: GateEvent[] = [];
            const seenMembers = new Set<string>();

            for (const log of res.data) {
                const memberName = log.member?.name || 'Desconhecido';
                if (!seenMembers.has(memberName)) {
                    uniqueEvents.push({
                        id: log.id,
                        name: memberName,
                        status: log.status,
                        time: new Date(log.scanned_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                    });
                    seenMembers.add(memberName);
                }
                if (uniqueEvents.length >= 5) break;
            }
            setRecentEvents(uniqueEvents);
        } catch (err) {
            console.error('Erro ao buscar logs recentes:', err);
        }
    }, []);

    useEffect(() => {
        requestAnimationFrame(() => {
            fetchConfig();
            fetchRecentLogs();
        });

        if (!hasSeenTutorial('turnstiles')) {
            startTutorial('turnstiles');
        }

        if (user?.tenant_id) {
            socket.emit('join_room', { room: user.tenant_id });

            socket.on('gate:open', (data: SocketGateData) => {
                setRecentEvents(prev => {
                    const filtered = prev.filter(e => e.name !== data.memberName);
                    return [{
                        id: Math.random().toString(),
                        name: data.memberName,
                        status: 'GRANTED' as const,
                        time: new Date(data.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                    }, ...filtered].slice(0, 5);
                });
            });

            socket.on('gate:denied', (data: SocketGateData) => {
                setRecentEvents(prev => {
                    const filtered = prev.filter(e => e.name !== (data.memberName || 'Visitante/Inativo'));
                    return [{
                        id: Math.random().toString(),
                        name: data.memberName || 'Visitante/Inativo',
                        status: 'DENIED' as const,
                        reason: data.reason,
                        time: new Date(data.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                    }, ...filtered].slice(0, 5);
                });
            });
        }

        return () => {
            socket.off('gate:open');
            socket.off('gate:denied');
        };
    }, [user?.tenant_id, startTutorial, hasSeenTutorial, fetchConfig, fetchRecentLogs]);



    const handleRegenerateToken = async () => {
        if (!confirm('Tem certeza? O ZappBridge atual irá parar de funcionar até ser atualizado com o novo token.')) return;
        try {
            const res = await api.post('/gate/regenerate-token');
            setToken(res.data.gate_token);
        } catch (err) {
            console.error('Error regenerating token:', err);
            alert('Erro ao regenerar token');
        }
    };

    const handleBrandChange = async (brand: string) => {
        setSelectedBrand(brand);
        try {
            await api.put('/gate/brand', { brand });
        } catch (err) {
            console.error('Error saving brand:', err);
        }
    };

    const handleDownload = async () => {
        try {
            const response = await api.get('/gate/download-bridge', { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'ZappBridge.js');
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            console.error('Download error:', err);
            alert('Erro ao baixar arquivo. Verifique se o token foi gerado.');
        }
    };

    const handleDownloadZip = async () => {
        try {
            const response = await api.get('/gate/download-installer', { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'ZappBridge_Installer.zip');
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            console.error('Download error:', err);
            alert('Erro ao baixar instalador. Verifique sua conexão.');
        }
    };


    const brands = [
        { id: 'controlid', name: 'Control iD', logo: '🚀', desc: 'Integração direta via Nuvem ou API Local' },
        { id: 'topdata', name: 'Topdata', logo: '⚡', desc: 'Integração via Driver Topdata (PC Recepção)' },
        { id: 'henry', name: 'Henry', logo: '💎', desc: 'Integração via Driver Henry (PC Recepção)' },
        { id: 'madis', name: 'Madis', logo: '🏢', desc: 'Integração via Driver Madis (PC Recepção)' },
        { id: 'usb_relay', name: 'Relé USB / Serial', logo: '🔌', desc: 'Solução Universal para qualquer catraca antiga' },
        { id: 'generic', name: 'Outras Marcas', logo: '⚙️', desc: 'Apenas registro de logs no sistema' },
    ];

    return (
        <div className="animate-fade-in-up pb-20">
            <div className="mb-6 lg:mb-12">
                <h1 className="text-2xl xs:text-3xl md:text-5xl font-black text-slate-900 mb-2 md:mb-4 tracking-tighter">
                    Catracas <span className="text-primary">Inteligentes</span>
                </h1>
                <p className="text-slate-500 font-medium text-sm md:text-xl max-w-2xl">
                    Sincronização em tempo real entre o seu hardware físico e o WhatsApp da academia.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
                {/* Branding and Steps - Main Content */}
                <div className="lg:col-span-8 space-y-6 md:space-y-8">

                    {/* Brand Selection Card */}
                    <div className="bg-white p-5 sm:p-8 lg:p-10 rounded-[2rem] sm:rounded-[2.5rem] shadow-sm border border-slate-100">
                        <div className="flex items-center gap-4 mb-6 lg:mb-8">
                            <div className="w-10 h-10 lg:w-12 lg:h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
                                <Cpu className="text-primary" size={22} />
                            </div>
                            <div>
                                <h3 className="text-base lg:text-lg font-black text-slate-900 uppercase tracking-tight">1. Escolha seu Hardware</h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Selecione o fabricante</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 gap-3 sm:gap-6">
                            {brands.map((brand) => (
                                <button
                                    key={brand.id}
                                    onClick={() => handleBrandChange(brand.id)}
                                    className={clsx(
                                        "p-5 sm:p-8 rounded-[1.5rem] sm:rounded-[2rem] border-2 text-left transition-all duration-300 group relative",
                                        selectedBrand === brand.id
                                            ? "border-primary bg-primary/[0.02] shadow-xl shadow-primary/5"
                                            : "border-slate-50 bg-slate-50/50 hover:border-slate-200 hover:bg-white"
                                    )}
                                >
                                    {selectedBrand === brand.id && (
                                        <div className="absolute top-3 right-3 lg:top-4 lg:right-4 text-primary bg-white rounded-full p-0.5 shadow-sm">
                                            <CheckCircle size={18} fill="currentColor" className="text-white" />
                                        </div>
                                    )}
                                    <div className="text-3xl sm:text-4xl mb-3 sm:mb-4 group-hover:scale-110 transition-transform duration-300">{brand.logo}</div>
                                    <div className="font-black text-slate-900 text-base sm:text-lg mb-1">{brand.name}</div>
                                    <div className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-tight">{brand.desc}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Step-by-Step Connection Guide */}
                    <div className="bg-slate-900 rounded-[2.5rem] p-6 lg:p-10 text-white shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2"></div>

                        <div className="flex items-center gap-4 mb-8 lg:mb-10 relative z-10">
                            <div className="w-10 h-10 lg:w-12 lg:h-12 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10">
                                <Wifi className="text-primary" size={24} />
                            </div>
                            <div>
                                <h3 className="text-base lg:text-lg font-black text-white uppercase tracking-tight text-primary">2. Configuração de Acesso</h3>
                                <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Sincronize seu hardware com a nuvem</p>
                            </div>
                        </div>

                        <div className="space-y-8 lg:space-y-10 relative z-10">
                            {/* Visual Timeline for Guide */}
                            <div className="flex flex-col gap-6 lg:gap-8">

                                {/* TOKEN STEP - Always Visible */}
                                <div className="flex gap-4 lg:gap-6 items-start">
                                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center font-black text-xs shrink-0 shadow-lg shadow-primary/20">A</div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-white mb-4 text-sm lg:text-base">Seu Token de Segurança</p>
                                        <div className="bg-white/5 border border-white/10 p-4 lg:p-6 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                                            <code className="text-primary font-mono font-black text-lg lg:text-2xl tracking-wider truncate w-full sm:w-auto text-center sm:text-left">{token}</code>
                                            <button
                                                onClick={handleRegenerateToken}
                                                className="text-[10px] bg-white/10 px-4 py-2 rounded-xl font-black uppercase tracking-widest hover:bg-white/20 transition-all whitespace-nowrap w-full sm:w-auto"
                                            >
                                                Regerar
                                            </button>
                                        </div>
                                        <p className="text-[10px] text-white/40 mt-3 font-bold uppercase tracking-widest leading-tight">⚠️ O Token identifica sua academia com exclusividade.</p>
                                    </div>
                                </div>

                                {selectedBrand === 'controlid' ? (
                                    /* CONTROL ID SPECIFIC STEP */
                                    <div className="flex gap-4 lg:gap-6 items-start">
                                        <div className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center font-black text-xs shrink-0">B</div>
                                        <div className="flex-1">
                                            <p className="font-bold text-white mb-4 text-sm lg:text-base">Configuração na Nuvem (Control iD)</p>
                                            <div className="bg-white/5 border border-white/10 p-5 lg:p-6 rounded-2xl space-y-4">
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">URL do Servidor</span>
                                                    <code className="text-sm font-mono text-primary/80 break-all bg-black/20 p-2 rounded">zapp.fitness/api/gate</code>
                                                </div>
                                                <p className="text-xs text-white/60 leading-relaxed italic">
                                                    Acesse o painel da sua catraca Control iD, vá em "Configurações {'>'} Software" e insira a URL acima e o seu Token (do Passo A).
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    /* STANDARD BRIDGE STEPS (FOR OTHER BRANDS) */
                                    <>
                                        <div className="flex gap-4 lg:gap-6 items-start">
                                            <div className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center font-black text-xs shrink-0">B</div>
                                            <div className="flex-1">
                                                <p className="font-bold text-white mb-4 text-sm lg:text-base">Instalação Local (ZappBridge)</p>
                                                <div className="flex flex-col sm:flex-row gap-3">
                                                    <button
                                                        onClick={handleDownloadZip}
                                                        className="flex-1 bg-primary text-white p-4 rounded-xl font-black flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-primary/20 text-[10px] uppercase tracking-widest"
                                                    >
                                                        <Download size={16} />
                                                        Baixar Instalador Windows (ZIP)
                                                    </button>
                                                    <button
                                                        onClick={handleDownload}
                                                        className="flex-[0.5] bg-white/5 border border-white/10 text-white p-4 rounded-xl font-black flex items-center justify-center gap-3 hover:bg-white/10 transition-all text-[10px] uppercase tracking-widest"
                                                    >
                                                        Apenas .JS
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex gap-4 lg:gap-6 items-start">
                                            <div className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center font-black text-xs shrink-0">C</div>
                                            <div className="flex-1">
                                                <p className="font-bold text-white mb-2 text-sm lg:text-base">Inicie a Integração</p>
                                                <p className="text-xs lg:text-sm text-white/60 leading-relaxed mb-4">Extraia o ZIP e dê dois cliques no arquivo:</p>
                                                <div className="bg-primary/20 p-4 rounded-xl font-mono text-[10px] lg:text-xs text-primary font-black border border-primary/30 overflow-x-auto whitespace-nowrap">
                                                    🚀 iniciar_ponte.bat
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Lateral Status Bar */}
                <div className="lg:col-span-4 space-y-6">
                    {/* Live Monitor Card */}
                    <div className="bg-white p-5 lg:p-8 rounded-[2rem] lg:rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col h-full lg:max-h-[800px]">
                        <div className="flex items-center justify-between mb-8">
                            <h4 className="font-black text-slate-900 uppercase tracking-widest text-[10px]">Monitoramento Live</h4>
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 bg-primary rounded-full animate-pulse shadow-[0_0_8px_var(--primary-color)]"></span>
                                <span className="text-[10px] font-black text-primary uppercase">Ao Vivo</span>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar">
                            {recentEvents.length === 0 ? (
                                <div className="py-20 text-center">
                                    <Clock className="mx-auto mb-4 text-slate-200" size={48} />
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Nenhum acesso recente</p>
                                </div>
                            ) : recentEvents.map((event) => (
                                <div
                                    key={event.id}
                                    className="flex items-center gap-4 p-4 bg-slate-50/80 rounded-2xl border border-slate-100 animate-fade-in group hover:bg-white hover:border-primary/20 transition-all cursor-default"
                                >
                                    <div className={clsx(
                                        "w-10 h-10 rounded-xl shadow-sm flex items-center justify-center shrink-0 border",
                                        event.status === 'GRANTED' ? "bg-primary/10 border-primary/20 text-primary" : "bg-red-50 border-red-100 text-red-500"
                                    )}>
                                        {event.status === 'GRANTED' ? <CheckCircle size={20} /> : <XCircle size={20} />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-black text-slate-900 truncate tracking-tight">{event.name}</p>
                                        <div className="flex items-center gap-2">
                                            <p className={clsx(
                                                "text-[9px] font-black uppercase tracking-widest truncate",
                                                event.status === 'GRANTED' ? "text-slate-400" : "text-red-400"
                                            )}>
                                                {event.status === 'GRANTED' ? 'LIBERADO' : (event.reason || 'NEGADO')}
                                            </p>
                                            <span className="text-slate-300">•</span>
                                            <span className="text-[9px] font-black text-slate-300 uppercase shrink-0">{event.time}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Summary Footer */}
                        <div className="mt-8 pt-8 border-t border-slate-100">
                            <div className="bg-orange-500 p-8 rounded-[2rem] text-white relative overflow-hidden group hover:scale-[1.02] transition-transform duration-500">
                                <div className="relative z-10">
                                    <ShieldCheck className="mb-4 opacity-80" size={24} />
                                    <p className="text-xs font-black uppercase tracking-widest mb-1">Status de Proteção</p>
                                    <p className="text-lg font-black tracking-tight leading-tight">Segurança Ativa em tempo real</p>
                                </div>
                                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-white/20 transition-all"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #e2e8f0;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #cbd5e1;
                }
            `}} />
        </div>
    );
};
