// expect: typescript/ban-ts-comment error
// @ts-nocheck
// expect: typescript/ban-ts-comment error
// @ts-ignore
const a: number = "oops" as any;

// @ts-expect-error: described suppressions stay allowed by default
const b: number = "oops";

// just a comment mentioning @ts-ignore stays a negative control
JSON.stringify([a, b]);
