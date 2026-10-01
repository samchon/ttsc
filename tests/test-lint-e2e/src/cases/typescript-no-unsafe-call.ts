declare const anyValue: any;
declare const safe: (x: number) => number;

// Positive: invoking an `any`-typed callee escapes every signature check.
// expect: typescript/no-unsafe-call error
anyValue();

// Positive: `new` on `any` is just as unsafe as a plain call.
// expect: typescript/no-unsafe-call error
new anyValue();

// Positive: a tagged template call on `any` is still a call.
// expect: typescript/no-unsafe-call error
anyValue`tag`;

// Negative: a properly typed callee is fine.
safe(1);
