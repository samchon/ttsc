/** @deprecated Use newFn instead. */
declare function oldFn(): number;

declare function newFn(): number;

/** @deprecated */
declare const oldValue: number;

declare const freshValue: number;

interface Box {
  /** @deprecated Use freshField. */
  oldField: number;
  freshField: number;
}

declare const box: Box;

// Positive: calling a deprecated function.
// expect: typescript/no-deprecated error
const a = oldFn();

// Positive: reading a deprecated variable.
// expect: typescript/no-deprecated error
const b = oldValue;

// Positive: accessing a deprecated property.
// expect: typescript/no-deprecated error
const c = box.oldField;

// Negative: the non-deprecated counterparts are fine.
const d = newFn();
const e = freshValue;
const f = box.freshField;

JSON.stringify({ a, b, c, d, e, f });
