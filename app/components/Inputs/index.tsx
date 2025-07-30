import { useEffect, useRef, useState, type ComponentPropsWithoutRef, type PropsWithChildren } from "react";
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
export const TextInput = ({ placeholder = '---', value, defaultValue, onChange, className = "", prefix, suffix, ...rest }: InputProps<'textarea'>) => {
    const ref = useRef<HTMLTextAreaElement>(null)
    useEffect(() => {
        updateHeight()
    }, [value, defaultValue])
    const updateHeight = () => {
        if (!ref.current) return
        ref.current.style.height = 'auto'; // Reset height to auto to calculate scrollHeight correctly
        ref.current.style.height = ref.current.scrollHeight + 'px'; // Adjust height to fit content
    }
    const onChangeHandler = (v: string) => {
        onChange?.(v);
        updateHeight()
    }
    return (
        <InputWrapper {...{ className, prefix, suffix }}>
            <textarea ref={ref} disabled={rest.disabled ?? rest.readOnly} tabIndex={0} style={{ fontWeight: 'inherit' }} className={`p-1 placeholder:opacity-60 w-full block bg-transparent outline-none print:placeholder-transparent resize-none ${''}`} {...{ value, defaultValue, placeholder, ...rest }} onChange={e => onChangeHandler(e.currentTarget.value)} rows={1} />
        </InputWrapper>
    )

}
export const DateInput = ({ placeholder = '', value, defaultValue, onChange, className = "", prefix, suffix, ...rest }: InputProps<'input'>) => {
    const val = value ?? defaultValue
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
type ImageInputProps = ComponentPropsWithoutRef<'img'> & {
    placeholder?: string;
    value?: string;
    defaultValue?: string;
    onChange?: (value: string) => void;
} & Pick<InputProps<'input'>, 'name'>;
export const ImageInput = ({ placeholder = 'https://via.placeholder.com/150', value, defaultValue, onChange, name, className = "", ...rest }: ImageInputProps) => {
    const [imageSrc, setImageSrc] = useState(value || defaultValue);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const handleImageClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
        const file = e.target.files?.[0];
        if (!file) return console.warn("No file selected");
        setImageSrc(URL.createObjectURL(file));
    }
    return (
        <>
            <img
                src={imageSrc ?? placeholder}
                alt="Upload"
                {...rest}
                onClick={handleImageClick}
                className={`${className} cursor-pointer`}
            />
            <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                name={name}
                style={{ display: 'none' }}
                onChange={handleFileChange}
            />

        </>
    );
};