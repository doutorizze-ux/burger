export const formatImageUrl = (url: string | null | undefined) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;

    let baseUrl = import.meta.env.VITE_API_URL || 'https://api.zapp.fitness/api';
    // Remove /api if present at the end
    if (baseUrl.endsWith('/api')) {
        baseUrl = baseUrl.slice(0, -4);
    }
    // Remove trailing slash if present
    if (baseUrl.endsWith('/')) {
        baseUrl = baseUrl.slice(0, -1);
    }

    return `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
};
