import { useEffect, useRef, useState } from "react";
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/16/solid";
import { Button } from "./Button";

type Option = { key: string; value: string };
type Props = {
  options: Option[];
  onClick: (value: string, index: number) => void;
  children: React.ReactNode;
};

export const DropdownButton = ({ options, onClick, children }: Props) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on Escape and on any click outside the menu, so the popup doesn't
  // linger after the user has moved on.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  const handleClick = (value: string, index: number) => {
    onClick(value, index);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="group">
      <div className="relative">
        <Button
          aria-expanded={open}
          aria-haspopup="listbox"
          disabled={options.length === 0}
          className={`rounded-t-lg ${open || "rounded-b-lg"} flex items-center`}
          onClick={() => setOpen(!open)}
        >
          {children}
          {open ? <ChevronUpIcon className="-mr-1 ml-2 h-5 w-5" /> : <ChevronDownIcon className="-mr-1 ml-2 h-5 w-5" />}
        </Button>
        <div
          role="listbox"
          className={`absolute bg-gray-700 rounded-lg transition-all w-full border-t-2 border-t-gray-800 overflow-hidden ${
            open ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          {options.map(({ key, value }, i) => (
            <button
              key={key}
              role="option"
              aria-selected={false}
              className="text-white text-xs block w-full justify-center px-2 py-1 hover:bg-gray-800 transition-colors duration-100"
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
