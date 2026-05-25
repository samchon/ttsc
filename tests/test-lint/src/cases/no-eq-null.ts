function f(x: any) {
  // expect: noEqNull error
  return x == null;
}
JSON.stringify(f);
