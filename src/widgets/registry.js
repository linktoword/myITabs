/**
 * 内置小组件注册表。
 * 新增组件时：在 src/widgets/ 下实现卡片、可选详情和设置表单，再向这里追加一项。
 * App 和设置页只遍历本表，不为单个组件写分支。
 */
import WeatherCard from './weather/WeatherCard';
import WeatherDetailModal from './weather/WeatherDetailModal';
import WeatherSettings from './weather/WeatherSettings';
import { clearWeatherCache } from '../services/qweather';

export const WIDGET_REGISTRY = [
  {
    type: 'weather',
    name: '天气',
    description: '和风天气，显示实况、逐小时和 7 日预报',
    allowMultiple: false,
    span: { cols: 2, rows: 1 },
    defaultConfig: () => ({
      apiHost: '',
      apiKey: '',
      activeLocationId: '',
      cities: [],
    }),
    Card: WeatherCard,
    Detail: WeatherDetailModal,
    Settings: WeatherSettings,
    onRemove: () => clearWeatherCache(),
  },
];

export function getWidgetDefinition(type) {
  return WIDGET_REGISTRY.find((item) => item.type === type) || null;
}
