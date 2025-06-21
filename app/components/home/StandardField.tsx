import type { ComponentPropsWithoutRef } from "react";
import { TextInput } from "~/components/Inputs";

export const StandardField = ({ title, className, parentClass, ...rest }: ComponentPropsWithoutRef<typeof TextInput> & { title: string; parentClass?: string; }) => (
    <div className={`flex justify-between ${parentClass}`}>
        <p className="font-bold px-2">{title}</p>
        <TextInput className={`w-1/2 ${className}`} {...rest} />
    </div>

);
