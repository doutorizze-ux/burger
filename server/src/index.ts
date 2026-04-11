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
import { sendPushNotification } from './firebaseAdmin.js';
import multer from 'multer';
import cors from 'cors';

// Listen to WhatsApp events from manager
eventBus.on(EVENTS.WHATSAPP_QR, ({ tenantId, qr }: any) => {
    io.to(tenantId).emit('qr_code', qr);
});

eventBus.on(EVENTS.WHATSAPP_STATUS, ({ tenantId, status }: any) => {
    io.to(tenantId).emit('whatsapp_status', status);
});

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
const JWT_SECRET = process.env.JWT_SECRET || 'pitdog_secret_key_123';

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

const driverLocations: any = {};

io.on('connection', (socket) => {
    socket.on('driver_offline', ({ driverId }) => {
        delete driverLocations[driverId];
        io.emit('driver_offline', { driverId });
    });

    socket.on('join', (tenantId) => socket.join(tenantId));
    socket.on('driver_online', async ({ driverId, lat, lng }) => {
        try {
            socket.join(`drivers_global`);
            const driver = await prisma.deliveryDriver.update({ 
                where: { id: driverId }, 
                data: { isOnline: true, latitude: lat, longitude: lng } 
            });
            io.to(`drivers_global`).emit('delivery_update_location', { lat, lng, driverId, driver });
        } catch (e) {}
    });
    socket.on('driver_offline', async ({ driverId }) => {
        await prisma.deliveryDriver.update({ where: { id: driverId }, data: { isOnline: false } });
        socket.leave(`drivers_global`);
    });
    socket.on('driver_location', async (data) => {
        try {
            const { driverId, lat, lng } = data;
            const orderId = data.orderId || data.order_id;
            const tenantId = data.tenantId || data.tenant_id;

            if (!driverId) return;

            const driver = await prisma.deliveryDriver.update({ 
                where: { id: driverId }, 
                data: { latitude: lat, longitude: lng, isOnline: true } 
            });
            
            const update = { lat, lng, driverId, orderId, tenantId, driver };
            
            // Broadcast to global rooms
            io.to(`drivers_global`).emit('delivery_update_location', update);
            
            // Broadcast to specific order tracking
            if (orderId) {
                io.to(`tracking_${orderId}`).emit('delivery_update_location', update);
                
                // Persist tracking history if we have tenantId and orderId
                if (tenantId) {
                    await prisma.deliveryTracking.create({
                        data: {
                            tenant_id: tenantId,
                            driver_id: driverId,
                            order_id: orderId,
                            latitude: lat,
                            longitude: lng
                        }
                    }).catch(err => console.error('Error persisting tracking:', err));
                }
            }
            
            // Broadcast to store panel
            if (tenantId) {
                io.to(tenantId).emit('delivery_update_location', update);
            }
        } catch (err) {
            console.error('Error updating driver location:', err);
        }
    });
    socket.on('join_tracking', (orderId) => socket.join(`tracking_${orderId}`));
});

eventBus.on(EVENTS.NEW_MESSAGE, (msg) => {
    io.to(msg.tenant_id).emit('new_message', msg);
});

eventBus.on(EVENTS.NEW_ORDER, (order) => {
    console.log(`[SOCKET] Broadcasting new order for tenant: ${order.tenant_id}`);
    io.to(order.tenant_id).emit('new_order', order);
});

eventBus.on(EVENTS.NEW_DELIVERY_REQUEST, ({ tenantId, request }) => {
    console.log(`[SOCKET] Broadcasting new delivery request to fleet: ${tenantId}`);
    io.to(`drivers_global`).emit('new_delivery_request', request);
});

