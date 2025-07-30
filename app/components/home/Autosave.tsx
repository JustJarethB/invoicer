import { ArrowPathIcon } from "@heroicons/react/16/solid";
import { useState, type PropsWithChildren } from "react";
import { Tooltip } from "../Tooltip";
import { db } from "~/db";
import { formJson } from "~/utils/formJson";
type Props = {
    name: string;
    hideIcon?: boolean;
    onChange?: ((newState: Record<string, string>) => void)
}

export const Autosave = ({ children, name, hideIcon, onChange: onChangeParent }: PropsWithChildren<Props>) => {
    const [isSaving, setIsSaving] = useState(false);
    const onChange = async (e: React.ChangeEvent<HTMLFormElement>) => {
        const data: Record<string, string> = await formJson(e.currentTarget);
        onChangeParent?.(data);
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