declare const list: string[];
declare const tuple: [number, number, number];
declare function sideEffect(value: unknown): void;

// Positive: `arr.filter(p)[0]` — the canonical shape the rule guards.
// `.find(p)` short-circuits on the first match instead of materializing
// the whole filtered array.
// expect: typescript/prefer-find error
const first = list.filter((s) => s.length > 0)[0];

// Positive: `arr.filter(p).at(0)` — the `.at(0)` variant.
// expect: typescript/prefer-find error
const firstAt = list.filter((s) => s.length > 0).at(0);

// Positive: tuple receiver — still an array-like.
// expect: typescript/prefer-find error
const firstTuple = tuple.filter((n) => n > 0)[0];

// Negative: `.find` — already the form the rule asks for.
const ok1 = list.find((s) => s.length > 0);

// Negative: non-zero index — `[1]` keeps the second match, which `find`
// cannot express.
const ok2 = list.filter((s) => s.length > 0)[1];

// Negative: `.at(1)` — same reason as `[1]`.
const ok3 = list.filter((s) => s.length > 0).at(1);

// Negative: filter is not on an array receiver — a user method with the
// same name should not fire.
declare const tracker: { filter(value: (s: string) => boolean): string };
const ok4 = tracker.filter((s) => s.length > 0);

sideEffect({ first, firstAt, firstTuple, ok1, ok2, ok3, ok4 });
