import { useState, type ComponentPropsWithoutRef, type PropsWithChildren } from "react";
import "./index.css"

const Prefix = ({ children }: PropsWithChildren) => {
    if (!children) return null;
    return (
        <div className="pl-3 flex items-center pointer-events-none">
            <span className="text-gray-500">{children}</span>
        </div>
    )
}
const Suffix = ({ children }: PropsWithChildren) => {
    if (!children) return null;
    return (
        <div className="pr-3 flex items-center pointer-events-none">
            <span className="text-gray-500">{children}</span>
        </div>
    )
}

type InputWrapperProps = PropsWithChildren<{
    className: string;
    prefix?: string;
    suffix?: string;
}>;

const InputWrapper = ({ className, prefix, suffix, children }: InputWrapperProps) => (
    <div className={`${className} ${(prefix || suffix || true) && 'relative'}`}>
        <div className="flex rounded-lg dark:focus-within:bg-black focus-within:bg-white  focus-within:ring-2 focus-within:ring-gray-300 dark:focus-within:ring-gray-800">
            <Prefix children={prefix} />
            {children}
            <Suffix children={suffix} />
        </div>
    </div>
)

type InputProps<T extends 'textarea' | 'input'> = Omit<ComponentPropsWithoutRef<T>, 'onChange'> & Pick<InputWrapperProps, 'prefix' | "suffix"> & { onChange?: (value: string) => void };
export const TextInput = ({ placeholder = '', value, defaultValue, onChange, className = "", prefix, suffix, ...rest }: InputProps<'textarea'>) => {
    const [_value, setValue] = useState(value ?? defaultValue ?? '');
    const rex = (`${_value}`.match(new RegExp(/\n/g)) || []).length;
    const rows = rex + 1;
    const onChangeHandler = (v: string) => {
        setValue(v);
        onChange?.(v);
    }
    return (
        <InputWrapper {...{ className, prefix, suffix }}>
            <textarea disabled={rest.disabled ?? rest.readOnly} tabIndex={0} style={{ fontWeight: 'inherit' }} className={`p-1 placeholder:opacity-60 w-full block bg-transparent outline-none print:placeholder-transparent resize-none ${''}`} {...{ value, defaultValue, placeholder, ...rest }} onChange={e => onChangeHandler(e.currentTarget.value)} rows={rows} />
        </InputWrapper>
    )

}
export const DateInput = ({ placeholder = '', value, defaultValue, onChange, className = "", prefix, suffix, ...rest }: InputProps<'input'>) => {
    const val = value ?? defaultValue
    const rex = (`${val}`.match(new RegExp(/\n/g)) || []).length;
    const rows = rex + 1;
    return (
        <InputWrapper {...{ className, prefix, suffix }}>
            <input type="date" disabled={rest.disabled ?? rest.readOnly} tabIndex={0} style={{ fontWeight: 'inherit' }} className={`p-1 placeholder:opacity-60 w-full block bg-transparent outline-none resize-none ${val ? '' : 'text-gray-400 print:hidden'}`} {...{ value, defaultValue, placeholder, ...rest }} onChange={e => onChange?.(e.currentTarget.value)} />
        </InputWrapper>
    )

}
export const SelectInput = ({ placeholder = '', value = "", onChange, className = "", prefix, suffix, options = [], ...rest }: InputProps<'input'> & { options: string[] | { label: string, value: string | number | undefined, disabled?: boolean }[] }) => {
    const optionsToUse = options.map(v => typeof v !== 'string' ? v : ({ label: v, value: v }));
    if (!value) {
        optionsToUse.unshift({ label: "---", value: "", disabled: true });
    }
    return (
        <InputWrapper {...{ className, prefix, suffix }}>
            <select disabled={rest.disabled ?? rest.readOnly} tabIndex={0} style={{ fontWeight: 'inherit' }} className={`p-1 placeholder:opacity-60 w-full block bg-transparent outline-none appearance-none ${value ? '' : 'text-gray-400 print:hidden'}`} {...{ value, placeholder }} onChange={e => onChange?.(e.currentTarget.value)}>
                {optionsToUse.map(({ label, value: v, disabled = false }) => <option key={v} disabled={disabled} value={v}>{label}</option>)}
            </select>
        </InputWrapper>
    )

}