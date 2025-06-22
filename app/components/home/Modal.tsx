import type { PropsWithChildren } from "react";
import { Button } from "./Button";

type Props = {
    title: string;
    onClose: () => void;
}
export const Modal = ({ children, onClose, title }: PropsWithChildren<Props>) => {
    const onBackgroundClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target !== e.currentTarget) return
        onClose();
    }
    return (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50" onClick={onBackgroundClick}>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-md w-full">
                <h2 className="text-xl font-bold mb-4">{title}</h2>
                {children}
            </div>
        </div>
    );
}