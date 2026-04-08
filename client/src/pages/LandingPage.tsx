import { Bot, Zap, Rocket, ChevronRight, CheckCircle2 } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 selection:bg-orange-500 selection:text-white">
      {/* Header */}
      <header className="fixed w-full top-0 bg-white/80 backdrop-blur-md z-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-orange-500/30">🍔</div>
            <h1 className="font-extrabold text-2xl tracking-tight">PitDog<span className="text-orange-500">.ai</span></h1>
          </div>
          <div className="flex gap-4">
            <a href="/login" className="font-bold text-slate-600 hover:text-slate-900 px-4 py-2">Fazer Login</a>
            <a href="/login?register=true" className="bg-slate-900 text-white font-bold px-6 py-2.5 rounded-full hover:bg-slate-800 transition-all shadow-md">Criar minha Conta</a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-40 pb-20 px-6 max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-16">
        <div className="lg:w-1/2 space-y-8">
          <div className="inline-flex items-center gap-2 bg-orange-100 text-orange-700 font-bold px-4 py-2 rounded-full text-sm">
            <span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500"></span></span>
            A Revolução do Delivery
          </div>
          <h1 className="text-6xl font-black text-slate-900 leading-tight tracking-tight">O Fim dos Atendentes Lentos no seu Delivery.</h1>
          <p className="text-xl text-slate-600 font-medium leading-relaxed">Substitua o atendimento manual por uma Inteligência Artificial que vende, recomenda adicionais e cobra seus clientes 100% no automático dentro do WhatsApp.</p>
          <div className="flex gap-4 pt-4">
            <a href="/login?register=true" className="bg-orange-500 text-white font-black text-lg px-8 py-4 rounded-full hover:bg-orange-600 transition-all shadow-xl shadow-orange-500/20 flex items-center gap-2">Testar 7 dias Grátis <ChevronRight/></a>
          </div>
          <div className="flex items-center gap-4 text-sm font-bold text-slate-500">
            <span className="flex items-center gap-1"><CheckCircle2 size={16} className="text-green-500"/> Sem fidelidade</span>
            <span className="flex items-center gap-1"><CheckCircle2 size={16} className="text-green-500"/> Setup em 2 minutos</span>
          </div>
        </div>
        <div className="lg:w-1/2 relative">
           <div className="absolute inset-0 bg-gradient-to-tr from-orange-400 to-pink-500 rounded-full blur-3xl opacity-20 animate-pulse"></div>
           <div className="relative bg-slate-900 border-[8px] border-slate-800 rounded-[3rem] shadow-2xl p-6 aspect-[9/18] max-w-sm mx-auto flex flex-col">
              <div className="w-32 h-6 bg-slate-800 rounded-b-3xl absolute top-0 left-1/2 -translate-x-1/2"></div>
              <div className="flex-1 overflow-hidden flex flex-col">
                 <div className="bg-slate-800 p-4 rounded-xl mb-4 flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white"><Bot size={20}/></div>
                    <div><p className="text-white font-bold text-sm">Robô PitDog</p><p className="text-green-400 text-xs font-semibold">Online agora</p></div>
                 </div>
                 <div className="flex-1 space-y-4">
                    <div className="bg-white text-slate-800 p-3 rounded-2xl rounded-tl-sm w-[85%] text-sm font-medium">Olá! Bem-vindo! Escolha: 1- Burguers 2- Bebidas</div>
                    <div className="bg-green-500 text-white p-3 rounded-2xl rounded-tr-sm w-fit ml-auto text-sm font-medium">1</div>
                    <div className="bg-white text-slate-800 p-3 rounded-2xl rounded-tl-sm w-[85%] text-sm font-medium">Excelente. Deseja adicionar Extra Bacon?</div>
                 </div>
              </div>
           </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 bg-white border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-3 gap-12">
          <div className="space-y-4">
            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center"><Bot size={32}/></div>
            <h3 className="text-2xl font-extrabold">Vendedor 24 Horas</h3>
            <p className="text-slate-600 font-medium">O garçom robô nunca dorme, nunca tira folga e não erra o troco. Ele gerencia 50 clientes ao mesmo tempo sem suar a camisa.</p>
          </div>
          <div className="space-y-4">
            <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center"><Zap size={32}/></div>
            <h3 className="text-2xl font-extrabold">Adicionais Otimizados</h3>
            <p className="text-slate-600 font-medium">Nosso robô é treinado para sempre fazer "Upsell", oferecendo bacon, cheddar ou bebida extra, aumentando seu Ticket Médio.</p>
          </div>
          <div className="space-y-4">
            <div className="w-16 h-16 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center"><Rocket size={32}/></div>
            <h3 className="text-2xl font-extrabold">Painel Profissional</h3>
            <p className="text-slate-600 font-medium">Acompanhe todos os pedidos caindo em tempo real na sua tela, estilo iFood, mas direto do seu próprio WhatsApp sem taxas em cima do pedido.</p>
          </div>
        </div>
      </section>

      <section className="py-24 bg-slate-900 text-center px-6">
        <h2 className="text-4xl md:text-5xl font-black text-white mb-6">Pare de pagar 27% para aplicativos e seja dono do seu cliente.</h2>
        <p className="text-xl text-slate-400 font-medium mb-12 max-w-2xl mx-auto">Com R$ 147 por mês, você automatiza o cérebro da sua hamburgueria e tem lucros limpos, sem burocracias escondidas.</p>
        <a href="/login?register=true" className="inline-block bg-orange-500 text-white font-black text-xl px-10 py-5 rounded-full hover:bg-orange-600 transition-all shadow-[0_0_40px_rgba(249,115,22,0.4)]">Quero Criar Minha Loja!</a>
      </section>
    </div>
  );
}
