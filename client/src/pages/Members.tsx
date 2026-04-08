import React, { useEffect, useState, useCallback } from 'react';
import { useTutorial } from '../contexts/TutorialContext';
import api from '../api';
import { Plus, Search, Pencil, Trash2, Calendar, User, Activity, Utensils, Phone, XCircle, Send, Brain } from 'lucide-react';
import clsx from 'clsx';
import { toast } from 'react-toastify';
import { WorkoutBuilder } from '../components/WorkoutBuilder';

interface MemberPlan {
    id: string;
    name: string;
    price: number;
    duration_days: number;
}

interface Member {
    id: string;
    name: string;
    phone: string;
    plan_id: string | null;
    active: boolean;
    plan_end_date: string;
    diet_plan?: string;
    workout_routine?: string;
    cpf?: string;
    address?: string;
    plan?: MemberPlan;
}

export const Members = () => {
    const [members, setMembers] = useState<Member[]>([]);
    const [plans, setPlans] = useState<MemberPlan[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({ name: '', phone: '', plan_id: '', diet: '', workout: '', cpf: '', address: '' });
    const [editingId, setEditingId] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [activeTab, setActiveTab] = useState<'info' | 'workout' | 'diet'>('info');

    const { startTutorial, hasSeenTutorial } = useTutorial();

    const fetchData = useCallback(() => {
        api.get('/members').then(res => setMembers(res.data)).catch(err => console.error('Error fetching members:', err));
        api.get('/plans').then(res => setPlans(res.data)).catch(err => console.error('Error fetching plans:', err));
    }, []);

    useEffect(() => {
        fetchData();
        if (!hasSeenTutorial('members')) {
            startTutorial('members');
        }
    }, [fetchData, hasSeenTutorial, startTutorial]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = {
                ...formData,
                plan_id: formData.plan_id || null
            };

            if (editingId) {
                await api.put(`/members/${editingId}`, payload);
            } else {
                await api.post('/members', payload);
            }
            setShowModal(false);
            setEditingId(null);
            setFormData({ name: '', phone: '', plan_id: '', diet: '', workout: '', cpf: '', address: '' });
            fetchData();
        } catch (err: unknown) {
            console.error('Submit error:', err);
            const errorMsg = err && typeof err === 'object' && 'response' in err
                ? (err as { response: { data: { error: string } } }).response?.data?.error
                : (err as { message?: string }).message || 'Erro desconhecido';
            alert('Erro ao salvar membro: ' + errorMsg);
        }
    };

    const handleEdit = (member: Member) => {
        setEditingId(member.id);
        setFormData({
            name: member.name,
            phone: member.phone,
            plan_id: member.plan_id || '',
            diet: member.diet_plan || '',
            workout: member.workout_routine || '',
            cpf: member.cpf || '',
            address: member.address || ''
        });
        setActiveTab('info');
        setShowModal(true);
    };

    const handleDelete = async (id: string, name: string) => {
        if (!window.confirm(`Tem certeza que deseja remover ${name}?`)) return;
        try {
            await api.delete(`/members/${id}`);
            fetchData();
        } catch (err) {
            console.error('Delete error:', err);
            alert('Erro ao remover membro');
        }
    };

    const openForCreate = () => {
        setEditingId(null);
        setFormData({ name: '', phone: '', plan_id: '', diet: '', workout: '', cpf: '', address: '' });
        setActiveTab('info');
        setShowModal(true);
    };

    const insertTemplate = (field: 'diet' | 'workout') => {
        const weeklyTemplate = `
Segunda:
- 

Terça:
- 

Quarta:
- 

Quinta:
- 

Sexta:
- 

Sábado:
- 

Domingo:
- `;
        setFormData(prev => ({ ...prev, [field]: (prev[field] || '') + weeklyTemplate }));
    };

    const generateAIWorkout = () => {
        const goal = window.prompt("Qual o objetivo do aluno? (Ex: Perda de peso, Hipertrofia, Resistência)");
        if (!goal) return;

        setFormData(prev => ({ ...prev, workout: 'Gerando treino inteligente...' }));

        setTimeout(() => {
            const mockWorkout = `🔥 TREINO IA - FOCO: ${goal.toUpperCase()}\n\n` +
                `1️⃣ Supino Reto: 4 x 12 (Foco em cadência)\n` +
                `2️⃣ Agachamento Livre: 4 x 10 (Explosivo)\n` +
                `3️⃣ Remada Curvada: 3 x 15 (Máxima contração)\n` +
                `4️⃣ Desenvolvimento Militar: 3 x 12\n` +
                `5️⃣ Abdominal Supra: 4 x Exaustão\n\n` +
                `💡 Dica da IA: Mantenha o descanso entre 45s e 60s para otimizar a queima calórica.`;
            setFormData(prev => ({ ...prev, workout: mockWorkout }));
        }, 1500);
    };

    const filtered = members.filter(m => m.name.toLowerCase().includes(search.toLowerCase()) || m.phone.includes(search));

    return (
        <>
            <div className="flex flex-col h-full animate-fade-in-up">
                <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-8 mb-10">
                    <div className="flex-1">
                        <h1 className="text-4xl md:text-5xl font-black text-slate-900 mb-2 tracking-tighter">
                            Gestão de <span className="text-primary">Membros</span>
                        </h1>
                        <p className="text-slate-500 font-medium max-w-2xl">
                            Controle total sobre seus alunos, planos ativos e acompanhamento de treinos.
                        </p>
                    </div>
                    <button
                        id="btn-new-member"
                        onClick={openForCreate}
                        className="flex items-center justify-center gap-2 px-8 py-3.5 bg-primary text-white rounded-2xl font-black shadow-xl shadow-primary/25 hover:scale-105 active:scale-95 transition-all text-sm"
                    >
                        <Plus size={20} strokeWidth={3} />
                        Novo Membro
                    </button>
                </div>

                <div className="bg-white rounded-2xl md:rounded-[3rem] shadow-sm border border-slate-100 flex flex-col overflow-hidden mb-20 md:mb-0">
                    <div id="member-search" className="p-6 md:p-10 border-b border-slate-50 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <h2 className="text-xs font-black text-slate-900 uppercase tracking-widest">Lista de Alunos</h2>
                        <div className="relative w-full sm:max-w-md group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={18} />
                            <input
                                type="text"
                                placeholder="Buscar por nome ou telefone..."
                                className="w-full pl-11 pr-6 py-3.5 bg-slate-50 border border-transparent rounded-2xl focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-medium text-slate-600 shadow-sm"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Mobile View: Card List */}
                    <div className="md:hidden divide-y divide-slate-100">
                        {filtered.length === 0 ? (
                            <div className="p-10 text-center text-slate-400">Nenhum membro encontrado</div>
                        ) : (
                            filtered.map(member => {
                                const isActive = member.active && new Date(member.plan_end_date) > new Date();
                                return (
                                    <div key={member.id} className="p-6 space-y-4 active:bg-slate-50 transition-colors" onClick={() => handleEdit(member)}>
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-black text-slate-700">
                                                    {member.name?.charAt(0)}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="font-black text-slate-900">{member.name}</h4>
                                                        {isActive ? (
                                                            <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_rgba(var(--primary-rgb),0.6)]"></div>
                                                        ) : (
                                                            <div className="w-2 h-2 rounded-full bg-red-500"></div>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-slate-400 font-bold">{member.phone}</p>
                                                </div>
                                            </div>
                                            <div className={clsx(
                                                "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border",
                                                isActive ? 'bg-primary/5 text-primary border-primary/10' : 'bg-red-50 text-red-500 border-red-100'
                                            )}>
                                                {isActive ? 'Ativo' : 'Pendente'}
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between border-t border-slate-50 pt-4">
                                            <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest">
                                                {member.plan?.name || 'Manual'}
                                            </div>
                                            <div className="text-[10px] text-slate-500 font-bold">
                                                Expira {member.plan_end_date ? new Date(member.plan_end_date).toLocaleDateString('pt-BR') : '-'}
                                            </div>
                                        </div>

                                        <div className="flex justify-end gap-2 pt-2">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const workoutLink = `${window.location.origin}/w/${member.id}`;
                                                    const msg = `Olá ${member.name}! 💪\n\nSeu treino digital está pronto! Acesse pelo link abaixo:\n🔗 ${workoutLink}\n\n${member.workout_routine ? `Observações:\n${member.workout_routine}` : ''}\n\nBora treinar! 🚀`;
                                                    const cleanPhone = member.phone.replace(/\D/g, '');
                                                    api.post('/chat/send', { jid: `${cleanPhone}@s.whatsapp.net`, text: msg })
                                                        .then(() => toast.success('Treino enviado!'))
                                                        .catch(err => toast.error('Erro ao enviar: ' + err.message));
                                                }}
                                                className="p-3 bg-emerald-50 text-emerald-600 rounded-xl"
                                            >
                                                <Send size={18} />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleEdit(member); }}
                                                className="p-3 bg-blue-50 text-blue-600 rounded-xl"
                                            >
                                                <Pencil size={18} />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDelete(member.id, member.name); }}
                                                className="p-3 bg-red-50 text-red-600 rounded-xl"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Desktop View: Table */}
                    <div id="members-list" className="hidden md:block overflow-auto">
                        <table className="w-full">
                            <thead className="border-b border-slate-50">
                                <tr className="text-left">
                                    <th className="px-12 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Membro</th>
                                    <th className="px-12 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Plano Atual</th>
                                    <th className="px-12 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Status</th>
                                    <th className="px-12 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {filtered.map(member => {
                                    const isActive = member.active && new Date(member.plan_end_date) > new Date();
                                    return (
                                        <tr key={member.id} className="hover:bg-slate-50/30 transition-colors group">
                                            <td className="px-12 py-6">
                                                <div className="font-black text-slate-900">{member.name}</div>
                                                <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{member.phone}</div>
                                            </td>
                                            <td className="px-12 py-6">
                                                <div className="font-black text-slate-600">{member.plan?.name || 'Manual'}</div>
                                                <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Expira em {member.plan_end_date ? new Date(member.plan_end_date).toLocaleDateString('pt-BR') : '-'}</div>
                                            </td>
                                            <td className="px-12 py-6">
                                                <span className={clsx(
                                                    "px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border",
                                                    isActive ? 'bg-primary/10 text-primary border-primary/20' : 'bg-red-500/10 text-red-500 border-red-500/20'
                                                )}>
                                                    {isActive ? 'Ativo' : 'Pendente'}
                                                </span>
                                            </td>
                                            <td className="px-12 py-6">
                                                <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-all transform group-hover:translate-x-0 translate-x-4">
                                                    <button onClick={() => {
                                                        const workoutLink = `${window.location.origin}/w/${member.id}`;
                                                        const msg = `Olá ${member.name}! 💪\n\nSeu treino digital está pronto! Acesse pelo link abaixo:\n🔗 ${workoutLink}\n\n${member.workout_routine ? `Observações:\n${member.workout_routine}` : ''}\n\nBora treinar! 🚀`;

                                                        // Clean phone number (leave only digits)
                                                        const cleanPhone = member.phone.replace(/\D/g, '');

                                                        api.post('/chat/send', { jid: `${cleanPhone}@s.whatsapp.net`, text: msg })
                                                            .then(() => toast.success('Treino enviado via WhatsApp!'))
                                                            .catch(err => toast.error('Erro ao enviar: ' + err.message));
                                                    }} className="p-4 bg-white shadow-sm border border-slate-50 text-emerald-500 hover:bg-emerald-500 hover:text-white rounded-2xl transition-all" title="Enviar no WhatsApp">
                                                        <Send size={20} />
                                                    </button>
                                                    <button onClick={() => handleEdit(member)} className="p-4 bg-white shadow-sm border border-slate-50 text-blue-500 hover:bg-blue-500 hover:text-white rounded-2xl transition-all" title="Editar">
                                                        <Pencil size={20} />
                                                    </button>
                                                    <button onClick={() => handleDelete(member.id, member.name)} className="p-4 bg-white shadow-sm border border-slate-50 text-red-500 hover:bg-red-500 hover:text-white rounded-2xl transition-all" title="Excluir">
                                                        <Trash2 size={20} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Modal - Outside of animation container to fix fixed positioning */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/80 flex items-center justify-center p-4 z-[9999] backdrop-blur-md transition-all duration-300">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl h-[90vh] md:h-[85vh] flex flex-col animate-fade-in-up overflow-hidden relative border border-white/20">

                        {/* Modal Header */}
                        <div className="px-8 py-6 border-b border-slate-50 flex justify-between items-center shrink-0">
                            <div>
                                <h3 className="text-xl font-extrabold text-slate-900">{editingId ? 'Editar Aluno' : 'Novo Aluno'}</h3>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{editingId ? formData.name : 'Cadastro Inteligente'}</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <button type="button" onClick={handleSubmit} className="bg-primary text-white px-10 py-5 rounded-[2rem] font-black transition shadow-2xl shadow-primary/30 active:scale-95 text-sm uppercase tracking-widest">
                                    SALVAR ALTERAÇÕES
                                </button>
                                <button onClick={() => setShowModal(false)} className="p-3 bg-slate-100 text-slate-400 rounded-2xl hover:bg-slate-200 transition flex items-center justify-center">
                                    <XCircle size={24} />
                                </button>
                            </div>
                        </div>

                        {/* Navigation Tabs (App Like) */}
                        <div className="flex px-4 border-b border-slate-100 shrink-0 bg-slate-50/30">
                            {[
                                { id: 'info', icon: User, label: 'Perfil' },
                                { id: 'workout', icon: Activity, label: 'Treino' },
                                { id: 'diet', icon: Utensils, label: 'Dieta' }
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as 'info' | 'workout' | 'diet')}
                                    className={clsx(
                                        "flex-1 py-5 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all relative",
                                        activeTab === tab.id ? 'text-primary' : 'text-slate-400 hover:text-slate-600'
                                    )}
                                >
                                    <tab.icon size={20} />
                                    <span className="hidden sm:inline">{tab.label}</span>
                                    {activeTab === tab.id && <span className="absolute bottom-0 left-0 right-0 h-1.5 bg-primary rounded-t-full"></span>}
                                </button>
                            ))}
                        </div>

                        {/* Modal Content */}
                        <div className="flex-1 overflow-y-auto p-8 bg-white touch-pan-y">
                            {activeTab === 'info' && (
                                <div className="space-y-6 pb-10">
                                    <div className="group">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Nome Completo</label>
                                        <div className="relative">
                                            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-primary transition-colors" size={20} />
                                            <input required className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 pl-12 focus:bg-white focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-bold text-slate-800" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                                        </div>
                                    </div>
                                    <div className="group">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">WhatsApp (com DDD)</label>
                                        <div className="relative">
                                            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-primary transition-colors" size={20} />
                                            <input required type="tel" className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 pl-12 focus:bg-white focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-bold text-slate-800" placeholder="5511999999999" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="group">
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">CPF</label>
                                            <div className="relative">
                                                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-primary transition-colors" size={20} />
                                                <input className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 pl-12 focus:bg-white focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-bold text-slate-800" placeholder="000.000.000-00" value={formData.cpf} onChange={e => setFormData({ ...formData, cpf: e.target.value })} />
                                            </div>
                                        </div>
                                        <div className="group">
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Endereço</label>
                                            <div className="relative">
                                                <Activity className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-primary transition-colors" size={20} />
                                                <input className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 pl-12 focus:bg-white focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-bold text-slate-800" placeholder="Rua, Número, Bairro" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="group">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Plano da Academia</label>
                                        <div className="relative">
                                            <Activity className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-primary transition-colors" size={20} />
                                            <select className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 pl-12 focus:bg-white focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-bold text-slate-800 appearance-none pointer-events-auto" value={formData.plan_id} onChange={e => setFormData({ ...formData, plan_id: e.target.value })}>
                                                <option value="">Selecione um plano...</option>
                                                {plans.map(p => (
                                                    <option key={p.id} value={p.id}>{p.name} - R$ {p.price} ({p.duration_days} dias)</option>
                                                ))}
                                                <option value="">Sem plano fixo (30 dias)</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'workout' && (
                                <div className="h-full flex flex-col space-y-6">
                                    {editingId ? (
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
                                            {/* Digital Workout Builder */}
                                            <div className="flex flex-col h-full">
                                                <WorkoutBuilder memberId={editingId} />
                                            </div>

                                            {/* Manual Note Area (Keeping what user likes) */}
                                            <div className="flex flex-col h-full space-y-4">
                                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-bold text-slate-900">Anotações Manuais</span>
                                                        <span className="text-xs font-medium text-slate-400">Texto rápido enviado via WhatsApp.</span>
                                                    </div>
                                                    <div className="flex gap-2 w-full sm:w-auto">
                                                        <button type="button" onClick={generateAIWorkout} className="flex-1 sm:flex-none text-[10px] font-black uppercase tracking-widest bg-gradient-to-r from-primary to-orange-400 text-white px-4 py-3 rounded-xl flex items-center justify-center gap-2 hover:scale-105 transition shadow-lg shadow-primary/20">
                                                            <Brain size={14} /> Sugestão IA
                                                        </button>
                                                        <button type="button" onClick={() => insertTemplate('workout')} className="flex-1 sm:flex-none text-[10px] font-black uppercase tracking-widest bg-slate-900 text-white px-4 py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-slate-800 transition">
                                                            <Calendar size={14} /> Modelo
                                                        </button>
                                                    </div>
                                                </div>
                                                <textarea
                                                    className="flex-1 w-full bg-slate-50 border border-slate-100 rounded-[2rem] p-6 md:p-8 text-base focus:bg-white focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-mono resize-none shadow-inner min-h-[300px]"
                                                    placeholder="Digite observações manuais aqui..."
                                                    value={formData.workout}
                                                    onChange={e => setFormData({ ...formData, workout: e.target.value })}
                                                ></textarea>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-slate-50 rounded-[3rem] border border-slate-100">
                                            <Activity size={48} className="text-slate-200 mb-4" />
                                            <h3 className="text-lg font-black text-slate-900 mb-2">Salve o cadastro primeiro</h3>
                                            <p className="text-slate-500 max-w-sm">Para montar o treino digital, você precisa primeiro salvar os dados básicos do aluno.</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'diet' && (
                                <div className="h-full flex flex-col space-y-4">
                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                        <span className="text-sm font-medium text-slate-400">O plano alimentar será enviado junto com o treino.</span>
                                        <button type="button" onClick={() => insertTemplate('diet')} className="w-full sm:w-auto text-[10px] font-black uppercase tracking-widest bg-slate-900 text-white px-4 py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-slate-800 transition">
                                            <Calendar size={14} /> Usar Modelo Semanal
                                        </button>
                                    </div>
                                    <textarea
                                        className="flex-1 w-full bg-slate-50 border border-slate-100 rounded-[2rem] p-6 md:p-8 text-base focus:bg-white focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-mono resize-none shadow-inner min-h-[300px]"
                                        placeholder="Digite a dieta aqui..."
                                        value={formData.diet}
                                        onChange={e => setFormData({ ...formData, diet: e.target.value })}
                                    ></textarea>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
