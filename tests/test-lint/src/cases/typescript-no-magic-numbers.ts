// AST-only fixture for typescript/no-magic-numbers.
//
// TS-aware extension of the core `no-magic-numbers` rule. Inline
// numeric literals are unexplained constants; the rule asks the author
// to lift them into a named constant or enum member. The TS variant
// inherits the core's conservative whitelist (`-1`, `0`, `1`,
// `const x = N`, `arr[N]`, enum member values) and adds skips for
// TS-only positions: literal types, type-position numeric indexes,
// and readonly class property initializers.

// Negative: enum member values are intentional named numbers — the
// enum declaration IS the lift step the rule asks for.
enum HttpStatus {
  Ok = 200,
  NotFound = 404,
  ServerError = 500,
}

// Negative: literal numeric type — type position, not a runtime value.
type ZeroOrTwo = 0 | 2;

// Negative: unit values carry intrinsic meaning across codebases
// (sentinel, identity, step).
const counter = 0;
const stepSize = 1;
const notFound = -1;

// Negative: `const x = N` is the named binding the rule wants.
const SECONDS_PER_DAY = 86400;

// Negative: readonly class property — the field name carries the
// meaning of the value, which is the rule's lift step.
class Timeout {
  readonly defaultMs = 5000;
}

// Positive: bare magic number in a comparison.
function isLong(value: number): boolean {
  // expect: typescript/no-magic-numbers error
  return value > 86400;
}

// Positive: magic number in an arithmetic expression.
function feeFor(amount: number): number {
  // expect: typescript/no-magic-numbers error
  return amount * 0.035;
}

// Positive: `let` cannot anchor a named constant — the value stays
// magic in the position it was written.
// expect: typescript/no-magic-numbers error
let timeoutMs = 5000;

JSON.stringify({
  HttpStatus,
  counter,
  stepSize,
  notFound,
  SECONDS_PER_DAY,
  Timeout,
  isLong,
  feeFor,
  timeoutMs,
  zeroOrTwo: null as ZeroOrTwo | null,
});
