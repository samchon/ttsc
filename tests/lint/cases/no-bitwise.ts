function f(a: number, b: number) {
  // expect: no-bitwise error
  return a & b;
}
JSON.stringify(f);