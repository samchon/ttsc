declare const a: any;
declare const b: any;
declare const c: any;
declare const d: any;

// expect: no-mixed-operators error
const m1 = a && b || c;

// expect: no-mixed-operators error
const m2 = a || b && c;

// expect: no-mixed-operators error
const m3 = a | b && c;

// Inner expression is parenthesized — author acknowledged the grouping.
const ok1 = (a && b) || c;

// Same operator chain — no confusion.
const ok2 = a && b && c && d;

// Arithmetic mix is not flagged (different precedence is well-known).
const ok3 = a + b * c;

JSON.stringify([m1, m2, m3, ok1, ok2, ok3]);
