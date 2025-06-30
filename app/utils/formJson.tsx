export const formJson = <T extends {}>(form: HTMLFormElement): T => {
    const formData = new FormData(form);
    const data: Record<string, string> = {};
    formData.forEach((value, key) => {
        data[key] = value as string;
    });
    return data as T;
};
