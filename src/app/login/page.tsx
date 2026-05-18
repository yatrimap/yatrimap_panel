'use client';

import { useState } from "react";
import axios from "axios";
import { toast } from 'sonner';
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

const Login = () => {
    const router = useRouter();
    const { setUser } = useAuth();
    const [loading, setLoading] = useState(false);
    const [credentials, setCredentials] = useState({
        username: "",
        password: "",
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setCredentials({ ...credentials, [e.target.name]: e.target.value });
    };

    const base_url = process.env.NEXT_PUBLIC_API_URL;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault(); 
        setLoading(true);
        try {
            const response = await axios.post(`${base_url}/admin/hotel-admin-auth/login`, credentials);
            
            const token = response.data?.data?.token;
            const userData = response.data?.data;
            
            if (token) {
                localStorage.setItem("admintoken", token);
                setUser(userData); // Set user in context
                toast.success("Login successful!");
                
                router.push('/');
            } else {
                toast.error("Token not found in response.");
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Login failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
            <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="rounded-xl border border-gray-100 bg-gradient-to-r from-green-50 to-teal-50 p-6 shadow-lg sm:p-8">
                    <div className="mb-6 space-y-2 text-center">
                        <h1 className="text-3xl font-bold tracking-tight text-green-800">Login</h1>
                        <p className="text-sm text-green-600">
                            Enter your credentials to access your account.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-sm font-medium leading-none text-green-700 peer-disabled:cursor-not-allowed peer-disabled:opacity-70" htmlFor="username">
                                Email
                            </label>
                            <input
                                id="username"
                                name="username"
                                type="email"
                                value={credentials.username}
                                onChange={handleChange}
                                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500 disabled:cursor-not-allowed disabled:opacity-50"
                                placeholder="Enter your email"
                                required
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-medium leading-none text-green-700 peer-disabled:cursor-not-allowed peer-disabled:opacity-70" htmlFor="password">
                                Password
                            </label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                value={credentials.password}
                                onChange={handleChange}
                                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500 disabled:cursor-not-allowed disabled:opacity-50"
                                placeholder="Enter your password"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="mt-6 flex w-full cursor-pointer items-center justify-center rounded-md bg-gradient-to-r from-green-600 to-teal-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:from-green-700 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {loading ? (
                                <span className="flex items-center gap-2">
                                    <svg className="h-5 w-5 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Saving...
                                </span>
                            ) : (
                                "Login"
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Login;
