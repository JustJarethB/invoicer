import type { ComponentPropsWithoutRef } from "react";

export const Button = ({ children, onClick }: ComponentPropsWithoutRef<'button'>) => (
    <div className="p-2">
        <button className="p-2 px-4 rounded-lg hover:bg-gray-600 ring-2 ring-white hover:ring-gray-900 bg-gray-700 text-white font-bold" type="button" onClick={onClick}>{children}</button>
    </div>
);
