/**
 * 小组件实例的本地存取与增删排序。
 * 实例只保存类型、开关、顺序和各自的 config，具体界面由注册表决定。
 */
import { getWidgetDefinition } from './registry';

const STORAGE_KEY = 'widgets';

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizePlacement(value) {
  if (!isPlainObject(value)) return null;
  const col = Number(value.col);
  const row = Number(value.row);
  const page = Number(value.page);
  if (!Number.isInteger(col) || !Number.isInteger(row) || col < 0 || row < 0) return null;
  const placement = {
    page: Number.isInteger(page) && page >= 0 ? page : 0,
    col,
    row,
  };
  if (typeof value.categoryId === 'string' && value.categoryId) {
    placement.categoryId = value.categoryId;
  }
  return placement;
}

/** 过滤坏数据并按顺序重排，避免某个组件写坏整份列表 */
export function normalizeWidgets(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item.type === 'string' && typeof item.instanceId === 'string')
    .map((item, index) => ({
      instanceId: item.instanceId,
      type: item.type,
      enabled: item.enabled !== false,
      order: Number.isFinite(Number(item.order)) ? Number(item.order) : index,
      placement: normalizePlacement(item.placement),
      config: isPlainObject(item.config) ? item.config : {},
    }))
    .sort((left, right) => left.order - right.order)
    .map((item, index) => ({ ...item, order: index }));
}

export function loadWidgets() {
  try {
    return normalizeWidgets(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'));
  } catch {
    return [];
  }
}

export function saveWidgets(widgets) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeWidgets(widgets)));
}

export function addWidget(widgets, type) {
  const definition = getWidgetDefinition(type);
  if (!definition) return widgets;
  if (!definition.allowMultiple && widgets.some((item) => item.type === type)) return widgets;
  return normalizeWidgets([
    ...widgets,
    {
      instanceId: definition.allowMultiple ? `${type}-${Date.now()}` : type,
      type,
      enabled: true,
      order: widgets.length,
      placement: null,
      config: definition.defaultConfig(),
    },
  ]);
}

export function removeWidget(widgets, instanceId) {
  const target = widgets.find((item) => item.instanceId === instanceId);
  if (target) getWidgetDefinition(target.type)?.onRemove?.();
  return normalizeWidgets(widgets.filter((item) => item.instanceId !== instanceId));
}

export function setWidgetPlacement(widgets, instanceId, placement) {
  return widgets.map((item) => (item.instanceId === instanceId ? { ...item, placement } : item));
}

export function updateWidgetConfig(widgets, instanceId, config) {
  return widgets.map((item) => (item.instanceId === instanceId ? { ...item, config } : item));
}

export function setWidgetEnabled(widgets, instanceId, enabled) {
  return widgets.map((item) => (item.instanceId === instanceId ? { ...item, enabled } : item));
}

export function moveWidget(widgets, instanceId, direction) {
  const ordered = normalizeWidgets(widgets);
  const index = ordered.findIndex((item) => item.instanceId === instanceId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= ordered.length) return ordered;
  const next = [...ordered];
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item);
  return normalizeWidgets(next);
}
