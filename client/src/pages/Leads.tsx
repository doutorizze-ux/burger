
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Plus, MessageSquare, Phone,
    LayoutGrid, List, Search, Trash2, Edit,
    Send, X, Users, Target, Calendar, TrendingUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api';
import clsx from 'clsx';
import { format } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import { io } from 'socket.io-client';
import { toast } from 'react-toastify';

interface Lead {
    id: string;
    name: string | null;
    phone: string;
    status: 'new' | 'contacted' | 'trial' | 'won' | 'lost';
    value: number;
    last_message: string | null;
    last_message_at: string;
    created_at: string;
}

interface Message {
    id: string;
    content: string;
    from_me: boolean;
    created_at: string;
    type: string;
}

const COLUMNS = [
    { id: 'new', label: 'INTERESSADOS', color: 'bg-blue-500', lightColor: 'bg-blue-50', textColor: 'text-blue-600', shadow: 'shadow-blue-500/20' },
    { id: 'contacted', label: 'CONTATO FEITO', color: 'bg-orange-500', lightColor: 'bg-orange-50', textColor: 'text-orange-600', shadow: 'shadow-orange-500/20' },
    { id: 'trial', label: 'AULA EXPERIMENTAL', color: 'bg-purple-500', lightColor: 'bg-purple-50', textColor: 'text-purple-600', shadow: 'shadow-purple-500/20' },
    { id: 'won', label: 'MATRICULADO', color: 'bg-green-500', lightColor: 'bg-green-50', textColor: 'text-green-600', shadow: 'shadow-green-500/20' },
    { id: 'lost', label: 'PERDIDO', color: 'bg-slate-500', lightColor: 'bg-slate-50', textColor: 'text-slate-600', shadow: 'shadow-slate-500/20' },
] as const;

