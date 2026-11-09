import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Trash2, Edit2 } from 'lucide-react';
import { useIconSource } from '../hooks/useIconSource';
import EditShortcutModal from './EditShortcutModal';
import FolderIcon from './FolderIcon';
import FolderModal from './FolderModal';
import { getLetterBackgroundColor, getLetterLabel, letterTileClassName, letterTileStyle, LETTER_TILE_BOX_STYLE, ICON_GRAPHIC_SIZE } from '../utils/letterIcon';
import LetterIconGlyph from './LetterIconGlyph';
import { arrangeGrid, findNearestSlot, samePlacement } from '../widgets/layout';
import { getWidgetDefinition } from '../widgets/registry';
import { removeWidget, setWidgetPlacement } from '../widgets/storage';
import {
    DndContext,
    closestCenter,
    rectIntersection,
    MouseSensor,
    TouchSensor,
    useSensor,
    useSensors,
    DragOverlay,
    useDraggable,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    rectSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { openInNewTab } from '../utils/openUrl';

// Auto-calculate gaps based on grid size
const calculateGaps = (cols, rows) => {
    const baseColGap = 40;
    const colGapReduction = (cols - 3) * 6;
    const colGap = Math.max(8, baseColGap - colGapReduction);

    const baseRowGap = 32;
    const rowGapReduction = (rows - 2) * 5;
    const rowGap = Math.max(12, baseRowGap - rowGapReduction);

    return { colGap, rowGap };
};

const createFolderId = () => `folder-${Date.now()}`;

const WebsiteShortcutIcon = ({ shortcut, iconSize, isContextOpen, onRemove, onEdit, setContextShortcutId, showIconBackground = false }) => {
    const iconSrc = useIconSource(shortcut);
    const iconRef = useRef(null);
    const [failedSrc, setFailedSrc] = useState(null);
    const letter = getLetterLabel(shortcut.customIcon, shortcut.title);
    const letterBg = getLetterBackgroundColor(shortcut.customIcon);
    const imageFailed = Boolean(iconSrc) && failedSrc === iconSrc;
    const isLetterIcon = shortcut.customIcon?.type === 'letter' || iconSrc === false || imageFailed;

    // 动态光泽效果：字母图标始终有色块，不需要玻璃板光泽；图片图标仅在开启「图标背景」时启用
    useEffect(() => {
        const element = iconRef.current;
        if (!element || isLetterIcon || !showIconBackground) return;

        const handleMouseMove = (e) => {
            const rect = element.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 100;
            const y = ((e.clientY - rect.top) / rect.height) * 100;
            element.style.setProperty('--mouse-x', `${x}%`);
            element.style.setProperty('--mouse-y', `${y}%`);
        };

        element.addEventListener('mousemove', handleMouseMove);
        return () => element.removeEventListener('mousemove', handleMouseMove);
    }, [showIconBackground, isLetterIcon]);

    // 字母图标：始终显示色块，不受 showIconBackground 影响
    // 图片图标：开启时用玻璃板，关闭时只保留圆角图片
    const showGlassPlate = !isLetterIcon && showIconBackground;
    const plateClass = showGlassPlate
        ? 'rounded-[22px] liquid-glass-icon flex items-center justify-center overflow-hidden h-full w-full'
        : 'rounded-[22px] flex items-center justify-center overflow-hidden h-full w-full bg-transparent';

    return (
        <div
            className="relative"
            style={{ width: `${iconSize}px`, height: `${iconSize}px` }}
        >
            <div
                ref={iconRef}
                className={plateClass}
            >
                {showGlassPlate && <div className="glass-refraction" />}
                {isLetterIcon ? (
                    <div
                        className={letterTileClassName(letterBg, 'flex items-center justify-center overflow-hidden rounded-[22px]')}
                        style={letterTileStyle(letterBg, LETTER_TILE_BOX_STYLE)}
                    >
                        <LetterIconGlyph text={letter} />
                    </div>
                ) : (
                    iconSrc ? (
                        <img
                            src={iconSrc}
                            alt={shortcut.title}
                            loading="lazy"
                            decoding="async"
                            className="select-none pointer-events-none transition-all duration-300 rounded-[18px]"
                            style={{
                                width: shortcut.iconPadding ? '60%' : ICON_GRAPHIC_SIZE,
                                height: shortcut.iconPadding ? '60%' : ICON_GRAPHIC_SIZE,
                                objectFit: 'contain',
                            }}
                            draggable={false}
                            onError={() => setFailedSrc(iconSrc)}
                        />
                    ) : (
                        <div className={`w-full h-full animate-pulse ${showIconBackground ? 'bg-gray-50' : 'bg-white/10 rounded-full'}`} />
                    )
                )}
            </div>

            {isContextOpen && (
                <>
                    <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px] pointer-events-none rounded-[22px]" />
                    <button
                        type="button"
                        className="absolute -top-2 -right-2 p-2 rounded-full bg-red-500 text-white shadow-lg hover:bg-red-400 transition z-20"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                            e.stopPropagation();
                            onRemove?.(shortcut.id);
                            setContextShortcutId?.(null);
                        }}
                    >
                        <Trash2 className="h-4 w-4" />
                    </button>
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <button
                            type="button"
                            className="w-full h-full rounded-[22px] bg-black/40 border border-white/20 text-white hover:text-blue-200 backdrop-blur-sm pointer-events-auto flex items-center justify-center transition"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                                e.stopPropagation();
                                onEdit?.(shortcut);
                                setContextShortcutId?.(null);
                            }}
                        >
                            <Edit2 className="h-6 w-6 drop-shadow-lg" />
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

