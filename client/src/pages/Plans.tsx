import React, { useEffect, useState, useCallback } from 'react';
import { useTutorial } from '../contexts/TutorialContext';
import clsx from 'clsx';
import api from '../api';
import { Plus, Trash2, Tag, Calendar, BadgeDollarSign, XCircle } from 'lucide-react';

interface Plan {
    id: string;
    name: string;
    price: number;
    duration_days: number;
}

export const Plans = () => {
    const [plans, setPlans] = useState<Plan[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({ name: '', price: '', duration_days: '' });

    const fetchPlans = useCallback(() => {
        api.get('/plans').then(res => setPlans(res.data)).catch(console.error);
    }, []);

    useEffect(() => {
        fetchPlans();
    }, [fetchPlans]);

    const { startTutorial, hasSeenTutorial } = useTutorial();
    useEffect(() => {
        if (!hasSeenTutorial('plans')) {
            startTutorial('plans');
        }
    }, [hasSeenTutorial, startTutorial]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.post('/plans', formData);
            setShowModal(false);
            setFormData({ name: '', price: '', duration_days: '' });
            fetchPlans();
        } catch (e) {
            console.error(e);
            alert('Erro ao criar plano');
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm('Tem certeza que deseja excluir este plano?')) {
            try {
                await api.delete(`/plans/${id}`);
                fetchPlans();
            } catch (e) {
                console.error(e);
                alert('Erro ao excluir plano');
            }
        }
    };

    return (
        <div className="animate-fade-in-up">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-8">
                <div className="mb-10 lg:mb-0">
                    <h1 className="text-4xl font-black text-slate-900 mb-2 tracking-tighter">Planos da Academia</h1>
                    <p className="text-slate-500 font-medium">Configure as modalidades de assinatura e mensalidades.</p>
                </div>
                <button
                    id="btn-new-plan"
                    onClick={() => setShowModal(true)}
                    className="flex items-center justify-center gap-3 bg-primary text-white px-10 py-5 rounded-[2rem] font-black hover:opacity-90 transition shadow-2xl shadow-primary/30 active:scale-95 text-sm uppercase tracking-widest"
                >
                    <Plus size={24} />
                    NOVO PLANO
                </button>
            </div>

            <div id="plans-grid" className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-24 md:mb-0">
                {plans.map(plan => (
                    <div key={plan.id} className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 hover:shadow-2xl hover:shadow-slate-200/50 transition-all duration-500 relative group overflow-hidden">
                        {/* Background Decoration */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-bl-[4rem] -z-10 transition-colors group-hover:bg-primary/5"></div>

                        <div className="flex items-center justify-between mb-8">
                            <div className="p-4 bg-slate-50 text-primary rounded-2xl group-hover:bg-primary group-hover:text-white transition-all duration-500 shadow-sm">
                                <Tag size={28} />
                            </div>
                            <button onClick={() => handleDelete(plan.id)} className="p-3 text-slate-200 hover:text-red-500 transition-colors">
                                <Trash2 size={24} />
                            </button>
                        </div>

                        <div className="mb-8">
                            <h3 className="text-2xl font-black text-slate-900 mb-1">{plan.name}</h3>
                            <div className="flex items-baseline gap-1">
                                <span className="text-slate-400 font-bold text-sm">R$</span>
                                <span className="text-4xl font-black text-slate-900 tracking-tighter">{plan.price.toFixed(0)}</span>
                                <span className="text-slate-400 font-bold text-sm">,{(plan.price % 1).toFixed(2).split('.')[1]}</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl w-fit">
                            <Calendar size={14} className="text-slate-400" />
                            <span className="text-xs font-black text-slate-500 uppercase tracking-widest">{plan.duration_days} Dias</span>
                        </div>
                    </div>
                ))}
                {plans.length === 0 && (
                    <div className="col-span-3 text-center py-20 bg-white rounded-[2rem] border-2 border-dashed border-slate-100 flex flex-col items-center">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                            <Tag size={24} className="text-slate-200" />
                        </div>
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Crie seu primeiro plano de assinatura</p>
                    </div>
                )}
            </div>

            {/* Modal - Optimized for Mobile */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/60 flex items-end md:items-center justify-center p-0 md:p-4 z-50 backdrop-blur-md">
                    <div className="bg-white rounded-t-[2.5rem] md:rounded-[2rem] shadow-2xl p-8 md:p-10 w-full max-w-md animate-fade-in-up">
                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h3 className="text-2xl font-black text-slate-900">Novo Plano</h3>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Configuração de Cobrança</p>
                            </div>
                            <button onClick={() => setShowModal(false)} className="text-slate-300 hover:text-slate-500 transition-colors">
                                <XCircle size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="group">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Nome do Plano</label>
                                <div className="relative">
                                    <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-primary transition-colors" size={20} />
                                    <input required className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 pl-12 focus:bg-white focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-bold text-slate-800" placeholder="Ex: Mensal Platinum" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                                </div>
                            </div>

                            <div className="group">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Valor do Plano (R$)</label>
                                <div className="relative">
                                    <BadgeDollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-primary transition-colors" size={20} />
                                    <input required type="number" step="0.01" className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 pl-12 focus:bg-white focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-bold text-slate-800" placeholder="Ex: 99.90" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} />
                                </div>
                            </div>

                            <div className="group">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Duração do Plano</label>
                                <div className="relative mb-3">
                                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-primary transition-colors" size={20} />
                                    <input required type="number" className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 pl-12 focus:bg-white focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-bold text-slate-800" placeholder="Ex: 30" value={formData.duration_days} onChange={e => setFormData({ ...formData, duration_days: e.target.value })} />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 uppercase">Dias</span>
                                </div>
                                <div className="grid grid-cols-4 gap-2">
                                    {[
                                        { label: 'Mensal', days: 30 },
                                        { label: 'Trim.', days: 90 },
                                        { label: 'Semest.', days: 180 },
                                        { label: 'Anual', days: 365 }
                                    ].map(d => (
                                        <button
                                            key={d.days}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, duration_days: d.days.toString() })}
                                            className={clsx(
                                                "py-2 rounded-xl text-[10px] font-black border transition-all",
                                                formData.duration_days === d.days.toString()
                                                    ? "bg-primary border-primary text-white shadow-lg shadow-primary/20"
                                                    : "bg-white border-slate-100 text-slate-500 hover:border-primary/30"
                                            )}
                                        >
                                            {d.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex flex-col gap-3 pt-4">
                                <button type="submit" className="w-full bg-primary text-white py-5 rounded-[2rem] font-black hover:opacity-90 shadow-2xl shadow-primary/20 transition-all active:scale-95 text-sm uppercase tracking-widest">
                                    CRIAR PLANO AGORA
                                </button>
                                <button type="button" onClick={() => setShowModal(false)} className="w-full py-4 text-slate-400 font-bold hover:text-slate-600 transition-colors">
                                    Cancelar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
