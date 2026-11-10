/**
 * 拉取某个城市的完整天气，并在参数变化时重新请求。
 */
import { useEffect, useState } from 'react';
import { fetchWeatherBundle, normalizeQWeatherHost } from '../../services/qweather';

export function useWeatherBundle({ apiHost, apiKey, locationId, reloadToken = 0 }) {
  const ready = Boolean(normalizeQWeatherHost(apiHost) && apiKey && locationId);
  const [state, setState] = useState({ status: 'idle', locationId: '', data: null, error: '' });

  useEffect(() => {
    if (!ready) return undefined;
    let cancelled = false;
    // hook 挂载或参数变化就是天气插件加载、打开弹框和切换城市的刷新时机。
    fetchWeatherBundle({ apiHost, apiKey, locationId, force: true })
      .then((data) => {
        if (!cancelled) setState({ status: 'ready', locationId, data, error: '' });
      })
      .catch((error) => {
        if (!cancelled) {
          // 请求失败时保留旧数据，避免刷新期间详情弹框内容塌缩。
          setState((current) => ({
            status: 'error',
            locationId,
            data: current.data,
            error: error.message || '天气获取失败',
          }));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [apiHost, apiKey, locationId, ready, reloadToken]);

  if (!ready) return { status: 'unconfigured', data: null, error: '' };
  if (state.locationId !== locationId || state.status === 'idle') {
    // 城市切换时继续展示上一份数据，避免弹框先缩小再恢复。
    return { status: 'loading', data: state.data, error: '' };
  }
  return state;
}
