// Type-aware fixture for typescript/no-meaningless-void-operator.
//
// The rule fires when `void X` is applied to an `X` already statically
// typed `void` — the operator discards a value that was never going to
// produce one. Operands of other types are left alone because the
// operator does observable work (returns `undefined` instead of the
// runtime value, which can still matter in callback-result contexts).

declare const value: number;

function voidReturning(): void {
  JSON.stringify({});
}

// Positive: `void` applied to a `void`-returning call — operand is
// already statically typed `void`, so the operator does nothing.
// expect: typescript/no-meaningless-void-operator error
void voidReturning();

// Positive: same shape inside a value position — still meaningless.
function wrapper(): void {
  // expect: typescript/no-meaningless-void-operator error
  return void voidReturning();
}

// Negative: operand is a real value — `void X` coerces it to undefined,
// which is the intended use of the operator.
void value;

// Negative: bare statement form on a non-void operand stays accepted.
void value;

JSON.stringify({ voidReturning, wrapper });
