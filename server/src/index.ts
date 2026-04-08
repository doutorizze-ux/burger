import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { prisma } from './db.js';
import { initWhatsApp, getSession, reconnectSessions, logoutSession, sendMessageToJid } from './whatsappManager.js';
import { initScheduler } from './scheduler.js';
import { Server } from 'socket.io';
import http from 'http';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { eventBus, EVENTS } from './events.js';
import multer from 'multer';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

process.on('unhandledRejection', (reason, promise) => {
    console.error('!!! Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
    console.error('!!! Uncaught Exception thrown:', err);
});

const app = express();
const server = http.createServer(app);

app.get('/health', (req, res) => res.status(200).send('OK'));
app.get('/api/health', (req, res) => res.status(200).send('OK'));

app.set('trust proxy', true);

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

app.use(express.json());

const uploadsDir = path.resolve('uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('Somente imagens são permitidas'));
    }
});

app.use('/uploads', express.static(uploadsDir));
const JWT_SECRET = process.env.JWT_SECRET || 'zapfitness_secret_key_123';

const authMiddleware = async (req: any, res: any, next: any) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Não autorizado' });
    try {
        const decoded: any = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (e) {
        res.status(401).json({ error: 'Token inválido' });
    }
};

export const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

io.on('connection', (socket) => {
    socket.on('join', (tenantId) => socket.join(tenantId));
});

eventBus.on(EVENTS.NEW_MESSAGE, (msg) => {
    io.to(msg.tenant_id).emit('new_message', msg);
});

// START: ROUTES
app.post('/api/register', async (req, res) => {
    const { storeName, email, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const { tenant, admin } = await prisma.$transaction(async (tx) => {
            const tenant = await tx.tenant.create({
                data: {
                    name: storeName,
                    slug: storeName.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Date.now(),
                    status: 'ACTIVE',
                    payment_status: 'ACTIVE',
                }
            });
            const admin = await tx.gymAdmin.create({
                data: { name: 'Admin', email, password: hashedPassword, tenant_id: tenant.id }
            });
            return { tenant, admin };
        });
        const token = jwt.sign({ id: admin.id, tenant_id: tenant.id }, JWT_SECRET, { expiresIn: '730d' });
        res.json({ tenant, admin, token });
    } catch (e: any) {
        res.status(400).json({ error: 'Falha no registro' });
    }
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    const admin = await prisma.gymAdmin.findUnique({ where: { email }, include: { tenant: true } });
    if (!admin || !await bcrypt.compare(password, admin.password)) {
        return res.status(401).json({ error: 'Credenciais inválidas' });
    }
    const token = jwt.sign({ id: admin.id, email: admin.email, tenant_id: admin.tenant_id }, JWT_SECRET, { expiresIn: '730d' });
    res.json({ token, admin, tenant_id: admin.tenant_id });
});

app.get('/api/me', authMiddleware, async (req: any, res) => {
    try {
        let tenant = await prisma.tenant.findUnique({
            where: { id: req.user.tenant_id },
            include: { admins: true }
        });
        if (!tenant) return res.status(404).json({ error: 'Loja não encontrada' });
        
        const session = getSession(tenant.id);
        const realConnected = !!(session && (session as any).user);
        let currentStatus = tenant.whatsapp_status;
        if (currentStatus === 'CONNECTED' && !realConnected) {
            currentStatus = 'DISCONNECTED';
            prisma.tenant.update({ where: { id: tenant.id }, data: { whatsapp_status: 'DISCONNECTED' } }).catch(() => { });
        }
        res.json({ ...tenant, whatsapp_status: currentStatus });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao buscar dados' });
    }
});

app.post('/api/whatsapp/connect', authMiddleware, async (req: any, res) => {
    const tenantId = req.user.tenant_id;
    initWhatsApp(
        tenantId,
        (qr) => io.to(tenantId).emit('qr_code', qr),
        (status) => io.to(tenantId).emit('whatsapp_status', status)
    );
    res.json({ status: 'INITIALIZING' });
});

app.post('/api/whatsapp/logout', authMiddleware, async (req: any, res) => {
    await logoutSession(req.user.tenant_id);
    res.json({ success: true });
});

