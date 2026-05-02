function f(x: number) {
  // expect: yoda error
  return 1 === x;
}
JSON.stringify(f);