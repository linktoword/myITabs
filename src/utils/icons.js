// 快捷方式图标地址。Clearbit Logo API 已下线，只使用 Google Favicon。

const googleFaviconUrl = (domain) =>
    `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;

const hostnameOf = (url) => {
    try {
        return new URL(url).hostname;
    } catch {
        return '';
    }
};

/** 把已保存的 Clearbit 地址换成 Google Favicon，避免继续请求已下线域名 */
export const normalizeIconUrl = (iconUrl) => {
    if (!iconUrl || typeof iconUrl !== 'string') return iconUrl;
    try {
        const parsed = new URL(iconUrl);
        if (parsed.hostname !== 'logo.clearbit.com') return iconUrl;
        const domain = decodeURIComponent(parsed.pathname.replace(/^\/+/, '').split('/')[0] || '');
        return domain ? googleFaviconUrl(domain) : iconUrl;
    } catch {
        return iconUrl;
    }
};

export const getIconUrl = (url) => {
    const domain = hostnameOf(url);
    return domain ? googleFaviconUrl(domain) : null;
};

// 自动探测可用的图标地址
export const getAllIconUrls = (url) => {
    const domain = hostnameOf(url);
    if (!domain) return [];
    return [
        { source: 'google', url: googleFaviconUrl(domain), name: 'Google' }
    ];
};

export const getIconSources = (url) => {
    const domain = hostnameOf(url);
    if (!domain) return null;
    return {
        google: googleFaviconUrl(domain)
    };
};

// Remove icon from cache
export const removeIconFromCache = async (shortcut) => {
    if (!shortcut) return;
    
    try {
        const cache = await caches.open('icon-cache');
        
        // 1. If it has a specific custom icon URL
        if (shortcut.customIcon?.url) {
            await cache.delete(shortcut.customIcon.url);
        }
        
        // 2. Also try to clean up potential auto-detected URLs
        if (shortcut.url) {
            const domain = hostnameOf(shortcut.url);
            if (domain) {
                await cache.delete(`https://logo.clearbit.com/${domain}`);
            }
            const candidates = getAllIconUrls(shortcut.url);
            for (const candidate of candidates) {
                await cache.delete(candidate.url);
            }
        }
    } catch (e) {
        console.warn('Failed to remove icon from cache:', e);
    }
};
