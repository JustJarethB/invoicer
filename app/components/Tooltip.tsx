export const Tooltip = ({ children, title }: { children: React.ReactNode; title: string }) => {
    return (
        <span className="relative group">
            <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-max max-w-xs p-2 bg-gray-700 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                {title}
            </span>
            {children}
        </span>
    );
}