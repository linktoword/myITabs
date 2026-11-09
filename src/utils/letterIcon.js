/** Letter-icon background + text layout helpers */

export const LETTER_COLOR_PICKER_DEFAULT = '#6366f1';

/**
 * 图标图形相对格子的边长。
 * 字母色块与未开启内边距的图片图标共用，避免字母图标比图片图标小一圈。
 */
export const ICON_GRAPHIC_SIZE = '90%';

/** 字母色块铺满图标格，与图片图标外框一致 */
export const LETTER_TILE_BOX_STYLE = {
    width: ICON_GRAPHIC_SIZE,
    height: ICON_GRAPHIC_SIZE,
};

/** Prefer customIcon.backgroundColor; fall back to null => legacy gradient */
export function getLetterBackgroundColor(customIcon) {
    return customIcon?.backgroundColor || null;
}

/**
 * Build display label: prefer customIcon.letter, else title; max 4 Unicode chars.
 */
export function getLetterLabel(customIcon, title) {
    const rawSource =
        (customIcon?.letter != null && String(customIcon.letter).trim() !== '')
            ? String(customIcon.letter).trim()
            : (title != null && String(title).trim() !== '' ? String(title).trim() : 'A');
    const chars = [...rawSource];
    return chars.slice(0, 4).join('').toUpperCase();
}

export function getLetterChars(label) {
    return [...(label || 'A')];
}

/**
 * 字号相对色块宽度（cqw），随图标尺寸缩放。
 * 主图标在 62px 格子里约等于原先的 28/20/15/16px。
 */
export function getLetterFontSize(charCount, { compact = false } = {}) {
    if (compact) {
        if (charCount <= 1) return '72cqw';
        if (charCount === 2) return '56cqw';
        if (charCount === 3) return '42cqw';
        return '40cqw';
    }
    if (charCount <= 1) return '46cqw';
    if (charCount === 2) return '34cqw';
    if (charCount === 3) return '26cqw';
    return '28cqw';
}

export function letterTileClassName(backgroundColor, extra = '') {
    const gradient = backgroundColor ? '' : 'bg-linear-to-br from-blue-500 to-purple-600';
    return [gradient, extra].filter(Boolean).join(' ');
}

export function letterTileStyle(backgroundColor, extraStyle = {}) {
    // cqw 字号相对这个色块计算，色块需要成为尺寸容器
    const layout = { containerType: 'size' };
    if (backgroundColor) {
        return { backgroundColor, ...layout, ...extraStyle };
    }
    return { ...layout, ...extraStyle };
}

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/** Inner HTML for letter characters (1–3 row, 4 as 2×2) */
export function letterGlyphHtml(label, { compact = false } = {}) {
    const chars = getLetterChars(label);
    const n = chars.length || 1;
    const fontSize = getLetterFontSize(n, { compact });
    const safe = chars.map(escapeHtml);

    if (n === 4) {
        const cellStyle = 'display:flex;align-items:center;justify-content:center;line-height:1;';
        return `<div style="display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;width:100%;height:100%;padding:6%;box-sizing:border-box;gap:0;">${safe.map((c) => `<span style="${cellStyle}font-size:${fontSize};font-weight:700;color:#fff;">${c}</span>`).join('')}</div>`;
    }

    return `<span style="font-size:${fontSize};font-weight:700;color:#fff;line-height:1;letter-spacing:${n > 1 ? '-0.02em' : 'normal'};white-space:nowrap;">${safe.join('')}</span>`;
}

/** Build inline HTML for letter tile / image onError fallback */
export function letterFallbackHtml(letter, backgroundColor, {
    roundedClass = 'rounded-[22px]',
    boxStyle = 'width: 100%; height: 100%; container-type: size;',
    compact = false,
} = {}) {
    const label = getLetterLabel({ letter }, letter);
    const inner = letterGlyphHtml(label, { compact });
    if (backgroundColor) {
        return `<div class="flex items-center justify-center overflow-hidden ${roundedClass}" style="${boxStyle} background-color: ${backgroundColor};">${inner}</div>`;
    }
    return `<div class="flex items-center justify-center overflow-hidden bg-linear-to-br from-blue-500 to-purple-600 ${roundedClass}" style="${boxStyle}">${inner}</div>`;
}
