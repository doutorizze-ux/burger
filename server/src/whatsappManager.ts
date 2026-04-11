import makeWASocket, { DisconnectReason, useMultiFileAuthState, makeCacheableSignalKeyStore, WASocket, fetchLatestBaileysVersion, Browsers } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import { prisma } from './db.js';
import pino from 'pino';
import { fileURLToPath } from 'url';
import { eventBus, EVENTS } from './events.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const sessions = new Map<string, WASocket>();
const qrCodes = new Map<string, string>();

// Bot States
const botMemory = new Map<string, any>(); 
// Key: remoteJid
// Value: { step: number, cart: any[], categoryId?: string, productId?: string, finalTotal: number, address?: string }

export function getLatestQR(tenantId: string) {
    return qrCodes.get(tenantId);
}

export async function humanizedSendMessage(sock: WASocket, jid: string, content: any) {
    try {
        if (content.text) {
            await sock.sendPresenceUpdate('composing', jid);
            const typingTime = Math.min(Math.max(content.text.length * 10, 1000), 3000);
            await delay(typingTime);
            await sock.sendPresenceUpdate('paused', jid);
        }
        return await sock.sendMessage(jid, content);
    } catch (err) {
        console.error('[WA] Error in humanizedSendMessage:', err);
        return await sock.sendMessage(jid, content);
    }
}

export const getSession = (tenantId: string) => sessions.get(tenantId);

export const reconnectSessions = async () => {
    console.log('[WA] Auto-reconnecting active sessions...');
    const connectedTenants = await prisma.tenant.findMany({
        where: { whatsapp_status: 'CONNECTED', status: 'ACTIVE' }
    });

    for (const tenant of connectedTenants) {
        if (sessions.has(tenant.id)) continue;
        try {
            await initWhatsApp(
                tenant.id,
                (qr) => eventBus.emit(EVENTS.WHATSAPP_QR, { tenantId: tenant.id, qr }),
                (status) => eventBus.emit(EVENTS.WHATSAPP_STATUS, { tenantId: tenant.id, status })
            );
        } catch (err) {
            await prisma.tenant.update({ where: { id: tenant.id }, data: { whatsapp_status: 'DISCONNECTED' } });
        }
    }
};

export const initWhatsApp = async (tenantId: string, onQr?: (qr: string) => void, onStatus?: (status: string) => void) => {
    const existingSession = sessions.get(tenantId);
    if (existingSession) {
        try { existingSession.end(undefined); } catch (e) { }
        sessions.delete(tenantId);
    }

    const logger = pino({ level: 'silent' });
    const authPath = path.join(process.cwd(), 'sessions', tenantId);

    if (!fs.existsSync(authPath)) {
        fs.mkdirSync(authPath, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(authPath);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        browser: Browsers.macOS('Desktop'),
        printQRInTerminal: false,
        syncFullHistory: false,
        markOnlineOnConnect: false,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr && onQr) {
            qrCodes.set(tenantId, qr);
            onQr(qr);
        }

        if (connection === 'close') {
            const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
            qrCodes.delete(tenantId);

            if (statusCode === 401 || statusCode === 403 || statusCode === 405) {
                try {
                    if (fs.existsSync(authPath)) fs.rmSync(authPath, { recursive: true, force: true });
                } catch (e) { }
            }

            if (statusCode === DisconnectReason.loggedOut) {
                sessions.delete(tenantId);
                await prisma.tenant.update({ where: { id: tenantId }, data: { whatsapp_status: 'DISCONNECTED' } });
                if (onStatus) onStatus('DISCONNECTED');
            } else {
                sessions.delete(tenantId);
                setTimeout(() => initWhatsApp(tenantId, onQr, onStatus), 3000);
            }
        } else if (connection === 'open') {
            sessions.set(tenantId, sock);
            qrCodes.delete(tenantId);
            await prisma.tenant.update({ where: { id: tenantId }, data: { whatsapp_status: 'CONNECTED' } });
            if (onStatus) onStatus('CONNECTED');
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        if (m.type === 'notify') {
            for (const msg of m.messages) {
                if (!msg.key.fromMe && msg.message) {
                    try {
                        await handleMessage(tenantId, msg, sock);
                    } catch (err) {
                        console.error('[WA] Critical Error in handleMessage:', err);
                    }
                }
            }
        }
    });

    sessions.set(tenantId, sock);
    return sock;
};