const ShortcutIcon = (props) => {
    if (props.shortcut.type === 'folder') {
        return <FolderIcon folder={props.shortcut} iconSize={props.iconSize} />;
    }
    return <WebsiteShortcutIcon {...props} />;
};

const SortableShortcutItem = ({
    shortcut,
    iconSize,
    contextShortcutId,
    setContextShortcutId,
    onRemoveShortcut,
    setEditingShortcut,
    onOpenFolder,
    isMergeTarget,
    showIconBackground = false,
    gridColumn,
    gridRow,
}) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: shortcut.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 'auto',
        opacity: isDragging ? 0 : 1,
    };

    return (
        <div
            data-shortcut-id={shortcut.id}
            ref={setNodeRef}
            style={{
            ...style,
            // 跟随网格列宽，避免固定 120px 把标题画到相邻图标上
            width: '100%',
            minWidth: 0,
            maxWidth: '100%',
            gridColumn,
            gridRow,
            justifySelf: 'stretch',
            alignSelf: 'start',
        }}
            {...attributes}
            {...listeners}
            className="group relative flex flex-col items-center gap-[6px] transition-all duration-300 hover:scale-105 hover:z-10 justify-self-center h-fit touch-none cursor-pointer"
            onClick={() => {
                if (isDragging) return;
                if (contextShortcutId === shortcut.id) return;

                if (shortcut.type === 'folder') {
                    onOpenFolder(shortcut);
                } else {
                    openInNewTab(shortcut.url);
                }
            }}
            onContextMenu={(e) => {
                e.preventDefault();
                setContextShortcutId(shortcut.id);
            }}
            tabIndex={0}
            role="button"
            onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    if (shortcut.type === 'folder') {
                        onOpenFolder(shortcut);
                    } else {
                        openInNewTab(shortcut.url);
                    }
                }
            }}
        >
            <div className="relative">
                <ShortcutIcon
                    shortcut={shortcut}
                    iconSize={iconSize}
                    isContextOpen={contextShortcutId === shortcut.id}
                    onRemove={onRemoveShortcut}
                    onEdit={setEditingShortcut}
                    setContextShortcutId={setContextShortcutId}
                    showIconBackground={showIconBackground}
                />
                {isMergeTarget && (
                    <div
                        className="absolute -inset-2 border-2 border-dashed border-white/50 rounded-[28px] pointer-events-none animate-pulse bg-white/10"
                        style={{ zIndex: 60 }}
                    />
                )}
            </div>
            <span className="w-full truncate px-1 text-center text-[12px] font-medium leading-4 text-white/90 drop-shadow-md select-none">
                {shortcut.title}
            </span>
        </div>
    );
};

const widgetDragId = (instanceId) => `widget:${instanceId}`;

const parseWidgetDragId = (id) => {
    const text = String(id ?? '');
    return text.startsWith('widget:') ? text.slice('widget:'.length) : null;
};

const GridWidget = ({ placed, onOpen, onRemove }) => {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: widgetDragId(placed.widget.instanceId),
    });
    const Card = placed.definition.Card;

    return (
        <div
            ref={setNodeRef}
            className="h-full min-h-0 min-w-0 touch-none cursor-grab active:cursor-grabbing"
            data-widget-id={placed.widget.instanceId}
            {...attributes}
            {...listeners}
            style={{
                gridColumn: `${placed.placement.col + 1} / span ${placed.span.cols}`,
                gridRow: `${placed.placement.row + 1} / span ${placed.span.rows}`,
                alignSelf: 'stretch',
                opacity: isDragging ? 0.35 : 1,
                zIndex: isDragging ? 30 : 1,
            }}
        >
            <Card
                instance={placed.widget}
                onOpen={() => onOpen?.(placed.widget.instanceId)}
                onRemove={() => onRemove?.(placed.widget.instanceId)}
            />
        </div>
    );
};

