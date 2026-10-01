declare const a: any;
declare const b: any;
declare const c: any;
declare const d: any;

// Logical mixed with a different logical: `&&` binds tighter than `||`.
// expect: no-mixed-operators error
const m1 = a && b || c;

// expect: no-mixed-operators error
const m2 = a || b && c;

// Arithmetic mixing is in the default group: `*` binds tighter than `+`.
// expect: no-mixed-operators error
const m3 = a + b * c;

// Bitwise next to logical is a cross-group pair ESLint never flags.
const ok1 = a | b && c;

// Inner expression is parenthesized — author acknowledged the grouping.
const ok2 = (a && b) || c;

// Same operator chain — no confusion.
const ok3 = a && b && c && d;

// Same precedence inside the arithmetic group is allowed by default.
const ok4 = a + b - c;

JSON.stringify([m1, m2, m3, ok1, ok2, ok3, ok4]);
