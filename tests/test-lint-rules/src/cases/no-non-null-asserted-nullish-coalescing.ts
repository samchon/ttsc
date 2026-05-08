declare const maybe: string | undefined;

// expect: no-non-null-asserted-nullish-coalescing error
const value = maybe! ?? "fallback";
JSON.stringify(value);
