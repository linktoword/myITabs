/**
 * 小组件详情弹框。卡片本身放在图标网格里。
 */
import { getWidgetDefinition } from '../widgets/registry';
import { updateWidgetConfig } from '../widgets/storage';

export default function WidgetHost({ widgets, onChange, onOpenSettings, openId, onOpenChange }) {
  const opened = widgets.find((item) => item.instanceId === openId) || null;
  const Detail = opened ? getWidgetDefinition(opened.type)?.Detail : null;
  if (!opened || !Detail) return null;

  return (
    <Detail
      instance={opened}
      onClose={() => onOpenChange?.(null)}
      onChange={(config) => onChange(updateWidgetConfig(widgets, opened.instanceId, config))}
      onOpenSettings={onOpenSettings}
    />
  );
}
