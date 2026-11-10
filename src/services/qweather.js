/**
 * 和风天气请求。
 * 开发环境走 Vite 代理，扩展页面直接请求用户自己的 API Host。
 * 文档：https://dev.qweather.com/docs/api/
 */

const CACHE_KEY = 'weather_cache';
const CACHE_TTL = 30 * 60 * 1000;
const LEGACY_HOSTS = new Set(['devapi.qweather.com', 'geoapi.qweather.com']);
const inflight = new Map();

/** 只允许和风官方 Host，避免把 Key 发到任意地址 */
export function normalizeQWeatherHost(input) {
  if (!input) return '';
  const host = String(input)
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .replace(/\.$/, '')
    .toLowerCase();
  if (!host || !/^[a-z0-9.-]+$/.test(host)) return '';
  if (host.endsWith('.qweatherapi.com') || LEGACY_HOSTS.has(host)) return host;
  return '';
}

export function normalizeWeatherConfig(config = {}) {
  const cities = Array.isArray(config.cities)
    ? config.cities.filter((city) => city && typeof city.locationId === 'string' && typeof city.name === 'string')
    : [];
  const activeLocationId = typeof config.activeLocationId === 'string' ? config.activeLocationId : '';
  return {
    apiHost: typeof config.apiHost === 'string' ? config.apiHost : '',
    apiKey: typeof config.apiKey === 'string' ? config.apiKey : '',
    activeLocationId: cities.some((city) => city.locationId === activeLocationId)
      ? activeLocationId
      : (cities[0]?.locationId || ''),
    cities: cities.map((city) => ({
      locationId: city.locationId,
      name: city.name,
      adm1: typeof city.adm1 === 'string' ? city.adm1 : '',
      adm2: typeof city.adm2 === 'string' ? city.adm2 : '',
      isMyLocation: Boolean(city.isMyLocation),
    })),
  };
}

function readCacheStore() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function readCache(key) {
  const entry = readCacheStore()[key];
  if (!entry || Date.now() - entry.fetchedAt > CACHE_TTL) return null;
  return entry.data;
}

function writeCache(key, data) {
  const store = readCacheStore();
  store[key] = { fetchedAt: Date.now(), data };
  localStorage.setItem(CACHE_KEY, JSON.stringify(store));
}

export function clearWeatherCache() {
  localStorage.removeItem(CACHE_KEY);
}

function cacheKey(host, kind, locationId) {
  return `${host}|${kind}|${locationId}`;
}

function shareRequest(key, factory) {
  const pending = inflight.get(key);
  if (pending) return pending;
  const promise = factory().finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}

async function qweatherGet({ apiHost, apiKey, path, optional = false, allowEmpty = false }) {
  const host = normalizeQWeatherHost(apiHost);
  if (!host || !apiKey) {
    if (optional) return null;
    throw new Error(host ? '请先填写 API Key' : 'API Host 无效，请填写分配的 qweatherapi.com 域名');
  }

  const url = import.meta.env.DEV
    ? `/api/qweather?host=${encodeURIComponent(host)}&path=${encodeURIComponent(path)}`
    : `https://${host}${path}`;

  let response;
  try {
    response = await fetch(url, {
      headers: { 'X-QW-Api-Key': apiKey },
    });
  } catch {
    if (optional) return null;
    throw new Error('网络请求失败');
  }

  if (!response.ok) {
    if (optional) return null;
    throw new Error(`请求失败（${response.status}）`);
  }

  const data = await response.json();
  if (data.code === '204' && allowEmpty) return data;
  if (data.code !== '200') {
    if (optional) return null;
    if (data.code === '401' || data.code === '403') throw new Error('API Key 无效或没有权限');
    if (data.code === '204') throw new Error('没有查询到数据');
    throw new Error(`和风天气返回 ${data.code}`);
  }
  return data;
}

/** 城市搜索。location 可以是城市名，也可以是“经度,纬度” */
export function lookupCities({ apiHost, apiKey, location }) {
  const keyword = String(location || '').trim();
  if (!keyword) return Promise.resolve([]);
  return qweatherGet({
    apiHost,
    apiKey,
    path: `/geo/v2/city/lookup?location=${encodeURIComponent(keyword)}&number=8&lang=zh`,
    allowEmpty: true,
  }).then((data) => (data.location || []).map((item) => ({
    locationId: item.id,
    name: item.name,
    adm1: item.adm1 || '',
    adm2: item.adm2 || '',
    isMyLocation: false,
  })));
}

function toBrief(now, daily) {
  const today = daily?.[0] || {};
  return {
    temp: now?.temp || '',
    text: now?.text || '',
    icon: now?.icon || '',
    tempMax: today.tempMax || '',
    tempMin: today.tempMin || '',
  };
}

/** 实况、逐小时、7 天，以及可选的空气质量和生活指数 */
export function fetchWeatherBundle({ apiHost, apiKey, locationId, force = false }) {
  const host = normalizeQWeatherHost(apiHost);
  const key = cacheKey(host, 'bundle', locationId);
  // 组件加载、打开详情和切换城市时需要主动刷新，force 时跳过缓存读取。
  const cached = force ? null : readCache(key);
  if (cached) return Promise.resolve(cached);

  return shareRequest(key, async () => {
    const location = encodeURIComponent(locationId);
    const [nowData, hourlyData, dailyData, airData, indexData] = await Promise.all([
      qweatherGet({ apiHost, apiKey, path: `/v7/weather/now?location=${location}&lang=zh` }),
      qweatherGet({ apiHost, apiKey, path: `/v7/weather/24h?location=${location}&lang=zh` }),
      qweatherGet({ apiHost, apiKey, path: `/v7/weather/7d?location=${location}&lang=zh` }),
      qweatherGet({ apiHost, apiKey, path: `/v7/air/now?location=${location}&lang=zh`, optional: true }),
      qweatherGet({ apiHost, apiKey, path: `/v7/indices/1d?type=1&location=${location}&lang=zh`, optional: true }),
    ]);
    const bundle = {
      now: nowData.now,
      hourly: hourlyData.hourly || [],
      daily: dailyData.daily || [],
      air: airData?.now || null,
      indexText: indexData?.daily?.[0]?.text || '',
    };
    writeCache(key, bundle);
    writeCache(cacheKey(host, 'brief', locationId), toBrief(bundle.now, bundle.daily));
    return bundle;
  });
}

/** 城市列表只需要当前温度和当天高低 */
export function fetchCityBrief({ apiHost, apiKey, locationId, force = false }) {
  const host = normalizeQWeatherHost(apiHost);
  const key = cacheKey(host, 'brief', locationId);
  // 城市列表也要跟随详情弹框打开和城市切换刷新。
  const cached = force ? null : readCache(key);
  if (cached) return Promise.resolve(cached);
  const bundled = force ? null : readCache(cacheKey(host, 'bundle', locationId));
  if (bundled) {
    const brief = toBrief(bundled.now, bundled.daily);
    writeCache(key, brief);
    return Promise.resolve(brief);
  }

  return shareRequest(key, async () => {
    const location = encodeURIComponent(locationId);
    const [nowData, dailyData] = await Promise.all([
      qweatherGet({ apiHost, apiKey, path: `/v7/weather/now?location=${location}&lang=zh` }),
      qweatherGet({ apiHost, apiKey, path: `/v7/weather/7d?location=${location}&lang=zh` }),
    ]);
    const brief = toBrief(nowData.now, dailyData.daily);
    writeCache(key, brief);
    return brief;
  });
}
