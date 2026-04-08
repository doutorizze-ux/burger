import makeWASocket, { DisconnectReason, useMultiFileAuthState, makeCacheableSignalKeyStore, WASocket, fetchLatestBaileysVersion, Browsers } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import path from 'path';
import fs from 'fs';
import { prisma } from './db.js';
import pino from 'pino';
import { fileURLToPath } from 'url';
import { eventBus, EVENTS } from './events.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const sessions = new Map<string, WASocket>();
const qrCodes = new Map<string, string>();

export function getLatestQR(tenantId: string) {
    return qrCodes.get(tenantId);
}

export async function humanizedSendMessage(sock: WASocket, jid: string, content: any) {
    try {
        if (content.text) {
            await sock.sendPresenceUpdate('composing', jid);
            const typingTime = Math.min(Math.max(content.text.length * 15, 1500), 5000);
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

    const { io } = await import('./index.js');
    for (const tenant of connectedTenants) {
        if (sessions.has(tenant.id)) continue;
        try {
            await initWhatsApp(
                tenant.id,
                (qr) => io.to(tenant.id).emit('qr_code', qr),
                (status) => io.to(tenant.id).emit('whatsapp_status', status)
            );
        } catch (err) {
            await prisma.tenant.update({ where: { id: tenant.id }, data: { whatsapp_status: 'DISCONNECTED' } });
        }
    }
};

export const initWhatsApp = async (tenantId: string, onQr?: (qr: string) => void, onStatus?: (status: string) => void) => {
    const existingSession = sessions.get(tenantId);
    if (existingSession) {
        try {
            existingSession.end(undefined);
            existingSession.ev.removeAllListeners('messages.upsert');
            existingSession.ev.removeAllListeners('connection.update');
        } catch (e) { }
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
                    const sessionDir = path.join(process.cwd(), 'sessions', tenantId);
                    if (fs.existsSync(sessionDir)) fs.rmSync(sessionDir, { recursive: true, force: true });
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
                    await handleMessage(tenantId, msg, sock);
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

    const result = await humanizedSendMessage(sock, targetJid, { text });

    let phone = targetJid.split('@')[0].replace(/\D/g, '');
    let customer = await prisma.customer.findFirst({
        where: { tenant_id: tenantId, phone: { contains: phone.slice(-8) } }
    });

    if (customer && !customer.whatsapp_jid) {
        await prisma.customer.update({
            where: { id: customer.id },
            data: { whatsapp_jid: targetJid }
        });
    }

    await prisma.chatMessage.create({
        data: {
            tenant_id: tenantId,
            content: text,
            from_me: true,
            jid: targetJid,
            customer_id: customer?.id,
            type: 'text'
        }
    });

    return result;
};

async function handleMessage(tenantId: string, msg: any, sock: WASocket) {
    try {
        if (!msg.message || !msg.key.remoteJid || msg.key.remoteJid === 'status@broadcast') return;
        const remoteJid = msg.key.remoteJid;
        if (remoteJid.endsWith('@newsletter') || remoteJid.endsWith('@broadcast')) return;

        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.buttonsResponseMessage?.selectedButtonId || msg.message.listResponseMessage?.title || (msg.message.imageMessage ? "[Imagem]" : null);
        const senderName = msg.pushName || "Cliente";
        if (!text) return;

        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId }
        });
        if (!tenant) return;

        let remoteJidToIdentify = remoteJid;
        if (remoteJid.endsWith('@lid') && msg.key.participant && !msg.key.participant.endsWith('@lid')) {
            remoteJidToIdentify = msg.key.participant;
        }

        const remotePhone = remoteJidToIdentify.split(':')[0].split('@')[0].replace(/\D/g, '');
        const remoteLast8 = remotePhone.slice(-8);

        let customer = await prisma.customer.findFirst({
            where: { tenant_id: tenantId, OR: [{ whatsapp_jid: remoteJid }, { whatsapp_jid: remoteJidToIdentify }] }
        });

        if (!customer) {
            const allCustomers = await prisma.customer.findMany({ where: { tenant_id: tenantId } });
            customer = allCustomers.find(c => {
                const dbPhone = c.phone.replace(/\D/g, '');
                return (dbPhone === remotePhone || (dbPhone.slice(-8) === remoteLast8 && dbPhone.slice(-8).length >= 8));
            }) || null;

            if (!customer) {
                customer = await prisma.customer.create({
                    data: {
                        tenant_id: tenantId,
                        phone: remotePhone,
                        name: senderName !== "Cliente" ? senderName : "Cliente " + remotePhone,
                        whatsapp_jid: remoteJid
                    }
                });
            } else {
                await prisma.customer.update({
                    where: { id: customer.id },
                    data: { whatsapp_jid: remoteJid }
                });
            }
        }

        const chatMsg = await prisma.chatMessage.create({
            data: {
                tenant_id: tenantId,
                content: text,
                jid: remoteJid,
                from_me: false,
                customer_id: customer?.id,
                type: msg.message?.imageMessage ? 'image' : 'text'
            }
        });

        eventBus.emit(EVENTS.NEW_MESSAGE, chatMsg);

        if (tenant.status === 'BLOCKED') return;

        if (customer.bot_paused) return;

        const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const catalogUrl = `${baseUrl}/catalogo/${tenant.slug}?ref=${customer.id}`;

        const welcomeText = `🍔 Olá *${customer.name.split(' ')[0]}*! Bem-vindo(a) à *${tenant.name}*!\n\nPara fazer seu pedido de forma rápida e prática, acesse nosso cardápio digital interativo:\n\n👉 ${catalogUrl}\n\nFicaremos felizes em preparar o seu lanche! 😋`;

        await humanizedSendMessage(sock, remoteJid, { text: welcomeText });

    } catch (err) {
        console.error(`[WA] Critical error handling message from tenant ${tenantId}:`, err);
    }
}
