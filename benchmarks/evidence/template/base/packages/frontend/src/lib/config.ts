const readBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`Expected a boolean environment value, received "${value}".`);
};

/** Validated frontend environment settings. */
export const config = {
  apiHost: import.meta.env.VITE_API_HOST ?? "http://127.0.0.1:37001",
  simulate: readBoolean(import.meta.env.VITE_API_SIMULATE, true),
} as const;
