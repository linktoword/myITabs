/**
 * 天气小组件的紧凑卡片。点击后由宿主打开详情。
 */
import { LocateFixed, X } from 'lucide-react';
import WeatherIcon from './WeatherIcon';
import { useWeatherBundle } from './useWeatherBundle';
import { normalizeWeatherConfig } from '../../services/qweather';

const cardStyle = {
  background: 'linear-gradient(35deg, #154280 30%, #335693, #a8b3d2)',
};

export default function WeatherCard({ instance, onOpen, onRemove }) {
  const config = normalizeWeatherConfig(instance.config);
  const active = config.cities.find((city) => city.locationId === config.activeLocationId) || null;
  const weather = useWeatherBundle({
    apiHost: config.apiHost,
    apiKey: config.apiKey,
    locationId: config.activeLocationId,
  });
  const today = weather.data?.daily?.[0];
  const range = today?.tempMin && today?.tempMax ? `${today.tempMin}° ~ ${today.tempMax}°` : '';

  return (
    <div className="flex h-full w-full flex-col gap-[6px]">
      <div className="group relative min-h-0 flex-1">
        <button
          type="button"
          title="移除天气组件"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => onRemove?.()}
          className="absolute right-2 top-2 z-10 rounded-full bg-black/20 p-1 text-white/80 opacity-0 transition hover:bg-black/40 group-hover:opacity-100 focus:opacity-100"
        >
          <X className="h-3.5 w-3.5" />
        </button>
        <div
          role="button"
          tabIndex={0}
          onClick={() => onOpen?.()}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onOpen?.();
            }
          }}
          className="flex h-full w-full cursor-pointer items-center overflow-hidden rounded-[18px] border border-white/20 px-3 text-left text-white shadow-[0_8px_20px_rgba(0,0,0,0.18)] backdrop-blur-sm"
          style={cardStyle}
        >
          {weather.status === 'unconfigured' && (
            <div className="flex w-full items-center justify-between gap-4">
              <p className="text-base">天气</p>
              <p className="text-sm text-white/70">点击配置</p>
            </div>
          )}

          {weather.status === 'loading' && !weather.data && (
            <div className="flex w-full animate-pulse items-center justify-between">
              <div className="space-y-3">
                <div className="h-3 w-12 rounded bg-white/20" />
                <div className="h-8 w-16 rounded bg-white/20" />
              </div>
              <div className="space-y-3">
                <div className="ml-auto h-3 w-14 rounded bg-white/20" />
                <div className="h-3 w-20 rounded bg-white/20" />
              </div>
            </div>
          )}

          {weather.status === 'error' && (
            <div className="flex w-full items-center justify-between gap-4">
              <p className="truncate text-base">{active?.name || '天气'}</p>
              <p className="shrink-0 text-sm text-white/70">{weather.error}</p>
            </div>
          )}

          {(weather.status === 'ready' || (weather.status === 'loading' && weather.data)) && (
            <div className="flex w-full items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1 text-xs leading-none text-white/95">
                  <span className="truncate">{active?.name || '天气'}</span>
                  <LocateFixed className="h-3 w-3 shrink-0" />
                </div>
                <div className="mt-1 text-[28px] font-medium leading-none tracking-tight">{weather.data.now?.temp}°</div>
              </div>
              <div className="min-w-0 shrink-0 text-right">
                <div className="flex items-center justify-end gap-1 text-xs leading-none">
                  <span className="max-w-16 truncate">{weather.data.now?.text}</span>
                  <WeatherIcon code={weather.data.now?.icon} className="h-4 w-4" />
                </div>
                {range && <div className="mt-2 text-xs leading-none text-white/90">{range}</div>}
              </div>
            </div>
          )}
        </div>
      </div>
      <span className="truncate select-none px-1 text-center text-[12px] font-medium leading-4 text-white/90 drop-shadow-md">天气</span>
    </div>
  );
}