// Products & Categories
app.get('/api/categories', authMiddleware, async (req: any, res) => {
    try {
        const categories = await prisma.category.findMany({ where: { tenant_id: req.user.tenant_id } });
        res.json(categories);
    } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.post('/api/categories', authMiddleware, async (req: any, res) => {
    try {
        const { name } = req.body;
        const category = await prisma.category.create({ data: { name, tenant_id: req.user.tenant_id } });
        res.json(category);
    } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.get('/api/products', authMiddleware, async (req: any, res) => {
    try {
        const products = await prisma.product.findMany({ 
            where: { tenant_id: req.user.tenant_id }, include: { category: true, extras: true } 
        });
        res.json(products);
    } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.post('/api/products', authMiddleware, async (req: any, res) => {
    try {
        const { name, description, price, category_id, image_url } = req.body;
        const product = await prisma.product.create({
            data: { name, description, price: parseFloat(price), category_id, image_url, tenant_id: req.user.tenant_id }
        });
        res.json(product);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.put('/api/products/:id', authMiddleware, async (req: any, res) => {
    try {
        const { name, description, price, category_id, image_url } = req.body;
        const product = await prisma.product.update({
            where: { id: req.params.id, tenant_id: req.user.tenant_id },
            data: { name, description, price: parseFloat(price), category_id, image_url }
        });
        res.json(product);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/products/:id', authMiddleware, async (req: any, res) => {
    try {
        await prisma.product.delete({ where: { id: req.params.id, tenant_id: req.user.tenant_id } });
        res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Catalog public APIs
app.get('/api/public/catalog/:slug', async (req, res) => {
    try {
        const tenant = await prisma.tenant.findUnique({
            where: { slug: req.params.slug },
            select: { id: true, name: true, logo_url: true, primary_color: true, delivery_fee: true, min_order_value: true }
        });
        if (!tenant) return res.status(404).json({ error: 'Loja não encontrada' });
        
        const categories = await prisma.category.findMany({
            where: { tenant_id: tenant.id, active: true },
            include: { products: { where: { active: true }, include: { extras: true } } }
        });
        res.json({ tenant, categories });
    } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.post('/api/public/orders', async (req, res) => {
    try {
        const { tenant_id, customer_id, items, delivery_address, payment_method, notes, total, delivery_fee } = req.body;
        const order = await prisma.order.create({
            data: {
                tenant_id,
                customer_id,
                status: 'PENDING',
                total,
                delivery_fee,
                delivery_address,
                payment_method,
                notes,
                items: {
                    create: items.map((it: any) => ({
                        product_id: it.product_id,
                        quantity: it.quantity,
                        unit_price: it.price,
                        notes: it.notes,
                        extras: {
                            create: it.extras?.map((ex: any) => ({
                                extra_id: ex.id,
                                quantity: ex.quantity || 1,
                                price: ex.price
                            })) || []
                        }
                    }))
                }
            },
            include: { items: { include: { product: true } }, customer: true }
        });
        
        // Notify Panel
        io.to(tenant_id).emit('new_order', order);
        
        // Notify Customer via WhatsApp
        const tenant = await prisma.tenant.findUnique({ where: { id: tenant_id } });
        if(tenant) {
            const customer = await prisma.customer.findUnique({ where: { id: customer_id } });
            if(customer && customer.whatsapp_jid) {
                const text = `🍽️ *Pedido Recebido* nº ${order.id.slice(-6)}\n\n*${tenant.name}*\nObrigado por pedir com a gente! Seu pedido está aguardando confirmação.`;
                await sendMessageToJid(tenant_id, customer.whatsapp_jid, text);
            }
        }
        res.json(order);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/api/orders', authMiddleware, async (req: any, res) => {
    try {
        const orders = await prisma.order.findMany({
            where: { tenant_id: req.user.tenant_id },
            include: { customer: true, items: { include: { product: true, extras: { include: { extra: true } } } } },
            orderBy: { created_at: 'desc' },
            take: 100
        });
        res.json(orders);
    } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.put('/api/orders/:id/status', authMiddleware, async (req: any, res) => {
    try {
        const { status } = req.body;
        const order = await prisma.order.update({
            where: { id: req.params.id, tenant_id: req.user.tenant_id },
            data: { status },
            include: { customer: true, items: { include: { product: true } } }
        });
        
        const statusMap: any = { PREPARING: 'Sendo Preparado 🫕', DELIVERED: 'Saiu para Entrega 🛵', CONFIRMED: 'Confirmado ✅', CANCELLED: 'Cancelado 🚫' };
        
        if (order.customer.whatsapp_jid && statusMap[status]) {
            await sendMessageToJid(order.tenant_id, order.customer.whatsapp_jid, `Seu pedido nº ${order.id.slice(-6)} mudou de status para: *${statusMap[status]}*`);
        }
        res.json(order);
    } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.post('/api/upload', authMiddleware, upload.single('file'), (req: any, res) => {
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    res.json({ url: `/uploads/${req.file.filename}` });
});

// Chats
app.get('/api/chats', authMiddleware, async (req: any, res) => {
    try {
        const customers = await prisma.customer.findMany({
            where: { tenant_id: req.user.tenant_id },
            include: { chatMessages: { orderBy: { created_at: 'desc' }, take: 1 } },
            orderBy: { created_at: 'desc' }
        });
        res.json(customers);
    } catch(e) { res.status(500).json({ error: 'Error' }); }
});

app.get('/api/chats/:customerId/messages', authMiddleware, async (req: any, res) => {
    try {
        const msgs = await prisma.chatMessage.findMany({
            where: { tenant_id: req.user.tenant_id, customer_id: req.params.customerId },
            orderBy: { created_at: 'asc' }
        });
        res.json(msgs);
    } catch(e) { res.status(500).json({ error: 'Error' }); }
});

app.post('/api/chat/send', authMiddleware, async (req: any, res) => {
    try {
        const { jid, text } = req.body;
        await sendMessageToJid(req.user.tenant_id, jid, text);
        
        const phone = jid.split('@')[0].replace(/\D/g, '');
        await prisma.customer.updateMany({
            where: { tenant_id: req.user.tenant_id, OR: [{ whatsapp_jid: jid }, { phone: { contains: phone.slice(-8) } }] },
            data: { bot_paused: true }
        });
        res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/api/leads', authMiddleware, async (req: any, res) => {
    res.json([]);
});


// static build serve
const publicDir = path.join(__dirname, '../public');
if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir));
    app.get('*', (req, res) => {
        if (!req.url.startsWith('/api') && !req.url.startsWith('/uploads')) {
            res.sendFile(path.join(publicDir, 'index.html'));
        } else {
            res.status(404).json({ error: 'Endpoint não encontrado' });
        }
    });
}

app.listen(process.env.PORT || 3000, () => {
    console.log(`Server is running on port ${process.env.PORT || 3000}`);
    initScheduler();
    setTimeout(reconnectSessions, 2000);
});
