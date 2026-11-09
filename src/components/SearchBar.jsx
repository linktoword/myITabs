import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';
import { loadDisplayIcon } from '../utils/icons';
import { fetchBaiduSuggestions } from '../utils/baiduSuggest';
import { openInNewTab } from '../utils/openUrl';

const SEARCH_ENGINES = {
    google: {
        name: 'Google',
        url: 'https://www.google.com/search?q=',
        icon: 'https://www.google.com/s2/favicons?domain=google.com&sz=128'
    },
    baidu: {
        name: 'Baidu',
        url: 'https://www.baidu.com/s?wd=',
        icon: 'https://www.google.com/s2/favicons?domain=baidu.com&sz=128'
    },
    bing: {
        name: 'Bing',
        url: 'https://www.bing.com/search?q=',
        icon: 'https://www.google.com/s2/favicons?domain=bing.com&sz=128'
    },
    duckduckgo: {
        name: 'DuckDuckGo',
        url: 'https://duckduckgo.com/?q=',
        icon: 'https://www.google.com/s2/favicons?domain=duckduckgo.com&sz=128'
    }
};

const SUGGEST_DELAY_MS = 100;

/** 两次输入仍属于同一串词时，先留着上一批联想，避免面板闪一下 */
const isRelatedQuery = (current, previous) => {
    if (!current || !previous) return false;
    return current.startsWith(previous) || previous.startsWith(current);
};

/** 已输入的部分稍淡，补全部分更清楚。浅色毛玻璃上用深色字 */
const SuggestionText = ({ text, keyword }) => {
    const needle = keyword.trim();
    const matched = needle && text.toLowerCase().startsWith(needle.toLowerCase());
    if (!matched) {
        return <span className="text-black/80">{text}</span>;
    }
    return (
        <>
            <span className="text-black/45">{text.slice(0, needle.length)}</span>
            <span className="text-black/85">{text.slice(needle.length)}</span>
        </>
    );
};

