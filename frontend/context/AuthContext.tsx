'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getAccessToken, setAccessToken, removeAccessToken, getStoredUser, setStoredUser } from '@/lib/auth-cookies';
import { useRouter } from 'next/navigation';

interface User {
    uid: string;
    name: string;
    email: string;
    role: string;
    plan?: string;
    phone?: string;
    profile_pic?: string;
}

interface AuthContextValue {
    user: User | null;
    token: string | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<{ success: boolean; msg?: string }>;
    logout: () => void;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    // Restore session from localStorage
    useEffect(() => {
        const savedToken = getAccessToken();
        const savedUser = getStoredUser();
        if (savedToken && savedUser) {
            setToken(savedToken);
            setUser(savedUser);
        }
        setLoading(false);
    }, []);

    const login = useCallback(async (email: string, password: string) => {
        try {
            const res = await fetch('/api/user/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            const data = await res.json();

            if (data?.token) {
                setAccessToken(data.token);
                const userData: User = {
                    uid: data.uid || data.user?.uid || '',
                    name: data.name || data.user?.name || email.split('@')[0],
                    email,
                    role: data.role || 'user',
                    plan: data.plan || null,
                    phone: data.phone || null,
                    profile_pic: data.profile_pic || null,
                };
                setStoredUser(userData);
                setToken(data.token);
                setUser(userData);
                return { success: true };
            }
            return { success: false, msg: data?.msg || 'Credenciais inválidas' };
        } catch {
            return { success: false, msg: 'Erro de conexão com o servidor' };
        }
    }, []);

    const logout = useCallback(() => {
        removeAccessToken();
        setToken(null);
        setUser(null);
        router.push('/login');
    }, [router]);

    return (
        <AuthContext.Provider
            value={{
                user,
                token,
                loading,
                login,
                logout,
                isAuthenticated: !!token,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
    return ctx;
}
