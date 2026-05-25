function f(x: number) {
  // expect: useIsNaN error
  return x === NaN;
}
JSON.stringify(f);
