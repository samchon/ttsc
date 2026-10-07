declare const x: unknown;

// Positive: void in a variable initializer.
// expect: typescript/no-confusing-void-expression error
const a = void x;

// Positive: void as a call argument.
function take(value: unknown): void {
  JSON.stringify(value);
}
// expect: typescript/no-confusing-void-expression error
take(void x);

// Positive: void in a return statement.
function wrapped(): unknown {
  // expect: typescript/no-confusing-void-expression error
  return void x;
}

// Positive: void in a binary expression.
// expect: typescript/no-confusing-void-expression error
const sum = (void x) + 1;

// Positive: void in a ternary.
// expect: typescript/no-confusing-void-expression error
const picked = (void x) ? 1 : 2;

// Negative: void as an expression statement.
void x;

// Negative: void as an arrow function concise body.
const noop = () => void x;

// Negative: nested void void — only the outer is checked; the inner
// is acceptable as the operand of another `void`.
void void x;

JSON.stringify({ a, take, wrapped, sum, picked, noop });
