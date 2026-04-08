import React, { useEffect, useState } from 'react';
import api from '../api';
import { Plus, Search, Pencil, Trash2, Dumbbell, Video, LayoutGrid, List } from 'lucide-react';
import { toast } from 'react-toastify';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

interface Exercise {
    id: string;
    name: string;
    description: string | null;
    category: string | null;
    video_url: string | null;
}

const CATEGORIES = [
    'Peito', 'Costas', 'Pernas', 'Ombros', 'Braços', 'Abdômen', 'Cardio', 'Outros'
];

export const Exercises = () => {
    const [exercises, setExercises] = useState<Exercise[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterCategory, setFilterCategory] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [showModal, setShowModal] = useState(false);
    const [editingExercise, setEditingExercise] = useState<Partial<Exercise> | null>(null);

    useEffect(() => {
        fetchExercises();
    }, []);

    const fetchExercises = async () => {
        try {
            setLoading(true);
            const res = await api.get('/exercises');
            setExercises(res.data);
        } catch (err) {
            console.error('Error fetching exercises:', err);
            toast.error('Erro ao carregar exercícios');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.post('/exercises', editingExercise);
            toast.success(editingExercise?.id ? 'Exercício atualizado' : 'Exercício criado');
            setShowModal(false);
            setEditingExercise(null);
            fetchExercises();
        } catch (err) {
            console.error('Error saving exercise:', err);
            toast.error('Erro ao salvar exercício');
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Excluir este exercício?')) return;
        try {
            await api.delete(`/exercises/${id}`);
            toast.success('Exercício removido');
            fetchExercises();
        } catch (err) {
            console.error('Error deleting exercise:', err);
            toast.error('Erro ao excluir exercício');
        }
    };

    const filtered = exercises.filter(ex => {
        const matchesSearch = ex.name.toLowerCase().includes(search.toLowerCase()) ||
            ex.description?.toLowerCase().includes(search.toLowerCase());
        const matchesCategory = !filterCategory || ex.category === filterCategory;
        return matchesSearch && matchesCategory;
    });

    return (
        <div className="p-6 md:p-10 max-w-7xl mx-auto animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-6 mb-12">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">Biblioteca de Exercícios</h1>
                    <p className="text-slate-500 font-medium">Gerencie o catálogo de exercícios da sua academia.</p>
                </div>
                <button
                    onClick={() => { setEditingExercise({ name: '', category: 'Peito' }); setShowModal(true); }}
                    className="flex items-center justify-center gap-2 px-8 py-4 bg-primary text-white rounded-2xl font-black shadow-xl shadow-primary/25 hover:scale-105 active:scale-95 transition-all text-sm uppercase tracking-widest"
                >
                    <Plus size={20} strokeWidth={3} />
                    ADICIONAR EXERCÍCIO
                </button>
            </div>

            {/* Controls */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
                <div className="lg:col-span-5 relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={20} />
                    <input
                        type="text"
                        placeholder="Buscar por nome ou descrição..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-12 pr-6 py-4 bg-white border border-slate-200 rounded-2xl font-medium focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all shadow-sm"
                    />
                </div>

                <div className="lg:col-span-4 flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                    <button
                        onClick={() => setFilterCategory(null)}
                        className={clsx(
                            "px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all border",
                            !filterCategory ? "bg-slate-900 text-white border-slate-900 shadow-lg" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                        )}
                    >
                        Todos
                    </button>
                    {CATEGORIES.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setFilterCategory(cat)}
                            className={clsx(
                                "px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all border",
                                filterCategory === cat ? "bg-primary text-white border-primary shadow-lg shadow-primary/20" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                            )}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                <div className="lg:col-span-3 flex justify-end gap-2">
                    <button
                        onClick={() => setViewMode('grid')}
                        className={clsx("p-4 rounded-xl border transition-all", viewMode === 'grid' ? "bg-white border-primary text-primary shadow-sm" : "bg-white border-slate-200 text-slate-400 hover:bg-slate-50")}
                    >
                        <LayoutGrid size={20} />
                    </button>
                    <button
                        onClick={() => setViewMode('list')}
                        className={clsx("p-4 rounded-xl border transition-all", viewMode === 'list' ? "bg-white border-primary text-primary shadow-sm" : "bg-white border-slate-200 text-slate-400 hover:bg-slate-50")}
                    >
                        <List size={20} />
                    </button>
                </div>
            </div>

            {/* List/Grid */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-slate-400 font-bold uppercase tracking-widest text-xs">Carregando catálogo...</span>
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-[3rem] border-2 border-dashed border-slate-100">
                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
                        <Dumbbell size={40} />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 mb-2">Nenhum exercício encontrado</h3>
                    <p className="text-slate-500">Tente mudar os filtros ou adicione um novo exercício.</p>
                </div>
            ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filtered.map(ex => (
                        <motion.div
                            layout
                            key={ex.id}
                            className="bg-white rounded-[2rem] border border-slate-100 p-6 hover:shadow-2xl hover:shadow-slate-200/50 transition-all group"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-slate-50 rounded-2xl text-slate-400 group-hover:text-primary group-hover:bg-primary/10 transition-colors">
                                    <Dumbbell size={24} />
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => { setEditingExercise(ex); setShowModal(true); }} className="p-2 hover:bg-blue-50 text-blue-500 rounded-lg transition">
                                        <Pencil size={18} />
                                    </button>
                                    <button onClick={() => handleDelete(ex.id)} className="p-2 hover:bg-red-50 text-red-500 rounded-lg transition">
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                            <h3 className="text-lg font-black text-slate-900 mb-1">{ex.name}</h3>
                            <span className="inline-block px-3 py-1 bg-slate-100 text-slate-500 text-[10px] font-black uppercase tracking-widest rounded-full mb-3">
                                {ex.category}
                            </span>
                            <p className="text-slate-500 text-sm line-clamp-2 min-h-[2.5rem] mb-4">
                                {ex.description || 'Sem descrição cadastrada.'}
                            </p>
                            {ex.video_url && (
                                <a href={ex.video_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-primary text-xs font-black uppercase tracking-widest hover:gap-3 transition-all">
                                    <Video size={16} /> Ver Execução
                                </a>
                            )}
                        </motion.div>
                    ))}
                </div>
            ) : (
                <div className="bg-white rounded-[2.5rem] border border-slate-100 overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-100">
                            <tr>
                                <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Exercício</th>
                                <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Categoria</th>
                                <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Mídia</th>
                                <th className="px-8 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filtered.map(ex => (
                                <tr key={ex.id} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="px-8 py-5">
                                        <div className="font-black text-slate-900">{ex.name}</div>
                                        <div className="text-xs text-slate-400 line-clamp-1">{ex.description}</div>
                                    </td>
                                    <td className="px-8 py-5">
                                        <span className="px-3 py-1 bg-slate-100 text-slate-500 text-[10px] font-black uppercase tracking-widest rounded-full ">
                                            {ex.category}
                                        </span>
                                    </td>
                                    <td className="px-8 py-5">
                                        {ex.video_url ? (
                                            <Video size={20} className="text-primary" />
                                        ) : (
                                            <Video size={20} className="text-slate-200" />
                                        )}
                                    </td>
                                    <td className="px-8 py-5 text-right">
                                        <div className="flex gap-2 justify-end">
                                            <button onClick={() => { setEditingExercise(ex); setShowModal(true); }} className="p-2 text-slate-400 hover:text-blue-500 transition">
                                                <Pencil size={20} />
                                            </button>
                                            <button onClick={() => handleDelete(ex.id)} className="p-2 text-slate-400 hover:text-red-500 transition">
                                                <Trash2 size={20} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modal */}
            <AnimatePresence>
                {showModal && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden"
                        >
                            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center">
                                <h3 className="text-xl font-black text-slate-900">{editingExercise?.id ? 'Editar Exercício' : 'Novo Exercício'}</h3>
                                <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 transition">
                                    <LayoutGrid size={24} />
                                </button>
                            </div>

                            <form onSubmit={handleSave} className="p-8 space-y-6">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Nome do Exercício</label>
                                    <input
                                        required
                                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 focus:bg-white focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-bold text-slate-800"
                                        value={editingExercise?.name || ''}
                                        onChange={e => setEditingExercise({ ...editingExercise, name: e.target.value })}
                                        placeholder="Ex: Supino Reto com Barra"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Categoria</label>
                                    <select
                                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 focus:bg-white focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-bold text-slate-800 appearance-none"
                                        value={editingExercise?.category || 'Peito'}
                                        onChange={e => setEditingExercise({ ...editingExercise, category: e.target.value })}
                                    >
                                        {CATEGORIES.map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Descrição / Dicas (Opcional)</label>
                                    <textarea
                                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 focus:bg-white focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-bold text-slate-800 resize-none h-24"
                                        value={editingExercise?.description || ''}
                                        onChange={e => setEditingExercise({ ...editingExercise, description: e.target.value })}
                                        placeholder="Instruções de segurança ou execução..."
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">URL do Vídeo (Youtube/MP4)</label>
                                    <div className="relative">
                                        <Video className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                                        <input
                                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 pl-12 focus:bg-white focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-bold text-slate-800"
                                            value={editingExercise?.video_url || ''}
                                            onChange={e => setEditingExercise({ ...editingExercise, video_url: e.target.value })}
                                            placeholder="https://youtube.com/..."
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    className="w-full bg-primary text-white py-5 rounded-[2rem] font-black shadow-xl shadow-primary/25 hover:scale-[1.02] active:scale-95 transition-all text-sm uppercase tracking-widest"
                                >
                                    SALVAR EXERCÍCIO
                                </button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};
