function f(a: number, b: number) {
  // expect: noBitwise error
  return a & b;
}
JSON.stringify(f);
