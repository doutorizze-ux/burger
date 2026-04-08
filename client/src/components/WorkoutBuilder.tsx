import React, { useEffect, useState } from 'react';
import api from '../api';
import { Plus, Trash2, Search, Dumbbell, Save, Pencil, Clock } from 'lucide-react';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';

interface Exercise {
    id: string;
    name: string;
    category: string;
}

interface WorkoutExercise {
    id?: string;
    exercise_id: string;
    exercise: Exercise;
    sets: number;
    reps: string;
    weight: string;
    rest_time: string;
    order: number;
}

interface Workout {
    id?: string;
    name: string;
    notes: string;
    exercises: WorkoutExercise[];
    active: boolean;
}

interface WorkoutBuilderProps {
    memberId: string;
    onSaveSuccess?: () => void;
}

export const WorkoutBuilder: React.FC<WorkoutBuilderProps> = ({ memberId, onSaveSuccess }) => {
    const [workouts, setWorkouts] = useState<Workout[]>([]);
    const [availableExercises, setAvailableExercises] = useState<Exercise[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingWorkout, setEditingWorkout] = useState<Workout | null>(null);
    const [showExerciseSearch, setShowExerciseSearch] = useState(false);
    const [search, setSearch] = useState('');

    useEffect(() => {
        fetchData();
    }, [memberId]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [workoutsRes, exercisesRes] = await Promise.all([
                api.get(`/members/${memberId}/workouts`),
                api.get('/exercises')
            ]);
            setWorkouts(workoutsRes.data);
            setAvailableExercises(exercisesRes.data);
        } catch (err) {
            console.error('Error fetching workout data:', err);
            toast.error('Erro ao carregar treinos');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateNew = () => {
        setEditingWorkout({
            name: `Treino ${String.fromCharCode(65 + workouts.length)}`, // Treino A, B, C...
            notes: '',
            exercises: [],
            active: true
        });
    };

    const handleAddExercise = (exercise: Exercise) => {
        if (!editingWorkout) return;

        const newEx: WorkoutExercise = {
            exercise_id: exercise.id,
            exercise: exercise,
            sets: 3,
            reps: '12',
            weight: '',
            rest_time: '60s',
            order: editingWorkout.exercises.length
        };

        setEditingWorkout({
            ...editingWorkout,
            exercises: [...editingWorkout.exercises, newEx]
        });
        setShowExerciseSearch(false);
        setSearch('');
    };

    const removeExercise = (index: number) => {
        if (!editingWorkout) return;
        const newExercises = [...editingWorkout.exercises];
        newExercises.splice(index, 1);
        setEditingWorkout({ ...editingWorkout, exercises: newExercises });
    };

    const updateExercise = (index: number, field: keyof WorkoutExercise, value: any) => {
        if (!editingWorkout) return;
        const newExercises = [...editingWorkout.exercises];
        newExercises[index] = { ...newExercises[index], [field]: value };
        setEditingWorkout({ ...editingWorkout, exercises: newExercises });
    };

    const handleSave = async () => {
        if (!editingWorkout) return;
        if (!editingWorkout.name) return toast.warning('Dê um nome ao treino');

        try {
            await api.post(`/members/${memberId}/workouts`, editingWorkout);
            toast.success('Treino salvo com sucesso!');
            setEditingWorkout(null);
            fetchData();
            if (onSaveSuccess) onSaveSuccess();
        } catch (err) {
            console.error('Error saving workout:', err);
            toast.error('Erro ao salvar treino');
        }
    };

    const handleDeleteWorkout = async (workoutId: string) => {
        if (!window.confirm('Deseja realmente excluir este treino?')) return;
        try {
            await api.delete(`/workouts/${workoutId}`);
            toast.success('Treino excluído!');
            fetchData();
        } catch (err) {
            console.error('Error deleting workout:', err);
            toast.error('Erro ao excluir treino');
        }
    };

    const filteredExercises = availableExercises.filter(ex =>
        ex.name.toLowerCase().includes(search.toLowerCase()) ||
        ex.category.toLowerCase().includes(search.toLowerCase())
    );

    if (loading) return (
        <div className="flex justify-center p-10">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
    );

    return (
        <div className="flex flex-col h-full bg-slate-50/50 rounded-3xl overflow-hidden border border-slate-100">
            {editingWorkout ? (
                <div className="flex flex-col h-full bg-white animate-fade-in">
                    {/* Editor Header */}
                    <div className="px-6 py-4 bg-white border-b border-slate-100 flex justify-between items-center sticky top-0 z-10">
                        <div className="flex-1 mr-4">
                            <input
                                className="text-lg font-black text-slate-900 border-none p-0 focus:ring-0 w-full"
                                value={editingWorkout.name}
                                onChange={e => setEditingWorkout({ ...editingWorkout, name: e.target.value })}
                                placeholder="Nome do Treino (ex: Treino A)"
                            />
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => setEditingWorkout(null)} className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest">
                                Cancelar
                            </button>
                            <button onClick={handleSave} className="px-6 py-2 bg-primary text-white text-xs font-black rounded-xl shadow-lg shadow-primary/20 flex items-center gap-2 hover:scale-105 transition-all">
                                <Save size={16} /> SALVAR
                            </button>
                        </div>
                    </div>

                    {/* Exercises List */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {editingWorkout.exercises.length === 0 ? (
                            <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-3xl">
                                <Dumbbell size={32} className="mx-auto text-slate-200 mb-3" />
                                <p className="text-slate-400 text-sm font-medium">Nenhum exercício adicionado.</p>
                            </div>
                        ) : (
                            editingWorkout.exercises.map((ex, idx) => (
                                <div key={idx} className="bg-slate-50 rounded-2xl p-4 border border-slate-100 group transition-all">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-slate-400 font-black text-xs border border-slate-100">
                                                {idx + 1}
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-black text-slate-800">{ex.exercise.name}</h4>
                                                <span className="text-[10px] font-black text-primary uppercase tracking-widest">{ex.exercise.category}</span>
                                            </div>
                                        </div>
                                        <button onClick={() => removeExercise(idx)} className="p-2 text-slate-300 hover:text-red-500 transition-colors">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-4 gap-3">
                                        <div>
                                            <label className="text-[9px] font-black text-slate-400 uppercase mb-1 block">Séries</label>
                                            <input
                                                type="number"
                                                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold text-center focus:ring-2 focus:ring-primary/20 outline-none"
                                                value={ex.sets}
                                                onChange={e => updateExercise(idx, 'sets', parseInt(e.target.value))}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-black text-slate-400 uppercase mb-1 block">Reps</label>
                                            <input
                                                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold text-center focus:ring-2 focus:ring-primary/20 outline-none"
                                                value={ex.reps}
                                                onChange={e => updateExercise(idx, 'reps', e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-black text-slate-400 uppercase mb-1 block">Carga</label>
                                            <input
                                                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold text-center focus:ring-2 focus:ring-primary/20 outline-none"
                                                placeholder="Kg"
                                                value={ex.weight}
                                                onChange={e => updateExercise(idx, 'weight', e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-black text-slate-400 uppercase mb-1 block">Descanso</label>
                                            <input
                                                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold text-center focus:ring-2 focus:ring-primary/20 outline-none"
                                                value={ex.rest_time}
                                                onChange={e => updateExercise(idx, 'rest_time', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}

                        <button
                            onClick={() => setShowExerciseSearch(true)}
                            className="w-full py-4 border-2 border-dashed border-primary/20 rounded-2xl text-primary font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-primary/5 transition-all"
                        >
                            <Plus size={16} strokeWidth={3} /> ADICIONAR EXERCÍCIO
                        </button>
                    </div>

                    {/* Exercise Search Overlay */}
                    <AnimatePresence>
                        {showExerciseSearch && (
                            <motion.div
                                initial={{ opacity: 0, y: 100 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 100 }}
                                className="absolute inset-0 bg-white z-20 flex flex-col"
                            >
                                <div className="p-4 border-b border-slate-100 flex gap-3 items-center">
                                    <div className="relative flex-1">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                                        <input
                                            autoFocus
                                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary/20"
                                            placeholder="Buscar exercício..."
                                            value={search}
                                            onChange={e => setSearch(e.target.value)}
                                        />
                                    </div>
                                    <button onClick={() => setShowExerciseSearch(false)} className="text-xs font-bold text-slate-400 uppercase">Fechar</button>
                                </div>
                                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                                    {filteredExercises.map(ex => (
                                        <button
                                            key={ex.id}
                                            onClick={() => handleAddExercise(ex)}
                                            className="w-full p-4 flex items-center justify-between hover:bg-slate-50 rounded-xl transition-colors text-left"
                                        >
                                            <div>
                                                <div className="text-sm font-black text-slate-800">{ex.name}</div>
                                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{ex.category}</div>
                                            </div>
                                            <Plus size={16} className="text-primary" />
                                        </button>
                                    ))}
                                    {availableExercises.length === 0 && (
                                        <div className="p-8 text-center">
                                            <p className="text-sm text-slate-400 mb-2">Sua biblioteca está vazia.</p>
                                            <a href="/dashboard/exercises" className="text-xs font-black text-primary uppercase underline">Cadastrar Exercícios</a>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            ) : (
                <div className="p-6 space-y-4">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Treinos Digitais</h3>
                        <button onClick={handleCreateNew} className="text-xs font-black text-primary uppercase tracking-widest flex items-center gap-1 hover:underline">
                            <Plus size={14} strokeWidth={3} /> Gerar Novo
                        </button>
                    </div>

                    <div className="space-y-3">
                        {workouts.length === 0 ? (
                            <div className="bg-white rounded-2xl p-8 border-2 border-dashed border-slate-100 text-center">
                                <Clock size={24} className="mx-auto text-slate-200 mb-2" />
                                <p className="text-xs text-slate-400 font-medium">Nenhum treino digital ainda.</p>
                            </div>
                        ) : (
                            workouts.map(w => (
                                <div key={w.id} className="bg-white rounded-2xl p-4 border border-slate-100 flex justify-between items-center group hover:border-primary/30 transition-all cursor-pointer" onClick={() => setEditingWorkout(w)}>
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                                            <Dumbbell size={20} />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-black text-slate-800">{w.name}</h4>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{w.exercises.length} Exercícios</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {!w.active && <span className="px-2 py-0.5 bg-slate-100 text-slate-400 text-[10px] font-black uppercase rounded-lg">Inativo</span>}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setEditingWorkout(w);
                                            }}
                                            className="p-2 text-slate-300 hover:text-primary transition-colors"
                                        >
                                            <Pencil size={16} />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (w.id) handleDeleteWorkout(w.id);
                                            }}
                                            className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="pt-4 border-t border-slate-100">
                        <p className="text-[10px] text-slate-400 font-medium leading-relaxed italic">
                            * O treino digital gera um link interativo que pode ser aberto no celular do aluno para acompanhar as séries e ver vídeos.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};
