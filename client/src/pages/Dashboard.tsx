
import React from 'react';
import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTutorial } from '../contexts/TutorialContext';
import { LayoutDashboard, Users, Activity, Settings, Zap, Bell, Cpu, CreditCard, HelpCircle, MoreHorizontal, Calendar, TrendingUp, Sparkles, Brain, AlertCircle, MessageSquare, LogOut } from 'lucide-react';
import { WhatsAppConnect } from './WhatsAppConnect';
import { Turnstiles } from './Turnstiles';
import { Finance } from './Finance';
import { Members } from './Members';
import { Plans } from './Plans';
import { AccessLogs } from './AccessLogs';
import { ProfileSettings } from './ProfileSettings';
import { Appointments } from './Appointments';
import { Exercises } from './Exercises';
import { Chat } from './Chat';

import clsx from 'clsx';
import api from '../api';
import { formatImageUrl } from '../utils/format';
import { NotificationHandler } from '../components/NotificationHandler';

export const Dashboard = () => {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const { startTutorial, hasSeenTutorial } = useTutorial();
    const [systemSettings, setSystemSettings] = React.useState({ site_name: 'ZapFitness', logo_url: '' });

    React.useEffect(() => {
        // Start the general dashboard tutorial if not seen
        requestAnimationFrame(() => {
            if (!hasSeenTutorial('dashboard')) {
                startTutorial('dashboard');
            }
        });
        api.get('/system/settings').then(res => setSystemSettings(res.data)).catch(console.error);
    }, [hasSeenTutorial, startTutorial]);



    const navItems = [
        { label: 'ATENDIMENTO', path: '/dashboard/chat', icon: MessageSquare },
        { label: 'PLANOS', path: '/dashboard/plans', icon: Activity },
        { label: 'AGENDA', path: '/dashboard/appointments', icon: Calendar },
        { label: 'MEMBROS', path: '/dashboard/members', icon: Users },
        { label: 'EXERCÍCIOS', path: '/dashboard/exercises', icon: Activity }, // Use Activity or Dumbbell
        { label: 'ACESSOS', path: '/dashboard/logs', icon: Activity },
        { label: 'FINANCEIRO', path: '/dashboard/finance', icon: CreditCard },
        { label: 'CATRACAS', path: '/dashboard/turnstiles', icon: Cpu },
        { label: 'WHATSAPP', path: '/dashboard/whatsapp', icon: Zap },

        { label: 'CONFIGURAÇÕES', path: '/dashboard/settings', icon: Settings },
    ];

    const filteredNavItems = navItems.filter(item => {
        if (item.label === 'Agenda' && !user?.enable_scheduling) return false;
        return true;
    });

    const currentItem = filteredNavItems.find(item => item.path === location.pathname) || filteredNavItems[0];

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden">
            <NotificationHandler />
            {/* Desktop Sidebar */}
            <aside className="hidden md:flex w-72 bg-slate-950 text-white flex-col shadow-2xl z-20">
                <div className="p-8 border-b border-slate-800">
                    <div className="flex items-center gap-3 px-1 mb-10 group cursor-pointer" onClick={() => navigate('/dashboard')}>
                        <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center shadow-lg group-hover:scale-110 transition-all duration-300 bg-white">
                            {user?.logo_url ? (
                                <img src={formatImageUrl(user.logo_url)} alt="Gym Logo" className="w-full h-full object-contain p-1" />
                            ) : systemSettings.logo_url ? (
                                <img src={formatImageUrl(systemSettings.logo_url)} alt="SaaS Logo" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full bg-gradient-to-tr from-primary to-primary/60 flex items-center justify-center shadow-primary/30">
                                    <Zap className="text-white fill-white" size={20} />
                                </div>
                            )}
                        </div>
                        <span className="text-2xl font-black tracking-tighter text-white truncate max-w-[180px]">
                            {user?.name || (systemSettings.site_name === 'ZapFitness' ? (
                                <>Zapp<span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary/70">Fitness</span></>
                            ) : (
                                systemSettings.site_name
                            ))}
                        </span>
                    </div>
                </div>

                <nav id="sidebar-nav" className="flex-1 p-6 space-y-2 overflow-y-auto">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-6 px-4">Menu Principal</p>
                    {filteredNavItems.map((item) => (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={clsx(
                                "flex items-center gap-3 p-4 rounded-2xl transition-all duration-300 group",
                                location.pathname === item.path
                                    ? "bg-primary text-white shadow-lg shadow-primary/30"
                                    : "text-slate-500 hover:bg-white/5 hover:text-white"
                            )}
                        >
                            <item.icon size={20} className={clsx(location.pathname === item.path ? "scale-110" : "group-hover:scale-110 transition-transform")} />
                            <span className="font-bold text-sm tracking-wide">{item.label}</span>
                        </Link>
                    ))}
                </nav>

                <div className="p-6 border-t border-white/5 bg-slate-950/50">
                    <div className="flex items-center gap-4 p-5 rounded-[2.5rem] bg-white/5 border border-white/5 mb-6">
                        <div className="w-14 h-14 rounded-[1.5rem] bg-white shadow-lg flex items-center justify-center font-bold text-slate-900 shadow-inner overflow-hidden flex-shrink-0 border-2 border-white/10">
                            {user?.logo_url ? (
                                <img src={formatImageUrl(user.logo_url)} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                                <Zap className="text-primary" size={28} />
                            )}
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <p className="text-base font-black text-white truncate uppercase tracking-tighter">{user?.name || 'Academia'}</p>
                            <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                                <span className="text-[9px] text-slate-500 uppercase font-black tracking-widest whitespace-nowrap">Conectado Live</span>
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => {
                            const path = location.pathname;
                            let tutorialId = 'dashboard';
                            if (path.includes('/members')) tutorialId = 'members';
                            else if (path.includes('/plans')) tutorialId = 'plans';
                            else if (path.includes('/finance')) tutorialId = 'finance';
                            else if (path.includes('/turnstiles')) tutorialId = 'turnstiles';
                            else if (path.includes('/logs')) tutorialId = 'access_logs';
                            else if (path.includes('/whatsapp')) tutorialId = 'whatsapp';

                            startTutorial(tutorialId);
                        }} className="flex items-center justify-center p-4 bg-white/5 hover:bg-white/10 rounded-2xl text-slate-500 hover:text-white transition-all group border border-white/5">
                            <HelpCircle size={18} className="group-hover:scale-110 transition-transform" />
                        </button>
                        <button
                            onClick={() => {
                                if (window.confirm('Deseja realmente sair?')) {
                                    logout();
                                    navigate('/');
                                }
                            }}
                            className="flex items-center justify-center p-4 bg-red-500/10 hover:bg-red-500/20 rounded-2xl text-red-500 transition-all group border border-red-500/10"
                            title="Sair"
                        >
                            <LogOut size={18} className="group-hover:scale-110 transition-transform" />
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col h-full overflow-hidden relative">

                {/* Mobile Top Header */}
                <header className="md:hidden bg-white/80 backdrop-blur-xl border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-30">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center shadow-md overflow-hidden">
                            {user?.logo_url ? (
                                <img src={formatImageUrl(user.logo_url)} alt="Logo" className="w-full h-full object-cover" />
                            ) : (
                                <Zap className="text-white fill-white" size={16} />
                            )}
                        </div>
                        <h1 className="text-lg font-black text-slate-900 tracking-tight truncate max-w-[150px]">{user?.name || currentItem.label}</h1>
                    </div>
                    <div className="flex items-center gap-3">
                        <button className="p-2 text-slate-500 hover:text-primary transition-colors relative">
                            <Bell size={20} />
                            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                        </button>
                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600 text-xs shadow-sm overflow-hidden">
                            {user?.logo_url ? (
                                <img src={formatImageUrl(user.logo_url)} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                                user?.name?.charAt(0) || 'A'
                            )}
                        </div>
                    </div>
                </header>

                <header className="hidden md:flex bg-white border-b border-slate-100 px-12 py-6 items-center justify-between z-10">
                    <div className="flex items-center gap-6">
                        <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">{currentItem.label}</h2>
                        <div className="flex items-center gap-3 px-5 py-2 bg-primary/5 rounded-full border border-primary/10">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_8px_var(--primary-color)]"></div>
                            <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em] whitespace-nowrap">IA NIVEL: MÁXIMO ATIVADO</span>
                        </div>
                    </div>
                    <div id="header-profile" className="flex items-center gap-4">
                        <div className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </div>
                    </div>
                </header>

                {/* Content Container */}
                <main id="main-content" className="flex-1 overflow-y-auto min-h-0 pb-32 md:pb-8 touch-pan-y">
                    <div className="p-4 md:p-10 max-w-7xl mx-auto">
                        <Routes>
                            <Route path="/" element={<Welcome />} />
                            <Route path="/chat" element={<Chat />} />
                            <Route path="/plans" element={<Plans />} />
                            <Route path="/appointments" element={<Appointments />} />
                            <Route path="/members" element={<Members />} />
                            <Route path="/exercises" element={<Exercises />} />
                            <Route path="/logs" element={<AccessLogs />} />
                            <Route path="/finance" element={<Finance />} />
                            <Route path="/turnstiles" element={<Turnstiles />} />
                            <Route path="/whatsapp" element={<WhatsAppConnect />} />

                            <Route path="/settings" element={<ProfileSettings />} />
                        </Routes>
                    </div>
                </main>

                {/* --- PROFESSIONAL MOBILE SMART DOCK --- */}
                <div className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 w-[92%] max-w-md z-50">
                    <nav className="bg-slate-900/90 backdrop-blur-xl border border-white/10 p-2 rounded-[2.5rem] flex items-center justify-between shadow-2xl shadow-primary/20">
                        {/* Primary Items (Top 4) */}
                        {[
                            { label: 'Início', path: '/dashboard', icon: LayoutDashboard },
                            { label: 'Chat', path: '/dashboard/chat', icon: MessageSquare },
                            ...(user?.enable_scheduling ? [{ label: 'Agenda', path: '/dashboard/appointments', icon: Calendar }] : []),
                            { label: 'Whats', path: '/dashboard/whatsapp', icon: Zap },

                        ].map((item) => {
                            const isActive = location.pathname === item.path;
                            return (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className={clsx(
                                        "relative flex flex-col items-center justify-center py-2 px-1 transition-all duration-300 flex-1",
                                        isActive ? "text-primary" : "text-white/40 hover:text-white/60"
                                    )}
                                >
                                    <div className={clsx(
                                        "p-2.5 rounded-2xl transition-all duration-500",
                                        isActive ? "bg-primary/10 scale-110" : "bg-transparent"
                                    )}>
                                        <item.icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                                    </div>
                                    <span className={clsx(
                                        "text-[9px] font-black uppercase tracking-widest mt-1 scale-90",
                                        isActive ? "opacity-100" : "opacity-0 invisible h-0"
                                    )}>
                                        {item.label}
                                    </span>
                                    {isActive && (
                                        <div className="absolute -bottom-1 w-1 h-1 bg-primary rounded-full shadow-[0_0_8px_var(--primary-color)]" />
                                    )}
                                </Link>
                            );
                        })}

                        {/* Expand Button */}
                        <button
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            className={clsx(
                                "flex flex-col items-center justify-center p-2.5 rounded-2xl transition-all duration-300 flex-1",
                                isMobileMenuOpen ? "text-primary bg-primary/10 scale-110 rotate-90" : "text-white/40"
                            )}
                        >
                            <MoreHorizontal size={24} />
                            <span className={clsx(
                                "text-[9px] font-black uppercase tracking-widest mt-1 scale-90",
                                isMobileMenuOpen ? "opacity-100" : "opacity-0 invisible h-0"
                            )}>
                                Mais
                            </span>
                        </button>
                    </nav>

                    {/* Expandable Menu Overlay (Glassmorphism Modal) */}
                    {isMobileMenuOpen && (
                        <div className="absolute bottom-20 left-0 right-0 animate-fade-in-up">
                            <div className="bg-slate-900/95 backdrop-blur-2xl border border-white/10 rounded-[3rem] p-6 shadow-2xl grid grid-cols-3 gap-6">
                                {[
                                    { label: 'Membros', path: '/dashboard/members', icon: Users },
                                    { label: 'Treinos', path: '/dashboard/exercises', icon: Activity },
                                    { label: 'Planos', path: '/dashboard/plans', icon: Activity },
                                    { label: 'Acessos', path: '/dashboard/logs', icon: Activity },
                                    { label: 'Dinheiro', path: '/dashboard/finance', icon: CreditCard },
                                    { label: 'Catracas', path: '/dashboard/turnstiles', icon: Cpu },
                                    { label: 'Ajustes', path: '/dashboard/settings', icon: Settings },
                                ].map((item) => (
                                    <Link
                                        key={item.path}
                                        to={item.path}
                                        onClick={() => setIsMobileMenuOpen(false)}
                                        className="flex flex-col items-center gap-2 group"
                                    >
                                        <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center text-white/60 group-hover:bg-orange-500/20 group-hover:text-orange-500 transition-all border border-white/5">
                                            <item.icon size={24} />
                                        </div>
                                        <span className="text-[10px] font-black text-white/40 uppercase tracking-widest text-center">{item.label}</span>
                                    </Link>
                                ))}
                                <button
                                    onClick={() => {
                                        if (window.confirm('Deseja realmente sair?')) {
                                            logout();
                                            navigate('/');
                                        }
                                    }}
                                    className="flex flex-col items-center gap-2 group"
                                >
                                    <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500 group-hover:bg-red-500/20 transition-all border border-red-500/10">
                                        <LogOut size={24} />
                                    </div>
                                    <span className="text-[10px] font-black text-red-500/60 uppercase tracking-widest text-center">Sair</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Overlay Background to close menu */}
                {isMobileMenuOpen && (
                    <div
                        className="md:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-40 animate-fade-in"
                        onClick={() => setIsMobileMenuOpen(false)}
                    />
                )}
            </div>
        </div>
    );
};