const ShortcutGrid = ({
    config,
    shortcuts,
    widgets = [],
    onRemoveShortcut,
    onEditShortcut,
    onReorder,
    onWidgetsChange,
    onOpenWidget,
    leftOffset = 0,
}) => {
    const { cols = 5, rows = 3, iconSize = 96, showIconBackground = false } = config || {};
    const [currentPage, setCurrentPage] = useState(0);
    const [contextShortcutId, setContextShortcutId] = useState(null);
    const [editingShortcut, setEditingShortcut] = useState(null);
    const [responsiveCols, setResponsiveCols] = useState(cols);
    const [activeId, setActiveId] = useState(null);
    const [dragSize, setDragSize] = useState(null);
    const [openFolder, setOpenFolder] = useState(null);
    const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
    const [mergeTargetId, setMergeTargetId] = useState(null);
    const mergeTimerRef = useRef(null);
    const dragOutTimerRef = useRef(null);
    const lastOverIdRef = useRef(null);
    const lastOverIndexRef = useRef(null);
    const lastCollisionTypeRef = useRef(null);

    const containerRef = useRef(null);
    const pageGridRefs = useRef([]);
    const accumulatedRef = useRef(0);
    const lastTimeRef = useRef(0);
    const isChangingRef = useRef(false);

    const { colGap } = calculateGaps(responsiveCols, rows);
    const [scale, setScale] = useState(1);

    // Custom collision detection strategy
    const collisionDetectionStrategy = useCallback((args) => {
        // 1. Check for overlap (rectIntersection)
        const overlapCollisions = rectIntersection(args);

        if (overlapCollisions.length > 0) {
            lastCollisionTypeRef.current = 'overlap';
            return overlapCollisions;
        }

        // 2. Fallback to proximity (closestCenter)
        lastCollisionTypeRef.current = 'proximity';
        return closestCenter(args);
    }, []);

    const sensors = useSensors(
        useSensor(MouseSensor, {
            activationConstraint: {
                distance: 10,
            },
        }),
        useSensor(TouchSensor, {
            activationConstraint: {
                delay: 250,
                tolerance: 5,
            },
        })
    );

    const findShortcut = (id) => {
        const shortcut = shortcuts.find(s => s.id === id);
        if (shortcut) return { shortcut, container: 'root', index: shortcuts.indexOf(shortcut) };

        for (const s of shortcuts) {
            if (s.type === 'folder' && s.children) {
                const child = s.children.find(c => c.id === id);
                if (child) return { shortcut: child, container: s.id, parent: s, index: s.children.indexOf(child) };
            }
        }
        return null;
    };

    const handleDragStart = (event) => {
        setActiveId(event.active.id);
        const widgetId = parseWidgetDragId(event.active.id);
        if (widgetId) {
            const node = document.querySelector(`[data-widget-id="${widgetId}"]`);
            const rect = node?.getBoundingClientRect();
            setDragSize(rect ? { width: rect.width, height: rect.height } : null);
            return;
        }
        const initial = event.active.rect?.current?.initial;
        setDragSize(initial ? { width: initial.width, height: initial.height } : null);
    };

    const handleDragOver = (event) => {
        const { active, over } = event;

        if (parseWidgetDragId(active.id) || (over && parseWidgetDragId(over.id))) {
            if (mergeTimerRef.current) {
                clearTimeout(mergeTimerRef.current);
                mergeTimerRef.current = null;
            }
            setMergeTargetId(null);
            return;
        }

        // Handle drag out of folder
        const activeNode = findShortcut(active.id);
        if (activeNode && activeNode.container !== 'root') {
            // If dragging a folder item
            if (over && over.id === 'folder-modal-outside') {
                // Dragged out of folder!
                if (!dragOutTimerRef.current) {
                    dragOutTimerRef.current = setTimeout(() => {
                        const folderId = activeNode.container;
                        const folder = activeNode.parent;
                        const item = activeNode.shortcut;

                        // Remove from folder
                        const newChildren = folder.children.filter(c => c.id !== item.id);
                        const updatedFolder = { ...folder, children: newChildren };

                        // Insert item into shortcuts (after the folder)
                        const folderIndex = shortcuts.findIndex(s => s.id === folderId);
                        const newShortcuts = [...shortcuts];

                        if (newChildren.length === 0) {
                            // Folder empty, replace with item
                            newShortcuts.splice(folderIndex, 1, item);
                            setOpenFolder(null);
                            setIsFolderModalOpen(false);
                        } else {
                            newShortcuts[folderIndex] = updatedFolder;
                            newShortcuts.splice(folderIndex + 1, 0, item);
                            setOpenFolder(updatedFolder);
                            setIsFolderModalOpen(false); // Close modal to allow sorting on grid
                        }

                        if (onReorder) onReorder(newShortcuts);
                        dragOutTimerRef.current = null;
                    }, 400);
                }
                return;
            } else {
                if (dragOutTimerRef.current) {
                    clearTimeout(dragOutTimerRef.current);
                    dragOutTimerRef.current = null;
                }
            }
        }

        if (!over || active.id === over.id) {
            if (mergeTimerRef.current) {
                clearTimeout(mergeTimerRef.current);
                mergeTimerRef.current = null;
            }
            setMergeTargetId(null);
            lastOverIdRef.current = null;
            lastOverIndexRef.current = null;
            return;
        }

        const currentIndex = over.data?.current?.sortable?.index ?? null;

        // If over ID hasn't changed, only continue merge timer if index is stable
        if (lastOverIdRef.current === over.id) {
            // If we lost overlap (moved to proximity only), cancel merge
            if (lastCollisionTypeRef.current !== 'overlap') {
                if (mergeTimerRef.current) {
                    clearTimeout(mergeTimerRef.current);
                    mergeTimerRef.current = null;
                }
                setMergeTargetId(null);
                return;
            }

            if (lastOverIndexRef.current !== null && currentIndex !== lastOverIndexRef.current) {
                // Break merge when positions swap
                if (mergeTimerRef.current) {
                    clearTimeout(mergeTimerRef.current);
                    mergeTimerRef.current = null;
                }
                setMergeTargetId(null);
            }
            lastOverIndexRef.current = currentIndex;
            return;
        }

        // Over ID changed, reset timer
        lastOverIdRef.current = over.id;
        lastOverIndexRef.current = currentIndex;

        if (mergeTimerRef.current) {
            clearTimeout(mergeTimerRef.current);
            mergeTimerRef.current = null;
        }

        setMergeTargetId(null);

        const activeShortcut = shortcuts.find(s => s.id === active.id);
        const overShortcut = shortcuts.find(s => s.id === over.id);

        if (!activeShortcut || !overShortcut) {
            return;
        }

        // Don't allow dragging folders into folders
        if (activeShortcut.type === 'folder') {
            return;
        }

        // Check if valid merge target
        const isOverFolder = overShortcut.type === 'folder';
        const isOverItem = activeShortcut.type !== 'folder' && overShortcut.type !== 'folder';

        // Only allow merge if we have strict overlap
        if ((isOverFolder || isOverItem) && lastCollisionTypeRef.current === 'overlap') {
            mergeTimerRef.current = setTimeout(() => {
                setMergeTargetId(over.id);
            }, 600);
        }
    };

    const handleDragEnd = (event) => {
        const { active, over } = event;

        if (mergeTimerRef.current) {
            clearTimeout(mergeTimerRef.current);
            mergeTimerRef.current = null;
        }

        if (dragOutTimerRef.current) {
            clearTimeout(dragOutTimerRef.current);
            dragOutTimerRef.current = null;
        }

        setActiveId(null);
        setDragSize(null);

        const draggedWidgetId = parseWidgetDragId(active.id);
        if (draggedWidgetId) {
            const placed = layout.placedWidgets.find((item) => item.widget.instanceId === draggedWidgetId);
            if (placed && onWidgetsChange) {
                const nextPlacement = placementFromDrag(event, placed);
                if (!samePlacement(placed.placement, nextPlacement)) {
                    onWidgetsChange(setWidgetPlacement(widgets, draggedWidgetId, nextPlacement));
                }
            }
            return;
        }

        const isMergeAction = mergeTargetId && over && mergeTargetId === over.id;
        setMergeTargetId(null);

        if (!over) return;

        if (isMergeAction) {
            const activeShortcut = shortcuts.find(s => s.id === active.id);
            const overShortcut = shortcuts.find(s => s.id === over.id);

            // If dropping onto a folder
            if (overShortcut && overShortcut.type === 'folder') {
                // Don't allow dropping a folder into a folder for now
                if (activeShortcut.type === 'folder') return;

                const updatedFolder = {
                    ...overShortcut,
                    children: [...(overShortcut.children || []), activeShortcut]
                };

                const newShortcuts = shortcuts
                    .filter(s => s.id !== active.id)
                    .map(s => s.id === over.id ? updatedFolder : s);

                if (onReorder) onReorder(newShortcuts);
                return;
            }

            // If dropping onto another item to create a folder
            if (activeShortcut && overShortcut && activeShortcut.type !== 'folder' && overShortcut.type !== 'folder') {
                // Create new folder
                const newFolder = {
                    id: createFolderId(),
                    title: 'Folder',
                    type: 'folder',
                    children: [overShortcut, activeShortcut]
                };

                const newShortcuts = shortcuts
                    .filter(s => s.id !== active.id)
                    .map(s => s.id === over.id ? newFolder : s);

                if (onReorder) onReorder(newShortcuts);
                return;
            }
        }

        // Standard reordering
        if (active.id !== over.id) {
            // Check if reordering inside a folder
            const activeNode = findShortcut(active.id);
            const overNode = findShortcut(over.id);

            if (activeNode && overNode && activeNode.container === overNode.container && activeNode.container !== 'root') {
                const folder = activeNode.parent;
                const oldIndex = activeNode.index;
                const newIndex = overNode.index;

                if (oldIndex !== newIndex) {
                    const newChildren = arrayMove(folder.children, oldIndex, newIndex);
                    handleFolderUpdate({ ...folder, children: newChildren });
                }
                return;
            }

            const oldIndex = shortcuts.findIndex((s) => s.id === active.id);
            const newIndex = shortcuts.findIndex((s) => s.id === over.id);

            if (oldIndex !== -1 && newIndex !== -1 && onReorder) {
                onReorder(arrayMove(shortcuts, oldIndex, newIndex));
            }
        }
    };

    const handleFolderUpdate = (updatedFolder) => {
        if (updatedFolder.children.length === 0) {
            if (onRemoveShortcut) {
                onRemoveShortcut(updatedFolder.id);
            }
            setOpenFolder(null);
            setIsFolderModalOpen(false);
        } else {
            const newShortcuts = shortcuts.map(s => s.id === updatedFolder.id ? updatedFolder : s);
            if (onReorder) onReorder(newShortcuts);
            if (openFolder && openFolder.id === updatedFolder.id) {
                setOpenFolder(updatedFolder);
            }
        }
    };

    const handleFolderDelete = () => {
        // Delete folder and move items back to root? Or just delete everything?
        // Let's move items back to root for safety, or just delete.
        // User probably expects delete to delete.
        if (openFolder && onRemoveShortcut) {
            onRemoveShortcut(openFolder.id);
            setOpenFolder(null);
            setIsFolderModalOpen(false);
        }
    };

    const handleOpenFolder = (folder) => {
        setOpenFolder(folder);
        setIsFolderModalOpen(true);
    };

    const widgetMinCols = widgets.reduce((minCols, widget) => {
        if (!widget.enabled) return minCols;
        return Math.max(minCols, getWidgetDefinition(widget.type)?.span?.cols || 1);
    }, 0);

    // Calculate scale to fit screen
    useEffect(() => {
        const handleResize = () => {
            const padding = 48; // Horizontal padding
            const availableWidth = Math.max(320, window.innerWidth - padding - leftOffset);

            // Estimate columns that can fit, then clamp to user setting
            const previewGap = calculateGaps(cols, rows).colGap;
            const maxColsFit = Math.max(1, Math.floor((availableWidth + previewGap) / (iconSize + previewGap)));
            const fittedCols = Math.max(1, Math.min(cols, maxColsFit));
            // 小组件按图标跨度占位，列数不能少到放不下
            const newCols = widgetMinCols > 0
                ? Math.min(cols, Math.max(fittedCols, Math.min(widgetMinCols, cols)))
                : fittedCols;
            setResponsiveCols(newCols);

            const gaps = calculateGaps(newCols, rows);
            const requiredWidth = (newCols * iconSize) + ((newCols - 1) * gaps.colGap);

            if (requiredWidth > availableWidth) {
                const newScale = availableWidth / requiredWidth;
                setScale(Math.min(1, newScale));
            } else {
                setScale(1);
            }
        };

        handleResize(); // Initial calculation
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [cols, rows, iconSize, leftOffset, widgetMinCols]);

    const layout = arrangeGrid({
        shortcuts,
        widgets,
        cols: responsiveCols,
        rows,
    });

    useEffect(() => {
        if (!onWidgetsChange) return;
        const changed = layout.placedWidgets.filter((item) => !samePlacement(item.widget.placement, item.placement));
        if (changed.length === 0) return;
        let next = widgets;
        changed.forEach((item) => {
            next = setWidgetPlacement(next, item.widget.instanceId, item.placement);
        });
        onWidgetsChange(next);
    }, [layout, onWidgetsChange, widgets]);

    const placementFromDrag = (event, placed) => {
        const grid = pageGridRefs.current[placed.placement.page];
        const initial = event.active?.rect?.current?.initial;
        if (!grid || !initial) return placed.placement;
        const bounds = grid.getBoundingClientRect();
        const styles = window.getComputedStyle(grid);
        const scaleFactor = grid.offsetWidth ? bounds.width / grid.offsetWidth : 1;
        const toPx = (value) => (Number.parseFloat(value) || 0) * scaleFactor;
        const gapX = toPx(styles.columnGap);
        const gapY = toPx(styles.rowGap);
        const colTrack = styles.gridTemplateColumns.split(' ').find((part) => part.endsWith('px'));
        const rowTracks = styles.gridTemplateRows.split(' ').map(toPx).filter((size) => size > 0);
        const colSize = toPx(colTrack) || (bounds.width - toPx(styles.paddingLeft) - toPx(styles.paddingRight) - (responsiveCols - 1) * gapX) / responsiveCols;
        const rowSize = rowTracks[0] || (iconSize + 44) * scaleFactor;
        const originX = bounds.left + toPx(styles.paddingLeft);
        const originY = bounds.top + toPx(styles.paddingTop);
        const nextLeft = initial.left + event.delta.x;
        const nextTop = initial.top + event.delta.y;
        const colStride = colSize + gapX;
        const col = Math.round((nextLeft - originX) / colStride);
        let row = 0;
        if (rowTracks.length > 1) {
            let cursor = originY;
            let bestDistance = Infinity;
            rowTracks.forEach((size, index) => {
                const distance = Math.abs(nextTop - cursor);
                if (distance < bestDistance) {
                    bestDistance = distance;
                    row = index;
                }
                cursor += size + gapY;
            });
        } else {
            row = Math.round((nextTop - originY) / (rowSize + gapY));
        }
        const occupied = new Set();
        layout.placedWidgets.forEach((item) => {
            if (item.widget.instanceId === placed.widget.instanceId) return;
            if (item.placement.page !== placed.placement.page) return;
            for (let rowOffset = 0; rowOffset < item.span.rows; rowOffset += 1) {
                for (let colOffset = 0; colOffset < item.span.cols; colOffset += 1) {
                    occupied.add(`${item.placement.col + colOffset},${item.placement.row + rowOffset}`);
                }
            }
        });
        return findNearestSlot(occupied, responsiveCols, rows, placed.span, {
            page: placed.placement.page,
            col,
            row,
        }) || placed.placement;
    };

    const totalPages = layout.pageCount;

    // Reset page when shortcuts change
    useEffect(() => {
        if (currentPage >= totalPages && totalPages > 0) {
            const frame = requestAnimationFrame(() => setCurrentPage(totalPages - 1));
            return () => cancelAnimationFrame(frame);
        }
    }, [shortcuts.length, totalPages, currentPage]);

    useEffect(() => {
        if (contextShortcutId && !shortcuts.some(s => s.id === contextShortcutId)) {
            const frame = requestAnimationFrame(() => setContextShortcutId(null));
            return () => cancelAnimationFrame(frame);
        }
    }, [contextShortcutId, shortcuts]);

    useEffect(() => {
        if (!contextShortcutId) return;
        const handleClickAway = () => setContextShortcutId(null);
        document.addEventListener('click', handleClickAway);
        return () => document.removeEventListener('click', handleClickAway);
    }, [contextShortcutId]);

    // Snap to page
    const goToPage = useCallback((targetPage) => {
        const clampedPage = Math.max(0, Math.min(totalPages - 1, targetPage));
        if (clampedPage !== currentPage) {
            isChangingRef.current = true;
            setCurrentPage(clampedPage);
            // Allow next page change after animation
            setTimeout(() => {
                isChangingRef.current = false;
                accumulatedRef.current = 0;
            }, 600);
        }
    }, [totalPages, currentPage]);

    // Wheel handler for mouse wheel (vertical) and trackpad (horizontal)
    useEffect(() => {
        if (totalPages <= 1) return;

        const handleWheel = (e) => {
            // Skip if page change is in progress
            if (isChangingRef.current) return;

            const now = Date.now();

            // Reset if new gesture (gap > 200ms)
            if (now - lastTimeRef.current > 200) {
                accumulatedRef.current = 0;
            }
            lastTimeRef.current = now;

            let scrollDelta = 0;

            // Detect input type:
            // - Trackpad horizontal swipe: deltaX is dominant
            // - Mouse wheel vertical: deltaY is present, deltaX is 0 or minimal
            const isHorizontalSwipe = Math.abs(e.deltaX) > Math.abs(e.deltaY);
            const isMouseWheel = e.deltaX === 0 && e.deltaY !== 0;

            if (isHorizontalSwipe) {
                // Trackpad horizontal swipe
                scrollDelta = e.deltaX;
            } else if (isMouseWheel) {
                // Mouse wheel vertical scroll
                scrollDelta = e.deltaY;
            } else {
                // Ignore diagonal or vertical trackpad scroll
                return;
            }

            // Accumulate scroll
            accumulatedRef.current += scrollDelta;

            // Trigger page change at threshold
            const threshold = 50;

            if (accumulatedRef.current > threshold) {
                goToPage(currentPage + 1);
                accumulatedRef.current = 0; // Reset immediately
            } else if (accumulatedRef.current < -threshold) {
                goToPage(currentPage - 1);
                accumulatedRef.current = 0; // Reset immediately
            }
        };

        window.addEventListener('wheel', handleWheel, { passive: true });
        return () => window.removeEventListener('wheel', handleWheel);
    }, [totalPages, currentPage, goToPage]);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'ArrowLeft') {
                goToPage(currentPage - 1);
            } else if (e.key === 'ArrowRight') {
                goToPage(currentPage + 1);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentPage, goToPage]);

    if (shortcuts.length === 0 && layout.placedWidgets.length === 0) {
        return null;
    }

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={collisionDetectionStrategy}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
        >
            {/* Swipeable Container */}
            <div
                ref={containerRef}
                className="w-full overflow-x-hidden"
            >
                <div
                    className="flex transition-transform duration-300 ease-out"
                    style={{
                        transform: `translateX(${-currentPage * 100}%)`,
                    }}
                >
                    {Array.from({ length: totalPages }, (_, pageIndex) => {
                        const pageShortcuts = layout.placedShortcuts.filter((item) => item.page === pageIndex);
                        const pageWidgets = layout.placedWidgets.filter((item) => item.placement.page === pageIndex);
                        return (
                        <div
                            key={pageIndex}
                            className="shrink-0 w-full flex justify-center"
                        >
                            <SortableContext
                                items={pageShortcuts.map((item) => item.shortcut.id)}
                                strategy={rectSortingStrategy}
                            >
                                <div
                                    ref={(node) => {
                                        pageGridRefs.current[pageIndex] = node;
                                    }}
                                    className="grid px-4 py-4 transition-transform duration-300"
                                    style={(() => {
                                        const rowCount = Math.max(
                                            1,
                                            ...pageShortcuts.map((item) => item.row + 1),
                                            ...pageWidgets.map((item) => item.placement.row + item.span.rows),
                                        );
                                        const widgetRows = new Set(pageWidgets.map((item) => item.placement.row));
                                        const templateRows = Array.from({ length: rowCount }, (_, row) => (
                                            `${widgetRows.has(row) ? iconSize + 32 : iconSize + 44}px`
                                        )).join(' ');
                                        return {
                                        gridTemplateColumns: `repeat(${responsiveCols}, minmax(0, 1fr))`,
                                        gridTemplateRows: templateRows,
                                        transform: `scale(${scale})`,
                                        transformOrigin: 'top center',
                                        // Calculate exact width to ensure grid layout is preserved before scaling
                                        width: scale < 1 ? `${(responsiveCols * iconSize) + ((responsiveCols - 1) * colGap)}px` : '100%',
                                        maxWidth: scale < 1 ? 'none' : '56rem',
                                        };
                                    })()}
                                >
                                    {pageShortcuts.map(({ shortcut, col, row }) => (
                                        <SortableShortcutItem
                                            key={shortcut.id}
                                            shortcut={shortcut}
                                            iconSize={iconSize}
                                            contextShortcutId={contextShortcutId}
                                            setContextShortcutId={setContextShortcutId}
                                            onRemoveShortcut={onRemoveShortcut}
                                            setEditingShortcut={setEditingShortcut}
                                            onOpenFolder={handleOpenFolder}
                                            isMergeTarget={mergeTargetId === shortcut.id}
                                            showIconBackground={showIconBackground}
                                            gridColumn={col + 1}
                                            gridRow={row + 1}
                                        />
                                    ))}
                                    {pageWidgets.map((placed) => (
                                        <GridWidget
                                            key={placed.widget.instanceId}
                                            placed={placed}
                                            onOpen={onOpenWidget}
                                            onRemove={(instanceId) => {
                                                if (onOpenWidget) onOpenWidget(null);
                                                onWidgetsChange?.(removeWidget(widgets, instanceId));
                                            }}
                                        />
                                    ))}
                                </div>
                            </SortableContext>
                        </div>
                        );
                    })}
                </div>
            </div>

            <DragOverlay>
                {activeId ? (
                    <div style={{ transform: 'scale(1.05)', width: dragSize?.width, height: dragSize?.height }}>
                         {(() => {
                             const widgetId = parseWidgetDragId(activeId);
                             if (widgetId) {
                                 const placed = layout.placedWidgets.find((item) => item.widget.instanceId === widgetId);
                                 const Card = placed?.definition.Card;
                                 if (!Card) return null;
                                 return <Card instance={placed.widget} />;
                             }
                             const node = findShortcut(activeId);
                             const shortcut = node ? node.shortcut : null;
                             if (!shortcut) return null;
                             return (
                                 <div className="flex flex-col items-center gap-[6px]">
                                     <ShortcutIcon
                                         shortcut={shortcut}
                                         iconSize={iconSize}
                                         isContextOpen={false}
                                         showIconBackground={showIconBackground}
                                     />
                                     <span className="w-full truncate px-1 text-center text-[12px] font-medium leading-4 text-white/90 drop-shadow-md select-none">
                                         {shortcut.title}
                                     </span>
                                 </div>
                             )
                         })()}
                    </div>
                ) : null}
            </DragOverlay>

            {/* Fixed Pagination Controls */}
            {totalPages > 1 && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 liquid-glass-fixed rounded-full px-4 py-2">
                    <button
                        onClick={() => goToPage(currentPage - 1)}
                        disabled={currentPage === 0}
                        className={`p-1.5 rounded-full transition-all ${currentPage === 0
                            ? 'opacity-30 cursor-not-allowed'
                            : 'liquid-glass-mini hover:scale-110 text-white active:scale-90'
                            }`}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </button>

                    <div className="flex gap-2">
                        {Array.from({ length: totalPages }).map((_, index) => (
                            <button
                                key={index}
                                onClick={() => goToPage(index)}
                                className={`h-2 rounded-full transition-all duration-300 ${index === currentPage
                                    ? 'bg-white/90 shadow-lg shadow-white/25 w-6'
                                    : 'bg-white/40 hover:bg-white/70 hover:shadow-md hover:shadow-white/20 w-2'
                                    }`}
                            />
                        ))}
                    </div>

                    <button
                        onClick={() => goToPage(currentPage + 1)}
                        disabled={currentPage === totalPages - 1}
                        className={`p-1.5 rounded-full transition-all ${currentPage === totalPages - 1
                            ? 'opacity-30 cursor-not-allowed'
                            : 'liquid-glass-mini hover:scale-110 text-white active:scale-90'
                            }`}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </button>
                </div>
            )}

            <EditShortcutModal
                key={editingShortcut?.id || 'closed'}
                isOpen={!!editingShortcut}
                onClose={() => setEditingShortcut(null)}
                shortcut={editingShortcut}
                onSave={(updated) => {
                    if (openFolder && openFolder.children?.some(c => c.id === updated.id)) {
                        const newChildren = openFolder.children.map(c => c.id === updated.id ? updated : c);
                        const updatedFolder = { ...openFolder, children: newChildren };
                        handleFolderUpdate(updatedFolder);
                    } else {
                        onEditShortcut?.(updated);
                    }
                    setEditingShortcut(null);
                }}
            />

            <FolderModal
                isOpen={isFolderModalOpen}
                onClose={() => setIsFolderModalOpen(false)}
                folder={openFolder}
                onUpdate={handleFolderUpdate}
                onDelete={handleFolderDelete}
                onEditShortcut={setEditingShortcut}
                showIconBackground={showIconBackground}
            />
        </DndContext>
    );
};

export default ShortcutGrid;
