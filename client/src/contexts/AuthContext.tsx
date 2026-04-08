import React, { createContext, useContext, useState, useEffect } from 'react';

interface User {
    id: string;
    email: string;
    name?: string;
    tenant_id?: string;
    role?: string;
    logo_url?: string;
    primary_color?: string;
    enable_scheduling?: boolean;
}

interface AuthContextType {
    user: User | null;
    login: (token: string, user: User) => void;
    logout: () => void;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(() => {
        try {
            const token = localStorage.getItem('token');
            const storedUser = localStorage.getItem('user');
            if (!token || !storedUser) return null;
            return JSON.parse(storedUser);
        } catch (e) {
            console.error("Error parsing stored user:", e);
            return null;
        }
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Handle cross-tab sync
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === 'token' || e.key === 'user') {
                const token = localStorage.getItem('token');
                const storedUser = localStorage.getItem('user');
                if (!token || !storedUser) {
                    setUser(null);
                } else {
                    try {
                        setUser(JSON.parse(storedUser));
                    } catch (err) {
                        setUser(null);
                    }
                }
            }
        };

        window.addEventListener('storage', handleStorageChange);

        const token = localStorage.getItem('token');
        const storedUser = localStorage.getItem('user');

        if (!token || !storedUser) {
            if (user) setUser(null);
        } else {
            try {
                const parsed = JSON.parse(storedUser);
                if (JSON.stringify(parsed) !== JSON.stringify(user)) {
                    setUser(parsed);
                }
            } catch (e) {
                setUser(null);
            }
        }

        setLoading(false);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, [user]);

    const login = (token: string, userData: User) => {
        if (!token) {
            console.error("Attempted to login with empty token");
            return;
        }
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(userData));
        setUser(userData);
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within an AuthProvider');
    return context;
};