export const Leads = () => {
    const { user } = useAuth();
    const [leads, setLeads] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<'kanban' | 'list'>('kanban');
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string | null>(null);
    const [showLeadModal, setShowLeadModal] = useState(false);
    const [modalLead, setModalLead] = useState<Partial<Lead> | null>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);

    const fetchLeads = useCallback(async () => {
        try {
            const res = await api.get('/leads');
            setLeads(res.data);
        } catch (err) {
            console.error('Error fetching leads:', err);
            toast.error('Erro ao buscar leads');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchLeads();

        const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:3000', {
            transports: ['websocket', 'polling']
        });

        if (user?.tenant_id) {
            socket.emit('join', user.tenant_id);
        }

        socket.on('new_message', (msg: Message & { lead_id: string }) => {
            fetchLeads();
            if (selectedLead && (msg.lead_id === selectedLead.id)) {
                setMessages(prev => [...prev, msg]);
            }
        });

        return () => {
            socket.disconnect();
        };
    }, [user?.tenant_id, selectedLead, fetchLeads]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const fetchMessages = useCallback(async (leadId: string) => {
        try {
            const res = await api.get(`/leads/${leadId}/messages`);
            setMessages(res.data);
        } catch (err) {
            console.error('Error fetching messages:', err);
        }
    }, []);

    useEffect(() => {
        if (selectedLead) {
            fetchMessages(selectedLead.id);
        }
    }, [selectedLead, fetchMessages]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedLead || !newMessage.trim() || sending) return;

        setSending(true);
        try {
            await api.post(`/leads/${selectedLead.id}/messages`, { content: newMessage });
            const optimisticMsg: Message = {
                id: Date.now().toString(),
                content: newMessage,
                from_me: true,
                created_at: new Date().toISOString(),
                type: 'text'
            };
            setMessages(prev => [...prev, optimisticMsg]);
            setNewMessage('');
            fetchLeads();
        } catch (err) {
            console.error('Error sending message:', err);
            toast.error('Erro ao enviar mensagem');
        } finally {
            setSending(false);
        }
    };

    const updateLeadStatus = async (leadId: string, status: string) => {
        try {
            await api.put(`/leads/${leadId}`, { status });
            setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: status as Lead['status'] } : l));
            toast.success('Status atualizado');
        } catch (err) {
            console.error('Error updating status:', err);
            toast.error('Erro ao atualizar status');
        }
    };

    const handleSaveLead = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!modalLead?.phone) return;

        try {
            if (modalLead.id) {
                await api.put(`/leads/${modalLead.id}`, modalLead);
                toast.success('Lead atualizado com sucesso');
            } else {
                await api.post('/leads', modalLead);
                toast.success('Lead criado com sucesso');
            }
            setShowLeadModal(false);
            setModalLead(null);
            fetchLeads();
        } catch (err) {
            console.error('Error saving lead:', err);
            toast.error('Erro ao salvar lead');
        }
    };

    const handleDeleteLead = async (id: string) => {
        if (!window.confirm('Tem certeza que deseja excluir este lead? Todas as mensagens serão perdidas.')) return;
        try {
            await api.delete(`/leads/${id}`);
            setLeads(prev => prev.filter(l => l.id !== id));
            toast.success('Lead excluído');
        } catch (err) {
            console.error('Error deleting lead:', err);
            toast.error('Erro ao excluir lead');
        }
    };

    const filteredLeads = leads.filter(l => {
        const matchesSearch = (l.name?.toLowerCase().includes(searchQuery.toLowerCase()) || l.phone.includes(searchQuery));
        const matchesStatus = !statusFilter || l.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const stats = {
        total: leads.length,
        new: leads.filter(l => l.status === 'new').length,
        conversion: leads.length > 0 ? ((leads.filter(l => l.status === 'won').length / leads.length) * 100).toFixed(1) : 0,
        trial: leads.filter(l => l.status === 'trial').length,
        matriculated: leads.filter(l => l.status === 'won').length
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="animate-fade-in-up pb-20">
            {/* Header & Stats */}
            <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-8 mb-10">
                <div className="flex-1">
                    <h1 className="text-4xl md:text-5xl font-black text-slate-900 mb-2 tracking-tighter">
                        Gestão de <span className="text-primary">Leads</span>
                    </h1>
                    <p className="text-slate-500 font-medium max-w-2xl">
                        Acompanhe seus interessados e converta-os em alunos matriculados usando o funil de vendas inteligente.
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar por nome ou telefone..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-11 pr-6 py-3.5 bg-white border border-slate-200 rounded-2xl w-full sm:w-72 font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all shadow-sm"
                        />
                    </div>
                    <button
                        id="btn-new-lead"
                        onClick={() => { setModalLead({ status: 'new' }); setShowLeadModal(true); }}
                        className="flex items-center justify-center gap-2 px-8 py-3.5 bg-primary text-white rounded-2xl font-black shadow-xl shadow-primary/25 hover:scale-105 active:scale-95 transition-all"
                    >
                        <Plus size={20} strokeWidth={3} />
                        Novo Lead
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-12">
                {[
                    { label: 'Leads Totais', value: stats.total, sub: `+${stats.new}`, color: 'blue', icon: Users, filter: null },
                    { label: 'Conversão', value: `${stats.conversion}%`, sub: 'Matrícula', color: 'orange', icon: TrendingUp, filter: 'won' },
                    { label: 'Em Experimento', value: stats.trial, sub: 'Aulas', color: 'purple', icon: Calendar, filter: 'trial' },
                    { label: 'Matriculados', value: stats.matriculated, sub: 'Alunos', color: 'green', icon: Target, filter: 'won' },
                ].map((stat, idx) => (
                    <motion.div
                        key={idx}
                        whileHover={{ y: -5 }}
                        onClick={() => setStatusFilter(statusFilter === stat.filter ? null : stat.filter)}
                        className={clsx(
                            "bg-white p-4 md:p-8 rounded-2xl md:rounded-[2.5rem] border border-slate-100 shadow-sm cursor-pointer transition-all",
                            statusFilter === stat.filter && "ring-2 ring-primary border-transparent shadow-lg"
                        )}
                    >
                        <div className="flex items-center justify-between mb-2 md:mb-4">
                            <div className={clsx("w-8 h-8 md:w-12 md:h-12 rounded-lg md:rounded-2xl flex items-center justify-center",
                                stat.color === 'blue' ? "bg-blue-50 text-blue-500" :
                                    stat.color === 'orange' ? "bg-orange-50 text-orange-500" :
                                        stat.color === 'purple' ? "bg-purple-50 text-purple-500" :
                                            "bg-green-50 text-green-500"
                            )}>
                                <stat.icon size={16} className="md:w-6 md:h-6" />
                            </div>
                            <span className={clsx("text-[8px] md:text-[10px] font-black uppercase tracking-widest",
                                stat.color === 'blue' ? "text-blue-500" :
                                    stat.color === 'orange' ? "text-orange-500" :
                                        stat.color === 'purple' ? "text-purple-500" :
                                            "text-green-500"
                            )}>{stat.label}</span>
                        </div>
                        <div className="flex items-baseline gap-1 md:gap-2">
                            <span className="text-xl md:text-3xl font-black text-slate-900">{stat.value}</span>
                            <span className="text-[10px] md:text-xs font-bold text-slate-400 truncate">{stat.sub}</span>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* View Toggle & Active Filters */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 w-full sm:w-auto no-scrollbar">
                    <button
                        onClick={() => setStatusFilter(null)}
                        className={clsx(
                            "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shrink-0",
                            !statusFilter ? "bg-slate-900 text-white shadow-lg" : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"
                        )}
                    >
                        Todos
                    </button>
                    {COLUMNS.map(col => (
                        <button
                            key={col.id}
                            onClick={() => setStatusFilter(col.id)}
                            className={clsx(
                                "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shrink-0",
                                statusFilter === col.id ? `${col.color} text-white shadow-lg` : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"
                            )}
                        >
                            {col.label}
                        </button>
                    ))}
                </div>

                <div className="bg-slate-100 p-1.5 rounded-2xl flex gap-1.5">
                    <button
                        onClick={() => setView('kanban')}
                        className={clsx("flex items-center gap-2 px-4 py-2 rounded-xl transition-all font-bold text-xs", view === 'kanban' ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700")}
                    >
                        <LayoutGrid size={16} />
                        Kanban
                    </button>
                    <button
                        onClick={() => setView('list')}
                        className={clsx("flex items-center gap-2 px-4 py-2 rounded-xl transition-all font-bold text-xs", view === 'list' ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700")}
                    >
                        <List size={16} />
                        Lista
                    </button>
                </div>
            </div>

            {/* Content Area */}
            {view === 'kanban' ? (
                <div id="leads-kanban" className="flex gap-4 md:gap-6 overflow-x-auto pb-8 -mx-4 md:-mx-10 px-4 md:px-10 snap-x no-scrollbar">
                    {COLUMNS.map(col => (
                        <div key={col.id} className="min-w-[300px] md:min-w-[340px] w-[85vw] md:w-80 shrink-0 snap-center md:snap-start flex flex-col gap-5">
                            <div className="flex items-center justify-between px-3">
                                <div className="flex items-center gap-2.5">
                                    <div className={clsx("w-3.5 h-3.5 rounded-full ring-4 ring-white shadow-sm", col.color)}></div>
                                    <h3 className="font-black text-[11px] text-slate-900 uppercase tracking-[0.2em]">{col.label}</h3>
                                    <span className="ml-1 bg-slate-200/60 text-slate-700 text-[10px] font-black px-2 py-0.5 rounded-full ring-1 ring-slate-300">
                                        {leads.filter(l => l.status === col.id).length}
                                    </span>
                                </div>
                                <button
                                    onClick={() => { setModalLead({ status: col.id as Lead['status'] }); setShowLeadModal(true); }}
                                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-primary transition-all"
                                >
                                    <Plus size={18} />
                                </button>
                            </div>

                            <div className="bg-slate-100/40 p-3 rounded-[2.5rem] border border-slate-200/60 min-h-[500px] flex flex-col gap-3">
                                {leads.filter(l => l.status === col.id).length === 0 ? (
                                    <div className="flex flex-col items-center justify-center flex-1 text-slate-400/60">
                                        <div className="w-14 h-14 bg-white/50 rounded-3xl flex items-center justify-center mb-3">
                                            <Target size={24} />
                                        </div>
                                        <span className="text-[10px] font-black uppercase tracking-[0.2em]">Sem leads aqui</span>
                                    </div>
                                ) : (
                                    <AnimatePresence mode="popLayout">
                                        {leads.filter(l => l.status === col.id).map(lead => (
                                            <motion.div
                                                layout
                                                initial={{ opacity: 0, scale: 0.9 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.9 }}
                                                key={lead.id}
                                                onClick={() => setSelectedLead(lead)}
                                                className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:border-slate-200 transition-all cursor-pointer group relative overflow-hidden"
                                            >
                                                <div className={clsx("absolute top-0 left-0 w-1.5 h-full opacity-70", col.color)}></div>

                                                <div className="flex items-start justify-between mb-4 pl-1">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center font-black text-slate-700 text-sm border border-slate-100 shadow-inner">
                                                            {lead.name?.charAt(0) || lead.phone.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <h4 className="font-black text-slate-900 text-sm group-hover:text-primary transition-colors leading-tight">{lead.name || 'Sem Nome'}</h4>
                                                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-1 font-bold">
                                                                <Phone size={10} className="text-slate-300" />
                                                                {lead.phone}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setModalLead(lead); setShowLeadModal(true); }}
                                                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-300 hover:text-slate-600 transition-all"
                                                        >
                                                            <Edit size={14} />
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleDeleteLead(lead.id); }}
                                                            className="p-1.5 hover:bg-red-50 rounded-lg text-slate-300 hover:text-red-500 transition-all"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </div>

                                                {lead.last_message ? (
                                                    <div className="mb-4 bg-slate-50/80 p-3.5 rounded-2xl italic border border-slate-100">
                                                        <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                                                            “{lead.last_message}”
                                                        </p>
                                                        <span className="text-[8px] text-slate-400 mt-2 block font-black uppercase tracking-widest">{format(new Date(lead.last_message_at), 'dd/MM HH:mm')}</span>
                                                    </div>
                                                ) : (
                                                    <div className="mb-4 h-12 flex items-center justify-center border-2 border-dashed border-slate-100 rounded-2xl">
                                                        <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Nenhum contato</span>
                                                    </div>
                                                )}

                                                <div className="flex items-center justify-between">
                                                    <div className="flex gap-2.5">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setSelectedLead(lead); }}
                                                            className="w-10 h-10 bg-green-50 text-green-600 rounded-2xl hover:bg-green-600 hover:text-white transition-all flex items-center justify-center shadow-sm"
                                                        >
                                                            <MessageSquare size={16} />
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); window.open(`https://wa.me/${lead.phone}`, '_blank'); }}
                                                            className="w-10 h-10 bg-blue-50 text-blue-600 rounded-2xl hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center shadow-sm"
                                                        >
                                                            <Phone size={16} />
                                                        </button>
                                                    </div>

                                                    <div className="flex flex-col items-end">
                                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 px-2">Valor Estimado</span>
                                                        <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 shadow-inner">
                                                            <span className="text-xs font-black text-slate-700">R$ {lead.value?.toFixed(2)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bg-white rounded-2xl md:rounded-[3rem] border border-slate-200 overflow-hidden shadow-xl shadow-slate-200/20">
                    {/* Mobile Card List (md:hidden) */}
                    <div className="md:hidden divide-y divide-slate-100">
                        {filteredLeads.length === 0 ? (
                            <div className="p-10 text-center text-slate-400">Nenhum lead encontrado</div>
                        ) : (
                            filteredLeads.map(lead => (
                                <div key={lead.id} className="p-6 space-y-4 active:bg-slate-50 transition-colors" onClick={() => setSelectedLead(lead)}>
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-black text-slate-700">
                                                {lead.name?.charAt(0) || lead.phone.charAt(0)}
                                            </div>
                                            <div>
                                                <h4 className="font-black text-slate-900">{lead.name || 'Sem nome'}</h4>
                                                <p className="text-xs text-slate-400 font-bold">{lead.phone}</p>
                                            </div>
                                        </div>
                                        <div className={clsx(
                                            "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest",
                                            COLUMNS.find(c => c.id === lead.status)?.lightColor,
                                            COLUMNS.find(c => c.id === lead.status)?.textColor
                                        )}>
                                            {COLUMNS.find(c => c.id === lead.status)?.label}
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between border-t border-slate-50 pt-4">
                                        <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest">
                                            {format(new Date(lead.last_message_at), 'dd/MM HH:mm')}
                                        </div>
                                        <div className="text-xs font-black text-slate-700">
                                            R$ {lead.value?.toFixed(2)}
                                        </div>
                                    </div>

                                    <div className="flex justify-end gap-2 pt-2">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setSelectedLead(lead); }}
                                            className="p-3 bg-slate-100 text-slate-400 rounded-xl"
                                        >
                                            <MessageSquare size={18} />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setModalLead(lead); setShowLeadModal(true); }}
                                            className="p-3 bg-slate-100 text-slate-400 rounded-xl"
                                        >
                                            <Edit size={18} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Desktop Table (hidden md:block) */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                    <th className="px-10 py-6">Lead</th>
                                    <th className="px-10 py-6">Status</th>
                                    <th className="px-10 py-6 text-right">Valor Estimado</th>
                                    <th className="px-10 py-6">Último Contato</th>
                                    <th className="px-10 py-6 text-center">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredLeads.map(lead => (
                                    <tr key={lead.id} className="hover:bg-slate-50 transition-colors group cursor-pointer" onClick={() => setSelectedLead(lead)}>
                                        <td className="px-10 py-6">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center font-black text-slate-700 shadow-sm border border-slate-100">
                                                    {lead.name?.charAt(0) || lead.phone.charAt(0)}
                                                </div>
                                                <div>
                                                    <div className="font-black text-slate-900 group-hover:text-primary transition-colors">{lead.name || 'Sem nome'}</div>
                                                    <div className="text-xs text-slate-400 font-bold mt-0.5">{lead.phone}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-10 py-6">
                                            <select
                                                value={lead.status}
                                                onChange={(e) => { e.stopPropagation(); updateLeadStatus(lead.id, e.target.value); }}
                                                onClick={(e) => e.stopPropagation()}
                                                className={clsx(
                                                    "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest outline-none border-none cursor-pointer",
                                                    COLUMNS.find(c => c.id === lead.status)?.lightColor,
                                                    COLUMNS.find(c => c.id === lead.status)?.textColor
                                                )}
                                            >
                                                {COLUMNS.map(c => (
                                                    <option key={c.id} value={c.id}>{c.label}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="px-10 py-6 text-right">
                                            <span className="font-black text-slate-700">R$ {lead.value?.toFixed(2)}</span>
                                        </td>
                                        <td className="px-10 py-6">
                                            <div className="text-xs text-slate-500 font-bold">{format(new Date(lead.last_message_at), 'dd/MM HH:mm')}</div>
                                        </td>
                                        <td className="px-10 py-6">
                                            <div className="flex justify-center gap-3">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setSelectedLead(lead); }}
                                                    className="p-2.5 bg-slate-100 text-slate-400 rounded-xl hover:bg-green-600 hover:text-white transition-all shadow-sm"
                                                >
                                                    <MessageSquare size={18} />
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setModalLead(lead); setShowLeadModal(true); }}
                                                    className="p-2.5 bg-slate-100 text-slate-400 rounded-xl hover:bg-slate-900 hover:text-white transition-all shadow-sm"
                                                >
                                                    <Edit size={18} />
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleDeleteLead(lead.id); }}
                                                    className="p-2.5 bg-slate-100 text-slate-400 rounded-xl hover:bg-red-600 hover:text-white transition-all shadow-sm"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Integrated Chat Overlay */}
            <AnimatePresence>
                {selectedLead && (
                    <motion.div
                        initial={{ opacity: 0, x: 500 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 500 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed top-0 right-0 w-full sm:w-[500px] h-full bg-white shadow-[-20px_0_50px_rgba(0,0,0,0.1)] z-[100] border-l border-slate-100 flex flex-col overflow-hidden"
                    >
                        {/* Chat Header */}
                        <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-white relative">
                            <div className="flex items-center gap-5">
                                <div className="w-14 h-14 rounded-[1.5rem] bg-primary/5 flex items-center justify-center text-primary font-black text-xl border border-primary/10 shadow-inner">
                                    {selectedLead.name?.charAt(0) || 'L'}
                                </div>
                                <div>
                                    <h2 className="font-black text-slate-900 text-lg tracking-tight leading-tight">{selectedLead.name || 'Lead'}</h2>
                                    <div className="flex items-center gap-2 mt-1">
                                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">{selectedLead.phone}</p>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedLead(null)}
                                className="p-3 hover:bg-slate-100 rounded-2xl transition-all text-slate-300 hover:text-slate-600 border border-transparent hover:border-slate-200 shadow-sm"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* Funnel Stage in Chat */}
                        <div className="px-8 py-5 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-8 bg-primary rounded-full"></div>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Estágio do Funil:</span>
                            </div>
                            <select
                                value={selectedLead.status}
                                onChange={(e) => updateLeadStatus(selectedLead.id, e.target.value)}
                                className={clsx(
                                    "px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest outline-none shadow-sm transition-all cursor-pointer",
                                    COLUMNS.find(c => c.id === selectedLead.status)?.lightColor,
                                    COLUMNS.find(c => c.id === selectedLead.status)?.textColor,
                                    "border-2",
                                    COLUMNS.find(c => c.id === selectedLead.status)?.textColor.replace('text', 'border')
                                )}
                            >
                                {COLUMNS.map(c => (
                                    <option key={c.id} value={c.id}>{c.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-[#fcfcfd]">
                            {messages.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-slate-300/60 text-center">
                                    <div className="w-24 h-24 bg-white rounded-[2.5rem] flex items-center justify-center shadow-xl shadow-slate-200/50 mb-6 border border-slate-100">
                                        <MessageSquare size={44} strokeWidth={1} />
                                    </div>
                                    <p className="text-sm font-black uppercase tracking-[0.2em]">Inicie o atendimento</p>
                                    <p className="text-xs font-medium text-slate-400 mt-2 max-w-[200px]">As mensagens enviadas aqui serão redirecionadas ao WhatsApp dele.</p>
                                </div>
                            ) : (
                                <>
                                    {messages.map((msg, i) => (
                                        <div key={msg.id || i} className={clsx("flex", msg.from_me ? "justify-end" : "justify-start")}>
                                            <div className={clsx(
                                                "max-w-[85%] p-5 rounded-3xl shadow-sm text-sm font-medium leading-relaxed mb-1 relative group",
                                                msg.from_me
                                                    ? "bg-slate-900 text-white rounded-tr-none shadow-xl shadow-slate-900/10"
                                                    : "bg-white text-slate-800 rounded-tl-none border border-slate-100"
                                            )}>
                                                {msg.content}
                                                <div className={clsx(
                                                    "text-[8px] font-black uppercase mt-3 tracking-widest",
                                                    msg.from_me ? "text-slate-400 text-right font-bold" : "text-slate-400"
                                                )}>
                                                    {format(new Date(msg.created_at), 'HH:mm')}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    <div ref={chatEndRef}></div>
                                </>
                            )}
                        </div>

                        {/* Input Area */}
                        <div className="p-8 border-t border-slate-100 bg-white shadow-[0_-10px_40px_rgba(0,0,0,0.02)]">
                            <form onSubmit={handleSendMessage} className="flex gap-4">
                                <div className="flex-1 relative">
                                    <input
                                        type="text"
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        placeholder="Digite sua resposta..."
                                        className="w-full bg-slate-50 border border-slate-100 rounded-[1.8rem] pl-6 pr-14 py-5 text-sm font-black placeholder:text-slate-300 outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/50 transition-all font-medium"
                                    />
                                    <button
                                        disabled={!newMessage.trim() || sending}
                                        type="submit"
                                        className="absolute right-3 top-1/2 -translate-y-1/2 w-12 h-12 bg-primary text-white rounded-[1.2rem] flex items-center justify-center shadow-lg shadow-primary/30 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 disabled:shadow-none"
                                    >
                                        <Send size={22} className={clsx(sending && "animate-pulse")} />
                                    </button>
                                </div>
                            </form>
                            <div className="mt-5 flex items-center justify-center gap-3">
                                <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em]">Canais: WhatsApp Business 2.0</p>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Modal de Lead (Novo/Editar) */}
            <AnimatePresence>
                {showLeadModal && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowLeadModal(false)}
                            className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl relative z-[120] overflow-hidden"
                        >
                            <div className="p-10">
                                <div className="flex items-center justify-between mb-8">
                                    <div>
                                        <h2 className="text-3xl font-black text-slate-900 tracking-tighter">
                                            {modalLead?.id ? 'Editar' : 'Novo'} <span className="text-primary">Lead</span>
                                        </h2>
                                        <p className="text-sm font-bold text-slate-400 mt-1 uppercase tracking-widest">Informações de Contato</p>
                                    </div>
                                    <button
                                        onClick={() => setShowLeadModal(false)}
                                        className="p-3 hover:bg-slate-100 rounded-2xl text-slate-300 hover:text-slate-600 transition-all border border-transparent hover:border-slate-100"
                                    >
                                        <X size={24} />
                                    </button>
                                </div>

                                <form onSubmit={handleSaveLead} className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Nome Completo</label>
                                        <input
                                            type="text"
                                            required
                                            value={modalLead?.name || ''}
                                            onChange={(e) => setModalLead({ ...modalLead, name: e.target.value })}
                                            placeholder="Ex: João Silva"
                                            className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-slate-800 focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Telefone (DDD + Numero)</label>
                                        <input
                                            type="tel"
                                            required
                                            value={modalLead?.phone || ''}
                                            onChange={(e) => setModalLead({ ...modalLead, phone: e.target.value })}
                                            placeholder="Ex: 11999999999"
                                            className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-slate-800 focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all shadow-inner"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Estágio</label>
                                            <select
                                                value={modalLead?.status || 'new'}
                                                onChange={(e) => setModalLead({ ...modalLead, status: e.target.value as any })}
                                                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-slate-800 focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all appearance-none cursor-pointer"
                                            >
                                                {COLUMNS.map(c => (
                                                    <option key={c.id} value={c.id}>{c.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Valor Estimado</label>
                                            <div className="relative">
                                                <span className="absolute left-6 top-1/2 -translate-y-1/2 font-black text-slate-400">R$</span>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={modalLead?.value || ''}
                                                    onChange={(e) => setModalLead({ ...modalLead, value: parseFloat(e.target.value) })}
                                                    placeholder="0.00"
                                                    className="w-full pl-14 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-slate-800 focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all shadow-inner"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-6">
                                        <button
                                            type="submit"
                                            className="w-full py-5 bg-slate-900 text-white rounded-[1.5rem] font-black shadow-2xl shadow-slate-900/30 hover:bg-slate-800 hover:scale-[1.02] active:scale-[0.98] transition-all text-sm uppercase tracking-[0.2em]"
                                        >
                                            {modalLead?.id ? 'Atualizar Lead' : 'Cadastrar Lead'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Backdrop for Chat */}
            {selectedLead && (
                <div
                    className="fixed inset-0 bg-slate-900/10 backdrop-blur-sm z-[90]"
                    onClick={() => setSelectedLead(null)}
                />
            )}
        </div>
    );
};
