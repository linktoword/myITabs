/**
 * 书签分类的底部状态：名称、轮播圆点、新建和删除。
 * 圆点上的胶囊按滑动进度连续移动。
 */
import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

const DOT = 8;
const GAP = 8;
const PILL = 24;

const CategorySwitcher = ({
  categories,
  progress,
  renameRequestId,
  onSelect,
  onRename,
  onEditEnd,
  onAdd,
  onDelete,
}) => {
  const [manual, setManual] = useState(null);
  const nearestIndex = categories.length === 0
    ? 0
    : Math.min(categories.length - 1, Math.max(0, Math.round(progress)));
  const requested = categories.find((item) => item.id === renameRequestId) || null;
  const shown = categories[nearestIndex];
  const editing = requested && (!manual || manual.id !== requested.id)
    ? { id: requested.id, draft: requested.title }
    : manual;

  const commit = () => {
    if (!editing) return;
    const title = editing.draft.trim();
    const current = categories.find((item) => item.id === editing.id);
    if (title && title !== current?.title) onRename?.(editing.id, title);
    else onEditEnd?.();
    setManual(null);
  };

  const cancel = () => {
    setManual(null);
    onEditEnd?.();
  };

  const startEdit = () => {
    if (!shown) return;
    setManual({ id: shown.id, draft: shown.title });
  };

  const titleCategory = (editing && categories.find((item) => item.id === editing.id)) || shown;
  if (!titleCategory) return null;

  const pillX = progress * (DOT + GAP) - (PILL - DOT) / 2;

  return (
    <div className="group flex shrink-0 flex-col items-center gap-2 pb-2 pt-1">
      <div className="flex h-8 items-center gap-1">
        {editing ? (
          <input
            key={editing.id}
            autoFocus
            value={editing.draft}
            aria-label="分类名称"
            onChange={(event) => setManual({ id: editing.id, draft: event.target.value })}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commit();
              } else if (event.key === 'Escape') {
                event.preventDefault();
                cancel();
              }
            }}
            className="w-36 border-b border-white/50 bg-transparent text-center text-sm font-medium text-white outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={startEdit}
            className="max-w-48 truncate text-sm font-medium text-white/90 drop-shadow"
          >
            {titleCategory.title}
          </button>
        )}
        {categories.length > 1 && (
          <button
            type="button"
            aria-label={`删除${titleCategory.title}`}
            onClick={() => onDelete?.(titleCategory)}
            className="rounded-full p-1 text-white/70 opacity-0 transition hover:bg-white/10 hover:text-white focus:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="liquid-glass-fixed flex items-center gap-3 rounded-full px-3 py-2">
        <div className="relative flex items-center" style={{ gap: GAP }} aria-label="分类页">
          {categories.map((category, categoryIndex) => (
            <button
              key={category.id}
              type="button"
              aria-label={category.title}
              aria-current={categoryIndex === nearestIndex ? 'true' : undefined}
              onClick={() => onSelect?.(categoryIndex)}
              className="h-2 w-2 rounded-full bg-white/40 transition-colors hover:bg-white/70"
            />
          ))}
          <span
            className="pointer-events-none absolute top-0 h-2 rounded-full bg-white shadow-lg shadow-white/25"
            style={{ width: PILL, transform: `translateX(${pillX}px)` }}
          />
        </div>
        <button
          type="button"
          aria-label="新建分类"
          onClick={onAdd}
          className="liquid-glass-mini flex h-6 w-6 items-center justify-center rounded-full text-white transition active:scale-95"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};

export default CategorySwitcher;
