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

// Positive: magic number wrapped in unary minus.
function offsetOf(value: number): number {
  // expect: typescript/no-magic-numbers error
  return value + -42;
}

// Negative: enum member initializers are the lifting step.
enum HttpStatus {
  Ok = 200,
  NotFound = 404,
  ServerError = 500,
}

// Negative: literal numeric type — type position.
type ZeroOrOne = 0 | 1;

// Negative: unit values carry intrinsic meaning.
const counter = 0;
const stepSize = 1;
const notFound = -1;

JSON.stringify({
  isLong,
  feeFor,
  offsetOf,
  HttpStatus,
  counter,
  stepSize,
  notFound,
  zeroOrOne: null as ZeroOrOne | null,
});
