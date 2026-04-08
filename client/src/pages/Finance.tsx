import { useState, useEffect, useCallback } from 'react';
import { useTutorial } from '../contexts/TutorialContext';
import { TrendingUp, AlertCircle, Clock, CheckCircle, Search } from 'lucide-react';
import api from '../api';
import clsx from 'clsx';

interface Invoice {
    id: string;
    member: {
        name: string;
    };
    description: string;
    amount: number;
    due_date: string;
    status: string;
    paid_at?: string;
}

export const Finance = () => {
    const [stats, setStats] = useState({ monthly_income: 0, pending_amount: 0, overdue_amount: 0 });
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    const { startTutorial, hasSeenTutorial } = useTutorial();

    const fetchData = useCallback(async () => {
        try {
            const [statsRes, invoicesRes] = await Promise.all([
                api.get('/finance/stats'),
                api.get('/finance/invoices')
            ]);
            setStats(statsRes.data);
            setInvoices(invoicesRes.data);
        } catch (err) {
            console.error('Error fetching finance data:', err);
        }
    }, []);

    useEffect(() => {
        requestAnimationFrame(() => {
            fetchData();
            if (!hasSeenTutorial('finance')) {
                startTutorial('finance');
            }
        });
    }, [fetchData, hasSeenTutorial, startTutorial]);

    const handleMarkAsPaid = async (id: string) => {
        if (!confirm('Confirmar recebimento deste pagamento?')) return;
        try {
            await api.post(`/finance/invoices/${id}/pay`, { method: 'CASH' });
            fetchData();
        } catch (err) {
            console.error('Error marking invoice as paid:', err);
            alert('Erro ao processar pagamento');
        }
    };

    const filteredInvoices = invoices.filter(inv =>
        inv.member.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="animate-fade-in-up">
            <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-8 mb-10">
                <div className="flex-1">
                    <h1 className="text-4xl md:text-5xl font-black text-slate-900 mb-2 tracking-tighter">
                        Gestão <span className="text-primary">Financeira</span>
                    </h1>
                    <p className="text-slate-500 font-medium max-w-2xl">
                        Acompanhe a saúde financeira da sua academia em tempo real com transparência e precisão.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
                {[
                    { label: 'Renda Mensal', value: stats.monthly_income, color: 'primary', icon: TrendingUp },
                    { label: 'Pendente', value: stats.pending_amount, color: 'blue', icon: Clock },
                    { label: 'Atrasado', value: stats.overdue_amount, color: 'red', icon: AlertCircle },
                ].map((stat, idx) => (
                    <div key={idx} className="bg-white p-6 md:p-8 rounded-3xl md:rounded-[2.5rem] shadow-sm border border-slate-100 flex items-center gap-4 md:gap-6 group hover:shadow-xl transition-all duration-500">
                        <div className={clsx(
                            "w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-[1.5rem] flex items-center justify-center transition-transform group-hover:scale-110",
                            stat.color === 'primary' ? "bg-primary/10 text-primary" :
                                stat.color === 'blue' ? "bg-blue-500/10 text-blue-500" :
                                    "bg-red-500/10 text-red-500"
                        )}>
                            <stat.icon size={24} className="md:w-8 md:h-8" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{stat.label}</p>
                            <h3 className="text-xl md:text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">R$ {stat.value.toLocaleString('pt-BR')}</h3>
                        </div>
                    </div>
                ))}
            </div>

            <div className="bg-white rounded-2xl md:rounded-[3rem] shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-6 md:p-10 border-b border-slate-50 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <h2 className="text-xs font-black text-slate-900 uppercase tracking-widest">Últimas Transações</h2>
                    <div className="relative w-full sm:max-w-md group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar por aluno..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-11 pr-6 py-3.5 bg-slate-50 border border-transparent rounded-2xl focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-medium text-slate-600 shadow-sm"
                        />
                    </div>
                </div>

                {/* Mobile Card List (md:hidden) */}
                <div className="md:hidden divide-y divide-slate-100">
                    {filteredInvoices.length === 0 ? (
                        <div className="p-10 text-center text-slate-400">Nenhum pagamento encontrado</div>
                    ) : (
                        filteredInvoices.map(inv => (
                            <div key={inv.id} className="p-6 space-y-4">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-black text-slate-700">
                                            {inv.member.name.charAt(0)}
                                        </div>
                                        <div>
                                            <h4 className="font-black text-slate-900">{inv.member.name}</h4>
                                            <p className="text-xs text-slate-400 font-bold truncate max-w-[150px]">{inv.description}</p>
                                        </div>
                                    </div>
                                    <div className={clsx(
                                        "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border",
                                        inv.status === 'PAID' ? "bg-green-500/10 text-green-600 border-green-500/20" :
                                            new Date(inv.due_date) < new Date() ? "bg-red-500/10 text-red-600 border-red-500/20" :
                                                "bg-blue-500/10 text-blue-600 border-blue-500/20"
                                    )}>
                                        {inv.status === 'PAID' ? 'Pago' : (new Date(inv.due_date) < new Date() ? 'Atrasado' : 'Pendente')}
                                    </div>
                                </div>

                                <div className="flex items-center justify-between border-t border-slate-50 pt-4">
                                    <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest">
                                        Venc: {new Date(inv.due_date).toLocaleDateString('pt-BR')}
                                    </div>
                                    <div className="text-sm font-black text-slate-700">
                                        R$ {inv.amount.toLocaleString('pt-BR')}
                                    </div>
                                </div>

                                {inv.status !== 'PAID' && (
                                    <button
                                        onClick={() => handleMarkAsPaid(inv.id)}
                                        className="w-full py-3 bg-slate-100 text-primary rounded-xl font-black text-xs uppercase tracking-widest border border-primary/10 active:scale-95 transition-all"
                                    >
                                        Confirmar Pagamento
                                    </button>
                                )}
                                {inv.status === 'PAID' && inv.paid_at && (
                                    <div className="text-center py-2 bg-slate-50 rounded-xl">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Liquidado em {new Date(inv.paid_at).toLocaleDateString()}</p>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>

                {/* Desktop Table (hidden md:block) */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="text-left border-b border-slate-50">
                                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Aluno</th>
                                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Valor</th>
                                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Vencimento</th>
                                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Status</th>
                                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredInvoices.map((inv) => (
                                <tr key={inv.id} className="hover:bg-slate-50/30 transition-colors group">
                                    <td className="px-10 py-6">
                                        <div className="font-black text-slate-900">{inv.member.name}</div>
                                        <div className="text-xs text-slate-400 font-bold">{inv.description}</div>
                                    </td>
                                    <td className="px-10 py-6 font-black text-slate-900 text-sm">
                                        R$ {inv.amount.toLocaleString('pt-BR')}
                                    </td>
                                    <td className="px-10 py-6 text-sm font-bold text-slate-600">
                                        {new Date(inv.due_date).toLocaleDateString('pt-BR')}
                                    </td>
                                    <td className="px-10 py-6">
                                        <span className={clsx(
                                            "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border",
                                            inv.status === 'PAID' ? "bg-green-500/10 text-green-600 border-green-500/20" :
                                                new Date(inv.due_date) < new Date() ? "bg-red-500/10 text-red-600 border-red-500/20" :
                                                    "bg-blue-500/10 text-blue-600 border-blue-500/20"
                                        )}>
                                            {inv.status === 'PAID' ? 'Pago' : (new Date(inv.due_date) < new Date() ? 'Atrasado' : 'Pendente')}
                                        </span>
                                    </td>
                                    <td className="px-10 py-6">
                                        {inv.status !== 'PAID' ? (
                                            <button
                                                onClick={() => handleMarkAsPaid(inv.id)}
                                                className="px-4 py-2.5 bg-white border border-slate-100 rounded-xl text-primary hover:bg-primary hover:text-white transition-all shadow-sm flex items-center justify-center gap-2 mx-auto font-black text-[10px] uppercase"
                                            >
                                                <CheckCircle size={14} />
                                                Pagar
                                            </button>
                                        ) : (
                                            inv.paid_at && <span className="text-[10px] font-black text-slate-300 uppercase tracking-tighter text-center block">Liquidado {new Date(inv.paid_at).toLocaleDateString()}</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
