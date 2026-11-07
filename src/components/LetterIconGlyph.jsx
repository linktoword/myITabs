import { getLetterChars, getLetterFontSize } from '../utils/letterIcon';

/**
 * Renders 1–4 characters inside a letter color tile.
 * 4 characters => 2×2 grid.
 */
const LetterIconGlyph = ({ text, compact = false }) => {
    const chars = getLetterChars(text || 'A');
    const n = chars.length || 1;
    const fontSize = getLetterFontSize(n, { compact });

    if (n === 4) {
        return (
            <div
                className="grid grid-cols-2 grid-rows-2 w-full h-full box-border select-none"
                style={{ padding: compact ? 1 : 4, gap: 0 }}
            >
                {chars.map((ch, i) => (
                    <span
                        key={`${i}-${ch}`}
                        className="flex items-center justify-center font-bold text-white leading-none"
                        style={{ fontSize }}
                    >
                        {ch}
                    </span>
                ))}
            </div>
        );
    }

    return (
        <span
            className="font-bold text-white select-none leading-none whitespace-nowrap"
            style={{
                fontSize,
                letterSpacing: n > 1 ? '-0.02em' : 'normal',
            }}
        >
            {chars.join('')}
        </span>
    );
};

export default LetterIconGlyph;
