/**
 * 天气详情弹框：实况、逐小时折线、7 日高低折线和城市列表。
 * 折线用 SVG 拉伸绘制，圆点和温度数字用 HTML 定位，避免文字被拉变形。
 */
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Clock, Leaf, LocateFixed, PanelRight, X } from 'lucide-react';
import WeatherIcon from './WeatherIcon';
import WeatherSettings from './WeatherSettings';
import { useWeatherBundle } from './useWeatherBundle';
import { formatDayLabel, formatHourLabel, formatMonthDay, formatPublishTime, formatWindScale } from './format';
import { fetchCityBrief, lookupCities, normalizeQWeatherHost, normalizeWeatherConfig } from '../../services/qweather';

const panelStyle = {
  background: 'linear-gradient(160deg, rgba(28, 62, 122, 0.94), rgba(16, 38, 86, 0.96))',
};

function TrendChart({ series, height = 96 }) {
  const values = series.flatMap((item) => item.values).filter((value) => Number.isFinite(value));
  const count = series[0]?.values.length || 0;
  if (values.length < 2 || count < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 1);
  const yOf = (value) => ((max - value) / span) * 45 + 38;
  const xOf = (index) => ((index + 0.5) / count) * 100;
  const pointsOf = (list) => list.map((value, index) => `${xOf(index)},${yOf(value)}`).join(' ');

  return (
    <div className="relative" style={{ height }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        {series.map((item) => (
          <polyline
            key={item.key}
            points={pointsOf(item.values)}
            fill="none"
            stroke="rgba(255,255,255,0.92)"
            strokeWidth="1.6"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      {series.map((item) => item.values.map((value, index) => (
        Number.isFinite(value) ? (
          <div
            key={`${item.key}-${index}`}
            className="absolute"
            style={{ left: `${xOf(index)}%`, top: `${yOf(value)}%`, transform: 'translate(-50%, -50%)' }}
          >
            <span className="block h-2 w-2 rounded-full bg-white shadow" />
            <span
              className={`absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] text-white/90 ${item.label === 'below' ? 'top-3' : '-top-5'}`}
            >
              {Math.round(value)}°
            </span>
          </div>
        ) : null
      )))}
    </div>
  );
}

function CitySearchBox({ apiHost, apiKey, disabled, onPick, placeholder }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [hint, setHint] = useState('');

  useEffect(() => {
    const keyword = query.trim();
    if (!keyword || disabled) return undefined;
    const timer = setTimeout(() => {
      lookupCities({ apiHost, apiKey, location: keyword })
        .then((list) => {
          setResults(list);
          setHint(list.length ? '' : '没有匹配的城市');
        })
        .catch((error) => {
          setResults([]);
          setHint(error.message || '搜索失败');
        });
    }, 400);
    return () => clearTimeout(timer);
  }, [apiHost, apiKey, disabled, query]);

  return (
    <div className="relative">
      <input
        value={query}
        disabled={disabled}
        onChange={(event) => {
          const next = event.target.value;
          setQuery(next);
          if (!next.trim()) {
            setResults([]);
            setHint('');
          }
        }}
        placeholder={placeholder}
        className="w-full rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-sm text-white outline-none placeholder:text-white/40 disabled:opacity-50"
      />
      {(results.length > 0 || hint) && (
        <ul className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-white/10 bg-[#16325f] shadow-xl">
          {results.map((city) => (
            <li key={city.locationId}>
              <button
                type="button"
                onClick={() => {
                  onPick(city);
                  setQuery('');
                  setResults([]);
                  setHint('');
                }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-white/10"
              >
                {city.adm1} · {city.adm2 && city.adm2 !== city.name ? `${city.adm2} · ` : ''}{city.name}
              </button>
            </li>
          ))}
          {hint && results.length === 0 && <li className="px-3 py-2 text-xs text-white/60">{hint}</li>}
        </ul>
      )}
    </div>
  );
}

export default function WeatherDetailModal({ instance, onClose, onChange, onOpenSettings }) {
  const config = useMemo(() => normalizeWeatherConfig(instance.config), [instance.config]);
  const active = config.cities.find((city) => city.locationId === config.activeLocationId) || null;
  const canRequest = Boolean(normalizeQWeatherHost(config.apiHost) && config.apiKey);
  const [reloadToken, setReloadToken] = useState(0);
  const [showCities, setShowCities] = useState(true);
  const [briefs, setBriefs] = useState({});
  const [message, setMessage] = useState('');
  const weather = useWeatherBundle({
    apiHost: config.apiHost,
    apiKey: config.apiKey,
    locationId: config.activeLocationId,
    reloadToken,
  });

  useEffect(() => {
    let animatedContainer = null;
    let animatedLeft = 0;
    let targetLeft = 0;
    let frameId = null;
    let previousTime = 0;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    // 以时间差驱动缓出，连续滚轮输入只更新目标位置，避免逐次跳动。
    const animateScroll = (time) => {
      if (!animatedContainer?.isConnected) {
        frameId = null;
        return;
      }
      targetLeft = Math.max(0, Math.min(targetLeft, animatedContainer.scrollWidth - animatedContainer.clientWidth));
      const distance = targetLeft - animatedLeft;
      const elapsed = time - previousTime;
      previousTime = time;
      if (Math.abs(distance) < 1) {
        animatedContainer.scrollLeft = targetLeft;
        frameId = null;
        return;
      }
      animatedLeft += distance * (1 - Math.exp(-elapsed / 80));
      animatedContainer.scrollLeft = animatedLeft;
      frameId = window.requestAnimationFrame(animateScroll);
    };

    const handleWheel = (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const scrollContainer = target?.closest('[data-hourly-scroll]');
      if (!scrollContainer) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      if (animatedContainer !== scrollContainer || frameId === null) {
        if (frameId !== null) window.cancelAnimationFrame(frameId);
        frameId = null;
        animatedContainer = scrollContainer;
        animatedLeft = scrollContainer.scrollLeft;
        targetLeft = scrollContainer.scrollLeft;
      }
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? scrollContainer.clientWidth : 1;
      const delta = (event.deltaX || event.deltaY) * unit;
      targetLeft = Math.max(0, Math.min(targetLeft + delta, scrollContainer.scrollWidth - scrollContainer.clientWidth));
      if (reducedMotion.matches) {
        if (frameId !== null) window.cancelAnimationFrame(frameId);
        frameId = null;
        scrollContainer.scrollLeft = targetLeft;
      } else if (frameId === null) {
        previousTime = performance.now();
        frameId = window.requestAnimationFrame(animateScroll);
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false, capture: true });
    return () => {
      window.removeEventListener('wheel', handleWheel, true);
      if (frameId !== null) window.cancelAnimationFrame(frameId);
    };
  }, []);
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (!canRequest || config.cities.length === 0) return undefined;
    let cancelled = false;
    config.cities.forEach((city) => {
      fetchCityBrief({ apiHost: config.apiHost, apiKey: config.apiKey, locationId: city.locationId })
        .then((brief) => {
          if (!cancelled) setBriefs((current) => ({ ...current, [city.locationId]: brief }));
        })
        .catch(() => undefined);
    });
    return () => {
      cancelled = true;
    };
  }, [canRequest, config.apiHost, config.apiKey, config.cities, reloadToken]);

  const updateConfig = (next) => onChange?.(normalizeWeatherConfig(next));

  const addCity = (city, mine = false) => {
    const base = mine ? config.cities.map((item) => ({ ...item, isMyLocation: false })) : config.cities;
    const exists = base.some((item) => item.locationId === city.locationId);
    const cities = exists
      ? base.map((item) => (item.locationId === city.locationId ? { ...item, isMyLocation: mine || item.isMyLocation } : item))
      : [...base, { ...city, isMyLocation: mine }];
    updateConfig({ ...config, cities, activeLocationId: city.locationId });
    setMessage('');
  };

  const removeCity = (locationId) => {
    const cities = config.cities.filter((city) => city.locationId !== locationId);
    const activeLocationId = config.activeLocationId === locationId ? (cities[0]?.locationId || '') : config.activeLocationId;
    updateConfig({ ...config, cities, activeLocationId });
  };

  const locate = () => {
    if (!navigator.geolocation) {
      setMessage('当前浏览器不支持定位');
      return;
    }
    navigator.geolocation.getCurrentPosition(async (position) => {
      try {
        const location = `${position.coords.longitude.toFixed(2)},${position.coords.latitude.toFixed(2)}`;
        const list = await lookupCities({ apiHost: config.apiHost, apiKey: config.apiKey, location });
        if (!list[0]) {
          setMessage('没有解析到当前位置');
          return;
        }
        addCity(list[0], true);
      } catch (error) {
        setMessage(error.message || '定位失败');
      }
    }, () => setMessage('定位失败，请允许浏览器获取位置'));
  };

  const today = weather.data?.daily?.[0];
  const hours = (weather.data?.hourly || []).slice(0, 24);
  const days = (weather.data?.daily || []).slice(0, 7);
  const place = [active?.adm1, active?.name].filter(Boolean).join(' · ');

  return createPortal(
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 sm:p-8">
      <div className="absolute inset-0 bg-black/35 backdrop-blur-sm" onClick={() => onClose?.()} />
      <div
        className="relative z-10 flex max-h-[min(820px,88vh)] w-[min(1120px,96vw)] min-h-0 flex-col overflow-hidden rounded-[28px] border border-white/15 text-white shadow-[0_24px_80px_rgba(0,0,0,0.35)] lg:flex-row"
        style={panelStyle}
      >
        <button
          type="button"
          title="关闭天气详情"
          aria-label="关闭天气详情"
          onClick={() => onClose?.()}
          className="absolute right-3 top-3 z-30 rounded-full bg-black/20 p-1.5 text-white/85 transition hover:bg-black/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/10 to-transparent" />

        <div className="no-scrollbar relative min-h-0 min-w-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-4" onWheel={(event) => event.stopPropagation()}>
          {!canRequest && (
            <div className="max-w-md space-y-4 pt-2">
              <h3 className="text-lg">配置和风天气</h3>
              <WeatherSettings config={config} onChange={updateConfig} />
              <button type="button" onClick={() => onOpenSettings?.()} className="text-sm text-white/70 underline">
                在插件设置中打开
              </button>
            </div>
          )}

          {canRequest && !active && (
            <div className="max-w-sm space-y-3 pt-2">
              <h3 className="text-lg">添加城市</h3>
              <CitySearchBox
                apiHost={config.apiHost}
                apiKey={config.apiKey}
                onPick={(city) => addCity(city, false)}
                placeholder="输入城市、乡镇"
              />
              <button type="button" onClick={locate} className="inline-flex items-center gap-1 text-sm text-white/80">
                <LocateFixed className="h-4 w-4" />
                使用我的位置
              </button>
              {message && <p className="text-xs text-red-200">{message}</p>}
            </div>
          )}

          {canRequest && active && (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4 pr-8">
                <div>
                  <div className="text-sm text-white/85">
                    {place} {weather.data?.now?.text || ''}
                  </div>
                  <div className="mt-1 text-xs text-white/50">
                    {weather.data?.now?.obsTime ? `发布于:${formatPublishTime(weather.data.now.obsTime)}` : '正在获取天气'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-40">
                    <CitySearchBox
                      apiHost={config.apiHost}
                      apiKey={config.apiKey}
                      onPick={(city) => addCity(city, false)}
                      placeholder="输入城市、乡镇"
                    />
                  </div>
                  <button type="button" title="我的位置" onClick={locate} className="rounded-full bg-white/10 p-2 hover:bg-white/20">
                    <LocateFixed className="h-4 w-4" />
                  </button>
                  <button type="button" title="天气列表" onClick={() => setShowCities((value) => !value)} className="rounded-full bg-white/10 p-2 hover:bg-white/20">
                    <PanelRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
              {message && <p className="text-xs text-red-200">{message}</p>}

              {weather.status === 'loading' && <div className="h-40 animate-pulse rounded-2xl bg-white/10" />}
              {weather.status === 'error' && (
                <div className="rounded-2xl bg-white/5 px-4 py-6 text-center">
                  <p>{weather.error}</p>
                  <button type="button" onClick={() => setReloadToken((value) => value + 1)} className="mt-3 text-sm underline">
                    重试
                  </button>
                </div>
              )}

              {weather.status === 'ready' && (
                <>
                  <div className="flex flex-wrap items-end justify-between gap-6">
                    <div className="text-6xl font-medium leading-none tracking-tight">{weather.data.now?.temp}°</div>
                    <div className="space-y-2 pb-2 text-sm">
                      {weather.data.air?.aqi && (
                        <div className="flex items-center gap-1.5">
                          <Leaf className="h-4 w-4" />
                          <span>{weather.data.air.category}/{weather.data.air.aqi}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5">
                        <WeatherIcon code={weather.data.now?.icon} className="h-5 w-5" />
                        <span>
                          {weather.data.now?.text} {weather.data.now?.windDir} {formatWindScale(weather.data.now?.windScale)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {weather.data.indexText && (
                    <p className="text-sm leading-6 text-white/80">{weather.data.indexText}</p>
                  )}

                  <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-white/75">
                    <span>温度 {today?.tempMin}°~{today?.tempMax}°</span>
                    <span>湿度 {weather.data.now?.humidity}%</span>
                    <span>气压 {weather.data.now?.pressure}hPa</span>
                    <span>降水 {weather.data.now?.precip}mm</span>
                    <span>日出 {today?.sunrise || '--'}</span>
                    <span>日落 {today?.sunset || '--'}</span>
                  </div>

                  <section className="rounded-2xl border border-white/10 bg-black/10 px-3 py-2.5">
                    <div className="mb-2 flex items-center gap-2 text-sm text-white/80">
                      <Clock className="h-4 w-4" />
                      天气状况
                    </div>
                    <div
                      data-hourly-scroll
                      className="no-scrollbar min-w-0 overflow-x-auto overscroll-x-contain"
                    >
                      <div style={{ minWidth: `${Math.max(hours.length, 1) * 48}px` }}>
                        <div className="grid" style={{ gridTemplateColumns: `repeat(${Math.max(hours.length, 1)}, minmax(0, 1fr))` }}>
                          {hours.map((hour) => (
                            <div key={hour.fxTime} className="flex min-w-0 flex-col items-center gap-1">
                              <span className="text-[11px] text-white/70">{formatHourLabel(hour.fxTime)}</span>
                              <WeatherIcon code={hour.icon} className="h-4 w-4" />
                            </div>
                          ))}
                        </div>
                        <TrendChart
                          height={72}
                          series={[{
                            key: 'temp',
                            label: 'above',
                            values: hours.map((hour) => Number(hour.temp)),
                          }]}
                        />
                      </div>
                    </div>
                  </section>

                  <section className="rounded-2xl border border-white/10 bg-black/10 px-3 py-2.5">
                    <div className="mb-3 text-sm text-white/80">7日天气预报</div>
                    <div className="grid" style={{ gridTemplateColumns: `repeat(${Math.max(days.length, 1)}, minmax(0, 1fr))` }}>
                      {days.map((day, index) => (
                        <div key={day.fxDate} className="flex flex-col items-center gap-1 text-center">
                          <span className="text-sm">{formatDayLabel(day.fxDate, index)}</span>
                          <span className="text-xs text-white/55">{formatMonthDay(day.fxDate)}</span>
                          <div className="flex items-center gap-1 text-xs">
                            <WeatherIcon code={day.iconDay} className="h-4 w-4" />
                            <span>{day.textDay}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <TrendChart
                      height={200}
                      series={[
                        { key: 'max', label: 'above', values: days.map((day) => Number(day.tempMax)) },
                        { key: 'min', label: 'below', values: days.map((day) => Number(day.tempMin)) },
                      ]}
                    />
                    <div className="grid" style={{ gridTemplateColumns: `repeat(${Math.max(days.length, 1)}, minmax(0, 1fr))` }}>
                      {days.map((day) => (
                        <div key={`${day.fxDate}-wind`} className="text-center text-xs text-white/65">
                          {formatWindScale(day.windScaleDay)}
                        </div>
                      ))}
                    </div>
                  </section>
                </>
              )}
            </>
          )}
        </div>

        {showCities && canRequest && (
          <aside className="relative flex w-full min-h-0 shrink-0 flex-col overflow-hidden border-t border-white/10 bg-black/15 lg:w-[280px] lg:border-l lg:border-t-0">
            <div className="flex items-center px-4 py-3">
              <h3 className="text-sm">天气列表</h3>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-2 px-4 pb-3" onWheel={(event) => event.stopPropagation()}>
              <CitySearchBox
                apiHost={config.apiHost}
                apiKey={config.apiKey}
                onPick={(city) => addCity(city, false)}
                placeholder="输入城市、乡镇"
              />
              <div className="no-scrollbar min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain">
                {config.cities.map((city) => {
                  const brief = briefs[city.locationId];
                  const selected = city.locationId === config.activeLocationId;
                  return (
                    <div
                      key={city.locationId}
                      className={`group relative rounded-2xl px-3 py-2 transition-colors ${selected ? 'bg-white/15' : 'bg-white/5 hover:bg-white/10'}`}
                    >
                      <button
                        type="button"
                        title={`移除${city.name}`}
                        aria-label={`移除${city.name}`}
                        onClick={() => removeCity(city.locationId)}
                        className="absolute right-2 top-2 z-10 rounded-full bg-black/25 p-1 text-white/70 opacity-0 transition hover:bg-black/50 hover:text-white group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => updateConfig({ ...config, activeLocationId: city.locationId })}
                        className="flex w-full items-start justify-between gap-3 pr-6 text-left"
                      >
                        <div>
                          <div className="text-sm">
                            {city.isMyLocation ? `我的位置 · ${city.name}` : city.name}
                          </div>
                          <div className="mt-1 flex items-center gap-1 text-xs text-white/75">
                            <WeatherIcon code={brief?.icon} className="h-4 w-4" />
                            <span>{brief?.text || '获取中'}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl leading-tight">{brief?.temp ? `${brief.temp}°` : '--'}</div>
                          <div className="mt-0.5 text-[10px] text-white/60">
                            {brief?.tempMax ? `最高${brief.tempMax}° 最低${brief.tempMin}°` : ''}
                          </div>
                        </div>
                      </button>
                    </div>
                  );
                })}
                {config.cities.length === 0 && (
                  <p className="px-1 text-xs text-white/50">搜索城市，或使用定位添加我的位置</p>
                )}
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>,
    document.body,
  );
}
