// Positive: a four-parameter function declaration exceeds the default
// limit of three.
// expect: max-params error
function four(a: number, b: number, c: number, d: number): number {
  return a + b + c + d;
}

// Positive: arrow functions are flagged on the same terms.
// expect: max-params error
const fiveArrow = (a: number, b: number, c: number, d: number, e: number): number => a + b + c + d + e;

// Positive: methods inside a class declaration use the same threshold.
class Calculator {
  // expect: max-params error
  combine(a: number, b: number, c: number, d: number): number {
    return a + b + c + d;
  }
}

// Negative: exactly three parameters is at the limit, not over it.
function three(a: number, b: number, c: number): number {
  return a + b + c;
}

// Negative: a zero-parameter function is trivially under the limit.
function noArgs(): number {
  return 0;
}

JSON.stringify({
  four: four(1, 2, 3, 4),
  fiveArrow: fiveArrow(1, 2, 3, 4, 5),
  combine: new Calculator().combine(1, 2, 3, 4),
  three: three(1, 2, 3),
  noArgs: noArgs(),
});
