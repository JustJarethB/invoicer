import type { ComponentPropsWithoutRef } from "react";
type ButtonProps = {
    color?: 'primary' | 'secondary' | 'danger';
}
const getClassName = (type: ButtonProps['color']) => {
    switch (type) {
        case 'primary':
            return 'bg-amber-500 hover:bg-amber-600 text-white';
        case 'secondary':
            return 'bg-gray-500 hover:bg-gray-600 text-white';
        case 'danger':
            return 'bg-red-500 hover:bg-red-600 text-white';
        default:
            return 'bg-gray-700 hover:bg-gray-800 text-white';
    }
}

export const Button = ({ children, onClick, color }: ComponentPropsWithoutRef<'button'> & ButtonProps) => (
    <div className="p-2">
        <button className={`p-2 px-4 rounded-lg font-bold ${getClassName(color)}`} type="button" onClick={onClick}>{children}</button>
    </div>
);
