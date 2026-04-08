import React, { useEffect, useState, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';
import { Search, Send, User, Phone, CheckCircle2, MessageSquare, Clock, Paperclip, MoreVertical, Hash, Brain, ArrowLeft } from 'lucide-react';
import clsx from 'clsx';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Message {
    id: string;
    content: string;
    from_me: boolean;
    created_at: string;
    type: 'text' | 'image';
    member_id?: string | null;
}

interface ChatMember {
    id: string;
    name: string;
    phone: string;
    active: boolean;
    bot_paused: boolean;
    last_message?: string;
    last_message_at?: string;
    unread_count?: number;
}

export const Chat = () => {
    const { user } = useAuth();
    const [members, setMembers] = useState<ChatMember[]>([]);
    const [selectedMember, setSelectedMember] = useState<ChatMember | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const socketRef = useRef<any>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    };

    const fetchMembers = useCallback(async () => {
        try {
            const res = await api.get('/members');
            // We'll augment member data with some chat metadata if the backend doesn't provide it
            setMembers(res.data);
        } catch (err) {
            console.error('Error fetching chat members:', err);
        }
    }, []);

    const fetchMessages = useCallback(async (memberId: string) => {
        setLoading(true);
        try {
            const res = await api.get(`/members/${memberId}/messages`);
            setMessages(res.data);
            setTimeout(scrollToBottom, 100);
        } catch (err) {
            console.error('Error fetching messages:', err);
            toast.error('Erro ao carregar mensagens');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchMembers();

        // Socket setup
        const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:3001', {
            transports: ['polling', 'websocket'],
            withCredentials: true
        });
        socketRef.current = socket;

        if (user?.tenant_id) {
            socket.emit('join', user.tenant_id);
        }

        socket.on('new_message', (msg: Message) => {
            // If message is for/from the selected member, add to list
            if (selectedMember && msg.member_id === selectedMember.id) {
                setMessages(prev => [...prev, msg]);
                setTimeout(scrollToBottom, 50);
            }

            // Update last message in sidebar
            setMembers(prev => prev.map(m =>
                m.id === msg.member_id
                    ? { ...m, last_message: msg.content, last_message_at: msg.created_at }
                    : m
            ));
        });

        return () => {
            socket.disconnect();
        };
    }, [user?.tenant_id, selectedMember, fetchMembers]);

    useEffect(() => {
        if (selectedMember) {
            fetchMessages(selectedMember.id);
        } else {
            setMessages([]);
        }
    }, [selectedMember, fetchMessages]);

    const handleUnpauseBot = async () => {
        if (!selectedMember) return;
        try {
            await api.post(`/members/${selectedMember.id}/unpause`);
            toast.success('Atendimento encerrado e Bot religado!');
            // Update local state
            setMembers(prev => prev.map(m =>
                m.id === selectedMember.id ? { ...m, bot_paused: false } : m
            ));
            setSelectedMember(prev => prev ? { ...prev, bot_paused: false } : null);
        } catch (err) {
            console.error('Error unpausing bot:', err);
            toast.error('Erro ao religar o bot');
        }
    };

    const handleSendMessage = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!newMessage.trim() || !selectedMember) return;

        const content = newMessage;
        setNewMessage('');

        try {
            const cleanPhone = selectedMember.phone.replace(/\D/g, '');
            const jid = `${cleanPhone}@s.whatsapp.net`;

            await api.post('/chat/send', { jid, text: content });

            // Add optimistic local message or wait for socket? 
            // Better to add locally for speed
            const optimisticMsg: Message = {
                id: Date.now().toString(),
                content,
                from_me: true,
                created_at: new Date().toISOString(),
                type: 'text',
                member_id: selectedMember.id
            };
            setMessages(prev => [...prev, optimisticMsg]);
            setTimeout(scrollToBottom, 50);
        } catch (err) {
            console.error('Send error:', err);
            toast.error('Erro ao enviar mensagem');
        }
    };

    const filteredMembers = members.filter(m =>
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        m.phone.includes(search)
    ).sort((a, b) => {
        if (!a.last_message_at) return 1;
        if (!b.last_message_at) return -1;
        return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
    });

    return (
        <div className="flex flex-col md:flex-row h-auto md:h-[calc(100vh-180px)] bg-white rounded-2xl md:rounded-[3rem] shadow-2xl border border-slate-100 overflow-visible md:overflow-hidden animate-fade-in-up">
            {/* Sidebar: Member List */}
            <div className={clsx(
                "w-full md:w-80 lg:w-96 border-r border-slate-50 flex flex-col bg-slate-50/30",
                selectedMember ? "hidden md:flex" : "flex"
            )}>
                <div className="p-4 md:p-8 border-b border-slate-50">
                    <h2 className="text-lg md:text-xl font-black text-slate-900 mb-4 md:mb-6 tracking-tight flex items-center gap-3">
                        <MessageSquare className="text-primary" size={20} />
                        Mensagens
                    </h2>
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar aluno..."
                            className="w-full bg-white border-none rounded-2xl py-3 pl-12 pr-4 text-sm font-medium focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto no-scrollbar">
                    {filteredMembers.length === 0 ? (
                        <div className="p-10 text-center">
                            <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">Nenhum aluno encontrado</p>
                        </div>
                    ) : (
                        filteredMembers.map(m => (
                            <button
                                key={m.id}
                                onClick={() => setSelectedMember(m)}
                                className={clsx(
                                    "w-full p-6 flex items-start gap-4 transition-all border-b border-slate-50/50 hover:bg-white",
                                    selectedMember?.id === m.id ? "bg-white border-l-4 border-l-primary shadow-sm" : "border-l-4 border-l-transparent"
                                )}
                            >
                                <div className="relative shrink-0">
                                    <div className="w-12 h-12 rounded-2xl bg-slate-200 flex items-center justify-center font-bold text-slate-500 overflow-hidden">
                                        <User size={24} />
                                    </div>
                                    <div className={clsx(
                                        "absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-slate-50",
                                        m.active ? "bg-emerald-500" : "bg-slate-300"
                                    )} />
                                </div>
                                <div className="flex-1 min-w-0 text-left">
                                    <div className="flex justify-between items-center mb-1">
                                        <h4 className="font-black text-slate-900 truncate text-sm">{m.name}</h4>
                                        {m.last_message_at && (
                                            <span className="text-[10px] font-bold text-slate-400">
                                                {format(new Date(m.last_message_at), 'HH:mm')}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-400 truncate font-medium">
                                        {m.last_message || m.phone}
                                    </p>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </div>

            {/* Main Chat Area */}
            <div className={clsx(
                "flex-1 flex flex-col bg-white",
                !selectedMember ? "hidden md:flex" : "flex"
            )}>
                {selectedMember ? (
                    <>
                        {/* Chat Header */}
                        <div className="px-4 md:px-8 py-4 md:py-6 border-b border-slate-50 flex items-center justify-between bg-white z-10 shrink-0">
                            <div className="flex items-center gap-2 md:gap-4">
                                <button
                                    onClick={() => setSelectedMember(null)}
                                    className="md:hidden p-2 -ml-2 text-slate-400 hover:text-primary transition-all"
                                >
                                    <ArrowLeft size={24} />
                                </button>
                                <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-black shrink-0">
                                    {selectedMember.name.charAt(0)}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-black text-slate-900 tracking-tight">{selectedMember.name}</h3>
                                        <CheckCircle2 size={16} className="text-primary" />
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        <Phone size={10} />
                                        {selectedMember.phone}
                                    </div>
                                    {selectedMember.bot_paused && (
                                        <div className="flex items-center gap-1.5 mt-1 bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full border border-amber-100 w-fit">
                                            <Brain size={10} />
                                            <span className="text-[9px] font-black uppercase tracking-tighter">Bot Pausado</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {selectedMember.bot_paused && (
                                    <button
                                        onClick={handleUnpauseBot}
                                        className="hidden sm:flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary/20"
                                    >
                                        Encerrar Atendimento
                                    </button>
                                )}
                                <button className="p-3 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all">
                                    <Clock size={20} />
                                </button>
                                <button className="p-3 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all">
                                    <MoreVertical size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Mobile handleUnpauseBot button */}
                        {selectedMember.bot_paused && (
                            <div className="md:hidden px-4 py-2 bg-amber-50 border-b border-amber-100 flex items-center justify-between">
                                <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest flex items-center gap-2">
                                    <Brain size={14} /> Atendimento Humano Ativo
                                </span>
                                <button
                                    onClick={handleUnpauseBot}
                                    className="text-[10px] font-black text-primary uppercase underline tracking-widest"
                                >
                                    Encerrar
                                </button>
                            </div>
                        )}

                        {/* Messages Body */}
                        <div
                            ref={scrollRef}
                            className="flex-1 overflow-y-auto p-4 md:p-10 space-y-4 md:space-y-6 bg-slate-50/30"
                        >
                            {loading ? (
                                <div className="flex items-center justify-center h-full">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                                </div>
                            ) : messages.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-50">
                                    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center">
                                        <MessageSquare size={32} className="text-slate-300" />
                                    </div>
                                    <div>
                                        <h4 className="font-black text-slate-900 uppercase tracking-widest text-xs">Sem mensagens ainda</h4>
                                        <p className="text-xs text-slate-500 font-medium">Envie uma mensagem para iniciar o atendimento.</p>
                                    </div>
                                </div>
                            ) : (
                                messages.map((msg, i) => {
                                    const showDate = i === 0 || format(new Date(msg.created_at), 'dd/MM') !== format(new Date(messages[i - 1].created_at), 'dd/MM');

                                    return (
                                        <React.Fragment key={msg.id}>
                                            {showDate && (
                                                <div className="flex justify-center">
                                                    <span className="px-4 py-1.5 bg-white border border-slate-100 rounded-full text-[10px] font-black text-slate-400 uppercase tracking-widest shadow-sm">
                                                        {format(new Date(msg.created_at), "eeee, d 'de' MMMM", { locale: ptBR })}
                                                    </span>
                                                </div>
                                            )}
                                            <div className={clsx(
                                                "flex",
                                                msg.from_me ? "justify-end" : "justify-start"
                                            )}>
                                                <div className={clsx(
                                                    "max-w-[70%] p-5 rounded-[2rem] shadow-sm relative group",
                                                    msg.from_me
                                                        ? "bg-primary text-white rounded-tr-none shadow-primary/20"
                                                        : "bg-white text-slate-800 rounded-tl-none border border-slate-100"
                                                )}>
                                                    <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap">
                                                        {msg.content}
                                                    </p>
                                                    <div className={clsx(
                                                        "text-[9px] mt-2 font-bold uppercase tracking-widest flex items-center gap-1 opacity-70",
                                                        msg.from_me ? "text-white/80" : "text-slate-400"
                                                    )}>
                                                        {format(new Date(msg.created_at), 'HH:mm')}
                                                        {msg.from_me && <CheckCircle2 size={10} />}
                                                    </div>
                                                </div>
                                            </div>
                                        </React.Fragment>
                                    );
                                })
                            )}
                        </div>

                        {/* Input Area */}
                        <div className="p-4 md:p-8 pb-32 md:pb-8 bg-white border-t border-slate-50 flex-shrink-0">
                            <form onSubmit={handleSendMessage} className="flex items-center gap-2 md:gap-4 bg-slate-50 p-1 md:p-2 rounded-2xl md:rounded-[2rem] shadow-inner focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                                <button type="button" className="p-2 md:p-4 text-slate-400 hover:text-primary transition-all rounded-full hover:bg-white shadow-sm">
                                    <Paperclip size={20} />
                                </button>
                                <input
                                    type="text"
                                    placeholder="Digite sua mensagem..."
                                    className="flex-1 bg-transparent border-none outline-none py-2 md:py-4 px-2 text-xs md:text-sm font-medium text-slate-800"
                                    value={newMessage}
                                    onChange={e => setNewMessage(e.target.value)}
                                />
                                <button
                                    type="submit"
                                    className="bg-primary text-white p-3 md:p-4 rounded-full shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all w-10 h-10 md:w-14 md:h-14 flex items-center justify-center shrink-0"
                                >
                                    <Send size={18} fill="white" className="md:w-5 md:h-5" />
                                </button>
                            </form>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-20 text-center space-y-6">
                        <div className="w-32 h-32 bg-slate-50 rounded-[3rem] flex items-center justify-center text-slate-200">
                            <Brain size={64} className="animate-pulse" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-2">Painel de Atendimento</h3>
                            <p className="text-slate-500 max-w-sm font-medium">Selecione um aluno na lateral para visualizar o histórico e enviar novas mensagens via WhatsApp.</p>
                        </div>
                        <div className="flex gap-4">
                            <div className="px-6 py-3 bg-primary/5 rounded-2xl border border-primary/10 flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                                <span className="text-[10px] font-black text-primary uppercase tracking-widest text-[9px]">WhatsApp Online</span>
                            </div>
                            <div className="px-6 py-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-2">
                                <Hash className="text-slate-400" size={14} />
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-[9px]">{members.length} Alunos Disponíveis</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