const Welcome = () => {
    const navigate = useNavigate();
    const [stats, setStats] = React.useState<{ name?: string } | null>(null);

    React.useEffect(() => {
        api.get('/me').then(res => setStats(res.data)).catch(console.error);
    }, []);

    return (
        <div className="animate-fade-in-up">
            <div className="mb-12 p-4 md:p-0">
                <h1 className="text-4xl md:text-5xl font-black text-slate-900 mb-2 tracking-tighter">
                    Olá, <span className="text-primary">{stats?.name || 'Fitness'}!</span> 👋
                </h1>
                <p className="text-slate-500 font-medium text-lg">Aqui está o que está acontecendo hoje.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
                {/* AI Insights Card */}
                <div className="lg:col-span-2 bg-[#1e293b] rounded-[3rem] p-10 text-white shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-80 h-80 bg-primary/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-[100px] group-hover:bg-primary/20 transition-all duration-700"></div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-4 mb-10">
                            <div className="w-14 h-14 bg-primary/20 rounded-2xl flex items-center justify-center shadow-lg shadow-primary/10">
                                <Brain className="text-primary" size={28} />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black tracking-tight">Insights da Inteligência Artificial</h3>
                                <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">Análise preditiva em tempo real</p>
                            </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="bg-white/5 border border-white/5 p-8 rounded-[2.5rem] hover:bg-white/10 transition-all cursor-pointer group/card">
                                <div className="flex items-center gap-3 mb-4">
                                    <TrendingUp className="text-primary" size={20} />
                                    <span className="text-sm font-black text-primary uppercase tracking-widest">Oportunidade de Receita</span>
                                </div>
                                <p className="text-sm text-slate-300 font-medium leading-relaxed">Você tem <span className="text-white font-black">12 alunos</span> com planos vencendo nos próximos 7 dias. Enviar lembrete automático?</p>
                                <button onClick={() => alert('🧠 IA ZapFitness: Iniciando processamento de lembretes via WhatsApp para os 12 alunos...')} className="mt-8 text-[10px] font-black uppercase tracking-[0.2em] bg-primary text-white px-6 py-3 rounded-2xl hover:scale-105 transition-all shadow-lg shadow-primary/20">Executar Ação</button>
                            </div>

                            <div className="bg-white/5 border border-white/5 p-8 rounded-[2.5rem] hover:bg-white/10 transition-all cursor-pointer group/card">
                                <div className="flex items-center gap-3 mb-4">
                                    <AlertCircle className="text-orange-400" size={20} />
                                    <span className="text-sm font-black text-orange-400 uppercase tracking-widest">Risco de Churn</span>
                                </div>
                                <p className="text-sm text-slate-300 font-medium leading-relaxed"><span className="text-white font-black">5 alunos</span> frequentes não aparecem há mais de 10 dias. Recomenda-se incentivo.</p>
                                <button onClick={() => navigate('/dashboard/members')} className="mt-8 text-[10px] font-black uppercase tracking-[0.2em] bg-white/10 text-white px-6 py-3 rounded-2xl hover:bg-white/20 transition-all border border-white/10">Ver Alunos</button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Quick Stats Sidebar */}
                <div className="bg-white border border-slate-100 rounded-[3rem] p-10 shadow-sm flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-10">
                            <h4 className="font-black text-slate-900 uppercase tracking-[0.2em] text-[10px]">Saúde da Academia</h4>
                            <Sparkles className="text-primary animate-pulse" size={18} />
                        </div>
                        <div className="space-y-10">
                            <div>
                                <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                                    <span>ENGAJAMENTO</span>
                                    <span className="text-primary">85%</span>
                                </div>
                                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                                    <div className="bg-primary h-full rounded-full shadow-[0_0_10px_rgba(var(--primary-rgb),0.4)]" style={{ width: '85%' }}></div>
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                                    <span>RETENÇÃO</span>
                                    <span className="text-primary">92%</span>
                                </div>
                                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                                    <div className="bg-primary h-full rounded-full shadow-[0_0_10px_rgba(var(--primary-rgb),0.4)]" style={{ width: '92%' }}></div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="mt-12 p-6 bg-blue-50/50 rounded-3xl border border-blue-100">
                        <p className="text-[11px] font-bold text-blue-800 leading-relaxed italic text-center">
                            "A IA detectou que treinos de quarta-feira têm 20% mais faltas. Considere uma aula especial para este dia."
                        </p>
                    </div>
                </div>
            </div>

            {/* Onboarding Tips */}
            <div className="bg-[#1e293b] rounded-[3rem] p-12 text-white shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-80 h-80 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-[80px]"></div>
                <div className="relative z-10">
                    <h3 className="text-3xl font-black mb-10 tracking-tight flex items-center gap-3">
                        <Zap className="text-primary fill-primary" size={32} />
                        Próximos Passos
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                        {[
                            { step: '1', title: 'WhatsApp', color: 'text-primary', desc: 'Ative seu bot na aba WhatsApp para automatizar a recepção.' },
                            { step: '2', title: 'Planos', color: 'text-primary', desc: 'Cadastre suas mensalidades para vincular aos alunos.' },
                            { step: '3', title: 'Membros', color: 'text-primary', desc: 'Adicione seus alunos e gere o acesso inteligente deles.' }
                        ].map((item, i) => (
                            <div key={i} className="flex gap-6 group/item cursor-pointer">
                                <div className="w-14 h-14 shrink-0 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center font-black text-2xl text-slate-600 group-hover/item:border-primary group-hover/item:text-white transition-all">
                                    {item.step}
                                </div>
                                <div className="flex-1">
                                    <div className={clsx("font-black tracking-[0.2em] uppercase text-[10px] mb-2", item.color)}>{item.title}</div>
                                    <p className="text-sm text-slate-400 font-medium leading-relaxed">{item.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
};
