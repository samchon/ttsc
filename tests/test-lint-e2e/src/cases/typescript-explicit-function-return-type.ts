// expect: typescript/explicit-function-return-type error
function noReturnType(x: number) {
  return x + 1;
}

function withReturnType(x: number): number {
  return x + 1;
}

class Foo {
  // expect: typescript/explicit-function-return-type error
  bare(x: number) {
    return x + 1;
  }

  annotated(x: number): number {
    return x + 1;
  }
}

// Arrow function — intentionally not flagged by the AST-only baseline.
const arrow = (x: number) => x + 1;

// Function expression — also skipped.
const fn = function (x: number) {
  return x + 1;
};

// Overload signatures (no body) are skipped; only the implementation
// with a body would be flagged, and this one carries a return type.
function over(x: number): number;
function over(x: string): string;
function over(x: number | string): number | string {
  return x;
}

JSON.stringify({ noReturnType, withReturnType, Foo, arrow, fn, over });
