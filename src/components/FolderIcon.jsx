import { useIconSource } from '../hooks/useIconSource';
import { useEffect, useRef, useState } from 'react';
import { getLetterBackgroundColor, getLetterLabel, letterTileClassName, letterTileStyle } from '../utils/letterIcon';
import LetterIconGlyph from './LetterIconGlyph';

const MiniIcon = ({ item }) => {
    const iconSrc = useIconSource(item);
    const [failedSrc, setFailedSrc] = useState(null);
    const letterBg = getLetterBackgroundColor(item.customIcon);
    const letter = getLetterLabel(item.customIcon, item.title);
    const imageFailed = Boolean(iconSrc) && failedSrc === iconSrc;
    const showLetter = item.customIcon?.type === 'letter' || iconSrc === false || imageFailed;

    return (
        <div className="aspect-square rounded-md overflow-hidden liquid-glass-mini flex items-center justify-center">
             {showLetter ? (
                <div
                    className={letterTileClassName(letterBg, 'w-full h-full flex items-center justify-center overflow-hidden rounded-md')}
                    style={letterTileStyle(letterBg)}
                >
                    <LetterIconGlyph text={letter} compact />
                </div>
            ) : (
                iconSrc ? (
                    <img 
                        src={iconSrc} 
                        alt="" 
                        className="w-full h-full object-cover rounded-md"
                        onError={() => setFailedSrc(iconSrc)}
                    />
                ) : (
                    <div className="w-full h-full bg-white/5 animate-pulse" />
                )
            )}
        </div>
    );
};

const FolderIcon = ({ folder, iconSize }) => {
    const previewItems = folder.children.slice(0, 9);
    const folderRef = useRef(null);
    
    // Calculate mini icon size based on container size
    // 3x3 grid or 2x2 grid
    const padding = iconSize * 0.15;
    // 动态光泽效果
    useEffect(() => {
        const element = folderRef.current;
        if (!element) return;

        const handleMouseMove = (e) => {
            const rect = element.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 100;
            const y = ((e.clientY - rect.top) / rect.height) * 100;
            element.style.setProperty('--mouse-x', `${x}%`);
            element.style.setProperty('--mouse-y', `${y}%`);
        };

        element.addEventListener('mousemove', handleMouseMove);
        return () => element.removeEventListener('mousemove', handleMouseMove);
    }, []);
    
    return (
        <div 
            ref={folderRef}
            className="relative liquid-glass-folder rounded-[22px] overflow-hidden"
            style={{ 
                width: `${iconSize}px`, 
                height: `${iconSize}px`,
                padding: `${padding}px`
            }}
        >
            <div className="glass-refraction" />
            <div className="w-full h-full grid grid-cols-3 gap-1 content-start relative z-10">
                {previewItems.map((item, index) => (
                    <MiniIcon key={item.id || index} item={item} />
                ))}
            </div>
        </div>
    );
};

export default FolderIcon;
