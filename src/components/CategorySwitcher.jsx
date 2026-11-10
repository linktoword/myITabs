/**
 * 书签分类的底部状态：名称、轮播圆点、新建和删除。
 * 圆点上的胶囊按滑动进度连续移动。
 */
import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

const DOT = 6;
const GAP = 10;
const PILL = 18;

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

  const boundedProgress = Math.min(categories.length - 1, Math.max(0, progress));
  const pillX = boundedProgress * (DOT + GAP) + (DOT + GAP - PILL) / 2;

  return (
    <div className="group flex shrink-0 flex-col items-center gap-1 pb-2 pt-1">
      <div className="relative flex h-7 max-w-full items-center">
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
            title="重命名书签页"
            className="max-w-48 truncate rounded-sm text-xs font-medium text-white/80 drop-shadow transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/70"
          >
            {titleCategory.title}
          </button>
        )}
        {categories.length > 1 && (
          <button
            type="button"
            aria-label={`删除${titleCategory.title}`}
            title="删除书签页"
            onClick={() => onDelete?.(titleCategory)}
            className="absolute left-full ml-1 rounded-full p-1 text-white/50 opacity-0 transition hover:bg-white/10 hover:text-white focus:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>

      <div className="liquid-glass-fixed flex max-w-full items-center gap-2 rounded-full px-2 py-1">
        <button
          type="button"
          aria-label="在当前页左侧新建书签页"
          title="在当前页左侧新建书签页"
          onClick={() => onAdd?.('left', shown.id)}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white/50 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white/70 active:scale-90"
        >
          <Plus className="h-3 w-3" strokeWidth={1.75} />
        </button>
        <div className="no-scrollbar min-w-0 overflow-x-auto px-1">
          <div className="relative flex w-max items-center" aria-label="书签页">
            {categories.map((category, categoryIndex) => (
              <button
                key={category.id}
                type="button"
                aria-label={category.title}
                aria-current={categoryIndex === nearestIndex ? 'true' : undefined}
                title={category.title}
                onClick={() => onSelect?.(categoryIndex)}
                className="group/dot flex h-6 shrink-0 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-white/70"
                style={{ width: DOT + GAP }}
              >
                <span
                  className="rounded-full bg-white/30 transition-colors group-hover/dot:bg-white/65"
                  style={{ width: DOT, height: DOT }}
                />
              </button>
            ))}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 -mt-0.75 h-1.5 rounded-full bg-white/90 shadow-sm shadow-white/20"
              style={{ width: PILL, transform: `translateX(${pillX}px)` }}
            />
          </div>
        </div>
        <button
          type="button"
          aria-label="在当前页右侧新建书签页"
          title="在当前页右侧新建书签页"
          onClick={() => onAdd?.('right', shown.id)}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white/50 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white/70 active:scale-90"
        >
          <Plus className="h-3 w-3" strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
};

export default CategorySwitcher;
