/**
 * 书签分类的存取、迁移和校验。
 * 旧数据没有分类时，全部归入「常用」。
 */
import { loadWidgets, saveWidgets } from '../widgets/storage';

export const CATEGORIES_KEY = 'bookmark_categories';
export const ACTIVE_CATEGORY_KEY = 'active_category_id';
export const DEFAULT_CATEGORY_ID = 'default';
export const DEFAULT_CATEGORY_TITLE = '常用';

const SHORTCUTS_KEY = 'shortcuts';

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function createCategoryId() {
  return `cat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createDefaultCategory() {
  return { id: DEFAULT_CATEGORY_ID, title: DEFAULT_CATEGORY_TITLE };
}

/** 新建一页分类。空名称用「新分类」 */
export function createCategory(title) {
  const trimmed = typeof title === 'string' ? title.trim() : '';
  return { id: createCategoryId(), title: trimmed || '新分类' };
}

export function normalizeCategories(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const categories = [];
  value.forEach((item) => {
    if (!isPlainObject(item) || typeof item.id !== 'string' || !item.id || seen.has(item.id)) return;
    seen.add(item.id);
    const title = typeof item.title === 'string' ? item.title.trim() : '';
    categories.push({ id: item.id, title: title || '未命名' });
  });
  return categories;
}

/**
 * 把分类、书签和小组件对齐。
 * 缺少分类时生成「常用」；对不上的书签和小组件也归进去。
 * 小组件旧的 page 只表示溢出页，并入分类后不再跨页。
 */
export function normalizeBookmarkState({ categories, shortcuts, widgets }) {
  let nextCategories = normalizeCategories(categories);
  if (nextCategories.length === 0) nextCategories = [createDefaultCategory()];
  const ids = new Set(nextCategories.map((item) => item.id));
  const fallbackId = nextCategories[0].id;

  const nextShortcuts = (Array.isArray(shortcuts) ? shortcuts : [])
    .filter(isPlainObject)
    .map((shortcut) => {
      const categoryId = ids.has(shortcut.categoryId) ? shortcut.categoryId : fallbackId;
      if (shortcut.categoryId === categoryId) return shortcut;
      return { ...shortcut, categoryId };
    });

  const nextWidgets = (Array.isArray(widgets) ? widgets : []).map((widget) => {
    if (!isPlainObject(widget) || !isPlainObject(widget.placement)) return widget;
    const categoryId = ids.has(widget.placement.categoryId) ? widget.placement.categoryId : fallbackId;
    if (widget.placement.categoryId === categoryId && (widget.placement.page || 0) === 0) return widget;
    return {
      ...widget,
      placement: {
        ...widget.placement,
        page: 0,
        categoryId,
      },
    };
  });

  return {
    categories: nextCategories,
    shortcuts: nextShortcuts,
    widgets: nextWidgets,
  };
}

export function saveCategories(categories) {
  const normalized = normalizeCategories(categories);
  localStorage.setItem(
    CATEGORIES_KEY,
    JSON.stringify(normalized.length > 0 ? normalized : [createDefaultCategory()]),
  );
}

export function loadActiveCategoryId() {
  return localStorage.getItem(ACTIVE_CATEGORY_KEY) || '';
}

export function saveActiveCategoryId(id) {
  if (id) localStorage.setItem(ACTIVE_CATEGORY_KEY, id);
}

export function resolveActiveCategoryId(categories, preferredId) {
  if (categories.some((item) => item.id === preferredId)) return preferredId;
  return categories[0]?.id || '';
}

/** 云端优先，本地多出来的分类补在后面 */
export function mergeCategoryLists(localCategories, cloudCategories) {
  const merged = new Map();
  normalizeCategories(cloudCategories).forEach((item) => merged.set(item.id, item));
  normalizeCategories(localCategories).forEach((item) => {
    if (!merged.has(item.id)) merged.set(item.id, item);
  });
  return Array.from(merged.values());
}

export function categoryHasContent(shortcuts, widgets, categoryId) {
  const hasShortcut = (Array.isArray(shortcuts) ? shortcuts : [])
    .some((item) => item?.categoryId === categoryId);
  const hasWidget = (Array.isArray(widgets) ? widgets : [])
    .some((item) => item?.placement?.categoryId === categoryId);
  return hasShortcut || hasWidget;
}

/** 删除分类前把里面的书签和小组件挪到相邻分类 */
export function moveCategoryContents(shortcuts, widgets, fromId, toId) {
  return {
    shortcuts: (Array.isArray(shortcuts) ? shortcuts : []).map((item) => (
      item?.categoryId === fromId ? { ...item, categoryId: toId } : item
    )),
    widgets: (Array.isArray(widgets) ? widgets : []).map((item) => (
      item?.placement?.categoryId === fromId
        ? { ...item, placement: { ...item.placement, categoryId: toId, page: 0 } }
        : item
    )),
  };
}

/**
 * 只交换同一分类里的书签顺序。
 * 其它分类夹在中间的项保持原位，避免把它们的相对顺序打乱。
 */
export function reorderWithinCategory(shortcuts, categoryId, activeId, overId) {
  const source = Array.isArray(shortcuts) ? shortcuts : [];
  const positions = [];
  source.forEach((item, index) => {
    if (item?.categoryId === categoryId) positions.push(index);
  });
  const items = positions.map((index) => source[index]);
  const from = items.findIndex((item) => item.id === activeId);
  const to = items.findIndex((item) => item.id === overId);
  if (from < 0 || to < 0 || from === to) return source;
  const nextItems = items.slice();
  const [moved] = nextItems.splice(from, 1);
  nextItems.splice(to, 0, moved);
  const next = source.slice();
  positions.forEach((index, offset) => {
    next[index] = nextItems[offset];
  });
  return next;
}

/** 读取本地书签并补上分类。第一次迁移会写回本地 */
export function loadStoredBookmarkState() {
  const storedShortcuts = readJson(SHORTCUTS_KEY, null);
  const shortcuts = Array.isArray(storedShortcuts)
    ? storedShortcuts
    : [{ id: 1, title: 'Google', url: 'https://google.com' }];
  const storedCategories = readJson(CATEGORIES_KEY, null);
  const widgets = loadWidgets();
  const normalized = normalizeBookmarkState({
    categories: storedCategories,
    shortcuts,
    widgets,
  });

  if (!Array.isArray(storedShortcuts) || JSON.stringify(normalized.shortcuts) !== JSON.stringify(shortcuts)) {
    localStorage.setItem(SHORTCUTS_KEY, JSON.stringify(normalized.shortcuts));
  }
  if (JSON.stringify(normalizeCategories(storedCategories)) !== JSON.stringify(normalized.categories)) {
    saveCategories(normalized.categories);
  }
  if (JSON.stringify(normalized.widgets) !== JSON.stringify(widgets)) {
    saveWidgets(normalized.widgets);
  }
  return normalized;
}
