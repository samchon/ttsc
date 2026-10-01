declare const anyValue: any;
declare function takesNumber(value: number): void;
declare function takesString(value: string): void;

// Positive: passing `any` to a `number` parameter loses the static guarantee.
// expect: typescript/no-unsafe-argument error
takesNumber(anyValue);

// Positive: passing `any` to a `string` parameter is just as unsafe.
// expect: typescript/no-unsafe-argument error
takesString(anyValue);

// Negative: a properly typed argument is fine.
takesNumber(42);
