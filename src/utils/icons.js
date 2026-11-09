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

const ICON_CACHE_NAME = 'icon-cache';
const ICON_MISS_KEY = 'icon_miss_cache';
const ICON_MISS_TTL = 7 * 24 * 60 * 60 * 1000;

/** 同一地址的并发请求共用一个结果，避免缓存写完前重复下载 */
const iconLoads = new Map();

const readIconMisses = () => {
    try {
        const parsed = JSON.parse(localStorage.getItem(ICON_MISS_KEY) || '{}');
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
};

const writeIconMisses = (misses) => {
    try {
        localStorage.setItem(ICON_MISS_KEY, JSON.stringify(misses));
    } catch {
        // 存储满了就放弃这次记录
    }
};

/** 7 天内确认过 404 的地址不再请求 */
const isRecentIconMiss = (iconUrl) => {
    const misses = readIconMisses();
    const expiresAt = misses[iconUrl];
    if (!expiresAt) return false;
    if (Date.now() > expiresAt) {
        delete misses[iconUrl];
        writeIconMisses(misses);
        return false;
    }
    return true;
};

const rememberIconMiss = (iconUrl) => {
    const misses = readIconMisses();
    const now = Date.now();
    Object.keys(misses).forEach((key) => {
        if (!misses[key] || now > misses[key]) delete misses[key];
    });
    misses[iconUrl] = now + ICON_MISS_TTL;
    writeIconMisses(misses);
};

const forgetIconMiss = (iconUrl) => {
    if (!iconUrl) return;
    const misses = readIconMisses();
    if (!misses[iconUrl]) return;
    delete misses[iconUrl];
    writeIconMisses(misses);
};

const openIconCache = async () => {
    try {
        return await caches.open(ICON_CACHE_NAME);
    } catch {
        return null;
    }
};

const readCachedIcon = async (iconUrl, cache) => {
    if (!cache) return null;
    try {
        const cached = await cache.match(iconUrl);
        if (!cached?.ok || cached.type === 'opaque') return null;
        const blob = await cached.blob();
        return blob.size > 0 ? blob : null;
    } catch {
        return null;
    }
};

/** 重定向后的响应不能直接 cache.put，重新包一层再写入 */
const storeCachedIcon = async (iconUrl, buffer, type, cache) => {
    const store = cache || await openIconCache();
    if (!store) return;
    try {
        await store.put(iconUrl, new Response(buffer, {
            status: 200,
            headers: { 'Content-Type': type || 'image/png' }
        }));
    } catch {
        // 缓存失败不影响本次显示
    }
};

const fetchIconBlob = async (iconUrl, cache) => {
    const store = cache || await openIconCache();
    const cached = await readCachedIcon(iconUrl, store);
    if (cached) return cached;

    const response = await requestIcon(iconUrl);
    if (response) {
        if (response.status === 404) {
            rememberIconMiss(iconUrl);
            return false;
        }
        if (isClientError(response.status)) return false;
        if (response.ok) {
            try {
                const buffer = await response.arrayBuffer();
                const type = response.headers.get('content-type') || 'image/png';
                if (!buffer.byteLength || !type.startsWith('image/')) return false;
                await storeCachedIcon(iconUrl, buffer.slice(0), type, store);
                return new Blob([buffer], { type });
            } catch {
                return false;
            }
        }
    }

    return (await probeImageLoad(iconUrl)) ? iconUrl : false;
};

/**
 * 得到可显示的图标地址。命中本地缓存时不再请求网络；确认 404 时返回 false。
 * 每个调用方拿到独立的 blob: 地址，卸载时自行 revoke。
 * @returns {Promise<string|false>}
 */
export const loadDisplayIcon = async (iconUrl, cache) => {
    if (!iconUrl) return false;
    if (iconUrl.startsWith('data:') || iconUrl.startsWith('blob:')) return iconUrl;
    if (isRecentIconMiss(iconUrl)) return false;

    let pending = iconLoads.get(iconUrl);
    if (!pending) {
        pending = fetchIconBlob(iconUrl, cache).finally(() => {
            iconLoads.delete(iconUrl);
        });
        iconLoads.set(iconUrl, pending);
    }

    const result = await pending;
    if (result === false) return false;
    if (typeof result === 'string') return result;
    if (result instanceof Blob) return URL.createObjectURL(result);
    return false;
};

/**
 * 图标能否显示。Google 返回 404 时为 false，界面应改用字母图标。
 */
export const isIconUrlUsable = async (iconUrl) => {
    const display = await loadDisplayIcon(iconUrl);
    if (typeof display === 'string' && display.startsWith('blob:')) {
        URL.revokeObjectURL(display);
    }
    return Boolean(display);
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
        const forget = async (iconUrl) => {
            if (!iconUrl) return;
            forgetIconMiss(iconUrl);
            await cache.delete(iconUrl);
            const normalized = normalizeIconUrl(iconUrl);
            if (normalized && normalized !== iconUrl) {
                forgetIconMiss(normalized);
                await cache.delete(normalized);
            }
        };

        if (shortcut.customIcon?.url) {
            await forget(shortcut.customIcon.url);
        }
        
        // 2. Also try to clean up potential auto-detected URLs
        if (shortcut.url) {
            const domain = hostnameOf(shortcut.url);
            if (domain) {
                await cache.delete(`https://logo.clearbit.com/${domain}`);
            }
            const candidates = getAllIconUrls(shortcut.url);
            for (const candidate of candidates) {
                await forget(candidate.url);
            }
        }
    } catch (e) {
        console.warn('Failed to remove icon from cache:', e);
    }
};