export const logoutSession = async (tenantId: string) => {
    const session = sessions.get(tenantId);
    if (session) {
        try {
            await session.logout();
            session.end(undefined);
        } catch (err) {}
        sessions.delete(tenantId);
    }
    const authPath = path.join(process.cwd(), 'sessions', tenantId);
    if (fs.existsSync(authPath)) {
        try { fs.rmSync(authPath, { recursive: true, force: true }); } catch (err) {}
    }
};

export const sendMessageToJid = async (tenantId: string, jid: string, text: string) => {
    const sock = sessions.get(tenantId);
    if (!sock) throw new Error('WhatsApp não conectado');

    let targetJid = jid;
    if (!jid.endsWith('@lid')) {
        let cleanNumber = jid.split('@')[0].replace(/\D/g, '');
        if (cleanNumber.length >= 10 && cleanNumber.length <= 11 && !cleanNumber.startsWith('55')) {
            cleanNumber = '55' + cleanNumber;
        }
        targetJid = cleanNumber + '@s.whatsapp.net';
    }

    return await humanizedSendMessage(sock, targetJid, { text });
};

// BOT FLUX LOGIC
async function handleMessage(tenantId: string, msg: any, sock: WASocket) {
    try {
        if (!msg.message || !msg.key.remoteJid || msg.key.remoteJid === 'status@broadcast') return;
        const remoteJid = msg.key.remoteJid;
        if (remoteJid.endsWith('@newsletter') || remoteJid.endsWith('@broadcast') || remoteJid.includes('@g.us')) return;

        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.buttonsResponseMessage?.selectedButtonId || msg.message.listResponseMessage?.title || (msg.message.imageMessage ? "[Imagem]" : null);
        const senderName = msg.pushName || "Cliente";
        if (!text) return;

        console.log(`[BOT] Mensagem recebida de ${remoteJid} para tenant ${tenantId}: ${text}`);

        // Safety check - ignore messages from the bot itself or status updates
        if (msg.key.fromMe) return;

        const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
        if (!tenant || tenant.status === 'BLOCKED') return;

        let remotePhone = remoteJid.split('@')[0].replace(/\D/g, '');
        let customer = await prisma.customer.findFirst({
            where: { tenant_id: tenantId, whatsapp_jid: remoteJid }
        });

        if (!customer) {
            customer = await prisma.customer.create({
                data: {
                    tenant_id: tenantId, phone: remotePhone,
                    name: senderName !== "Cliente" ? senderName : "Cliente " + remotePhone,
                    whatsapp_jid: remoteJid
                }
            });
        }
        if (customer.bot_paused) return;

        // BOT STATE MACHINE
        let mem = botMemory.get(remoteJid);
        if (!mem || text.toLowerCase().trim() === 'oi' || text.toLowerCase().trim() === 'ola' || text.toLowerCase().trim() === 'voltar') {
            mem = { step: 0, cart: [], categoryId: null, productId: null, finalTotal: 0, address: null, extras: [] };
            botMemory.set(remoteJid, mem);
        }

        const input = text.trim();

        // Step 0: Welcome & Categories
        if (mem.step === 0) {
            const categories = await prisma.category.findMany({ where: { tenant_id: tenantId, active: true } });
            if (categories.length === 0) {
                await humanizedSendMessage(sock, remoteJid, { text: `Desculpe, nosso cardápio está sendo atualizado no momento.` });
                return;
            }
            const catalogUrl = `${tenant.slug ? 'https://pitdog.ai/' + tenant.slug : 'http://localhost:5173/catalog/' + tenantId}?ref=${customer.id}`;
            let reply = `🍔 Olá *${customer.name.split(' ')[0]}*! Somos da *${tenant.name}*!\n\n🤖 Eu sou o Garçom Virtual. Você pode pedir por aqui ou ver nosso cardápio completo com fotos aqui: \n🔗 ${catalogUrl} \n\n*Ou se preferir peça por aqui mesmo, Digite o NÚMERO da categoria:*👇\n\n`;
            categories.forEach((cat, index) => {
                reply += `*${index + 1}.* ${cat.name}\n`;
            });
            mem.categories = categories;
            mem.step = 1;
            botMemory.set(remoteJid, mem);
            await humanizedSendMessage(sock, remoteJid, { text: reply });
            return;
        }

        // Step 1: Show Products in selected Category
        if (mem.step === 1) {
            const index = parseInt(input) - 1;
            if (isNaN(index) || !mem.categories[index]) {
                await humanizedSendMessage(sock, remoteJid, { text: `Opção inválida. Digite apenas o NÚMERO correspondente.` });
                return;
            }
            const cat = mem.categories[index];
            const products = await prisma.product.findMany({ where: { category_id: cat.id, active: true }, include: { extras: true } });
            
            if (products.length === 0) {
                await humanizedSendMessage(sock, remoteJid, { text: `Nenhum lanche nesta categoria ainda. Digite 0 para voltar.` });
                mem.step = 0;
                botMemory.set(remoteJid, mem);
                return;
            }

            let reply = `📋 *${cat.name.toUpperCase()}*\nEscolha seu lanche digitando o NÚMERO:\n\n`;
            products.forEach((prod, idx) => {
                reply += `*${idx + 1}.* ${prod.name} - R$ ${prod.price.toFixed(2)}\n_${prod.description || ''}_\n\n`;
            });
            reply += `\n*0.* Voltar ao Menu Principal`;
            mem.products = products;
            mem.step = 2;
            botMemory.set(remoteJid, mem);
            await humanizedSendMessage(sock, remoteJid, { text: reply });
            return;
        }

        // Step 2: Select Product & Extras
        if (mem.step === 2) {
            if (input === '0') {
               mem.step = 0; botMemory.set(remoteJid, mem);
               return handleMessage(tenantId, { ...msg, message: { conversation: 'Oi' } }, sock); // Simula voltar
            }
            const idx = parseInt(input) - 1;
            if (isNaN(idx) || !mem.products[idx]) {
                await humanizedSendMessage(sock, remoteJid, { text: `Opção inválida.` });
                return;
            }
            const prod = mem.products[idx];
            mem.productId = prod.id;
            mem.currentProduct = prod;
            mem.selectedExtras = [];
            
            let prodReply = `🥩 Você escolheu *${prod.name}*!\n_${prod.description || ''}_\n\n`;

            if (prod.image_url) {
                // If there's an image, we send it with the caption
                await humanizedSendMessage(sock, remoteJid, { 
                    image: { url: prod.image_url }, 
                    caption: prodReply
                });
            }

            if (!prod.extras || prod.extras.length === 0) {
                 // No extras, add direct to cart
                 mem.cart.push({ product: prod, extras: [], quantity: 1, total: prod.price });
                 mem.step = 4;
                 botMemory.set(remoteJid, mem);
                 const reply = prod.image_url ? `✅ Adicionado ao carrinho!` : prodReply + `✅ Adicionado ao carrinho!`;
                 await humanizedSendMessage(sock, remoteJid, { text: `${reply}\n\nDeseja adicionar mais algum item ao seu pedido?\n*1.* Sim, pedir mais coisas\n*2.* Não, finalizar e pagar` });
                 return;
            } else {
                 let reply = prod.image_url ? `Deseja algum *ADICIONAL*? Digite os números (Ex: 1, 3) ou 0 para NENHUM:\n\n` : prodReply + `Deseja algum *ADICIONAL*? Digite os números (Ex: 1, 3) ou 0 para NENHUM:\n\n`;
                 prod.extras.forEach((ext:any, i:number) => {
                     reply += `*${i + 1}.* ${ext.name} (+R$ ${ext.price.toFixed(2)})\n`;
                 });
                 reply += `\n*0.* Sem adicionais`;
                 mem.step = 3;
                 botMemory.set(remoteJid, mem);
                 await humanizedSendMessage(sock, remoteJid, { text: reply });
            }
            return;
        }

        // Step 3: Handle Extras logic
        if (mem.step === 3) {
            const prod = mem.currentProduct;
            let extrasTotal = 0;
            let chosenExtras: any[] = [];
            
            if (input !== '0') {
                const choices = input.split(',').map((s:any) => parseInt(s.trim()) - 1);
                choices.forEach((c:any) => {
                    const extra = prod.extras[c];
                    if (extra) {
                       chosenExtras.push(extra);
                       extrasTotal += extra.price;
                    }
                });
            }

            mem.cart.push({ product: prod, extras: chosenExtras, quantity: 1, total: prod.price + extrasTotal });
            mem.step = 4;
            botMemory.set(remoteJid, mem);
            
            let extraText = chosenExtras.length > 0 ? ` (Com ${chosenExtras.map((e:any)=>e.name).join(', ')})` : '';
            await humanizedSendMessage(sock, remoteJid, { text: `✅ *${prod.name}*${extraText} adicionado!\n\nDeseja adicionar mais coisas?\n*1.* Sim\n*2.* Não, finalizar` });
            return;
        }

        // Step 4: Continue or Checkout
        if (mem.step === 4) {
            if (input === '1') {
                mem.step = 0; botMemory.set(remoteJid, mem);
                return handleMessage(tenantId, { ...msg, message: { conversation: 'Oi' } }, sock); 
            } else if (input === '2') {
                let total = 0;
                let summary = `*RESUMO DO SEU PEDIDO:*\n\n`;
                mem.cart.forEach((c:any) => {
                    summary += `1x ${c.product.name} - R$ ${c.total.toFixed(2)}\n`;
                    if (c.extras && c.extras.length > 0) {
                       summary += `   _+ ${c.extras.map((e:any)=>e.name).join(', ')}_\n`;
                    }
                    total += c.total;
                });
                mem.finalTotal = total;
                summary += `\n*Total em Produtos: R$ ${total.toFixed(2)}*`;
                summary += `\n\n🎫 Você possui algum *CUPOM DE DESCONTO*?\n\nDigite o código do cupom ou envie *0* para continuar sem cupom.`;
                
                mem.step = 4.5;
                botMemory.set(remoteJid, mem);
                await humanizedSendMessage(sock, remoteJid, { text: summary });
                return;
            } else {
                await humanizedSendMessage(sock, remoteJid, { text: `Opção inválida. Digite 1 ou 2.` });
                return;
            }
        }

        // Step 4.5: Handle Coupon
        if (mem.step === 4.5) {
            if (input !== '0') {
                const coupon = await prisma.coupon.findFirst({
                    where: { tenant_id: tenantId, code: input.toUpperCase(), active: true }
                });

                if (coupon) {
                    let discount = 0;
                    if (coupon.type === 'PERCENT') {
                        discount = (mem.finalTotal * coupon.value) / 100;
                    } else {
                        discount = coupon.value;
                    }
                    mem.finalTotal = Math.max(0, mem.finalTotal - discount);
                    mem.appliedCoupon = coupon.code;
                    await humanizedSendMessage(sock, remoteJid, { text: `✅ Cupom *${coupon.code}* aplicado! Desconto de R$ ${discount.toFixed(2)}.` });
                } else {
                    await humanizedSendMessage(sock, remoteJid, { text: `❌ Cupom inválido ou expirado. Continuando sem desconto...` });
                }
            }

            mem.step = 5;
            botMemory.set(remoteJid, mem);
            await humanizedSendMessage(sock, remoteJid, { text: `📍 Por favor, *digite seu endereço completo com bairro e cidade* para calcularmos a Taxa de Entrega:` });
            return;
        }

        // Step 5: Address
        if (mem.step === 5) {
            mem.address = input;
            
            // CÁLCULO DE DISTÂNCIA DINÂMICO
            let distanceKm = Math.max(1.5, (input.length % 8) + 1.2); // Fallback padrão Simulação

            if (process.env.GOOGLE_MAPS_API_KEY) {
                try {
                    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
                    const query = encodeURIComponent(`${input}, Brasil`); // Could be tailored to a city if available
                    
                    // Geocode the address to extract the formatted and exact address for the driver map
                    const geocodeRes = await axios.get(`https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${apiKey}`);
                    if (geocodeRes.data.status === 'OK' && geocodeRes.data.results.length > 0) {
                        mem.address = geocodeRes.data.results[0].formatted_address;
                    }
                    
                    // Use the exact parsed address to calculate the distance matrix
                    // For the sake of the bot logic, we assume the origin is Goiania as fallback
                    const origin = encodeURIComponent("Centro, Goiania, GO"); 
                    const destination = encodeURIComponent(mem.address);
                    const gmapRes = await axios.get(`https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin}&destinations=${destination}&key=${apiKey}`);
                    
                    if (gmapRes.data.status === "OK" && gmapRes.data.rows[0].elements[0].status === "OK") {
                        const meters = gmapRes.data.rows[0].elements[0].distance.value;
                        distanceKm = meters / 1000;
                    }
                } catch(e) { console.log('Erro na API do Google Maps.', e); }
            }

            const dynFee = tenant.delivery_fee + (distanceKm * 1.50); // Taxa base + 1.50/km
            const totalComTaxa = mem.finalTotal + dynFee;
            
            mem.dynamic_fee = dynFee;
            mem.finalTotal = totalComTaxa;
            
            mem.step = 6;
            botMemory.set(remoteJid, mem);
            await humanizedSendMessage(sock, remoteJid, { text: `Endereço compreendido e anotado! 📍\n_${mem.address}_\n\n🛵 Distância: ~${distanceKm.toFixed(1)}km\n💸 Taxa de Entrega: R$ ${dynFee.toFixed(2)}\n\n💰 *TOTAL FINAL A PAGAR: R$ ${totalComTaxa.toFixed(2)}*\n\nQual será a *Forma de Pagamento*?\n*1.* PIX (Enviar comprovante)\n*2.* Dinheiro (Precisa de troco?)\n*3.* Cartão` });
            return;
        }

        // Step 6: Payment and Finalize
        if (mem.step === 6) {
            const payTypes = ['PIX', 'CASH', 'CREDIT_CARD'];
            const pIdx = parseInt(input[0]) - 1; // get the first character if they typed "2 para troco 50"
            const paymentMethod = payTypes[pIdx >= 0 && pIdx <= 2 ? pIdx : 1]; // fallback to cash

            // Create Order in DB
            const order = await prisma.order.create({
                data: {
                    tenant_id: tenantId,
                    customer_id: customer.id,
                    total: mem.finalTotal,
                    delivery_fee: mem.dynamic_fee || tenant.delivery_fee,
                    delivery_address: mem.address,
                    payment_method: paymentMethod,
                    notes: input, // store their payment notes (like troco)
                    status: 'PENDING',
                    items: {
                        create: mem.cart.map((c:any) => ({
                            product_id: c.product.id,
                            quantity: 1,
                            unit_price: c.total,
                            extras: {
                                create: c.extras.map((e:any) => ({
                                    extra_id: e.id, price: e.price
                                }))
                            }
                        }))
                    }
                },
                include: { customer: true, items: { include: { product: true } } }
            });

            // Emit to Dashboard
            eventBus.emit(EVENTS.NEW_ORDER, order);

            // Automatically create delivery request
            dispatchDelivery(tenantId, order);

            botMemory.delete(remoteJid);
            await humanizedSendMessage(sock, remoteJid, { text: `🎉 *PEDIDO REALIZADO COM SUCESSO!*\nNúmero do pedido: #${order.id.slice(-4)}\n\nNossa cozinha já foi notificada e seu pedido está sendo preparado 🍔.\nVamos começar a disparar chamadas para nossos motoboys e o robô vai te mandar mensagem automática avisando quando sair para entrega!` });
            return;
        }

    } catch (err) {
        console.error(`[WA] ERROR in handleMessage for ${tenantId}:`, err);
    }
}

async function dispatchDelivery(tenantId: string, order: any) {
    try {
        const deliveryReq = await prisma.deliveryRequest.upsert({
            where: { order_id: order.id },
            update: { status: 'PENDING' },
            create: { tenant_id: tenantId, order_id: order.id, status: 'PENDING' }
        });
        
        eventBus.emit(EVENTS.NEW_DELIVERY_REQUEST, { tenantId, request: { ...deliveryReq, order } });

        // Timeout em 30 segundos
        setTimeout(async () => {
            const currentReq = await prisma.deliveryRequest.findUnique({ where: { id: deliveryReq.id } });
            if (currentReq && currentReq.status === 'PENDING') {
                await prisma.deliveryRequest.update({ where: { id: deliveryReq.id }, data: { status: 'EXPIRED' } });
                eventBus.emit(EVENTS.DELIVERY_EXPIRED, { tenantId, requestId: deliveryReq.id });
                // Reenviar loop recursivo
                dispatchDelivery(tenantId, order);
            }
        }, 30000);

    } catch(e) { console.error('Dispatch error:', e); }
}
