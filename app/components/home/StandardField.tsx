import type { ComponentPropsWithoutRef } from "react";
import { TextInput, NumberInput } from "~/components/Inputs";

export const StandardField = ({ title, className, parentClass, ...rest }: ComponentPropsWithoutRef<typeof TextInput> & { title: string; parentClass?: string; }) => (
    <div className={`flex justify-between ${parentClass}`}>
        <p className="font-bold px-2">{title}</p>
        <TextInput className={`w-1/2 ${className}`} {...rest} />
    </div>

);

const normaliseSortCode = (value: string) => {
    // remove spaces, separate every 2
    const newValue = value.replace(/\s/g, "").match(/.{1,2}/g)?.join(" ") ?? value
    console.log('normalise triggered. newValue: ', newValue);
    return newValue;
}

const normaliseAccountNumber = (value: string) => {
    // remove spaces, separate every 4
    const newValue = value.replace(/\s/g, "").match(/.{1,4}/g)?.join(" ") ?? value
    console.log('normalise triggered. newValue: ', newValue);
    return newValue;
}

export const BankField = ({ title, className, parentClass, type, ...rest }: ComponentPropsWithoutRef<typeof TextInput> & { title: string; parentClass?: string; type: "sort" | "account"}) => {
    return <div className={`flex justify-between ${parentClass}`}>
        <p className="font-bold px-2">{title}</p>
        <NumberInput
            className={`w-1/2 ${className}`}
            {...rest}
            onChange={(value) => type == "sort" ? normaliseSortCode(value) : normaliseAccountNumber(value)}
            />
    </div>
}