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
    fetchWeatherBundle({ apiHost, apiKey, locationId })
      .then((data) => {
        if (!cancelled) setState({ status: 'ready', locationId, data, error: '' });
      })
      .catch((error) => {
        if (!cancelled) {
          setState({ status: 'error', locationId, data: null, error: error.message || '天气获取失败' });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [apiHost, apiKey, locationId, ready, reloadToken]);

  if (!ready) return { status: 'unconfigured', data: null, error: '' };
  if (state.locationId !== locationId || state.status === 'idle') {
    return { status: 'loading', data: null, error: '' };
  }
  return state;
}