eventBus.on(EVENTS.DELIVERY_EXPIRED, ({ tenantId, requestId }) => {
    io.to(`drivers_global`).emit('delivery_expired', requestId);
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
    
    // MASTER ADMIN BYPASS/CHECK
    if (email === 'admin@admin.com' && password === '123456') {
         const token = jwt.sign({ id: 'master', email: 'admin@admin.com', tenant_id: 'master' }, JWT_SECRET, { expiresIn: '730d' });
         return res.json({ token, admin: { name: 'Master Admin', email: 'admin@admin.com' }, tenant_id: 'master' });
    }

    const admin = await prisma.gymAdmin.findUnique({ where: { email }, include: { tenant: true } });
    if (!admin || !await bcrypt.compare(password, admin.password)) {
        return res.status(401).json({ error: 'Credenciais inválidas' });
    }
    const token = jwt.sign({ id: admin.id, email: admin.email, tenant_id: admin.tenant_id }, JWT_SECRET, { expiresIn: '730d' });
    res.json({ token, admin, tenant_id: admin.tenant_id });
});

app.post('/saas/login', async (req, res) => {
    const { email, password } = req.body;
    if (email === 'admin@admin.com' && password === '123456') {
         const token = jwt.sign({ id: 'master', email: 'admin@admin.com', tenant_id: 'master' }, JWT_SECRET, { expiresIn: '730d' });
         return res.json({ token, admin: { name: 'Master Admin', email: 'admin@admin.com' } });
    }
    res.status(401).json({ error: 'Credenciais inválidas' });
});

app.put('/api/tenant', authMiddleware, async (req: any, res) => {
    try {
        const { name, logo_url, primary_color } = req.body;
        const tenant = await prisma.tenant.update({
            where: { id: req.user.tenant_id },
            data: { name, logo_url, primary_color }
        });
        res.json(tenant);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/api/fcm-token', authMiddleware, async (req: any, res) => {
    try {
        const { token } = req.body;
        if (req.user.type === 'DRIVER') {
            await prisma.deliveryDriver.update({ where: { id: req.user.driver_id }, data: { fcm_token: token } });
        } else if (req.user.id !== 'master') {
            await prisma.gymAdmin.update({ where: { id: req.user.id }, data: { fcm_token: token } });
        }
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: 'Falha ao salvar token push' }); }
});

