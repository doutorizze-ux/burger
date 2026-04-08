import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api';
import { Dumbbell, Video, User, CheckCircle2, Trophy } from 'lucide-react';
import { motion } from 'framer-motion';

interface PublicWorkoutData {
    id: string;
    name: string;
    notes: string | null;
    exercises: {
        id: string;
        sets: number | null;
        reps: string | null;
        weight: string | null;
        rest_time: string | null;
        exercise: {
            name: string;
            description: string | null;
            category: string | null;
            video_url: string | null;
        };
    }[];
    member: {
        name: string;
        tenant: {
            name: string;
            primary_color: string;
            logo_url: string | null;
        };
    };
}

export const PublicWorkout = () => {
    const { id } = useParams();
    const [workouts, setWorkouts] = useState<PublicWorkoutData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchWorkout = async () => {
            try {
                const res = await api.get(`/public/workouts/${id}`);
                setWorkouts(res.data);
            } catch (err) {
                console.error('Error fetching workout:', err);
                setError('Treino não encontrado ou expirado.');
            } finally {
                setLoading(false);
            }
        };
        fetchWorkout();
    }, [id]);

    if (loading) return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white text-center">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-6"></div>
            <h2 className="text-xl font-black uppercase tracking-widest">Carregando seu treino...</h2>
            <p className="text-slate-500 mt-2">Prepare os pesos, o foco é total!</p>
        </div>
    );

    if (error || workouts.length === 0) return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white text-center">
            <div className="w-20 h-20 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mb-6">
                <Dumbbell size={40} />
            </div>
            <h2 className="text-2xl font-black uppercase tracking-tight">Ops! Problema na ficha.</h2>
            <p className="text-slate-400 mt-2 max-w-xs">{error || 'Nenhum treino ativo encontrado.'}</p>
        </div>
    );

    const firstWorkout = workouts[0];
    const tenant = firstWorkout.member.tenant;

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col md:pb-12" style={{ '--primary-color': tenant.primary_color } as any}>
            {/* Header / Gym Identity */}
            <header className="bg-slate-900 p-8 pt-12 pb-20 relative overflow-hidden shrink-0">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full -translate-y-1/2 translate-x-1/2 blur-[80px]"></div>
                <div className="relative z-10 flex flex-col items-center text-center">
                    {tenant.logo_url && (
                        <div className="w-20 h-20 bg-white rounded-2xl p-2 mb-4 shadow-xl">
                            <img src={tenant.logo_url} alt={tenant.name} className="w-full h-full object-contain" />
                        </div>
                    )}
                    <h1 className="text-white text-3xl font-black tracking-tight mb-1">{tenant.name}</h1>
                    <div className="flex items-center gap-2 text-primary text-xs font-black uppercase tracking-widest bg-primary/10 px-4 py-2 rounded-full border border-primary/20">
                        <CheckCircle2 size={14} /> Ficha Digital Ativa
                    </div>
                </div>
            </header>

            {/* Member Info Floating Card */}
            <div className="max-w-2xl w-full mx-auto px-6 -mt-10 relative z-20 space-y-6">
                <div className="bg-white rounded-[2.5rem] shadow-2xl p-8 border border-white">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400">
                            <User size={28} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">BOM TREINO,</p>
                            <h2 className="text-2xl font-black text-slate-900 tracking-tight">{firstWorkout.member.name}</h2>
                        </div>
                    </div>
                </div>

                {/* Iterate through workouts */}
                {workouts.map(workout => (
                    <motion.div
                        key={workout.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-4"
                    >
                        <div className="flex items-center justify-between px-2">
                            <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                                <Trophy size={20} className="text-primary" /> {workout.name}
                            </h3>
                            {workout.notes && (
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-200/50 px-3 py-1 rounded-full">
                                    Obs Ativa
                                </span>
                            )}
                        </div>

                        {workout.notes && (
                            <div className="bg-orange-50 border border-orange-100 p-5 rounded-3xl text-orange-900 text-sm font-medium italic whitespace-pre-wrap">
                                " {workout.notes} "
                            </div>
                        )}

                        <div className="space-y-3">
                            {workout.exercises.map((item, idx) => (
                                <div key={item.id} className="bg-white rounded-[1.5rem] p-5 shadow-sm border border-slate-100 group active:scale-[0.98] transition-all">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex gap-4">
                                            <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-300 font-black text-sm shrink-0">
                                                {idx + 1}
                                            </div>
                                            <div>
                                                <h4 className="text-base font-black text-slate-900 leading-tight">{item.exercise.name}</h4>
                                                <p className="text-[10px] font-black text-primary uppercase tracking-widest mt-0.5">{item.exercise.category}</p>
                                            </div>
                                        </div>
                                        {item.exercise.video_url && (
                                            <a
                                                href={item.exercise.video_url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="flex items-center gap-2 bg-red-600 text-white px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-all shadow-lg shadow-red-600/20 shrink-0"
                                            >
                                                <div className="w-6 h-6 bg-white/20 rounded-lg flex items-center justify-center">
                                                    <Video size={14} fill="white" />
                                                </div>
                                                VER VÍDEO
                                            </a>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-4 gap-2 bg-slate-50 p-4 rounded-2xl">
                                        <div className="text-center">
                                            <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Séries</p>
                                            <p className="text-sm font-black text-slate-900">{item.sets || '-'}</p>
                                        </div>
                                        <div className="text-center border-l border-slate-200">
                                            <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Reps</p>
                                            <p className="text-sm font-black text-slate-900">{item.reps || '-'}</p>
                                        </div>
                                        <div className="text-center border-l border-slate-200">
                                            <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Peso</p>
                                            <p className="text-sm font-black text-slate-900">{item.weight || '-'}</p>
                                        </div>
                                        <div className="text-center border-l border-slate-200">
                                            <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Rest</p>
                                            <p className="text-sm font-black text-slate-900">{item.rest_time || '-'}</p>
                                        </div>
                                    </div>

                                    {item.exercise.description && (
                                        <p className="text-xs font-medium text-slate-500 mt-4 px-1 border-t border-slate-50 pt-3 italic">
                                            {item.exercise.description}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Footer */}
            <footer className="mt-auto py-12 flex flex-col items-center">
                <div className="flex items-center gap-2 opacity-30 grayscale mb-1">
                    <Dumbbell size={16} />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">ZapFitness Power</span>
                </div>
                <p className="text-[9px] text-slate-400 font-medium">Digital Workout Sheet Protocol v1.0</p>
            </footer>
        </div>
    );
};
