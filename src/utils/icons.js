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

/** Google Favicon 404 仍返回占位图，只能靠状态码判断 */
const isGoogleFaviconUrl = (iconUrl) => {
    try {
        const parsed = new URL(iconUrl);
        if (parsed.protocol !== 'https:') return false;
        if (parsed.hostname === 'www.google.com') {
            return parsed.pathname.startsWith('/s2/favicons');
        }
        return parsed.hostname.endsWith('.gstatic.com') && parsed.pathname.startsWith('/faviconV2');
    } catch {
        return false;
    }
};

const probeImageLoad = (iconUrl) => new Promise((resolve) => {
    const img = new Image();
    const timer = setTimeout(() => resolve(false), 8000);
    img.onload = () => {
        clearTimeout(timer);
        resolve(img.naturalWidth > 0 && img.naturalHeight > 0);
    };
    img.onerror = () => {
        clearTimeout(timer);
        resolve(false);
    };
    img.src = iconUrl;
});

/** 读取图标响应。开发环境通过本地代理拿到 Google 的真实状态码 */
const requestIcon = async (iconUrl) => {
    if (!iconUrl || iconUrl.startsWith('data:') || iconUrl.startsWith('blob:')) return null;
    try {
        return await fetch(iconUrl);
    } catch {
        if (import.meta.env.DEV && isGoogleFaviconUrl(iconUrl)) {
            try {
                return await fetch(`/api/favicon-proxy?url=${encodeURIComponent(iconUrl)}`);
            } catch {
                return null;
            }
        }
        return null;
    }
};

const isClientError = (status) => status === 404 || (status >= 400 && status < 500);

/**
 * 图标能否显示。Google 返回 404 时为 false，界面应改用字母图标。
 */
export const isIconUrlUsable = async (iconUrl) => {
    if (!iconUrl) return false;
    if (iconUrl.startsWith('data:') || iconUrl.startsWith('blob:')) return true;
    const response = await requestIcon(iconUrl);
    if (response) {
        if (response.ok) return true;
        if (isClientError(response.status)) return false;
    }
    return probeImageLoad(iconUrl);
};

/**
 * 得到可显示的图标地址。确认 404 时返回 false。
 * @returns {Promise<string|false>}
 */
export const loadDisplayIcon = async (iconUrl, cache) => {
    if (!iconUrl) return false;
    if (iconUrl.startsWith('data:') || iconUrl.startsWith('blob:')) return iconUrl;

    if (cache) {
        try {
            const cached = await cache.match(iconUrl);
            if (cached?.ok && cached.type !== 'opaque') {
                const blob = await cached.blob();
                if (blob.size > 0) return URL.createObjectURL(blob);
            }
        } catch {
            // 缓存不可用时继续请求网络
        }
    }

    const response = await requestIcon(iconUrl);
    if (response) {
        if (isClientError(response.status)) return false;
        if (response.ok) {
            try {
                const copy = response.clone();
                const blob = await response.blob();
                if (!blob.size || (blob.type && !blob.type.startsWith('image/'))) return false;
                if (cache) {
                    try {
                        await cache.put(iconUrl, copy);
                    } catch {
                        // 缓存失败不影响本次显示
                    }
                }
                return URL.createObjectURL(blob);
            } catch {
                return false;
            }
        }
    }

    return (await probeImageLoad(iconUrl)) ? iconUrl : false;
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
