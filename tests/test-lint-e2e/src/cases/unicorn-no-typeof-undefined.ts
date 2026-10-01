// Regression corpus for unicorn/no-typeof-undefined. Upstream treats global
// operands, reversed operands, and template-literal operands as valid; only a
// `typeof <local> === "undefined"` comparison fires.
declare const value: { deep: unknown };

// Valid: rewriting a global to `window === undefined` throws a ReferenceError
// when the global is undeclared, so globals are skipped by default.
typeof window === "undefined";
typeof globalThis === "undefined";

// Valid: the `typeof` must be the left operand.
"undefined" === typeof value.deep;

// Valid: a template literal is a TemplateLiteral, not a string literal.
typeof value.deep === `undefined`;

// A binding declared in this file is not a global, so it is reported.
let bar: unknown;
// expect: unicorn/no-typeof-undefined error
typeof bar === "undefined";
