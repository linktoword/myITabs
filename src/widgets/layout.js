/**
 * 把小组件放进图标网格的空位。
 * 图标按顺序占 1 格，小组件占注册表里的跨度（天气是 2 列 1 行）。
 * 已保存的位置优先；只有越界或和另一个小组件重叠时才重新找空位。
 */
import { getWidgetDefinition } from './registry';

const keyOf = (col, row) => `${col},${row}`;

export function samePlacement(left, right) {
  if (!left || !right) return false;
  return (left.page || 0) === (right.page || 0)
    && left.col === right.col
    && left.row === right.row
    && (left.categoryId || '') === (right.categoryId || '');
}

function spanOf(definition, cols) {
  return {
    cols: Math.max(1, Math.min(definition?.span?.cols || 1, cols)),
    rows: Math.max(1, definition?.span?.rows || 1),
  };
}

function fits(placement, span, cols, rows, singlePage = false) {
  if (!placement) return false;
  const page = placement.page || 0;
  if (page < 0 || placement.col < 0 || placement.row < 0) return false;
  if (placement.col + span.cols > cols) return false;
  // 分类页不换页，行数可以超出设置值继续往下排
  if (singlePage) return page === 0;
  return placement.row < rows;
}

function overlaps(occupied, col, row, span) {
  if (!occupied) return false;
  for (let rowOffset = 0; rowOffset < span.rows; rowOffset += 1) {
    for (let colOffset = 0; colOffset < span.cols; colOffset += 1) {
      if (occupied.has(keyOf(col + colOffset, row + rowOffset))) return true;
    }
  }
  return false;
}

function occupy(occupied, col, row, span) {
  for (let rowOffset = 0; rowOffset < span.rows; rowOffset += 1) {
    for (let colOffset = 0; colOffset < span.cols; colOffset += 1) {
      occupied.add(keyOf(col + colOffset, row + rowOffset));
    }
  }
}

function pageSet(pages, page) {
  if (!pages[page]) pages[page] = new Set();
  return pages[page];
}

function findFreeSlotOnPage(occupied, cols, span) {
  for (let row = 0; row < 80; row += 1) {
    for (let col = 0; col <= cols - span.cols; col += 1) {
      if (!overlaps(occupied, col, row, span)) return { page: 0, col, row };
    }
  }
  return { page: 0, col: 0, row: 0 };
}

/** 起始行只要落在这一页里即可，高度可以向下多占，避免 2 行页面放不下 4×2 */
export function findFreeSlot(occupiedPages, cols, rows, span, preferredPage = 0, singlePage = false) {
  if (singlePage) return findFreeSlotOnPage(occupiedPages[0], cols, span);
  const pageCount = Math.max(occupiedPages.length, preferredPage + 1);
  for (let page = preferredPage; page < pageCount; page += 1) {
    const occupied = occupiedPages[page];
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col <= cols - span.cols; col += 1) {
        if (!overlaps(occupied, col, row, span)) return { page, col, row };
      }
    }
  }
  const nextPage = Math.max(occupiedPages.length, 1);
  return { page: nextPage, col: 0, row: 0 };
}

/** 拖拽落下后，挑离目标最近且不压住其他小组件的位置 */
export function findNearestSlot(occupied, cols, rows, span, preferred, singlePage = false) {
  // 分类页允许拖到设定行数之下，用来把这一页拉高
  const maxRow = singlePage
    ? Math.max(0, rows - 1, preferred?.row || 0)
    : Math.max(0, rows - 1);
  const maxCol = Math.max(0, cols - span.cols);
  const preferredCol = Math.max(0, Math.min(maxCol, preferred.col));
  const preferredRow = Math.max(0, Math.min(maxRow, preferred.row));
  const candidate = { page: preferred.page || 0, col: preferredCol, row: preferredRow };
  if (!overlaps(occupied, candidate.col, candidate.row, span)) return candidate;

  let best = null;
  let bestDistance = Infinity;
  for (let row = 0; row <= maxRow; row += 1) {
    for (let col = 0; col <= maxCol; col += 1) {
      if (overlaps(occupied, col, row, span)) continue;
      const distance = Math.abs(col - preferredCol) + Math.abs(row - preferredRow);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = { page: preferred.page || 0, col, row };
      }
    }
  }
  return best || candidate;
}

function packShortcuts(shortcuts, cols, rows, blockedPages, singlePage = false) {
  const placed = [];
  let page = 0;
  let col = 0;
  let row = 0;
  const advance = () => {
    col += 1;
    if (col >= cols) {
      col = 0;
      row += 1;
    }
    if (!singlePage && row >= rows) {
      row = 0;
      page += 1;
    }
  };

  shortcuts.forEach((shortcut) => {
    while (blockedPages[page]?.has(keyOf(col, row))) advance();
    placed.push({ shortcut, page, col, row });
    advance();
  });
  return placed;
}

function stampPlacement(placement, singlePage, categoryId) {
  if (!placement) return placement;
  const next = {
    ...placement,
    page: singlePage ? 0 : (placement.page || 0),
  };
  if (categoryId) next.categoryId = categoryId;
  return next;
}

export function arrangeGrid({ shortcuts, widgets, cols, rows, singlePage = false, categoryId = '' }) {
  const safeCols = Math.max(1, cols);
  const safeRows = Math.max(1, rows);
  const iconPages = [];
  packShortcuts(shortcuts, safeCols, safeRows, iconPages, singlePage).forEach((item) => {
    pageSet(iconPages, item.page).add(keyOf(item.col, item.row));
  });

  const placedWidgets = [];
  const widgetPages = [];
  widgets.filter((widget) => widget.enabled).forEach((widget) => {
    const definition = getWidgetDefinition(widget.type);
    if (!definition?.Card) return;
    const span = spanOf(definition, safeCols);
    const iconPageCount = Math.max(iconPages.length, 1);
    const storedPage = widget.placement?.page || 0;
    let placement = fits(widget.placement, span, safeCols, safeRows, singlePage)
      && (singlePage || storedPage < iconPageCount)
      ? {
        page: singlePage ? 0 : storedPage,
        col: widget.placement.col,
        row: widget.placement.row,
      } : null;
    if (placement && overlaps(widgetPages[placement.page], placement.col, placement.row, span)) {
      placement = null;
    }
    if (!placement) {
      const blocked = iconPages.map((page) => new Set(page));
      placedWidgets.forEach((item) => {
        occupy(pageSet(blocked, item.placement.page), item.placement.col, item.placement.row, item.span);
      });
      placement = findFreeSlot(blocked, safeCols, safeRows, span, 0, singlePage);
    }
    placement = stampPlacement(placement, singlePage, categoryId);
    occupy(pageSet(widgetPages, placement.page), placement.col, placement.row, span);
    placedWidgets.push({ widget, definition, span, placement });
  });

  const placedShortcuts = packShortcuts(shortcuts, safeCols, safeRows, widgetPages, singlePage);
  const lastPage = singlePage ? 0 : Math.max(
    0,
    ...placedWidgets.map((item) => item.placement.page),
    ...placedShortcuts.map((item) => item.page),
  );
  return {
    placedWidgets,
    placedShortcuts,
    pageCount: lastPage + 1,
    categoryId,
  };
}
