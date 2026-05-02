function f(a: any, b: any) {
  // expect: no-sequences error
  return a, b;
}
JSON.stringify(f);