/**
 * 天气组件自己的设置项。通用设置页只负责把它渲染出来。
 */
import { clearWeatherCache, normalizeQWeatherHost, normalizeWeatherConfig } from '../../services/qweather';

export default function WeatherSettings({ config, onChange }) {
  const current = normalizeWeatherConfig(config);
  const hostInvalid = current.apiHost.trim() !== '' && !normalizeQWeatherHost(current.apiHost);

  const update = (patch) => {
    if (Object.prototype.hasOwnProperty.call(patch, 'apiHost') || Object.prototype.hasOwnProperty.call(patch, 'apiKey')) {
      clearWeatherCache();
    }
    onChange({ ...current, ...patch });
  };

  return (
    <div className="space-y-3">
      <label className="block space-y-1.5">
        <span className="text-xs text-white/70">API Host</span>
        <input
          value={current.apiHost}
          onChange={(event) => update({ apiHost: event.target.value })}
          placeholder="xxxxx.qweatherapi.com"
          className="w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-white/40"
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-xs text-white/70">API Key</span>
        <input
          type="password"
          value={current.apiKey}
          onChange={(event) => update({ apiKey: event.target.value })}
          placeholder="和风天气项目的 Key"
          autoComplete="off"
          className="w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-white/40"
        />
      </label>
      {hostInvalid && (
        <p className="text-xs text-red-300">Host 需要是分配的 *.qweatherapi.com 域名</p>
      )}
      <p className="text-xs leading-5 text-white/45">
        在
        {' '}
        <a
          href="https://console.qweather.com"
          target="_blank"
          rel="noreferrer"
          className="text-white/70 underline"
        >
          和风天气控制台
        </a>
        {' '}
        创建项目后填写。Key 只保存在本机，不会同步或导出。城市在天气弹框里添加。
      </p>
    </div>
  );
}
