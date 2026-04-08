import { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';
import {
    Building2,
    Lock,
    Clock,
    MessageSquare,
    CheckCircle2,
    AlertCircle,
    Save,
    Image as ImageIcon,
    RefreshCw,
    CreditCard,
    Palette,
    Calendar
} from 'lucide-react';
import clsx from 'clsx';
import { formatImageUrl } from '../utils/format';

interface Tenant {
    id: string;
    name: string;
    logo_url?: string;
    primary_color?: string;
    opening_time?: string;
    closing_time?: string;
    access_cooldown: number;
    max_daily_access: number;
    enable_scheduling: boolean;
    whatsapp_status: string;
    notificationSettings?: {
        checkin_success: string;
        plan_warning: string;
        plan_expired: string;
    };
    saas_plan?: {
        name: string;
        price: number;
        max_members: number;
    };
    saas_plan_expires_at?: string;
}

export const ProfileSettings = () => {
    const { user, login } = useAuth();
    const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'access' | 'notifications' | 'subscription'>('profile');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);

    // Form states
    const [profileData, setProfileData] = useState({ name: '', logo_url: '', primary_color: '#f97316' });
    const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
    const [accessData, setAccessData] = useState({ opening_time: '', closing_time: '', access_cooldown: 5, max_daily_access: 1, enable_scheduling: false });
    const [notificationData, setNotificationData] = useState({ checkin_success: '', plan_warning: '', plan_expired: '' });
    const [tenantData, setTenantData] = useState<Tenant | null>(null);

    const fetchSettings = useCallback(async () => {
        try {
            const res = await api.get('/me');
            const tenant = res.data;
            setTenantData(tenant);
            setProfileData({
                name: tenant.name,
                logo_url: tenant.logo_url || '',
                primary_color: tenant.primary_color || '#f97316'
            });
            setAccessData({
                opening_time: tenant.opening_time || '06:00',
                closing_time: tenant.closing_time || '23:00',
                access_cooldown: tenant.access_cooldown,
                max_daily_access: tenant.max_daily_access,
                enable_scheduling: tenant.enable_scheduling || false
            });
            if (tenant.notificationSettings) {
                setNotificationData({
                    checkin_success: tenant.notificationSettings.checkin_success,
                    plan_warning: tenant.notificationSettings.plan_warning,
                    plan_expired: tenant.notificationSettings.plan_expired,
                });
            }
        } catch (err) {
            console.error('Error fetching settings:', err);
        }
    }, []);

    useEffect(() => {
        fetchSettings();
    }, [fetchSettings]);

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const res = await api.put('/settings/profile', profileData);
            setSuccess('Perfil atualizado com sucesso!');
            // Update auth context
            if (user) {
                const updatedUser = {
                    ...user,
                    name: res.data.name,
                    logo_url: res.data.logo_url,
                    primary_color: res.data.primary_color
                };
                login(localStorage.getItem('token') || '', updatedUser);
            }
            setTimeout(() => setSuccess(null), 3000);
        } catch (err: unknown) {
            const errorMsg = err && typeof err === 'object' && 'response' in err
                ? (err as any).response?.data?.error
                : 'Erro ao atualizar perfil';
            setError(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (passwordData.newPassword !== passwordData.confirmPassword) {
            return setError('As senhas não coincidem');
        }
        setLoading(true);
        setError(null);
        try {
            await api.put('/settings/security', {
                currentPassword: passwordData.currentPassword,
                newPassword: passwordData.newPassword
            });
            setSuccess('Senha alterada com sucesso!');
            setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
            setTimeout(() => setSuccess(null), 3000);
        } catch (err: unknown) {
            const errorMsg = err && typeof err === 'object' && 'response' in err
                ? (err as any).response?.data?.error
                : 'Erro ao atualizar senha';
            setError(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateAccess = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            await api.put('/settings/access', accessData);
            setSuccess('Configurações de acesso atualizadas!');
            // Update auth context to reflect sidebar change immediately
            if (user) {
                login(localStorage.getItem('token') || '', { ...user, enable_scheduling: accessData.enable_scheduling });
            }
            setTimeout(() => setSuccess(null), 3000);
        } catch (err: unknown) {
            const errorMsg = err && typeof err === 'object' && 'response' in err
                ? (err as any).response?.data?.error
                : 'Erro ao atualizar configurações';
            setError(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateNotifications = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            await api.put('/settings/notifications', notificationData);
            setSuccess('Mensagens do bot atualizadas!');
            setTimeout(() => setSuccess(null), 3000);
        } catch (err: unknown) {
            const errorMsg = err && typeof err === 'object' && 'response' in err
                ? (err as any).response?.data?.error
                : 'Erro ao atualizar mensagens';
            setError(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await api.post('/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setProfileData({ ...profileData, logo_url: res.data.url });
        } catch (err) {
            console.error('Upload error:', err);
            alert('Erro ao fazer upload da imagem.');
        } finally {
            setUploading(false);
        }
    };

    const tabs = [
        { id: 'profile', label: 'Perfil', icon: Building2 },
        { id: 'security', label: 'Segurança', icon: Lock },
        { id: 'access', label: 'Operacional', icon: Clock },
        { id: 'notifications', label: 'Mensagens Bot', icon: MessageSquare },
        { id: 'subscription', label: 'Assinatura', icon: CreditCard },
    ];

    return (
        <div className="animate-fade-in-up pb-24 md:pb-0">
            <div className="mb-10">
                <h1 className="text-4xl font-black text-slate-900 mb-3 tracking-tight">Configurações</h1>
                <p className="text-slate-500 font-medium text-lg">Gerencie os detalhes da sua academia e preferências do sistema.</p>
            </div>

            <div className="flex flex-col lg:flex-row gap-8">
                {/* Tabs Sidebar */}
                <div className="lg:w-64 flex lg:flex-col gap-2 overflow-x-auto pb-4 lg:pb-0">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => {
                                setActiveTab(tab.id as 'profile' | 'security' | 'access' | 'notifications' | 'subscription');
                                setError(null);
                                setSuccess(null);
                            }}
                            className={clsx(
                                "flex items-center gap-3 px-8 py-4 rounded-2xl font-black transition-all whitespace-nowrap text-sm uppercase tracking-widest",
                                activeTab === tab.id
                                    ? "bg-primary text-white shadow-xl shadow-primary/30"
                                    : "bg-white text-slate-400 hover:bg-slate-50 hover:text-slate-600 border border-slate-100 shadow-sm"
                            )}
                        >
                            <tab.icon size={20} />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                <div className="flex-1">
                    <div className="bg-white rounded-[3rem] p-10 md:p-16 shadow-sm border border-slate-100 relative overflow-hidden">
                        {/* Status Messages */}
                        {success && (
                            <div className="mb-8 flex items-center gap-3 p-4 bg-green-50 text-green-700 rounded-2xl animate-fade-in border border-green-100 font-bold text-sm">
                                <CheckCircle2 size={20} />
                                {success}
                            </div>
                        )}
                        {error && (
                            <div className="mb-8 flex items-center gap-3 p-4 bg-red-50 text-red-700 rounded-2xl animate-fade-in border border-red-100 font-bold text-sm">
                                <AlertCircle size={20} />
                                {error}
                            </div>
                        )}

                        {activeTab === 'profile' && (
                            <form onSubmit={handleUpdateProfile} className="space-y-8 animate-fade-in">
                                <div className="grid md:grid-cols-2 gap-8">
                                    <div className="space-y-10">
                                        <div>
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 block">Nome da Academia</label>
                                            <input
                                                type="text"
                                                value={profileData.name}
                                                onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                                                className="w-full bg-slate-50 border-none rounded-2xl p-5 font-black text-slate-900 focus:ring-2 focus:ring-primary transition-all"
                                                placeholder="Ex: Matrix Fitness"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 block flex items-center gap-2">
                                                <Palette size={14} className="text-primary" />
                                                Cor Primária do Tema
                                            </label>
                                            <div className="flex items-center gap-6">
                                                <div className="relative group cursor-pointer">
                                                    <input
                                                        type="color"
                                                        value={profileData.primary_color}
                                                        onChange={(e) => setProfileData({ ...profileData, primary_color: e.target.value })}
                                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                    />
                                                    <div
                                                        className="w-16 h-16 rounded-2xl border-none shadow-lg transition-transform hover:scale-105"
                                                        style={{ backgroundColor: profileData.primary_color }}
                                                    />
                                                </div>
                                                <div className="flex-1">
                                                    <input
                                                        type="text"
                                                        value={profileData.primary_color}
                                                        onChange={(e) => setProfileData({ ...profileData, primary_color: e.target.value })}
                                                        className="w-full bg-slate-50 border-none rounded-2xl p-5 font-black text-slate-900 focus:ring-2 focus:ring-primary transition-all uppercase"
                                                        placeholder="#000000"
                                                    />
                                                </div>
                                            </div>
                                            <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
                                                {['#f97316', '#22c55e', '#06b6d4', '#8b5cf6', '#ef4444', '#facc15'].map(c => (
                                                    <button
                                                        key={c}
                                                        type="button"
                                                        onClick={() => setProfileData({ ...profileData, primary_color: c })}
                                                        className={clsx(
                                                            "w-8 h-8 rounded-full border-4 shadow-sm flex-shrink-0 transition-transform hover:scale-110",
                                                            profileData.primary_color === c ? "border-primary" : "border-white"
                                                        )}
                                                        style={{ backgroundColor: c }}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 block">Logo da Academia (Upload)</label>
                                        <div className="flex items-center gap-6">
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handleFileUpload}
                                                className="hidden"
                                                id="logo-upload"
                                                disabled={uploading}
                                            />
                                            <label
                                                htmlFor="logo-upload"
                                                className={clsx(
                                                    "cursor-pointer px-8 py-5 rounded-2xl font-black transition-all flex items-center gap-3 border-2 border-dashed",
                                                    uploading ? "bg-slate-50 border-slate-200 text-slate-400" : "bg-white border-primary text-primary hover:bg-primary/5"
                                                )}
                                            >
                                                {uploading ? <RefreshCw className="animate-spin" size={20} /> : <ImageIcon size={20} />}
                                                {uploading ? 'ENVIANDO...' : 'SELECIONAR LOGO'}
                                            </label>
                                            {profileData.logo_url && (
                                                <button
                                                    type="button"
                                                    onClick={() => setProfileData({ ...profileData, logo_url: '' })}
                                                    className="text-red-500 text-xs font-black hover:underline uppercase tracking-tighter"
                                                >
                                                    REMOVER
                                                </button>
                                            )}
                                        </div>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">Formatos aceitos: PNG, JPG (Máx. 5MB).</p>
                                    </div>
                                    <div className="flex flex-col items-center justify-center bg-slate-50 rounded-[3rem] p-12 border-2 border-dashed border-slate-200 group relative">
                                        <div className="w-40 h-40 rounded-3xl bg-white shadow-2xl flex items-center justify-center mb-6 overflow-hidden outline outline-8 outline-white">
                                            {profileData.logo_url ? (
                                                <img src={formatImageUrl(profileData.logo_url)} alt="Preview" className="w-full h-full object-cover p-4" />
                                            ) : (
                                                <div className="flex flex-col items-center gap-2 opacity-20">
                                                    <Building2 size={64} className="text-slate-400" />
                                                </div>
                                            )}
                                        </div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Prévia da Logo</p>
                                    </div>
                                </div>
                                <div className="pt-4">
                                    <button
                                        disabled={loading}
                                        type="submit"
                                        className="bg-primary text-white px-12 py-5 rounded-[2rem] font-black hover:opacity-90 shadow-2xl shadow-primary/30 disabled:opacity-50 transition-all active:scale-95 flex items-center gap-3 text-sm uppercase tracking-widest"
                                    >
                                        {loading ? <RefreshCw className="animate-spin" size={20} /> : <Save size={20} />}
                                        SALVAR ALTERAÇÕES
                                    </button>
                                </div>
                            </form>
                        )}

                        {activeTab === 'security' && (
                            <form onSubmit={handleUpdatePassword} className="space-y-8 animate-fade-in max-w-lg">
                                <div className="space-y-6">
                                    <div>
                                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 block">Senha Atual</label>
                                        <input
                                            type="password"
                                            value={passwordData.currentPassword}
                                            onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                                            className="w-full bg-slate-50 border-none rounded-2xl p-4 font-bold text-slate-900 focus:ring-2 focus:ring-primary transition-all"
                                            required
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 block">Nova Senha</label>
                                            <input
                                                type="password"
                                                value={passwordData.newPassword}
                                                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                                className="w-full bg-slate-50 border-none rounded-2xl p-4 font-bold text-slate-900 focus:ring-2 focus:ring-primary transition-all"
                                                required
                                                minLength={6}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 block">Confirmar Nova Senha</label>
                                            <input
                                                type="password"
                                                value={passwordData.confirmPassword}
                                                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                                className="w-full bg-slate-50 border-none rounded-2xl p-4 font-bold text-slate-900 focus:ring-2 focus:ring-primary transition-all"
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="pt-4">
                                    <button
                                        disabled={loading}
                                        type="submit"
                                        className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-black hover:bg-black shadow-xl shadow-slate-900/20 disabled:opacity-50 transition-all active:scale-95 flex items-center gap-2"
                                    >
                                        {loading ? <RefreshCw className="animate-spin" size={20} /> : <Lock size={20} />}
                                        ATUALIZAR SENHA
                                    </button>
                                </div>
                            </form>
                        )}

                        {activeTab === 'access' && (
                            <form onSubmit={handleUpdateAccess} className="space-y-8 animate-fade-in">
                                <div className="grid md:grid-cols-2 gap-8">
                                    <div className="space-y-6">
                                        <div>
                                            <h4 className="text-sm font-black text-slate-900 mb-6 flex items-center gap-2 uppercase tracking-widest">
                                                <Clock size={16} className="text-primary" />
                                                Horário de Funcionamento
                                            </h4>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Abertura</label>
                                                    <input
                                                        type="time"
                                                        value={accessData.opening_time}
                                                        onChange={(e) => setAccessData({ ...accessData, opening_time: e.target.value })}
                                                        className="w-full bg-slate-50 border-none rounded-xl p-4 font-bold text-slate-900 focus:ring-2 focus:ring-primary transition-all"
                                                        required
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Fechamento</label>
                                                    <input
                                                        type="time"
                                                        value={accessData.closing_time}
                                                        onChange={(e) => setAccessData({ ...accessData, closing_time: e.target.value })}
                                                        className="w-full bg-slate-50 border-none rounded-xl p-4 font-bold text-slate-900 focus:ring-2 focus:ring-primary transition-all"
                                                        required
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        <h4 className="text-sm font-black text-slate-900 mb-6 flex items-center gap-2 uppercase tracking-widest">
                                            <AlertCircle size={16} className="text-primary" />
                                            Regras de Catraca
                                        </h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Intervalo (Minutos)</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={accessData.access_cooldown}
                                                    onChange={(e) => setAccessData({ ...accessData, access_cooldown: parseInt(e.target.value) })}
                                                    className="w-full bg-slate-50 border-none rounded-xl p-4 font-bold text-slate-900 focus:ring-2 focus:ring-primary transition-all"
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Acessos Diários</label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={accessData.max_daily_access}
                                                    onChange={(e) => setAccessData({ ...accessData, max_daily_access: parseInt(e.target.value) })}
                                                    className="w-full bg-slate-50 border-none rounded-xl p-4 font-bold text-slate-900 focus:ring-2 focus:ring-primary transition-all"
                                                    required
                                                />
                                            </div>
                                        </div>
                                        <p className="text-[10px] text-slate-400 font-bold">O intervalo evita que o aluno valide o acesso várias vezes seguidas.</p>
                                    </div>
                                </div>

                                <div className="p-8 bg-slate-50 rounded-[2rem] border-2 border-slate-100/50 flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all hover:border-primary/20">
                                    <div className="flex gap-4">
                                        <div className="w-14 h-14 rounded-2xl bg-white shadow-sm flex items-center justify-center text-primary flex-shrink-0">
                                            <Calendar size={28} />
                                        </div>
                                        <div>
                                            <h4 className="font-black text-slate-900 mb-1">Habilitar Agendamento / Horários Fixos</h4>
                                            <p className="text-slate-500 text-xs font-medium max-w-md">Ative esta opção se sua academia trabalha com horários reservados para treinos, avaliações ou personal trainers.</p>
                                        </div>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={accessData.enable_scheduling}
                                            onChange={(e) => setAccessData({ ...accessData, enable_scheduling: e.target.checked })}
                                        />
                                        <div className="w-16 h-8 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-7 after:transition-all peer-checked:bg-primary shadow-inner"></div>
                                    </label>
                                </div>

                                <div className="pt-4">
                                    <button
                                        disabled={loading}
                                        type="submit"
                                        className="bg-primary text-white px-10 py-4 rounded-2xl font-black hover:bg-primary/90 shadow-xl shadow-primary/20 disabled:opacity-50 transition-all active:scale-95 flex items-center gap-2"
                                    >
                                        {loading ? <RefreshCw className="animate-spin" size={20} /> : <Save size={20} />}
                                        SALVAR OPERACIONAL
                                    </button>
                                </div>
                            </form>
                        )}

                        {activeTab === 'notifications' && (
                            <form onSubmit={handleUpdateNotifications} className="space-y-8 animate-fade-in">
                                <div className="grid gap-6">
                                    <div>
                                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 block flex justify-between items-center">
                                            Check-in Confirmado
                                            <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-[10px] lowercase">{'{name}'} para o nome</span>
                                        </label>
                                        <textarea
                                            value={notificationData.checkin_success}
                                            onChange={(e) => setNotificationData({ ...notificationData, checkin_success: e.target.value })}
                                            className="w-full bg-slate-50 border-none rounded-2xl p-4 font-bold text-slate-900 focus:ring-2 focus:ring-primary transition-all h-24 resize-none"
                                            required
                                        />
                                    </div>
                                    <div className="grid md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 block">Alerta Vencimento</label>
                                            <textarea
                                                value={notificationData.plan_warning}
                                                onChange={(e) => setNotificationData({ ...notificationData, plan_warning: e.target.value })}
                                                className="w-full bg-slate-50 border-none rounded-2xl p-4 font-bold text-slate-900 focus:ring-2 focus:ring-primary transition-all h-32 resize-none"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 block">Acesso Bloqueado (Expirado)</label>
                                            <textarea
                                                value={notificationData.plan_expired}
                                                onChange={(e) => setNotificationData({ ...notificationData, plan_expired: e.target.value })}
                                                className="w-full bg-slate-50 border-none rounded-2xl p-4 font-bold text-slate-900 focus:ring-2 focus:ring-primary transition-all h-32 resize-none"
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="pt-4">
                                    <button
                                        disabled={loading}
                                        type="submit"
                                        className="bg-primary text-white px-10 py-4 rounded-2xl font-black hover:bg-primary/90 shadow-xl shadow-primary/20 disabled:opacity-50 transition-all active:scale-95 flex items-center gap-2"
                                    >
                                        {loading ? <RefreshCw className="animate-spin" size={20} /> : <Save size={20} />}
                                        SALVAR MENSAGENS
                                    </button>
                                </div>
                            </form>
                        )}

                        {activeTab === 'subscription' && (
                            <div className="space-y-8 animate-fade-in">
                                <div className="bg-slate-900 rounded-[2rem] p-8 text-white relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                                    <div className="relative z-10">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <p className="text-slate-400 font-bold text-sm uppercase tracking-widest mb-2">Seu Plano Atual</p>
                                                <h2 className="text-4xl font-black mb-1">{tenantData?.saas_plan?.name || "Assinatura Premium"}</h2>
                                                <p className="text-slate-300 font-medium">
                                                    {tenantData?.saas_plan_expires_at
                                                        ? `Válido até ${new Date(tenantData.saas_plan_expires_at).toLocaleDateString()}`
                                                        : 'Acesso total liberado'}
                                                </p>
                                            </div>
                                            <div className="px-4 py-2 bg-green-500/20 border border-green-500/30 text-green-400 rounded-full text-xs font-black uppercase tracking-widest">
                                                Ativo
                                            </div>
                                        </div>

                                        <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-6">
                                            <div className="bg-white/5 rounded-2xl p-4">
                                                <p className="text-xs text-slate-400 font-bold uppercase mb-1">Limite de Alunos</p>
                                                <p className="text-2xl font-black">{tenantData?.saas_plan?.max_members || "Ilimitado"}</p>
                                            </div>
                                            <div className="bg-white/5 rounded-2xl p-4">
                                                <p className="text-xs text-slate-400 font-bold uppercase mb-1">Preço Atual</p>
                                                <p className={clsx("font-black", tenantData?.saas_plan?.price ? "text-2xl" : "text-lg")}>
                                                    {tenantData?.saas_plan?.price ? `R$ ${tenantData.saas_plan.price}` : 'Personalizado'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-2 uppercase tracking-widest">
                                        <CreditCard size={20} className="text-primary" />
                                        Fazer Upgrade
                                    </h3>

                                    <div className="bg-slate-50 rounded-2xl p-8 text-center border-2 border-dashed border-slate-200">
                                        <p className="text-slate-500 font-medium mb-4">Deseja liberar mais alunos ou funcionalidades?</p>
                                        <button
                                            onClick={() => window.open('https://wa.me/5562995347257?text=Quero%20fazer%20upgrade%20do%20meu%20plano%20ZapFitness', '_blank')}
                                            className="bg-primary text-white px-8 py-4 rounded-xl font-black hover:bg-primary/90 shadow-xl shadow-primary/20 transition-all active:scale-95 inline-flex items-center gap-2"
                                        >
                                            <MessageSquare size={20} />
                                            FALAR COM O SUPORTE
                                        </button>
                                        <p className="mt-4 text-xs text-slate-400 font-bold">O upgrade é feito diretamente com nosso time comercial.</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
