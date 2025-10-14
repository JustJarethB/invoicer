import { useCallback, useMemo, type ComponentPropsWithoutRef } from "react";
import { TextInput } from "~/components/Inputs";

export const StandardField = ({ title, className, parentClass, ...rest }: ComponentPropsWithoutRef<typeof TextInput> & { title: string; parentClass?: string; }) => (
    <div className={`flex justify-between ${parentClass}`}>
        <p className="font-bold px-2">{title}</p>
        <TextInput className={`w-1/2 ${className}`} {...rest} />
    </div>

);

const normaliseField = (grouping: number | undefined) => (value: string,) => {
    if (!grouping) return value
    const regex = new RegExp(`.{1,${grouping}}`, "g");
    return value
        .replace(/\s+/g, "")
        .match(regex)
        ?.join(" ")
        ?? value
}

export const BankField = ({ title, className, parentClass, type, ...rest }: ComponentPropsWithoutRef<typeof TextInput> & { title: string; parentClass?: string; type: "sort" | "account" }) => {
    const reg = useMemo(() => (
        type == "sort" ? { grouping: 2, maxChars: 8 }
            : type == "account" ? { grouping: 4, maxChars: 9 }
                : { grouping: undefined, maxChars: undefined }),
        [type]);


    const placeholder = type == "sort" ? "12 12 12" : type == "account" ? "1234 1234" : undefined
    const normalise = useCallback(normaliseField(reg.grouping), [reg.grouping])
    return <div className={`flex justify-between ${parentClass}`}>
        <p className="font-bold px-2">{title}</p>
        <TextInput
            className={`w-1/2 ${className}`}
            maxLength={reg.maxChars}
            placeholder={placeholder}
            {...rest}
            formatOnChange={normalise}
        />
    </div>
}