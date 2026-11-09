import { useState, useEffect } from 'react';
import { getAllIconUrls, loadDisplayIcon, normalizeIconUrl } from '../utils/icons';

export const useIconSource = (shortcut) => {
    const [iconSrc, setIconSrc] = useState(null);

    useEffect(() => {
        let isMounted = true;
        let blobUrl = null;

        const load = async () => {
            // 1. Custom Data (Base64) - No caching needed (already local)
            if (shortcut.customIcon?.type === 'custom') {
                if (isMounted) setIconSrc(shortcut.customIcon.data);
                return;
            }

            // 2. Letter - No image source
            if (shortcut.customIcon?.type === 'letter') {
                if (isMounted) setIconSrc(null);
                return;
            }

            let cache = null;
            try {
                cache = await caches.open('icon-cache');
            } catch {
                cache = null;
            }

            const showIcon = async (iconUrl) => {
                const resolved = await loadDisplayIcon(iconUrl, cache);
                if (!isMounted) {
                    if (typeof resolved === 'string' && resolved.startsWith('blob:')) {
                        URL.revokeObjectURL(resolved);
                    }
                    return false;
                }
                if (typeof resolved === 'string' && resolved.startsWith('blob:')) {
                    blobUrl = resolved;
                }
                setIconSrc(resolved);
                return resolved !== false;
            };

            // 3. 用户指定的网络图标。404 时改为字母图标
            if (shortcut.customIcon?.url) {
                await showIcon(normalizeIconUrl(shortcut.customIcon.url));
                return;
            }

            // 4. 按网址自动取图标，404 时继续尝试下一个来源
            const candidates = getAllIconUrls(shortcut.url);
            if (!candidates.length) {
                if (isMounted) setIconSrc(false);
                return;
            }

            try {
                for (const candidate of candidates) {
                    const found = await showIcon(candidate.url);
                    if (found) return;
                }
                if (isMounted) setIconSrc(false);
            } catch (error) {
                console.warn('Icon loading failed:', error);
                if (isMounted) setIconSrc(false);
            }
        };

        load();

        return () => {
            isMounted = false;
            if (blobUrl) URL.revokeObjectURL(blobUrl);
        };
    }, [shortcut]);

    return iconSrc;
};
