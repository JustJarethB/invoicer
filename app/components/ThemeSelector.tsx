import { SunIcon, ComputerDesktopIcon, MoonIcon } from "@heroicons/react/24/outline";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type MouseEventHandler, type PropsWithChildren } from "react";

const Option = ({ children, active, onClick }: PropsWithChildren<{ active?: boolean, onClick: MouseEventHandler<HTMLDivElement> }>) => (
    <div onClick={onClick} className={"transition-colors duration-100 p-1 flex justify-center items-center" + (active ? " bg-gray-300 dark:bg-gray-600" : " cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700")}>
        <div className="h-6 w-6 inline-block">
            {children}
        </div>
    </div>
);

export type Theme = 'light' | 'dark' | 'system';

export const ThemeSelector = () => {
    const theme = useTheme();
    const setTheme = useSetTheme();
    const onClick = (newTheme: Theme) => () => setTheme(newTheme);
    return (
        <div className="w-full rounded-full border-1 border-gray-300 dark:border-gray-600 overflow-hidden grid grid-cols-3">
            <Option onClick={onClick('light')} active={theme === 'light'}>
                <SunIcon />
            </Option>
            <Option onClick={onClick('system')} active={theme === 'system'}>
                <ComputerDesktopIcon />
            </Option>
            <Option onClick={onClick('dark')} active={theme === 'dark'}>
                <MoonIcon />
            </Option>
        </div>);
}

type ThemeContextType = {
    theme: Theme;
    setTheme: (theme: Theme) => void;

};

const ThemeContext = createContext<ThemeContextType>({ theme: 'light', setTheme: () => { } });

export const ThemeProvider = ({ children }: PropsWithChildren) => {
    const ref = useRef<HTMLDivElement>(null);
    const [theme, setTheme] = useState<Theme>('system');
    const themeValue = useMemo(() => {
        switch (theme) {
            case 'dark': return 'dark';
            case 'light': return 'light'
            case 'system': return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
    }, [theme]);
    useEffect(() => {
        if (!ref.current) return;
        ref.current.ownerDocument.body.parentElement?.setAttribute('data-theme', themeValue);
    }, [themeValue])
    return <ThemeContext.Provider value={{ theme, setTheme }}><div ref={ref} className={themeValue == 'dark' ? 'scheme-light-dark' : 'scheme-light'}>{children}</div></ThemeContext.Provider>;
}
export const useTheme = () => useContext(ThemeContext).theme;
export const useSetTheme = () => useContext(ThemeContext).setTheme;