const SearchBar = () => {
    const [query, setQuery] = useState('');
    const [engine, setEngine] = useState(() => {
        return localStorage.getItem('default_search_engine') || 'google';
    });
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [engineIcons, setEngineIcons] = useState({});
    const [suggestions, setSuggestions] = useState([]);
    const [suggestionsQuery, setSuggestionsQuery] = useState('');
    const [suggestOpen, setSuggestOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const [isComposing, setIsComposing] = useState(false);
    const dropdownRef = useRef(null);
    const formRef = useRef(null);
    const inputRef = useRef(null);
    const listRef = useRef(null);
    const optionRefs = useRef([]);
    const dismissedRef = useRef(false);

    useEffect(() => {
        let alive = true;
        const blobUrls = [];

        const loadEngineIcons = async () => {
            const entries = await Promise.all(Object.entries(SEARCH_ENGINES).map(async ([key, data]) => {
                const src = await loadDisplayIcon(data.icon);
                return [key, src || data.icon];
            }));
            if (!alive) {
                entries.forEach(([, src]) => {
                    if (typeof src === 'string' && src.startsWith('blob:')) URL.revokeObjectURL(src);
                });
                return;
            }
            entries.forEach(([, src]) => {
                if (typeof src === 'string' && src.startsWith('blob:')) blobUrls.push(src);
            });
            setEngineIcons(Object.fromEntries(entries));
        };

        loadEngineIcons();
        return () => {
            alive = false;
            blobUrls.forEach((item) => URL.revokeObjectURL(item));
        };
    }, []);

    useEffect(() => {
        const handlePointerDown = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
            }
            if (formRef.current && !formRef.current.contains(event.target)) {
                dismissedRef.current = true;
                setSuggestOpen(false);
            }
        };

        document.addEventListener('pointerdown', handlePointerDown);
        return () => document.removeEventListener('pointerdown', handlePointerDown);
    }, []);

    useEffect(() => {
        if (isComposing) return undefined;

        const keyword = query.trim();
        if (!keyword) {
            dismissedRef.current = false;
            return undefined;
        }

        dismissedRef.current = false;
        const controller = new AbortController();
        const timer = setTimeout(async () => {
            try {
                const list = await fetchBaiduSuggestions(keyword, controller.signal);
                if (controller.signal.aborted) return;
                setSuggestions(list);
                setSuggestionsQuery(keyword);
                setActiveIndex(-1);
                const inputFocused = document.activeElement === inputRef.current;
                setSuggestOpen(inputFocused && !dismissedRef.current && list.length > 0);
            } catch (error) {
                if (error?.name === 'AbortError') return;
                setSuggestions([]);
                setSuggestOpen(false);
            }
        }, SUGGEST_DELAY_MS);

        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [query, isComposing]);

    useEffect(() => {
        const option = optionRefs.current[activeIndex];
        const list = listRef.current;
        if (!option || !list || activeIndex < 0) return;
        const top = option.offsetTop;
        const bottom = top + option.offsetHeight;
        if (top < list.scrollTop) {
            list.scrollTop = top;
        } else if (bottom > list.scrollTop + list.clientHeight) {
            list.scrollTop = bottom - list.clientHeight;
        }
    }, [activeIndex]);

    const keyword = query.trim();
    // 列表已经打开时，继续输入或打拼音都先留着，等新结果回来再替换
    const showSuggestions = suggestOpen && suggestions.length > 0 && (isComposing || Boolean(keyword));

    const goSearch = (text) => {
        const nextQuery = text.trim();
        if (!nextQuery) return;
        const searchUrl = SEARCH_ENGINES[engine].url + encodeURIComponent(nextQuery);
        openInNewTab(searchUrl);
    };

    const handleSearch = (event) => {
        event.preventDefault();
        goSearch(query);
    };

    const handleEngineSelect = (engineKey) => {
        setEngine(engineKey);
        localStorage.setItem('default_search_engine', engineKey);
        setIsDropdownOpen(false);
        inputRef.current?.focus();
    };

    const handleKeyDown = (event) => {
        if (isComposing || event.nativeEvent.isComposing || event.keyCode === 229) return;

        if (event.key === 'ArrowDown') {
            if (!suggestions.length) return;
            event.preventDefault();
            dismissedRef.current = false;
            setSuggestOpen(true);
            setActiveIndex((index) => Math.min(index + 1, suggestions.length - 1));
            return;
        }

        if (event.key === 'ArrowUp') {
            if (!showSuggestions) return;
            event.preventDefault();
            setActiveIndex((index) => Math.max(index - 1, -1));
            return;
        }

        if (event.key === 'Escape' && showSuggestions) {
            event.preventDefault();
            dismissedRef.current = true;
            setSuggestOpen(false);
            setActiveIndex(-1);
            return;
        }

        if (event.key === 'Enter' && showSuggestions && activeIndex >= 0) {
            event.preventDefault();
            goSearch(suggestions[activeIndex]);
        }
    };

    return (
        <form ref={formRef} onSubmit={handleSearch} className="w-full max-w-2xl mb-4 relative z-30">
            <div className="relative group flex items-center">
                {/* Search Engine Selector */}
                <div className="absolute left-2 z-40" ref={dropdownRef}>
                    <button
                        type="button"
                        onClick={() => {
                            setIsDropdownOpen(!isDropdownOpen);
                            dismissedRef.current = true;
                            setSuggestOpen(false);
                        }}
                        className="flex items-center gap-2 p-2 rounded-full hover:bg-white/10 transition-colors"
                    >
                        {engineIcons[engine] && (
                            <img
                                src={engineIcons[engine]}
                                alt={SEARCH_ENGINES[engine].name}
                                className="w-6 h-6 rounded-full shadow-sm"
                            />
                        )}
                        <ChevronDown className="w-3 h-3 text-white/50" />
                    </button>

                    {/* Dropdown Menu */}
                    {isDropdownOpen && (
                        <div className="absolute top-full left-0 mt-2 w-48 py-1 bg-black/80 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden">
                            {Object.entries(SEARCH_ENGINES).map(([key, data]) => (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => handleEngineSelect(key)}
                                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/10 transition-colors text-left"
                                >
                                    {engineIcons[key] && (
                                        <img
                                            src={engineIcons[key]}
                                            alt={data.name}
                                            className="w-5 h-5 rounded-full"
                                        />
                                    )}
                                    <span className="flex-1 text-sm text-white font-medium">{data.name}</span>
                                    {engine === key && (
                                        <Check className="w-4 h-4 text-blue-400" />
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <input
                    ref={inputRef}
                    type="text"
                    role="combobox"
                    aria-expanded={showSuggestions}
                    aria-controls="search-suggestions"
                    aria-autocomplete="list"
                    aria-activedescendant={showSuggestions && activeIndex >= 0 ? `search-suggestion-${activeIndex}` : undefined}
                    autoComplete="off"
                    spellCheck={false}
                    value={query}
                    onCompositionStart={() => setIsComposing(true)}
                    onCompositionEnd={(event) => {
                        setIsComposing(false);
                        const nextQuery = event.target.value;
                        setQuery(nextQuery);
                        if (!nextQuery.trim()) {
                            setSuggestions([]);
                            setSuggestionsQuery('');
                            setSuggestOpen(false);
                            setActiveIndex(-1);
                        }
                    }}
                    onChange={(event) => {
                        const nextQuery = event.target.value;
                        setQuery(nextQuery);
                        if (isComposing || event.nativeEvent.isComposing) return;
                        if (!nextQuery.trim()) {
                            setSuggestions([]);
                            setSuggestionsQuery('');
                            setSuggestOpen(false);
                            setActiveIndex(-1);
                        }
                    }}
                    onKeyDown={handleKeyDown}
                    onFocus={() => {
                        if (suggestions.length && isRelatedQuery(keyword.toLowerCase(), suggestionsQuery.trim().toLowerCase())) {
                            dismissedRef.current = false;
                            setSuggestOpen(true);
                        }
                    }}
                    className="block w-full pl-20 pr-4 py-2 bg-black/20 hover:bg-black/30 
                     border border-white/10 rounded-full 
                     text-white placeholder-white/70 focus:outline-none focus:bg-black/40 
                     focus:ring-2 focus:ring-white/20 focus:border-transparent backdrop-blur-xl
                     transition-all duration-300 shadow-lg text-lg"
                    placeholder={`Search ${SEARCH_ENGINES[engine].name}...`}
                />
            </div>

            {showSuggestions && (
                <div className="suggest-panel absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-[18px]">
                    <div
                        id="search-suggestions"
                        ref={listRef}
                        role="listbox"
                        className="suggest-list max-h-[min(360px,calc(70vh-48px))] overflow-y-auto py-1.5"
                    >
                        {suggestions.map((text, index) => (
                            <button
                                key={text}
                                id={`search-suggestion-${index}`}
                                ref={(node) => {
                                    optionRefs.current[index] = node;
                                }}
                                type="button"
                                role="option"
                                aria-selected={index === activeIndex}
                                onMouseDown={(event) => event.preventDefault()}
                                onMouseEnter={() => setActiveIndex(index)}
                                onMouseLeave={() => setActiveIndex((current) => (current === index ? -1 : current))}
                                onClick={() => goSearch(text)}
                                className={`flex w-full cursor-pointer items-center gap-2.5 px-4 py-1.5 text-left text-sm leading-5 tracking-normal transition-colors duration-150 active:bg-black/[0.06] ${index === activeIndex ? 'bg-black/[0.04]' : ''}`}
                            >
                                <Search className="h-3.5 w-3.5 shrink-0 text-black/40" />
                                <span className="truncate">
                                    <SuggestionText text={text} keyword={keyword} />
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </form>
    );
};

export default SearchBar;
