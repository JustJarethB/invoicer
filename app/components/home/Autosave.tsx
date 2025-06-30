import { ArrowPathIcon } from "@heroicons/react/16/solid";
import { useState, type PropsWithChildren } from "react";
import { Tooltip } from "../Tooltip";
import { db } from "~/db";
type Props = {
    name: string;
    hideIcon?: boolean;
}

const processors = {
    'base64': async (value: unknown) => {
        if (!(value instanceof Blob)) {
            throw new Error("Value is not a Blob");
        }
        const reader = new FileReader();
        return new Promise<string>((resolve, reject) => {
            reader.onloadend = () => {
                const base64 = reader.result;
                if (typeof base64 !== 'string') {
                    reject(new Error("FileReader result is not a string"));
                } else {
                    resolve(base64);
                }
            };
            reader.onerror = () => reject(new Error("Error reading file"));
            reader.readAsDataURL(value);
        });
    }
}
const process = async (value: string | Blob, type: string): Promise<string> => {
    if (type in processors) {
        return await processors[type as keyof typeof processors](value as Parameters<typeof processors[keyof typeof processors]>[0]);
    }
    return value as string;
}

export const Autosave = ({ children, name, hideIcon }: PropsWithChildren<Props>) => {
    const [isSaving, setIsSaving] = useState(false);
    const onChange = async (e: React.ChangeEvent<HTMLFormElement>) => {
        const formData = new FormData(e.currentTarget);
        const data: Record<string, string> = {};
        for (const [key, value] of formData.entries()) {
            if (value instanceof Blob) {
                const processedValue = await process(value, 'base64');
                data[key] = processedValue;
            } else {
                // Regular string values
                data[key] = value as string;
            }
        }
        setIsSaving(true);
        await db.save([name], data)
        setIsSaving(false);
    }
    return (
        <form onChange={onChange} className="relative">
            <span className={`${hideIcon && "hidden"} absolute top-1 right-1 print:hidden`}>
                <Tooltip title="These values are stored locally for next time" >
                    <ArrowPathIcon className={`${isSaving ? "text-amber-400 animate-spin" : "text-blue-400"} opacity-50 transition-transform delay-300 h-5 w-5 cursor-help`} />
                </Tooltip>
            </span>
            {children}
        </form>
    );
}