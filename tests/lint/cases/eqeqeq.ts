function f(a: any, b: any) {
  // expect: eqeqeq error
  return a == b;
}
JSON.stringify(f);