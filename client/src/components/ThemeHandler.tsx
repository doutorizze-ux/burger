import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

export const ThemeHandler = () => {
    const { user } = useAuth();

    useEffect(() => {
        const hexToRgb = (hex: string) => {
            let r = 0, g = 0, b = 0;
            if (hex.length === 4) {
                r = parseInt(hex[1] + hex[1], 16);
                g = parseInt(hex[2] + hex[2], 16);
                b = parseInt(hex[3] + hex[3], 16);
            } else if (hex.length === 7) {
                r = parseInt(hex.slice(1, 3), 16);
                g = parseInt(hex.slice(3, 5), 16);
                b = parseInt(hex.slice(5, 7), 16);
            }
            return `${r} ${g} ${b}`;
        };

        const isValidHex = (color: string) => /^#([0-9A-F]{3}){1,2}$/i.test(color);

        if (user?.primary_color && isValidHex(user.primary_color)) {
            document.documentElement.style.setProperty('--primary-color', user.primary_color);
            document.documentElement.style.setProperty('--primary-rgb', hexToRgb(user.primary_color));
        } else {
            const defaultOrange = '#f97316';
            document.documentElement.style.setProperty('--primary-color', defaultOrange);
            document.documentElement.style.setProperty('--primary-rgb', hexToRgb(defaultOrange));
        }
    }, [user?.primary_color]);

    return null; // This component doesn't render anything
};
