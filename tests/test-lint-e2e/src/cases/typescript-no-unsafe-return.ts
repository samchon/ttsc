declare const anyValue: any;

// Positive: `any`-typed expression returned from a function whose
// declared return type is the concrete `number` — the `any` leaks past
// the type boundary.
function asNumber(): number {
  // expect: typescript/no-unsafe-return error
  return anyValue;
}

// Negative: arrow function whose body is itself an `any` expression —
// the type-checker pre-flags the leak so the rule does not need to.
const asObject = (): { id: number } => anyValue;

// Negative: declared return type is `any` itself — the leak is
// explicitly part of the contract.
function asAny(): any {
  return anyValue;
}

JSON.stringify({ a: asNumber(), b: asObject(), c: asAny() });
