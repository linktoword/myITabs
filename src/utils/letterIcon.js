/** Letter-icon background + text layout helpers */

export const LETTER_COLOR_PICKER_DEFAULT = '#6366f1';

/** Original letter tile size relative to the icon cell */
export const LETTER_TILE_BOX_STYLE = {
    width: '80%',
    height: '80%',
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

/** Font size (px) for a letter tile×62 tile */
export function getLetterFontSize(charCount, { compact = false } = {}) {
    if (compact) {
        if (charCount <= 1) return 10;
        if (charCount === 2) return 8;
        if (charCount === 3) return 6;
        return 7; // 2x2 mini
    }
    if (charCount <= 1) return 28;
    if (charCount === 2) return 20;
    if (charCount === 3) return 15;
    return 16; // 2x2 grid
}

export function letterTileClassName(backgroundColor, extra = '') {
    const gradient = backgroundColor ? '' : 'bg-linear-to-br from-blue-500 to-purple-600';
    return [gradient, extra].filter(Boolean).join(' ');
}

export function letterTileStyle(backgroundColor, extraStyle = {}) {
    if (backgroundColor) {
        return { backgroundColor, ...extraStyle };
    }
    return { ...extraStyle };
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
        return `<div style="display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;width:100%;height:100%;padding:4px;box-sizing:border-box;gap:0;">${safe.map((c) => `<span style="${cellStyle}font-size:${fontSize}px;font-weight:700;color:#fff;">${c}</span>`).join('')}</div>`;
    }

    return `<span style="font-size:${fontSize}px;font-weight:700;color:#fff;line-height:1;letter-spacing:${n > 1 ? '-0.02em' : 'normal'};white-space:nowrap;">${safe.join('')}</span>`;
}

/** Build inline HTML for letter tile / image onError fallback */
export function letterFallbackHtml(letter, backgroundColor, {
    roundedClass = 'rounded-[22px]',
    boxStyle = 'width: 80%; height: 80%;',
    compact = false,
} = {}) {
    const label = getLetterLabel({ letter }, letter);
    const inner = letterGlyphHtml(label, { compact });
    if (backgroundColor) {
        return `<div class="flex items-center justify-center overflow-hidden ${roundedClass}" style="${boxStyle} background-color: ${backgroundColor};">${inner}</div>`;
    }
    return `<div class="flex items-center justify-center overflow-hidden bg-linear-to-br from-blue-500 to-purple-600 ${roundedClass}" style="${boxStyle}">${inner}</div>`;
}
