import type { ComponentPropsWithoutRef } from "react";
type ButtonProps = {
    color?: 'primary' | 'secondary' | 'danger' | 'success' | 'default' | 'warning';
    icon?: boolean;
    size?: 'sm' | 'md' | 'lg';
    outline?: boolean;
}
const getColorClassName = (type: ButtonProps['color']) => {
    switch (type) {
        case 'primary':
        case 'warning':
            return 'bg-amber-600 dark:bg-amber-700 dark:hover:bg-amber-800 hover:bg-amber-700 text-white dark:[.ring]:text-amber-700 [.ring]:text-amber-600';
        case 'secondary':
            return 'bg-gray-600 hover:bg-gray-700 text-white';
        case 'danger':
            return 'bg-red-600 dark:bg-red-800 hover:bg-red-700 text-white dark:[.ring]:text-red-800 [.ring]:text-red-600 [.ring]:hover:text-red-700';
        case 'success':
            return 'bg-green-600 dark:bg-green-800 hover:bg-green-700 text-white dark:[.ring]:text-green-800 [.ring]:text-green-600';
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

export const Button = ({ children, onClick, color, icon = false, outline = false, size = 'md', className, ...rest }: ComponentPropsWithoutRef<'button'> & ButtonProps) => (
    <button {...rest} className={`${getSizeClassName(icon, size)} ${outline && "ring !bg-transparent"} font-bold transition-all duration-200 cursor-pointer disabled:cursor-auto disabled:pointer-events-none ${getColorClassName(color)} ${className}`} onClick={onClick}>{children}</button>
);
