/**
 * 百度搜索联想词。
 * 扩展新标签页可直连 sugrec；本地开发没有主机权限，改走 Vite 代理。
 */

const SUGGEST_LIMIT = 10
const QUERY_LIMIT = 64

/** 从 sugrec 响应里取出不重复的联想词 */
export const parseBaiduSuggestions = (payload) => {
    const list = Array.isArray(payload?.g) ? payload.g : []
    const seen = new Set()
    const result = []

    for (const item of list) {
        if (item?.type && item.type !== 'sug') continue
        const text = typeof item?.q === 'string' ? item.q.trim() : ''
        if (!text || seen.has(text)) continue
        seen.add(text)
        result.push(text)
        if (result.length >= SUGGEST_LIMIT) break
    }

    return result
}

const suggestionUrl = (keyword) => {
    const encoded = encodeURIComponent(keyword)
    const inExtension = globalThis.location?.protocol === 'chrome-extension:'
    if (inExtension) {
        return `https://www.baidu.com/sugrec?prod=pc&from=pc_web&wd=${encoded}`
    }
    return `/api/baidu-suggest?wd=${encoded}`
}

/** 按当前输入拉取百度联想词。调用方用 AbortSignal 取消过期请求 */
export const fetchBaiduSuggestions = async (keyword, signal) => {
    const query = keyword.trim()
    if (!query || query.length > QUERY_LIMIT) return []

    const response = await fetch(suggestionUrl(query), {
        signal,
        credentials: 'omit',
        headers: { Accept: 'application/json' },
    })
    if (!response.ok) return []
    return parseBaiduSuggestions(await response.json())
}
