const processors = {
  base64: async (value: Blob) => {
    const reader = new FileReader();
    return new Promise<string>((resolve, reject) => {
      reader.onloadend = () => {
        const base64 = reader.result;
        if (typeof base64 !== "string") {
          reject(new Error("FileReader result is not a string"));
        } else {
          resolve(base64);
        }
      };
      reader.onerror = () => reject(new Error("Error reading file"));
      reader.readAsDataURL(value);
    });
  },
};

const getProcessedValue = async (value: FormDataEntryValue): Promise<string> => {
  if (value instanceof Blob) {
    // Only the base64 processor exists today; the lookup keeps new processors
    // declarative. A Blob routed to a missing processor is an invariant break,
    // not a silent string coercion.
    if (!("base64" in processors)) {
      throw new Error(`No processor registered for Blob field (processors: ${Object.keys(processors).join(", ")})`);
    }
    return await processors.base64(value);
  }
  if (typeof value !== "string") {
    throw new Error(`Unexpected form value type: ${typeof value}`);
  }
  return value;
};

/**
 * Read all fields of a form into a plain string record (files -> base64).
 * Returns a runtime `Record<string, string>`; callers that need a domain type
 * validate the record with a schema parser (see ~/data/schemas). This replaces
 * the old `formJson<T>` that cast the DOM's output straight to `T`.
 */
export const formJson = async (form: HTMLFormElement): Promise<Record<string, string>> => {
  const formData = new FormData(form);
  const data: Record<string, string> = {};
  for (const [key, value] of formData) {
    data[key] = await getProcessedValue(value);
  }
  return data;
};
