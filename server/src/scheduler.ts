import cron from 'node-cron';
import { prisma } from './db.js';
import { sessions, humanizedSendMessage } from './whatsappManager.js';

export const initScheduler = () => {
    // Empty scheduler for now
    // Future: Follow up on abandoned carts, etc
};
