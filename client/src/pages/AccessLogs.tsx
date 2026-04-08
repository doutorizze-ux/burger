import { useEffect, useState, useCallback } from 'react';
import { useTutorial } from '../contexts/TutorialContext';
import api from '../api';
import { Clock, CheckCircle2, XCircle, ChevronDown, ChevronUp, History } from 'lucide-react';
import clsx from 'clsx';

interface Log {
    id: string;
    member_id?: string;
    member?: {
        name: string;
    };
    status: string;
    reason?: string;
    scanned_at: string;
}

interface GroupedLog {
    memberId: string;
    memberName: string;
    lastStatus: string;
    lastReason?: string;
    lastScannedAt: string;
    count: number;
    history: Log[];
}

export const AccessLogs = () => {
    const [logs, setLogs] = useState<Log[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedMembers, setExpandedMembers] = useState<Set<string>>(new Set());

    const { startTutorial, hasSeenTutorial } = useTutorial();

    const fetchLogs = useCallback(async () => {
        try {
            const res = await api.get('/logs');
            setLogs(Array.isArray(res.data) ? res.data : []);
            setError(null);
        } catch (err) {
            console.error('Error fetching logs:', err);
            setError('Erro ao carregar acessos');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        requestAnimationFrame(() => {
            if (!hasSeenTutorial('access_logs')) {
                startTutorial('access_logs');
            }
            fetchLogs();
        });
        const interval = setInterval(fetchLogs, 5000);
        return () => clearInterval(interval);
    }, [fetchLogs, hasSeenTutorial, startTutorial]);

    const toggleExpand = (memberId: string) => {
        const newSet = new Set(expandedMembers);
        if (newSet.has(memberId)) {
            newSet.delete(memberId);
        } else {
            newSet.add(memberId);
        }
        setExpandedMembers(newSet);
    };

    // Grouping Logic
    const groupedLogs: GroupedLog[] = logs.reduce((acc: GroupedLog[], log) => {
        const memberId = log.member_id || 'unknown';
        const memberName = log.member?.name || 'Visitante Desconhecido';

        const existing = acc.find(g => g.memberId === memberId && g.memberId !== 'unknown');

        if (existing) {
            existing.count += 1;
            existing.history.push(log);
            // If this log is newer, update last status/time
            if (new Date(log.scanned_at) > new Date(existing.lastScannedAt)) {
                existing.lastStatus = log.status;
                existing.lastReason = log.reason;
                existing.lastScannedAt = log.scanned_at;
            }
        } else {
            acc.push({
                memberId,
                memberName,
                lastStatus: log.status,
                lastReason: log.reason,
                lastScannedAt: log.scanned_at,
                count: 1,
                history: [log]
            });
        }
        return acc;
    }, []);

    // Sort groups by lastScannedAt
    groupedLogs.sort((a, b) => new Date(b.lastScannedAt).getTime() - new Date(a.lastScannedAt).getTime());

    return (
        <div className="animate-fade-in-up">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 mb-2 tracking-tighter">Fluxo de Acessos</h1>
                    <p className="text-slate-500 font-medium">Monitoramento inteligente agrupado por aluno.</p>
                </div>
                <div className="flex items-center gap-3 bg-white px-6 py-3 rounded-[2rem] border border-slate-100 shadow-sm w-fit group">
                    <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Sincronizado Live</span>
                </div>
            </div>

            <div id="access-logs-list" className="bg-white rounded-[3rem] shadow-sm border border-slate-100 overflow-hidden mb-20 md:mb-0">
                <div className="hidden md:grid grid-cols-5 bg-white p-12 py-8 border-b border-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                    <span className="col-span-1">Último Acesso</span>
                    <span className="col-span-1">Membro da Academia</span>
                    <span className="col-span-1">Status Atual</span>
                    <span className="col-span-1">Entradas Hoje</span>
                    <span className="col-span-1 text-right">Ações</span>
                </div>

                <div className="divide-y divide-slate-50">
                    {loading && logs.length === 0 ? (
                        <div className="p-20 text-center animate-pulse">
                            <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">Carregando acessos...</p>
                        </div>
                    ) : error ? (
                        <div className="p-20 text-center">
                            <p className="text-red-400 font-bold uppercase text-xs tracking-widest">{error}</p>
                        </div>
                    ) : groupedLogs.map(group => (
                        <div key={group.memberId} className="flex flex-col">
                            {/* Group Header */}
                            <div className="grid grid-cols-1 md:grid-cols-5 items-center px-12 py-6 hover:bg-slate-50/30 transition-colors group relative overflow-hidden">
                                {/* Time Section */}
                                <div className="flex items-center gap-4 mb-2 md:mb-0">
                                    <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-primary shadow-xl group-hover:scale-110 transition-transform">
                                        <Clock size={20} />
                                    </div>
                                    <div>
                                        <div className="text-base font-black text-slate-900 leading-none mb-1">
                                            {new Date(group.lastScannedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                        <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest">
                                            {new Date(group.lastScannedAt).toLocaleDateString('pt-BR')}
                                        </div>
                                    </div>
                                </div>

                                {/* Member Section */}
                                <div className="flex items-center gap-3 mb-4 md:mb-0">
                                    <div className={clsx("font-black text-base truncate", group.memberId !== 'unknown' ? 'text-slate-900 tracking-tight' : 'text-slate-400 italic font-bold')}>
                                        {group.memberName}
                                    </div>
                                </div>

                                {/* Status Section */}
                                <div className="mb-3 md:mb-0 flex items-center">
                                    <span className={clsx(
                                        "flex items-center gap-2 px-6 py-2 rounded-full text-[10px] font-black tracking-widest uppercase border",
                                        group.lastStatus === 'GRANTED' ? 'bg-primary/10 text-primary border-primary/20' : 'bg-red-500/10 text-red-500 border-red-500/20'
                                    )}>
                                        {group.lastStatus === 'GRANTED' ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                                        {group.lastStatus === 'GRANTED' ? 'Liberado' : 'Negado'}
                                    </span>
                                </div>

                                {/* Count Section */}
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-3">
                                    <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg">
                                        {group.count} {group.count === 1 ? 'acesso' : 'acessos'}
                                    </span>
                                </div>

                                {/* Actions Section */}
                                <div className="text-right">
                                    <button
                                        onClick={() => toggleExpand(group.memberId)}
                                        className="inline-flex items-center gap-2 text-[10px] font-black text-primary uppercase tracking-widest hover:bg-primary/5 px-4 py-2 rounded-xl transition-all"
                                    >
                                        {expandedMembers.has(group.memberId) ? (
                                            <>Recolher <ChevronUp size={14} /></>
                                        ) : (
                                            <>Histórico <ChevronDown size={14} /></>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Expanded History */}
                            {expandedMembers.has(group.memberId) && (
                                <div className="bg-slate-50/50 px-12 py-6 border-y border-slate-100 animate-slide-down">
                                    <div className="flex items-center gap-2 mb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        <History size={14} /> Histórico de hoje
                                    </div>
                                    <div className="space-y-3">
                                        {group.history.map((h) => (
                                            <div key={h.id} className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                                <div className="flex items-center gap-4">
                                                    <span className="text-xs font-black text-slate-900">
                                                        {new Date(h.scanned_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                    <span className={clsx(
                                                        "text-[9px] font-black uppercase px-3 py-1 rounded-md",
                                                        h.status === 'GRANTED' ? "text-primary bg-primary/5" : "text-red-500 bg-red-50/50"
                                                    )}>
                                                        {h.status === 'GRANTED' ? 'LIBERADO' : 'NEGADO'}
                                                    </span>
                                                </div>
                                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic">
                                                    {h.reason || 'Consulta Manual'}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}

                    {!loading && !error && logs.length === 0 && (
                        <div className="p-20 text-center flex flex-col items-center">
                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                <Clock size={24} className="text-slate-200" />
                            </div>
                            <p className="text-slate-400 font-bold tracking-tight uppercase text-xs">Aguardando primeiros acessos...</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
