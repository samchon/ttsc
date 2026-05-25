function f(x: number | null, y: number) {
  // expect: noConfusingNonNullAssertion error
  return x! === y;
}
JSON.stringify(f);
