import { EventEmitter } from 'events';

export const eventBus = new EventEmitter();

export const EVENTS = {
    CHECKIN_GRANTED: 'checkin:granted',
    CHECKIN_DENIED: 'checkin:denied',
    NEW_MESSAGE: 'chat:new_message',
    ATTENDANCE_REQUESTED: 'attendance:requested'
};
