import axios from 'axios';

const getBaseUrl = () => {
    // Priority: env variable -> window location (for production/coolify) -> localhost fallback
    let url = import.meta.env.VITE_API_URL;

    if (!url && typeof window !== 'undefined') {
        url = window.location.origin;
    }

    if (!url) url = 'http://localhost:3001';

    // Remove trailing slash if present
    if (url.endsWith('/')) url = url.slice(0, -1);

    // Append /api if not present at the end
    if (!url.endsWith('/api')) url += '/api';

    return url;
};

const api = axios.create({
    baseURL: getBaseUrl(),
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            const isLoginPage = window.location.pathname === '/login' || window.location.pathname === '/admin/login';
            if (!isLoginPage) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export default api;
