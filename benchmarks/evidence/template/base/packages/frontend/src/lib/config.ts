const readBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`Expected a boolean environment value, received "${value}".`);
};

/**
 * Validated frontend environment settings.
 *
 * Simulation defaults off. No `.env` ships, so the default is the mode every
 * checked-in workspace runs in, and a default of on means the application never
 * contacts the backend unless someone opts in — while the gate that decides
 * whether the product works is the live one.
 */
export const config = {
  apiHost: import.meta.env.VITE_API_HOST ?? "http://127.0.0.1:37001",
  simulate: readBoolean(import.meta.env.VITE_API_SIMULATE, false),
} as const;
