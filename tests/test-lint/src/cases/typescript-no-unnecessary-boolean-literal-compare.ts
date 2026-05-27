declare const flag: boolean;
declare const ready: boolean;
declare const maybe: boolean | null;
declare const optional: boolean | undefined;
declare const labelOf: (b: boolean) => string;

// Positive: `=== true` against a pure boolean — collapses to `flag`.
// expect: typescript/no-unnecessary-boolean-literal-compare error
const yes = flag === true;

// Positive: `!== false` against a pure boolean — same intent as `flag`.
// expect: typescript/no-unnecessary-boolean-literal-compare error
const stillYes = flag !== false;

// Positive: `=== false` against a pure boolean — collapses to `!flag`.
// expect: typescript/no-unnecessary-boolean-literal-compare error
const no = ready === false;

// Positive: `!= true` (loose) against a pure boolean — also redundant.
// expect: typescript/no-unnecessary-boolean-literal-compare error
const looseNo = ready != true;

// Positive: literal on the left side — order does not matter.
// expect: typescript/no-unnecessary-boolean-literal-compare error
const reversed = true === flag;

// Negative: `boolean | null` — the literal compare also strips the null
// branch, so dropping it would change the meaning.
const guarded = maybe === true;

// Negative: `boolean | undefined` — same carve-out as the nullable case.
const guardedOptional = optional !== false;

// Negative: comparing two non-literal expressions — no literal involved.
const passed = flag === ready;

labelOf(yes);
labelOf(stillYes);
labelOf(no);
labelOf(looseNo);
labelOf(reversed);
labelOf(guarded ?? false);
labelOf(guardedOptional ?? false);
labelOf(passed);
