import { useState, useEffect, useMemo } from 'react';
import { Upload, Check } from 'lucide-react';
import { getAllIconUrls } from '../utils/icons';
import { LETTER_COLOR_PICKER_DEFAULT, getLetterLabel, letterTileClassName, letterTileStyle } from '../utils/letterIcon';
import LetterIconGlyph from './LetterIconGlyph';

const IconSelector = ({ url, title, onSelect, selectedIcon }) => {
    const [iconPreviews, setIconPreviews] = useState([]);
    const [backgroundColor, setBackgroundColor] = useState(
        selectedIcon?.backgroundColor || LETTER_COLOR_PICKER_DEFAULT
    );
    const selectedSource = selectedIcon?.type === 'custom'
        ? 'custom'
        : selectedIcon?.type === 'letter'
            ? 'letter'
            : selectedIcon?.source || null;
    const customIcon = selectedIcon?.type === 'custom' ? selectedIcon.data : null;

    useEffect(() => {
        if (selectedIcon?.type === 'letter' && selectedIcon.backgroundColor) {
            setBackgroundColor(selectedIcon.backgroundColor);
        }
    }, [selectedIcon]);

    const initialLetterIcon = useMemo(() => {
        if (!url) return null;
        try {
            // Up to 4 chars from title, else domain
            let sourceText = title && title.trim() ? title.trim() : '';
            if (!sourceText) {
                const domain = new URL(url).hostname.replace(/^www\./, '');
                sourceText = domain || 'A';
            }
            const letter = getLetterLabel({ letter: sourceText }, sourceText);
            return {
                source: 'letter',
                letter,
                name: '首字母'
            };
        } catch {
            return null;
        }
    }, [url, title]);

    // Keep letter text in sync with title (max 4 chars) while letter icon is selected
    useEffect(() => {
        if (selectedSource !== 'letter') return;
        const nextLetter = initialLetterIcon?.letter || getLetterLabel(selectedIcon, title);
        if (!nextLetter) return;
        if (selectedIcon?.letter === nextLetter) return;
        onSelect({
            type: 'letter',
            letter: nextLetter,
            backgroundColor: selectedIcon?.backgroundColor || backgroundColor,
        });
    }, [title, initialLetterIcon, selectedSource]);


    useEffect(() => {
        let abort = false;
        const currentUrl = url;
        
        const loadIcons = async () => {
            if (!currentUrl) {
                setIconPreviews([]);
                return;
            }
            
            // Immediately show letter icon first
            const baseList = initialLetterIcon ? [initialLetterIcon] : [];
            if (!abort && currentUrl === url) {
                setIconPreviews(baseList);
            }
            
            // Then load and validate other icons (without crossOrigin to avoid CORS preflight)
            const icons = getAllIconUrls(currentUrl);
            const validated = await Promise.all(icons.map((icon) => new Promise((resolve) => {
                const img = new Image();
                // Don't set crossOrigin - this avoids CORS preflight checks
                // Some icons may fail silently, which is acceptable
                img.onload = () => resolve(icon);
                img.onerror = () => resolve(null); // Silently fail
                img.src = icon.url;
            })));

            const filtered = [...baseList, ...validated.filter(Boolean)];
            if (!abort && currentUrl === url) {
                setIconPreviews(filtered);
            }
        };
        loadIcons();
        return () => { abort = true; };
    }, [url, initialLetterIcon]);

    const handleIconSelect = (source, iconUrl) => {
        if (source === 'letter') {
            onSelect({ type: 'letter', letter: iconUrl, backgroundColor });
        } else {
            onSelect({ type: 'source', source, url: iconUrl });
        }
    };

    const handleBackgroundColorChange = (color) => {
        setBackgroundColor(color);
        if (selectedSource === 'letter') {
            const letter = selectedIcon?.letter || initialLetterIcon?.letter || 'A';
            onSelect({ type: 'letter', letter, backgroundColor: color });
        }
    };

    const handleCustomUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            alert('Please upload an image file');
            return;
        }

        // Validate file size (max 500KB)
        if (file.size > 500 * 1024) {
            alert('Image size should be less than 500KB');
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            onSelect({ type: 'custom', data: reader.result });
        };
        reader.readAsDataURL(file);
    };

    if (!url) {
        return (
            <div className="text-center py-4 text-white/40 text-sm">
                Enter a URL to preview icons
            </div>
        );
    }

    const letterPreviewColor = selectedSource === 'letter'
        ? (selectedIcon?.backgroundColor || backgroundColor)
        : backgroundColor;

    return (
        <div className="space-y-3">
            <label className="text-xs text-white/60">Choose Icon</label>

            {/* Icon Previews Grid */}
            <div className="grid grid-cols-6 gap-2">
                {iconPreviews.map((icon) => (
                    <button
                        key={icon.source}
                        type="button"
                        onClick={() => handleIconSelect(icon.source, icon.letter || icon.url)}
                        className={`relative aspect-square rounded-lg bg-white overflow-hidden border-2 transition-all hover:scale-105 ${selectedSource === icon.source
                                ? 'border-blue-500 ring-2 ring-blue-500/50'
                                : 'border-white/10 hover:border-white/30'
                            }`}
                        title={icon.name}
                    >
                        {icon.source === 'letter' ? (
                            <div
                                className={`w-full h-full flex items-center justify-center overflow-hidden ${letterTileClassName(letterPreviewColor)}`}
                                style={letterTileStyle(letterPreviewColor)}
                            >
                                <LetterIconGlyph text={icon.letter} compact />
                            </div>
                        ) : (
                            <img
                                src={icon.url}
                                alt={icon.name}
                                className="w-full h-full object-contain p-1"
                                onError={(e) => {
                                    e.target.style.display = 'none';
                                    e.target.parentElement.classList.add('bg-gray-200');
                                }}
                            />
                        )}
                        {selectedSource === icon.source && (
                            <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                                <Check className="h-4 w-4 text-blue-600" />
                            </div>
                        )}
                    </button>
                ))}

                {/* Custom Upload Button */}
                <label
                    className={`relative aspect-square rounded-lg border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center hover:scale-105 ${selectedSource === 'custom'
                            ? 'border-blue-500 bg-blue-500/10 ring-2 ring-blue-500/50'
                            : 'border-white/20 bg-white/5 hover:border-white/40 hover:bg-white/10'
                        }`}
                    title="Upload custom icon"
                >
                    <input
                        type="file"
                        accept="image/*"
                        onChange={handleCustomUpload}
                        className="hidden"
                    />
                    {customIcon ? (
                        <>
                            <img
                                src={customIcon}
                                alt="Custom"
                                className="w-full h-full object-contain p-1"
                            />
                            {selectedSource === 'custom' && (
                                <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                                    <Check className="h-4 w-4 text-blue-600" />
                                </div>
                            )}
                        </>
                    ) : (
                        <Upload className="h-4 w-4 text-white/40" />
                    )}
                </label>
            </div>

            {/* Letter background color — shown when letter icon is selected */}
            {selectedSource === 'letter' && (
                <div className="flex items-center justify-between gap-3 py-1">
                    <div>
                        <label className="text-sm text-white/80">文字图标背景色</label>
                        <p className="text-xs text-white/40">仅对首字母图标生效</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            type="color"
                            value={letterPreviewColor || LETTER_COLOR_PICKER_DEFAULT}
                            onChange={(e) => handleBackgroundColorChange(e.target.value)}
                            className="h-8 w-10 cursor-pointer rounded border border-white/20 bg-transparent p-0.5"
                            title="选择背景颜色"
                        />
                        <span className="text-xs font-mono text-white/60 w-16">
                            {(letterPreviewColor || LETTER_COLOR_PICKER_DEFAULT).toUpperCase()}
                        </span>
                    </div>
                </div>
            )}

            <p className="text-xs text-white/40">
                Click an icon to select, or upload your own (max 500KB)
            </p>
        </div>
    );
};

export default IconSelector;
