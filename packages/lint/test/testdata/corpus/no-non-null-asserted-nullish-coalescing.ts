declare const maybe: string | undefined;

// expect: typescript/no-non-null-asserted-nullish-coalescing error
const value = maybe! ?? "fallback";
JSON.stringify(value);
