function f(x: number | null) {
  // expect: noExtraNonNullAssertion error
  return x!!;
}
JSON.stringify(f);
