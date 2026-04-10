import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const serviceAccountPath = path.resolve(__dirname, '../firebase-service-account.json');

if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log('Firebase Admin initialized successfully.');
} else {
    console.warn('!!! Firebase Admin Service Account not found. Push notifications will be disabled.');
}

export const sendPushNotification = async (token: string, title: string, body: string, data?: any) => {
    if (!admin.apps.length) return;
    try {
        await admin.messaging().send({
            token,
            notification: { title, body },
            data: data || {},
            android: { 
                priority: 'high',
                notification: {
                    sound: 'default',
                    channelId: 'orders_channel'
                }
            },
            webpush: { 
                headers: { Urgency: 'high' },
                notification: {
                    icon: '/favicon.ico',
                    badge: '/favicon.ico',
                    requireInteraction: true
                }
             }
        });
    } catch(e) {
        console.error('Error sending fcm:', e);
    }
};
