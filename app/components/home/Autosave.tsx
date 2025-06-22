import { ArrowPathIcon } from "@heroicons/react/16/solid";
import { useState, type PropsWithChildren } from "react";
import { Tooltip } from "../Tooltip";
import { db } from "~/db";
type Props = {
    name: string;
    hideIcon?: boolean;
}
export const Autosave = ({ children, name, hideIcon }: PropsWithChildren<Props>) => {
    const [isSaving, setIsSaving] = useState(false);
    const onChange = async (e: React.ChangeEvent<HTMLFormElement>) => {
        const formData = new FormData(e.currentTarget);
        const data: Record<string, string> = {};
        formData.forEach((value, key) => {
            data[key] = value as string;
        });
        setIsSaving(true);
        await db.save([name], data)
        setIsSaving(false);
    }
    return (
        <form onChange={onChange} className="relative">
            <span className={`${hideIcon && "hidden"} absolute top-1 right-1 print:hidden`}>
                <Tooltip title="These values are stored locally for next time" >
                    <ArrowPathIcon className={`${isSaving ? "text-amber-400 animate-spin" : "text-blue-400"} h-5 w-5 cursor-help`} />
                </Tooltip>
            </span>
            {children}
        </form>
    );
}