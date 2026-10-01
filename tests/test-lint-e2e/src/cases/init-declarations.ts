// Positive: a `let` declaration without an initializer leaves the
// binding implicitly `undefined` — initialize it at the declaration
// site instead.
// expect: init-declarations error
let pending: number | undefined;
pending = 1;

// Positive: same shape applied to `var`.
// expect: init-declarations error
var legacy: string | undefined;
legacy = "ok";

// Negative: `let` with an initializer is fine.
let ready = 0;

// Negative: `const` is exempt — the grammar already requires the
// initializer, so the rule has nothing extra to enforce.
const fixed = 42;

JSON.stringify({ pending, legacy, ready, fixed });
