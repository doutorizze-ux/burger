
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { CreditCard, QrCode, Lock, CheckCircle } from 'lucide-react';

interface Plan {
    id: string;
    name: string;
    price: number;
    duration_months: number;
}

interface Subscription {
    id: string;
    status: string;
    pix?: {
        encodedImage?: string;
        payload: string;
    };
}

export const PaymentPage = () => {
    const navigate = useNavigate();
    const [plan, setPlan] = useState<Plan | null>(null);
    const [loading, setLoading] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [billingType, setBillingType] = useState<'CREDIT_CARD' | 'PIX'>('CREDIT_CARD');

    // Form States
    const [cpfCnpj, setCpfCnpj] = useState('');
    const [phone, setPhone] = useState('');
    const [cardName, setCardName] = useState('');
    const [cardNumber, setCardNumber] = useState('');
    const [expiry, setExpiry] = useState('');
    const [cvv, setCvv] = useState('');

    const [subscription, setSubscription] = useState<Subscription | null>(null);

    useEffect(() => {
        // Fetch current tenant plan info
        api.get('/me')
            .then(res => {
                if (res.data.saas_plan) {
                    setPlan(res.data.saas_plan);
                } else {
                    console.warn("PaymentPage: User has no saas_plan data.");
                    alert("Por favor, escolha um plano para ativar sua conta.");
                    navigate('/');
                }

                console.log("PaymentPage: Status is", res.data.payment_status);
                if (res.data.payment_status === 'ACTIVE' || res.data.is_free) {
                    console.log("PaymentPage: Redirecting to dashboard...");
                    navigate('/dashboard');
                }
            })
            .catch(err => {
                console.error("PaymentPage Error:", err);
                // If 401, maybe redirect to login? But show error first for debugging.
                if (err.response?.status === 401) {
                    alert("Sessão expirada. Faça login novamente.");
                    navigate('/login');
                } else {
                    alert("Erro ao carregar dados do usuário: " + (err.response?.data?.error || err.message));
                }
            });
    }, [navigate]);

    const checkPaymentStatus = useCallback(async (manual = false) => {
        if (manual) setVerifying(true);
        try {
            const res = await api.get('/saas/payment-status');
            if (res.data.status === 'ACTIVE' || res.data.status === 'CONFIRMED' || res.data.status === 'RECEIVED') {
                alert('Pagamento confirmado! Bem-vindo ao ZapFitness.');
                navigate('/dashboard');
            } else if (manual) {
                alert('Ainda aguardando confirmação do banco. Pode levar alguns minutos.');
            }
        } catch (e) {
            console.error("Error checking status:", e);
        } finally {
            if (manual) setVerifying(false);
        }
    }, [navigate]);

    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        if (subscription && billingType === 'PIX') {
            // Poll for payment status every 5 seconds
            interval = setInterval(() => {
                checkPaymentStatus();
            }, 5000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [subscription, billingType, checkPaymentStatus]);

    const handleSubscribe = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const payload: Record<string, unknown> = {
                billingType,
                cpfCnpj: cpfCnpj.replace(/\D/g, ''),
                phone: phone.replace(/\D/g, '')
            };

            if (billingType === 'CREDIT_CARD') {
                const [month, year] = expiry.split('/');
                payload.creditCard = {
                    holderName: cardName,
                    number: cardNumber.replace(/\s/g, ''),
                    expiryMonth: month,
                    expiryYear: `20${year}`,
                    ccv: cvv,
                    cpfCnpj: cpfCnpj.replace(/\D/g, '') // Holder CPF same as tenant for simplicity
                };
            }

            const res = await api.post('/saas/subscribe', payload);
            // Merge response subscription and pix data
            setSubscription({ ...res.data.subscription, pix: res.data.pix });

            if (billingType === 'PIX') {
                // If Pix, we would need to fetch the QR Code. 
                // Since I didn't fully implement PIX fetch in backend yet, show message.
                alert('Assinatura criada via PIX! Verifique seu email para o pagamento.');
            } else {
                alert('Assinatura processada! Aguardando confirmação.');
                navigate('/dashboard');
            }

        } catch (err: unknown) {
            console.error('Subscription error:', err);
            const errorMsg = err && typeof err === 'object' && 'response' in err
                ? (err as { response: { data: { error: string } } }).response?.data?.error
                : 'Tente novamente';
            alert('Erro no pagamento: ' + errorMsg);
        } finally {
            setLoading(false);
        }
    };

    if (!plan) return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4 text-center">
            <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <h2 className="text-xl font-bold text-slate-800">Carregando dados do plano...</h2>
            <p className="text-slate-500 mt-2">Isso deve levar apenas um momento.</p>
            <button onClick={() => window.location.reload()} className="mt-6 text-orange-500 font-bold hover:underline">
                Recarregar Página
            </button>
        </div>
    );

    if (plan && subscription && billingType === 'PIX') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
                <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center">
                    <CheckCircle className="mx-auto text-green-500 mb-4" size={48} />
                    <h2 className="text-2xl font-bold mb-2">Assinatura Criada!</h2>

                    {subscription.pix?.encodedImage ? (
                        <div className="my-6">
                            <p className="text-slate-600 mb-2 font-medium">Escaneie o QR Code abaixo:</p>
                            <img src={`data:image/jpeg;base64,${subscription.pix.encodedImage}`} alt="Pix QR Code" className="mx-auto w-48 h-48 border rounded-lg" />

                            <div className="mt-4">
                                <p className="text-xs text-slate-500 mb-1">Ou copie e cole o código:</p>
                                <div className="bg-slate-100 p-2 rounded text-xs break-all text-slate-700 select-all cursor-pointer" onClick={() => {
                                    if (subscription.pix) {
                                        navigator.clipboard.writeText(subscription.pix.payload);
                                        alert('Código copiado!');
                                    }
                                }}>
                                    {subscription.pix.payload}
                                </div>
                                <button onClick={() => {
                                    if (subscription.pix) {
                                        navigator.clipboard.writeText(subscription.pix.payload);
                                        alert('Código copiado!');
                                    }
                                }} className="text-primary text-sm font-bold mt-2 hover:underline">
                                    Copiar Código
                                </button>
                            </div>
                        </div>
                    ) : (
                        <p className="text-slate-600 mb-6">Sua fatura Pix foi enviada para o email cadastrado. Verifique sua caixa de entrada.</p>
                    )}

                    <button
                        onClick={() => checkPaymentStatus(true)}
                        disabled={verifying}
                        className="bg-orange-500 text-white px-6 py-4 rounded-2xl font-black w-full shadow-lg shadow-orange-500/20 active:scale-95 transition-all mb-4 disabled:opacity-50"
                    >
                        {verifying ? 'VERIFICANDO...' : 'VERIFICAR PAGAMENTO AGORA'}
                    </button>

                    <button onClick={() => navigate('/dashboard')} className="text-slate-400 font-bold text-sm hover:text-slate-600 transition-colors">
                        Já paguei, ir para Dashboard
                    </button>
                    <p className="text-[10px] text-slate-400 mt-6 uppercase font-black tracking-widest">A liberação é automática e geralmente leva menos de 1 minuto.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Plan Summary */}
                <div className="bg-slate-900 text-white p-8 rounded-2xl h-fit sticky top-8">
                    <h2 className="text-2xl font-bold mb-6">Resumo do Pedido</h2>
                    <div className="mb-8">
                        <span className="text-sm text-slate-400 uppercase tracking-wider">Plano Escolhido</span>
                        <div className="flex justify-between items-end mt-2">
                            <h3 className="text-3xl font-bold">{plan.name}</h3>
                            <span className="text-2xl font-light">
                                R$ {plan.price}
                                <span className="text-sm text-slate-400">
                                    {plan.duration_months === 1 ? '/mês' :
                                        plan.duration_months === 3 ? '/trimestre' :
                                            plan.duration_months === 6 ? '/semestre' :
                                                plan.duration_months === 12 ? '/ano' :
                                                    ` / ${plan.duration_months} meses`}
                                </span>
                            </span>
                        </div>
                    </div>
                    <ul className="space-y-4 mb-8 text-slate-300">
                        <li className="flex gap-2"><CheckCircle size={20} className="text-green-400" /> Acesso Imediato</li>
                        <li className="flex gap-2"><CheckCircle size={20} className="text-green-400" /> Configure seu WhatsApp</li>
                        <li className="flex gap-2"><CheckCircle size={20} className="text-green-400" /> Cancele quando quiser</li>
                    </ul>
                    <div className="pt-8 border-t border-slate-700">
                        <div className="flex justify-between font-bold text-lg">
                            <span>Total Hoje</span>
                            <span>R$ {plan.price}</span>
                        </div>
                    </div>
                </div>

                {/* Payment Form */}
                <div className="bg-white p-8 rounded-2xl shadow-sm">
                    <h2 className="text-2xl font-bold text-slate-800 mb-6">Pagamento</h2>

                    <div className="flex gap-4 mb-8">
                        <button
                            onClick={() => setBillingType('CREDIT_CARD')}
                            className={`flex-1 p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition ${billingType === 'CREDIT_CARD' ? 'border-primary bg-orange-50 text-primary' : 'border-slate-100 hover:border-slate-200'}`}
                        >
                            <CreditCard />
                            <span className="font-bold text-sm">Cartão de Crédito</span>
                        </button>
                        <button
                            onClick={() => setBillingType('PIX')}
                            className={`flex-1 p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition ${billingType === 'PIX' ? 'border-primary bg-orange-50 text-primary' : 'border-slate-100 hover:border-slate-200'}`}
                        >
                            <QrCode />
                            <span className="font-bold text-sm">Pix</span>
                        </button>
                    </div>

                    <form onSubmit={handleSubscribe} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700">CPF/CNPJ do Titular</label>
                            <input required value={cpfCnpj} onChange={e => setCpfCnpj(e.target.value)} type="text" placeholder="000.000.000-00" className="mt-1 block w-full border border-gray-300 rounded p-3" />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700">Telefone / WhatsApp</label>
                            <input required value={phone} onChange={e => setPhone(e.target.value)} type="tel" placeholder="(11) 99999-9999" className="mt-1 block w-full border border-gray-300 rounded p-3" />
                        </div>

                        {billingType === 'CREDIT_CARD' && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700">Nome no Cartão</label>
                                    <input required value={cardName} onChange={e => setCardName(e.target.value)} type="text" placeholder="JOAO A SILVA" className="mt-1 block w-full border border-gray-300 rounded p-3" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700">Número do Cartão</label>
                                    <input required value={cardNumber} onChange={e => setCardNumber(e.target.value)} type="text" placeholder="0000 0000 0000 0000" className="mt-1 block w-full border border-gray-300 rounded p-3" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700">Validade</label>
                                        <input required value={expiry} onChange={e => setExpiry(e.target.value)} type="text" placeholder="MM/AA" className="mt-1 block w-full border border-gray-300 rounded p-3" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700">CVV</label>
                                        <input required value={cvv} onChange={e => setCvv(e.target.value)} type="text" placeholder="123" className="mt-1 block w-full border border-gray-300 rounded p-3" />
                                    </div>
                                </div>
                            </>
                        )}

                        <div className="bg-slate-50 p-4 rounded text-xs text-slate-500 flex items-start gap-2">
                            <Lock size={14} className="mt-0.5 shrink-0" />
                            Seus dados são processados de forma segura e criptografada diretamente com o banco.
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-primary text-white py-4 rounded-xl font-bold text-lg hover:bg-orange-600 transition shadow-lg shadow-primary/30 flex items-center justify-center gap-2"
                        >
                            {loading ? 'Processando...' : `Pagar R$ ${plan.price}`}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};
