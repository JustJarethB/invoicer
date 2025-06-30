import { useState } from 'react';
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/16/solid";


type Option = { key: string; value: string };
type Props = {
    options: Option[];
    onClick: (value: string, index: number) => void;
    children: React.ReactNode;
};

export const DropdownButton = ({ options, onClick, children }: Props) => {
    const [open, setOpen] = useState(false);

    const handleClick = (value: string, index: number) => {
        onClick(value, index);
        setOpen(false);
    };

    return (
        <div className="group">
            <div className="relative">
                <button
                    type="button"
                    disabled={options.length === 0}
                    className={`p-2 px-4 rounded-t-lg ${open || 'rounded-b-lg'} transition-all group-hover:bg-gray-600 ring-2 ring-white group-hover:ring-gray-900 bg-gray-700 text-white font-bold flex items-center`}
                    onClick={() => setOpen(!open)}
                >
                    {children}
                    {open ? (
                        <ChevronUpIcon className="-mr-1 ml-2 h-5 w-5" />
                    ) : (
                        <ChevronDownIcon className="-mr-1 ml-2 h-5 w-5" />
                    )}
                </button>
                <div
                    className={`absolute bg-gray-700 rounded-b-lg transition-all w-full ring-2 ring-white group-hover:ring-gray-900 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'
                        }`}
                >
                    {options.map(({ key, value }, i) => (
                        <button
                            key={key}
                            className="text-white text-xs block w-full justify-center px-2 py-1 hover:bg-gray-600"
                            type="button"
                            value={value}
                            onClick={() => handleClick(value, i)}
                        >
                            {key}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};
