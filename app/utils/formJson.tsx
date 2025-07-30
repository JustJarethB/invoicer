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
const getProcessedValue = (value: string | Blob): Promise<string> => {
    if (value instanceof Blob) {
        return process(value, 'base64');
    }
    return Promise.resolve(value as string);
}

export const formJson = async <T extends {}>(form: HTMLFormElement): Promise<T> => {
    const formData = new FormData(form);
    const data: Record<string, string> = {};
    for (const [key, value] of formData) {
        data[key] = await getProcessedValue(value)
    }
    return data as T;
};
