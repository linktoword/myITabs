import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const rootDir = fileURLToPath(new URL('.', import.meta.url))

/** 开发环境转发百度联想词。浏览器页面没有扩展主机权限，直连会被跨域拦住 */
const baiduSuggestProxyPlugin = () => ({
  name: 'baidu-suggest-proxy',
  configureServer(server) {
    server.middlewares.use('/api/baidu-suggest', baiduSuggestMiddleware)
  },
  configurePreviewServer(server) {
    server.middlewares.use('/api/baidu-suggest', baiduSuggestMiddleware)
  },
})

const baiduSuggestMiddleware = async (req, res) => {
  try {
    const parsed = new URL(req.url, 'http://127.0.0.1')
    const wd = (parsed.searchParams.get('wd') || '').trim()
    if (!wd || wd.length > 64) {
      res.statusCode = 400
      res.end('bad query')
      return
    }
    const upstream = await fetch(
      `https://www.baidu.com/sugrec?prod=pc&from=pc_web&wd=${encodeURIComponent(wd)}`,
      { headers: { Accept: 'application/json' } },
    )
    const body = new Uint8Array(await upstream.arrayBuffer())
    res.statusCode = upstream.status
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(body)
  } catch {
    res.statusCode = 502
    res.end('proxy failed')
  }
}

const LEGACY_QWEATHER_HOSTS = new Set(['devapi.qweather.com', 'geoapi.qweather.com'])

/** 与 src/services/qweather.js 的 Host 白名单保持一致 */
const isAllowedQWeatherHost = (host) => {
  if (!host || !/^[a-z0-9.-]+$/.test(host)) return false
  return host.endsWith('.qweatherapi.com') || LEGACY_QWEATHER_HOSTS.has(host)
}

const isAllowedQWeatherPath = (path) => (
  Boolean(path)
  && path.startsWith('/')
  && !path.includes('..')
  && !path.includes('\\')
  && (path.startsWith('/geo/') || path.startsWith('/v7/'))
)

/** 开发环境转发和风天气。浏览器页面没有扩展主机权限，直连会被跨域拦住 */
const qweatherProxyPlugin = () => ({
  name: 'qweather-proxy',
  configureServer(server) {
    server.middlewares.use('/api/qweather', qweatherProxyMiddleware)
  },
  configurePreviewServer(server) {
    server.middlewares.use('/api/qweather', qweatherProxyMiddleware)
  },
})

const qweatherProxyMiddleware = async (req, res) => {
  try {
    const parsed = new URL(req.url, 'http://127.0.0.1')
    const host = (parsed.searchParams.get('host') || '').toLowerCase()
    const path = parsed.searchParams.get('path') || ''
    if (!isAllowedQWeatherHost(host) || !isAllowedQWeatherPath(path)) {
      res.statusCode = 400
      res.end('bad request')
      return
    }
    const headers = { Accept: 'application/json' }
    const apiKey = req.headers['x-qw-api-key']
    if (typeof apiKey === 'string' && apiKey) headers['X-QW-Api-Key'] = apiKey
    const upstream = await fetch(`https://${host}${path}`, { headers })
    const body = new Uint8Array(await upstream.arrayBuffer())
    res.statusCode = upstream.status
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(body)
  } catch {
    res.statusCode = 502
    res.end('proxy failed')
  }
}

/** 开发环境转发 Google Favicon，便于读取 404 状态码 */
const faviconProxyPlugin = () => ({
  name: 'favicon-proxy',
  configureServer(server) {
    server.middlewares.use('/api/favicon-proxy', async (req, res) => {
      try {
        const parsed = new URL(req.url, 'http://127.0.0.1')
        const target = parsed.searchParams.get('url')
        let allowed = false
        if (target) {
          const iconUrl = new URL(target)
          allowed = iconUrl.protocol === 'https:' && (
            (iconUrl.hostname === 'www.google.com' && iconUrl.pathname.startsWith('/s2/favicons'))
            || (iconUrl.hostname.endsWith('.gstatic.com') && iconUrl.pathname.startsWith('/faviconV2'))
          )
        }
        if (!allowed) {
          res.statusCode = 400
          res.end('bad url')
          return
        }
        const upstream = await fetch(target, { redirect: 'follow' })
        const body = new Uint8Array(await upstream.arrayBuffer())
        res.statusCode = upstream.status
        const contentType = upstream.headers.get('content-type')
        if (contentType) res.setHeader('Content-Type', contentType)
        res.end(body)
      } catch {
        res.statusCode = 502
        res.end('proxy failed')
      }
    })
  },
})

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), faviconProxyPlugin(), baiduSuggestProxyPlugin(), qweatherProxyPlugin()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(rootDir, 'index.html'),
        popup: resolve(rootDir, 'popup.html'),
      },
    },
  },
})
