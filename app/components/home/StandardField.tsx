import { type ComponentPropsWithoutRef } from "react";
import { formatterOf, TextInput, type Formatter } from "~/components/Inputs";

export const StandardField = ({ title, className, parentClass, ...rest }: ComponentPropsWithoutRef<typeof TextInput> & { title: string; parentClass?: string; }) => (
    <div className={`flex justify-between ${parentClass}`}>
        <p className="font-bold px-2">{title}</p>
        <TextInput className={`w-1/2 ${className}`} {...rest} />
    </div>

);

type FieldType = 'sortCode' | 'accountNumber'

export const fieldFormattingOf = (type: FieldType): Formatter => {
    switch (type) {
        case "sortCode":
            return formatterOf({ maxChars: 6, grouping: 2, spacer: "-" })
        case "accountNumber":
            return formatterOf({ maxChars: 8, grouping: 4, spacer: " " })
        default: return { maxLength: undefined, formatOnChange: undefined }
    }
}