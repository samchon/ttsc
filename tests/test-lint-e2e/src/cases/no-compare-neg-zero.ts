function f(x: number) {
  // expect: no-compare-neg-zero error
  return x === -0;
}
