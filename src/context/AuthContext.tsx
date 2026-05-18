'use client';
import { createContext, useState, useEffect, useContext } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import axios from 'axios';

interface User {
    role?: string;
    propertyId?: string;
    [key: string]: any;
}

interface AuthContextType {
    user: User | null;
    setUser: (user: User | null) => void;
    loading: boolean;
    logout: () => void;
    isAuthenticated: boolean;
    isHotelOwner: boolean;
    isHotelAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();

    const base_url = process.env.NEXT_PUBLIC_API_URL;

    // Check if user is authenticated on mount and route changes
    useEffect(() => {
        checkAuth();
    }, [pathname]);

    const checkAuth = async () => {
        try {
            const token = localStorage.getItem('admintoken');
            if (!token) {
                setLoading(false);
                if (pathname !== '/login') {
                    router.push('/login');
                }
                return;
            }

            const response = await axios.get(`${base_url}/admin/hotel-admin-auth/me`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            if (response.data.status === 'SUCCESS') {
                setUser(response.data.data);
                if (pathname === '/login') {
                    router.push('/');
                }
            } else {
                localStorage.removeItem('admintoken');
                setUser(null);
                if (pathname !== '/login') {
                    router.push('/login');
                }
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            localStorage.removeItem('admintoken');
            setUser(null);
            if (pathname !== '/login') {
                router.push('/login');
            }
        } finally {
            setLoading(false);
        }
    };

    const logout = () => {
        localStorage.removeItem('admintoken');
        setUser(null);
        router.push('/login');
    };

    const value = {
        user,
        setUser,
        loading,
        logout,
        isAuthenticated: !!user,
        isHotelOwner: user?.role === 'hotelowner',
        isHotelAdmin: user?.role === 'hoteladmin'
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
