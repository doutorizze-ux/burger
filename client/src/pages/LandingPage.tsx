import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
    Zap, Shield, ArrowRight, MessageSquare,
    Menu, X, Brain, Sparkles, TrendingUp,
    ChevronRight, CheckCircle2, Globe, Clock
} from 'lucide-react';
import { formatImageUrl } from '../utils/format';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import clsx from 'clsx';

export const LandingPage = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [scrolled, setScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [systemSettings, setSystemSettings] = useState({ site_name: 'ZapFitness', logo_url: '' });

    const heroRef = useRef<HTMLElement>(null);
    const { scrollYProgress } = useScroll({
        target: heroRef,
        offset: ["start start", "end start"]
    });

    const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
    const scale = useTransform(scrollYProgress, [0, 0.5], [1, 0.9]);
    const y = useTransform(scrollYProgress, [0, 0.5], [0, 100]);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', handleScroll);

        const fetchSettings = async () => {
            let apiUrl = import.meta.env.VITE_API_URL || 'https://api.zapp.fitness/api';
            if (apiUrl.endsWith('/')) apiUrl = apiUrl.slice(0, -1);
            if (!apiUrl.endsWith('/api')) apiUrl += '/api';
            const url = `${apiUrl}/system/settings`;
            try {
                const res = await fetch(url);
                if (res.ok) setSystemSettings(await res.json());
            } catch (err) { console.error(err); }
        };

        fetchSettings();
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const features = [
        {
            icon: <MessageSquare className="text-orange-500" size={24} />,
            title: "WhatsApp First",
            tag: "NATIVO",
            desc: "Seus alunos pedem treinos, consultam dietas e fazem check-ins sem NUNCA baixar um aplicativo. Experiência 100% no chat.",
            color: "from-orange-500/20 to-red-500/20"
        },
        {
            icon: <Brain className="text-purple-500" size={24} />,
            title: "Inteligência Anti-Churn",
            tag: "EXCLUSIVO",
            desc: "Nossa IA detecta padrões de comportamento e te avisa via WhatsApp quando um aluno está prestes a abandonar a academia.",
            color: "from-purple-500/20 to-blue-500/20"
        },
        {
            icon: <Sparkles className="text-emerald-500" size={24} />,
            title: "AI Workout Hub",
            tag: "AGILIDADE",
            desc: "Gere rotinas de treino otimizadas em segundos. Personalize para cada aluno com um só clique usando LLM de ponta.",
            color: "from-emerald-500/20 to-teal-500/20"
        },
        {
            icon: <Shield className="text-blue-500" size={24} />,
            title: "Financeiro Blindado",
            tag: "SEGURANÇA",
            desc: "Cobranças automáticas, bloqueio de catraca em tempo real e integração total com PIX e Cartão de Crédito.",
            color: "from-blue-500/20 to-indigo-500/20"
        }
    ];

    const navLinks = [
        { label: 'O Ecossistema', href: '#features' },
        { label: 'Estatísticas', href: '#stats' },
        { label: 'Preços', href: '/login' },
    ];

    return (
        <div className="font-sans antialiased text-slate-200 bg-[#0a0a0b] selection:bg-orange-500/30 selection:text-white overflow-x-hidden">
            {/* Smooth Scroll Container */}
            <div className="relative">

                {/* Navbar */}
                <nav className={clsx(
                    "fixed w-full z-[100] transition-all duration-700 px-6 md:px-12",
                    scrolled ? 'py-4' : 'py-8'
                )}>
                    <div className={clsx(
                        "max-w-7xl mx-auto flex justify-between items-center transition-all duration-500",
                        scrolled ? "bg-black/60 backdrop-blur-2xl border border-white/5 px-6 py-3 rounded-full shadow-2xl" : ""
                    )}>
                        <div className="flex items-center gap-3 group cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                            <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center border border-white/10 shadow-lg group-hover:scale-110 group-hover:rotate-6 transition-all duration-500">
                                {systemSettings.logo_url ? (
                                    <img src={formatImageUrl(systemSettings.logo_url)} alt="Logo" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-gradient-to-tr from-orange-500 to-red-600 flex items-center justify-center">
                                        <Zap className="text-white fill-white" size={20} />
                                    </div>
                                )}
                            </div>
                            <span className="text-xl md:text-2xl font-black tracking-tight text-white uppercase italic">
                                {systemSettings.site_name === 'ZapFitness' ? (
                                    <>Zapp<span className="text-orange-500 italic">Fitness</span></>
                                ) : (
                                    systemSettings.site_name
                                )}
                            </span>
                        </div>

                        {/* Desktop Menu */}
                        <div className="hidden lg:flex gap-10 text-[10px] font-black tracking-[0.2em] uppercase text-slate-400">
                            {navLinks.map(link => (
                                <a key={link.href} href={link.href} className="hover:text-white transition-colors relative group py-2">
                                    {link.label}
                                    <span className="absolute -bottom-1 left-0 w-0 h-[2px] bg-orange-500 transition-all duration-500 group-hover:w-full"></span>
                                </a>
                            ))}
                        </div>

                        <div className="flex gap-4 items-center">
                            {user ? (
                                <button onClick={() => navigate('/dashboard')} className="bg-orange-500 text-white transition-all font-black text-[10px] tracking-widest uppercase hidden sm:block px-6 py-2.5 rounded-full hover:scale-105 active:scale-95 shadow-lg shadow-orange-500/20">Dashboard</button>
                            ) : (
                                <button onClick={() => navigate('/login')} className="text-slate-400 hover:text-white transition-colors font-black text-[10px] tracking-widest uppercase hidden sm:block px-4">Entrar</button>
                            )}

                            <button
                                className="lg:hidden text-white p-2 bg-white/5 border border-white/10 rounded-xl"
                                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            >
                                {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                            </button>
                        </div>
                    </div>
                </nav>

                {/* Mobile Menu Overlay */}
                <AnimatePresence>
                    {mobileMenuOpen && (
                        <motion.div
                            initial={{ opacity: 0, x: '100%' }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed inset-0 bg-black/95 backdrop-blur-2xl z-[150] flex flex-col p-12 lg:hidden"
                        >
                            <div className="flex justify-between items-center mb-20">
                                <span className="text-2xl font-black text-white italic">ZAPP<span className="text-orange-500">FITNESS</span></span>
                                <button onClick={() => setMobileMenuOpen(false)} className="p-3 bg-white/5 rounded-2xl border border-white/10">
                                    <X size={24} />
                                </button>
                            </div>
                            <div className="flex flex-col gap-10">
                                {navLinks.map((link, i) => (
                                    <motion.a
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: i * 0.1 }}
                                        key={link.href}
                                        href={link.href}
                                        onClick={() => setMobileMenuOpen(false)}
                                        className="text-4xl font-black text-white hover:text-orange-500 transition-all"
                                    >
                                        {link.label}
                                    </motion.a>
                                ))}
                            </div>
                            <div className="mt-auto pt-10 border-t border-white/10 flex flex-col gap-4">
                                <button
                                    onClick={() => { setMobileMenuOpen(false); navigate(user ? '/dashboard' : '/login'); }}
                                    className="w-full py-5 bg-orange-500 text-white rounded-2xl font-black text-lg uppercase tracking-widest"
                                >
                                    {user ? 'Acessar Dashboard' : 'Painel Administrativo'}
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Hero Section */}
                <header ref={heroRef} className="relative min-h-screen flex items-center justify-center pt-32 pb-20 overflow-hidden bg-black">
                    {/* Visual Cosmic Background */}
                    <div className="absolute inset-0 z-0">
                        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-orange-500/10 blur-[120px] rounded-full animate-pulse"></div>
                        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-500/10 blur-[120px] rounded-full animate-pulse-slow"></div>
                        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/50 to-[#0a0a0b]"></div>
                    </div>

                    <motion.div
                        style={{ opacity, scale, y }}
                        className="relative max-w-7xl mx-auto px-6 text-center z-10"
                    >
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8 }}
                            className="inline-flex items-center gap-3 px-5 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-xl mb-10"
                        >
                            <div className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                            </div>
                            <span className="text-[10px] font-black text-white uppercase tracking-[0.3em]">IA Predictive Fitness Management</span>
                        </motion.div>

                        <motion.h1
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                            className="text-5xl md:text-8xl lg:text-9xl font-black tracking-tighter mb-10 leading-[0.9] text-white"
                        >
                            ACADEMIA <br className="hidden md:block" />
                            <span className="text-transparent bg-clip-text bg-gradient-to-b from-orange-400 to-red-600 italic">ULTRA-FAST.</span>
                        </motion.h1>

                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.5, duration: 1 }}
                            className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-16 leading-relaxed font-medium px-4"
                        >
                            O futuro da gestão fitness não é um app, é uma conversa.
                            Fichas de treino, pagamentos e retenção por IA, integrados ao WhatsApp.
                        </motion.p>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.8 }}
                            className="flex flex-col sm:flex-row justify-center gap-6 px-4"
                        >
                            <button
                                onClick={() => navigate(user ? '/dashboard' : '/login')}
                                className="group relative bg-white text-black px-12 py-5 rounded-full font-black text-lg transition-all hover:scale-105 active:scale-95 shadow-2xl shadow-white/10 overflow-hidden"
                            >
                                <span className="relative z-10 flex items-center justify-center gap-3 uppercase tracking-tighter">
                                    {user ? 'IR PARA O PAINEL' : 'INICIAR CRESCIMENTO'}
                                    <ArrowRight size={22} className="group-hover:translate-x-2 transition-transform" />
                                </span>
                                <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-red-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                <div className="absolute inset-0 group-hover:bg-white mix-blend-difference"></div>
                            </button>


                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 0.4 }}
                            transition={{ delay: 1.5 }}
                            className="mt-32 pt-16 border-t border-white/5 max-w-5xl mx-auto"
                        >
                            <div className="flex flex-wrap justify-center items-center gap-16 text-white">
                                <span className="text-2xl font-black italic tracking-widest">BODYTECH</span>
                                <span className="text-2xl font-black tracking-tight">SMART-X</span>
                                <span className="text-2xl font-black italic tracking-tight">IRON-DOME</span>
                                <span className="text-2xl font-black tracking-widest">FIT-PRO</span>
                            </div>
                        </motion.div>
                    </motion.div>

                    {/* Decorative Scroll Down */}
                    <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce opacity-20 hidden md:block">
                        <div className="w-1 h-12 bg-gradient-to-b from-white to-transparent rounded-full"></div>
                    </div>
                </header>

                {/* Ecosystem Showcase */}
                <section id="features" className="py-40 bg-[#0a0a0b] relative">
                    <div className="max-w-7xl mx-auto px-6">
                        <div className="grid lg:grid-cols-2 gap-24 items-center">
                            <motion.div
                                initial={{ opacity: 0, x: -50 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.8 }}
                                className="relative order-2 lg:order-1"
                            >
                                <div className="absolute -inset-10 bg-orange-500/10 blur-[100px] rounded-full"></div>
                                <div className="relative rounded-[3rem] overflow-hidden border border-white/10 shadow-[0_0_80px_rgba(0,0,0,0.5)] group aspect-[4/5] md:aspect-auto">
                                    <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent z-10"></div>
                                    <img
                                        src="https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=2070&auto=format&fit=crop"
                                        alt="Gym Experience"
                                        className="w-full h-full object-cover grayscale opacity-60 group-hover:grayscale-0 group-hover:scale-110 transition-all duration-1000"
                                    />
                                    <div className="absolute bottom-12 left-10 right-10 z-20 space-y-4">
                                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-xl border border-white/20 rounded-lg">
                                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                                            <span className="text-[10px] font-black text-white uppercase">Live Connection</span>
                                        </div>
                                        <h3 className="text-4xl font-black text-white leading-tight">Zero Apps. <br />Total Controle.</h3>
                                        <p className="text-slate-400 font-medium text-lg leading-relaxed">Seus alunos já usam WhatsApp. Nós transformamos o chat deles em um painel fitness de alta performance.</p>
                                    </div>
                                </div>
                            </motion.div>

                            <div className="order-1 lg:order-2">
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    className="mb-16"
                                >
                                    <h2 className="text-5xl md:text-7xl font-black text-white mb-8 tracking-tighter leading-[0.95]">
                                        TECNOLOGIA <br />
                                        <span className="text-orange-500 italic uppercase">DE PONTA.</span>
                                    </h2>
                                    <p className="text-xl text-slate-400 font-medium leading-relaxed">
                                        Substituímos apps complicados por agilidade pura. Sua academia escala, seus alunos permanecem e seu financeiro respira.
                                    </p>
                                </motion.div>

                                <div className="grid gap-6">
                                    {features.map((item, i) => (
                                        <motion.div
                                            key={i}
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            whileInView={{ opacity: 1, scale: 1 }}
                                            viewport={{ once: true }}
                                            transition={{ delay: i * 0.1 }}
                                            whileHover={{ x: 10 }}
                                            className="group flex gap-6 p-8 rounded-[2rem] bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/20 transition-all cursor-pointer items-start"
                                        >
                                            <div className={clsx("w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-2xl bg-gradient-to-br", item.color)}>
                                                {item.icon}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-3 mb-2">
                                                    <h4 className="font-black text-white text-xl uppercase tracking-tighter">{item.title}</h4>
                                                    <span className="px-2 py-0.5 bg-white/10 text-[8px] font-black text-white/50 rounded uppercase tracking-widest">{item.tag}</span>
                                                </div>
                                                <p className="text-slate-400 font-medium leading-relaxed">{item.desc}</p>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Big Stats - Data Evidence */}
                <section id="stats" className="py-40 relative bg-black overflow-hidden">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-[500px] bg-orange-500/5 blur-[150px] rounded-full"></div>

                    <div className="max-w-7xl mx-auto px-6 relative z-10">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-24 items-center">
                            <div className="text-center group">
                                <div className="text-8xl md:text-9xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-white/20 mb-4 group-hover:scale-110 transition-transform duration-700">500+</div>
                                <div className="h-1 w-20 bg-orange-500 mx-auto mb-6"></div>
                                <div className="text-[12px] font-black text-slate-400 uppercase tracking-[0.4em]">Unidades Integradas</div>
                                <p className="text-slate-500 mt-4 font-bold text-sm">Crescendo globalmente todos os dias.</p>
                            </div>
                            <div className="text-center group">
                                <div className="text-8xl md:text-9xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-white/20 mb-4 group-hover:scale-110 transition-transform duration-700">12k</div>
                                <div className="h-1 w-20 bg-orange-500 mx-auto mb-6"></div>
                                <div className="text-[12px] font-black text-slate-400 uppercase tracking-[0.4em]">Check-ins Diários</div>
                                <p className="text-slate-500 mt-4 font-bold text-sm">Infraestrutura robusta e sem latência.</p>
                            </div>
                            <div className="text-center group">
                                <div className="text-8xl md:text-9xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-white/20 mb-4 group-hover:scale-110 transition-transform duration-700">35%</div>
                                <div className="h-1 w-20 bg-orange-500 mx-auto mb-6"></div>
                                <div className="text-[12px] font-black text-slate-400 uppercase tracking-[0.4em]">Aumento na Retenção</div>
                                <p className="text-slate-500 mt-4 font-bold text-sm">IA agindo proativamente no abandono.</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* AI & Automation - The "Tech" Section */}
                <section className="py-40 bg-[#0a0a0b] relative overflow-hidden">
                    <div className="max-w-7xl mx-auto px-6">
                        <div className="bg-gradient-to-br from-white via-white to-slate-200 rounded-[4rem] p-12 md:p-24 flex flex-col lg:flex-row gap-20 items-center overflow-hidden relative group">
                            <div className="absolute top-0 right-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 pointer-events-none"></div>

                            <div className="relative z-10 lg:w-1/2">
                                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-black/5 mb-10">
                                    <Sparkles className="text-orange-500" size={16} />
                                    <span className="text-[10px] font-black text-black uppercase tracking-widest">ZapFitness Deep Intelligence</span>
                                </div>
                                <h2 className="text-5xl md:text-7xl font-black text-black mb-10 tracking-tighter leading-none">
                                    O CÉREBRO <br />
                                    <span className="text-orange-600">DA SUA GESTÃO.</span>
                                </h2>
                                <p className="text-xl text-slate-600 mb-12 font-medium leading-relaxed">
                                    Não somos apenas um software. Somos um ecossistema inteligente que entende quando um aluno vai sair, gera treinos personalizados e gerencia fluxos financeiros complexos sozinho.
                                </p>

                                <div className="flex flex-wrap gap-4">
                                    <div className="px-6 py-4 bg-black text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-all cursor-default">Machine Learning</div>
                                    <div className="px-6 py-4 bg-orange-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-all cursor-default">WhatsApp API 2.0</div>
                                    <div className="px-6 py-4 border-2 border-black/10 text-black rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-all cursor-default">Real-time Sync</div>
                                </div>
                            </div>

                            <div className="relative z-10 lg:w-1/2">
                                <div className="relative">
                                    <div className="absolute -inset-10 bg-orange-500/20 blur-[80px] rounded-full group-hover:bg-orange-500/30 transition-all"></div>
                                    <motion.div
                                        animate={{ y: [0, -20, 0] }}
                                        transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                                        className="relative bg-black p-4 rounded-[3rem] shadow-[0_50px_100px_rgba(0,0,0,0.3)] border border-white/10"
                                    >
                                        <div className="bg-slate-900 rounded-[2.5rem] overflow-hidden aspect-video relative">
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <div className="flex flex-col items-center gap-6">
                                                    <div className="flex gap-4">
                                                        <motion.div animate={{ height: [20, 40, 20] }} transition={{ repeat: Infinity, duration: 1.2 }} className="w-1.5 bg-orange-500 rounded-full" />
                                                        <motion.div animate={{ height: [40, 20, 40] }} transition={{ repeat: Infinity, duration: 0.8 }} className="w-1.5 bg-orange-500 rounded-full" />
                                                        <motion.div animate={{ height: [30, 50, 30] }} transition={{ repeat: Infinity, duration: 1.5 }} className="w-1.5 bg-orange-500 rounded-full" />
                                                    </div>
                                                    <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.5em]">Processando Insights</span>
                                                </div>
                                            </div>
                                            {/* Simulate UI code */}
                                            <div className="absolute top-6 left-6 flex gap-2">
                                                <div className="w-2 h-2 rounded-full bg-red-500" />
                                                <div className="w-2 h-2 rounded-full bg-yellow-500" />
                                                <div className="w-2 h-2 rounded-full bg-green-500" />
                                            </div>
                                        </div>
                                    </motion.div>

                                    {/* Floating Insight Card */}
                                    <motion.div
                                        initial={{ x: 50, opacity: 0 }}
                                        whileInView={{ x: 0, opacity: 1 }}
                                        className="absolute -right-8 -bottom-8 bg-white p-6 rounded-3xl shadow-2xl border border-slate-100 hidden md:block"
                                    >
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
                                                <TrendingUp className="text-orange-500" size={14} />
                                            </div>
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Resultado IA</span>
                                        </div>
                                        <p className="text-sm font-black text-slate-900 leading-tight">Churn Rate reduzido em 12% <br /><span className="text-emerald-500">+ R$ 4.250,00 este mês</span></p>
                                    </motion.div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Closing CTA */}
                <section className="py-60 relative overflow-hidden bg-white text-black">
                    <div className="max-w-7xl mx-auto px-6 text-center relative z-10">
                        <motion.h2
                            initial={{ opacity: 0, scale: 0.9 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            className="text-6xl md:text-9xl font-black tracking-tighter mb-12 leading-[0.85]"
                        >
                            SUA ACADEMIA <br />
                            <span className="text-orange-600">REDEFINIDA.</span>
                        </motion.h2>


                        <button
                            onClick={() => navigate(user ? '/dashboard' : '/login')}
                            className="group relative bg-black text-white px-16 py-8 rounded-full font-black text-2xl transition-all hover:scale-110 active:scale-95 shadow-2xl overflow-hidden"
                        >
                            <span className="relative z-10 flex items-center gap-4 uppercase tracking-tighter">
                                {user ? 'VOLTAR AO PAINEL' : 'COMEÇAR AGORA'}
                                <ChevronRight size={32} className="group-hover:translate-x-2 transition-transform" />
                            </span>
                        </button>
                    </div>

                    {/* Infinite Tech Scroll Background */}
                    <div className="absolute bottom-0 left-0 w-full h-[30%] opacity-[0.03] overflow-hidden pointer-events-none select-none">
                        <div className="flex whitespace-nowrap text-[20vw] font-black leading-none gap-20 animate-scroll-text">
                            <span>WHATSAPP INTEGRATION</span>
                            <span>WHATSAPP INTEGRATION</span>
                            <span>WHATSAPP INTEGRATION</span>
                        </div>
                    </div>
                </section>

                {/* Footer */}
                <footer className="bg-black text-slate-500 py-32 border-t border-white/5">
                    <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-20">
                        <div className="md:col-span-2">
                            <div className="flex items-center gap-3 mb-10">
                                <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center">
                                    <Zap className="text-black fill-black" size={24} />
                                </div>
                                <span className="text-3xl font-black tracking-tighter text-white italic uppercase">ZAPP<span className="text-orange-500">FITNESS</span></span>
                            </div>
                            <p className="max-w-md text-slate-500 mb-10 font-bold text-lg leading-relaxed">
                                A tecnologia mais disruptiva para Academias e Personal Trainers.
                                Automação, Performance e Retenção no canal que importa.
                            </p>
                            <div className="flex gap-6">
                                <Globe className="text-white/20 hover:text-white transition-colors cursor-pointer" size={24} />
                                <Clock className="text-white/20 hover:text-white transition-colors cursor-pointer" size={24} />
                                <CheckCircle2 className="text-white/20 hover:text-white transition-colors cursor-pointer" size={24} />
                            </div>
                        </div>
                        <div>
                            <h4 className="text-white font-black uppercase tracking-widest text-[10px] mb-10">Plataforma</h4>
                            <ul className="space-y-6 text-sm font-black uppercase tracking-tighter">
                                <li><a href="#features" className="hover:text-orange-500 transition-colors">Ecosystem</a></li>
                                <li><a href="#demo" className="hover:text-orange-500 transition-colors">WhatsApp Bot</a></li>
                                <li><a href="#stats" className="hover:text-orange-500 transition-colors">Big Data</a></li>
                                <li><button onClick={() => navigate(user ? '/dashboard' : '/login')} className="hover:text-orange-500 transition-colors uppercase">Admin Dash</button></li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="text-white font-black uppercase tracking-widest text-[10px] mb-10">Legal & Support</h4>
                            <ul className="space-y-6 text-sm font-black uppercase tracking-tighter">
                                <li><a href="#" className="hover:text-orange-500 transition-colors">Privacy Policy</a></li>
                                <li><a href="#" className="hover:text-orange-500 transition-colors">Compliance</a></li>
                                <li><a href="#" className="hover:text-orange-500 transition-colors">API Docs</a></li>
                                <li><a href="#" className="hover:text-orange-500 transition-colors">Help Center</a></li>
                            </ul>
                        </div>
                    </div>
                    <div className="max-w-7xl mx-auto px-6 mt-32 pt-10 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
                        <span className="text-[10px] font-black uppercase tracking-[0.5em] text-white/20">&copy; 2025 ZAPPFITNESS GLOBAL GRP.</span>
                        <div className="flex gap-10 text-[10px] font-black uppercase tracking-widest">
                            <span className="text-white/40">SLA 99.9%</span>
                            <span className="text-white/40">GDPR COMPLIANT</span>
                        </div>
                    </div>
                </footer>
            </div>

            {/* Custom Animations injected via CSS */}
            <style>{`
                @keyframes scroll-text {
                    from { transform: translateX(0); }
                    to { transform: translateX(-50%); }
                }
                .animate-scroll-text {
                    animation: scroll-text 60s linear infinite;
                }
                .animate-float {
                    animation: float 6s ease-in-out infinite;
                }
                @keyframes float {
                    0%, 100% { transform: translateY(0px) rotate(0deg); }
                    50% { transform: translateY(-20px) rotate(2deg); }
                }
                .animate-pulse-slow {
                    animation: pulse 8s cubic-bezier(0.4, 0, 0.6, 1) infinite;
                }
                @font-face {
                    font-family: 'Outfit';
                    font-display: swap;
                }
                html {
                   scroll-behavior: smooth;
                }
                body {
                    background-color: #0a0a0b;
                }
            `}</style>
        </div>
    );
};

