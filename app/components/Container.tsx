import type { PropsWithChildren } from "react";

export const Container = ({ children, className }: PropsWithChildren<{ className?: string }>) => {
    return (
        <div className={"p-2 w-full box-border ring-4 dark:ring-gray-800 ring-gray-300 rounded-sm" + (className ? ` ${className}` : "")}>
            {children}
        </div>
    );
}