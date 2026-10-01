// Positive: parseInt with radix 2 → binary literal.
// expect: prefer-numeric-literals error
const bin = parseInt("11", 2);

// Positive: parseInt with radix 8.
// expect: prefer-numeric-literals error
const oct = parseInt("17", 8);

// Positive: parseInt with radix 16.
// expect: prefer-numeric-literals error
const hex = parseInt("ff", 16);

// Negative: numeric literal form (the suggested replacement).
const ok = 0b11;

// Negative: parseInt without a radix — only signals base-10 implicitly,
// out of scope for this rule.
const decimal = parseInt("42");

// Negative: parseInt with a non-literal first argument.
declare const dynamic: string;
const dyn = parseInt(dynamic, 16);

JSON.stringify({ bin, oct, hex, ok, decimal, dyn });
