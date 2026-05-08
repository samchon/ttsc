function f(x: number) {
  // expect: use-isnan error
  return x === NaN;
}
JSON.stringify(f);
