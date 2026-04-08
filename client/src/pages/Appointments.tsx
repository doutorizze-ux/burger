import { useState, useEffect, useCallback } from 'react';
import api from '../api';
import {
    Plus,
    Clock,
    XCircle,
    Trash2,
    ChevronLeft,
    ChevronRight,
    Search,
    Repeat,
    CalendarDays
} from 'lucide-react';
import clsx from 'clsx';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const DAYS_OF_WEEK = [
    'Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'
];

interface AppointmentMember {
    id: string;
    name: string;
    phone: string;
}

interface Appointment {
    id: string;
    member_id: string;
    member?: AppointmentMember;
    dateTime?: string;
    start_time?: string;
    day_of_week?: number;
    type: string;
    isFixed: boolean;
}

export const Appointments = () => {
    const [viewMode, setViewMode] = useState<'daily' | 'fixed'>('daily');
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [schedules, setSchedules] = useState<Appointment[]>([]);
    const [members, setMembers] = useState<AppointmentMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [showModal, setShowModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Form states
    const [formData, setFormData] = useState({
        member_id: '',
        time: '08:00',
        type: 'TREINO',
        day_of_week: selectedDate.getDay(),
        isRecurring: true
    });

    const fetchDailyData = useCallback(async () => {
        setLoading(true);
        try {
            const dateStr = format(selectedDate, 'yyyy-MM-dd');
            const dayOfWeek = selectedDate.getDay();

            const [appRes, schRes] = await Promise.all([
                api.get(`/appointments?date=${dateStr}`),
                api.get(`/schedules?day=${dayOfWeek}`)
            ]);

            const merged: Appointment[] = [
                ...appRes.data.map((a: Record<string, unknown>) => ({ ...a, isFixed: false })),
                ...schRes.data.map((s: Record<string, unknown>) => ({ ...s, isFixed: true, dateTime: format(selectedDate, 'yyyy-MM-dd') + 'T' + (s as { start_time: string }).start_time }))
            ].sort((a, b) => {
                const getSortTime = (item: Appointment) => {
                    if (item.isFixed) return item.start_time || '00:00';
                    if (!item.dateTime) return '00:00';
                    try {
                        return format(new Date(item.dateTime), 'HH:mm');
                    } catch {
                        return '00:00';
                    }
                };
                return getSortTime(a).localeCompare(getSortTime(b));
            });

            setAppointments(merged);
        } catch (err) {
            console.error('Error fetching daily data:', err);
        } finally {
            setLoading(false);
        }
    }, [selectedDate]);

    const fetchFixedSchedules = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/schedules');
            setSchedules(res.data.map((s: Record<string, unknown>) => ({ ...s, isFixed: true } as Appointment)));
        } catch (err) {
            console.error('Error fetching fixed schedules:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchMembers = useCallback(async () => {
        try {
            const res = await api.get('/members');
            setMembers(res.data);
        } catch (err) {
            console.error('Error fetching members:', err);
        }
    }, []);

    useEffect(() => {
        if (viewMode === 'daily') {
            fetchDailyData();
        } else {
            fetchFixedSchedules();
        }
        fetchMembers();
    }, [selectedDate, viewMode, fetchDailyData, fetchFixedSchedules, fetchMembers]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (formData.isRecurring) {
                await api.post('/schedules', {
                    member_id: formData.member_id,
                    day_of_week: formData.day_of_week,
                    start_time: formData.time,
                    type: formData.type
                });
            } else {
                const [hours, minutes] = formData.time.split(':');
                const dateTime = new Date(selectedDate);
                dateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

                await api.post('/appointments', {
                    member_id: formData.member_id,
                    dateTime,
                    type: formData.type,
                    notes: 'Agendamento pontual'
                });
            }
            setShowModal(false);
            setFormData({ ...formData, member_id: '' });
            if (viewMode === 'daily') fetchDailyData(); else fetchFixedSchedules();
        } catch (err) {
            console.error('Error creating appointment:', err);
            alert('Erro ao criar agendamento');
        }
    };

    const handleDelete = async (id: string, isFixed: boolean) => {
        if (!confirm('Excluir este agendamento?')) return;
        try {
            if (isFixed) {
                await api.delete(`/schedules/${id}`);
            } else {
                await api.delete(`/appointments/${id}`);
            }
            if (viewMode === 'daily') fetchDailyData(); else fetchFixedSchedules();
        } catch (err) {
            console.error('Error deleting appointment:', err);
            alert('Erro ao excluir');
        }
    };

    const filteredMembers = members.filter(m =>
        m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.phone.includes(searchTerm)
    );

    return (
        <div className="animate-fade-in-up">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-10">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 mb-2 tracking-tighter">Agenda de Horários</h1>
                    <p className="text-slate-500 font-medium pb-2">Gerencie os compromissos e treinos da sua academia.</p>
                </div>

                <div className="flex items-center gap-2 bg-white p-2 rounded-[2rem] shadow-sm border border-slate-100">
                    <button
                        onClick={() => setViewMode('daily')}
                        className={clsx(
                            "px-8 py-4 rounded-[1.5rem] font-black transition-all flex items-center gap-3 text-xs uppercase tracking-widest",
                            viewMode === 'daily' ? "bg-primary text-white shadow-xl shadow-primary/30" : "text-slate-400 hover:text-slate-600"
                        )}
                    >
                        <CalendarDays size={18} />
                        DIÁRIO
                    </button>
                    <button
                        onClick={() => setViewMode('fixed')}
                        className={clsx(
                            "px-8 py-4 rounded-[1.5rem] font-black transition-all flex items-center gap-3 text-xs uppercase tracking-widest",
                            viewMode === 'fixed' ? "bg-primary text-white shadow-xl shadow-primary/30" : "text-slate-400 hover:text-slate-600"
                        )}
                    >
                        <Repeat size={18} />
                        HORÁRIOS FIXOS
                    </button>
                </div>
            </div>

            {viewMode === 'daily' && (
                <div className="bg-white rounded-[3rem] p-6 shadow-sm border border-slate-100 mb-8 flex items-center justify-between">
                    <button onClick={() => setSelectedDate(addDays(selectedDate, -1))} className="p-4 hover:bg-slate-50 rounded-2xl text-slate-300 hover:text-primary transition-all">
                        <ChevronLeft size={32} />
                    </button>
                    <div className="text-center">
                        <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em] mb-2 leading-none">
                            {format(selectedDate, 'eeee', { locale: ptBR })}
                        </p>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tighter">
                            {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
                        </h2>
                    </div>
                    <button onClick={() => setSelectedDate(addDays(selectedDate, 1))} className="p-4 hover:bg-slate-50 rounded-2xl text-slate-300 hover:text-primary transition-all">
                        <ChevronRight size={32} />
                    </button>
                </div>
            )}

            <button
                onClick={() => setShowModal(true)}
                className="w-full mb-12 bg-primary text-white p-7 rounded-[2.5rem] font-black hover:opacity-90 transition-all shadow-2xl shadow-primary/20 flex items-center justify-center gap-4 active:scale-[0.98] text-sm uppercase tracking-widest"
            >
                <Plus size={24} />
                {viewMode === 'daily' ? 'ADICIONAR NOVO COMPROMISSO' : 'CADASTRAR NOVO HORÁRIO RECORRENTE'}
            </button>

            {/* List */}
            <div className="space-y-4">
                {loading ? (
                    <div className="bg-white rounded-[2rem] p-12 flex flex-col items-center justify-center border border-slate-100">
                        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4" />
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Carregando...</p>
                    </div>
                ) : (viewMode === 'daily' ? appointments : schedules).length === 0 ? (
                    <div className="bg-white rounded-[3rem] p-16 text-center border border-slate-100">
                        <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-6 text-slate-200">
                            {viewMode === 'daily' ? <CalendarDays size={40} /> : <Repeat size={40} />}
                        </div>
                        <h3 className="text-xl font-black text-slate-900 mb-2">Nada por aqui</h3>
                        <p className="text-slate-500 max-w-xs mx-auto">Comece a organizar os treinos clicando no botão acima.</p>
                    </div>
                ) : (
                    (viewMode === 'daily' ? appointments : schedules).map((item) => (
                        <div key={item.id} className="group bg-white rounded-[3rem] p-8 border border-slate-100 shadow-sm hover:shadow-2xl hover:shadow-slate-200/50 transition-all flex flex-col md:flex-row md:items-center gap-10 overflow-hidden relative">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-bl-[4rem] -z-10 transition-colors group-hover:bg-primary/5"></div>

                            <div className="flex items-center gap-6">
                                <div className="w-20 h-20 rounded-[2rem] bg-slate-950 flex flex-col items-center justify-center text-white shadow-2xl relative">
                                    <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary animate-pulse"></div>
                                    <Clock size={16} className="text-primary mb-1" />
                                    <span className="font-black text-base tracking-tighter">
                                        {item.isFixed ? item.start_time : (item.dateTime && !isNaN(new Date(item.dateTime).getTime()) ? format(new Date(item.dateTime), 'HH:mm') : '--:--')}
                                    </span>
                                </div>
                                <div className="md:hidden flex-1">
                                    <h4 className="font-black text-xl text-slate-900">{item.member?.name || 'Membro não encontrado'}</h4>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-[10px] font-black text-primary uppercase tracking-widest">{item.type}</span>
                                        {item.isFixed && <Repeat size={14} className="text-slate-300" />}
                                    </div>
                                </div>
                            </div>

                            <div className="hidden md:block flex-1 min-w-0">
                                <div className="flex items-center gap-3 mb-1">
                                    <h4 className="font-black text-2xl text-slate-900 truncate">{item.member?.name || 'Membro não encontrado'}</h4>
                                    <div className="flex items-center gap-2">
                                        <span className={clsx(
                                            "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest",
                                            item.type === 'TREINO' ? 'bg-blue-50 text-blue-500' :
                                                item.type === 'AVALIAÇÃO' ? 'bg-purple-50 text-purple-500' : 'bg-primary/10 text-primary'
                                        )}>
                                            {item.type}
                                        </span>
                                        {item.isFixed ? (
                                            <span className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                                                <Repeat size={12} />
                                                Recorrente ({item.day_of_week !== undefined ? DAYS_OF_WEEK[item.day_of_week] : '-'})
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-amber-50 text-amber-500 text-[10px] font-black uppercase tracking-widest">
                                                Eventual
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <p className="text-slate-400 font-medium flex items-center gap-2">
                                    <User size={14} />
                                    {item.member?.phone || 'Telefone não disponível'}
                                </p>
                            </div>

                            <button
                                onClick={() => handleDelete(item.id, item.isFixed)}
                                className="p-4 bg-slate-50 text-slate-300 rounded-2xl hover:bg-red-50 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"
                            >
                                <Trash2 size={24} />
                            </button>
                        </div>
                    ))
                )}
            </div>

            {/* Modal */}
            {
                showModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowModal(false)} />
                        <div className="bg-white w-full max-w-2xl rounded-[3rem] p-8 md:p-12 shadow-2xl relative z-10 animate-fade-in-up">
                            <div className="flex items-center justify-between mb-10">
                                <div>
                                    <h3 className="text-3xl font-black text-slate-900 tracking-tight">Novo Agendamento</h3>
                                    <p className="text-slate-500 font-medium text-lg italic">Defina o compromisso do aluno.</p>
                                </div>
                                <button onClick={() => setShowModal(false)} className="p-3 hover:bg-slate-100 rounded-2xl transition-colors">
                                    <XCircle size={32} className="text-slate-300" />
                                </button>
                            </div>

                            <form onSubmit={handleCreate} className="space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-6">
                                        <div>
                                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 block">Tipo de Agendamento</label>
                                            <div className="grid grid-cols-2 gap-3">
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, isRecurring: true })}
                                                    className={clsx(
                                                        "p-4 rounded-2xl font-black text-xs transition-all flex flex-col items-center gap-2 border-2",
                                                        formData.isRecurring ? "bg-primary border-primary text-white" : "bg-white border-slate-100 text-slate-400"
                                                    )}
                                                >
                                                    <Repeat size={20} />
                                                    FIXO / RECORRENTE
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, isRecurring: false })}
                                                    className={clsx(
                                                        "p-4 rounded-2xl font-black text-xs transition-all flex flex-col items-center gap-2 border-2",
                                                        !formData.isRecurring ? "bg-primary border-primary text-white" : "bg-white border-slate-100 text-slate-400"
                                                    )}
                                                >
                                                    <CalendarDays size={20} />
                                                    EVENTUAL / ÚNICO
                                                </button>
                                            </div>
                                        </div>

                                        {formData.isRecurring && (
                                            <div>
                                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 block">Dia da Semana</label>
                                                <select
                                                    value={formData.day_of_week}
                                                    onChange={(e) => setFormData({ ...formData, day_of_week: parseInt(e.target.value) })}
                                                    className="w-full bg-slate-50 border-none rounded-2xl p-5 font-black text-slate-900 focus:ring-2 focus:ring-primary transition-all appearance-none"
                                                >
                                                    {DAYS_OF_WEEK.map((day, i) => (
                                                        <option key={i} value={i}>{day}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 block">Horário</label>
                                                <input
                                                    type="time"
                                                    value={formData.time}
                                                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                                                    className="w-full bg-slate-50 border-none rounded-2xl p-5 font-black text-slate-900 focus:ring-2 focus:ring-primary transition-all"
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 block">Atividade</label>
                                                <select
                                                    value={formData.type}
                                                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                                    className="w-full bg-slate-50 border-none rounded-2xl p-5 font-black text-slate-900 focus:ring-2 focus:ring-primary transition-all appearance-none"
                                                >
                                                    <option value="TREINO">TREINO</option>
                                                    <option value="AVALIAÇÃO">AVALIAÇÃO</option>
                                                    <option value="PERSONAL">PERSONAL</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 block">Buscar Aluno</label>
                                        <div className="relative mb-4">
                                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                            <input
                                                type="text"
                                                placeholder="Nome ou telefone..."
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                className="w-full bg-slate-50 border-none rounded-2xl pl-12 pr-4 py-5 font-black text-slate-900 focus:ring-2 focus:ring-primary transition-all"
                                            />
                                        </div>
                                        <div className="max-h-60 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                                            {filteredMembers.map(m => (
                                                <button
                                                    key={m.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setFormData({ ...formData, member_id: m.id });
                                                        setSearchTerm(m.name);
                                                    }}
                                                    className={clsx(
                                                        "w-full text-left p-4 rounded-2xl font-bold transition-all border-4",
                                                        formData.member_id === m.id ? "bg-primary/5 border-primary text-primary" : "bg-white border-slate-50 text-slate-500 hover:border-slate-100"
                                                    )}
                                                >
                                                    {m.name}
                                                    <span className="block text-[10px] text-slate-400 uppercase tracking-widest mt-1">{m.phone}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={!formData.member_id}
                                    className="w-full bg-primary text-white py-6 rounded-[2rem] font-black text-xl shadow-2xl shadow-primary/30 hover:opacity-90 transition-all disabled:opacity-50 active:scale-95"
                                >
                                    CONFIRMAR AGENDAMENTO
                                </button>
                            </form>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

const User = ({ size, className = '' }: { size: number, className?: string }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
)