app.get('/api/me', authMiddleware, async (req: any, res) => {
    try {
        if (req.user.tenant_id === 'master') {
            return res.json({ 
                id: 'master', 
                name: 'PitDog.ai Master', 
                status: 'ACTIVE',
                whatsapp_status: 'CONNECTED',
                is_master: true
            });
        }

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
app.get('/api/superadmin/stats', authMiddleware, async (req: any, res) => {
    if (req.user.email === 'admin@admin.com') {
         const tenants = await prisma.tenant.findMany();
         const totalProducts = await prisma.product.count();
         const activeOrders = await prisma.order.findMany({
             where: { status: 'OUT_FOR_DELIVERY' },
             select: { id: true, delivery_address: true, tenant_id: true }
         });
         res.json({ tenants, totalProducts, activeOrders });
    } else {
         res.status(403).json({ error: 'Master Access Denied' });
    }
});

app.put('/api/superadmin/tenants/:id/toggle', authMiddleware, async (req: any, res) => {
    if (req.user.email !== 'admin@admin.com') return res.status(403).json({ error: 'Master Access Denied' });
    try {
        const tenant = await prisma.tenant.findUnique({ where: { id: req.params.id } });
        if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
        const newStatus = tenant.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
        const updated = await prisma.tenant.update({ where: { id: tenant.id }, data: { status: newStatus } });
        res.json(updated);
    } catch(e) {
        res.status(500).json({ error: 'Error toggling status' });
    }
});

app.post('/api/whatsapp/connect', authMiddleware, async (req: any, res) => {
    const tenantId = req.user.tenant_id;
    // Wipe previous stubborn offline session that prevents new QR from emitting
    await logoutSession(tenantId);
    
    initWhatsApp(
        tenantId,
        (qr) => io.to(tenantId).emit('qr_code', qr),
        (status) => io.to(tenantId).emit('whatsapp_status', status)
    );
    res.json({ status: 'INITIALIZING' });
});

app.get('/api/whatsapp/qr', authMiddleware, async (req: any, res) => {
    const { getLatestQR } = await import('./whatsappManager.js');
    res.json({ qr: getLatestQR(req.user.tenant_id) });
});

app.post('/api/whatsapp/logout', authMiddleware, async (req: any, res) => {
    await logoutSession(req.user.tenant_id);
    res.json({ success: true });
});

app.get('/api/coupons', authMiddleware, async (req: any, res) => {
    try {
        const coupons = await prisma.coupon.findMany({ where: { tenant_id: req.user.tenant_id } });
        res.json(coupons);
    } catch(e) { res.status(500).json({ error: 'Error' }); }
});

app.post('/api/coupons', authMiddleware, async (req: any, res) => {
    try {
        const { code, type, value, min_order } = req.body;
        const coupon = await prisma.coupon.create({
            data: { tenant_id: req.user.tenant_id, code: code.toUpperCase(), type, value, min_order }
        });
        res.json(coupon);
    } catch(e) { res.status(500).json({ error: 'Error' }); }
});

app.delete('/api/coupons/:id', authMiddleware, async (req: any, res) => {
    try {
        await prisma.coupon.delete({ where: { id: req.params.id, tenant_id: req.user.tenant_id } });
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: 'Error' }); }
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

app.put('/api/categories/:id/toggle', authMiddleware, async (req: any, res) => {
    try {
        const category = await prisma.category.findUnique({ where: { id: req.params.id, tenant_id: req.user.tenant_id } });
        if (!category) return res.status(404).json({ error: 'Category not found' });
        const updated = await prisma.category.update({
            where: { id: category.id },
            data: { active: !category.active }
        });
        res.json(updated);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
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
        const { name, description, price, category_id, image_url, extras } = req.body;
        const product = await prisma.product.create({
            data: { 
                name, description, price: parseFloat(price), category_id, image_url, tenant_id: req.user.tenant_id,
                extras: extras ? { create: extras.map((e:any) => ({ name: e.name, price: parseFloat(e.price) })) } : undefined
            },
            include: { extras: true }
        });
        res.json(product);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/api/products', authMiddleware, async (req: any, res) => {
    const prods = await prisma.product.findMany({ where: { tenant_id: req.user.tenant_id }, include: { extras: true } });
    res.json(prods);
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

app.put('/api/products/:id/toggle', authMiddleware, async (req: any, res) => {
    try {
        const product = await prisma.product.findUnique({ where: { id: req.params.id, tenant_id: req.user.tenant_id } });
        if (!product) return res.status(404).json({ error: 'Product not found' });
        const updated = await prisma.product.update({
            where: { id: product.id },
            data: { active: !product.active }
        });
        res.json(updated);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/products/:id', authMiddleware, async (req: any, res) => {
    try {
        await prisma.product.delete({ where: { id: req.params.id, tenant_id: req.user.tenant_id } });
        res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/api/products/:id/extras', authMiddleware, async (req: any, res) => {
    try {
        const { name, price } = req.body;
        const extra = await prisma.productExtra.create({
            data: { name, price: parseFloat(price), product_id: req.params.id }
        });
        res.json(extra);
    } catch(e: any) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/extras/:id', authMiddleware, async (req: any, res) => {
    try {
        const extra = await prisma.productExtra.findUnique({
            where: { id: req.params.id },
            include: { product: true }
        });
        if (!extra || extra.product.tenant_id !== req.user.tenant_id) {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        await prisma.productExtra.delete({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch(e: any) { res.status(500).json({ error: e.message }); }
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
        const { tenant_id, customer_id, guest_info, items, delivery_address, payment_method, notes, total, delivery_fee } = req.body;
        
        let finalCustomerId = customer_id;
        if (!finalCustomerId && guest_info) {
            const customer = await prisma.customer.upsert({
                where: { phone_tenant_id: { phone: guest_info.phone, tenant_id } },
                update: { name: guest_info.name },
                create: { name: guest_info.name, phone: guest_info.phone, tenant_id }
            });
            finalCustomerId = customer.id;
        }

        if (!finalCustomerId) {
            return res.status(400).json({ error: 'Identificação do cliente necessária' });
        }

        const order = await prisma.order.create({
            data: {
                tenant_id,
                customer_id: finalCustomerId,
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

        // --- PUSH NOTIFICATION TO ADMINS ---
        const admins = await prisma.gymAdmin.findMany({ where: { tenant_id } });
        for (const admin of admins) {
            if (admin.fcm_token) {
                sendPushNotification(
                    admin.fcm_token, 
                    '🍔 NOVO PEDIDO!', 
                    `Você recebeu um novo pedido de R$ ${total.toFixed(2)}`
                );
            }
        }
        
        // Notify Customer via WhatsApp
        const tenant = await prisma.tenant.findUnique({ where: { id: tenant_id } });
        if(tenant && order.customer && order.customer.whatsapp_jid) {
            const text = `🍽️ *Pedido Recebido* nº ${order.id.slice(-6)}\n\n*${tenant.name}*\nObrigado por pedir com a gente! Seu pedido está aguardando confirmação.`;
            await sendMessageToJid(tenant_id, order.customer.whatsapp_jid, text);
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

app.get('/api/reports/stats', authMiddleware, async (req: any, res) => {
    try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const orders = await prisma.order.findMany({
            where: { tenant_id: req.user.tenant_id, created_at: { gte: startOfMonth } },
            select: { total: true, created_at: true, status: true }
        });

        const totalRevenue = orders.reduce((acc, o) => acc + o.total, 0);
        const delivered = orders.filter(o => o.status === 'DELIVERED').length;
        
        // Group by day for a basic chart
        const daily = orders.reduce((acc: any, o) => {
            const day = o.created_at.toISOString().split('T')[0];
            acc[day] = (acc[day] || 0) + o.total;
            return acc;
        }, {});

        res.json({ totalRevenue, totalOrders: orders.length, delivered, daily });
    } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.put('/api/orders/:id/status', authMiddleware, async (req: any, res) => {
    try {
        const { status } = req.body;
        const order = await prisma.order.update({
            where: { id: req.params.id, tenant_id: req.user.tenant_id },
            data: { status },
            include: { customer: true, tenant: true }
        });
        
        const statusLabels: any = { 
            PREPARING: 'Preparando 👨‍🍳', 
            READY_FOR_PICKUP: 'Pronto para Retirada 🛵', 
            OUT_FOR_DELIVERY: 'Em Entrega 🛵💨',
            DELIVERED: 'Entregue ✅', 
            CONFIRMED: 'Confirmado ✅', 
            CANCELLED: 'Cancelado 🚫' 
        };
        
        // Notify Customer
        if (order.customer.whatsapp_jid && statusLabels[status]) {
            await sendMessageToJid(order.tenant_id, order.customer.whatsapp_jid, `Seu pedido nº ${order.id.slice(-6)}: *${statusLabels[status]}*`);
        }

        // --- GLOBAL FLEET DISPATCH ---
        if (status === 'READY_FOR_PICKUP') {
            // 1. Create Delivery Request for the pool
            const request = await prisma.deliveryRequest.create({
                data: {
                    order_id: order.id,
                    tenant_id: order.tenant_id,
                    status: 'PENDING'
                },
                include: { order: { include: { tenant: true, customer: true } } }
            });

            // 2. Notify Global Fleet via Socket
            io.to('drivers_global').emit('new_delivery_request', request);

            // 3. Notify Online Drivers via PUSH
            const onlineDrivers = await prisma.deliveryDriver.findMany({ where: { isOnline: true } });
            for (const driver of onlineDrivers) {
                if (driver.fcm_token) {
                    sendPushNotification(
                        driver.fcm_token, 
                        '🛵 Entrega Disponível!', 
                        `Novo pedido pronto em ${order.tenant.name}`
                    );
                }

                // 4. Notify Online Drivers via WhatsApp (RELIABILITY)
                const driverJid = `${driver.phone}@s.whatsapp.net`;
                const text = `🛵 *NOVO PEDIDO DISPONÍVEL!* 🚀\n\n🏠 *Loja:* ${order.tenant.name}\n📍 *Entrega:* ${order.delivery_address || 'Endereço não informado'}\n💰 *Geral:* R$ ${order.total.toFixed(2)}\n\n*Abra o painel para aceitar:* ${req.protocol}://${req.get('host')}/driver`;
                await sendMessageToJid(order.tenant_id, driverJid, text);
            }
        }

        res.json(order);
    } catch (e) { res.status(500).json({ error: 'Error' }); }
});

// SUPERADMIN Drivers CRUD
app.post('/api/superadmin/drivers', authMiddleware, async (req: any, res) => {
    if (req.user.email !== 'admin@admin.com') return res.status(403).json({ error: 'Denied' });
    try {
        const { name, phone, password } = req.body;
        console.log(`[DRIVER-CREATE] Attempting to create driver: ${name} (${phone})`);
        
        const exists = await prisma.deliveryDriver.findUnique({ where: { phone } });
        if (exists) {
            console.log(`[DRIVER-CREATE] Error: Phone ${phone} already registered.`);
            return res.status(400).json({ error: 'Este telefone já está cadastrado em outro motorista.' });
        }

        const driver = await prisma.deliveryDriver.create({
            data: { name, phone, password }
        });
        console.log(`[DRIVER-CREATE] Success: Driver ${driver.id} created.`);
        res.json(driver);
    } catch(e: any) { 
        console.error(`[DRIVER-CREATE] Crash:`, e);
        res.status(500).json({ error: 'Erro ao criar motorista: ' + e.message }); 
    }
});

app.get('/api/superadmin/drivers', authMiddleware, async (req: any, res) => {
    if (req.user.email !== 'admin@admin.com') return res.status(403).json({ error: 'Denied' });
    const drivers = await prisma.deliveryDriver.findMany();
    res.json(drivers);
});

app.delete('/api/superadmin/drivers/:id', authMiddleware, async (req: any, res) => {
    if (req.user.email !== 'admin@admin.com') return res.status(403).json({ error: 'Denied' });
    await prisma.deliveryDriver.delete({ where: { id: req.params.id } });
    res.json({ success: true });
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

// --- MOTOBODY API ---
app.get('/api/driver/me', authMiddleware, async (req: any, res) => {
    if (req.user.type !== 'DRIVER') return res.status(403).json({ error: 'Proibido' });
    try {
        const driver = await prisma.deliveryDriver.findUnique({ 
            where: { id: req.user.driver_id } 
        });
        if (!driver) return res.status(404).json({ error: 'Driver não encontrado' });
        
        // Calculate balance
        const aggregate = await prisma.transaction.groupBy({
            by: ['type'],
            where: { driver_id: req.user.driver_id },
            _sum: { amount: true }
        });
        const earnings = aggregate.find(a => a.type === 'EARNING')?._sum.amount || 0;
        const payouts = aggregate.find(a => a.type === 'PAYOUT')?._sum.amount || 0;
        const balance = earnings - payouts;

        res.json({ ...driver, balance });
    } catch(e) { res.status(500).json({ error: 'Erro' }); }
});

app.post('/api/driver/login', async (req: any, res) => {
    try {
        const { phone, password } = req.body;
        const driver = await prisma.deliveryDriver.findUnique({ where: { phone } });
        if (!driver || driver.password !== password) return res.status(401).json({ error: 'Credenciais inválidas' });
        const token = jwt.sign({ driver_id: driver.id, type: 'DRIVER' }, JWT_SECRET!);
        res.json({ token, driver });
    } catch(e) { res.status(500).json({ error: 'Erro no login' }); }
});

app.get('/api/driver/deliveries/:driverId', async (req: any, res) => {
    try {
        const deliveries = await prisma.deliveryRequest.findMany({
            where: { driver_id: req.params.driverId },
            include: { order: { include: { customer: true, tenant: true } } },
            orderBy: { created_at: 'desc' }
        });
        res.json(deliveries);
    } catch(e) { res.status(500).json({ error: 'Erro ao buscar entregas' }); }
});

app.get('/api/drivers/online', authMiddleware, async (req: any, res) => {
    try {
        const drivers = await prisma.deliveryDriver.findMany({
            where: { isOnline: true },
            select: { id: true, name: true, latitude: true, longitude: true, isOnline: true }
        });
        res.json(drivers);
    } catch(e) { res.status(500).json([]); }
});

app.get('/api/driver/my-deliveries', authMiddleware, async (req: any, res) => {
    if (req.user.type !== 'DRIVER') return res.status(403).json({ error: 'Proibido' });
    try {
        const deliveries = await prisma.deliveryRequest.findMany({
            where: { driver_id: req.user.driver_id, status: 'ACCEPTED' },
            include: { order: { include: { customer: true, tenant: true } } }
        });
        res.json(deliveries);
    } catch(e) { res.status(500).json([]); }
});

app.get('/api/driver/requests', authMiddleware, async (req: any, res) => {
    if (req.user.type !== 'DRIVER') return res.status(403).json({ error: 'Proibido' });
    try {
        const requests = await prisma.deliveryRequest.findMany({
             where: { 
                 OR: [
                     { status: 'PENDING' },
                     { status: 'ACCEPTED', driver_id: req.user.driver_id }
                 ]
             },
             include: { order: { include: { customer: true, tenant: true } } }
        });
        res.json(requests);
    } catch(e) { res.status(500).json({ error: 'Erro' }); }
});

app.post('/api/driver/accept/:requestId', authMiddleware, async (req: any, res) => {
    if (req.user.type !== 'DRIVER') return res.status(403).json({ error: 'Proibido' });
    try {
        const request = await prisma.deliveryRequest.findUnique({ where: { id: req.params.requestId }, include: { order: { include: { customer: true } } } });
        if (!request || request.status !== 'PENDING') return res.status(400).json({ error: 'Não disponível' });
        
        await prisma.$transaction([
            prisma.deliveryRequest.update({ where: { id: request.id }, data: { status: 'ACCEPTED', driver_id: req.user.driver_id } }),
            prisma.order.update({ where: { id: request.order_id }, data: { status: 'OUT_FOR_DELIVERY' } })
        ]);
        
        // Notify others
        io.to(`driver_${req.user.tenant_id}`).emit('delivery_accepted', { requestId: request.id });
        io.to(req.user.tenant_id).emit('order_out', { orderId: request.order_id });
        
        // WhatsApp notify
        const protocol = req.protocol;
        const host = req.get('host');
        const trackingUrl = `${protocol}://${host}/tracking/${request.order_id}`; 
        if (request.order.customer.whatsapp_jid) {
            await sendMessageToJid(req.user.tenant_id, request.order.customer.whatsapp_jid, `Seu pedido saiu para entrega com nosso motoboy! 🛵💨\nAcompanhe ao vivo pelo GPS:\n${trackingUrl}`);
        }
        const updatedRequest = await prisma.deliveryRequest.findUnique({
            where: { id: request.id },
            include: { order: { include: { customer: true, tenant: true } } }
        });

        res.json(updatedRequest);
    } catch(e) { res.status(500).json({ error: 'Erro' }); }
});

app.post('/api/driver/finish/:requestId', authMiddleware, async (req: any, res) => {
    if (req.user.type !== 'DRIVER') return res.status(403).json({ error: 'Proibido' });
    try {
        const request = await prisma.deliveryRequest.findUnique({ where: { id: req.params.requestId }, include: { order: { include: { customer: true } } } });
        if (!request || request.status !== 'ACCEPTED') return res.status(400).json({ error: 'Não disponível' });
        
        const tenant = await prisma.tenant.findUnique({ where: { id: request.tenant_id } });
        const commission = tenant?.commission_rate || 5.0;

        await prisma.$transaction([
            prisma.deliveryRequest.update({ where: { id: request.id }, data: { status: 'COMPLETED' } }),
            prisma.order.update({ where: { id: request.order_id }, data: { status: 'DELIVERED' } }),
            prisma.transaction.create({
                data: {
                    driver_id: req.user.driver_id,
                    amount: commission,
                    type: 'EARNING',
                    description: `Entrega do pedido #${request.order_id.slice(-4)}`
                }
            })
        ]);
        
        io.to(request.tenant_id).emit('order_delivered', { orderId: request.order_id });
        if (request.order.customer.whatsapp_jid) {
            await sendMessageToJid(request.tenant_id, request.order.customer.whatsapp_jid, `Seu pedido foi entregue com sucesso! Bom apetite! 🍔😋`);
        }
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: 'Erro' }); }
});

app.get('/api/driver/wallet', authMiddleware, async (req: any, res) => {
    if (req.user.type !== 'DRIVER') return res.status(403).json({ error: 'Proibido' });
    try {
        const transactions = await prisma.transaction.findMany({
            where: { driver_id: req.user.driver_id },
            orderBy: { created_at: 'desc' },
            take: 20
        });
        const aggregate = await prisma.transaction.groupBy({
            by: ['type'],
            where: { driver_id: req.user.driver_id },
            _sum: { amount: true }
        });
        
        const earnings = aggregate.find(a => a.type === 'EARNING')?._sum.amount || 0;
        const payouts = aggregate.find(a => a.type === 'PAYOUT')?._sum.amount || 0;
        const balance = earnings - payouts;

        res.json({ balance, transactions });
    } catch(e) { res.status(500).json({ error: 'Erro' }); }
});

app.get('/api/tracking/:orderId', async (req: any, res) => {
    try {
        const order = await prisma.order.findUnique({ 
            where: { id: req.params.orderId }, 
            include: { 
                customer: true, 
                tenant: true,
                deliveryRequest: {
                    include: {
                        driver: true
                    }
                },
                deliveryTrackings: { orderBy: { updated_at: 'desc' }, take: 1 } 
            } 
        });
        if (!order) return res.status(404).json({ error: 'Não encontrado' });
        
        // If no tracking history yet, use the driver's current position from the driver model
        if (order.deliveryTrackings.length === 0 && order.deliveryRequest?.driver) {
            const driver = order.deliveryRequest.driver;
            if (driver.latitude && driver.longitude) {
                (order as any).deliveryTrackings = [{
                    latitude: driver.latitude,
                    longitude: driver.longitude,
                    updated_at: driver.created_at // fallback
                }];
            }
        }

        res.json(order);
    } catch(e) { 
        console.error(e);
        res.status(500).json({ error: 'Erro' }); 
    }
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

const seedDatabase = async () => {
    const count = await prisma.tenant.count();
    if (count === 0) {
        console.log('Seeding initial PitDog store...');
        const hashedPassword = await bcrypt.hash('123456', 10);
        const tenant = await prisma.tenant.create({
            data: {
                name: 'PitDog Demo',
                slug: 'pitdog-demo',
                status: 'ACTIVE',
                payment_status: 'ACTIVE',
            }
        });
        await prisma.gymAdmin.create({
            data: {
                name: 'Admin',
                email: 'admin@admin.com',
                password: hashedPassword,
                tenant_id: tenant.id
            }
        });
    }
};

server.listen(process.env.PORT || 3000, async () => {
    console.log(`Server is running on port ${process.env.PORT || 3000}`);
    await seedDatabase();
    initScheduler();
    setTimeout(reconnectSessions, 2000);
});
