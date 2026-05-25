function f(x: number) {
  // expect: noCompareNegZero error
  return x === -0;
}
