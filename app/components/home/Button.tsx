import type { ComponentPropsWithoutRef } from "react";
type ButtonProps = {
    color?: 'primary' | 'secondary' | 'danger' | 'success' | 'default';
    icon?: boolean;
    size?: 'sm' | 'md' | 'lg';
}
const getColorClassName = (type: ButtonProps['color']) => {
    switch (type) {
        case 'primary':
            return 'bg-amber-600 hover:bg-amber-700 text-white';
        case 'secondary':
            return 'bg-gray-600 hover:bg-gray-700 text-white';
        case 'danger':
            return 'bg-red-600 hover:bg-red-700 text-white';
        case 'success':
            return 'bg-green-600 hover:bg-green-700 text-white';
        default:
            return 'bg-gray-700 hover:bg-gray-800 text-white';
    }
}

const getSizeClassName = (icon: boolean, size: ButtonProps['size']) => {

    switch (size) {
        case 'sm':
            return `rounded-md p-0.5 ${!icon && "px-2"}`
        case 'md':
            return `rounded-lg p-2 ${!icon && 'px-4'}`
        case `lg`:
            return `rounded-lg p-3 ${!icon && 'px-6'}`
    }
}

export const Button = ({ children, onClick, color, icon = false, size = 'md', className, ...rest }: ComponentPropsWithoutRef<'button'> & ButtonProps) => (
    <button {...rest} className={`${getSizeClassName(icon, size)} font-bold transition-all duration-200 cursor-pointer disabled:cursor-auto disabled:pointer-events-none ${getColorClassName(color)} ${className}`} onClick={onClick}>{children}</button>
);
