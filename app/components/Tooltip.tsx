import { InformationCircleIcon } from "@heroicons/react/24/solid";
import { useMemo, type PropsWithChildren } from "react";

export const Tooltip = ({ children }: PropsWithChildren) => {
    return (<span className="p-2 bg-gray-700 text-white text-xs rounded">
        {children}
    </span>)
}

type WrapperProps = {
    children: React.ReactNode;
    tooltip: string | React.ReactNode;
};

export const TooltipWrapper = ({ children, tooltip }: WrapperProps) => {
    const Content = useMemo(() => {
        return typeof tooltip === 'string' ? <Tooltip>{tooltip}</Tooltip> : tooltip;
    }, [tooltip]);
    return (
        <span className="relative group">
            <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-max max-w-xs pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                {Content}
            </span>
            {children}
        </span>
    );
}
export const HelpTooltip = ({ children, tooltip }: WrapperProps) => {
    const Content = useMemo(() => {
        return typeof tooltip === 'string' ? <Tooltip>{tooltip}</Tooltip> : tooltip;
    }, [tooltip]);

    return (
        <span className="relative">
            <span className="absolute group text-gray-400 hover:text-gray-200 -right-3 -top-1 cursor-help print:hidden">
                <span className="relative">
                    <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-max max-w-xs pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        {Content}
                    </span>
                </span>
                <InformationCircleIcon className="h-3" />
            </span>
            {children}
        </span>
    );
}