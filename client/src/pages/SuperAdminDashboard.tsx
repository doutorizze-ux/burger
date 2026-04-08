import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { LogOut, Activity, Users, Store, ShieldAlert, Power, Pencil, Trash2, WifiOff, DollarSign, Key } from 'lucide-react';
import clsx from 'clsx';
import { formatImageUrl } from '../utils/format';

interface AdminMember {
    email: string;
}

interface Tenant {
    id: string;
    name: string;
    owner_phone?: string;
    is_free: boolean;
    saas_plan_expires_at?: string;
    status: string;
    whatsapp_status: string;
    slug: string;
    admins: AdminMember[];
    saas_plan?: {
        name: string;
    };
}

interface StatDetails {
    totalGyms: number;
    activeGyms: number;
    blockedGyms: number;
    totalMembers: number;
}

interface SaaSPlan {
    id: string;
    name: string;
    price: string;
    duration_months: number;
    max_members: number;
}

interface FinanceSummary {
    total_revenue: number;
    pending_revenue: number;
}

interface FinancePayment {
    id: string;
    tenant?: {
        name: string;
    };
    amount: string;
    status: string;
    created_at: string;
}

interface FinanceData {
    summary: FinanceSummary;
    payments: FinancePayment[];
}

export const SuperAdminDashboard = () => {
    const navigate = useNavigate();
    const [stats, setStats] = useState<StatDetails | null>(null);
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [plans, setPlans] = useState<SaaSPlan[]>([]);
    const [financeData, setFinanceData] = useState<FinanceData | null>(null);
    const [showPlanModal, setShowPlanModal] = useState(false);
    const [newPlan, setNewPlan] = useState({ name: '', price: '', max_members: '', duration_months: '1', description: '' });
    const [systemSettings, setSystemSettings] = useState({ site_name: 'ZapFitness', logo_url: '' });
    const [activeTab, setActiveTab] = useState<'gyms' | 'plans' | 'finance' | 'settings'>('gyms');
    const [uploading, setUploading] = useState(false);

    // Edit Tenant State
    const [editingTenant, setEditingTenant] = useState<Partial<Tenant> | null>(null);
    const [showTenantModal, setShowTenantModal] = useState(false);

    // Admin Management State (for the modal)
    const [adminEmail, setAdminEmail] = useState('');
    const [adminPassword, setAdminPassword] = useState('');

    const fetchData = useCallback(() => {
        api.get('/saas/dashboard').then(res => setStats(res.data)).catch(err => {
            if (err.response?.status === 403) navigate('/admin/login');
        });
        api.get('/saas/tenants').then(res => setTenants(res.data)).catch(err => {
            if (err.response?.status === 403) navigate('/admin/login');
        });
        api.get('/saas/plans').then(res => setPlans(res.data)).catch(err => {
            if (err.response?.status === 403) navigate('/admin/login');
        });
        api.get('/system/settings').then(res => setSystemSettings(res.data)).catch(console.error);

        // Fetch finance data
        api.get('/saas/finance').then(res => setFinanceData(res.data)).catch(console.error);
    }, [navigate]);

    const handleCreatePlan = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            // Transform description lines into features array
            const features = newPlan.description
                .split('\n')
                .map(f => f.trim())
                .filter(f => f.length > 0);

            await api.post('/saas/plans', {
                ...newPlan,
                features: features.length > 0 ? features : undefined
            });
            setShowPlanModal(false);
            setNewPlan({ name: '', price: '', max_members: '', duration_months: '1', description: '' });
            fetchData();
        } catch (err: unknown) {
            console.error('Error creating plan:', err);
            const errorMsg = err && typeof err === 'object' && 'response' in err
                ? (err as any).response?.data?.error
                : 'Erro ao criar plano';
            alert(errorMsg);
        }
    };

    const handleDeletePlan = async (id: string) => {
        if (!confirm('Tem certeza?')) return;
        try {
            await api.delete(`/saas/plans/${id}`);
            fetchData();
        } catch (err) {
            console.error('Error deleting plan:', err);
            alert('Erro ao excluir plano');
        }
    };

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        const user = storedUser ? JSON.parse(storedUser) : {};
        if (user.role !== 'SAAS_OWNER') {
            navigate('/admin/login');
            return;
        }
        fetchData();
    }, [fetchData, navigate]);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/admin/login');
    };

    const handleToggle = async (id: string) => {
        try {
            await api.post(`/saas/tenants/${id}/toggle`);
            fetchData();
        } catch (err) {
            console.error('Error toggling tenant:', err);
            alert('Erro ao alterar status');
        }
    };

    // New Actions
    const handleEditTenant = (tenant: Tenant) => {
        setEditingTenant({
            id: tenant.id,
            name: tenant.name,
            owner_phone: tenant.owner_phone || '',
            is_free: tenant.is_free || false,
            saas_plan_expires_at: tenant.saas_plan_expires_at ? tenant.saas_plan_expires_at.split('T')[0] : ''
        });
        // Pre-fill admin email if available
        setAdminEmail(tenant.admins?.[0]?.email || '');
        setAdminPassword(''); // Reset password field
        setShowTenantModal(true);
    };

    const handleSaveTenant = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingTenant) return;
        try {
            // 1. Update Tenant Info
            await api.put(`/saas/tenants/${editingTenant.id}`, editingTenant);

            // 2. Update Admin Info (if changed)
            if (adminEmail || adminPassword) {
                await api.put(`/saas/tenants/${editingTenant.id}/admin`, {
                    email: adminEmail,
                    password: adminPassword || undefined // Only send if not empty
                });
            }

            setShowTenantModal(false);
            setEditingTenant(null);
            setAdminEmail('');
            setAdminPassword('');
            fetchData();
            alert('Academia atualizada com sucesso!');
        } catch (err: unknown) {
            console.error('Save tenant error:', err);
            const errorMsg = err && typeof err === 'object' && 'message' in err ? (err as { message: string }).message : 'Erro desconhecido';
            alert('Erro ao salvar: ' + errorMsg);
        }
    };

    const handleDeleteTenant = async (id: string) => {
        if (!confirm('ATENÇÃO: Isso excluirá permanentemente a academia e todos os seus dados. Continuar?')) return;
        try {
            await api.delete(`/saas/tenants/${id}`);
            fetchData();
        } catch (err) {
            console.error('Delete error:', err);
            alert('Erro ao excluir');
        }
    };

    const handleDisconnect = async (id: string) => {
        if (!confirm('Desconectar o WhatsApp desta academia?')) return;
        try {
            await api.post(`/saas/tenants/${id}/disconnect`);
            fetchData();
            alert('WhatsApp desconectado com sucesso.');
        } catch (err) {
            console.error('Disconnect error:', err);
            alert('Erro ao desconectar');
        }
    };

    const handleSaveSettings = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.put('/system/settings', systemSettings);
            alert('Configurações salvas com sucesso!');
            fetchData();
        } catch (err) {
            console.error('Settings save error:', err);
            alert('Erro ao salvar as configurações.');
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
            setSystemSettings({ ...systemSettings, logo_url: res.data.url });
        } catch (err) {
            console.error('Upload error:', err);
            alert('Erro ao fazer upload da imagem.');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-100">
            <nav className="bg-slate-900 text-white p-4 shadow-lg">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center font-bold">
                            {systemSettings.logo_url ? (
                                <img src={systemSettings.logo_url} alt="Logo" className="w-full h-full object-cover" />
                            ) : (
                                <div className="bg-primary w-full h-full flex items-center justify-center">Z</div>
                            )}
                        </div>
                        <div>
                            <h1 className="text-xl font-bold">{systemSettings.site_name}</h1>
                            <span className="text-xs text-slate-400 uppercase tracking-widest">Super Admin</span>
                        </div>
                    </div>
                    <button onClick={handleLogout} className="flex items-center gap-2 hover:text-red-400 transition">
                        <LogOut size={20} />
                        Sair
                    </button>
                </div>
            </nav>

            <main className="p-8 max-w-7xl mx-auto">
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-blue-500">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="text-slate-500 font-bold text-sm">Total Academias</h3>
                            <Store className="text-blue-500" size={20} />
                        </div>
                        <p className="text-3xl font-bold text-slate-800">{stats?.totalGyms || 0}</p>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-green-500">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="text-slate-500 font-bold text-sm">Ativas</h3>
                            <Activity className="text-green-500" size={20} />
                        </div>
                        <p className="text-3xl font-bold text-slate-800">{stats?.activeGyms || 0}</p>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-red-500">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="text-slate-500 font-bold text-sm">Bloqueadas</h3>
                            <ShieldAlert className="text-red-500" size={20} />
                        </div>
                        <p className="text-3xl font-bold text-slate-800">{stats?.blockedGyms || 0}</p>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-purple-500">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="text-slate-500 font-bold text-sm">Total Membros</h3>
                            <Users className="text-purple-500" size={20} />
                        </div>
                        <p className="text-3xl font-bold text-slate-800">{stats?.totalMembers || 0}</p>
                    </div>
                </div>

                {/* Main Tabs Navigation */}
                <div className="flex gap-4 mb-8">
                    <button onClick={() => setActiveTab('gyms')} className={clsx("px-6 py-2 rounded-lg font-black transition-all", activeTab === 'gyms' ? "bg-slate-900 text-white" : "bg-white text-slate-500 hover:bg-slate-50")}>ACADEMIAS</button>
                    <button onClick={() => setActiveTab('plans')} className={clsx("px-6 py-2 rounded-lg font-black transition-all", activeTab === 'plans' ? "bg-slate-900 text-white" : "bg-white text-slate-500 hover:bg-slate-50")}>PLANOS SAAS</button>
                    <button onClick={() => setActiveTab('finance')} className={clsx("px-6 py-2 rounded-lg font-black transition-all", activeTab === 'finance' ? "bg-slate-900 text-white" : "bg-white text-slate-500 hover:bg-slate-50")}>FINANCEIRO</button>
                    <button onClick={() => setActiveTab('settings')} className={clsx("px-6 py-2 rounded-lg font-black transition-all", activeTab === 'settings' ? "bg-slate-900 text-white" : "bg-white text-slate-500 hover:bg-slate-50")}>SISTEMA</button>
                </div>

                <div className="grid grid-cols-1 gap-8">
                    {/* Tenants List */}
                    {activeTab === 'gyms' && (
                        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-slate-100">
                                <h2 className="text-xl font-bold text-slate-800">Gerenciar Academias</h2>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50 text-slate-500 font-medium">
                                        <tr>
                                            <th className="p-4">Academia</th>
                                            <th className="p-4">Plano</th>
                                            <th className="p-4">Status</th>
                                            <th className="p-4 text-right">Ação</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {tenants.map(tenant => (
                                            <tr key={tenant.id} className="hover:bg-slate-50 transition">
                                                <td className="p-4">
                                                    <p className="font-bold text-slate-800">{tenant.name}</p>
                                                    <p className="text-xs text-slate-600 font-medium">{tenant.admins?.[0]?.email}</p>
                                                    <p className="text-xs text-slate-500">{tenant.slug}</p>
                                                    <p className="text-xs text-slate-400">{tenant.owner_phone}</p>
                                                    {tenant.is_free && (
                                                        <span className="inline-block mt-1 bg-green-100 text-green-700 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                                                            CONTA CORTESIA
                                                        </span>
                                                    )}
                                                    <span className={` ml-2 text-[10px] uppercase font-bold ${tenant.whatsapp_status === 'CONNECTED' ? 'text-green-500' : 'text-slate-400'}`}>
                                                        WA: {tenant.whatsapp_status}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-slate-600">{tenant.saas_plan?.name || '-'}</td>
                                                <td className="p-4">
                                                    <div className="flex flex-col gap-1">
                                                        <span className={`px-2 py-1 rounded text-xs font-bold w-fit ${tenant.status === 'ACTIVE' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                                                            {tenant.status === 'ACTIVE' ? 'LIBERADO' : 'BLOQUEADO'}
                                                        </span>
                                                        {tenant.saas_plan_expires_at && (
                                                            <span className={`px-2 py-1 rounded text-xs font-bold w-fit ${new Date(tenant.saas_plan_expires_at) > new Date() ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                                                {new Date(tenant.saas_plan_expires_at) > new Date()
                                                                    ? `VENCE: ${new Date(tenant.saas_plan_expires_at).toLocaleDateString()}`
                                                                    : `VENCEU: ${new Date(tenant.saas_plan_expires_at).toLocaleDateString()}`}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-4 text-right flex justify-end gap-1">
                                                    <button onClick={() => handleEditTenant(tenant)} className="p-2 text-blue-500 hover:bg-blue-50 rounded" title="Editar">
                                                        <Pencil size={18} />
                                                    </button>
                                                    <button onClick={() => handleToggle(tenant.id)} className={`p-2 rounded ${tenant.status === 'ACTIVE' ? 'text-orange-500 hover:bg-orange-50' : 'text-green-500 hover:bg-green-50'}`} title={tenant.status === 'ACTIVE' ? 'Bloquear' : 'Ativar'}>
                                                        <Power size={18} />
                                                    </button>
                                                    <button onClick={() => handleDisconnect(tenant.id)} className="p-2 text-slate-500 hover:bg-slate-100 rounded" title="Desconectar WhatsApp">
                                                        <WifiOff size={18} />
                                                    </button>
                                                    <button onClick={() => handleDeleteTenant(tenant.id)} className="p-2 text-red-500 hover:bg-red-50 rounded" title="Excluir Permanentemente">
                                                        <Trash2 size={18} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Plans Management */}
                    {activeTab === 'plans' && (
                        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                                <h2 className="text-xl font-bold text-slate-800">Planos SaaS</h2>
                                <button onClick={() => setShowPlanModal(true)} className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-800 transition">
                                    + Novo Plano
                                </button>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50 text-slate-500 font-medium">
                                        <tr>
                                            <th className="p-4">Nome</th>
                                            <th className="p-4">Preço</th>
                                            <th className="p-4">Período</th>
                                            <th className="p-4">Max Membros</th>
                                            <th className="p-4 text-right">Ação</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {plans.map(plan => (
                                            <tr key={plan.id} className="hover:bg-slate-50 transition">
                                                <td className="p-4 font-bold text-slate-800">{plan.name}</td>
                                                <td className="p-4 text-slate-600">R$ {parseFloat(plan.price).toFixed(2)}</td>
                                                <td className="p-4 text-slate-600">{plan.duration_months} {plan.duration_months === 1 ? 'mês' : 'meses'}</td>
                                                <td className="p-4 text-slate-600">{plan.max_members}</td>
                                                <td className="p-4 text-right">
                                                    <button onClick={() => handleDeletePlan(plan.id)} className="text-red-500 hover:text-red-700 p-2">
                                                        Excluir
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Finance Tab */}
                    {activeTab === 'finance' && (
                        <div className="grid grid-cols-1 gap-6">
                            {/* Summary Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-green-500">
                                    <div className="flex justify-between items-center mb-2">
                                        <h3 className="text-slate-500 font-bold text-sm">Receita Total (Pago)</h3>
                                        <DollarSign className="text-green-500" size={20} />
                                    </div>
                                    <p className="text-3xl font-bold text-slate-800">
                                        R$ {financeData?.summary?.total_revenue?.toFixed(2) || '0.00'}
                                    </p>
                                </div>
                                <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-orange-500">
                                    <div className="flex justify-between items-center mb-2">
                                        <h3 className="text-slate-500 font-bold text-sm">Pendente</h3>
                                        <Activity className="text-orange-500" size={20} />
                                    </div>
                                    <p className="text-3xl font-bold text-slate-800">
                                        R$ {financeData?.summary?.pending_revenue?.toFixed(2) || '0.00'}
                                    </p>
                                </div>
                            </div>

                            {/* Transactions Table */}
                            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                                <div className="p-6 border-b border-slate-100">
                                    <h2 className="text-xl font-bold text-slate-800">Transações Recentes</h2>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-slate-50 text-slate-500 font-medium">
                                            <tr>
                                                <th className="p-4">Academia</th>
                                                <th className="p-4">Valor</th>
                                                <th className="p-4">Status</th>
                                                <th className="p-4">Data</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {financeData?.payments?.map((payment: FinancePayment) => (
                                                <tr key={payment.id} className="hover:bg-slate-50 transition">
                                                    <td className="p-4 font-bold text-slate-800">{payment.tenant?.name || 'Academia Removida'}</td>
                                                    <td className="p-4 font-mono text-slate-600">R$ {parseFloat(payment.amount).toFixed(2)}</td>
                                                    <td className="p-4">
                                                        <span className={`px-2 py-1 rounded text-xs font-bold ${payment.status === 'PAID' || payment.status === 'CONFIRMED' || payment.status === 'RECEIVED'
                                                            ? 'bg-green-100 text-green-700'
                                                            : payment.status === 'FAILED'
                                                                ? 'bg-red-100 text-red-700'
                                                                : 'bg-orange-100 text-orange-700'
                                                            }`}>
                                                            {payment.status}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-slate-500">
                                                        {new Date(payment.created_at).toLocaleDateString()}
                                                    </td>
                                                </tr>
                                            ))}
                                            {(!financeData?.payments || financeData.payments.length === 0) && (
                                                <tr>
                                                    <td colSpan={4} className="p-8 text-center text-slate-400">Nenhuma transação encontrada.</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* System Settings Tab */}
                    {activeTab === 'settings' && (
                        <div className="bg-white rounded-xl shadow-sm overflow-hidden p-8">
                            <h2 className="text-xl font-bold text-slate-800 mb-6 border-b pb-4">Configurações Globais do Sistema</h2>
                            <form onSubmit={handleSaveSettings} className="max-w-xl space-y-6">
                                <div>
                                    <label className="block text-sm font-black text-slate-400 uppercase tracking-widest mb-2">Nome do Sistema</label>
                                    <input
                                        type="text"
                                        value={systemSettings.site_name}
                                        onChange={(e) => setSystemSettings({ ...systemSettings, site_name: e.target.value })}
                                        className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
                                        placeholder="Ex: ZapFitness"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-black text-slate-400 uppercase tracking-widest mb-2">Logo do Sistema (Upload)</label>
                                    <div className="flex items-center gap-4">
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
                                                "cursor-pointer px-6 py-3 rounded-lg font-bold border-2 border-dashed transition-all",
                                                uploading ? "bg-slate-50 border-slate-200 text-slate-400" : "bg-white border-primary text-primary hover:bg-primary/5"
                                            )}
                                        >
                                            {uploading ? 'Enviando...' : 'Selecionar Imagem'}
                                        </label>
                                        {systemSettings.logo_url && (
                                            <button
                                                type="button"
                                                onClick={() => setSystemSettings({ ...systemSettings, logo_url: '' })}
                                                className="text-red-500 text-xs font-bold hover:underline"
                                            >
                                                Remover
                                            </button>
                                        )}
                                    </div>
                                    <p className="mt-2 text-xs text-slate-400">Tamanho recomendado: 512x512px. Formatos: PNG, JPG.</p>
                                </div>
                                <div className="p-6 bg-slate-50 rounded-xl flex items-center gap-6 border border-slate-100">
                                    <div className="w-16 h-16 bg-white rounded-xl shadow-inner flex items-center justify-center overflow-hidden border">
                                        {systemSettings.logo_url ? (
                                            <img src={formatImageUrl(systemSettings.logo_url)} alt="Preview" className="w-full h-full object-cover" />
                                        ) : (
                                            <Activity className="text-slate-200" size={32} />
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Prévia da Identidade</p>
                                        <h3 className="text-xl font-black text-slate-900">{systemSettings.site_name}</h3>
                                    </div>
                                </div>
                                <div>
                                    <button type="submit" className="bg-slate-900 text-white px-8 py-3 rounded-lg font-bold hover:bg-slate-800 transition shadow-lg">
                                        Salvar Configurações
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}
                </div>

                {/* Edit Tenant Modal */}
                {
                    showTenantModal && (
                        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md animate-fade-in-up max-h-[90vh] overflow-y-auto">
                                <h2 className="text-xl font-bold mb-4">Editar Academia</h2>
                                <form onSubmit={handleSaveTenant} className="space-y-4">
                                    <div className="border-b pb-4 mb-4">
                                        <h3 className="text-sm font-bold text-slate-500 uppercase mb-2">Dados da Academia</h3>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700">Nome da Academia</label>
                                            <input required type="text" value={editingTenant?.name || ''} onChange={e => editingTenant && setEditingTenant({ ...editingTenant, name: e.target.value })} className="mt-1 block w-full border border-gray-300 rounded p-2" />
                                        </div>
                                        <div className="mt-2">
                                            <label className="block text-sm font-medium text-slate-700">Telefone do Dono</label>
                                            <input type="text" value={editingTenant?.owner_phone || ''} onChange={e => editingTenant && setEditingTenant({ ...editingTenant, owner_phone: e.target.value })} className="mt-1 block w-full border border-gray-300 rounded p-2" />
                                        </div>
                                        <div className="flex items-center gap-2 py-2 mt-2">
                                            <input
                                                type="checkbox"
                                                id="is_free"
                                                checked={editingTenant?.is_free || false}
                                                onChange={e => editingTenant && setEditingTenant({ ...editingTenant, is_free: e.target.checked })}
                                                className="w-4 h-4 text-primary rounded"
                                            />
                                            <label htmlFor="is_free" className="text-sm font-bold text-slate-700 cursor-pointer">
                                                Acesso Cortesia (Sem mensalidade)
                                            </label>
                                        </div>
                                        <div className="mt-2">
                                            <label className="block text-sm font-medium text-slate-700">Data de Expiração (Plano)</label>
                                            <input
                                                type="date"
                                                value={editingTenant?.saas_plan_expires_at || ''}
                                                onChange={e => editingTenant && setEditingTenant({ ...editingTenant, saas_plan_expires_at: e.target.value })}
                                                className="mt-1 block w-full border border-gray-300 rounded p-2"
                                            />
                                            <p className="text-xs text-slate-500 mt-1">Define quando o acesso será bloqueado automaticamente.</p>
                                        </div>
                                    </div>

                                    <div className="border-b pb-4 mb-4 bg-slate-50 p-4 rounded-lg">
                                        <h3 className="text-sm font-bold text-slate-500 uppercase mb-2 flex items-center gap-2">
                                            <Key size={14} /> Acesso Admin
                                        </h3>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700">Email de Acesso</label>
                                            <input
                                                type="email"
                                                value={adminEmail}
                                                onChange={e => setAdminEmail(e.target.value)}
                                                className="mt-1 block w-full border border-gray-300 rounded p-2"
                                                placeholder="email@exemplo.com"
                                            />
                                        </div>
                                        <div className="mt-2">
                                            <label className="block text-sm font-medium text-slate-700">Nova Senha (deixe em branco para manter)</label>
                                            <input
                                                type="password"
                                                value={adminPassword}
                                                onChange={e => setAdminPassword(e.target.value)}
                                                className="mt-1 block w-full border border-gray-300 rounded p-2"
                                                placeholder="********"
                                            />
                                            <p className="text-xs text-slate-400 mt-1">Preencha apenas se quiser resetar a senha deste usuário.</p>
                                        </div>
                                    </div>

                                    <div className="flex justify-end gap-2 mt-6">
                                        <button type="button" onClick={() => setShowTenantModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded">Cancelar</button>
                                        <button type="submit" className="px-4 py-2 bg-slate-900 text-white rounded hover:bg-slate-800">Salvar Alterações</button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )
                }

                {/* Create Plan Modal */}
                {
                    showPlanModal && (
                        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md animate-fade-in-up">
                                <h2 className="text-xl font-bold mb-4">Novo Plano</h2>
                                <form onSubmit={handleCreatePlan} className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700">Nome do Plano</label>
                                        <input required type="text" value={newPlan.name} onChange={e => setNewPlan({ ...newPlan, name: e.target.value })} className="mt-1 block w-full border border-gray-300 rounded p-2" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700">Preço (R$)</label>
                                            <input required type="number" step="0.01" value={newPlan.price} onChange={e => setNewPlan({ ...newPlan, price: e.target.value })} className="mt-1 block w-full border border-gray-300 rounded p-2" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700">Período</label>
                                            <select
                                                required
                                                value={newPlan.duration_months}
                                                onChange={e => setNewPlan({ ...newPlan, duration_months: e.target.value })}
                                                className="mt-1 block w-full border border-gray-300 rounded p-2 bg-white"
                                            >
                                                <option value="1">Mensal</option>
                                                <option value="3">Trimestral</option>
                                                <option value="6">Semestral</option>
                                                <option value="12">Anual</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700">Max Membros</label>
                                        <input required type="number" value={newPlan.max_members} onChange={e => setNewPlan({ ...newPlan, max_members: e.target.value })} className="mt-1 block w-full border border-gray-300 rounded p-2" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700">Funcionalidades do Plano (uma por linha)</label>
                                        <textarea value={newPlan.description} onChange={e => setNewPlan({ ...newPlan, description: e.target.value })} className="mt-1 block w-full border border-gray-300 rounded p-2" rows={3} placeholder="Ex:&#10;Até 100 alunos&#10;Suporte VIP&#10;Relatórios PDF"></textarea>
                                    </div>
                                    <div className="flex justify-end gap-2 mt-6">
                                        <button type="button" onClick={() => setShowPlanModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded">Cancelar</button>
                                        <button type="submit" className="px-4 py-2 bg-slate-900 text-white rounded hover:bg-slate-800">Criar Plano</button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )
                }
            </main >
        </div >
    );
};
