/**
 * 设置里的插件页。只遍历注册表和已安装实例，不写死某个组件的字段。
 */
import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { WIDGET_REGISTRY, getWidgetDefinition } from '../widgets/registry';
import { addWidget, removeWidget, setWidgetEnabled, updateWidgetConfig } from '../widgets/storage';

export default function WidgetSettingsPanel({ widgets, onChange }) {
  const [expandedId, setExpandedId] = useState(null);
  const installedTypes = new Set(widgets.map((item) => item.type));
  const available = WIDGET_REGISTRY.filter((item) => item.allowMultiple || !installedTypes.has(item.type));

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h3 className="text-sm font-medium text-white">可添加</h3>
        {available.length === 0 && (
          <p className="text-xs text-white/45">暂无可添加的小组件</p>
        )}
        {available.map((item) => (
          <div key={item.type} className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm text-white">{item.name}</div>
                <p className="mt-1 text-xs leading-5 text-white/50">{item.description}</p>
              </div>
              <button
                type="button"
                onClick={() => onChange(addWidget(widgets, item.type))}
                className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-xs text-white hover:bg-white/25"
              >
                <Plus className="h-3.5 w-3.5" />
                添加
              </button>
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-medium text-white">已添加</h3>
        {widgets.length === 0 && (
          <p className="text-xs text-white/45">还没有小组件</p>
        )}
        {widgets.map((instance) => {
          const definition = getWidgetDefinition(instance.type);
          const SettingsForm = definition?.Settings;
          const expanded = expandedId === instance.instanceId;
          return (
            <div key={instance.instanceId} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : instance.instanceId)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="text-sm text-white">{definition?.name || `未注册组件（${instance.type}）`}</div>
                  <div className="mt-1 text-xs text-white/45">{definition ? '点击展开设置' : '这个组件已不在当前版本中'}</div>
                </button>
                <button
                  type="button"
                  title={instance.enabled ? '停用' : '启用'}
                  onClick={() => onChange(setWidgetEnabled(widgets, instance.instanceId, !instance.enabled))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${instance.enabled ? 'bg-blue-600' : 'bg-white/20'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${instance.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
              <div className="mt-3 flex items-center gap-1">
                <button
                  type="button"
                  title="删除"
                  onClick={() => {
                    if (expandedId === instance.instanceId) setExpandedId(null);
                    onChange(removeWidget(widgets, instance.instanceId));
                  }}
                  className="rounded-lg p-1.5 text-white/70 hover:bg-white/10"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {expanded && SettingsForm && (
                <div className="mt-4 border-t border-white/10 pt-4">
                  <SettingsForm
                    config={instance.config}
                    onChange={(config) => onChange(updateWidgetConfig(widgets, instance.instanceId, config))}
                  />
                </div>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}
