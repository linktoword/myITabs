/**
 * 在新标签页打开网址，保留当前新标签页。
 * 扩展环境优先使用 chrome.tabs.create；本地预览回退到 window.open。
 */
export function openInNewTab(url) {
    if (!url) return;

    const tabsApi = globalThis.chrome?.tabs;
    if (typeof tabsApi?.create === 'function') {
        try {
            const result = tabsApi.create({ url });
            if (result && typeof result.catch === 'function') {
                result.catch(() => window.open(url, '_blank', 'noopener,noreferrer'));
            }
            return;
        } catch {
            // 扩展 API 不可用时走下面的回退
        }
    }

    window.open(url, '_blank', 'noopener,noreferrer');
}
