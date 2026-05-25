declare const maybe: string | undefined;

// expect: noNonNullAssertedNullishCoalescing error
const value = maybe! ?? "fallback";
JSON.stringify(value);
